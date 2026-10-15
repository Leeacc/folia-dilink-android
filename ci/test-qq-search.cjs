const { test } = require('node:test');
const assert = require('node:assert/strict');
const { searchQq } = require('../mobile/runtime/qqSearch.cjs');

// Verify the real upstream regression and failover contract without network or user credentials.
test('CGI pins new_json=0 and preserves the media identity and total', async () => {
    const raw = { songmid: 'song-fixture', strMediaMid: 'media-fixture' };
    const result = await searchQq(new URLSearchParams({ key: '海阔天空', limit: '20', page: '2' }), {
        async get(url, config) {
            assert.equal(config.params.new_json, 0);
            assert.equal(config.params.p, 2);
            return { status: 200, data: { code: 0, data: { song: { list: [raw], totalnum: 51 } } } };
        },
        async post() {
            throw new Error('Successful CGI must not invoke RPC');
        },
    });
    assert.deepEqual(result.body.request.data.body.song.list, [raw]);
    assert.equal(result.body.request.data.meta.sum, 51);
});
test('an empty successful CGI page is a valid search result', async () => {
    const result = await searchQq(new URLSearchParams(), {
        async get() {
            return { status: 200, data: { code: 0, data: { song: { list: [], totalnum: 0 } } } };
        },
    });
    assert.deepEqual(result.body.request.data.body.song.list, []);
});
test('network failure falls back to Desktop RPC and keeps its upstream error code', async () => {
    const result = await searchQq(new URLSearchParams({ key: 'song' }), {
        async get() {
            throw new Error('network fixture');
        },
        async post(url, payload) {
            assert.equal(payload.request.method, 'DoSearchForQQMusicDesktop');
            return { status: 200, data: { code: 0, request: { code: 2001 } } };
        },
    });
    assert.equal(result.body.request.code, 2001);
});
