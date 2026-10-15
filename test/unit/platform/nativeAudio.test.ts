import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeAudioState } from '@/services/android/nativeAudio';

// Exercise the media-element boundary with native protocol responses, not a second browser audio track.
const mocks = vi.hoisted(() => ({
    listener: null as null | ((state: NativeAudioState) => void),
    state: { sourceId: '', position: 0, duration: 180, playing: false, prepared: true, ended: false, gain: 0.2, focusHeld: true } as NativeAudioState,
    remove: vi.fn(),
    gain: vi.fn(async (_input: { value: number }) => {}),
}));
vi.mock('@capacitor/core', () => ({
    Capacitor: { isPluginAvailable: () => true },
    registerPlugin: () => ({
        addListener: async (_event: string, fn: (state: NativeAudioState) => void) => { mocks.listener = fn; return { remove: mocks.remove }; },
        prepare: vi.fn(async ({ sourceId }: { sourceId: string }) => { mocks.state = { ...mocks.state, sourceId, playing: false, position: 0 }; return mocks.state; }),
        play: vi.fn(async () => { mocks.state = { ...mocks.state, playing: true }; return mocks.state; }),
        pause: vi.fn(async () => ({ ...mocks.state, playing: false })),
        seek: vi.fn(async ({ position }: { position: number }) => ({ ...mocks.state, position })),
        setGain: mocks.gain,
        setLoop: vi.fn(async () => {}),
    }),
}));
vi.mock('@/platform/runtime', () => ({ isCapacitorAndroid: () => true }));
import { attachNativeAudio, nativeAudioEnabled } from '@/services/android/nativeAudio';

const audio = () => Object.assign(new EventTarget(), { loop: false, play: vi.fn(), pause: vi.fn() }) as unknown as HTMLAudioElement;
beforeEach(() => { mocks.state = { ...mocks.state, sourceId: '', playing: false, position: 0 }; mocks.gain.mockClear(); });
describe('native car audio media-element boundary', () => {
    it('uses native preparation/playback and never calls the original browser player', async () => {
        const element = audio(), webPlay = element.play;
        const events: string[] = [];
        for (const event of ['loadedmetadata', 'play', 'playing', 'pause']) element.addEventListener(event, () => events.push(event));
        const bridge = attachNativeAudio(element);
        expect(nativeAudioEnabled()).toBe(true);
        bridge.load('https://music.example/test.mp3');
        await element.play();
        expect(webPlay).not.toHaveBeenCalled();
        expect(element.paused).toBe(false);
        expect(element.duration).toBe(180);
        expect(events).toContain('loadedmetadata');
        expect(events).toContain('playing');
        element.pause();
        expect(element.paused).toBe(true);
        bridge.dispose();
        expect(element.play).toBe(webPlay);
    });
    it('ignores stale native state after a track change', async () => {
        const element = audio(), bridge = attachNativeAudio(element);
        bridge.load('https://music.example/first.mp3'); await element.play();
        const old = { ...mocks.state, position: 140 };
        bridge.load('https://music.example/second.mp3'); await element.play();
        mocks.listener?.(old);
        expect(element.currentSrc).toContain('second.mp3');
        expect(element.currentTime).toBeLessThan(1);
        bridge.dispose();
    });
    it('routes gain and mute to the native track and clamps it', async () => {
        const element = audio(), bridge = attachNativeAudio(element);
        element.volume = 5;
        expect(mocks.gain).toHaveBeenLastCalledWith({ value: 1 });
        element.muted = true;
        expect(mocks.gain).toHaveBeenLastCalledWith({ value: 0 });
        element.volume = 0.12; element.muted = false;
        expect(mocks.gain).toHaveBeenLastCalledWith({ value: 0.12 });
        bridge.dispose();
    });
    it('preserves distinct low and high slider gains without reaching full gain at five percent', () => {
        const element = audio(), bridge = attachNativeAudio(element);
        const levels = [0, 0.01, 0.05, 0.2, 0.5, 1];
        for (const value of levels) element.volume = value;
        expect(mocks.gain.mock.calls.map(call => call[0])).toEqual(levels.map(value => ({ value })));
        element.volume = NaN;
        expect(mocks.gain).toHaveBeenCalledTimes(levels.length);
        bridge.dispose();
    });
    it('uses real native seek responses and completion events', async () => {
        const element = audio(), bridge = attachNativeAudio(element), completed = vi.fn();
        element.addEventListener('ended', completed);
        bridge.load('https://music.example/test.mp3'); await element.play();
        element.currentTime = 45; await Promise.resolve();
        expect(element.currentTime).toBeGreaterThanOrEqual(45);
        mocks.listener?.({ ...mocks.state, playing: false, ended: true, position: 180, event: 'ended' });
        expect(element.ended).toBe(true);
        expect(completed).toHaveBeenCalledOnce();
        bridge.dispose();
    });
});
