'use strict';
// Grammar class route: one guided path, free movement between questions, no student-side tutor fields,
// nothing that traps the class.
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
  const pick=(letter='A')=>w.document.querySelector('#gcOptions [data-letter="'+letter+'"]').click();
  const check=(letter='A')=>{pick(letter);click('gcLock');};
  return {w,dom,f,posts,el,click,pick,check,text:()=>w.document.getElementById('root').textContent,state:()=>JSON.parse(w.localStorage.getItem(key)),time:v=>{time=v;}};}

{ // home: one Start button, every step openable, no approval controls, card shown
  const h=harness();
  ok(h.el('gcGo')&&h.el('gcGo').textContent.startsWith('Start'),'single start button');
  ok(h.el('gcOpening')&&h.el('gcFamily0')&&h.el('gcFamily5')&&h.el('gcMixed'),'every step can be opened directly');
  ok(!h.el('gcAgreement')&&!h.el('gcApprove')&&!h.el('gcMixedOff'),'no readiness approvals and no timing decision');
  ok(h.w.document.querySelector('.ctable'),'label card on the home screen');
  h.dom.window.close();
}
{ // a check: move back and forward, change an answer, nothing marked until submit
  const h=harness();h.click('gcFamily0');h.click('gcChecks');
  ok(h.w.document.querySelectorAll('#gcOptions .copt').length===4,'options visible immediately');
  ok(!h.el('gcNote')&&!h.el('gcHelp')&&!h.el('gcSeen')&&!h.el('gcLock'),'no notes box, tutor fields or per-question check button');
  ok(h.el('gcQ0')&&h.el('gcQ1'),'numbered question buttons');ok(h.text().includes('Which structure decides it?'),'short cue shown');
  ok(!h.el('gcPrev'),'no Previous on the first question');
  h.pick('B');h.click('gcNext');ok(h.text().includes('Question 2 of 2'),'Next moves forward');
  h.click('gcPrev');ok(h.w.document.querySelector('#gcOptions .copt.sel').dataset.letter==='B','going back shows the chosen answer');
  h.pick('C');h.click('gcQ1');h.pick('A');
  ok(!h.text().includes('Not yet')&&!h.text().includes('Explanation for'),'nothing is marked before submitting');
  ok(h.state().blocks['f0-checks'].answers.length===0,'no answer is final before submitting');
  h.click('gcSubmit');
  const b=h.state().blocks['f0-checks'];
  ok(b.done&&b.answers.join()==='C,A','submitted answers are the final choices');
  ok(b.firstPick.join()==='B,A','first choices are kept');
  ok(h.posts[0].questions[0].firstChoice==='B'&&/first choice B, changed/.test(h.posts[0].questions[0].prediction),'a changed answer is logged for the tutor');
  ok(h.posts[0].questions[0].help==='unrecorded'&&h.posts[0].questions[0].recognised===null,'unknown help and recognition stay unknown');
  ok(h.text().includes('Explanation for'),'explanations shown after submitting');
  ok(h.el('gcRepair')&&h.el('gcNextStep'),'a miss offers a similar question, without forcing it');
  h.click('gcHome');h.click('gcFamily0');ok(!h.el('gcOptions'),'a submitted check opens as its review');
  h.dom.window.close();
}
{ // submitting with a gap asks once, then accepts
  const h=harness();h.click('gcFamily0');h.click('gcChecks');h.pick('A');h.click('gcNext');h.click('gcSubmit');
  ok(h.el('gcStatus').textContent.includes('1 question is unanswered'),'gap is flagged');ok(!h.state().blocks['f0-checks'].done,'not submitted on the first press');
  h.click('gcSubmit');ok(h.state().blocks['f0-checks'].done&&h.state().blocks['f0-checks'].answers[1]===null,'second press submits; the gap stays unanswered');
  h.dom.window.close();
}
{ // guided path: Start -> warm-up -> lesson -> examples (paged) -> check
  const h=harness();h.click('gcGo');h.check('A');h.click('gcNext');
  ok(h.state().blocks.opening.done,'warm-up finished');h.click('gcNextStep');
  ok(h.el('gcModels')&&h.text().includes('Cue 0'),'next step is section 1 lesson with its cue');
  h.click('gcModels');ok(!h.el('gcTime'),'worked examples are unclocked');
  h.check('B');ok(h.text().includes('Explanation for'),'worked example explains straight away');
  h.click('gcNext');h.click('gcPrev');ok(h.w.document.querySelector('.cbox, .class-review')&&!h.el('gcLock'),'can page back to an answered example');
  h.click('gcNext');h.check('A');h.click('gcNext');
  ok(h.el('gcTime')&&h.state().blocks['f0-checks'],'examples lead straight into the check');
  h.pick('A');h.click('gcNext');h.pick('A');h.click('gcSubmit');
  ok(!h.el('gcRepair')&&h.el('gcNextStep'),'all right: straight on to the next step');
  h.click('gcNextStep');ok(h.text().includes('Family 1'),'next step is section 2');
  h.click('gcHome');ok(h.el('gcGo').textContent.includes('Continue: Family 1'),'home continues where the class is');
  h.dom.window.close();
}
{ // mixed: fixed timer, free movement, feedback held, deadline survives reload, expiry submits what is chosen
  const h=harness();h.click('gcMixed');const deadline=h.state().blocks.mixed.deadline;
  ok(deadline===1000000+426000,'mixed starts on the set timer');ok(!h.el('gcNote'),'timed work needs no typing');
  h.pick('A');h.click('gcQ3');h.pick('D');h.click('gcQ0');ok(h.text().includes('Question 1 of 6'),'jump back to question 1');
  h.pick('B');ok(!h.text().includes('Explanation for'),'mixed feedback held until the end');
  h.click('gcHome');ok(h.el('gcFamily5'),'an active mixed check does not trap the class');
  const saved=JSON.stringify(h.state()),f=h.f;h.dom.window.close();
  const r=harness(f,saved,deadline-1000);r.click('gcMixed');
  ok(r.state().blocks.mixed.deadline===deadline,'original deadline survives reload');ok(r.w.document.querySelector('#gcOptions .copt.sel').dataset.letter==='B','choices survive reload');
  r.time(deadline+1);r.click('gcHome');r.click('gcMixed');
  const m=r.state().blocks.mixed;ok(m.expired&&m.done,'expiry submits the mixed check');
  ok(m.answers[0]==='B'&&m.answers[3]==='D'&&m.answers[1]===null,'expiry keeps the chosen answers and leaves gaps blank');
  ok(m.firstPick[0]==='A','first choice before the change is kept');
  ok(r.state().mixedRefs.length===6,'six-item denominator survives expiry');
  r.dom.window.close();
}
{ // no elapsed-time or score gates; similar question is untimed
  const h=harness();h.time(h.state().started+60*60000);h.click('gcFamily5');ok(h.el('gcModels')&&h.el('gcChecks'),'sections stay open after any elapsed time');
  h.click('gcChecks');h.pick();h.click('gcNext');h.pick();h.click('gcSubmit');ok(h.state().blocks['boundaries-checks'].done,'no score prerequisite');
  h.click('gcHome');h.click('gcFamily0');h.click('gcChecks');h.pick('C');h.click('gcNext');h.pick('A');h.click('gcSubmit');
  h.click('gcRepair');ok(!h.el('gcTime'),'similar question is untimed');h.check('A');
  ok(h.state().blocks['f0-reserve'].answers[0]==='A','similar question saved');h.click('gcNext');
  ok(h.text().includes('Similar question'),'section review includes the similar question');
  h.dom.window.close();
}
{ // the real 23 October route still resolves (SAT roster only)
  const dom=new JSDOM('',{runScripts:'outside-only'});dom.window.eval(read('challenge/sets.js'));
  const r=Object.values(dom.window.CHALLENGE_SETS).flat().find(r=>r.setId==='grammar-review-20261023');
  if(r){let bank=[];for(const [f,n]of [['data-conventions.js','CON'],['data-info-ideas.js','II'],['data-craft-structure.js','CS'],['data-expression-of-ideas.js','EOI']]){dom.window.eval(read(f)+';window.probeBank=questionBank_'+n);bank.push(...dom.window.probeBank);}
    const p=r.learningPath;for(const f of [...p.families,p.boundaries]){ok(f.checks.length===2,'both checks retained');ok(f.outcomes.every(o=>o.ids.some(id=>f.models.some(r=>r.bankId===id))),'both outcomes modelled');ok(f.outcomes.filter(o=>o.ids.some(id=>f.checks.some(r=>r.bankId===id))).length>=2,'checks cover both outcomes');}
    const refs=[p.opening,...p.families.flatMap(f=>[...f.models,...f.checks,f.reserve]),p.probe,...p.mixed,...p.boundaries.models,...p.boundaries.checks,p.boundaries.reserve,p.launch];
    ok(refs.every(r=>bank.some(q=>q.id===r.bankId)),'all references resolve');ok(!refs.some(r=>r.bankId==='b6de636f'),'contradictory bridge excluded');}
  dom.window.close();
}
console.log('ALL '+count+' ASSERTIONS PASSED — guided path, back/forward navigation, submit once, first choices kept, fixed mixed timer, reload');
