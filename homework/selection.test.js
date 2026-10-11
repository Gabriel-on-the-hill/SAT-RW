// Exact targeting, conservative exposure imports and sitting integrity. Requires jsdom.
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
const S=require('./selection.js'),APP=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(APP,f),'utf8');
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
const q=(id,rule='SVA',difficulty='Medium')=>({id,altIds:[id+'-alias'],skill:'Form, Structure, and Sense',ruleType:rule,difficulty,psatDifficulty:difficulty,
  origin:'cb-sat',passage:'Passage '+id+'. The teachers _____ pleased.',question:'Which choice completes the text?',options:['A. are','B. is','C. was','D. be'],answer:'A',explanation:'The plural subject takes are.'});
const bank=[q('a'),q('b'),q('c'),q('d'),q('e'),q('tense','VTense'),q('hard','SVA','Hard')];
const slot=(id='a',reserves=['b','c'])=>({skills:['Form, Structure, and Sense'],diffs:['Medium'],ruleType:'SVA',intent:'fresh',preferredId:id,reserveIds:reserves,allowPool:false});
check('new exposure under an alias triggers the first matching reserve',()=>assert.equal(S.resolve(bank,[slot('a',['tense','hard','b'])],{seen:{'a-alias':true}}).entries[0].id,'b'));
check('wrong-rule and wrong-difficulty reserves never broaden the target',()=>assert.equal(S.resolve(bank,[slot('a',['tense','hard'])],{seen:['a']}).complete,false));
check('held aliases and duplicates are excluded across slots',()=>{
  const r=S.resolve(bank,[slot(),slot('a',['b','c'])],{held:['a-alias']});assert.deepEqual(r.entries.map(e=>e.id),['b','c']);
});
check('review and follow-up explicitly permit repeats',()=>['review','follow-up'].forEach(intent=>assert.equal(S.resolve(bank,[{...slot(),intent}],{seen:['a']}).entries[0].id,'a')));
check('same-pool fallback needs explicit opt-in and remains fresh',()=>{
  assert.equal(S.resolve(bank,[slot('a',[])],{seen:['a']}).complete,false);
  assert.equal(S.resolve(bank,[{...slot('a',[]),allowPool:true}],{seen:['a','b']}).entries[0].id,'c');
});
check('locked answers and timed questions remain fixed after new exposure',()=>assert.equal(S.resolve(bank,[slot()],{previous:['a'],locked:[true],seen:['a'],held:['a']}).entries[0].id,'a'));
check('unverified and incomplete items cannot be selected',()=>assert.equal(S.resolve([{...q('a'),origin:'generated'}],[slot('a',[])]).complete,false));
check('CSV imports isolate students, preserve aliases and parse quoted newlines',()=>{
  const r=S.importHistory('Student,Question ID,Timestamp,Note\r\nOther,b,10/10/2026,x\r\n__TEST__,a-alias,10/11/2026,"text, with\nnewline"\r\n__TEST__,external,10/11/2026,x','__TEST__',bank);
  assert.deepEqual(r.ids,['a','external']);assert.deepEqual(r.unknown,['external']);assert.equal(r.rows,2);
  assert.throws(()=>S.importHistory('Student,Question ID\nOther,a','__TEST__',bank));
  assert.throws(()=>S.importHistory('{"format":"homework-exposure-v1","student":"Other","ids":["a"]}','__TEST__',bank));
});
const raw=read('homework-run.html'),html=raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
const inline=[...raw.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
const prefix=raw.includes("prefix:'psat89'")?'psat89':'satrw';
const userKey=prefix==='satrw'?'mastery_user':'psat89_user';
function build(minutes=0,saved={},slots=[slot(),slot('d',['e'])],now=Date.UTC(2026,9,11,12),mode='',startUntimed=true){
  const dom=new JSDOM(html,{url:'https://test.local/homework-run.html?student=__TEST__&day=1'+(mode?'&mode='+mode:''),runScripts:'dangerously'}),w=dom.window;
  w.scrollTo=()=>{};w.alert=()=>{};w.confirm=()=>true;w.__posts=[];w.fetch=(url,opt)=>{w.__posts.push(JSON.parse(opt.body));return Promise.resolve({ok:true});};
  w.Date.now=()=>now;w.setInterval=()=>1;w.clearInterval=()=>{};
  w.sessionStorage.setItem(userKey,'__TEST__');Object.entries(saved).forEach(([k,v])=>w.localStorage.setItem(k,v));
  function inject(s){const el=w.document.createElement('script');el.textContent=s;w.document.body.appendChild(el);}
  inject('const questionBank_CON='+JSON.stringify(bank)+';');
  ['progress.js','homework/selection.js','homework/sitting.js','eliminator.js'].forEach(f=>inject(read(f)));
  const plan={start:'2020-01-01',version:'test-v1',review:0,days:[{n:1,focus:'Agreement',minutes,review:0,slots,tip:'Predict first.'}]};
  w.hwLoadPlan=(student,cb)=>cb(plan);w.hwDayOpen=()=>true;w.SHEET_SYNC_ENDPOINT='https://logs.local';
  inject(inline);
  if(minutes===0 && startUntimed && !mode && w.document.getElementById('hwStart'))w.document.getElementById('hwStart').click();
  return {dom,w,advance(ms){now+=ms;},store(){const o={};for(let i=0;i<w.localStorage.length;i++){const k=w.localStorage.key(i);o[k]=w.localStorage.getItem(k);}return o;},
    state(){return JSON.parse(w.localStorage.getItem(prefix+'_hwsitting___TEST___2020-01-01_1'));},close(){dom.window.close();}};
}
function answer(b){
  b.advance(46000);const w=b.w;w.document.getElementById('predText').value='plural subject';w.document.getElementById('predGo').click();
  w.document.querySelector('.opt').click();w.document.getElementById('submit').click();
}
check('untimed recognition replaces without a mastery answer; reload keeps the replacement',()=>{
  const b=build();b.w.document.getElementById('recognized').click();assert.equal(b.state().entries[0].id,'b');
  assert.equal(Object.keys(b.w.getProgress()).length,0);assert.equal(b.state().events[0].reason,'recognized');
  const saved=b.store();b.close();const resumed=build(0,saved);assert.equal(resumed.state().entries[0].id,'b');resumed.close();
});
check('untimed history can be updated before the first question is displayed',()=>{
  const b=build(0,{},undefined,undefined,'',false);assert.equal(b.w.document.querySelector('#opts'),null);
  assert(b.w.document.getElementById('hwHistoryFile'));b.w.HomeworkSelection.saveImport(prefix,'__TEST__',{ids:['a'],latest:'newer export'});
  b.w.document.getElementById('hwStart').click();assert.equal(b.state().entries[0].id,'b');b.close();
});
check('committed untimed answer and prediction survive reload and are not replaced',()=>{
  const b=build();answer(b);const before=b.state().records[0];b.w.document.getElementById('recognized').click();
  assert.equal(b.state().entries[0].id,'a');assert.equal(b.state().records[0].chosen,'A');
  const saved=b.store();b.close();const resumed=build(0,saved);assert.equal(resumed.state().records[0].chosen,before.chosen);
  assert.equal(resumed.state().nav[0].prediction,'plural subject');assert.equal(resumed.w.document.querySelector('#predict'),null);resumed.close();
});
check('an untimed selection can still be replaced before Submit commits it',()=>{
  const b=build();b.advance(46000);b.w.document.getElementById('predText').value='plural';b.w.document.getElementById('predGo').click();
  b.w.document.querySelector('.opt').click();b.w.document.getElementById('recognized').click();assert.equal(b.state().entries[0].id,'b');
  assert.equal(Object.keys(b.w.getProgress()).length,0);b.close();
});
check('new private import after setting homework replaces only unanswered slots',()=>{
  const b=build();answer(b);b.w.HomeworkSelection.saveImport(prefix,'__TEST__',{ids:['a','d'],latest:'later export'});
  const saved=b.store();b.close();const resumed=build(0,saved);assert.deepEqual(resumed.state().entries.map(e=>e.id),['a','e']);
  assert.equal(resumed.state().records[0].chosen,'A');resumed.close();
});
check('exhaustion preserves requested count, allows other untimed work and cannot complete',()=>{
  const b=build(0,{[prefix+'_hw_history___TEST__']:JSON.stringify({ids:['a','b','c']})});
  assert.equal(b.state().entries.length,2);assert.equal(b.state().entries[0].id,null);
  b.w.document.getElementById('pendingNext').click();answer(b);b.w.document.getElementById('next').click();
  assert.equal(b.w.localStorage.getItem(prefix+'_hw___TEST___2020-01-01_1'),null);assert.equal(b.state().finished,false);b.close();
});
check('timed preflight does not start the clock and refuses unresolved slots',()=>{
  const b=build(2,{[prefix+'_hw_history___TEST__']:JSON.stringify({ids:['a','b','c']})});
  assert.equal(b.state().deadline,null);assert.equal(b.w.document.getElementById('hwStart').disabled,true);assert.equal(b.w.document.querySelector('#opts'),null);b.close();
});
check('timed recognition annotates without swapping; reload preserves the original deadline',()=>{
  const now=Date.UTC(2026,9,11,12),b=build(2,undefined,undefined,now);b.w.document.getElementById('hwStart').click();
  const deadline=b.state().deadline;b.w.document.getElementById('recognized').click();assert.equal(b.state().entries[0].id,'a');
  assert.equal(b.state().nav[0].recognized,true);assert.equal(Object.keys(b.w.getProgress()).length,0);
  const saved=b.store();b.close();const resumed=build(2,saved,undefined,now+30000);assert.equal(resumed.state().deadline,deadline);
  assert.equal(resumed.w.document.getElementById('timer').textContent,'1:30');resumed.close();
});
check('finished precise sets reopen as review, without drawing another set',()=>{
  const b=build(0,{},[slot()]);answer(b);b.w.document.getElementById('next').click();assert.equal(b.state().finished,true);
  const saved=b.store();b.close();const resumed=build(0,saved,[slot()]);assert(resumed.w.document.getElementById('run').classList.contains('hidden'));resumed.close();
});
check('a partial set keeps the full requested count and its committed work can be reviewed',()=>{
  const b=build();answer(b);assert.equal(b.state().records.length,2);
  const saved=b.store();b.close();const reviewed=build(0,saved,undefined,undefined,'review');
  assert.equal(reviewed.w.document.getElementById('finish').classList.contains('hidden'),false);reviewed.close();
});
check('recognition logs carry no answer and no scored credit',()=>{
  const b=build();b.w.document.getElementById('recognized').click();const event=b.w.__posts[0];assert.equal(event.type,'review');assert.equal(event.questions[0].chosen,null);assert.equal(event.score,'');b.close();
});
check('timed recognized answers remain in the result and are excluded from fresh mastery',()=>{
  const b=build(2,{},[slot()]);b.w.document.getElementById('hwStart').click();b.w.document.getElementById('recognized').click();
  b.w.document.getElementById('predGo').click();b.w.document.querySelector('.opt').click();b.w.document.getElementById('next').click();
  b.w.document.getElementById('hwRevSubmit').click();const post=b.w.__posts.find(p=>p.type==='homework');
  assert.equal(post.score,1);assert.equal(post.selection.freshAnswered,0);assert.equal(Object.keys(b.w.getProgress()).length,0);b.close();
});
check('page exit grades an answered precise timed set before logging completion',()=>{
  const b=build(2,{},[slot()]);b.w.document.getElementById('hwStart').click();b.w.document.getElementById('predGo').click();
  b.w.document.querySelector('.opt').click();b.w.dispatchEvent(new b.w.Event('pagehide'));
  assert.equal(b.state().finished,true);assert.equal(b.w.__posts.find(p=>p.type==='homework').score,1);b.close();
});
check('builder exports exact slots and validates method and reserves',()=>{
  const raw=read('assign.html'),doc=raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  const dom=new JSDOM(doc,{url:'https://test.local/assign.html',runScripts:'dangerously'}),w=dom.window;
  function inject(s){const e=w.document.createElement('script');e.textContent=s;w.document.body.appendChild(e);}
  inject('const questionBank_CON='+JSON.stringify(bank)+';');inject(read('homework/selection.js'));inject(read('homework/builder.js'));
  for(const [id,v] of Object.entries({student:'__TEST__',start:'2026-10-11',through:'2026-10-15'})){w.document.getElementById(id).value=v;}
  const focus=w.document.querySelector('.focus');focus.value='Agreement';focus.dispatchEvent(new w.Event('input',{bubbles:true}));
  w.document.getElementById('autoPick').click();w.document.getElementById('gen').click();
  assert.equal(w.document.getElementById('output').hidden,false);
  const output=w.document.getElementById('js').value,plan=JSON.parse(output.slice(output.indexOf(':')+1,-1));
  assert.equal(plan.days[0].slots[0].ruleType,'SVA');assert.equal(plan.days[0].slots[0].reserveIds.length,2);assert.equal(plan.review,0);
  const reserve=w.document.querySelector('.reserveIds');reserve.value='tense';reserve.dispatchEvent(new w.Event('input',{bubbles:true}));w.document.getElementById('gen').click();
  assert.equal(w.document.getElementById('output').hidden,true);assert(w.document.getElementById('audit').textContent.includes('does not match'));dom.window.close();
});
check('the real bank and protected baseline forms produce a valid SVA assignment',()=>{
  const raw=read('assign.html'),doc=raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  const dom=new JSDOM(doc,{url:'https://test.local/assign.html',runScripts:'dangerously'}),w=dom.window;
  const scripts=[...raw.matchAll(/<script\s+src="([^"?]+)/g)].map(m=>m[1]).filter(f=>!['gate.js','ns-migrate.js'].includes(f));
  for(const file of scripts){const s=w.document.createElement('script');s.textContent=read(file);w.document.body.appendChild(s);}
  for(const [id,v] of Object.entries({student:'__TEST__',start:'2026-10-11',through:'2026-10-15'}))w.document.getElementById(id).value=v;
  const focus=w.document.querySelector('.focus');focus.value='Agreement';focus.dispatchEvent(new w.Event('input',{bubbles:true}));
  w.document.getElementById('autoPick').click();w.document.getElementById('gen').click();
  assert.equal(w.document.getElementById('output').hidden,false,w.document.getElementById('audit').textContent);
  const output=w.document.getElementById('js').value,plan=JSON.parse(output.slice(output.indexOf(':')+1,-1)),s=plan.days[0].slots[0];
  assert.equal(s.ruleType,'SVA');assert.equal(s.reserveIds.length,2);assert.equal(new Set([s.preferredId,...s.reserveIds]).size,3);dom.window.close();
});
console.log('ALL '+checks+' CHECKS PASSED');
