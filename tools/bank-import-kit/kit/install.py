#!/usr/bin/env python3
"""Install only the exact verified and owner-reviewed output, with rollback snapshots."""
import sys,os,json,shutil,datetime
from pathlib import Path
from common import load_config,load,wpath,save
from safety import fingerprints,sha
cfg=load_config(sys.argv[1]);receipt=load(cfg,'verified.json')
if not receipt.get('tests_passed') or not receipt.get('human_reviewed'):
    raise SystemExit('STOP: successful tests and owner review are required; see RUNBOOK.md')
if receipt['fingerprints']!=fingerprints(cfg):raise SystemExit('STOP: inputs, app, mirrors, or output changed after verification')
app=Path(cfg['app_dir']).resolve();work=Path(cfg['work_dir']).resolve();out=Path(wpath(cfg,'out')).resolve()
operations=[]
for p in out.rglob('*'):
    if p.is_file():operations.append((p,app/p.relative_to(out),'app/'+p.relative_to(out).as_posix()))
for i,m in enumerate(cfg.get('mirrors',[])):
    root=(Path(cfg['config_path']).parent/m['dir']).resolve();stage=Path(wpath(cfg,'mirror-out',str(i)))
    for p in stage.rglob('*'):
        if p.is_file():operations.append((p,root/p.relative_to(stage),f'mirror-{i}/'+p.relative_to(stage).as_posix()))
allowed=[app]+[(Path(cfg['config_path']).parent/m['dir']).resolve() for m in cfg.get('mirrors',[])]
for source,dest,name in operations:
    if not any(dest.resolve().is_relative_to(root) for root in allowed):raise SystemExit('STOP: destination escapes configured roots')
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S');backup=work/'rollback'/stamp;backup.mkdir(parents=True)
log=[]
for source,dest,name in operations:
    existed=dest.exists();saved=backup/name
    if existed:saved.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(dest,saved)
    log.append({'destination':str(dest),'backup':str(saved) if existed else None,'expected':sha(source)})
(backup/'restore.json').write_text(json.dumps(log,indent=2),encoding='utf-8')
try:
    for source,dest,name in operations:
        dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,dest)
        if sha(source)!=sha(dest):raise RuntimeError('checksum mismatch: '+str(dest))
except Exception:
    for item in log:
        if item['backup']:shutil.copyfile(item['backup'],item['destination'])
        # New files are kept for inspection; they are not loaded after original pages are restored.
    raise
save(cfg,'installed.json',{'files':log,'rollback':str(backup)})
print('Installed and checksum verified:',len(operations),'files')
print('Rollback snapshot:',backup)
print('Owner staging command: git add '+ ' '.join('"'+p.relative_to(out).as_posix()+'"' for p in out.rglob('*') if p.is_file()))
