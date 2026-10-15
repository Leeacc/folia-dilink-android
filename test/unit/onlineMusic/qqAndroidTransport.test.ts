import { beforeEach, describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ android: true, request: vi.fn() }));
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('@/services/embeddedMusic', () => ({
    hasEmbeddedMusic: () => native.android,
    requestEmbeddedMusic: native.request,
}));
vi.mock('@/services/onlineMusic/providerStorage', () => ({
    readProviderSessionValue: (_: string, key: string) => storage.get(key),
    writeProviderSessionValue: (_: string, key: string, value: string) => storage.set(key, value),
    removeProviderSessionValue: (_: string, key: string) => storage.delete(key),
}));
import { requestQq, getQqTransportAvailability } from '@/services/onlineMusic/qqTransport';

// Verify opaque-session persistence and error handling at the native bridge boundary.
describe('QQ Android transport', () => {
    beforeEach(() => {
        storage.clear();
        native.android = true;
        native.request.mockReset();
    });
    it('makes the platform available only when the native music bridge exists', () => {
        expect(getQqTransportAvailability().configured).toBe(true);
        native.android = false;
        expect(getQqTransportAvailability().configured).toBe(false);
    });
    it('persists only a confirmed opaque session and returns it on account requests', async () => {
        native.request.mockResolvedValue({
            status: 200,
            body: { code: 803, cookie: 'qqmusic_session=session-fixture' },
        });
        await requestQq('login_qr_check', { key: 'qr-fixture' });
        native.request.mockResolvedValue({ status: 200, body: { code: 200 } });
        await requestQq('login_status');
        const [provider, endpoint] = native.request.mock.calls[1];
        expect(provider).toBe('qq');
        expect(new URL(endpoint, 'https://localhost').searchParams.get('cookie')).toBe(
            'qqmusic_session=session-fixture',
        );
    });
    it('rejects a confirmed QR response with no restorable session', async () => {
        native.request.mockResolvedValue({ status: 200, body: { code: 803 } });
        await expect(requestQq('login_qr_check', { key: 'qr-fixture' })).rejects.toMatchObject({
            code: 'invalid-response',
        });
    });
    it('uses the QQ backend path parameters for playback and public playlists', async () => {
        native.request.mockResolvedValue({ status: 200, body: {} });
        await requestQq('music_play', { songmid: 'mid-fixture', quality: '128' });
        expect(new URL(native.request.mock.calls[0][1], 'https://localhost').pathname).toBe(
            '/getMusicPlay/mid-fixture',
        );
        await requestQq('song_list_detail', { disstid: '123' });
        expect(new URL(native.request.mock.calls[1][1], 'https://localhost').pathname).toBe('/getSongListDetail/123');
    });
    it('clears an invalid session and preserves the authentication error classification', async () => {
        storage.set('cookie', 'qqmusic_session=expired-fixture');
        native.request.mockResolvedValue({ status: 401, body: { code: 401 } });
        await expect(requestQq('user_playlist')).rejects.toMatchObject({ code: 'auth-required' });
        expect(storage.has('cookie')).toBe(false);
    });
});
