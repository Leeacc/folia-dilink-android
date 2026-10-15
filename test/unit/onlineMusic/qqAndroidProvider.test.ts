import { beforeEach, describe, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({ present: true }));
vi.mock('@/services/onlineMusic/qqTransport', () => ({
    requestQq: request,
    hasQqSession: () => session.present,
    clearQqSession: vi.fn(),
    getQqTransportAvailability: () => ({ configured: true }),
}));
import { qqProvider } from '@/services/onlineMusic/qqProvider';
import { normalizeQqSong, normalizeQqCollection } from '@/services/onlineMusic/qqNormalize';

// Response contracts ported from the desktop adapter's verified QQ fixtures.
const raw = {
    id: 5105918,
    mid: '003rJSwm3TechU',
    title: '海阔天空',
    singer: [{ id: 4558, mid: '0025NhlN2yWrP4', name: 'Beyond' }],
    album: { id: 8112, mid: '0016l2F430zMux', name: '乐与怒' },
    file: { media_mid: 'media-mid-fixture' },
    interval: 326,
};
const song = normalizeQqSong(raw);
describe('QQ Android provider', () => {
    beforeEach(() => {
        request.mockReset();
        session.present = true;
    });
    it('retains songmid/media_mid and catalog references across cached normalization', () => {
        expect(song.sourceRef).toMatchObject({
            providerId: 'qq',
            mediaId: raw.mid,
            providerData: { mediaMid: 'media-mid-fixture' },
        });
        expect(normalizeQqSong(song)).toMatchObject({ id: 5105918, qqMid: raw.mid, durationMs: 326000 });
        expect(song.album.catalogRef).toMatchObject({ providerId: 'qq', id: raw.album.mid });
    });
    it('normalizes desktop search results through Omni identity', async () => {
        request.mockResolvedValue({ code: 0, request: { code: 0, data: { body: { song: { list: [raw] } } } } });
        const page = await qqProvider.search!.searchSongs('海阔天空', 20, 0);
        expect(page.items[0].sourceRef).toMatchObject({ providerId: 'qq', mediaId: raw.mid });
        expect(page.hasMore).toBe(false);
    });
    it('falls back from high to authorized standard quality without dropping media_mid', async () => {
        request
            .mockResolvedValueOnce({ data: { playUrl: { [raw.mid]: { url: '', error: 'no playable link' } } } })
            .mockResolvedValueOnce({ data: { playUrl: { [raw.mid]: { url: 'https://stream.qq.com/sample.mp3' } } } });
        await expect(qqProvider.playback!.getAudioSource(song, 'high')).resolves.toMatchObject({
            url: 'https://stream.qq.com/sample.mp3',
            quality: 'standard',
        });
        expect(request).toHaveBeenLastCalledWith('music_play', {
            songmid: raw.mid,
            mediaId: 'media-mid-fixture',
            quality: '128',
        });
    });
    it('loads private owned playlists with the authenticated route', async () => {
        const collection = normalizeQqCollection({ tid: 7, dirId: 202, dirName: '自建歌单', owned: true });
        request.mockResolvedValue({ songs: [raw], total: 1, more: false });
        const page = await qqProvider.catalog!.getPlaylistTracks!(7, 20, 0, collection);
        expect(request).toHaveBeenCalledWith('user_playlist_detail', { tid: '7', dirid: 202, offset: 0, limit: 20 });
        expect(page.items[0].qqMid).toBe(raw.mid);
    });
    it('accepts a valid authenticated profile even if upstream omits its display id', async () => {
        request.mockResolvedValue({ code: 200, data: { profile: { info: { nick: 'QQ listener' } } } });
        expect(await qqProvider.auth!.getLoginStatus()).toMatchObject({ nickname: 'QQ listener' });
    });
    it('maps QR waiting/scanned/confirmed and structured failures', async () => {
        for (const [code, state] of [
            [801, 'waiting'],
            [802, 'scanned'],
            [803, 'confirmed'],
        ]) {
            request.mockResolvedValue({ code });
            expect(await qqProvider.auth!.checkQr!('key-fixture')).toMatchObject({ state });
        }
        request.mockResolvedValue({ code: 800, failureReason: 'upstream-rejected' });
        expect(await qqProvider.auth!.checkQr!('key-fixture')).toMatchObject({ state: 'error' });
    });
});
