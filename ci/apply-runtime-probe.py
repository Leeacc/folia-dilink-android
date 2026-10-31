from pathlib import Path
import hashlib,json,os,subprocess,shlex

# Debug-emulator diagnosis only: test backend source changes before rebuilding. This mode must never publish an APK.
package='io.github.leeacc.folia.dilink'
subprocess.run(['adb','shell','am','force-stop',package],check=True)
files=['main.cjs','compat.cjs','privateStorage.cjs','qqBridge.cjs','qqRpc.cjs','qqSearch.cjs','kugou/kugouApiBridge.cjs','privateStore.cjs','qishui/session.cjs','qishui/qishuiApiBridge.cjs','osEncryption.cjs']
for name, expected in [('qishui-music-api','0.2.2'),('@yakult-green-tea/qq-music-api','3.3.3')]:
    target=f'files/music-runtime/node_modules/{name}/package.json'
    installed=subprocess.run(['adb','shell',f'run-as {package} cat {target}'],capture_output=True,text=True)
    if installed.returncode or json.loads(installed.stdout).get('version')!=expected:
        raise RuntimeError(f'{name} dependency changed; build a fresh APK instead of overlaying this runtime')
report={'mode':'runtime-probe-only; not a distributable APK verification','runtimeCommit':os.environ.get('GITHUB_SHA'),'files':{}}
for name in files:
    file=Path('mobile/runtime')/name
    if name.startswith(('kugou/', 'qishui/')) or name=='osEncryption.cjs':file=Path('electron')/name
    data=file.read_bytes()
    remote=f'run-as {package} sh -c '+shlex.quote(f'mkdir -p files/music-runtime/{Path(name).parent}; cat > files/music-runtime/{name}')
    subprocess.run(['adb','shell',remote],input=data,check=True)
    report['files'][name]=hashlib.sha256(data).hexdigest()
Path('artifacts/runtime-probe-source.json').write_text(json.dumps(report,indent=2))
