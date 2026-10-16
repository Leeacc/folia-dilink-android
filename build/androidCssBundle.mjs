import postcss from 'postcss';
import cascadeLayers from '@csstools/postcss-cascade-layers';

// Layer emulation needs every stylesheet together: per-module conversion lets Tailwind resets defeat lazy component styles.
/** @returns {import('vite').Plugin} */
export function androidCssBundle() {
    return {
        name: 'folia-android-css-bundle',
        apply: 'build',
        enforce: 'post',
        async generateBundle(_options, bundle) {
            const styles = Object.values(bundle).filter(asset => asset.type === 'asset' && asset.fileName.endsWith('.css'));
            if (styles.length !== 1) throw new Error('Android cascade compatibility requires one complete CSS bundle');
            const asset = styles[0];
            const source = typeof asset.source === 'string' ? asset.source : Buffer.from(asset.source).toString('utf8');
            const result = await postcss([cascadeLayers()]).process(source, {from: asset.fileName, map: false});
            if (result.root.some(node => node.type === 'atrule' && node.name === 'layer')) throw new Error('Uncompiled Android CSS layer');
            asset.source = result.css;
        },
    };
}
