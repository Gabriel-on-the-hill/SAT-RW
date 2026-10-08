"""Record explicit owner sign-off after the mandatory review; never run speculatively."""
import sys
from common import load_config,load,save
from safety import fingerprints
cfg=load_config(sys.argv[1]);r=load(cfg,'verified.json')
if '--reviewed' not in sys.argv:raise SystemExit('STOP: use --reviewed only after explicit owner review approval')
if not r.get('tests_passed') or r['fingerprints']!=fingerprints(cfg):raise SystemExit('STOP: verification is missing or stale')
r['human_reviewed']=True;save(cfg,'verified.json',r);print('Owner review recorded for the exact verified output')
