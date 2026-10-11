const fs = require('node:fs');
const path = require('node:path');

// 当前文件：保护 Capacitor 8.4.2 在错误页和启动早期的 Cordova 生命周期事件。
const file = path.join(__dirname, '../node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/cordova/MockCordovaWebViewImpl.java');
const before = 'eval("window.Capacitor.triggerEvent(';
const after = 'eval("window.Capacitor && window.Capacitor.triggerEvent && window.Capacitor.triggerEvent(';
const source = fs.readFileSync(file, 'utf8');
if (source.includes(after)) process.exit(0);
if (source.split(before).length !== 2) throw new Error('Capacitor lifecycle source changed; review the patch before building');
fs.writeFileSync(file, source.replace(before, after));
console.log('Applied Capacitor lifecycle readiness guard');
