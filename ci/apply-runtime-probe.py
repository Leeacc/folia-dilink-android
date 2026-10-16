from pathlib import Path
import hashlib,json,os,subprocess

# Debug-emulator diagnosis only: test backend source changes before rebuilding. This mode must never publish an APK.
package='io.github.leeacc.folia.dilink'
subprocess.run(['adb','shell','am','force-stop',package],check=True)
files=['main.cjs','compat.cjs','qqBridge.cjs','qqRpc.cjs','qqSearch.cjs','kugouApiBridge.cjs']
report={'mode':'runtime-probe-only; not a distributable APK verification','runtimeCommit':os.environ.get('GITHUB_SHA'),'files':{}}
for name in files:
    file=Path('mobile/runtime')/name
    if name=='kugouApiBridge.cjs':file=Path('electron')/name
    data=file.read_bytes()
    subprocess.run(['adb','shell','run-as',package,'sh','-c',f'cat > files/music-runtime/{name}'],input=data,check=True)
    report['files'][name]=hashlib.sha256(data).hexdigest()
Path('artifacts/runtime-probe-source.json').write_text(json.dumps(report,indent=2))
