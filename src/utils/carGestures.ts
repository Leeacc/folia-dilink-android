import type { CarPreferences } from '../stores/useCarSettings';

// A gesture is committed only after sufficient directional motion with the configured finger count.
export function classifyCarGesture(
    dx: number,
    dy: number,
    fingers: number,
    settings: Pick<CarPreferences, 'horizontalFingers' | 'verticalFingers'>,
) {
    if (fingers === settings.horizontalFingers && Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 1.25)
        return dx < 0 ? 'next' : 'previous';
    if (fingers === settings.verticalFingers && Math.abs(dy) >= 40 && Math.abs(dy) > Math.abs(dx) * 1.25)
        return 'volume';
    return null;
}
export const carGestureTargetIsInteractive = (target: EventTarget | null) =>
    target instanceof Element &&
    Boolean(
        target.closest(
            'button,input,textarea,select,a,[role="dialog"],[role="slider"],[contenteditable="true"],[data-car-no-gesture]',
        ),
    );
