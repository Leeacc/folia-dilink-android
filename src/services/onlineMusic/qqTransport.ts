import { OnlineProviderError } from '../../types/onlineMusic';
import { hasEmbeddedMusic, requestEmbeddedMusic } from '../embeddedMusic';
import { readProviderSessionValue, removeProviderSessionValue, writeProviderSessionValue } from './providerStorage';

// The renderer retains only QQ's opaque session token; credentials remain in encrypted app-private storage.
const ENDPOINTS = {
    login_qr_key: '/login/qr/key',
    login_qr_create: '/login/qr/create',
    login_qr_check: '/login/qr/check',
    login_qr_cancel: '/login/qr/cancel',
    login_status: '/login/status',
    logout: '/logout',
    user_detail: '/user/detail',
    user_playlist: '/user/playlist',
    user_albums: '/user/albums',
    user_liked_songs: '/user/liked-songs',
    user_playlist_detail: '/user/playlist-detail',
    music_play: '/getMusicPlay',
    song_list_detail: '/getSongListDetail',
    song_info: '/getSongInfo',
    album_info: '/getAlbumInfo',
    artist_albums: '/getSingerAlbum',
    artist_songs: '/getSingerHotsong',
    search: '/getSearchByKey',
    lyrics: '/getLyric',
} as const;
export type QqOperation = keyof typeof ENDPOINTS;
export type QqParams = Record<string, string | number | boolean | undefined>;
export const hasQqSession = () => Boolean(readProviderSessionValue('qq', 'cookie'));
export const clearQqSession = () => removeProviderSessionValue('qq', 'cookie');
export const getQqTransportAvailability = () =>
    hasEmbeddedMusic()
        ? ({ configured: true } as const)
        : ({ configured: false, reason: 'runtime-unavailable' } as const);

export async function requestQq<T = unknown>(operation: QqOperation, params: QqParams = {}): Promise<T> {
    if (!hasEmbeddedMusic()) throw new OnlineProviderError('unavailable', 'QQ音乐需要 Android 内置音乐服务', 'qq');
    const query = new URLSearchParams();
    let path: string = ENDPOINTS[operation];
    const appendPath = (name: string) => {
        const value = String(params[name] ?? '').trim();
        if (!value) throw new OnlineProviderError('invalid-response', `QQ音乐缺少 ${name}`, 'qq');
        path += '/' + encodeURIComponent(value);
    };
    if (operation === 'music_play' || operation === 'song_info') appendPath('songmid');
    if (operation === 'song_info' && params.songid !== undefined) appendPath('songid');
    if (operation === 'song_list_detail') appendPath('disstid');
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.set(key, String(value));
    });
    const cookie = readProviderSessionValue('qq', 'cookie');
    if (cookie) query.set('cookie', cookie);
    query.set('timestamp', String(Date.now()));
    const result = await requestEmbeddedMusic('qq', `${path}?${query}`);
    const status = Number(result?.status ?? 502);
    const body = result?.body;
    if (status === 401) {
        clearQqSession();
        throw new OnlineProviderError('auth-required', '请先扫码登录 QQ 音乐', 'qq');
    }
    if (status === 404) throw new OnlineProviderError('unsupported', 'QQ音乐暂不支持此操作', 'qq');
    if (status < 200 || status >= 300 || !body)
        throw new OnlineProviderError('network', `QQ音乐请求失败（${status}）`, 'qq');
    if (operation === 'login_qr_check' && Number(body.code) === 803) {
        if (typeof body.cookie !== 'string' || !body.cookie)
            throw new OnlineProviderError('invalid-response', 'QQ音乐没有返回登录会话，请重新扫码', 'qq');
        writeProviderSessionValue('qq', 'cookie', body.cookie);
    }
    return body as T;
}
