import { useEffect } from 'react';
import { isCapacitorAndroid } from '../platform/runtime';
import { carSpectrum, publishNativeSpectrum } from '../services/android/spectrum';
import { useCarSettings } from '../stores/useCarSettings';

// FFT notifications feed motion values directly; no frame-rate React state or background capture.
export function useNativeSpectrum() {
    const enabled = useCarSettings(state => state.spectrumEnabled);
    useEffect(() => {
        if (!isCapacitorAndroid()) return;
        const listener = carSpectrum.addListener('spectrum', publishNativeSpectrum);
        const configure = () => {
            publishNativeSpectrum();
            void carSpectrum.configure({ enabled: enabled && !document.hidden }).catch(() => {});
        };
        configure();
        document.addEventListener('visibilitychange', configure);
        return () => {
            document.removeEventListener('visibilitychange', configure);
            void listener.then(value => value.remove());
            void carSpectrum.configure({ enabled: false });
            publishNativeSpectrum();
        };
    }, [enabled]);
}
