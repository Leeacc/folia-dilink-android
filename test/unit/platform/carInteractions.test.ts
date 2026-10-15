import { describe, it, expect, vi } from 'vitest';
vi.mock('@/platform/runtime', () => ({ isCapacitorAndroid: () => true }));
import { classifyCarGesture } from '@/utils/carGestures';
import { useCarSettings, DEFAULT_CAR_PREFERENCES } from '@/stores/useCarSettings';
import { carCanvasPixelRatio, carFrameInterval } from '@/utils/carPerformance';
import { fitCarLyricBlock } from '@/components/visualizer/fume/carCamera';

// Protect intentional gestures, finger assignments, and the car's rendering budget.
describe('DiLink gestures and graphics', () => {
    it('fits wide lyric blocks into a narrow split window without increasing the intended zoom', () => {
        const block = { x: 200, y: 300, width: 1800, height: 240 };
        const viewport = { width: 960, height: 900 };
        const fitted = fitCarLyricBlock(block, viewport, 1.2);
        expect(fitted.x).toBe(1100);
        expect(fitted.y).toBe(420);
        expect(block.width * fitted.scale).toBeLessThanOrEqual(viewport.width * 0.84);
        expect(block.height * fitted.scale).toBeLessThanOrEqual(viewport.height * 0.64);
        expect(fitCarLyricBlock(block, viewport, 0.3).scale).toBe(0.3);
    });
    it('only commits deliberate directional strokes', () => {
        expect(classifyCarGesture(-120, 5, 1, DEFAULT_CAR_PREFERENCES)).toBe('next');
        expect(classifyCarGesture(120, 5, 1, DEFAULT_CAR_PREFERENCES)).toBe('previous');
        expect(classifyCarGesture(1, -120, 2, DEFAULT_CAR_PREFERENCES)).toBe('volume');
        expect(classifyCarGesture(20, 10, 1, DEFAULT_CAR_PREFERENCES)).toBeNull();
        expect(classifyCarGesture(120, 120, 1, DEFAULT_CAR_PREFERENCES)).toBeNull();
        expect(classifyCarGesture(0, 100, 1, DEFAULT_CAR_PREFERENCES)).toBeNull();
    });
    it('supports three fingers and disabling a direction', () => {
        expect(classifyCarGesture(-100, 2, 3, { horizontalFingers: 3, verticalFingers: 0 })).toBe('next');
        expect(classifyCarGesture(0, 100, 3, { horizontalFingers: 3, verticalFingers: 0 })).toBeNull();
    });
    it('caps resolution and frame cadence only when the device budget is enabled', () => {
        useCarSettings.setState({ balancedGraphics: true });
        expect(carCanvasPixelRatio(2.5)).toBe(1);
        expect(carFrameInterval()).toBeCloseTo(33.33, 1);
        useCarSettings.setState({ balancedGraphics: false });
        expect(carCanvasPixelRatio(2.5)).toBe(2.5);
        expect(carFrameInterval()).toBe(0);
        useCarSettings.setState({ balancedGraphics: true });
    });
});
