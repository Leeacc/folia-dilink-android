import {beforeEach, describe, expect, it, vi} from 'vitest';

// Prove the updated providers reach the native bridge, preserving protocol values and status errors.
const native = vi.hoisted(() => ({request: vi.fn()}));
vi.mock('@/services/embeddedMusic', () => ({hasEmbeddedMusic:()=>true, requestEmbeddedMusic:native.request}));
import {getQishuiAvailability, requestQishui} from '@/services/onlineMusic/qishui/qishuiTransport';
import {requestKugou} from '@/services/onlineMusic/kugou/kugouTransport';
import {requestQq, requestQqMusicu} from '@/services/onlineMusic/qq/qqTransport';
import {neteaseApi} from '@/services/onlineMusic/netease/netease';

beforeEach(() => {native.request.mockReset();vi.stubGlobal('window',{});});
describe('Android embedded providers after upstream module migration', () => {
    it('routes Qishui with opaque media IDs and JSON parameters without an Electron bridge', async () => {
        native.request.mockResolvedValue({ok:true,data:{url:'https://audio.example/test'}});
        expect(getQishuiAvailability().configured).toBe(true);
        await expect(requestQishui('audio',{id:'7384456123456789012',quality:'standard'})).resolves.toHaveProperty('url');
        expect(native.request).toHaveBeenCalledWith('qishui','/audio',{method:'POST',body:JSON.stringify({id:'7384456123456789012',quality:'standard'})});
    });
    it('preserves Qishui sign-in diagnostics without translating failures to empty songs', async () => {
        native.request.mockResolvedValue({ok:false,error:{code:'auth-required',message:'Sign in required',stage:'account',upstreamCode:'401'}});
        await expect(requestQishui('login_qr_check',{key:'x'})).rejects.toMatchObject({code:'auth-required',stage:'account',upstreamCode:'401'});
    });
    it('uses the private Kugou account store, never a legacy renderer token', async () => {
        native.request.mockResolvedValue({status:1,data:{userid:1}});
        await requestKugou('user_detail',{token:'legacy-private-token',dfid:'old-device'});
        expect(native.request).toHaveBeenCalledWith('kugou','/user_detail',{method:'POST',body:'{}'});
    });
    it('keeps QQ HTTP refusal status across the native wrapper', async () => {
        native.request.mockResolvedValue({status:401,body:{code:401}});
        await expect(requestQq('login_status')).rejects.toMatchObject({code:'auth-required',httpStatus:401});
    });
    it('routes batched QQ numeric metadata through the private bridge instead of a missing Web proxy', async () => {
        native.request.mockResolvedValue({status:200,body:{code:0,q0:{code:0,data:{track_info:{id:123}}}}});
        const requests={q0:{module:'music.pf_song_detail_svr',method:'get_song_detail_yqq',param:{song_type:0,song_id:123}}};
        await expect(requestQqMusicu(requests)).resolves.toMatchObject({q0:{code:0}});
        expect(native.request.mock.calls[0][1]).toBe('/getFoliaRpc');
        expect(JSON.parse(native.request.mock.calls[0][2].body).q0.param.song_id).toBe(123);
    });
    it('preserves the signed-in QQ search route at the native boundary', async () => {
        native.request.mockResolvedValue({status:200,body:{code:0}});
        await requestQq('search',{key:'test'});
        expect(native.request.mock.calls[0][1]).toMatch(/^\/search\?/);
    });
    it('routes NetEase login status into the packaged backend', async () => {
        native.request.mockResolvedValue({code:200,data:{profile:null}});
        await expect(neteaseApi.getLoginStatus()).resolves.toMatchObject({code:200});
        expect(native.request.mock.calls[0][0]).toBe('netease');
        expect(native.request.mock.calls[0][1]).toMatch(/^\/login\/status\?timestamp=/);
    });
});
