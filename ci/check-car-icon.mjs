import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Check shipped launcher resources, including density, masks and the adaptive foreground safe zone.
const base = 'android/app/src/main/res';
for (const [density,size] of Object.entries({ldpi:36,mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192})) {
    for (const name of ['ic_launcher','ic_launcher_round']) {
        const {data,info}=await sharp(`${base}/mipmap-${density}/${name}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
        assert.equal(info.width,size);assert.equal(info.height,size);
        assert.equal(data[3],0,'Legacy mask must have transparent corners');
        assert.equal(data[((size/2|0)*size+(size/2|0))*4+3],255,'Icon center must be opaque');
    }
    const {data,info}=await sharp(`${base}/mipmap-${density}/ic_launcher_foreground.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,Math.round(size*2.25));
    for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
        if(data[(y*info.width+x)*4+3]>128) assert(Math.hypot((x+.5)*108/info.width-54,(y+.5)*108/info.height-54)<33.5,'F mark exceeds adaptive safe zone');
    }
}
for(const api of [26,33]) for(const name of ['ic_launcher','ic_launcher_round']) {
    const xml=await readFile(`${base}/mipmap-anydpi-v${api}/${name}.xml`,'utf8');
    assert(xml.includes('@drawable/ic_launcher_foreground') && xml.includes('@drawable/ic_launcher_background'));
    assert(!xml.includes('inset'),'Adaptive resources should not apply a second shrink');
    if(api===33)assert(xml.includes('@drawable/ic_launcher_monochrome'));
}
console.log('Car launcher: six densities, two legacy masks, adaptive safe zone and monochrome references passed.');
