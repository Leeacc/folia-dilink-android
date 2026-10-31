const fs = require('node:fs');
const path = require('node:path');

// Persist the protocol repository's encrypted values atomically in Android's private directory.
function createPrivateStore(stateDir, fileName) {
    const file = path.join(stateDir, fileName);
    let values = {};
    try {
        const restored = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (restored && typeof restored === 'object' && !Array.isArray(restored)) values = restored;
    } catch {}
    const save = () => {
        fs.writeFileSync(file + '.tmp', JSON.stringify(values), {mode: 0o600});
        fs.renameSync(file + '.tmp', file);
    };
    return {
        get: key => values[key],
        set: (key, value) => { values[key] = value; save(); },
        delete: key => { delete values[key]; save(); },
    };
}
module.exports = {createPrivateStore};
