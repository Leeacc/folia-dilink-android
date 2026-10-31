from pathlib import Path
import subprocess, urllib.request, zipfile, shutil, hashlib

# Package pinned production dependencies and the official Node.js Mobile release for Android.
repo = Path(__file__).resolve().parents[1]
runtime = repo / 'mobile/runtime'
subprocess.run(['npm', 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], cwd=runtime, check=True)
shutil.copytree(repo / 'electron/kugou', runtime / 'kugou', dirs_exist_ok=True)
shutil.copyfile(repo / 'electron/osEncryption.cjs', runtime / 'osEncryption.cjs')
shutil.copytree(repo / 'electron/qishui', runtime / 'qishui', dirs_exist_ok=True)
assets = repo / 'android/app/src/main/assets'
assets.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(assets / 'music-runtime.zip', 'w', zipfile.ZIP_DEFLATED) as output:
    for file in runtime.rglob('*'):
        if file.is_file() and not file.is_symlink() and '.bin' not in file.parts:
            output.write(file, file.relative_to(runtime))
lib = repo / 'android/app/libnode'
lib.mkdir(exist_ok=True)
archive = lib / 'runtime.zip'
url = 'https://github.com/nodejs-mobile/nodejs-mobile/releases/download/v18.20.4/nodejs-mobile-v18.20.4-android.zip'
if not archive.exists():
    urllib.request.urlretrieve(url, archive)
with zipfile.ZipFile(archive) as source:
    source.extractall(lib)
if not (lib / 'include/node/node.h').exists():
    raise RuntimeError('Unexpected Node.js Mobile archive layout')
print('Runtime SHA256:', hashlib.sha256(archive.read_bytes()).hexdigest())
