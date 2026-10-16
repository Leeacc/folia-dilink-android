const {test}=require('node:test');
const assert=require('node:assert/strict');
const {installUtf8DecoderCompat}=require('../mobile/runtime/compat.cjs');

// Reproduce the exact ERR_NO_ICU boundary of the Android runtime, not the desktop's full-ICU constructor.
class NoIcuDecoder extends TextDecoder {
    constructor(label,options={}) {
        if(options.fatal)throw Object.assign(new Error('ICU is disabled'),{code:'ERR_NO_ICU'});
        super(label,options);
    }
}
const target={TextDecoder:NoIcuDecoder};
assert.equal(installUtf8DecoderCompat(target),true);
const Decoder=target.TextDecoder;
test('keeps native decoding on full-ICU runtimes',()=>{const normal={TextDecoder};assert.equal(installUtf8DecoderCompat(normal),false);assert.equal(normal.TextDecoder,TextDecoder);});
test('strict UTF-8 preserves Chinese/emoji and typed-array offsets',()=>{
    const decoder=new Decoder('utf-8',{fatal:true});const bytes=Buffer.from('xx车机🎵yy');
    assert.equal(decoder.decode(bytes.subarray(2,bytes.length-2)),'车机🎵');assert.equal(decoder.fatal,true);
});
test('rejects malformed, overlong, surrogate and truncated UTF-8',()=>{
    for(const bytes of [[0xff],[0xc0,0xaf],[0xed,0xa0,0x80],[0xf4,0x90,0x80,0x80],[0xe4,0xb8]])
        assert.throws(()=>new Decoder('utf8',{fatal:true}).decode(new Uint8Array(bytes)),TypeError);
});
test('buffers split multibyte sequences and rejects an incomplete final chunk',()=>{
    const d=new Decoder('utf-8',{fatal:true});
    assert.equal(d.decode(new Uint8Array([0xf0,0x9f]),{stream:true}),'');
    assert.equal(d.decode(new Uint8Array([0x8e,0xb5])),'🎵');
    assert.equal(d.decode(new Uint8Array([0xe4]),{stream:true}),'');assert.throws(()=>d.decode(),TypeError);
    assert.equal(d.decode(Buffer.from('恢复')),'恢复');
});
test('retains native BOM and replacement behavior',()=>{
    assert.equal(new Decoder('utf-8',{fatal:true}).decode(Buffer.from([0xef,0xbb,0xbf,65])),'A');
    assert.equal(new Decoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.from([0xef,0xbb,0xbf,65])),'\ufeffA');
    assert.equal(new Decoder().decode(Buffer.from([0xff])),'�');
});
