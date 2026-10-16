import {describe, expect, it} from 'vitest';
import {publishNativeSpectrum} from '@/services/android/spectrum';
import {audioBands, audioPower} from '@/stores/motionSignals';

// Playback FFT must retain byte-scale energy and never invent a signal when capture is absent.
describe('Android playback spectrum mapping', () => {
    it('clears all signals when permission/capture is absent', () => {
        publishNativeSpectrum({bins:Array(256).fill(120), sampleRate:44100});
        publishNativeSpectrum();
        expect(audioPower.get()).toBe(0);
        expect(audioBands.spectrum.get()).toHaveLength(0);
        expect(audioBands.vocal.get()).toBe(0);
    });
    it('maps a 1 kHz tone to mid energy rather than high-frequency energy', () => {
        const bins=Array(256).fill(0);bins[12]=200;
        publishNativeSpectrum({bins,sampleRate:44100});
        expect(audioBands.mid.get()).toBeGreaterThan(0);
        expect(audioBands.treble.get()).toBe(0);
        expect(audioBands.spectrum.get()[12]).toBe(200);
    });
    it('uses the native sample rate and keeps short buffers finite', () => {
        publishNativeSpectrum({bins:[0,64,128,255],sampleRate:48000});
        expect(Number.isFinite(audioBands.vocal.get())).toBe(true);
        expect(audioPower.get()).toBeGreaterThanOrEqual(0);
    });
});
