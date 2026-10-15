import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Device interaction/performance preferences; independent from portable visual theme presets.
export type GestureFingers = 0 | 1 | 2 | 3;
export type CarPreferences = {
    immersive: boolean;
    horizontalFingers: GestureFingers;
    verticalFingers: GestureFingers;
    balancedGraphics: boolean;
};
export const DEFAULT_CAR_PREFERENCES: CarPreferences = {
    immersive: true,
    horizontalFingers: 1,
    verticalFingers: 2,
    balancedGraphics: true,
};
export const useCarSettings = create<
    CarPreferences & { setPreference: <K extends keyof CarPreferences>(key: K, value: CarPreferences[K]) => void }
>()(
    persist(
        (set) => ({
            ...DEFAULT_CAR_PREFERENCES,
            setPreference: (key, value) => set({ [key]: value }),
        }),
        {
            name: 'folia-car-controls-v1',
            merge: (saved, current) => {
                const value = (saved || {}) as Partial<CarPreferences>;
                const fingers = (input: unknown, fallback: GestureFingers): GestureFingers =>
                    [0, 1, 2, 3].includes(input as number) ? (input as GestureFingers) : fallback;
                return {
                    ...current,
                    immersive: typeof value.immersive === 'boolean' ? value.immersive : current.immersive,
                    balancedGraphics:
                        typeof value.balancedGraphics === 'boolean' ? value.balancedGraphics : current.balancedGraphics,
                    horizontalFingers: fingers(value.horizontalFingers, current.horizontalFingers),
                    verticalFingers: fingers(value.verticalFingers, current.verticalFingers),
                };
            },
        },
    ),
);
