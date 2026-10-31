// Append the uniform-radius paths used by visualizers on WebViews without native roundRect.
type RoundRectPath = Pick<CanvasRenderingContext2D, 'moveTo' | 'lineTo' | 'arcTo' | 'closePath'> & {
    roundRect?: (x: number, y: number, width: number, height: number, radius: number) => unknown;
};
export function appendRoundRect(path: RoundRectPath, x: number, y: number, width: number, height: number, radius: number) {
    if (typeof path.roundRect === 'function') {
        path.roundRect(x, y, width, height, radius);
        return;
    }
    if (![x, y, width, height, radius].every(Number.isFinite)) return;
    if (width < 0) { x += width; width = -width; }
    if (height < 0) { y += height; height = -height; }
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    path.moveTo(x + r, y);
    path.lineTo(x + width - r, y);
    path.arcTo(x + width, y, x + width, y + r, r);
    path.lineTo(x + width, y + height - r);
    path.arcTo(x + width, y + height, x + width - r, y + height, r);
    path.lineTo(x + r, y + height);
    path.arcTo(x, y + height, x, y + height - r, r);
    path.lineTo(x, y + r);
    path.arcTo(x, y, x + r, y, r);
    path.closePath();
}
