import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

// Reproducible car launcher assets; no templates, extra inset, or third-party artwork.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'android/app/src/main/res');
const vector = (paths) => `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">${paths}</vector>\n`;

export async function generateCarLauncherIcons() {
    const svg = await readFile(join(root, 'android/img/launcher.svg'));
    const paths = [...svg.toString().matchAll(/<path fill="(#[^"]+)" d="([^"]+)"\/>/g)];
    if(paths.length !== 3) throw new Error('Expected Folia stem and two leaf shapes');
    const mark = paths.map(path=>path[2]).join(' ');
    const foreground = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108">${paths.map(path=>`<path fill="${path[1]}" d="${path[2]}"/>`).join('')}</svg>`);
    for (const [density, size] of Object.entries({ldpi:36, mdpi:48, hdpi:72, xhdpi:96, xxhdpi:144, xxxhdpi:192})) {
        const dir = join(res, `mipmap-${density}`);
        await mkdir(dir, {recursive:true});
        const image = await sharp(svg).resize(size, size).png().toBuffer();
        for (const [name, shape] of [['ic_launcher', `<rect width="${size}" height="${size}" rx="${size * 0.22}"/>`], ['ic_launcher_round', `<circle cx="${size/2}" cy="${size/2}" r="${size/2}"/>`]]) {
            await sharp(image).composite([{input:Buffer.from(`<svg width="${size}" height="${size}">${shape}</svg>`),blend:'dest-in'}]).png().toFile(join(dir, `${name}.png`));
        }
        await sharp(svg).resize(size, size).png().toFile(join(dir, 'ic_launcher_background.png'));
        await sharp(foreground).resize(Math.round(size * 2.25)).png().toFile(join(dir, 'ic_launcher_foreground.png'));
    }
    await writeFile(join(res,'drawable-v24/ic_launcher_foreground.xml'), vector(paths.map(path=>`<path android:fillColor="${path[1]}" android:pathData="${path[2]}"/>`).join('')));
    await writeFile(join(res,'drawable/ic_launcher_monochrome.xml'), vector(`<path android:fillColor="#FFFFFF" android:pathData="${mark}"/>`));
    await writeFile(join(res,'drawable/ic_launcher_background.xml'), `<vector xmlns:android="http://schemas.android.com/apk/res/android" xmlns:aapt="http://schemas.android.com/aapt" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:pathData="M0,0H108V108H0Z"><aapt:attr name="android:fillColor"><gradient android:startX="0" android:startY="0" android:endX="108" android:endY="108" android:type="linear"><item android:offset="0" android:color="#172C46"/><item android:offset="1" android:color="#185D57"/></gradient></aapt:attr></path></vector>\n`);
    for (const api of [26,33]) {
        const dir = join(res, `mipmap-anydpi-v${api}`);
        await mkdir(dir, {recursive:true});
        const xml = `<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@drawable/ic_launcher_background"/><foreground android:drawable="@drawable/ic_launcher_foreground"/>${api===33?'<monochrome android:drawable="@drawable/ic_launcher_monochrome"/>':''}</adaptive-icon>\n`;
        for (const name of ['ic_launcher','ic_launcher_round']) await writeFile(join(dir,`${name}.xml`),xml);
    }
    console.log('Generated Folia car launcher icons (legacy, adaptive, monochrome).');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generateCarLauncherIcons();
