import { describe, expect, it, vi } from 'vitest';
const runtime = vi.hoisted(() => ({android:false}));
vi.mock('@/platform/runtime', () => ({isCapacitorAndroid:()=>runtime.android}));
import { toSafeRemoteUrl } from '@/utils/appPlaybackHelpers';

// test/unit/onlineMusic/audioUrlNormalization.test.ts

describe('online audio URL normalization', () => {
    it('preserves HTTP-only signed music CDN links on Android', () => {
        runtime.android = true;
        expect(toSafeRemoteUrl('http://fs.youthandroid2.kugou.com/song.mp3?key=sample')).toBe('http://fs.youthandroid2.kugou.com/song.mp3?key=sample');
        runtime.android = false;
    });
    it('upgrades KuGou fs CDN URLs to HTTPS', () => {
        expect(toSafeRemoteUrl('http://fs.youthandroid2.kugou.com/path/song.mp3'))
            .toBe('https://fs.youthandroid2.kugou.com/path/song.mp3');
    });

    it('repairs a cached comma-joined KuGou URL by keeping one candidate', () => {
        expect(toSafeRemoteUrl(
            'http://fs.youthandroid2.kugou.com/primary.mp3,http://fs.youthandroid2.kugou.com/backup.mp3',
        )).toBe('https://fs.youthandroid2.kugou.com/primary.mp3');
    });

    it('keeps valid HTTPS URLs unchanged', () => {
        expect(toSafeRemoteUrl('https://audio.example.test/song.mp3'))
            .toBe('https://audio.example.test/song.mp3');
    });

    it('continues upgrading NetEase media URLs to HTTPS', () => {
        expect(toSafeRemoteUrl('http://m10.music.126.net/song.mp3'))
            .toBe('https://m10.music.126.net/song.mp3');
    });
});
