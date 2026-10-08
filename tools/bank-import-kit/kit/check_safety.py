"""Regression fixtures for the installation barrier and complete source verification."""
import json,sys,tempfile,subprocess,copy,contextlib,io
from pathlib import Path
from common import load_config,save,write_bank,require_owner_confirmation,OWNER_QUESTIONS
from safety import strict_gates,write_receipt,fingerprints
passed=0

def check(condition,name):
    global passed
    if not condition:raise AssertionError(name)
    passed+=1;print('PASS '+name)

with tempfile.TemporaryDirectory(prefix='sat-import-gates-') as td:
    root=Path(td).resolve()
    if not root.is_relative_to(Path(tempfile.gettempdir()).resolve()):raise AssertionError('unsafe fixture root')
    app=root/'app';app.mkdir();work=root/'work';work.mkdir();out=work/'out';out.mkdir()
    (root/'source.pdf').write_bytes(b'fixture input')
    (root/'overrides.json').write_text('{}',encoding='utf-8')
    config={'app_dir':'app','work_dir':'work','pdf_dir':'.','pdfs':['source.pdf'],'overrides':'overrides.json','banks':{'X':{'file':'data.js','var':'questionBank_X'}},'origin_field':'origin','origin_value':'cb-sat','mirrors':[],'test_command':['fixture'],'existing_repairs':{}}
    cp=root/'config.json';cp.write_text(json.dumps(config),encoding='utf-8');cfg=load_config(str(cp))
    from repair import apply_layout_override
    check(apply_layout_override('unit\n\n2.', {'layout_single_paragraph':True,'layout_replace':[['unit 2.', 'unit2.']]}) == 'unit2.', 'layout override repairs superscript breaks without changing characters')
    try:
        apply_layout_override('unit 2.', {'layout_replace':[['unit 2.', 'unit3.']]})
        rejected = False
    except SystemExit:
        rejected = True
    check(rejected, 'layout override rejects altered source characters')
    import datetime
    def confirmation_passes(candidate):
        try:
            with contextlib.redirect_stdout(io.StringIO()): require_owner_confirmation(candidate)
            return True
        except SystemExit as exc:
            return exc.code == 0
    check(not confirmation_passes(cfg),'missing owner confirmation stops work')
    approved=copy.deepcopy(cfg)
    approved['owner_confirmation']={'date':datetime.date.today().isoformat(),'confirmed_by':'owner','answers':{k:'none' for k,_ in OWNER_QUESTIONS}}
    check(confirmation_passes(approved),'complete same-day owner confirmation passes')
    stale=copy.deepcopy(approved);stale['owner_confirmation']['date']='2000-01-01';stale['today']='2000-01-01'
    check(not confirmation_passes(stale),'stale confirmation fails even when config date agrees')
    drift=copy.deepcopy(approved);drift['retire']={'origins':['book-ugsg']}
    check(not confirmation_passes(drift),'retirement contradicting owner answer stops work')
    passage='A complete passage has enough detail.';prompt='Which choice completes the statement?'
    options=['A. first option','B. second option','C. third option','D. fourth option']
    explanation='Choice D is correct because the complete source statement directly establishes the fourth option.'
    block='Question\n'+passage+'\n'+prompt+'\nAnswer\n'+'\n'.join(options)+'\nCorrect Answer: D\nRationale\n'+explanation
    q={'id':'1234abcd','passage':passage,'question':prompt,'options':options,'answer':'D','explanation':explanation,'skill':'Inferences','difficulty':'Medium','altIds':[]}
    raw={'1234abcd':dict(q,_effective_block=block,_source_block=block,_pdf='source.pdf',_page=0,flags=[])}
    write_bank(str(app/'data.js'),('const questionBank_X = ','\n'),[],';\n')
    write_bank(str(out/'data.js'),('const questionBank_X = ','\n'),[q],';\n')
    for name,value in {'phase1-report.json':{'extracted':1,'problems':[],'in_batch_duplicates':[],'review_band':[]},'phase3-report.json':{'missing_geometry':[],'underline_failed':[],'geometry_mismatch':[]},'extracted.json':{'all':[raw['1234abcd']],'new':[raw['1234abcd']]},'assembled.json':{'new':[q]},'manifest.json':{'new':{'X':['1234abcd']}}}.items():save(cfg,name,value)
    def valid(new,records=None,source=None):
        with contextlib.redirect_stdout(io.StringIO()):return strict_gates(cfg,str(out),[new],source or raw,records or [new],False)
    check(valid(q),'complete fields pass')
    for field in ['passage','question','explanation']:
        changed=copy.deepcopy(q);changed[field]=changed[field][:-8]
        check(not valid(changed),'truncated '+field+' fails')
    changed=copy.deepcopy(q);changed['options'][0]=changed['options'][0][:-4]
    check(not valid(changed),'an option that is still a source substring fails when incomplete')
    changed=copy.deepcopy(q);changed['options'][0]=changed['options'][0]+','
    check(not valid(changed),'changed option punctuation fails')
    flagged=copy.deepcopy(raw);flagged['1234abcd']['flags']=['UNDERLINE']
    check(not valid(q,source=flagged),'a required but empty underline fails')
    a=copy.deepcopy(q);b=copy.deepcopy(q);b['id']='8765dcba';a['altIds']=['abcdef12'];b['altIds']=['abcdef12']
    check(not valid(a,[a,b]),'an alias shared by two canonicals fails')
    save(cfg,'phase1-report.json',{'extracted':1,'problems':['unresolved'],'in_batch_duplicates':[],'review_band':[]})
    check(not valid(q),'verification refuses unresolved extraction problems')
    save(cfg,'phase1-report.json',{'extracted':1,'problems':[],'in_batch_duplicates':[],'review_band':[]})
    old = dict(q, id='abcdef99', origin='book-ugsg')
    write_bank(str(app/'data.js'),('const questionBank_X = ','\n'),[old],';\n')
    cfg['retire']={'origins':['book-ugsg'],'retired_file':'data-retired.js','follow_up_days':0}
    archive = dict(old, retiredOn=cfg['today'], retiredFrom='data.js')
    save(cfg,'manifest.json',{'new':{'X':[q['id']]},'retired':[old['id']]})
    write_bank(str(out/'data-retired.js'),('const questionBank_RETIRED = ','\n'),[archive],';\n')
    check(valid(q),'authorized retirement preserves the complete source record')
    shortened=copy.deepcopy(archive);shortened['explanation']='truncated'
    write_bank(str(out/'data-retired.js'),('const questionBank_RETIRED = ','\n'),[shortened],';\n')
    check(not valid(q),'truncated retired explanation fails conservation')
    write_bank(str(out/'data-retired.js'),('const questionBank_RETIRED = ','\n'),[], ';\n')
    check(not valid(q),'missing retirement archive record fails conservation')
    write_bank(str(out/'data-retired.js'),('const questionBank_RETIRED = ','\n'),[archive],';\n')
    cfg['retire']['origins']=[]
    check(not valid(q),'retiring an unauthorized source fails')
    cfg.pop('retire');(out/'data-retired.js').unlink()
    write_bank(str(app/'data.js'),('const questionBank_X = ','\n'),[], ';\n')
    save(cfg,'manifest.json',{'new':{'X':[q['id']]}})
    write_receipt(cfg)
    install=Path(__file__).with_name('install.py')
    r=subprocess.run([sys.executable,str(install),str(cp)],capture_output=True,text=True)
    check(r.returncode!=0 and 'owner review' in r.stderr,'installer refuses an unreviewed verification receipt')
    check('1234abcd' not in (app/'data.js').read_text(),'unreviewed installation writes no bank data')
    receipt=json.loads((work/'verified.json').read_text());receipt['human_reviewed']=True;save(cfg,'verified.json',receipt)
    (out/'data.js').write_text('changed staged output',encoding='utf-8')
    r=subprocess.run([sys.executable,str(install),str(cp)],capture_output=True,text=True)
    check(r.returncode!=0 and 'changed after verification' in r.stderr,'installer rejects staged output changed after verification')
    check('1234abcd' not in (app/'data.js').read_text(),'stale installation writes no bank data')
print(f'ALL {passed} IMPORT SAFETY CHECKS PASSED')
