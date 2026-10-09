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
// Pin the historical fixture; a newly appended production route must not erase this regression.
w.CHALLENGE_SETS.Ayodeji = w.CHALLENGE_SETS.Ayodeji.filter(s=>s.setId==='target-evidence-20261002');
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
 const plans={};new Function('window',read('homework/assignments.js'))(plans);
 // homework-hub.html renders a plan carrying `challenge` as the challenge card alone and never draws its days.
 ok(Object.values(plans.HOMEWORK).every(p=>!(p.challenge&&p.days&&p.days.length)),'no plan carries both days and a challenge key — the hub would hide the days');
 ok(set.setId==='target-evidence-20261002','the historical class route remains available for regression checks');
 const bank=w.__bank();
 const refs=set.learningPath.blocks.flatMap(b=>b.items||b.alternatives.flatMap(a=>a.items));
 ok(refs.every(r=>bank.some(q=>q.id===r.id)),'every model, fresh question and exit resolves against the real bank');
 ok(refs.length===9&&new Set(refs.map(r=>r.id)).size===9,'all nine roles have distinct fixed questions');
 ok(set.learningPath.blocks.findIndex(b=>b.key==='fresh')<set.learningPath.blocks.findIndex(b=>b.key==='hard'),'independent Medium precedes optional Hard');
 ok(['hard','graph-model','graph-transfer'].every(key=>set.learningPath.blocks.find(b=>b.key===key).optional),'extensions can be deferred');
 w.openChallenge();$('erStart').click();
 ok($('erChoices').hidden&&$('erCommit').disabled,'blank prediction cannot reveal choices or submit');
 choose('A');ok(saved().draft.chosen===null,'hidden choices cannot be selected by a click');
 type('erPrediction','An abstract style shared by the examples.');$('erReveal').click();
 ok(w.document.querySelectorAll('#erChoices [data-answer]').length===4&&w.document.querySelectorAll('#erChoices .elim-x').length===4,'route choices carry the cross-out control without adding answer buttons');
 w.document.querySelector('#erChoices [data-answer="A"] .elim-x').click();ok(w.document.querySelector('#erChoices [data-answer="A"]').classList.contains('elim-out')&&!w.document.querySelector('#erChoices [data-answer][aria-pressed="true"]'),'crossing out in the route does not choose');
 choose('B');
 ok($('erCommit').disabled,'answer alone cannot reveal feedback');
 type('erReason','The strongest rival makes a claim about change over time.');
 w.openChallenge();
 ok($('erPrediction').disabled&&$('erPrediction').value.includes('abstract')&&$('erReason').value.includes('rival')&&saved().draft.chosen==='B','reload preserves prediction, choice and explanation before commitment');
 const commit=$('erCommit');commit.click();commit.click();
 ok(saved().rows.length===1&&saved().rows[0].chosen==='B','first answer is immutable and double commitment adds no second answer');
 ok($('erPrediction')&&!$('erContinue')&&!$('challengeScreen').textContent.includes('Your explanation:'),'first opening receives no feedback before second commitment');
 answer('A');ok($('erContinue')&&saved().rows.length===2,'both opening answers precede the review');
 // An old exam-mode preference plus an empty runner must not relabel class work.
 w.__setExamMode();help('none');$('erContinue').click();
 ok(posts.length===1&&posts[0].source==='class-practice'&&posts[0].questions[0].chosen==='B','class upload preserves raw first answers and labels class practice');
 $('erStart').click();answer('A');ok(saved().rows[2].help==='model','worked example is explicitly modelled');$('erContinue').click();
 $('erStart').click();answer('A');help('process');$('erContinue').click();
 $('erStart').click();ok(!$('challengeScreen').textContent.includes('Target →'),'fresh Medium removes the full checklist');answer('D');help('none');$('erContinue').click();
 $('erDefer').click();ok(saved().block===5&&!saved().rows.some(r=>r.id==='dd1757fd'),'deferring Hard serves no Hard item');
 $('erStart').click();
 ok(w.document.querySelector('#challengeScreen img').getAttribute('src')==='assets/fig_7edfb2c5.png','actual Evron chart renders');
 ok(!$('challengeScreen').textContent.includes('Estimated Temperatures to which'),'flattened graph OCR is removed from prose');
 answer('B');help('model');$('erContinue').click();
 $('erStart').click();ok(w.document.querySelector('#challengeScreen img').getAttribute('src')==='assets/fig_040583a5.png','actual banana chart renders');answer('D');help('none');$('erContinue').click();
 $('erStart').click();ok(saved().draft.id==='d9a6817c'&&!saved().rows.some(r=>r.id==='d9a6817c'),'exit serves a fresh question in this route');
 $('erSkip').click();ok(saved().rows.at(-1).chosen===null&&saved().rows.at(-1).isCorrect===null,'unattempted exit is a blank, never a wrong answer');$('erContinue').click();
 ok($('challengeScreen').textContent.includes('Class record')&&!$('erStart'),'completed route shows the retained record');
 ok(Object.keys(w.getProgress()).length===0,'teaching and class checks grant no mastery credit');
 const met=w.getExposure(),first=saved().rows[0];
 ok(saved().rows.every(r=>met[r.id]&&met[r.id].by.class),'every committed class item is recorded as met, outside the ledger');
 ok(met[first.id].by.class.result===(first.isCorrect?'correct':'wrong'),'the exposure keeps the first answer\'s result');
 ok(met['d9a6817c'].by.class.result==='seen','a left-unanswered item is met, not wrong');
 w.openChallenge();ok(saved().rows[0].chosen==='B'&&$('challengeScreen').textContent.includes('Class record'),'reopening keeps the first answer and completed route');
 ok(posts.length===7&&posts.every(p=>!p.avgSecs&&!p.duration),'every completed block posts once, without fabricated independent pace');
 ok(posts.at(-1).total===0&&posts.at(-1).questions[0].isCorrect===null,'blank is excluded from attempted total in uploads');
 ok(errors.length===0,'full route runs without browser script errors');
 dom.window.close();console.log('ALL '+assertions+' ASSERTIONS PASSED');
}
main().catch(e=>{dom.window.close();console.error(e);process.exitCode=1;});
