import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { audioBands, audioPower } from '../../stores/motionSignals';

// Native FFT is optional. Missing permission/provider support yields zero signal, never fabricated audio energy.
export const carSpectrum = registerPlugin<{
    permission(): Promise<{ granted: boolean }>;
    configure(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
    addListener(event: 'spectrum', callback: (data: { bins: number[]; sampleRate: number }) => void): Promise<PluginListenerHandle>;
}>('CarSpectrum');
export function publishNativeSpectrum(data?: { bins: number[]; sampleRate: number }) {
    const bins = new Uint8Array(data?.bins || []);
    audioBands.spectrum.set(bins);
    const energy = (from: number, to: number) => {
        if (!data || bins.length === 0) return 0;
        const step = data.sampleRate / (bins.length * 2);
        const start = Math.max(0, Math.floor(from / step)), end = Math.min(bins.length - 1, Math.ceil(to / step));
        let sum = 0;
        for (let i = start; i <= end; i++) sum += bins[i];
        return sum / Math.max(1, end - start + 1);
    };
    audioBands.bass.set(energy(20, 250));
    audioBands.lowMid.set(energy(250, 500));
    audioBands.mid.set(energy(500, 2000));
    audioBands.vocal.set(energy(2000, 4000));
    audioBands.treble.set(energy(4000, 16000));
    audioPower.set(energy(20, 500));
}
