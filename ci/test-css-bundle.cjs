const {test} = require('node:test');
const assert = require('node:assert/strict');

// A virtual cascade pass must preserve asset boundaries, including standalone pages that are never loaded together.
test('cascade compilation preserves lazy and standalone stylesheet isolation', async () => {
    const {androidCssBundle} = await import('../build/androidCssBundle.mjs');
    const sheet = (name, source) => ({type:'asset', fileName:name, source});
    const bundle = {
        main:sheet('main.css','@layer base,utilities;@layer base{button{padding:0}}@layer utilities{.p4{padding:4px}}'),
        wall:sheet('wall.css','.car-menu{padding:16px}.car-volume{height:60px}@media(max-height:480px){.car-menu{overflow:auto}}'),
        export:sheet('export.css','button{background:blue}@font-face{font-family:export-only;src:url(export.woff2)}'),
        js:{type:'chunk',fileName:'main.js',code:'original()'},
    };
    await androidCssBundle().generateBundle({}, bundle);
    assert.match(bundle.wall.source,/car-menu/);
    assert.match(bundle.wall.source,/car-volume/);
    assert.match(bundle.wall.source,/@media/);
    assert.doesNotMatch(bundle.main.source,/car-menu|background:blue|export-only/);
    assert.doesNotMatch(bundle.wall.source,/background:blue|export-only|@layer/);
    assert.match(bundle.export.source,/background:blue/);
    assert.match(bundle.export.source,/@font-face/);
    for (const key of ['main','wall','export']) assert.doesNotMatch(bundle[key].source,/__folia_css_asset_boundary__|@layer/);
    assert.equal(bundle.js.code,'original()');
});
