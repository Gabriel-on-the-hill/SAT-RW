'use strict';
const assert=require('assert/strict'), fs=require('fs'), path=require('path');
const {JSDOM}=require('jsdom');
const APP=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(APP,f),'utf8');
let count=0;
function ok(c,m){assert.ok(c,m);count++;}
const html=read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
const dom=new JSDOM(html,{url:'http://localhost/index.html',runScripts:'dangerously',beforeParse(w){w.fetch=()=>Promise.resolve({ok:true});w.alert=()=>{};w.confirm=()=>true;w.scrollTo=()=>{};}});
const w=dom.window, $=id=>w.document.getElementById(id);
const USER_KEY=/sessionStorage.getItem\('([^']+)'\)/.exec(read('challenge/challenge.js'))[1];
function inject(s){const e=w.document.createElement('script');e.textContent=s;w.document.body.appendChild(e);}
for(const f of ['config.js','progress.js','sheet-sync.js','session-responses.js','storage.js','timer.js','history.js','data-craft-structure.js','data-expression-of-ideas.js','data-info-ideas.js','data-conventions.js','app.js','challenge/sets.js'])inject(read(f));
inject('window.__peek=function(){return {questions:activeQuestions,mode:userMode,timer:countdownRemaining,bank:questionBank,answers:responses};};');
const roster=w.CHALLENGE_SETS;
const account=Object.keys(roster).find(n=>roster[n].some(s=>s.learningPath&&!s.learningPath.route));
let set;
if(account){set=roster[account].at(-1);w.sessionStorage.setItem(USER_KEY,account);
 const plans={};new Function('window',read('homework/assignments.js'))(plans);
 ok(plans.HOMEWORK[account].days.length===0&&plans.HOMEWORK[account].challenge===set.setId,'homework stays unassigned while the class route is active');
 const prior=new Set(roster[account].slice(0,-1).flatMap(s=>s.ids));
 ok(set.ids.every(id=>!prior.has(id)),'new scored list does not mutate or overlap earlier denominators');
 ok(set.learningPath.steps.every(q=>q.followUp),'every teaching miss has a different follow-up');
 ok(set.learningPath.transfer.length+(set.learningPath.transferOriginal?1:0)===6,'independent set has exactly six items');
 ok(set.learningPath.steps.length<=14,'ordered route fits one class without extra blocks');
 ok(w.__peek().bank.filter(q=>set.ids.includes(q.id)).length===set.ids.length,'all rehearsal IDs resolve');
}else{
 const bank=w.__peek().bank;const q={stage:'Structure',passage:'The team has arrived.',question:'Which is finite?',options:['A. has arrived','B. arriving'],answer:0,explanation:'Has arrived is finite.'};q.followUp={...q,passage:'The team can travel.',explanation:'Can travel is finite.'};
 const checks=Array.from({length:4},(_,i)=>({...q,passage:'Fresh structure '+i,step:0}));
 set={setId:'ordered-route-test',title:'Ordered route',source:'Class route',ids:bank.slice(0,2).map(q=>q.id),learningPath:{intro:'Attempt first',order:'Learn, check, transfer, exit',steps:[q],gates:[checks,checks.map(q=>({...q,passage:q.passage+' alternate'}))],transfer:bank.slice(2,8).map(q=>q.id),exit:[q],schedule:'Homework follows class.'}};
 roster.__ROUTE_TEST__=[set];w.sessionStorage.setItem(USER_KEY,'__ROUTE_TEST__');
}
for(const f of ['challenge/challenge-core.js','challenge/class-path.js','challenge/challenge.js'])inject(read(f));
function choose(i){w.document.querySelector('#lpOptions [data-i="'+i+'"]').click();}
function reason(){ $('lpReason').value='main subject and finite verb';$('lpReason').dispatchEvent(new w.Event('input'));$('lpCommit').click(); }
function finishTeaching(qs){for(const q of qs){reason();choose(q.answer);$('lpNext').click();}}
async function main(){
 if(w.document.readyState==='loading')await new Promise(resolve=>w.document.addEventListener('DOMContentLoaded',resolve));
 w.openChallenge();
 ok($('lpLearn')&&!$('lpGate')&&!$('lpTransfer'),'fresh route cannot skip straight to checks or clock');
 $('lpLearn').click();
 ok($('lpOptions').style.display==='none'&&$('lpNext').disabled,'choices stay hidden and advance is blocked before a prediction');
 const first=set.learningPath.steps[0];reason();
 ok($('lpOptions').style.display==='block','committing a prediction reveals choices');
 choose((first.answer+1)%first.options.length);
 ok($('lpFeedback').textContent.includes(first.explanation),'first miss receives specific feedback');
 $('lpNext').click();ok($('challengeScreen').textContent.includes('different example'),'a miss routes to a fresh example rather than an answer retry');
 reason();choose(first.followUp.answer);$('lpNext').click();
 finishTeaching(set.learningPath.steps.slice(1));
 ok($('lpGate')&&!$('lpTransfer'),'finishing teaching unlocks untimed checks, not the timer');
 $('lpGate').click();
 const gate1=set.learningPath.gates[0];
 for(let i=0;i<gate1.length;i++){choose(i===0?(gate1[i].answer+1)%gate1[i].options.length:gate1[i].answer);ok(!$('lpFeedback'),'independent checks withhold feedback until submission');$('lpNext').click();}
 ok($('challengeScreen').textContent.includes('Keep the clock off'),'gate miss keeps the timer blocked');
 $('lpHome').click();ok(!$('lpGate')&&!$('lpTransfer'),'failed gate requires repair before another gate');
 $('lpLearn').click();finishTeaching([set.learningPath.steps[gate1[0].step]]);
 $('lpGate').click();const gate2=set.learningPath.gates[1];
 for(const q of gate2){choose(q.answer);$('lpNext').click();}
 $('lpHome').click();ok($('lpTransfer'),'four fresh first answers unlock independent transfer');
 ok(Object.keys(w.getProgress()).length===0,'teaching and readiness checks grant no mastery credit');
 $('lpTransfer').click();const p=w.__peek();
 ok(p.mode==='exam'&&p.questions.length===6&&p.timer===420,'transfer reaches the real runner as six items, exam mode, seven minutes');
 const wanted=set.learningPath.transfer.slice();if(set.learningPath.transferOriginal)wanted.splice(1,0,set.learningPath.transferOriginal.id);
 ok(p.questions.map(q=>q.id).join()===wanted.join(),'transfer uses the exact authored order, with no queue shuffle');
 ok(!$('flagBtn').classList.contains('hidden'),'flag-and-return is available');
 w.skipQuestion();w.handleOptionClick(null,p.questions[1].answer,p.questions[1]);
 ok(w.__peek().answers[1].chosen===p.questions[1].answer,'the second transfer item accepts an answer in the actual runner');
 ok(!$('feedbackContainer').classList.contains('visible'),'independent transfer withholds correctness feedback');
 $('modeSelect').value='assisted';$('modeSelect').dispatchEvent(new w.Event('change'));
 ok(w.__peek().mode==='exam'&&$('modeSelect').value==='exam','mode changes cannot reveal hints during the independent set');
 w.saveSessionState();w.goToHub();
 ok(w.restoreSession(w.loadSessionState()),'interrupted independent work can resume');
 ok(w.__peek().questions.map(q=>q.id).join()===wanted.join(),'resume preserves all six questions, including the authored item');
 ok(w.__peek().answers[1].chosen===p.questions[1].answer,'resume preserves the selected transfer answer');
 ok(Array.from($('modeSelect').options).filter(o=>o.value!=='exam').every(o=>o.disabled),'resume preserves the independent exam-mode guard');
 w.finalizeSession();ok($('cReturnToRoute'),'completion offers feedback and exit route');
 $('cReturnToRoute').click();ok($('lpExit')&&!$('lpTransfer'),'timed completion unlocks exit checks without an immediate timed replay');
 $('lpExit').click();finishTeaching(set.learningPath.exit);
 ok($('challengeScreen').textContent.includes('Homework is decided after class')||$('challengeScreen').textContent.includes('Homework follows class'),'finished route leaves homework for the class decision');
 ok(Array.from($('modeSelect').options).every(o=>!o.disabled),'leaving transfer restores normal mode controls');
 w.ChallengeLearning=undefined;w.openChallenge();
 ok($('challengeScreen').textContent.includes('did not load')&&!$('cBeginBtn'),'a failed teaching-script load cannot bypass the route into ordinary practice');
 dom.window.close();console.log('ALL '+count+' ASSERTIONS PASSED');
}
main().catch(e=>{dom.window.close();console.error(e);process.exitCode=1;});
