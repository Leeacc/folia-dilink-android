import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { isCapacitorAndroid } from '../../platform/runtime';

// Keep Folia's existing media-element contract while the Android application owns the audible track.
export type NativeAudioState = {
    sourceId: string; position: number; duration: number; playing: boolean;
    prepared: boolean; ended: boolean; gain: number; focusHeld: boolean;
    event?: string; errorCode?: number;
};
export const nativeAudioEnabled = () => isCapacitorAndroid() && Capacitor.isPluginAvailable('NativeAudio');
let sourceSequence = 0;
export const nativeAudio = registerPlugin<{
    prepare(input: { source: string; sourceId: string }): Promise<NativeAudioState>;
    play(): Promise<NativeAudioState>;
    pause(): Promise<NativeAudioState>;
    seek(input: { position: number }): Promise<NativeAudioState>;
    setGain(input: { value: number }): Promise<void>;
    setLoop(input: { loop: boolean }): Promise<void>;
    status(): Promise<NativeAudioState>;
    cacheBegin(): Promise<{ token: string }>;
    cacheAppend(input: { token: string; data: string }): Promise<{ source: string }>;
    addListener(event: 'state', callback: (state: NativeAudioState) => void): Promise<PluginListenerHandle>;
}>('NativeAudio');

export function attachNativeAudio(element: HTMLAudioElement) {
    let disposed = false, generation = 0, source = '', sourceId = '', volume = 0.2, muted = false;
    let position = 0, duration = NaN, paused = true, ended = false, prepared = false, stamp = performance.now();
    let pendingSeek: number | null = null;
    let errorSent = false;
    let loading: Promise<unknown> = Promise.resolve();
    const saved = new Map<string, PropertyDescriptor | undefined>();
    const emit = (event: string) => element.dispatchEvent(new Event(event));
    const fail = () => { if (!errorSent) { errorSent = true; emit('error'); } };
    const apply = (state: NativeAudioState) => {
        if (disposed || state.sourceId !== sourceId) return;
        const wasPaused = paused, wasPrepared = prepared;
        position = state.position; duration = state.duration; paused = !state.playing;
        ended = state.ended; prepared = state.prepared; stamp = performance.now();
        if (!wasPrepared && prepared) {
            emit('loadedmetadata'); emit('canplay');
            if (pendingSeek !== null) { const value = pendingSeek; pendingSeek = null; element.currentTime = value; }
        }
        if (wasPaused && !paused) { emit('play'); emit('playing'); }
        if (!wasPaused && paused && !ended) emit('pause');
        if (state.event === 'seeked') emit('seeked');
        if (state.event === 'ended') emit('ended');
        if (state.event === 'error') fail();
        emit('timeupdate');
    };
    const listener = nativeAudio.addListener('state', apply);
    const currentPosition = () => paused ? position : Math.min(duration || Infinity, position + (performance.now() - stamp) / 1000);
    const define = (key: string, descriptor: PropertyDescriptor) => {
        saved.set(key, Object.getOwnPropertyDescriptor(element, key));
        Object.defineProperty(element, key, { configurable: true, ...descriptor });
    };
    const sendGain = () => void nativeAudio.setGain({ value: muted ? 0 : volume }).catch(() => {});
    const load = (next: string | null) => {
        if (disposed || (next || '') === source) return;
        const mine = ++generation;
        errorSent = false;
        source = next || ''; sourceId = `${Date.now()}-${++sourceSequence}`;
        position = 0; duration = NaN; prepared = false; paused = true; ended = false; stamp = performance.now();
        void nativeAudio.pause().catch(() => {});
        if (!source) { loading = Promise.resolve(); return; }
        const original = source;
        loading = (async () => {
            await listener;
            let nativeSource = original;
            if (original.startsWith('blob:')) {
                const blob = await (await fetch(original)).blob();
                if (blob.size > 100 * 1024 * 1024) throw new Error('Native audio cache exceeds size limit');
                const { token } = await nativeAudio.cacheBegin();
                for (let offset = 0; offset < blob.size; offset += 192 * 1024) {
                    if (mine !== generation || disposed) throw new DOMException('Audio replaced', 'AbortError');
                    const bytes = new Uint8Array(await blob.slice(offset, offset + 192 * 1024).arrayBuffer());
                    let binary = '';
                    for (let part = 0; part < bytes.length; part += 8192)
                        binary += String.fromCharCode(...bytes.subarray(part, part + 8192));
                    nativeSource = (await nativeAudio.cacheAppend({ token, data: btoa(binary) })).source;
                }
            }
            if (mine !== generation || disposed) throw new DOMException('Audio replaced', 'AbortError');
            const state = await nativeAudio.prepare({ source: nativeSource, sourceId });
            if (mine !== generation || disposed) throw new DOMException('Audio replaced', 'AbortError');
            apply(state);
            await nativeAudio.setLoop({ loop: element.loop });
        })();
        void loading.catch(error => { if (mine === generation && !disposed && error?.name !== 'AbortError') fail(); });
    };
    define('src', { get: () => source });
    define('currentSrc', { get: () => source });
    define('paused', { get: () => paused });
    define('ended', { get: () => ended });
    define('duration', { get: () => duration });
    define('readyState', { get: () => prepared ? 4 : 0 });
    define('currentTime', {
        get: currentPosition,
        set: (value: number) => {
            if (!Number.isFinite(value)) return;
            position = Math.max(0, Number.isFinite(duration) ? Math.min(value, duration) : value); stamp = performance.now();
            if (!prepared) { pendingSeek = position; return; }
            void nativeAudio.seek({ position }).then(apply).catch(() => {});
        },
    });
    define('volume', { get: () => volume, set: (value: number) => {
        if (!Number.isFinite(value)) return;
        volume = Math.min(1, Math.max(0, value)); sendGain();
    } });
    define('muted', { get: () => muted, set: (value: boolean) => { muted = value; sendGain(); } });
    define('play', { value: async () => {
        const mine = generation;
        await loading;
        if (disposed || mine !== generation) throw new DOMException('Audio replaced', 'AbortError');
        apply(await nativeAudio.play());
    } });
    define('pause', { value: () => {
        const wasPlaying = !paused; position = currentPosition(); stamp = performance.now(); paused = true;
        if (wasPlaying) emit('pause');
        void nativeAudio.pause().then(apply).catch(() => {});
    } });
    define('load', { value: () => { /* Native prepare is driven by a changed source, not Chromium's network stack. */ } });
    return {
        load,
        loop: () => void nativeAudio.setLoop({ loop: element.loop }).catch(() => {}),
        dispose: () => {
            disposed = true; generation++;
            void listener.then(handle => handle.remove());
            void nativeAudio.pause().catch(() => {});
            for (const [key, descriptor] of saved) {
                if (descriptor) Object.defineProperty(element, key, descriptor);
                else Reflect.deleteProperty(element, key);
            }
        },
    };
}
