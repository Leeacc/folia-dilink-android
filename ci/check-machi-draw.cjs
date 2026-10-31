const sharp = require('sharp');
const fs = require('node:fs');

// Three clears its default framebuffer after presentation; inspect the composited opaque scene canvas.
module.exports = async function checkMachiDraw(page) {
    const canvas=page.locator('[data-pixi-runtime="ready"] canvas');
    await page.waitForSelector('[data-pixi-runtime="ready"] canvas',{state:'visible',timeout:120000});
    await page.waitForTimeout(1500);
    const box=await canvas.boundingBox();
    if(!box)throw new Error('Machi scene canvas has no bounds');
    // Capture above the DOM subtitle; old Playwright's locator scroll protocol can stall on Chromium95.
    const png=await page.screenshot({clip:{x:box.x,y:box.y,width:box.width,height:box.height*0.65}});
    const {data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
    let edges=0,max=0;
    for(let y=0;y<info.height;y+=2)for(let x=1;x<info.width;x+=2){
        const index=(y*info.width+x)*info.channels;
        let contrast=0;
        for(let channel=0;channel<3;channel++){
            max=Math.max(max,data[index+channel]);
            contrast+=Math.abs(data[index+channel]-data[index-info.channels+channel]);
        }
        if(contrast>90)edges++;
    }
    fs.mkdirSync('artifacts/major-ui',{recursive:true});
    fs.writeFileSync('artifacts/major-ui/machi-canvas.png',png);
    if(max<128 || edges<100)throw new Error('Machi did not draw scene detail: '+JSON.stringify({max,edges}));
    return {max,edges,scope:'Composited opaque Three scene canvas'};
};
