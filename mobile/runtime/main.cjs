const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { serveQq, requestQq } = require('./qqBridge.cjs');
const { createKugouApiBridge } = require('./kugouApiBridge.cjs');

// Embedded desktop music adapters. Only the private native bridge can access this loopback endpoint.
const stateDir = process.argv[2];
const secret = process.argv[3];
if (!stateDir || !secret) throw new Error('Private runtime arguments missing');
process.env.TMPDIR = stateDir;
// Android may suppress safeGetenv under its app security context. All desktop adapters
// must use our writable private directory rather than falling back to /tmp.
require('node:os').tmpdir = () => stateDir;
process.env.platform = 'lite';
fs.mkdirSync(stateDir, { recursive: true });
process.chdir(stateDir);
const tokenPath = path.join(stateDir, 'anonymous_token');
if (!fs.existsSync(tokenPath)) fs.writeFileSync(tokenPath, '', { mode: 0o600 });
const ncmRoot = path.dirname(require.resolve('@neteasecloudmusicapienhanced/api/package.json'));
const kgRoot = path.dirname(require.resolve('kugoumusicapi/package.json'));
const ncmUtil = require(path.join(ncmRoot, 'util'));
global.deviceId = ncmUtil.generateDeviceId();
global.cnIp = ncmUtil.generateRandomChineseIP();
const sessionFile = path.join(stateDir, 'kugou-session.json');
let session = {};
try { session = JSON.parse(fs.readFileSync(sessionFile, 'utf8')); } catch {}
const kugou = createKugouApiBridge({
  store: { get: key => session[key], set: (key, value) => {
    session[key] = value;
    fs.writeFileSync(sessionFile + '.tmp', JSON.stringify(session), { mode: 0o600 });
    fs.renameSync(sessionFile + '.tmp', sessionFile);
  } },
  apiLoader: () => new Proxy({}, { get: (_, operation) => {
    if (typeof operation !== 'string' || !/^[a-z_]+$/.test(operation)) return undefined;
    const moduleFile = path.join(kgRoot, 'module', operation + '.js');
    if (!fs.existsSync(moduleFile)) return undefined;
    return params => require(moduleFile)(params, (...args) => require(path.join(kgRoot, 'util/request')).createRequest(...args));
  } }),
});

async function dispatch(provider, endpoint) {
  if (provider === 'qq') {
    if (!/^\/(login\/|logout(?:\?|$)|user\/|get[A-Za-z]+(?:\/|\?|$))/.test(endpoint)) throw new Error('Invalid QQ operation');
    return requestQq(endpoint, stateDir, server.address().port, secret);
  }
  const url = new URL(endpoint, 'http://localhost');
  const operation = url.pathname.slice(1).replace(/\//g, '_');
  if (!/^[a-zA-Z0-9_]+$/.test(operation)) throw new Error('Invalid operation');
  const params = Object.fromEntries(url.searchParams);
  // No externally supplied proxy or target host is accepted by the embedded service.
  delete params.proxy; delete params.domain; delete params.realIP;
  if (provider === 'kugou') return kugou.request(operation, params);
  if (provider !== 'netease') throw new Error('Unknown provider');
  const file = path.join(ncmRoot, 'module', operation + '.js');
  if (!fs.existsSync(file)) throw new Error('Unknown music operation');
  params.cookie = ncmUtil.cookieToJson(params.cookie || '');
  params.timeout = 12000;
  // Embedded startup does not provision xeapi_public_key; the supported eapi route
  // returns the same authorized stream without that desktop bootstrap dependency.
  if (operation === 'song_url_v1') params.crypto = 'eapi';
  const result = await require(file)(params, (...args) => require(path.join(ncmRoot, 'util/request'))(...args));
  const body = result.body ?? result;
  if (Array.isArray(result.cookie) && result.cookie.length && !body.cookie) body.cookie = result.cookie.join(';');
  return body;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.headers['x-folia-token'] !== secret) { res.writeHead(403); res.end('{}'); return; }
  if (req.url.startsWith('/qq/')) {
    try { return serveQq(req, res, stateDir); }
    catch { res.writeHead(503); res.end(JSON.stringify({code:503,message:'QQ music runtime unavailable'})); return; }
  }
  if (req.url === '/health') { res.end(JSON.stringify({ ready: true, node: process.version, providers: ['netease', 'kugou', 'qq'] })); return; }
  if (req.method !== 'POST' || req.url !== '/request') { res.writeHead(404); res.end('{}'); return; }
  try {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 256000) throw new Error('Request too large'); }
    const { provider, endpoint } = JSON.parse(raw);
    res.end(JSON.stringify({ data: await dispatch(provider, endpoint) }));
  } catch (error) {
    // Keep upstream cookies, URLs and credentials out of logs and client diagnostics.
    const body = error && typeof error.body === 'object' ? error.body : null;
    if (body) res.end(JSON.stringify({ data: body }));
    else { res.end(JSON.stringify({ data: {code:502, file:error?.path ? path.basename(error.path) : undefined, diagnostic: String(error?.code || error?.name || 'UNKNOWN').replace(/[^A-Za-z0-9_]/g, '').slice(0,64)} })); }
  }
});
server.listen(0, '127.0.0.1', () => {
  fs.writeFileSync(path.join(stateDir, 'port.tmp'), String(server.address().port), { mode: 0o600 });
  fs.renameSync(path.join(stateDir, 'port.tmp'), path.join(stateDir, 'port')); 
  console.info('Folia embedded music runtime ready');
});
