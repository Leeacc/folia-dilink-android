import { installGlobalVisualizerFrameRateLimiter } from '../utils/frameRateLimiter';
import { useCarSettings } from '../stores/useCarSettings';
import { useEffect } from 'react';
import { isCapacitorAndroid } from '../platform/runtime';

// 当前文件：标记 Android 环境；系统栏和安全区域统一由 MainActivity 管理。
export const useCapacitorSystemBars = (_isDaylight: boolean): void => {
  useEffect(() => {
    if (!isCapacitorAndroid()) return;
    document.documentElement.dataset.runtime = 'capacitor-android';
    const stop = useCarSettings.subscribe((state, previous) => {
      if (state.balancedGraphics !== previous.balancedGraphics) installGlobalVisualizerFrameRateLimiter();
    });
    return () => { stop(); delete document.documentElement.dataset.runtime; };
  }, []);
};
