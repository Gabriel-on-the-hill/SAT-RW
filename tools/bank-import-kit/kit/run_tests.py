"""Run only the suites listed in this app's AGENTS.md, rejecting unexpected skips."""
import os,sys,re,subprocess,json
from pathlib import Path
app=Path(sys.argv[1]).resolve()
config=app/'tools/bank-import-kit/config/sat.json'
if not config.exists():config=Path(__file__).resolve().parent.parent/'config/sat.json'
cfg=json.loads(config.read_text(encoding='utf-8'))
env=dict(os.environ,NODE_PATH=cfg['node_modules'],JSDOM_PATH=str(Path(cfg['node_modules'])/'jsdom'))
text=(app/'AGENTS.md').read_text(encoding='utf-8')
block=text.split('## Run the tests before you claim anything works',1)[1].split('```',2)[1]
suites=[]
for line in block.splitlines():
    m=re.search(r'\bnode\s+([^\s#]+\.test\.js)',line)
    if m:
        pattern=m.group(1)
        suites.extend(sorted(p.relative_to(app).as_posix() for p in app.glob(pattern)))
failed=[]
for suite in suites:
    cwd=Path(cfg['source_checkout']) if suite=='cache-tags.test.js' and not (app/'.git').exists() else app
    test_env = dict(env)
    if suite == 'cache-tags.test.js':
        test_env.update(CACHE_TAG_APP_DIR=str(app), CACHE_TAG_GIT_DIR=cfg['source_checkout'])
    r=subprocess.run([cfg['node'],suite],cwd=cwd,env=test_env,capture_output=True,encoding='utf-8',errors='replace')
    output=r.stdout+r.stderr
    print(output,flush=True)
    if r.returncode or re.search(r'(?m)^SKIP',output):failed.append(suite)
    print(('FAIL ' if suite in failed else 'PASS ')+suite,flush=True)
print(f'{len(suites)-len(failed)}/{len(suites)} required suites passed; failures: {failed}',flush=True)
sys.exit(bool(failed) or not suites)
