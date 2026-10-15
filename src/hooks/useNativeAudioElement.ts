import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { attachNativeAudio, nativeAudioEnabled } from '../services/android/nativeAudio';

// Install before passive playback effects can start audio, preserving the app's existing lyrics clock.
export function useNativeAudioElement(ref: RefObject<HTMLAudioElement | null>, source: string | null, loop: boolean) {
    const bridge = useRef<ReturnType<typeof attachNativeAudio> | null>(null);
    useLayoutEffect(() => {
        if (!nativeAudioEnabled() || !ref.current) return;
        bridge.current = attachNativeAudio(ref.current);
        return () => { bridge.current?.dispose(); bridge.current = null; };
    }, [ref]);
    useLayoutEffect(() => { bridge.current?.load(source); }, [source]);
    useLayoutEffect(() => { bridge.current?.loop(); }, [loop]);
}
