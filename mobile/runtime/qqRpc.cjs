const {searchQq} = require('./qqSearch.cjs');

// Only the two read-only upstream lyric/search RPCs are exposed. Caller-controlled target URLs are not accepted.
async function requestQqRpc(raw, client = require('axios')) {
    const payload = JSON.parse(raw);
    const {method, module, param} = payload?.request || {};
    if (method === 'DoSearchForQQMusicLite' && module === 'music.search.SearchCgiService') {
        const query = new URLSearchParams({key:String(param?.query || ''),page:String(param?.page_num || 1),limit:String(param?.num_per_page || 20)});
        const result=await searchQq(query,client);
        const list=result.body?.request?.data?.body?.song?.list || [];
        const songs=list.map(info=>({
            ...info,id:info.id ?? info.songid,mid:info.mid ?? info.songmid,title:info.title ?? info.songname,
            album:info.album || {id:info.albumid,mid:info.albummid,name:info.albumname},
        }));
        return {status:result.status,body:{...result.body,request:{...result.body?.request,data:{body:{item_song:songs}}}}};
    }
    if (method !== 'GetPlayLyricInfo' || module !== 'music.musichallSong.PlayLyricInfo') throw new Error('Unsupported lyric RPC');
    const response=await client.post('https://u.y.qq.com/cgi-bin/musicu.fcg',{
        comm:{ct:11,cv:'1003006',v:'1003006',tmeAppID:'qqmusiclight',uid:'0'},
        request:{method,module,param},
    },{timeout:20000,responseType:'json',headers:{'Content-Type':'application/json','User-Agent':'okhttp/3.14.9',Cookie:'tmeLoginType=-1;'}});
    return {status:response.status,body:response.data};
}
module.exports={requestQqRpc};
