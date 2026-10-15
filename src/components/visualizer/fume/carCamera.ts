// Keep a complete active lyric block readable in a narrow car window instead of following each word offscreen.
export function fitCarLyricBlock(
    block: { x: number; y: number; width: number; height: number },
    viewport: { width: number; height: number },
    preferredScale: number,
) {
    return {
        x: block.x + block.width / 2,
        y: block.y + block.height / 2,
        scale: Math.min(
            preferredScale,
            viewport.width * 0.84 / Math.max(block.width, 1),
            viewport.height * 0.64 / Math.max(block.height, 1),
        ),
    };
}
