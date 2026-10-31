import {describe, expect, it, vi} from 'vitest';
import {appendRoundRect} from '@/utils/canvasRoundRect';

// Exercise the legacy Canvas/Path2D boundary rather than relying on the modern test browser API.
const path = () => ({moveTo:vi.fn(),lineTo:vi.fn(),arcTo:vi.fn(),closePath:vi.fn()});
describe('visualizer rounded paths on WebView95', () => {
    it('clamps corners to the shorter edge and appends a closed path', () => {
        const p=path();appendRoundRect(p,10,20,100,30,100);
        expect(p.moveTo).toHaveBeenCalledWith(25,20);
        expect(p.arcTo).toHaveBeenNthCalledWith(1,110,20,110,35,15);
        expect(p.closePath).toHaveBeenCalledOnce();
    });
    it('supports negative extents without negative radii', () => {
        const p=path();appendRoundRect(p,20,30,-10,-20,4);
        expect(p.moveTo).toHaveBeenCalledWith(14,10);
        expect(p.arcTo).toHaveBeenNthCalledWith(1,20,10,20,14,4);
    });
    it('keeps native paths intact on modern browsers and ignores nonfinite fallback inputs', () => {
        const p={...path(),roundRect:vi.fn()};appendRoundRect(p,0,0,10,20,3);
        expect(p.roundRect).toHaveBeenCalledWith(0,0,10,20,3);
        expect(p.moveTo).not.toHaveBeenCalled();
        const legacy=path();appendRoundRect(legacy,NaN,0,10,20,3);
        expect(legacy.moveTo).not.toHaveBeenCalled();
    });
});
