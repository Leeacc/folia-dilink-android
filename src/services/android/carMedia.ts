import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

// Android's standard media session and actual system music volume, separate from Web Audio gain.
export type CarMediaCommand = { action: 'play' | 'pause' | 'previous' | 'next' | 'seek'; position: number };
export const carMedia = registerPlugin<{
    update(state: {
        hasTrack: boolean;
        playing: boolean;
        title?: string;
        artist?: string;
        album?: string;
        cover?: string;
        duration: number;
        position: number;
    }): Promise<void>;
    diagnostics(): Promise<{
        manufacturer: string;
        model: string;
        android: string;
        sdk: number;
        multiWindow: boolean;
        mediaSession: boolean;
        fixed: boolean;
        value: number;
    }>;
    getVolume(): Promise<{ value: number; fixed: boolean; index: number; max: number }>;
    setVolume(input: { value: number }): Promise<{ value: number; fixed: boolean }>;
    addListener(event: 'command', callback: (event: CarMediaCommand) => void): Promise<PluginListenerHandle>;
}>('CarMedia');
