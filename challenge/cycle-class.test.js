'use strict';
// Mirrors the PSAT cycle-route test while exercising SAT-only opening, stop and table requirements.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
const APP=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(APP,f),'utf8');
const html=read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
let count=0;
function ok(c,m){assert.ok(c,m);count++;}
const SCRIPTS=['config.js','progress.js','sheet-sync.js','session-responses.js','storage.js','timer.js','history.js',
 'data-craft-structure.js','data-craft-structure-ext.js','data-expression-of-ideas.js','data-expression-of-ideas-ext.js',
 'data-info-ideas.js','data-info-ideas-ext.js','data-conventions.js','data-conventions-ext.js','eliminator.js','strategy-response.js',
 'app.js','homework/assignments.js','challenge/challenge-core.js','challenge/cycle-class.js','challenge/class-path.js','challenge/evidence-route.js','challenge/challenge.js'];
ok(SCRIPTS.filter(f=>f.startsWith('challenge/')||f.startsWith('homework/')).every(f=>read(f.startsWith('homework/')?'homework-hub.html':'index.html').includes('src="'+f+'?v=')),'the pages load every route script this test drives');

async function setup(saved,generic){
 const errors=[];
 const dom=new JSDOM(html,{url:'http://localhost/index.html',runScripts:'dangerously',beforeParse(w){
  w.__posts=[];w.fetch=(u,o)=>{try{w.__posts.push(JSON.parse(o.body));}catch(e){}return Promise.resolve({ok:true});};
  w.alert=()=>{};w.confirm=()=>true;w.scrollTo=()=>{};w.addEventListener('error',e=>errors.push(e.message));
 }});
 const w=dom.window,$=id=>w.document.getElementById(id);
 if(saved)Object.entries(saved).forEach(([k,v])=>w.localStorage.setItem(k,v));
 function inject(s){const e=w.document.createElement('script');e.textContent=s;w.document.body.appendChild(e);}
 inject(read('challenge/sets.js'));w.sessionStorage.setItem('mastery_user','Ayodeji');
 if(generic){const route=w.CHALLENGE_SETS.Ayodeji.at(-1);route.setId='cycle-runner-test';Object.assign(route.learningPath,{opening:null,spares:[],mixedInRoute:false,mixedSeconds:300,transferAfterSkip:null});}
 for(const f of SCRIPTS)inject(read(f));
 inject('window.__cycleBank=questionBank;window.__cyclePeek=function(){return {questions:activeQuestions,mode:userMode,timer:countdownRemaining,timerMode:timerMode,answers:responses};};window.__cycleExpire=function(){countdownRemaining=0;handleTimeUp();};');
 if(w.document.readyState==='loading')await new Promise(r=>w.document.addEventListener('DOMContentLoaded',r));
 const set=w.CHALLENGE_SETS.Ayodeji.at(-1),p=set.learningPath;
 const bank=id=>w.__cycleBank.find(q=>q.id===id||(q.altIds||[]).includes(id));
 function reason(value){$('ccReason').value=value||'the clause has no finite verb';$('ccReason').dispatchEvent(new w.Event('input'));$('ccCommit').click();}
 function choose(i){w.document.querySelector('#ccOptions [data-i="'+i+'"]').click();}
 function answer(ref,wrong,recognised){const q=bank(ref.bankId||ref);if(recognised){$('ccRecognised').checked=true;$('ccRecognised').dispatchEvent(new w.Event('change'));}reason();const right=q.answer.charCodeAt(0)-65;choose(wrong?(right+1)%4:right);$('ccLock').click();}
 function next(help){if($('ccHelp')&&!$('ccHelp').value){$('ccHelp').value=help||'none';$('ccHelp').dispatchEvent(new w.Event('change'));}$('ccNext').click();}
 function storage(){const out={};for(let i=0;i<w.localStorage.length;i++){const k=w.localStorage.key(i);out[k]=w.localStorage.getItem(k);}return out;}
 function close(){ok(errors.length===0,'no browser runtime errors: '+errors.join('; '));dom.window.close();}
 w.openChallenge();return {w,$,set,p,bank,answer,next,reason,storage,close};
}
function screen(t){return t.$('challengeScreen').textContent;}

async function main(){
 let t=await setup(),{w,$,set,p}=t;
 ok(set.setId==='verb-tense-cycles-20261017','the 17 October cycle route is the current route');
 const refs=[p.opening].concat(p.cycles.flatMap(c=>[c.model].concat(c.checks)),p.spares,p.transfer.map(id=>({bankId:id})));
 ok(refs.every(r=>t.bank(r.bankId)),'every opening, cycle, spare and mixed id resolves in the SAT bank');
 ok(p.cycles.length===2&&p.cycles.every(c=>c.checks.length===3),'two cycles carry exactly three checks each');
 ok(p.mixedInRoute&&p.protectedTransfer&&p.singleCredit&&p.mixedSeconds===0,'the mixed check is protected, unclocked and single-credit');
 ok(set.ids.join()===p.transfer.join()&&p.transfer.length===4,'the four mixed items are the scored list');
 ok(p.transferAfterSkip.join()==='f4fd123c,b74f676f,145da981','the stop branch drops only the tense item');
 ok(p.cycles[1].checks[2].bankId==='035fd57e'&&t.bank('035fd57e').answer==='A'&&t.bank('035fd57e').options.some(x=>/had included/.test(x)),'the added Easy tense check has the wrong past-perfect trap');

 ok($('ccOpening')&&!$('ccCycle0')&&!$('ccOff'),'opening retrieval gates both teaching and mixed work');
 $('ccOpening').click();
 ok($('ccOptions').style.display==='none'&&screen(t).includes('Head subject? Singular or plural?'),'the exact agreement method prompt precedes the choices');
 t.answer(p.opening,false,true);ok(/right/i.test($('ccFeedback').textContent),'opening feedback is immediate');t.next('process');
 ok($('ccCycle0')&&!$('ccCycle1'),'Cycle 1 opens after retrieval and Cycle 2 still waits');

 $('ccCycle0').click();
 ok(screen(t).includes('Does this clause already have its main verb? Yes/No — which verb?')&&$('ccOptions').style.display==='none','the exact verb-form prompt appears before choices');
 t.answer(p.cycles[0].model);ok($('ccFeedback').textContent.includes('Your method notes'),'the model explains immediately without mastery credit');t.next();
 const c1=p.cycles[0].checks;
 t.answer(c1[0]);ok(/Right\./.test($('ccFeedback').textContent)&&!$('ccFeedback').textContent.includes('Your choice'),'a correct cycle check says Right immediately but holds explanation');t.next();
 t.answer(c1[1],true);ok(/Not yet\./.test($('ccFeedback').textContent)&&!$('ccFeedback').textContent.includes('Your choice'),'an incorrect cycle check says Not yet immediately but holds explanation');t.next('direction');
 t.answer(c1[2]);t.next();
 ok(screen(t).includes('2 of 3 right')&&screen(t).includes('Your choice'),'all explanations appear only after all three checks');
 ok(!w.getProgress().ec08463d&&!w.getProgress()['4a90a978'],'models and grouped checks carry no mastery credit');
 $('ccHome').click();
 ok($('ccOff')&&$('ccSpare0')&&!$('ccTimed'),'the tutor can open spares and the mixed check is unclocked');

 $('ccCycle1').click();
 ok(screen(t).includes('Time anchor? Same time, or earlier than it?'),'the exact tense prompt appears before choices');
 t.answer(p.cycles[1].model);t.next();p.cycles[1].checks.forEach(q=>{t.answer(q);t.next();});
 ok(screen(t).includes('3 of 3 right'),'Cycle 2 completes at three of three');$('ccHome').click();$('ccOff').click();
 ok(screen(t).includes('Mixed check · unlabelled')&&!screen(t).includes('Right.')&&!screen(t).includes('Not yet.'),'the mixed check is unlabelled and withholds verdicts');
 for(let i=0;i<3;i++){t.answer(p.transfer[i]);ok($('ccFeedback').textContent.includes('Results come after'),'mixed answers reveal no correctness');t.next();}
 ok(w.document.querySelectorAll('.ctable').length===1&&w.document.querySelectorAll('.ctable tbody tr').length===5,'the data item renders as a semantic five-row table');
 ok(w.document.querySelector('.ctable caption').textContent.includes('Paywall Introduction')&&!w.document.querySelector('.cq img'),'the table has a caption and does not fall back to the bank image');
 ok(screen(t).includes('What comparison does the claim need? Which values?'),'the data method prompt appears before its choices');
 t.answer(p.transfer[3]);t.next();
 ok(screen(t).includes('Mixed check: 4 of 4 right')&&screen(t).includes('Your choice'),'mixed results and explanations appear together at the end');
 ok(p.transfer.every(id=>w.getProgress()[id]&&w.getProgress()[id].correct===1),'each successful mixed item earns exactly one class-transfer credit');
 const posts=w.__posts.filter(x=>x.type==='class-route');
 ok(w.__posts.every(x=>x.sessionId&&x.assignmentId===set.setId)&&new Set(w.__posts.map(x=>x.sessionId)).size===w.__posts.length,'each completed block carries a distinct stable session ID and the route identity');
 ok(w.__posts.flatMap(x=>x.questions).every(q=>q.difficulty===t.bank(q.id).difficulty),'SAT logging uses SAT difficulty labels');
 ok(w.__posts.some(x=>x.type==='class-transfer'&&x.questions.length===4),'the mixed block is logged as class transfer');
 ok(posts.some(x=>x.questions.some(q=>q.recognised&&q.help==='process'))&&posts.every(x=>x.questions.every(q=>/Conditions: help:/.test(q.prediction))),'mocked class logging records help and recognition');
 const done=t.storage();t.close();
 t=await setup(done);ok(!t.$('ccOff')&&!t.$('ccTimed')&&screen(t).includes('Class route complete'),'reload cannot replay a completed mixed check');t.close();

 // Stop branch: 0–1/3 in Cycle 1 permits Cycle 2 to be skipped and opens three mixed items.
 t=await setup();({w,$,p}=t);$('ccOpening').click();t.answer(p.opening);t.next();$('ccCycle0').click();t.answer(p.cycles[0].model);t.next();
 p.cycles[0].checks.forEach((q,i)=>{t.answer(q,i<2);t.next();});
 ok(screen(t).includes('1 of 3 right')&&$('ccSkip'),'the 0–1/3 stop rule offers a tutor-controlled Cycle 2 skip');$('ccSkip').click();
 ok(!$('ccCycle1')&&screen(t).includes('skipped today')&&$('ccSpare0'),'Cycle 2 stays skipped while tutor-opened spares remain available');
 $('ccSpare0').click();t.answer(p.spares[0]);t.next();ok(screen(t).includes('review spare 1'),'a spare can be opened only from the tutor route control');
 $('ccOff').click();let seen=[];
 for(let i=0;i<3;i++){seen.push(screen(t));t.answer(p.transferAfterSkip[i]);t.next();}
 ok(seen.length===3&&!seen.some(s=>s.includes(t.bank('67614549').passage.slice(0,32)))&&screen(t).includes('Mixed check: 3 of 3 right'),'the fallback mixed check contains three items and omits tense');
 t.close();
 // The original PSAT transfer mechanism also works in SAT: timed, resumed and clock-off.
 t=await setup(null,true);({w,$,p}=t);$('ccCycle0').click();t.answer(p.cycles[0].model);t.next();
 p.cycles[0].checks.forEach(q=>{t.answer(q);t.next();});$('ccHome').click();
 $('ccCycle1').click();t.answer(p.cycles[1].model);t.next();p.cycles[1].checks.forEach(q=>{t.answer(q);t.next();});$('ccHome').click();
 ok($('ccTimed'),'the port retains the original earned timed-transfer gate');$('ccTimed').click();let peek=w.__cyclePeek();
 ok(peek.mode==='exam'&&peek.timer===300&&peek.questions.map(q=>q.id).join()===p.transfer.join(),'the original timed runner receives the exact frozen transfer set');
 w.handleOptionClick(null,peek.questions[0].answer,peek.questions[0]);w.saveSessionState();const partial=t.storage();t.close();
 t=await setup(partial,true);({w,$,p}=t);ok($('ccResume'),'a partial transfer has a resume control');$('ccResume').click();peek=w.__cyclePeek();
 ok(peek.questions.length===4&&peek.mode==='exam','the port restores the original silent runner');w.__cycleExpire();
 ok($('cReturnToRoute')&&w.getProgress()[p.transfer[0]].correct===1&&!w.getProgress()[p.transfer[1]],'the original runner awards one credit only to the answered transfer item');
 $('cReturnToRoute').click();ok(screen(t).includes('Class route complete')&&!$('ccOff'),'the original runner completes the cycle route once');t.close();
 t=await setup(null,true);({w,$,p}=t);$('ccCycle0').click();t.answer(p.cycles[0].model);t.next();p.cycles[0].checks.forEach(q=>{t.answer(q,true);t.next();});$('ccSkip').click();$('ccOff').click();peek=w.__cyclePeek();
 ok(peek.timerMode==='off'&&$('timerDisplay').classList.contains('hidden'),'the original clock-off transfer actually disables the timer in SAT');t.close();
}
main().then(()=>console.log('ALL '+count+' ASSERTIONS PASSED')).catch(e=>{console.error(e);process.exit(1);});
