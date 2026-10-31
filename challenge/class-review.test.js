'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{JSDOM}=require('jsdom');
const app=path.join(__dirname,'..');let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;};
function harness(saved){
 const w=new JSDOM('<div id="root"></div>',{url:'https://example.test',runScripts:'outside-only'}).window;let now=1000000;w.Date.now=()=>now;
 const bank=Array.from({length:9},(_,i)=>({id:'fixture'+i,passage:'Original passage '+i+' with <u>deciding words</u>.',question:'Which choice completes this question?',options:['A. one','B. two','C. three','D. four'],answer:'B',explanation:'The deciding structure.\n\nA separate explanation paragraph.'}));
 const ref=i=>({bankId:'fixture'+i}),set={setId:'review-clock-test',title:'Class practice',learningPath:{grammarReview:true,checkSeconds:90,seconds:284,opening:ref(0),families:[{id:'skill',title:'Section',lesson:'Look at the structure.',prompt:'State the structure.',models:[ref(1)],checks:[ref(2),ref(8)],reserve:ref(3)}],mixed:[ref(4),ref(5),ref(6),ref(7)]}};
 for(const f of ['class-review.js','grammar-class.js'])w.eval(fs.readFileSync(path.join(app,'challenge',f),'utf8'));
 const ns=fs.readFileSync(path.join(app,'challenge/grammar-class.js'),'utf8').includes("ns='psat89_grammar_'")?'psat89_grammar_':'satrw_grammar_',key=ns+'Test_'+set.setId;if(saved)w.localStorage.setItem(key,JSON.stringify(saved));
 w.recordExposure=()=>{};const posts=[];w.syncSessionToSheet=x=>posts.push(x);
 w.GrammarClass.render({student:'Test',set,bank,header:()=>'',paint:s=>w.document.getElementById('root').innerHTML=s,back:()=>{}});
 return {w,el:id=>w.document.getElementById(id),click:id=>{ok(!!w.document.getElementById(id),'control '+id);w.document.getElementById(id).click();},choose:l=>w.document.querySelector('[data-letter="'+l+'"]').click(),state:()=>JSON.parse(w.localStorage.getItem(key)),time:t=>{now=t;},posts};
}
{ // the check clock (90 s per question) survives reload; answers changed after it are kept and labelled
 const h=harness();h.click('gcFamily0');h.click('gcChecks');ok(h.el('gcTime').textContent.includes('3:00'),'90 seconds per question, shared across the check');
 const deadline=h.state().blocks['skill-checks'].deadline;h.choose('B');const saved=h.state();h.w.close();
 const r=harness(saved);r.time(deadline-1);r.click('gcFamily0');
 ok(r.state().blocks['skill-checks'].deadline===deadline,'reload resumes the check without restarting the clock');
 r.click('gcNext');r.time(deadline+1);r.click('gcPrev');ok(r.el('gcTime').textContent.includes('Time is up'),'time-up message shown');
 ok([...r.w.document.querySelectorAll('#gcOptions .copt')].every(b=>!b.disabled),'choices stay selectable after the limit');
 ok(r.state().blocks['skill-checks'].atDeadline.join()==='B,','selections at the limit recorded');
 r.click('gcNext');r.choose('C');r.click('gcSubmit');
 const b=r.state().blocks['skill-checks'];ok(b.answers.join()==='B,C','answers kept, including one chosen after the limit');
 ok(b.expiredItems[0]===false&&b.expiredItems[1]===true,'only the answer chosen after the limit is marked late');
 const card=r.w.document.querySelectorAll('.class-review')[1];ok(card,'review uses separate cards');
 ok(card.querySelector('.class-review__passage').textContent.includes('Original passage 8'),'question passage survives');
 ok(card.querySelector('.class-review__stem'),'question stem survives');ok(card.querySelectorAll('.class-review__option').length===4,'four distinct choices');
 ok(card.querySelector('u'),'underlining survives');ok(card.querySelector('.class-review__summary').textContent.includes('After the time limit'),'late answer is labelled');
 ok(!card.textContent.includes('No typed note'),'no typed-note reminder on grammar cards');
 const first=r.w.document.querySelector('.class-review');ok(first.querySelector('.is-correct.is-selected'),'answer markings are explicit');
 ok(first.querySelector('.class-review__explanation h4').textContent==='Explanation','explanation has own section');
 ok(first.querySelectorAll('.class-review__explanation p').length===2,'explanation paragraphs separated');
 ok(r.posts.length===1,'completion posts once');ok(r.posts[0].questions[1].late===true&&r.posts[0].questions[0].late===false,'late flags logged');
 r.w.close();
}
{ // mixed: one fixed timer, free movement, no leakage, every question in the review at expiry
 const h=harness();h.click('gcMixed');ok(h.el('gcTime').textContent.includes('4:44'),'normal mixed pace');ok(!h.el('gcNote'),'no typing in mixed work');
 h.choose('A');h.click('gcNext');h.click('gcPrev');ok(!h.w.document.querySelector('.class-review'),'no mixed answer leakage');
 const deadline=h.state().blocks.mixed.deadline;h.click('gcHome');h.time(deadline+1);h.click('gcMixed');
 ok(h.w.document.querySelectorAll('.class-review').length===4,'all mixed questions included at expiry');ok(h.state().blocks.mixed.answers[0]==='A','wrong answer retained');
 h.w.close();
}
{ // worked example: unclocked, single review card
 const h=harness();h.click('gcFamily0');h.click('gcModels');ok(!h.el('gcTime'),'models are unclocked');
 h.choose('B');h.click('gcLock');ok(h.w.document.querySelectorAll('.class-review').length===1,'one complete model review');ok(!h.el('gcOptions'),'model question is not duplicated above review');
 h.w.close();
}
console.log('ALL '+n+' ASSERTIONS PASSED - full-question review cards, shared check clock that never locks the choices');
