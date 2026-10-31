const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { requestQqRpc } = require('./qqRpc.cjs');
const { searchQq } = require('./qqSearch.cjs');

// Embed the desktop QQ API behind Folia's authenticated loopback bridge, without a second listener.
let callback;
function loadQq(stateDir) {
    if (callback) return callback;
    const keyPath = path.join(stateDir, 'qq-session-key');
    if (!fs.existsSync(keyPath)) fs.writeFileSync(keyPath, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
    process.env.QQ_AUTH_STATE_PATH = path.join(stateDir, 'qq-device.json');
    process.env.QQ_AUTH_SESSION_PATH = path.join(stateDir, 'qq-sessions.sealed');
    process.env.QQ_SESSION_SECRET = fs.readFileSync(keyPath, 'utf8').trim();
    process.env.QQ_DISABLE_UPDATE_CHECK = 'true';
    process.env.AUTO_OPEN_EXPLORER = 'false';
    process.env.QQ_LOG_LEVEL = 'error';
    // Node 18's embedded build does not expose Web Crypto globally by default.
    if (!globalThis.crypto) globalThis.crypto = crypto.webcrypto;
    const previous = process.env.NODE_ENV;
    // The package's documented test switch only suppresses automatic listen/logging; real drivers stay active.
    process.env.NODE_ENV = 'test';
    try {
        const api = require('@yakult-green-tea/qq-music-api');
        if (api.server) throw new Error('QQ API unexpectedly opened a listener');
        callback = api.default.callback();
    } finally {
        if (previous === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previous;
    }
    return callback;
}

function serveQq(req, res, stateDir) {
    req.url = req.url.slice(3);
    return loadQq(stateDir)(req, res);
}

// Every request is routed through the existing private listener and token; credentials never reach a LAN port.
function requestQq(endpoint, stateDir, port, token, method = 'GET', payload = '') {
    loadQq(stateDir);
    const parsed = new URL(endpoint, 'http://localhost');
    const route = '/' + parsed.pathname.split('/')[1];
    const allowed = new Set([
        '/login',
        '/logout',
        '/user',
        '/recommend',
        '/search',
        '/radio',
        '/song',
        '/getMusicPlay',
        '/getSongListDetail',
        '/getSongInfo',
        '/getAlbumInfo',
        '/getSingerAlbum',
        '/getSingerHotsong',
        '/getSearchByKey',
        '/getLyric',
        '/getFoliaRpc',
    ]);
    if (!allowed.has(route)) throw new Error('Unsupported QQ route');
    if (parsed.pathname === '/getFoliaRpc') {
        if (method !== 'POST') throw new Error('Lyric RPC requires POST');
        return requestQqRpc(payload);
    }
    if (parsed.pathname === '/getSearchByKey') return searchQq(parsed.searchParams);
    return new Promise((resolve, reject) => {
        const request = http.request(
            { hostname: '127.0.0.1', port, path: '/qq' + endpoint, method, headers: { 'X-Folia-Token': token, 'Content-Type': 'application/json' } },
            (response) => {
                let body = '';
                response.on('data', (chunk) => {
                    body += chunk;
                    if (body.length > 16000000) request.destroy(new Error('QQ response too large'));
                });
                response.on('end', () => {
                    try {
                        resolve({ status: response.statusCode, body: JSON.parse(body) });
                    } catch {
                        reject(new Error('Unreadable QQ response'));
                    }
                });
            },
        );
        request.setTimeout(65000, () => request.destroy(new Error('QQ request timed out')));
        request.on('error', reject);
        request.end(method === 'POST' ? payload : undefined);
    });
}
module.exports = { serveQq, requestQq };
