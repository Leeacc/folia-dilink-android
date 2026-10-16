const {Buffer, isUtf8: nativeIsUtf8} = require('node:buffer');

// Node.js Mobile is built without ICU: preserve strict UTF-8 validation instead of dropping the fatal flag.
const isUtf8 = nativeIsUtf8 || (bytes => Buffer.from(bytes.toString('utf8')).equals(bytes));
const invalidUtf8 = () => new TypeError('The encoded data was not valid for encoding utf-8');
function completePrefix(bytes) {
    let start=bytes.length-1;
    while(start>=0 && (bytes[start]&0xc0)===0x80)start--;
    if(start<0)return bytes.length;
    const lead=bytes[start];
    const expected=lead>=0xc2 && lead<=0xdf ? 2 : lead>=0xe0 && lead<=0xef ? 3 : lead>=0xf0 && lead<=0xf4 ? 4 : 1;
    if(bytes.length-start>=expected)return bytes.length;
    const trial=Buffer.alloc(expected,0x80);
    bytes.copy(trial,0,start);
    if(bytes.length-start===1 && lead===0xe0)trial[1]=0xa0;
    if(bytes.length-start===1 && lead===0xf0)trial[1]=0x90;
    if(!isUtf8(trial))throw invalidUtf8();
    return start;
}
function installUtf8DecoderCompat(target=globalThis) {
    const NativeDecoder=target.TextDecoder;
    try { new NativeDecoder('utf-8',{fatal:true});return false; }
    catch(error) { if(error.code!=='ERR_NO_ICU')throw error; }
    class TextDecoderCompat extends NativeDecoder {
        constructor(label='utf-8',options={}) {
            const strict=Boolean(options.fatal) && ['utf-8','utf8','unicode-1-1-utf-8'].includes(String(label).trim().toLowerCase());
            super(label,{...options,fatal:strict ? false : options.fatal});
            this.strictUtf8=strict;this.pending=Buffer.alloc(0);
        }
        get fatal() { return this.strictUtf8 || super.fatal; }
        decode(input,options={}) {
            if(!this.strictUtf8)return super.decode(input,options);
            const bytes=input===undefined ? Buffer.alloc(0) : ArrayBuffer.isView(input)
                ? Buffer.from(input.buffer,input.byteOffset,input.byteLength) : Buffer.from(input);
            const combined=Buffer.concat([this.pending,bytes]);
            try {
                const end=options.stream ? completePrefix(combined) : combined.length;
                if(!isUtf8(combined.subarray(0,end)))throw invalidUtf8();
                this.pending=options.stream ? combined.subarray(end) : Buffer.alloc(0);
            } catch(error) {
                this.pending=Buffer.alloc(0);super.decode();throw error;
            }
            return super.decode(input,options);
        }
    }
    target.TextDecoder=TextDecoderCompat;
    if(target===globalThis)require('node:util').TextDecoder=TextDecoderCompat;
    return true;
}
module.exports={installUtf8DecoderCompat};
