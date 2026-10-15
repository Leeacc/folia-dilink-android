// Keep QQ search protocols isolated from the account library and normalize their response envelope.
async function searchQq(query, client = require('axios')) {
    const keyword = String(query.get('key') || '')
        .trim()
        .slice(0, 60);
    const limit = Math.min(100, Math.max(1, Number(query.get('limit')) || 20));
    const page = Math.max(1, Number(query.get('page')) || 1);
    // QQ's legacy endpoint is still active. new_json=1 silently empties its results.
    // See Rain120/qq-music-api#113 / #121; pin 0 instead of the package's regressed default.
    try {
        const response = await client.get('https://c.y.qq.com/soso/fcgi-bin/client_search_cp', {
            timeout: 20000,
            responseType: 'json',
            headers: { Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0' },
            params: {
                w: keyword,
                n: limit,
                p: page,
                format: 'json',
                new_json: 0,
                ct: 24,
                qqmusic_ver: 1298,
                platform: 'yqq.json',
                remoteplace: 'txt.yqq.song',
            },
        });
        const song = response.data?.data?.song;
        if (Number(response.data?.code) === 0 && Array.isArray(song?.list)) {
            return {
                status: response.status,
                body: {
                    code: 0,
                    request: {
                        code: 0,
                        data: {
                            body: { song: { list: song.list } },
                            meta: { sum: song.totalnum },
                        },
                    },
                },
            };
        }
    } catch {
        /* Try the desktop RPC if the CGI service cannot answer. */
    }
    const payload = {
        comm: { ct: '19', cv: '1845' },
        request: {
            method: 'DoSearchForQQMusicDesktop',
            module: 'music.search.SearchCgiService',
            param: { query: keyword, search_type: 0, num_per_page: limit, page_num: page },
        },
    };
    const response = await client.post('https://u.y.qq.com/cgi-bin/musicu.fcg', payload, {
        timeout: 20000,
        responseType: 'json',
        headers: { 'Content-Type': 'application/json', Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0' },
    });
    return { status: response.status, body: response.data };
}
module.exports = { searchQq };
