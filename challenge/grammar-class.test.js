'use strict';
// Grammar class route: one guided path, no student-side tutor fields, nothing that traps the class.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{JSDOM}=require('jsdom');
const APP=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(APP,f),'utf8');
let count=0;const ok=(v,m)=>{assert.ok(v,m);count++;};
function fixture(){let bank=[],next=0;const ref=()=>{const id='sample'+next++;bank.push({id,skill:'Form, Structure, and Sense',difficulty:'Medium',passage:'A sample clause.',question:'Choose the valid form.',options:['A. alpha','B. beta','C. gamma','D. delta'],answer:'A',explanation:'Explanation for '+id});return {bankId:id};};
  const families=Array.from({length:5},(_,i)=>({id:'f'+i,title:'Family '+i,models:[ref(),ref()],checks:[ref(),ref()],reserve:ref(),lesson:'Inspect both outcomes.',prompt:'Which structure decides it?',cue:'Cue '+i}));
  return {bank,set:{setId:'simple-test',title:'Test',learningPath:{grammarReview:true,opening:ref(),families,seconds:426,launch:ref(),probe:ref(),mixed:Array.from({length:6},()=>ref()),card:[['Side | side','Mark']],
    boundaries:{id:'boundaries',title:'Boundaries',models:[ref(),ref()],checks:[ref(),ref()],reserve:ref(),lesson:'Can each part stand as a sentence?',prompt:'Independent or dependent?'}}}};}
function harness(f=fixture(),saved,now=1000000){const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;let time=now;w.Date.now=()=>time;
  const ns=read('challenge/grammar-class.js').includes("ns='psat89_grammar_'")?'psat89_grammar_':'satrw_grammar_',key=ns+'Test_simple-test';if(saved)w.localStorage.setItem(key,saved);
  const posts=[];w.syncSessionToSheet=x=>posts.push(x);w.recordExposure=()=>{};w.recordAnswer=()=>{throw Error('No automatic mastery');};
  w.eval(read('challenge/grammar-class.js'));const ctx={student:'Test',...f,paint:x=>w.document.getElementById('root').innerHTML=x,header:()=>'',back:()=>{}};w.GrammarClass.render(ctx);
  const el=id=>w.document.getElementById(id),click=id=>{ok(!!el(id),'control '+id);el(id).click();};
  const answer=(letter='A')=>{w.document.querySelector('#gcOptions [data-letter="'+letter+'"]').click();click('gcLock');};
  return {w,dom,f,posts,el,click,answer,text:()=>w.document.getElementById('root').textContent,state:()=>JSON.parse(w.localStorage.getItem(key)),time:v=>time=v};}

{ // home: one Start button, every step openable, no approval controls, card shown
  const h=harness();
  ok(h.el('gcGo')&&h.el('gcGo').textContent.startsWith('Start'),'single start button');
  ok(h.el('gcOpening')&&h.el('gcFamily0')&&h.el('gcFamily5')&&h.el('gcMixed'),'every step can be opened directly');
  ok(!h.el('gcAgreement')&&!h.el('gcApprove')&&!h.el('gcMixedOff'),'no readiness approvals and no timing decision');
  ok(h.w.document.querySelector('.ctable'),'label card on the home screen');
  h.dom.window.close();
}
{ // question screen: options, Check, Next; no typing, no tutor dropdowns
  const h=harness();h.click('gcFamily0');h.click('gcChecks');
  ok(h.w.document.querySelectorAll('#gcOptions .copt').length===4,'options visible immediately');
  ok(!h.el('gcNote')&&!h.el('gcHelp')&&!h.el('gcSeen')&&!h.el('gcCommit'),'no notes box, tutor fields or commitment button');
  ok(h.text().includes('Which structure decides it?'),'short cue shown above the question');
  h.answer('B');ok(h.el('gcVerdict').textContent.includes('Not yet.'),'immediate right / not yet');
  ok(!h.el('gcVerdict').textContent.includes('Explanation for'),'explanations wait until the check is finished');
  h.click('gcNext');h.answer('A');h.click('gcNext');
  ok(h.state().blocks['f0-checks'].answers.join()==='B,A','first letters saved');
  ok(h.posts[0].questions[0].help==='unrecorded','missing help data is not fabricated');
  ok(h.posts[0].questions[0].recognised===null,'unknown recognition stays unknown');
  ok(h.text().includes('Explanation for'),'explanations shown once the check is done');
  ok(h.el('gcRepair')&&h.el('gcNextStep'),'a miss offers a similar question, without forcing it');
  h.click('gcHome');h.click('gcFamily0');ok(h.state().blocks['f0-checks'].answers[0]==='B','reopening shows the saved first answer');
  ok(!h.el('gcOptions'),'a finished check opens as its review');
  h.dom.window.close();
}
{ // guided path: Start -> warm-up -> section lesson -> example -> check, with no menu in between
  const h=harness();h.click('gcGo');h.answer('A');h.click('gcNext');
  ok(h.state().blocks.opening.done,'warm-up finished');h.click('gcNextStep');
  ok(h.el('gcModels')&&h.text().includes('Cue 0'),'next step is section 1 lesson with its cue');
  h.click('gcModels');ok(!h.el('gcTime'),'worked examples are unclocked');
  h.answer('A');h.click('gcNext');h.answer('A');h.click('gcNext');
  ok(h.el('gcTime')&&h.state().blocks['f0-checks'],'example leads straight into the check');
  h.answer('A');h.click('gcNext');h.answer('A');h.click('gcNext');
  ok(!h.el('gcRepair')&&h.el('gcNextStep'),'all right: straight on to the next step');
  h.click('gcNextStep');ok(h.text().includes('Family 1'),'next step is section 2');
  h.click('gcHome');ok(h.el('gcGo').textContent.includes('Continue: Family 1'),'home continues where the class is');
  h.dom.window.close();
}
{ // mixed: fixed timer, feedback held, deadline survives reload, expiry keeps first answers
  const h=harness();h.click('gcMixed');const deadline=h.state().blocks.mixed.deadline;
  ok(deadline===1000000+426000,'mixed starts on the set timer');
  ok(!h.el('gcNote'),'timed work needs no typing');h.answer();
  ok(!h.el('gcVerdict').textContent.includes('Right.'),'mixed feedback held until the end');
  h.click('gcNext');h.click('gcHome');ok(h.el('gcFamily5'),'an active mixed check does not trap the class');
  const saved=JSON.stringify(h.state()),f=h.f;h.dom.window.close();
  const r=harness(f,saved,deadline-1000);r.click('gcMixed');
  ok(r.state().blocks.mixed.deadline===deadline,'original deadline survives reload');
  r.time(deadline+1);r.click('gcHome');r.click('gcMixed');
  ok(r.state().blocks.mixed.expired,'expiry enforced when resuming');
  ok(r.state().blocks.mixed.answers[0]==='A','expiry keeps first answer');
  ok(r.state().mixedRefs.length===6,'six-item denominator survives expiry');
  r.dom.window.close();
}
{ // no elapsed-time or score gates; similar question is untimed
  const h=harness();h.time(h.state().started+60*60000);h.click('gcFamily5');ok(h.el('gcModels')&&h.el('gcChecks'),'sections stay open after any elapsed time');
  h.click('gcChecks');h.answer();h.click('gcNext');h.answer();h.click('gcNext');ok(h.state().blocks['boundaries-checks'].done,'no score prerequisite');
  h.click('gcHome');h.click('gcFamily0');h.click('gcChecks');h.answer('C');h.click('gcNext');h.answer('A');h.click('gcNext');
  h.click('gcRepair');ok(!h.el('gcTime'),'similar question is untimed');h.answer();
  ok(h.state().blocks['f0-reserve'].answers[0]==='A','similar question saved');h.click('gcNext');
  ok(h.text().includes('Similar question'),'section review includes the similar question');
  h.dom.window.close();
}
{ // the real 23 October route still resolves
  const dom=new JSDOM('',{runScripts:'outside-only'});dom.window.eval(read('challenge/sets.js'));
  const r=Object.values(dom.window.CHALLENGE_SETS).flat().find(r=>r.setId==='grammar-review-20261023');
  if(r){let bank=[];for(const [f,n]of [['data-conventions.js','CON'],['data-info-ideas.js','II'],['data-craft-structure.js','CS'],['data-expression-of-ideas.js','EOI']]){dom.window.eval(read(f)+';window.probeBank=questionBank_'+n);bank.push(...dom.window.probeBank);}
    const p=r.learningPath;for(const f of [...p.families,p.boundaries]){ok(f.checks.length===2,'both checks retained');ok(f.outcomes.every(o=>o.ids.some(id=>f.models.some(r=>r.bankId===id))),'both outcomes modelled');ok(f.outcomes.filter(o=>o.ids.some(id=>f.checks.some(r=>r.bankId===id))).length>=2,'checks cover both outcomes');}
    const refs=[p.opening,...p.families.flatMap(f=>[...f.models,...f.checks,f.reserve]),p.probe,...p.mixed,...p.boundaries.models,...p.boundaries.checks,p.boundaries.reserve,p.launch];
    ok(refs.every(r=>bank.some(q=>q.id===r.bankId)),'all references resolve');ok(!refs.some(r=>r.bankId==='b6de636f'),'contradictory bridge excluded');}
  dom.window.close();
}
console.log('ALL '+count+' ASSERTIONS PASSED — one guided path, no student-side tutor fields, fixed mixed timer, first answers and reload');
