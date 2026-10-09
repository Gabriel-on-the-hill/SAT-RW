'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
const APP=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(APP,f),'utf8');
const html=read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
const errors=[],posts=[];
const {VirtualConsole}=require('jsdom');const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
const dom=new JSDOM(html,{url:'http://localhost/index.html',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){w.fetch=()=>Promise.resolve({ok:true});w.alert=()=>{};w.scrollTo=()=>{};}});
const w=dom.window,$=id=>w.document.getElementById(id);
function inject(text){const s=w.document.createElement('script');s.textContent=text;w.document.body.appendChild(s);}
for(const file of ['config.js','progress.js','sheet-sync.js','session-responses.js','storage.js','timer.js','history.js','data-craft-structure.js','data-expression-of-ideas.js','data-info-ideas.js','data-conventions.js','eliminator.js','app.js','challenge/sets.js','challenge/challenge-core.js','challenge/class-path.js','challenge/evidence-route.js'])inject(read(file));
inject('window.__bank=function(){return questionBank;};window.__setExamMode=function(){userMode="exam";};');
w.syncSessionToSheet=record=>posts.push(record);
w.sessionStorage.setItem('mastery_user','Ayodeji');
inject(read('challenge/challenge.js'));
const set=w.CHALLENGE_SETS.Ayodeji.at(-1),key='satrw_sat_class_route:Ayodeji:'+set.setId;
function saved(){return JSON.parse(w.localStorage.getItem(key));}
function type(id,value){$(id).value=value;$(id).dispatchEvent(new w.Event('input'));}
function choose(letter){w.document.querySelector('#erChoices [data-answer="'+letter+'"]').click();}
function answer(letter){type('erPrediction','The exact relationship in the question.');$('erReveal').click();choose(letter);type('erReason','The deciding evidence establishes the relationship; the rival changes its direction.');$('erCommit').click();}
function help(value){const select=w.document.querySelector('.erHelp');select.value=value;select.dispatchEvent(new w.Event('change'));}
let assertions=0;function ok(c,m){assert.ok(c,m);assertions++;}
async function main(){
 if(w.document.readyState==='loading')await new Promise(r=>w.document.addEventListener('DOMContentLoaded',r));
 ok(set.setId==='patterns-checks-20261009','new lesson is the production route selected from the hub');
 const refs=set.learningPath.blocks.flatMap(b=>b.items||b.alternatives.flatMap(a=>a.items));
 ok(refs.every(r=>w.__bank().some(q=>q.id===r.id)),'every lesson and repair item resolves against the current bank');
 ok(['graph-check','agreement-check','verb-check'].every(k=>{const b=set.learningPath.blocks.find(b=>b.key===k);return b.batchFeedback&&b.items.length===3;}),'each pattern has a three-item independent batch');
 function continueReview(){w.document.querySelectorAll('.erHelp').forEach(s=>{s.value='none';s.dispatchEvent(new w.Event('change'));});$('erContinue').click();}
 function model(letter){$('erStart').click();answer(letter);ok(saved().rows.at(-1).help==='model','worked example is modelled');$('erContinue').click();}
 function check(letters){$('erStart').click();const before=saved().rows.length;letters.forEach((a,i)=>{answer(a);if(i<letters.length-1){ok(!$('erContinue')&&!$('challengeScreen').textContent.includes('Your explanation:'),'no feedback between first answers');w.openChallenge();ok(saved().rows.length===before+i+1&&$('erPrediction'),'reload continues the unanswered batch item');}});ok($('erContinue'),'review appears only after the batch');continueReview();}
 w.openChallenge();$('erStart').click();answer('A');continueReview();
 model('B');check(['C','A','B']);$('erDefer').click();
 model('C');check(['D','D','A']);$('erDefer').click();
 model('D');check(['A','A','D']);$('erDefer').click();
 $('erBranch0').click();['A','C','D','A'].forEach((a,i)=>{answer(a);if(i<3)ok(!$('erContinue'),'mixed check also withholds feedback');});continueReview();
 ok(saved().rows.length===17,'full route records all 17 core questions');
 ok(posts.length===8&&new Set(posts.map(p=>p.sessionId)).size===8,'completed teaching and check blocks upload once with distinct session IDs');
 ok(posts.every(p=>p.source==='class-practice'&&p.mode==='untimed-class'&&p.questions.every(q=>q.secs===0)),'class work is labelled honestly without invented timing');
 ok(Object.keys(w.getProgress()).length===0,'no class answer adds mastery credit');
 ok(saved().rows.every(r=>w.getExposure()[r.id]),'class exposures persist separately from mastery');
 w.openChallenge();ok(saved().rows.length===17&&$('challengeScreen').textContent.includes('Class record'),'completed class record survives reopening');
 // A shorter lesson retains mixed checks on taught skills only.
 w.localStorage.removeItem(key);w.openChallenge();$('erStart').click();answer('A');continueReview();model('B');check(['C','A','B']);$('erDefer').click();model('C');check(['D','D','A']);$('erDefer').click();
 $('erDefer').click();$('erDefer').click();$('erDefer').click();$('erBranch1').click();['A','C','A'].forEach(answer);continueReview();
 ok(!saved().rows.some(r=>['ec08463d','29c9be28','4a90a978','de3dd17d','4320b4ad'].includes(r.id)),'deferred verb lesson and its checks are absent from shorter route');
 ok(saved().rows.filter(r=>r.block==='mixed').length===3,'shorter mixed check still tests three taught operations');
 ok(errors.length===0,'route runs without browser script errors');
 dom.window.close();console.log('ALL '+assertions+' ASSERTIONS PASSED');
}
main().catch(e=>{dom.window.close();console.error(e);process.exitCode=1;});
