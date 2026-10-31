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
test('forwards bounded numeric and mid song details without accepting arbitrary subrequests',async()=>{
    const calls=[];const client={post:async(url,payload)=>{calls.push({url,payload});return{status:200,data:{code:0,q0:{code:0}}};}};
    const detail=param=>({module:'music.pf_song_detail_svr',method:'get_song_detail_yqq',param});
    await requestQqRpc(JSON.stringify({comm:{cookie:'must-not-forward'},q0:detail({song_type:0,song_id:123}),q1:detail({song_type:0,song_mid:'000testMID'})}),client);
    assert.equal(calls[0].payload.q0.param.song_id,123);
    assert.equal(calls[0].payload.q1.param.song_mid,'000testMID');
    assert.deepEqual(calls[0].payload.comm,{ct:24,cv:0});
    await assert.rejects(()=>requestQqRpc(JSON.stringify({q0:detail({song_type:0,song_id:'123'})}),client));
    await assert.rejects(()=>requestQqRpc(JSON.stringify({q0:detail({song_type:0,song_id:123}),q1:{module:'private',method:'write',param:{}}}),client));
    assert.equal(calls.length,1);
});
