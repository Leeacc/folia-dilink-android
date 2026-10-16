// Container units are unavailable on DiLink's Chromium 95; observe only mounted posters, never React frames.
export function installCarLayoutCompat() {
    const posters = new Set<HTMLElement>();
    const sizes = new ResizeObserver(entries => {
        for (const entry of entries) {
            const node = entry.target as HTMLElement;
            node.style.setProperty('--car-cqw', `${entry.contentRect.width / 100}px`);
            node.style.setProperty('--car-cqh', `${entry.contentRect.height / 100}px`);
        }
    });
    const discover = () => {
        for (const node of posters) if (!node.isConnected) { sizes.unobserve(node); posters.delete(node); }
        document.querySelectorAll<HTMLElement>('.bravais-poster').forEach(node => {
            if (!posters.has(node)) { posters.add(node); sizes.observe(node); }
        });
    };
    const observer = new MutationObserver(discover);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    discover();
    return () => { observer.disconnect(); sizes.disconnect(); posters.clear(); };
}
