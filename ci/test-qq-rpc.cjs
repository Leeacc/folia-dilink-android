const {test}=require('node:test');
const assert=require('node:assert/strict');
const {requestQqRpc}=require('../mobile/runtime/qqRpc.cjs');

// Preserve QQ media identity at the new Major search boundary and restrict native RPC forwarding.
test('adapts the CGI identity to Major Lite search without losing album/song mids',async()=>{
    const client={get:async()=>({status:200,data:{code:0,data:{song:{list:[{songid:12,songmid:'track',songname:'title',albumid:34,albummid:'cover',albumname:'album'}],totalnum:1}}}})};
    const result=await requestQqRpc(JSON.stringify({request:{method:'DoSearchForQQMusicLite',module:'music.search.SearchCgiService',param:{query:'title'}}}),client);
    const song=result.body.request.data.body.item_song[0];
    assert.equal(song.id,12);assert.equal(song.mid,'track');assert.equal(song.album.mid,'cover');
});
test('does not forward arbitrary RPC modules to the music provider',async()=>{
    let called=false;
    await assert.rejects(()=>requestQqRpc(JSON.stringify({request:{method:'DeleteAccount',module:'arbitrary',param:{}}}),{post:async()=>{called=true;}}));
    assert.equal(called,false);
});
