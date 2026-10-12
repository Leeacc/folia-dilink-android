import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ android: true }));
vi.mock('@/platform/runtime', () => ({ isCapacitorAndroid: () => state.android }));
import { androidMediaUrl } from '@/services/androidMedia';

// Ensure native routing preserves signed query strings and never rewrites local audio.
describe('Android media routing', () => {
    it('preserves a signed CDN URL through the native handler', () => {
        const source = 'http://example.com/song.mp3?token=a+b&part=1%2F2';
        const routed = new URL(androidMediaUrl(source)!);
        expect(routed.origin).toBe('https://localhost');
        expect(routed.pathname).toBe('/folia-media');
        expect(routed.searchParams.get('url')).toBe(source);
    });
    it('keeps blob and empty sources unchanged', () => {
        expect(androidMediaUrl('blob:https://localhost/id')).toBe('blob:https://localhost/id');
        expect(androidMediaUrl(null)).toBeUndefined();
    });
    it('keeps desktop and browser media unchanged', () => {
        state.android = false;
        expect(androidMediaUrl('https://example.com/song.mp3')).toBe('https://example.com/song.mp3');
        state.android = true;
    });
});
