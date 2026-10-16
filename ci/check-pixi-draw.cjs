// Read the visualizer's own framebuffer in its render frame, excluding the shared background and DOM subtitles.
module.exports = async function checkPixiDraw(page) {
    await page.waitForSelector('[data-pixi-runtime="ready"] canvas', {timeout:120000});
    let sample;
    for(let attempt=0;attempt<40;attempt++) {
        sample=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
            const canvas=document.querySelector('[data-pixi-runtime="ready"] canvas');
            if(!canvas){resolve({bright:0,max:0});return;}
            const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
            if(!gl){resolve({bright:0,max:0});return;}
            const pixels=new Uint8Array(canvas.width*canvas.height*4);
            gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
            let bright=0,max=0;
            for(let offset=0;offset<pixels.length;offset+=16){
                const value=Math.max(pixels[offset],pixels[offset+1],pixels[offset+2]);
                max=Math.max(max,value);if(value>32)bright++;
            }
            resolve({bright,max});
        })));
        if(sample.bright>50 && sample.max>64)return sample;
        await page.waitForTimeout(500);
    }
    throw new Error('Pixi initialized but did not draw visible effect pixels: '+JSON.stringify(sample));
};
