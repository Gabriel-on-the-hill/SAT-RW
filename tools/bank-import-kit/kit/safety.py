"""Source completeness, identity conservation, and checksum-bound verification receipts."""
import os, re, json, hashlib, html
from pathlib import Path
from common import load, save, wpath, gate, load_banks, all_records, ck, underline_ranges, qkey, is_retiring, read_bank, source_repair_values

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def files_under(root):
    root = Path(root)
    result = {}
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in {'.git','node_modules','_extract','_bank-import-work','__pycache__'}]
        for name in files:
            p = Path(base) / name
            if p.suffix in {'.js','.html','.css','.json','.py','.md'} and name != 'PLAN-NOTES.md':
                result[p.relative_to(root).as_posix()] = sha(p)
    return result

def fingerprints(cfg):
    out = Path(wpath(cfg,'out'))
    return {'config': sha(cfg['config_path']), 'overrides': sha(cfg['overrides']),
            'pdfs': {name: sha(Path(cfg['pdf_dir'])/name) for name in cfg['pdfs']},
            'app': files_under(cfg['app_dir']),
            'out': {p.relative_to(out).as_posix(): sha(p) for p in out.rglob('*') if p.is_file()},
            'work': {name: sha(wpath(cfg,name)) for name in ['extracted.json','assembled.json','manifest.json','phase1-report.json','phase3-report.json']},
            'geometry': {p.name: sha(p) for p in Path(wpath(cfg,'geo')).glob('*.json')},
            'mirrors': {m['dir']: files_under(Path(cfg['config_path']).parent / m['dir']) for m in cfg.get('mirrors',[])},
            'mirror_out': {p.relative_to(Path(wpath(cfg,'mirror-out'))).as_posix():sha(p) for p in Path(wpath(cfg,'mirror-out')).rglob('*') if p.is_file()}}

def write_receipt(cfg):
    save(cfg,'verified.json',{'tests_passed':True,'human_reviewed':False,'fingerprints':fingerprints(cfg)})

def strict_gates(cfg,out,new,raw,bank,run_tests):
    from extract import safe_fix, norm
    print('Completeness and conservation')
    p1,p3=load(cfg,'phase1-report.json'),load(cfg,'phase3-report.json')
    ok=gate(p1['extracted']>0 and not p1['problems'] and not p1['in_batch_duplicates'] and not p1['review_band'],'extraction is nonempty and all Phase 1 gates remain satisfied')
    ok &= gate(not p3['missing_geometry'] and not p3['underline_failed'],'Phase 3 gates remain satisfied')
    ov=json.loads(Path(cfg['overrides']).read_text(encoding='utf-8'))
    nows=lambda t: re.sub(r'\s+','',re.sub(r'</?u>','',t or ''))
    failures=[]
    for q in new:
        r=raw[q['id']]; block=r['_effective_block']; repair=ov.get(q['id'],{})
        body=re.search(r'(?ms)^\s*Question\s*$(.*?)^\s*Answer\s*$',block).group(1)
        expected=safe_fix(body)
        for a,b in repair.get('passage_replace',[]): expected=expected.replace(a,b)
        if not q.get('image') and nows(q['passage']+q['question']) != nows(expected): failures.append([q['id'],'complete passage + prompt'])
        opt=re.search(r'(?ms)^Answer\n(.*?)^Correct Answer:',block).group(1)
        if nows(''.join(q['options'])) != nows(safe_fix(opt)): failures.append([q['id'],'complete A-D options'])
        rationale=re.search(r'\bRationale\b(.*)$',block,re.S).group(1)
        if nows(q['explanation']) != nows(norm(rationale)): failures.append([q['id'],'complete explanation'])
        if 'UNDERLINE' in r['flags'] and not q.get('image') and not re.search(r'<u>[^<]+</u>',q['passage']): failures.append([q['id'],'nonempty underline required'])
        if '<u>' in q['passage']:
            g=json.loads(Path(wpath(cfg,'geo',q['id']+'.json')).read_text(encoding='utf-8'))
            expected_ranges=[(a,b) for a,b in underline_ranges(g['lines']) if b<=len(ck(re.sub(r'</?u>','',q['passage'])))]
            actual_ranges=[]
            for m in re.finditer(r'<u>(.*?)</u>',q['passage'],re.S):
                start=len(ck(re.sub(r'</?u>','',q['passage'][:m.start()])))
                actual_ranges.append((start,start+len(ck(m.group(1)))))
            if actual_ranges!=expected_ranges:failures.append([q['id'],'underline positions'])
        if any(re.search(r'[\x00-\x08\x0b\x0e-\x1f]',str(q.get(f,''))) for f in ['passage','question','explanation','options']): failures.append([q['id'],'control character'])
    save(cfg,'strict-findings.json',failures)
    ok &= gate(not failures,'complete source fields, explanations, and required underlines retained',failures[:30])
    original=all_records(load_banks(cfg)); before={q['id'] for q in original}; after={q['id'] for q in bank}
    # An image-only record's title is not enough to identify its complete source question.
    from difflib import SequenceMatcher
    known=[]; figure_hits=[]
    for q in original:
        if q.get('image'):
            source=next((raw[i] for i in [q['id']]+list(q.get('altIds') or []) if i in raw),None)
            if source:known.append((q['id'],qkey(source)))
    for q in new:
        if not q.get('image'):continue
        key=qkey(raw[q['id']])
        for qid,other in known:
            if abs(len(key)-len(other))>.15*max(len(key),1):continue
            sm=SequenceMatcher(None,key,other)
            if sm.quick_ratio()<.85:continue
            ratio=sm.ratio()
            if ratio>=.85:figure_hits.append([q['id'],qid,round(ratio,4)])
        known.append((q['id'],key))
    ok &= gate(not figure_hits,'new figures do not duplicate source-backed existing or in-batch questions',figure_hits)

    aliases={}
    collision=[]
    for q in bank:
        for a in q.get('altIds') or []:
            if a in aliases and aliases[a]!=q['id']:collision.append([a,aliases[a],q['id']])
            aliases[a]=q['id']
    ok &= gate(not collision,'each historical alias resolves to one canonical question',collision[:20])
    ret = cfg.get('retire') or {}
    archive = []
    if ret:
        archive_path = Path(out) / ret['retired_file']
        if not archive_path.exists(): archive_path = Path(cfg['app_dir']) / ret['retired_file']
        if archive_path.exists(): archive = read_bank(str(archive_path))[1]
    archive_ids = {q['id'] for q in archive}
    ok &= gate(len(archive_ids) == len(archive), 'retirement archive IDs are unique')
    ok &= gate(before <= after | archive_ids, 'all existing canonical IDs survive in the drawable bank or retirement archive', sorted(before-after-archive_ids))
    newly_retired = before - after
    manifest = load(cfg, 'manifest.json')
    ok &= gate(newly_retired == set(manifest.get('retired', [])), 'manifest accounts for every record removed from the drawable bank')
    ok &= gate(all(is_retiring(cfg, q) for q in original if q['id'] in newly_retired), 'only owner-authorized origins are retired')
    live_archive = Path(cfg['app_dir']) / ret.get('retired_file', '__no_archive__')
    prior_archive = read_bank(str(live_archive))[1] if live_archive.exists() else []
    archived = {q['id']: q for q in archive}
    ok &= gate(all(archived.get(q['id']) == q for q in prior_archive), 'previously archived records remain unchanged')
    old={q['id']:q for q in original}; current={q['id']:q for q in bank}
    changed=[]
    for i,q in old.items():
        expected=dict(q)
        additions=cfg.get('alias_additions',{}).get(i,[])
        if additions: expected['altIds']=list(dict.fromkeys(list(q.get('altIds') or [])+additions))
        repair=cfg.get('existing_repairs',{}).get(i)
        if repair:
            expected.update(source_repair_values(q, repair, raw))
            source_id = repair.get('source_id', i)
            if source_id not in {i, *q.get('altIds', []), *cfg.get('alias_additions', {}).get(i, [])}: changed.append(i)
            if not repair.get('why'):changed.append(i)
        if i in newly_retired:
            expected = dict(q, retiredOn=cfg['today'], retiredFrom=next(cfg['banks'][k]['file'] for k, (_, arr, _) in load_banks(cfg).items() if any(record['id'] == i for record in arr)))
            expected.pop('retireAfter', None)
            if archived.get(i) != expected: changed.append(i)
        else:
            held = next((entry for entry in manifest.get('held', []) if entry[0] == i), None)
            if held:
                import datetime
                expected.setdefault('retireAfter', (datetime.date.fromisoformat(cfg['today']) + datetime.timedelta(days=ret['follow_up_days'])).isoformat())
            if current.get(i) != expected: changed.append(i)
    ok &= gate(not changed,'existing and retired records retain complete content and aliases except declared source repairs',changed[:20])
    ok &= gate(bool(cfg.get('test_command')) if run_tests else True,'a test command is required when --run-tests is requested')
    # Every exception is visible; ordinary questions are also available in the full review.
    rev=Path(wpath(cfg,'review'));rev.mkdir(exist_ok=True)
    parts=['<!doctype html><meta charset=utf-8><title>SAT import review</title><style>body{font:16px/1.55 Georgia;max-width:950px;margin:30px auto}article{border-top:2px solid #777;margin:24px 0;padding-top:16px}pre{white-space:pre-wrap;background:#f4f4f4;padding:12px}img{max-width:100%}summary{cursor:pointer}</style><h1>SAT import review</h1><p>Every imported item is listed with its source block and explanation. Inspect every figure and every flagged item; ordinary items can be sampled.</p>']
    mismatches=set(p3['geometry_mismatch']);exception_ids=[]
    for q in new:
        r=raw[q['id']];flags=list(r['flags'])
        if q['id'] in mismatches:flags.append('GEOMETRY MISMATCH')
        if q.get('ruleType'):flags.append('RULE TAG: '+q['ruleType'])
        if '\n\n' in q['passage']:flags.append('LAYOUT BREAKS')
        if flags:exception_ids.append(q['id'])
        parts.append('<article id="'+q['id']+'"><h2>'+q['id']+' · '+html.escape(q['skill'])+' · '+q['difficulty']+'</h2><p>'+html.escape(' | '.join(flags))+'</p><p>Source: '+html.escape(r['_pdf'])+' · PDF page '+str(r['_page']+1)+'</p>')
        if q.get('image'):parts.append('<img src="../out/'+q['image']+'" alt="'+html.escape(q['alt'],quote=True)+'">')
        else:parts.append(''.join('<p>'+html.escape(t).replace('&lt;u&gt;','<u>').replace('&lt;/u&gt;','</u>')+'</p>' for t in q['passage'].split('\n\n')))
        parts.append('<p><b>'+html.escape(q['question'])+'</b></p>'+''.join('<div>'+html.escape(o)+'</div>' for o in q['options'])+'<p><b>Answer '+q['answer']+'</b></p><p>'+html.escape(q['explanation'])+'</p><details><summary>Original source text</summary><pre>'+html.escape(r['_source_block'])+'</pre></details></article>')
    for qid,repair in cfg.get('existing_repairs',{}).items():
        r=raw[repair.get('source_id', qid)];q=current[qid]
        fields = list(repair['fields']) + (['psatDifficulty'] if repair.get('derive_psat_difficulty') else [])
        parts.append('<article id="repair-'+qid+'"><h2>Existing source repair: '+qid+'</h2><p>'+html.escape(repair['why'])+'</p><p>Source: '+html.escape(r['_pdf'])+' · PDF page '+str(r['_page']+1)+'</p>')
        for field in fields:
            parts.append('<h3>'+html.escape(field)+'</h3><p>Before: '+html.escape(str(old[qid].get(field)))+'</p><p>After: '+html.escape(str(q.get(field)))+'</p>')
        parts.append('<details><summary>Original source</summary><pre>'+html.escape(r['_source_block'])+'</pre></details></article>')
    (rev/'all-items.html').write_text('\n'.join(parts),encoding='utf-8')
    save(cfg,'review-items.json',{'all':[q['id'] for q in new],'exceptions':exception_ids,'figures':[q['id'] for q in new if q.get('image')]})
    return ok


def prepare_mirrors(cfg):
    import shutil, subprocess, tempfile
    manifest=load(cfg,'manifest.json'); staged=Path(wpath(cfg,'mirror-out'))
    if staged.exists():
        archive=Path(wpath(cfg,'build-archive'));archive.mkdir(exist_ok=True)
        import time
        if not staged.resolve().is_relative_to(Path(cfg['work_dir']).resolve()):raise SystemExit('STOP: unsafe mirror staging path')
        shutil.move(str(staged),str(archive/('mirror-'+str(time.time_ns()))))
    for index,m in enumerate(cfg.get('mirrors',[])):
        live=(Path(cfg['config_path']).parent/m['dir']).resolve();out=staged/str(index);out.mkdir(parents=True)
        for name in manifest['files_changed']:
            target=out/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(wpath(cfg,'out',name),target)
        for image in Path(wpath(cfg,'out',cfg['asset_dir'])).glob('*.png'):
            target=out/cfg['asset_dir']/image.name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(image,target)
        for name, source in m.get('test_overlays', {}).items():
            target = out / name
            if not target.resolve().is_relative_to(out.resolve()): raise SystemExit('STOP: unsafe mirror overlay path')
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(Path(cfg['config_path']).parent / source, target)
        for pattern in m.get('pages',['*.html']):
            for page in live.glob(pattern):
                text=page.read_bytes();eol='\r\n' if b'\r\n' in text else '\n';value=text.decode('utf-8').replace('\r\n','\n')
                changed=value
                for name in manifest['files_changed']:
                    changed=re.sub(re.escape(name)+r'\?v=\d{8}(?:&rev=[^"\s<>]+)?',name+'?v='+cfg['release_tag'],changed)
                if changed!=value:
                    target=out/page.relative_to(live);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(changed.replace('\n',eol).encode('utf-8'))
        with tempfile.TemporaryDirectory(prefix='sat-mirror-') as td:
            clone=Path(td)/'app';shutil.copytree(live,clone,ignore=shutil.ignore_patterns('.git','node_modules','*.pdf'))
            shutil.copytree(out,clone,dirs_exist_ok=True)
            env=dict(os.environ,NODE_PATH=cfg['node_modules'],JSDOM_PATH=str(Path(cfg['node_modules'])/'jsdom'))
            for test in m['tests']:
                r=subprocess.run([cfg['node'],test],cwd=clone,env=env,capture_output=True,encoding='utf-8',errors='replace')
                text=r.stdout+r.stderr
                Path(wpath(cfg,'review',f'mirror-{index}-tests.txt')).write_text(text,encoding='utf-8')
                if r.returncode or re.search(r'(?m)^SKIP',text):raise SystemExit('STOP: mirror test failed: '+text[-2000:])
                print('PASS mirror '+test)
