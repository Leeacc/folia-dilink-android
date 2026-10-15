import { isCapacitorAndroid } from '../platform/runtime';
import { useCarSettings } from '../stores/useCarSettings';

// Budget device rendering, without changing lyric timestamps or motion values.
export const useCarGraphicsBudget = () => {
    const balanced = useCarSettings((state) => state.balancedGraphics);
    return isCapacitorAndroid() && balanced;
};
export const carGraphicsBalanced = () => isCapacitorAndroid() && useCarSettings.getState().balancedGraphics;
export const carCanvasPixelRatio = (ratio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1) =>
    carGraphicsBalanced() ? Math.min(1, ratio) : ratio;
export const carFrameInterval = () => (carGraphicsBalanced() ? 1000 / 30 : 0);
