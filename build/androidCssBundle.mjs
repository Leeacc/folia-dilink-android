import postcss from 'postcss';
import cascadeLayers from '@csstools/postcss-cascade-layers';

// Resolve layer precedence in one virtual stylesheet, then keep each lazy/standalone page's CSS separate.
/** @returns {import('vite').Plugin} */
export function androidCssBundle() {
    return {
        name: 'folia-android-css-bundle',
        apply: 'build',
        enforce: 'post',
        async generateBundle(_options, bundle) {
            const styles = Object.values(bundle).filter(asset => asset.type === 'asset' && asset.fileName.endsWith('.css'));
            if (!styles.length) throw new Error('Missing Android CSS assets');
            const root = postcss.root();
            const boundary = '__folia_css_asset_boundary__:';
            for (const [index, asset] of styles.entries()) {
                const source = typeof asset.source === 'string' ? asset.source : Buffer.from(asset.source).toString('utf8');
                if (source.includes(boundary)) throw new Error('Unexpected CSS boundary in input');
                root.append(postcss.comment({text: boundary + index}));
                root.append(postcss.parse(source, {from: asset.fileName}).nodes);
            }
            const result = await postcss([cascadeLayers()]).process(root, {from: 'folia-android-complete.css', map: false});
            result.root.walkAtRules('layer', () => { throw new Error('Uncompiled Android CSS layer'); });
            const outputs = styles.map(() => postcss.root());
            let index = -1;
            // Copy the node list: appending to another root removes nodes from their old parent.
            for (const node of [...result.root.nodes]) {
                if (node.type === 'comment' && node.text.startsWith(boundary)) index = Number(node.text.slice(boundary.length));
                else {
                    if (!outputs[index]) throw new Error('CSS compatibility output lost its asset boundary');
                    outputs[index].append(node);
                }
            }
            styles.forEach((asset, index) => { asset.source = outputs[index].toString(); });
        },
    };
}
