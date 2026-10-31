// Grammar review route: one guided path through the class.
// The home screen lists the steps in order with a single Start/Continue button; any step can still be opened.
// A section runs: lesson and cue -> worked example -> independent check -> similar question if missed.
// Checks, the warm-up and the mixed check work like the real test: move back and forward between questions,
// change answers, then submit. Nothing is marked until submission. The first choice on each question is still
// logged. Worked examples and similar questions explain each answer straight away and can be paged through.
// The student is never asked to type or to fill in tutor fields. Same-day work never awards mastery credit.
(function(){'use strict';
var ns='satrw_grammar_',timer=null;
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function node(id){return document.getElementById(id);}
function btn(id,label,ghost){return '<button type="button" class="cbtn'+(ghost?' ghost':'')+'" id="'+id+'">'+esc(label)+'</button>';}
function wire(id,f){if(node(id))node(id).onclick=f;}
function fresh(){return {index:0,answers:[],notes:[],help:[],seen:[],done:false};}
function clock(sec){return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');}
function render(ctx){
var p=ctx.set.learningPath,k=ns+ctx.student+'_'+ctx.set.setId,s;
try{s=JSON.parse(localStorage.getItem(k));}catch(e){}
s=s||{blocks:{},started:Date.now(),sessionId:'grammar_'+Date.now().toString(36)};
var families=p.families.concat(p.boundaries?[p.boundaries]:[]),openingRefs=p.openingItems||(p.opening?[p.opening]:[]);
var cue=p.cue||'Before you choose, say or jot the deciding structure.';
function save(){try{localStorage.setItem(k,JSON.stringify(s));}catch(e){}}
function stop(){if(timer){clearInterval(timer);timer=null;}}
function paint(html,overview){stop();ctx.paint(ctx.header()+html+'<div class="crow">'+(overview?btn('gcHub','Back to hub',true):btn('gcHome','All steps',true))+'</div>');wire('gcHome',home);wire('gcHub',function(){stop();ctx.back();});}
function qget(ref){var q=ctx.bank.find(function(q){return q.id===ref.bankId;});if(!q)throw Error('Missing grammar question '+ref.bankId);return q;}
function block(id){return s.blocks[id]||(s.blocks[id]=fresh());}
function has(id){return !!s.blocks[id];}
function score(id,refs){var b=block(id);return refs.filter(function(r,i){return b.answers[i]===qget(r).answer;}).length;}
function late(b,i){return !!(b.expiredItems&&b.expiredItems[i]);}
function feedback(q,b,i){
  if(window.ClassReview)return ClassReview.render(q,{number:i+1,chosen:b.answers[i],note:b.notes[i]||false,expired:late(b,i)});
  return '<div class="cbox"><p><b>'+esc(q.id)+' · '+(b.answers[i]===q.answer?'Right':'Not yet')+'</b> · Your answer: '+esc(b.answers[i]||'blank')+' · Correct: '+esc(q.answer)+(late(b,i)?' · After the time limit':'')+'</p><div>'+esc(q.passage).replace(/\n/g,'<br>')+'</div><ul>'+q.options.map(function(o){return '<li>'+esc(o)+'</li>';}).join('')+'</ul><p>'+esc(q.explanation).replace(/\n/g,'<br>')+'</p></div>';}
function post(id,refs,b){if(b.posted||!b.done)return;b.posted=true;save();if(typeof syncSessionToSheet!=='function')return;
  var rows=refs.map(function(r,i){var q=qget(r),first=b.firstPick&&b.firstPick[i];return {id:q.id,skill:q.skill,difficulty:ctx.difficulty?ctx.difficulty(q):q.difficulty,chosen:b.answers[i]||null,correct:q.answer,isCorrect:b.answers[i]===q.answer,seconds:b.seconds&&b.seconds[i]||0,
    prediction:(b.notes[i]||'Reasoning given aloud or on paper')+'\nConditions: '+id+'; help: '+(b.help[i]||'unrecorded')+'; recognised: '+(b.seen[i]===true?'yes':b.seen[i]===false?'no':'unrecorded')+(first&&first!==b.answers[i]?'; first choice '+first+', changed before submitting':'')+(b.expired?'; time expired':'')+(late(b,i)?'; answered after the time limit (selection at the limit: '+((b.atDeadline&&b.atDeadline[i])||'none')+')':''),
    help:b.help[i]||'unrecorded',recognised:b.seen[i]===true?true:b.seen[i]===false?false:null,late:late(b,i),firstChoice:first||null};});
  try{syncSessionToSheet({source:'class-route',student:ctx.student,sessionId:s.sessionId+'_'+id,assignmentId:ctx.set.setId,assignmentTitle:ctx.set.title+' · '+id,mode:b.timed?'timed-class':'untimed-class',duration:Math.round(((b.ended||Date.now())-b.started)/1000),score:rows.filter(function(r){return r.isCorrect;}).length,total:refs.length,questions:rows});}catch(e){b.posted=false;save();}}

// ---- the ordered steps -------------------------------------------------
function steps(){
  var list=[];
  if(openingRefs.length)list.push({id:'gcOpening',label:'Warm-up from last week',done:function(){return has('opening')&&block('opening').done;},status:function(){return score('opening',openingRefs)+' / '+openingRefs.length;},open:opening});
  families.forEach(function(f,i){list.push({id:'gcFamily'+i,label:f.title,done:function(){return has(f.id+'-checks')&&block(f.id+'-checks').done;},status:function(){return score(f.id+'-checks',f.checks)+' / '+f.checks.length;},open:function(){section(f);}});});
  if(p.mixed&&p.mixed.length)list.push({id:'gcMixed',label:'Mixed check · '+p.mixed.length+' questions'+(timedMixed()?' · '+clock(p.seconds):''),done:function(){return has('mixed')&&block('mixed').done;},status:function(){return score('mixed',s.mixedRefs||p.mixed)+' / '+p.mixed.length;},open:mixed});
  return list;}
function timedMixed(){return p.mixedTimed!==false&&!!p.seconds;}
function nextStep(){var n=steps().find(function(x){return !x.done();});if(n)n.open();else home();}
function cardHtml(){if(!p.card)return '';return '<div class="cbox"><b>What is on each side of the blank?</b><div class="ctable-wrap"><table class="ctable"><thead><tr><th>Each side</th><th>Punctuation</th></tr></thead><tbody>'+p.card.map(function(r){return '<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1])+'</td></tr>';}).join('')+'</tbody></table></div></div>';}
function home(){
  var list=steps(),next=list.find(function(x){return !x.done();}),started=list.some(function(x){return x.done();})||Object.keys(s.blocks).length>0;
  var html='<p>'+esc(cue)+'</p>'+cardHtml();
  html+=next?'<div class="crow">'+btn('gcGo',(started?'Continue: ':'Start: ')+next.label)+'</div>':'<div class="cmsg ok">All steps are done. Open any step to see its review.</div>';
  html+='<div class="cbox">'+list.map(function(x){var mark=x.done()?' · '+x.status():(x===next?' · next':'');return '<div class="crow" style="align-items:center;justify-content:space-between"><span><b>'+esc(x.label)+'</b>'+esc(mark)+'</span>'+btn(x.id,x.done()?'Review':'Open',true)+'</div>';}).join('')+'</div>';
  if(p.probe||p.launch)html+='<div class="crow">'+(p.probe?btn('gcProbe','Extra: Hard verb question',true):'')+(p.launch?btn('gcLaunch','Open existing homework question',true):'')+'</div>';
  paint(html,true);
  wire('gcGo',nextStep);list.forEach(function(x){wire(x.id,x.open);});
  wire('gcProbe',function(){run('probe',[p.probe],{immediate:true,prompt:cue},home);});
  wire('gcLaunch',function(){run('launch',[p.launch],{immediate:true,prompt:cue},home);});
  save();}
function nextButton(){return btn('gcNextStep',steps().some(function(x){return !x.done();})?'Next step':'All steps');}
function opening(){run('opening',openingRefs,{immediate:!p.openingItems,prompt:p.openingPrompt||cue,label:'Warm-up'},function(){
  paint('<h2>Warm-up · '+score('opening',openingRefs)+' / '+openingRefs.length+'</h2>'+openingRefs.map(function(r,i){return feedback(qget(r),block('opening'),i);}).join('')+'<div class="crow">'+nextButton()+'</div>');wire('gcNextStep',nextStep);});}

// ---- one section: lesson -> example -> check -> similar question ---------
function section(f){
  if(has(f.id+'-checks')){if(block(f.id+'-checks').done)return familyResult(f);return startCheck(f);}
  lesson(f);}
function lesson(f){
  var modelled=has(f.id+'-models')&&block(f.id+'-models').done,n=(f.checks||[]).length;
  paint('<div class="cbox"><h2>'+esc(f.title)+'</h2><p>'+esc(f.lesson)+'</p>'+(f.cue?'<div class="cmsg"><b>The check:</b> '+esc(f.cue)+'</div>':'')+'</div><div class="crow">'+
    (modelled?btn('gcChecks','Your turn · '+n+' question'+(n===1?'':'s')+' · '+clock(n*(p.checkSeconds||90)))+btn('gcModels','Worked example again',true)
             :btn('gcModels','Worked example')+btn('gcChecks','Skip to the check',true))+'</div>');
  wire('gcModels',function(){run(f.id+'-models',f.models,{immediate:true,model:true,prompt:f.prompt||cue,label:'Worked example'},function(){startCheck(f);});});
  wire('gcChecks',function(){startCheck(f);});}
function startCheck(f){run(f.id+'-checks',f.checks,{prompt:f.prompt||cue,label:'Your turn'},function(){familyResult(f);});}
function familyResult(f){
  var b=block(f.id+'-checks'),n=score(f.id+'-checks',f.checks),missed=n<f.checks.length,rb=has(f.id+'-reserve')?block(f.id+'-reserve'):null,offer=missed&&f.reserve&&!(rb&&rb.done);
  var html='<h2>'+esc(f.title)+' · '+n+' / '+f.checks.length+'</h2>'+f.checks.map(function(r,i){return feedback(qget(r),b,i);}).join('');
  if(rb&&rb.done)html+='<h3>Similar question</h3>'+feedback(qget(f.reserve),rb,0);
  html+='<div class="crow">'+(offer?btn('gcRepair','Try a similar question')+btn('gcNextStep','Next step',true):nextButton())+btn('gcLesson','Lesson again',true)+'</div>';
  paint(html);
  wire('gcRepair',function(){run(f.id+'-reserve',[f.reserve],{immediate:true,prompt:f.prompt||cue,label:'Similar question'},function(){familyResult(f);});});
  wire('gcNextStep',nextStep);wire('gcLesson',function(){lesson(f);});}

// ---- mixed check ---------------------------------------------------------
function mixed(){
  if(s.mixedStarted)return run('mixed',s.mixedRefs,{mixed:true,timed:!!block('mixed').timed,prompt:cue,label:'Mixed check'},mixedResult);
  var timed=timedMixed();s.mixedRefs=p.mixed.map(function(r){return {bankId:r.bankId};});s.mixedStarted=true;
  var b=block('mixed');b.timed=timed;b.started=Date.now();if(timed)b.deadline=b.started+p.seconds*1000;save();
  run('mixed',s.mixedRefs,{mixed:true,timed:timed,prompt:cue,label:'Mixed check'},mixedResult);}
function mixedResult(){paint('<h2>Mixed check · '+score('mixed',s.mixedRefs)+' / '+s.mixedRefs.length+'</h2>'+s.mixedRefs.map(function(r,i){return feedback(qget(r),block('mixed'),i);}).join('')+'<div class="crow">'+nextButton()+'</div>');wire('gcNextStep',nextStep);}

// ---- question screens ----------------------------------------------------
function run(id,refs,opt,done){
  var b=block(id);b.started=b.started||Date.now();
  if(b.done){
    if(opt.mixed)return mixedResult();
    if(opt.immediate){paint(refs.map(function(r,i){return feedback(qget(r),b,i);}).join('')+'<div class="crow">'+btn('gcNext','Continue')+'</div>');wire('gcNext',done);return;}
    return done();}
  return opt.immediate?runImmediate(id,refs,opt,done,b):runSet(id,refs,opt,done,b);}
function navRow(refs,i,marked){if(refs.length<2)return '';return '<div class="crow" id="gcNav" aria-label="Questions">'+refs.map(function(r,j){return '<button type="button" class="cbtn'+(j===i?'':' ghost')+'" id="gcQ'+j+'" aria-current="'+(j===i?'step':'false')+'">'+(j+1)+(marked(j)?' ✓':'')+'</button>';}).join('')+'</div>';}
function questionHtml(q,locked,selected){return '<div class="cq">'+esc(q.passage).replace(/\n/g,'<br>')+'</div><p><b>'+esc(q.question)+'</b></p><div id="gcOptions">'+q.options.map(function(o,j){var l='ABCD'[j];return '<button type="button" class="copt'+(l===selected?' sel':'')+'" aria-pressed="'+(l===selected)+'" data-letter="'+l+'"'+(locked?' disabled':'')+'>'+esc(o)+'</button>';}).join('')+'</div>';}
function decorate(id,q){if(typeof Eliminator!=='undefined')Eliminator.decorate(node('gcOptions'),{ns:'grammar:'+ctx.student+':'+ctx.set.setId+':'+id,id:q.id,selector:'.copt'});}

// Checks, warm-up and mixed: move freely, change answers, submit once.
function runSet(id,refs,opt,done,b){
  var n=refs.length,limit=opt.mixed?(opt.timed?p.seconds:0):opt.independent===false?0:n*(p.checkSeconds||90);
  if(limit&&!b.deadline){b.deadline=b.started+limit*1000;}if(limit)b.timed=true;
  b.pendingAnswers=b.pendingAnswers||[];b.firstPick=b.firstPick||[];b.changedAt=b.changedAt||[];b.spent=b.spent||[];
  b.answers.forEach(function(a,j){if(a&&!b.pendingAnswers[j])b.pendingAnswers[j]=a;});
  var autoEnd=opt.mixed&&opt.timed;
  function submit(expired){
    if(b.done)return;
    refs.forEach(function(r,j){var q=qget(r);b.answers[j]=b.pendingAnswers[j]||null;b.seconds=b.seconds||[];b.seconds[j]=Math.round((b.spent[j]||0)/1000);b.expiredItems=b.expiredItems||[];b.expiredItems[j]=!autoEnd&&!!b.deadline&&(b.changedAt[j]||0)>b.deadline;if(typeof recordExposure==='function')recordExposure(q.id,'class',b.answers[j]?b.answers[j]===q.answer:null);});
    b.done=true;b.expired=!!expired;b.ended=Date.now();delete b.viewStart;save();post(id,refs,b);done();}
  if(autoEnd&&Date.now()>=b.deadline)return submit(true);
  var i=Math.max(0,Math.min(b.index||0,n-1)),q=qget(refs[i]),selected=b.pendingAnswers[i],confirm=false;b.index=i;b.viewStart=Date.now();
  if(typeof recordExposure==='function')recordExposure(q.id,'class');
  function leave(){if(b.viewStart){b.spent[i]=(b.spent[i]||0)+(Date.now()-b.viewStart);delete b.viewStart;}}
  function go(j){leave();b.index=j;save();runSet(id,refs,opt,done,b);}
  var unanswered=function(){return refs.filter(function(r,j){return !b.pendingAnswers[j];}).length;};
  paint('<p class="cnote"><b>'+esc(opt.label||'Practice')+'</b> · Question '+(i+1)+' of '+n+(opt.mixed?' · results after you submit':'')+'</p>'+
    navRow(refs,i,function(j){return !!b.pendingAnswers[j];})+
    (limit?'<p id="gcTime" role="timer" aria-live="off"></p>':'')+'<p class="cnote">'+esc(opt.prompt||cue)+'</p>'+questionHtml(q,false,selected)+
    '<div class="crow">'+(i>0?btn('gcPrev','Previous',true):'')+(i<n-1?btn('gcNext','Next'):'')+btn('gcSubmit',opt.mixed?'Submit mixed check':'Submit',i<n-1)+'</div><p id="gcStatus" role="status"></p>');
  document.querySelectorAll('#gcOptions .copt').forEach(function(el){el.onclick=function(){selected=el.dataset.letter;b.pendingAnswers[i]=selected;if(!b.firstPick[i])b.firstPick[i]=selected;b.changedAt[i]=Date.now();save();
    document.querySelectorAll('#gcOptions .copt').forEach(function(e){e.classList.toggle('sel',e===el);e.setAttribute('aria-pressed',String(e===el));});if(node('gcQ'+i))node('gcQ'+i).textContent=(i+1)+' ✓';};});
  decorate(id,q);
  wire('gcPrev',function(){go(i-1);});wire('gcNext',function(){go(i+1);});
  refs.forEach(function(r,j){wire('gcQ'+j,function(){if(j!==i)go(j);});});
  wire('gcSubmit',function(){var u=unanswered();if(u&&!confirm){confirm=true;node('gcStatus').textContent=u+' question'+(u===1?' is':'s are')+' unanswered. Press Submit again to finish, or go back to '+(u===1?'it':'them')+'.';return;}leave();submit(false);});
  if(limit){var tick=function(){var left=Math.max(0,Math.ceil((b.deadline-Date.now())/1000));
      if(left){if(node('gcTime'))node('gcTime').textContent=clock(left)+' left';return;}
      stop();if(autoEnd){leave();return submit(true);}
      if(!b.atDeadline){b.atDeadline=refs.map(function(r,j){return b.pendingAnswers[j]||null;});save();}
      if(node('gcTime'))node('gcTime').textContent='Time is up. Finish and submit; answers chosen now are saved as over time.';};
    tick();if(Date.now()<b.deadline)timer=setInterval(tick,250);}
  save();}

// Worked examples, similar questions and single warm-ups: explanation after each Check; page back and forward.
function runImmediate(id,refs,opt,done,b){
  var n=refs.length,i=Math.max(0,Math.min(b.index||0,n-1)),q=qget(refs[i]),locked=b.answers[i]!==undefined&&b.answers[i]!==null,last=i===n-1;b.index=i;
  b.pendingAnswers=b.pendingAnswers||[];b.firstPick=b.firstPick||[];var selected=locked?b.answers[i]:b.pendingAnswers[i];
  if(!b.itemStarted||b.itemFor!==i){b.itemStarted=Date.now();b.itemFor=i;}
  if(typeof recordExposure==='function')recordExposure(q.id,'class');
  function finish(){refs.forEach(function(r,j){if(b.answers[j]===undefined)b.answers[j]=null;});b.done=true;b.ended=Date.now();save();post(id,refs,b);done();}
  function go(j){b.index=j;save();runImmediate(id,refs,opt,done,b);}
  paint('<p class="cnote"><b>'+esc(opt.label||'Practice')+'</b> · '+(i+1)+' of '+n+'</p>'+navRow(refs,i,function(j){return b.answers[j]!=null;})+
    '<p class="cnote">'+esc(opt.prompt||cue)+'</p>'+(locked?feedback(q,b,i):questionHtml(q,false,selected))+
    '<div class="crow">'+(i>0?btn('gcPrev','Previous',true):'')+(locked?'':btn('gcLock','Check answer'))+(last?btn('gcNext','Finish',!locked):btn('gcNext','Next',!locked))+'</div><p id="gcStatus" role="status"></p>');
  if(!locked){document.querySelectorAll('#gcOptions .copt').forEach(function(el){el.onclick=function(){selected=el.dataset.letter;b.pendingAnswers[i]=selected;if(!b.firstPick[i])b.firstPick[i]=selected;save();document.querySelectorAll('#gcOptions .copt').forEach(function(e){e.classList.toggle('sel',e===el);e.setAttribute('aria-pressed',String(e===el));});};});decorate(id,q);}
  wire('gcLock',function(){if(!selected){node('gcStatus').textContent='Select an answer.';return;}
    b.answers[i]=selected;b.notes[i]=b.notes[i]||'';b.help[i]=b.help[i]||'unrecorded';b.seen[i]=b.seen[i]===undefined?null:b.seen[i];b.seconds=b.seconds||[];b.seconds[i]=Math.round((Date.now()-b.itemStarted)/1000);
    if(typeof recordExposure==='function')recordExposure(q.id,'class',selected===q.answer);save();go(i);});
  wire('gcPrev',function(){go(i-1);});wire('gcNext',function(){if(last)finish();else go(i+1);});
  refs.forEach(function(r,j){wire('gcQ'+j,function(){if(j!==i)go(j);});});
  save();}

home();}
window.GrammarClass={render:render};
})();
