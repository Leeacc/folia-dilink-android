import { useEffect, useRef } from 'react';
import { isCapacitorAndroid } from '../platform/runtime';
import { useCarSettings } from '../stores/useCarSettings';
import { carMedia } from '../services/android/carMedia';
import { carGestureTargetIsInteractive, classifyCarGesture } from '../utils/carGestures';

// Idle controls and multi-touch gestures stay outside the per-frame lyrics render path.
export function useCarPlayerInteractions({
    active,
    playing,
    blocked,
    onNext,
    onPrevious,
}: {
    active: boolean;
    playing: boolean;
    blocked: boolean;
    onNext: () => unknown;
    onPrevious: () => unknown;
}) {
    const settings = useCarSettings();
    const actions = useRef({ onNext, onPrevious });
    actions.current = { onNext, onPrevious };
    useEffect(() => {
        if (!isCapacitorAndroid() || !active) return;
        const root = document.documentElement;
        root.dataset.carPlayer = 'true';
        let timer = 0,
            hidden = false,
            ignoreClickUntil = 0,
            volume = 0.5,
            lastVolumeAt = 0;
        let gesture: {
            x: number;
            y: number;
            dx: number;
            dy: number;
            fingers: number;
            volume: number;
            moved: boolean;
        } | null = null;
        const reset = () => {
            hidden = false;
            delete root.dataset.carIdle;
            clearTimeout(timer);
            if (playing && !blocked && settings.immersive)
                timer = window.setTimeout(() => {
                    if (!gesture) {
                        hidden = true;
                        root.dataset.carIdle = 'true';
                    }
                }, 5000);
        };
        const center = (touches: TouchList) => ({
            x: Array.from(touches).reduce((sum, t) => sum + t.clientX, 0) / touches.length,
            y: Array.from(touches).reduce((sum, t) => sum + t.clientY, 0) / touches.length,
        });
        const start = (event: TouchEvent) => {
            if (blocked || carGestureTargetIsInteractive(event.target)) return;
            if (hidden) ignoreClickUntil = Date.now() + 450;
            reset();
            clearTimeout(timer);
            const point = center(event.touches);
            if (!gesture) {
                gesture = { ...point, dx: 0, dy: 0, fingers: event.touches.length, volume, moved: false };
                void carMedia
                    .getVolume()
                    .then((value) => {
                        volume = value.value;
                        if (gesture) gesture.volume = volume;
                    })
                    .catch(() => {});
            } else if (event.touches.length > gesture.fingers) {
                gesture = {
                    ...point,
                    dx: 0,
                    dy: 0,
                    fingers: event.touches.length,
                    volume: gesture.volume,
                    moved: gesture.moved,
                };
            }
        };
        const move = (event: TouchEvent) => {
            if (!gesture || !event.touches.length || event.touches.length !== gesture.fingers) return;
            const point = center(event.touches);
            gesture.dx = point.x - gesture.x;
            gesture.dy = point.y - gesture.y;
            const action = classifyCarGesture(gesture.dx, gesture.dy, gesture.fingers, settings);
            if (!action) return;
            gesture.moved = true;
            ignoreClickUntil = Date.now() + 450;
            event.preventDefault();
            if (action === 'volume' && Date.now() - lastVolumeAt > 90) {
                lastVolumeAt = Date.now();
                volume = Math.min(1, Math.max(0, gesture.volume - gesture.dy / Math.max(innerHeight, 300)));
                void carMedia.setVolume({ value: volume }).catch(() => {});
            }
        };
        const end = (event: TouchEvent) => {
            if (!gesture || event.touches.length) return;
            const current = gesture;
            gesture = null;
            const action = classifyCarGesture(current.dx, current.dy, current.fingers, settings);
            if (action) {
                ignoreClickUntil = Date.now() + 450;
                event.preventDefault();
                if (action === 'next') actions.current.onNext();
                if (action === 'previous') actions.current.onPrevious();
                if (action === 'volume')
                    void carMedia
                        .setVolume({
                            value: Math.min(1, Math.max(0, current.volume - current.dy / Math.max(innerHeight, 300))),
                        })
                        .catch(() => {});
            }
            reset();
        };
        const cancel = () => {
            gesture = null;
            reset();
        };
        const click = (event: MouseEvent) => {
            if (Date.now() < ignoreClickUntil || hidden) {
                event.stopPropagation();
                event.preventDefault();
            }
            reset();
        };
        const wake = () => {
            if (hidden) ignoreClickUntil = Date.now() + 450;
            reset();
        };
        reset();
        window.addEventListener('touchstart', start, { capture: true, passive: true });
        window.addEventListener('touchmove', move, { capture: true, passive: false });
        window.addEventListener('touchend', end, { capture: true, passive: false });
        window.addEventListener('touchcancel', cancel, { capture: true, passive: true });
        window.addEventListener('click', click, true);
        window.addEventListener('pointerdown', wake, true);
        window.addEventListener('keydown', wake);
        return () => {
            clearTimeout(timer);
            delete root.dataset.carPlayer;
            delete root.dataset.carIdle;
            window.removeEventListener('touchstart', start, true);
            window.removeEventListener('touchmove', move, true);
            window.removeEventListener('touchend', end, true);
            window.removeEventListener('touchcancel', cancel, true);
            window.removeEventListener('click', click, true);
            window.removeEventListener('pointerdown', wake, true);
            window.removeEventListener('keydown', wake);
        };
    }, [active, playing, blocked, settings.immersive, settings.horizontalFingers, settings.verticalFingers]);
}
