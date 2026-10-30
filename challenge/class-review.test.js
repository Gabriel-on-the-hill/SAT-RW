'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{JSDOM}=require('jsdom');
const app=path.join(__dirname,'..');let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;};
function harness(saved){
 const w=new JSDOM('<div id="root"></div>',{url:'https://example.test',runScripts:'outside-only'}).window;let now=1000000;w.Date.now=()=>now;
 const bank=Array.from({length:8},(_,i)=>({id:'fixture'+i,passage:'Original passage '+i+' with <u>deciding words</u>.',question:'Which choice completes this question?',options:['A. one','B. two','C. three','D. four'],answer:'B',explanation:'The deciding structure.\n\nA separate explanation paragraph.'}));
 const ref=i=>({bankId:'fixture'+i}),set={setId:'review-clock-test',title:'Class practice',learningPath:{grammarReview:true,checkSeconds:90,seconds:284,opening:ref(0),families:[{id:'skill',title:'Section',lesson:'Look at the structure.',prompt:'State the structure.',models:[ref(1)],checks:[ref(2)],reserve:ref(3)}],mixed:[ref(4),ref(5),ref(6),ref(7)]}};
 for(const f of ['class-review.js','grammar-class.js'])w.eval(fs.readFileSync(path.join(app,'challenge',f),'utf8'));
 const ns=fs.readFileSync(path.join(app,'challenge/grammar-class.js'),'utf8').includes("ns='psat89_grammar_'")?'psat89_grammar_':'satrw_grammar_',key=ns+'Test_'+set.setId;if(saved)w.localStorage.setItem(key,JSON.stringify(saved));
 w.recordExposure=()=>{};const posts=[];w.syncSessionToSheet=x=>posts.push(x);
 w.GrammarClass.render({student:'Test',set,bank,header:()=>'',paint:s=>w.document.getElementById('root').innerHTML=s,back:()=>{}});
 return {w,el:id=>w.document.getElementById(id),click:id=>{ok(!!w.document.getElementById(id),'control '+id);w.document.getElementById(id).click();},choose:l=>w.document.querySelector('[data-letter="'+l+'"]').click(),state:()=>JSON.parse(w.localStorage.getItem(key)),time:t=>now=t,posts};
}
{ // 90-second clock survives reload; an answer given at or after the limit is kept and marked
 const h=harness();h.click('gcFamily0');h.click('gcChecks');ok(h.el('gcTime').textContent.includes('1:30'),'90 seconds per independent question');
 const deadline=h.state().blocks['skill-checks'].itemDeadlines[0];h.choose('B');const saved=h.state();h.w.close();
 const r=harness(saved);r.time(deadline-1);r.click('gcFamily0');
 ok(r.state().blocks['skill-checks'].itemDeadlines[0]===deadline,'reload resumes the check without restarting the deadline');
 r.time(deadline+1);r.click('gcLock');ok(r.state().blocks['skill-checks'].answers[0]==='B','selected answer kept after the limit');
 ok(r.state().blocks['skill-checks'].expiredItems[0]===true,'answer marked as over time');r.click('gcNext');
 const card=r.w.document.querySelector('.class-review');ok(card,'review uses separate card');
 ok(card.querySelector('.class-review__passage').textContent.includes('Original passage 2'),'question passage survives');
 ok(card.querySelector('.class-review__stem'),'question stem survives');ok(card.querySelectorAll('.class-review__option').length===4,'four distinct choices');
 ok(card.querySelector('u'),'underlining survives');ok(card.querySelector('.is-correct.is-selected'),'answer markings are explicit');
 ok(card.querySelector('.class-review__summary').textContent.includes('After the time limit'),'over-time answer is labelled');
 ok(!card.textContent.includes('No typed note'),'no typed-note reminder on grammar cards');
 ok(card.querySelector('.class-review__explanation h4').textContent==='Explanation','explanation has own section');
 ok(card.querySelectorAll('.class-review__explanation p').length===2,'explanation paragraphs separated');
 ok(r.posts.length===1,'completion posts once');ok(r.posts[0].questions[0].seconds===90,'seconds logged');ok(r.posts[0].questions[0].late===true,'late flag logged');
 r.w.close();
}
{ // time running out never locks the choices
 const h=harness();h.click('gcFamily0');h.click('gcChecks');const deadline=h.state().blocks['skill-checks'].itemDeadlines[0];
 h.time(deadline+1);h.click('gcHome');h.click('gcFamily0');
 ok(h.el('gcTime').textContent.includes('Time is up'),'time-up message shown');
 ok([...h.w.document.querySelectorAll('#gcOptions .copt')].every(b=>!b.disabled),'choices stay selectable after the limit');
 h.click('gcLock');ok(h.state().blocks['skill-checks'].answers[0]===undefined,'no answer is invented');
 ok(h.state().blocks['skill-checks'].atDeadline[0]===null,'nothing selected at the limit is recorded');
 h.choose('C');h.click('gcLock');ok(h.state().blocks['skill-checks'].answers[0]==='C','late answer accepted');
 h.click('gcNext');ok(h.w.document.querySelector('.class-review__head').textContent.includes('Review this answer'),'review shows the late answer');
 h.w.close();
}
{ // mixed: one fixed timer, no leakage, every question in the review at expiry
 const h=harness();h.click('gcMixed');ok(h.el('gcTime').textContent.includes('4:44'),'normal mixed pace');ok(!h.el('gcNote'),'no typing in mixed work');
 h.choose('A');h.click('gcLock');ok(!h.w.document.querySelector('.class-review'),'no mixed answer leakage');
 const deadline=h.state().blocks.mixed.deadline;h.click('gcHome');h.time(deadline+1);h.click('gcMixed');
 ok(h.w.document.querySelectorAll('.class-review').length===4,'all mixed questions included at expiry');ok(h.state().blocks.mixed.answers[0]==='A','wrong first answer retained');
 h.w.close();
}
{ // worked example: unclocked, single review card
 const h=harness();h.click('gcFamily0');h.click('gcModels');ok(!h.el('gcTime'),'models are unclocked');
 h.choose('B');h.click('gcLock');ok(h.w.document.querySelectorAll('.class-review').length===1,'one complete model review');ok(!h.el('gcOptions'),'model question is not duplicated above review');
 h.w.close();
}
console.log('ALL '+n+' ASSERTIONS PASSED - full-question review cards and 90-second checks that never lock the choices');
