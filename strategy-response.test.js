'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
const S=require('./strategy-response.js'),read=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
const q={id:'method1',skill:'Form, Structure, and Sense',ruleType:'SVA',difficulty:'Medium',psatDifficulty:'Medium',origin:'cb-sat',passage:'A cycle of changing phases _____ regular.',question:'Which choice completes the text?',options:['A. is','B. are','C. were','D. have been'],answer:'A',explanation:'The subject cycle is singular.'};
test('agreement demands subject plus number; a generic topic is insufficient',()=>{
 const p=S.profile(q);assert.equal(p.key,'sva');assert.equal(S.complete(p,{subject:'verbs'}),false);
 assert.equal(S.complete(p,{subject:'cycle',number:'Singular → singular'}),true);
 assert.equal(S.complete(p,{subject:'Not sure yet',number:'Not sure yet'}),true);
});
test('verb-form and tense request different taught steps',()=>{
 assert.deepEqual(S.profile({...q,ruleType:'VForm'}).fields.map(f=>f.id),['subject','finite','job']);
 assert.deepEqual(S.profile({...q,ruleType:'VTense'}).fields.map(f=>f.id),['actions','sequence']);
 assert.equal(S.profile({...q,ruleType:''}).key,'grammar');
});
test('transition relationship needs the actual ideas too',()=>{
 const p=S.profile({skill:'Transitions'});assert.equal(S.complete(p,{relationship:'Contrast'}),false);
 assert(S.complete(p,{relationship:'Contrast',content:'The second result reverses the expectation.'}));
});
test('boundary notes classify both parts and allow list/interruption structures',()=>{
 const p=S.profile({skill:'Boundaries'});assert.deepEqual(p.fields.map(f=>f.id),['left','right','join']);
 assert(S.complete(p,{left:'List item with internal commas',right:'Next list item',join:'Separate the items clearly'}));
});
test('reading methods distinguish detail, main claim, organisation and purpose',()=>{
 assert.equal(S.profile({skill:'Central Ideas and Details',question:'According to the text, which detail is true?'}).key,'detail');
 assert.equal(S.profile({skill:'Central Ideas and Details',question:'Which choice states the main idea?'}).key,'mainIdea');
 assert.equal(S.profile({skill:'Text Structure and Purpose',question:'Which choice describes the overall structure?'}).key,'structure');
 assert.equal(S.profile({skill:'Text Structure and Purpose',question:'What is the function of the underlined sentence?'}).key,'purpose');
 assert.equal(S.profile({skill:'Text Structure and Purpose',question:'Which choice best states the main purpose of the text?'}).key,'textPurpose');
 assert.equal(S.profile({skill:'Central Ideas and Details',question:'What does the text indicate about the sandal?'}).key,'detail');
});
test('prompts do not read the answer, explanations or options to supply method evidence',()=>{
 const guarded={skill:q.skill,ruleType:'SVA'};
 for(const key of ['answer','explanation','options'])Object.defineProperty(guarded,key,{get(){throw Error('answer leakage');}});
 assert.equal(S.profile(guarded).key,'sva');
});
test('question overrides preserve their timing phase and reject malformed fields',()=>{
 const p=S.profile(q,{phase:'with-options',fields:[{id:'changes',label:'What changes?'},{id:'decider',label:'What decides?'}]});
 assert(S.text(p,{changes:'verb form',decider:'the sentence spine'}).includes('with choices visible'));
 assert.throws(()=>S.profile(q,{fields:[{id:'x',label:'one'},{id:'x',label:'two'}]}));
 assert.throws(()=>S.profile(q,{phase:'after-answer'}));
});
test('required fields accept legitimate short and non-Latin subject names',()=>{
 const p=S.profile(q);assert(S.complete(p,{subject:'I',number:'Singular → singular'}));
 assert(S.complete(p,{subject:'π',number:'Singular → singular'}));
 assert.equal(S.complete(p,{subject:'___',number:'Singular → singular'}),false);
});
test('customising one question cannot change another question’s shared method choices',()=>{
 const p=S.profile(q);p.fields[1].options[0]='Changed for one question';assert.equal(S.profile(q).fields[1].options[0],'Singular → singular');
});
test('existing sitting signatures remain compatible; authored response changes get a new version',()=>{
 const H=require('./homework/selection.js'),plan={start:'2026-10-11'},spec={n:1,slots:[{preferredId:'method1'}],minutes:0};
 const legacy=JSON.stringify([plan.start,'',spec.n,spec.slots,0,[]]);assert.equal(H.version(plan,spec),legacy);assert.equal(H.version(plan,{...spec,responses:{}}),legacy);
 assert.notEqual(H.version(plan,{...spec,responses:{method1:{phase:'with-options'}}}),legacy);
});
function fill(w,root=w.document){
 root.querySelectorAll('[data-response-field]').forEach(e=>{
  e.value=e.tagName==='SELECT'?e.options[1].value:(e.dataset.responseField==='subject'?'cycle':'The exact deciding relationship.');
  e.dispatchEvent(new w.Event('input',{bubbles:true}));
 });
}
function homework(minutes=0,saved={},response){
 let now=Date.UTC(2026,9,12,12);const raw=read('homework-run.html');
 const dom=new JSDOM(raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''),{url:'https://test.local/homework-run.html?student=__TEST__&day=1',runScripts:'dangerously'}),w=dom.window;
 const prefix=raw.includes("prefix:'psat89'")?'psat89':'satrw';w.sessionStorage.setItem(prefix==='satrw'?'mastery_user':'psat89_user','__TEST__');
 w.__posts=[];w.fetch=(u,o)=>{w.__posts.push(JSON.parse(o.body));return Promise.resolve({ok:true});};w.scrollTo=()=>{};w.alert=()=>{};w.confirm=()=>true;
 w.Date.now=()=>now;w.setInterval=()=>1;w.clearInterval=()=>{};Object.entries(saved).forEach(([k,v])=>w.localStorage.setItem(k,v));
 function inject(text){const e=w.document.createElement('script');e.textContent=text;w.document.body.appendChild(e);}
 inject('const questionBank_CON='+JSON.stringify([q,{...q,id:'method2'}])+';');
 ['progress.js','strategy-response.js','homework/selection.js','homework/sitting.js','eliminator.js'].forEach(f=>inject(read(f)));
 const plan={start:'2026-10-12',days:[{n:1,focus:'Methods',minutes,review:0,responses:response?{method1:response}:undefined,slots:[{skills:[q.skill],diffs:['Medium'],ruleType:'SVA',intent:'fresh',preferredId:q.id,reserveIds:['method2']}]}]};
 w.hwLoadPlan=(s,cb)=>cb(plan);w.hwDayOpen=()=>true;w.SHEET_SYNC_ENDPOINT='https://test.invalid';
 inject([...raw.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1]);if(w.document.getElementById('hwStart'))w.document.getElementById('hwStart').click();
 return {w,prefix,advance(){now+=46000;},saved(){const o={};for(let i=0;i<w.localStorage.length;i++){const k=w.localStorage.key(i);o[k]=w.localStorage.getItem(k);}return o;},state(){return JSON.parse(w.localStorage.getItem(prefix+'_hwsitting___TEST___2026-10-12_1'));},close(){dom.window.close();}};
}
test('homework refuses incomplete agreement fields and persists unfinished drafts',()=>{
 let b=homework();b.advance();const w=b.w,$=id=>w.document.getElementById(id);
 $('predText').value='verbs';$('predGo').click();assert($('opts').classList.contains('hidden'));assert($('predErr').textContent.includes('number'));
 fill(w);const saved=b.saved();b.close();b=homework(0,saved);
 assert.equal(b.w.document.getElementById('predText').value,'cycle');assert.equal(b.w.document.querySelector('select[data-response-field="number"]').value,'Singular → singular');b.close();
});
test('the committed method response survives reload and reaches the existing Prediction payload',()=>{
 let b=homework();b.advance();fill(b.w);b.w.document.getElementById('predGo').click();b.w.document.querySelector('.opt').click();b.w.document.getElementById('submit').click();
 const original=b.state().records[0].prediction;assert(original.includes('Controlling subject / head noun: cycle'));assert(original.includes('Singular → singular'));
 const saved=b.saved();b.close();b=homework(0,saved);assert.equal(b.state().records[0].prediction,original);assert.equal(b.w.document.getElementById('predText'),null);
 b.w.document.getElementById('next').click();const posted=b.w.__posts.find(p=>p.type==='homework');assert(posted.questions[0].prediction.includes('Controlling subject'));b.close();
});
test('with-options responses show choices without permitting an incomplete submission',()=>{
 const override={phase:'with-options',fields:[{id:'change',label:'What changes across choices?'},{id:'structure',label:'What decides?'}]},b=homework(0,{},override);
 assert.equal(b.w.document.getElementById('opts').classList.contains('hidden'),false);b.w.document.getElementById('predGo').click();assert(b.w.document.getElementById('predict'));
 fill(b.w);b.w.document.getElementById('predGo').click();b.w.document.querySelector('.opt').click();b.w.document.getElementById('submit').click();
 assert(b.state().records[0].prediction.includes('with choices visible'));assert.equal(b.state().records[0].onText,0);b.close();
});
test('timed homework has method cues without a typing requirement or invented written evidence',()=>{
 const b=homework(1);assert.equal(b.w.document.querySelector('[data-response-field]'),null);assert(b.w.document.getElementById('predict').textContent.includes('controls the verb'));
 b.w.document.getElementById('predGo').click();b.w.document.querySelector('.opt').click();b.w.document.getElementById('next').click();b.w.document.getElementById('hwRevSubmit').click();
 const posted=b.w.__posts.find(p=>p.type==='homework');assert.equal(posted.questions[0].prediction,'');b.close();
});
test('class route locks and logs method fields while preserving the correct answer score',()=>{
 const sat=fs.existsSync(path.join(__dirname,'challenge/evidence-route.js'));
 const dom=new JSDOM('<body></body>',{url:'https://test.local',runScripts:'dangerously'}),w=dom.window;
 function inject(text){const e=w.document.createElement('script');e.textContent=text;w.document.body.appendChild(e);}
 inject(read('strategy-response.js'));const posts=[];w.syncSessionToSheet=p=>posts.push(p);w.recordExposure=()=>{};
 const qq=[q,{...q,id:'m2'},{...q,id:'m3'},{...q,id:'m4'}];
 const ctx={student:'__TEST__',bank:qq,header:()=>'',paint:html=>w.document.body.innerHTML=html,back:()=>{},set:{setId:'method-test',title:'Methods'}};
 if(sat){
  ctx.set.learningPath={route:'target-evidence',intro:'',order:'',blocks:[{key:'check',title:'Check',items:[{id:q.id,role:'supported application'}]}]};
  inject(read('challenge/evidence-route.js'));w.ChallengeLearning.render(ctx);w.document.getElementById('erStart').click();
  w.document.getElementById('erPrediction').value='verbs';w.document.getElementById('erPrediction').dispatchEvent(new w.Event('input'));assert(w.document.getElementById('erReveal').disabled);
  fill(w);w.document.getElementById('erReveal').click();assert(w.document.querySelector('select').disabled);
  w.document.querySelector('[data-answer="A"]').click();w.document.getElementById('erReason').value='The head noun cycle requires a singular verb.';w.document.getElementById('erReason').dispatchEvent(new w.Event('input'));w.document.getElementById('erCommit').click();w.document.getElementById('erContinue').click();
 }else{
  ctx.set.learningPath={intro:'',order:'',steps:[q],checks:qq,exitChoices:qq.slice(1,3),transfer:['m2']};
  inject(read('challenge/structured-class.js'));w.StructuredClass.render(ctx);w.document.getElementById('scLearn').click();
  fill(w);w.document.getElementById('scCommit').click();assert(w.document.querySelector('select').disabled);
  w.document.querySelector('[data-i="0"]').click();w.document.getElementById('scNext').click();
 }
 assert.equal(posts[0].score,1);assert(posts[0].questions[0].prediction.includes('Controlling subject'));assert(posts[0].questions[0].prediction.includes('Singular → singular'));dom.window.close();
});
test('older class learning/check routes retain and log the requested method notes',()=>{
 const dom=new JSDOM('<body></body>',{url:'https://test.local',runScripts:'dangerously'}),w=dom.window,posts=[];
 function inject(s){const e=w.document.createElement('script');e.textContent=s;w.document.body.appendChild(e);}
 w.syncSessionToSheet=p=>posts.push(p);w.recordExposure=()=>{};inject(read('strategy-response.js'));inject(read('challenge/class-path.js'));
 const qs=[0,1,2,3].map(i=>({...q,id:'legacy'+i,answer:0}));
 const ctx={student:'__TEST__',bank:[],header:()=>'',paint:html=>w.document.body.innerHTML=html,back:()=>{},set:{setId:'legacy-method-test',title:'Methods',learningPath:{intro:'',order:'',steps:[qs[0]],gates:[qs],exits:[],transfer:[]}}};
 w.ChallengeLearning.render(ctx);w.document.getElementById('lpLearn').click();fill(w);w.document.getElementById('lpCommit').click();w.document.querySelector('[data-i="0"]').click();w.document.getElementById('lpNext').click();
 assert(posts[0].questions[0].prediction.includes('Controlling subject'));w.document.getElementById('lpGate').click();
 for(let i=0;i<4;i++){fill(w);w.document.getElementById('lpGateCommit').click();w.document.querySelector('[data-i="0"]').click();w.document.getElementById('lpNext').click();}
 assert.equal(posts.at(-1).score,4);assert(posts.at(-1).questions.every(r=>r.prediction==='The exact deciding relationship.'));dom.window.close();
});
if(fs.existsSync(path.join(__dirname,'challenge/cycle-class.js')))test('cycle class saves unfinished drafts and locks the original method response',()=>{
 const dom=new JSDOM('<body></body>',{url:'https://test.local',runScripts:'dangerously'}),w=dom.window,posts=[];
 function inject(s){const e=w.document.createElement('script');e.textContent=s;w.document.body.appendChild(e);}
 w.syncSessionToSheet=p=>posts.push(p);w.recordExposure=()=>{};inject(read('strategy-response.js'));inject(read('challenge/cycle-class.js'));
 const qs=[0,1,2,3].map(i=>({...q,id:'cycle'+i})),ctx={student:'__TEST__',bank:qs,header:()=>'',paint:html=>w.document.body.innerHTML=html,back:()=>{},set:{setId:'cycle-method-test',title:'Methods',learningPath:{intro:'',order:'',cycles:[{id:'agreement',title:'Agreement',model:qs[0],checks:qs.slice(1),reserves:[]}],transfer:[qs[1].id],mixedSeconds:420}}};
 w.CycleClass.render(ctx);w.document.getElementById('ccCycle0').click();fill(w);const draft=JSON.parse(w.localStorage.getItem('satrw_cycleroute___TEST___cycle-method-test'));assert.equal(draft.cycles.agreement.model.methodDrafts[0].subject,'cycle');
 w.document.getElementById('ccCommit').click();assert(w.document.querySelector('select').disabled);w.document.querySelector('[data-i="0"]').click();w.document.getElementById('ccLock').click();w.document.getElementById('ccHelp').value='none';w.document.getElementById('ccHelp').dispatchEvent(new w.Event('change'));w.document.getElementById('ccNext').click();
 assert.equal(posts[0].score,1);assert(posts[0].questions[0].prediction.includes('Controlling subject'));dom.window.close();
});
test('independent checks carry no method checklist; tutor-written prompts are kept as written',()=>{
 const own=S.profile(q,S.own('Your prediction, in your own words'));assert.deepEqual(own.fields.map(f=>f.id),['reason']);assert.equal(own.instructions,'');
 assert.equal(S.text(own,{reason:'singular subject'}),'singular subject');assert.equal(S.complete(own,{reason:'?'}),false);
 const dom=new JSDOM('<body></body>',{url:'https://test.local',runScripts:'dangerously'}),w=dom.window,posts=[];
 function inject(t){const e=w.document.createElement('script');e.textContent=t;w.document.body.appendChild(e);}
 w.syncSessionToSheet=p=>posts.push(p);w.recordExposure=()=>{};inject(read('strategy-response.js'));
 const plain=()=>{const box=w.document.querySelector('.method-response');return box&&box.querySelectorAll('[data-response-field]').length===1&&!w.document.querySelector('select')&&!box.querySelector('p');};
 if(fs.existsSync(path.join(__dirname,'challenge/evidence-route.js'))){
  const ctx={student:'__TEST__',bank:[q],header:()=>'',paint:h=>w.document.body.innerHTML=h,back:()=>{},set:{setId:'indep-test',title:'Methods',learningPath:{route:'target-evidence',intro:'',order:'',blocks:[{key:'x',title:'Exit',exit:true,items:[{id:q.id,role:'silent exit'}]}]}}};
  inject(read('challenge/evidence-route.js'));w.ChallengeLearning.render(ctx);w.document.getElementById('erStart').click();
  assert(plain(),'an exit check shows one own-words box and no checklist');
 }else{
  const step={...q,id:'s1',reasonPrompt:'Name the subject head and the verb it requires.'};
  const ctx={student:'__TEST__',bank:[],header:()=>'',paint:h=>w.document.body.innerHTML=h,back:()=>{},set:{setId:'indep-test',title:'Methods',learningPath:{intro:'',order:'',steps:[step],checks:[q,{...q,id:'m2'},{...q,id:'m3'}],exitChoices:[],transfer:[]}}};
  inject(read('challenge/structured-class.js'));w.StructuredClass.render(ctx);w.document.getElementById('scLearn').click();
  assert(plain(),'a teaching step with a written prompt keeps one box');assert(w.document.body.textContent.includes('Name the subject head and the verb it requires.'));
 }
 dom.window.close();
 const d2=new JSDOM('<body></body>',{url:'https://test.local',runScripts:'dangerously'}),w2=d2.window;
 function inj2(t){const e=w2.document.createElement('script');e.textContent=t;w2.document.body.appendChild(e);}
 w2.syncSessionToSheet=()=>{};w2.recordExposure=()=>{};inj2(read('strategy-response.js'));inj2(read('challenge/class-path.js'));
 const qs=[0,1,2,3].map(i=>({...q,id:'g'+i,answer:0}));
 const ctx2={student:'__TEST__',bank:[],header:()=>'',paint:h=>w2.document.body.innerHTML=h,back:()=>{},set:{setId:'gate-test',title:'M',learningPath:{intro:'',order:'',steps:[qs[0]],gates:[qs],exits:[],transfer:[]}}};
 w2.ChallengeLearning.render(ctx2);w2.document.getElementById('lpLearn').click();fill(w2);w2.document.getElementById('lpCommit').click();w2.document.querySelector('[data-i="0"]').click();w2.document.getElementById('lpNext').click();
 w2.document.getElementById('lpGate').click();
 assert.equal(w2.document.querySelectorAll('.method-response [data-response-field]').length,1,'a notes-closed fresh check has one own-words box');assert.equal(w2.document.querySelector('select'),null);d2.window.close();
});
test('with-options homework cannot grade an answer before the method response is saved',()=>{
 const b=homework(0,{}, {phase:'with-options'});b.w.document.querySelector('.opt').click();b.w.document.getElementById('submit').click();assert.equal(Object.keys(b.w.getProgress()).length,0);assert.equal(b.state().records.filter(Boolean).length,0);b.close();
});
test('assisted practice requires the method notes before grading and preserves them in session packing',()=>{
 const html=read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''),dom=new JSDOM(html,{url:'https://test.local/index.html',runScripts:'dangerously'}),w=dom.window;
 w.alert=()=>{};w.confirm=()=>true;w.scrollTo=()=>{};w.__posts=[];w.fetch=(u,o)=>{if(o&&o.body)w.__posts.push(JSON.parse(o.body));return Promise.resolve({ok:true});};
 w.sessionStorage.setItem(fs.existsSync(path.join(__dirname,'ns-migrate.js'))?'mastery_user':'psat89_user','__TEST__');
 function inject(s){const e=w.document.createElement('script');e.textContent=s;w.document.body.appendChild(e);}
 inject('const questionBank_CS=[],questionBank_EOI=[],questionBank_II=[],questionBank_CON='+JSON.stringify([q])+';window.__methodQ='+JSON.stringify({...q,responseProfile:{phase:'with-options'}})+';');
 for(const f of ['config.js','progress.js','sheet-sync.js','session-responses.js','storage.js','timer.js','history.js','strategy-response.js','app.js'])inject(read(f));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 inject('window.__methodStart=()=>launchSession([window.__methodQ],"assisted",{mode:"off"});window.__methodTimed=()=>launchSession([window.__methodQ],"assisted",{mode:"countdown",total:71});window.__methodState=()=>responses;');w.__methodStart();
 {const h=w.document.getElementById('predictionHint'),l=h.querySelector('.method-hint-line');assert(l,'method line added');assert(h.textContent.length>l.textContent.length+10,'the skill strategy hint is kept');}
 assert.equal(w.document.getElementById('optionsContainer').classList.contains('hidden'),false);w.document.querySelector('#optionsContainer .option-btn').click();w.submitAnswer();assert.equal(w.__methodState()[0].committed,false);
 fill(w);w.document.getElementById('revealChoicesBtn').click();w.submitAnswer();assert(w.__methodState()[0].committed);
 const restored=w.unpackResponses(w.packResponses(w.__methodState()),1);assert.equal(restored[0].methodValues.subject,'cycle');assert(restored[0].prediction.includes('with choices visible'));
 w.__methodTimed();assert.equal(w.document.querySelector('#practiceMethod [data-response-field]'),null);assert(w.document.getElementById('predictionHint').textContent.includes('on paper'));dom.window.close();
});
console.log('TOTAL '+checks+' method-response checks passed');
