import type { SongResult, UnifiedSong } from '../../types';
import type {
    AudioQualityPreference,
    MediaId,
    OnlineMusicProvider,
    ProviderCollection,
    ProviderLyricsResult,
    ProviderPage,
    ProviderUser,
} from '../../types/onlineMusic';
import { OnlineProviderError } from '../../types/onlineMusic';
import { createProviderSongMetadata } from '../../utils/songMetadata';
import { toSafeRemoteUrl as toSafePlaybackUrl } from '../../utils/appPlaybackHelpers';
import { parseLyricsByFormat } from '../../utils/lyrics/parserCore';
import { normalizeQqCollection, normalizeQqSong, normalizeQqUser } from './qqNormalize';
import { clearQqSession, getQqTransportAvailability, hasQqSession, requestQq } from './qqTransport';

// QQ adapter ported from Folia Major; all app flows continue through Omni.
const errorFields = (error: unknown) => ({ name: error instanceof Error ? error.name : 'Error' });
const QQ_QUALITY_FALLBACKS: Record<
    AudioQualityPreference,
    Array<{ apiQuality: '128' | '320' | 'flac'; resolvedQuality: AudioQualityPreference }>
> = {
    standard: [{ apiQuality: '128', resolvedQuality: 'standard' }],
    high: [
        { apiQuality: '320', resolvedQuality: 'high' },
        { apiQuality: '128', resolvedQuality: 'standard' },
    ],
    lossless: [
        { apiQuality: 'flac', resolvedQuality: 'lossless' },
        { apiQuality: '320', resolvedQuality: 'high' },
        { apiQuality: '128', resolvedQuality: 'standard' },
    ],
    // The current backend protocol exposes FLAC but no distinct Hi-Res tier.
    hires: [
        { apiQuality: 'flac', resolvedQuality: 'lossless' },
        { apiQuality: '320', resolvedQuality: 'high' },
        { apiQuality: '128', resolvedQuality: 'standard' },
    ],
};

const getQqSongMid = (song: SongResult): string => {
    const sourceRef =
        song.sourceRef?.kind === 'online' && song.sourceRef.providerId === 'qq' ? song.sourceRef : undefined;
    return String(song.qqMid || sourceRef?.providerData?.songMid || sourceRef?.mediaId || '').trim();
};

/**
 * 读一次歌单详情，并把「上游没读到这个歌单」和「歌单确实是空的」分开。
 *
 * 上游这条是匿名 CGI：歌单不公开时它**照样回 `code: 0`**，只是 `cdlist[0]` 退化成一个空壳 ——
 * 没有 `dissname`，songlist 为空数组。2026-09-11 用真实账号对一个 `dirShow: 2` 的自建歌单抓到的是
 * `{ code: 0, disstid: '9777066643', dissname: undefined, songlist: [] }`：`disstid` 照样回声，
 * 所以判据是 `dissname` 在不在，而不是 `disstid`，也不是 `cdlist` 或 songlist 的长度 —— 真的空歌单
 * 会带着完整的 `dissname` 回来。两者混成同一个空结果，就是用户看到的那个没有报错的「暂无内容」。
 */
const loadRawPlaylistTracks = async (
    id: MediaId,
    collection?: ProviderCollection,
): Promise<{ tracks: unknown[]; total?: number }> => {
    const response = await requestQq<any>('song_list_detail', { disstid: String(id) });
    const cdlist = response?.response?.cdlist;
    const detail = Array.isArray(cdlist) ? cdlist[0] : undefined;
    const dissname = String(detail?.dissname ?? '').trim();

    if (!detail || typeof detail !== 'object' || !dissname) {
        // 已知不公开时报 `not-public` 而不是 `invalid-response`：这不是协议坏了，是这条匿名
        // 路由没资格读它 —— 后端补上带凭据的歌单路由之后，自建歌单就不会再走到这里。调用方据此
        // 给用户一句能看懂的解释，而不是把协议细节甩到界面上。
        const dirShow = Number(collection?.providerData?.dirShow);
        const notPublic = Number.isFinite(dirShow) && dirShow !== 1;
        throw new OnlineProviderError(
            'invalid-response',
            `QQMusicApi song_list_detail could not read playlist ${String(id)}` +
                `${notPublic ? ' (not a public playlist; this anonymous endpoint cannot read it)' : ''}`,
            'qq',
            response?.response,
        );
    }

    const tracks = Array.isArray(detail.songlist) ? detail.songlist : [];
    const total = Number(detail.total_song_num ?? detail.songnum);
    return { tracks, ...(Number.isFinite(total) && total >= 0 ? { total } : {}) };
};

// 后端有没有 `/user/playlist-detail` 只取决于它的版本，一个会话里不会变，所以探到一次 404
// 就记下来，不再为每一页重试。刷新页面自然会重新探测。
let ownedPlaylistRouteMissing = false;

export const resetQqProviderRuntimeCache = (): void => {
    ownedPlaylistRouteMissing = false;
};

/**
 * 带凭据地读用户自己的歌单，响应形状与 `/user/liked-songs` 一致。
 *
 * 返回 `null` 表示这个后端没有这条路由（旧版本），调用方据此回落到匿名路径 —— 与
 * `login_channels` 的处理方式相同：404 是「没有声明这个能力」，不是错误。其余失败照常抛出，
 * 否则一次网络抖动会被误判成「后端不支持」并在整个会话里粘住。
 */
const loadRawOwnedPlaylistTracks = async (
    tid: MediaId,
    dirId: number,
    limit: number,
    offset: number,
): Promise<{ tracks: unknown[]; total?: number; more: boolean } | null> => {
    if (ownedPlaylistRouteMissing) return null;
    try {
        const response = await requestQq<any>('user_playlist_detail', {
            tid: String(tid),
            dirid: dirId,
            offset,
            limit,
        });
        const tracks = Array.isArray(response?.songs) ? response.songs : [];
        const total = Number(response?.total);
        return {
            tracks,
            ...(Number.isFinite(total) && total >= 0 ? { total } : {}),
            more: response?.more === true,
        };
    } catch (error) {
        if (error instanceof OnlineProviderError && error.code === 'unsupported') {
            ownedPlaylistRouteMissing = true;
            return null;
        }
        throw error;
    }
};

const loadRawLikedTracks = async (
    limit: number,
    offset: number,
): Promise<{ tracks: unknown[]; total?: number; more: boolean }> => {
    const response = await requestQq<any>('user_liked_songs', { offset, limit });
    const tracks = Array.isArray(response?.songs) ? response.songs : [];
    const total = Number(response?.total);
    return {
        tracks,
        ...(Number.isFinite(total) && total >= 0 ? { total } : {}),
        more: response?.more === true,
    };
};

const getPlaylistTracks = async (
    id: MediaId,
    limit: number,
    offset: number,
    collection?: ProviderCollection,
): Promise<ProviderPage<ReturnType<typeof normalizeQqSong>>> => {
    const safeLimit = Math.max(1, limit);
    const safeOffset = Math.max(0, offset);
    const dirId = Number(collection?.providerData?.dirId);
    const owned = collection?.providerData?.owned === true;

    // 我喜欢留在它自己那条早就可用的路由上：换到新路由只会让一个本来就正常的功能去承担
    // 新后端的风险，而它要解决的问题（读不到不公开的自建歌单）在这里根本不存在。
    if (dirId === 201) {
        const { tracks, total, more } = await loadRawLikedTracks(safeLimit, safeOffset);
        const items = tracks.map(normalizeQqSong);
        const nextOffset = offset + items.length;
        return {
            items,
            ...(total === undefined ? {} : { total }),
            hasMore: more || (total !== undefined && nextOffset < total),
            nextOffset,
        };
    }

    // 其余自建歌单优先走带凭据的路由：只有它读得到不公开的歌单，而且支持真正的分页，不必像匿名
    // 路径那样每翻一页重拉整张歌单。判据是 `owned` 而不是 dirId —— 收藏的歌单也带 dirId，而带凭据的
    // 路由读收藏歌单会少歌：实测一张 37 首的收藏歌单只回 36 首（缺一首付费歌），连 total 也跟着变成 36，
    // 界面上完全看不出来。收藏歌单留在匿名路由上是完整的。
    if (owned && Number.isFinite(dirId) && dirId > 0) {
        const page = await loadRawOwnedPlaylistTracks(id, dirId, safeLimit, safeOffset);
        if (page) {
            const items = page.tracks.map(normalizeQqSong);
            const nextOffset = safeOffset + items.length;
            return {
                items,
                ...(page.total === undefined ? {} : { total: page.total }),
                // 空页必须停：上游的 total 可能比实际能读到的多（被过滤的歌），只看 total 会一直翻空页。
                hasMore: items.length > 0 && (page.more || (page.total !== undefined && nextOffset < page.total)),
                nextOffset,
            };
        }
    }

    // 收藏的、分享链接进来的歌单本来就只能走匿名路由；后端太旧时也回落到这里。
    const { tracks, total } = await loadRawPlaylistTracks(id, collection);
    const items = tracks.slice(offset, offset + Math.max(0, limit)).map(normalizeQqSong);
    const nextOffset = offset + items.length;
    return {
        items,
        ...(total === undefined ? {} : { total }),
        hasMore: nextOffset < tracks.length,
        nextOffset,
    };
};

const getSongDetail = async (id: MediaId) => {
    const response = await requestQq<any>('song_info', { songmid: String(id) });
    const track = response?.response?.songinfo?.data?.track_info;
    if (!track || typeof track !== 'object') return null;
    const song = normalizeQqSong(track);
    return song.qqMid ? song : null;
};

const qqSongDetailRequests = new Map<string, Promise<UnifiedSong | null>>();

// 同一首歌的专辑与歌手会各触发一次解析，两次落到同一个 songmid 上，去重掉重复请求。
const requestQqSongDetail = (songmid: string): Promise<UnifiedSong | null> => {
    const cached = qqSongDetailRequests.get(songmid);
    if (cached) return cached;

    const request = getSongDetail(songmid).finally(() => {
        if (qqSongDetailRequests.get(songmid) === request) qqSongDetailRequests.delete(songmid);
    });
    qqSongDetailRequests.set(songmid, request);
    return request;
};

const hasQqCatalogRefs = (song: UnifiedSong): boolean =>
    Boolean(
        song.album?.catalogRef && song.artists.length > 0 && song.artists.every((artist) => Boolean(artist.catalogRef)),
    );

// 搜索复用的是 `utils/lyrics` 里那条 `u.y.qq.com` 歌词搜索，它只把数字 `album.id` /
// `singer.id` 带出来，albummid 与 singermid 在那一层就被丢掉了。点专辑 / 歌手时补一次
// `/getSongInfo` 取回 mid —— 与 kugou 补 KRM 元数据是同一套契约，只在真的要导航时才发请求。
export const resolveQqSongCatalogRefs = async (song: UnifiedSong): Promise<UnifiedSong> => {
    if (hasQqCatalogRefs(song)) return song;

    const songmid = getQqSongMid(song);
    if (!songmid) return song;

    const detail = await requestQqSongDetail(songmid);
    if (!detail) return song;

    return {
        ...song,
        // 歌手整组替换：解析后的每一项都带 mid，混用两份会让 catalogRefs 的按名匹配对上没有 mid 的那个。
        artists: detail.artists.length > 0 ? detail.artists : song.artists,
        album: {
            ...song.album,
            ...(detail.album.catalogRef ? { id: detail.album.id, catalogRef: detail.album.catalogRef } : {}),
            name: song.album.name || detail.album.name,
            coverUrl: song.album.coverUrl || detail.album.coverUrl,
        },
    };
};

const getAudioSource = async (song: SongResult, quality: AudioQualityPreference) => {
    const songmid = getQqSongMid(song);
    if (!songmid) return null;
    const sourceRef =
        song.sourceRef?.kind === 'online' && song.sourceRef.providerId === 'qq' ? song.sourceRef : undefined;
    const mediaId = String(sourceRef?.providerData?.mediaMid || '').trim();

    // The backend answers HTTP 200 with an empty `url` plus an `error` string when the account may
    // not stream the song (membership, region, takedown). Without keeping that apart from a request
    // failure, an unplayable song looks exactly like a transient error worth retrying.
    let sawEmptyPlayLink = false;

    for (const candidate of QQ_QUALITY_FALLBACKS[quality]) {
        try {
            const response = await requestQq<any>('music_play', {
                songmid,
                ...(mediaId ? { mediaId } : {}),
                quality: candidate.apiQuality,
            });
            const direct = response?.data?.playUrl?.[songmid];
            const fallback = Object.values(response?.data?.playUrl ?? {})[0] as any;
            const entry = direct ?? fallback;
            const url = toSafePlaybackUrl(String(direct?.url || fallback?.url || ''));
            if (url) {
                return {
                    url,
                    fetchedAt: Date.now(),
                    quality: candidate.resolvedQuality,
                };
            }
            if (entry) {
                sawEmptyPlayLink = true;
            }
        } catch (error) {
            if (error instanceof OnlineProviderError && error.code === 'auth-required') throw error;
            console.warn('[QQProvider] playback:quality-failed', {
                requestedQuality: quality,
                candidateQuality: candidate.resolvedQuality,
                ...errorFields(error),
            });
        }
    }

    console.warn('[QQProvider] playback:no-source', {
        requestedQuality: quality,
        hasMediaMid: Boolean(mediaId),
        // `true` means the upstream answered normally but issued no stream for this account.
        upstreamRefusedPlayLink: sawEmptyPlayLink,
    });
    return null;
};

// Load the account library through QQ's authenticated session.
const getUserPlaylists = async (
    _userId: MediaId,
    limit: number,
    offset: number,
): Promise<ProviderPage<ProviderCollection>> => {
    // 不传 `uid`：会话账号是这条 route 唯一读得到的账号，而后端从凭据里挑出来的账号 ID 比前端
    // 手上这个展示用的可靠 —— 微信凭据的 `musicid` 是占位的 0，回传它只会让自建歌单整段消失。
    const response = await requestQq<any>('user_playlist', {});
    const playlists = Array.isArray(response?.playlist) ? response.playlist : [];
    const items = playlists
        .slice(offset, offset + Math.max(0, limit))
        .map((item: unknown) => normalizeQqCollection(item));
    const nextOffset = offset + items.length;
    const total = Number(response?.total);
    if (offset === 0) {
        // `more` reports an upstream continuation this endpoint cannot request, so it is only observable here.
        console.info('[QQProvider] playlists:loaded', {
            count: playlists.length,
            ...(Number.isFinite(total) ? { total } : {}),
            more: Boolean(response?.more),
        });
    }

    return {
        items,
        ...(Number.isFinite(total) && total >= 0 ? { total } : {}),
        hasMore: nextOffset < playlists.length,
        nextOffset,
    };
};

const getLikedSongIds = async (_userId: MediaId): Promise<MediaId[]> => {
    const tracks: unknown[] = [];
    let offset = 0;
    while (offset < 10000) {
        const page = await loadRawLikedTracks(100, offset);
        tracks.push(...page.tracks);
        const nextOffset = offset + page.tracks.length;
        if (page.tracks.length === 0 || (!page.more && (page.total === undefined || nextOffset >= page.total))) break;
        offset = nextOffset;
    }
    return tracks
        .map(normalizeQqSong)
        .map((item) => (item.sourceRef?.kind === 'online' ? item.sourceRef.mediaId : item.id))
        .filter((id): id is MediaId => id !== undefined && id !== null && id !== '');
};

const getUserAlbums = async (
    _userId: MediaId,
    limit: number,
    offset: number,
): Promise<ProviderPage<ProviderCollection>> => {
    // 这条 route 只读会话账号，没有 uid 参数 —— 与 `/user/playlist` 的 uid 兜底不同。
    // 分页也是后端做的，不像歌单那样一次全取回来再本地切片。
    const safeOffset = Math.max(0, offset);
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const response = await requestQq<any>('user_albums', { offset: safeOffset, limit: safeLimit });
    const albums = Array.isArray(response?.albums) ? response.albums : [];
    const items = albums.map((item: unknown) => normalizeQqCollection(item, 'album'));
    const nextOffset = safeOffset + items.length;
    const total = Number(response?.total);

    return {
        items,
        ...(Number.isFinite(total) && total >= 0 ? { total } : {}),
        // 空页一律终止翻页：后端说 more 但一条都没给的话，继续翻就是死循环。
        hasMore: Boolean(response?.more) && items.length > 0,
        nextOffset,
    };
};

// `/getAlbumInfo` 一次返回专辑详情与全部曲目，专辑详情与曲目两个方法共用同一份响应形状。
const loadRawAlbum = async (id: MediaId): Promise<{ album: any; tracks: unknown[] }> => {
    const response = await requestQq<any>('album_info', { albummid: String(id ?? '').trim() });
    const data = response?.response?.data;
    const album = data && typeof data === 'object' && !Array.isArray(data) ? data : undefined;
    return { album, tracks: Array.isArray(album?.list) ? album.list : [] };
};

const getAlbumDetail = async (
    id: MediaId,
    existingCollection?: ProviderCollection,
): Promise<ProviderCollection | null> => {
    const { album } = await loadRawAlbum(id);
    if (!album) return existingCollection || null;

    const normalized = normalizeQqCollection({ ...album, albummid: album.mid ?? String(id) }, 'album');
    return {
        ...normalized,
        name: normalized.name || existingCollection?.name || '',
        coverUrl: normalized.coverUrl || existingCollection?.coverUrl,
        description: normalized.description || existingCollection?.description,
        trackCount:
            normalized.trackCount !== undefined && normalized.trackCount > 0
                ? normalized.trackCount
                : existingCollection?.trackCount,
        artists: normalized.artists?.length ? normalized.artists : existingCollection?.artists,
        publishedAt: normalized.publishedAt ?? existingCollection?.publishedAt,
        publisher: normalized.publisher || existingCollection?.publisher,
    };
};

const getAlbumTracks = async (
    id: MediaId,
    limit = 50,
    offset = 0,
    collection?: ProviderCollection,
): Promise<ProviderPage<ReturnType<typeof normalizeQqSong>>> => {
    // 上游一次返回整张专辑且不接受分页参数，所以页窗在本地切片，与歌单曲目的处理方式一致。
    const { album, tracks } = await loadRawAlbum(id);
    // 专辑曲目条目只带 albumname 顶层字段，正规化后专辑名为空，用专辑本身的名字补齐。
    const albumName = String(collection?.name || album?.name || '');
    const items = tracks.slice(offset, offset + Math.max(0, limit)).map((raw) => {
        const song = normalizeQqSong(raw);
        if (song.album.name || !albumName) return song;
        return { ...song, album: { ...song.album, name: albumName } };
    });
    const total = Number(album?.total_song_num ?? album?.total ?? tracks.length);
    const nextOffset = offset + items.length;
    return {
        items,
        ...(Number.isFinite(total) && total >= 0 ? { total } : {}),
        hasMore: nextOffset < tracks.length,
        nextOffset,
    };
};

const getArtistDetail = async (id: MediaId): Promise<ProviderCollection | null> => {
    const singermid = String(id ?? '').trim();
    if (!singermid) return null;

    // `get_singer_detail_info` 与歌手曲目共用一条路由，顺带返回 singer_info、singer_brief 与两个总数，
    // 所以详情不另开端点，只取一首歌把响应压到最小。简介与总数是 singer_info 的兄弟字段，需要摊平后再正规化。
    const response = await requestQq<any>('artist_songs', { singermid, limit: 1, page: 1 });
    const data = response?.response?.singer?.data;
    // 头像上游不给，由 mid 按 photo_new 规则补齐。
    return normalizeQqCollection(
        {
            singermid,
            ...(data && typeof data === 'object' ? data.singer_info : undefined),
            singer_brief: data?.singer_brief,
            total_song: data?.total_song,
            total_album: data?.total_album,
        },
        'artist',
    );
};

const getArtistSongs = async (
    id: MediaId,
    limit: number,
    offset: number,
): Promise<ProviderPage<ReturnType<typeof normalizeQqSong>>> => {
    const pageSize = Math.max(1, limit);
    // `/getSingerHotsong` 的 page 是从 1 起算的页码，上游会换算成 sin = (page - 1) * num。
    const response = await requestQq<any>('artist_songs', {
        singermid: String(id ?? '').trim(),
        limit: pageSize,
        page: Math.floor(Math.max(0, offset) / pageSize) + 1,
    });
    const data = response?.response?.singer?.data;
    const songs = Array.isArray(data?.songlist) ? data.songlist : [];
    const items = songs.map(normalizeQqSong);
    const total = Number(data?.total_song);
    const nextOffset = offset + items.length;
    const hasTotal = Number.isFinite(total) && total >= 0;
    return {
        items,
        ...(hasTotal ? { total } : {}),
        hasMore: hasTotal ? nextOffset < total : items.length >= pageSize,
        nextOffset,
    };
};

const getArtistAlbums = async (
    id: MediaId,
    limit: number,
    offset: number,
): Promise<ProviderPage<ProviderCollection>> => {
    const pageSize = Math.max(1, limit);
    // 同名参数在两个端点语意相反：`/getSingerAlbum` 把 page 直接当 begin 偏移量用，所以原样传 offset。
    const response = await requestQq<any>('artist_albums', {
        singermid: String(id ?? '').trim(),
        limit: pageSize,
        page: Math.max(0, offset),
    });
    const data = response?.response?.singer?.data;
    const albums = Array.isArray(data?.albumList) ? data.albumList : [];
    const items = albums
        .map((item: unknown) => normalizeQqCollection(item, 'album'))
        .filter((collection: ProviderCollection) => collection.id !== '');
    const total = Number(data?.total);
    const nextOffset = offset + albums.length;
    const hasTotal = Number.isFinite(total) && total >= 0;
    return {
        items,
        ...(hasTotal ? { total } : {}),
        hasMore: hasTotal ? nextOffset < total : albums.length >= pageSize,
        nextOffset,
    };
};

const searchSongs = async (query: string, limit: number, offset: number) => {
    const body = await requestQq<any>('search', {
        key: query,
        limit,
        page: Math.floor(offset / Math.max(1, limit)) + 1,
    });
    if (Number(body?.code) !== 0 || Number(body?.request?.code) !== 0)
        throw new OnlineProviderError('invalid-response', 'QQ音乐搜索暂时不可用', 'qq');
    const list = body?.request?.data?.body?.song?.list;
    const items = (Array.isArray(list) ? list : []).map(normalizeQqSong);
    const total = Number(body?.request?.data?.meta?.sum);
    return {
        items,
        ...(Number.isFinite(total) ? { total } : {}),
        hasMore: Number.isFinite(total) ? offset + items.length < total : items.length >= limit,
        nextOffset: offset + items.length,
    };
};
const getLyrics = async (song: SongResult): Promise<ProviderLyricsResult> => {
    const songmid = getQqSongMid(song);
    if (!songmid) return { lyrics: null, isPureMusic: false };
    const response = await requestQq<any>('lyrics', { songmid, isFormat: false });
    const text = response?.response?.lyric;
    return {
        lyrics: typeof text === 'string' && text.trim() ? await parseLyricsByFormat('lrc', text) : null,
        isPureMusic: false,
    };
};
const getLoginStatus = async (): Promise<ProviderUser | null> => {
    if (!hasQqSession()) return null;
    try {
        const response = await requestQq<any>('login_status');
        return response?.data?.profile ? normalizeQqUser(response.data.profile) : null;
    } catch (error) {
        if (error instanceof OnlineProviderError && error.code === 'auth-required') return null;
        throw error;
    }
};
const logout = async () => {
    try {
        if (hasQqSession()) await requestQq('logout');
    } finally {
        clearQqSession();
    }
};

export const qqProvider: OnlineMusicProvider = {
    id: 'qq',
    displayName: 'QQ音乐',
    shortName: 'QQ音乐',
    getAvailability: getQqTransportAvailability,
    capabilities: {
        search: true,
        playback: true,
        lyrics: true,
        auth: true,
        userLibrary: true,
        playlists: true,
        albums: true,
        artists: true,
        recommendations: false,
        mutations: false,
        wordByWordLyrics: false,
        likes: true,
        userAlbums: true,
    },
    normalizeSong: normalizeQqSong,
    normalizeUser: normalizeQqUser,
    normalizeCollection: normalizeQqCollection,
    songMetadata: { getSongMetadata: createProviderSongMetadata },
    getSongPageUrl: (song) => `https://y.qq.com/n/ryqq/songDetail/${encodeURIComponent(getQqSongMid(song))}`,
    search: { searchSongs },
    playback: { getSongDetail, getAudioSource },
    lyrics: { getLyrics },
    auth: {
        getLoginStatus,
        logout,
        async cancelQr(key) {
            await requestQq('login_qr_cancel', { key });
        },
        async getQrKey() {
            const r = await requestQq<any>('login_qr_key', { channel: 'qq' });
            const key = String(r?.data?.unikey || '');
            if (!key) throw new OnlineProviderError('invalid-response', 'QQ音乐暂时未能生成登录二维码', 'qq');
            return key;
        },
        async createQr(key) {
            const r = await requestQq<any>('login_qr_create', { key });
            const image = String(r?.data?.qrimg || '');
            if (!image) throw new OnlineProviderError('invalid-response', 'QQ音乐二维码生成失败', 'qq');
            return image;
        },
        async checkQr(key) {
            const r = await requestQq<any>('login_qr_check', { key });
            const code = Number(r?.code);
            if (code === 801) return { state: 'waiting' };
            if (code === 802) return { state: 'scanned' };
            if (code === 803) return { state: 'confirmed' };
            if (code === 800 && !r.failureReason) return { state: 'expired' };
            return { state: 'error', message: 'QQ音乐登录未完成，请刷新二维码重试' };
        },
    },
    library: { getUserPlaylists, getLikedSongIds, getUserAlbums },
    catalog: {
        canResolveSongCatalogRefs: (song) => Boolean(getQqSongMid(song)),
        resolveSongCatalogRefs: resolveQqSongCatalogRefs,
        getPlaylistTracks,
        getAlbumDetail,
        getAlbumTracks,
        getArtistDetail,
        getArtistSongs,
        getArtistAlbums,
    },
};
