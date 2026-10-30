// Grammar review route: one guided path through the class.
// The home screen lists the steps in order with a single Start/Continue button; any step can still be opened.
// A section runs: lesson and cue -> worked example -> independent check -> similar question if missed.
// The student is never asked to type or to fill in tutor fields. First answers, timings, answers given
// after the time limit, and deadlines are saved and survive reload. Same-day work never awards mastery credit.
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
  var rows=refs.map(function(r,i){var q=qget(r);return {id:q.id,skill:q.skill,difficulty:ctx.difficulty?ctx.difficulty(q):q.difficulty,chosen:b.answers[i]||null,correct:q.answer,isCorrect:b.answers[i]===q.answer,seconds:b.seconds&&b.seconds[i]||0,
    prediction:(b.notes[i]||'Reasoning given aloud or on paper')+'\nConditions: '+id+'; help: '+(b.help[i]||'unrecorded')+'; recognised: '+(b.seen[i]===true?'yes':b.seen[i]===false?'no':'unrecorded')+(b.expired?'; mixed time expired':'')+(late(b,i)?'; answered after the time limit (selection at the limit: '+((b.atDeadline&&b.atDeadline[i])||'none')+')':''),
    help:b.help[i]||'unrecorded',recognised:b.seen[i]===true?true:b.seen[i]===false?false:null,late:late(b,i)};});
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
  html+='<div class="cbox">'+list.map(function(x,i){var mark=x.done()?' · '+x.status():(x===next?' · next':'');return '<div class="crow" style="align-items:center;justify-content:space-between"><span><b>'+esc(x.label)+'</b>'+esc(mark)+'</span>'+btn(x.id,x.done()?'Review':'Open',true)+'</div>';}).join('')+'</div>';
  if(p.probe||p.launch)html+='<div class="crow">'+(p.probe?btn('gcProbe','Extra: Hard verb question',true):'')+(p.launch?btn('gcLaunch','Open existing homework question',true):'')+'</div>';
  paint(html,true);
  wire('gcGo',nextStep);list.forEach(function(x){wire(x.id,x.open);});
  wire('gcProbe',function(){run('probe',[p.probe],{immediate:true,independent:false,prompt:cue},home);});
  wire('gcLaunch',function(){run('launch',[p.launch],{immediate:true,independent:false,prompt:cue},home);});
  save();}
function nextButton(){return btn('gcNextStep',steps().some(function(x){return !x.done();})?'Next step':'All steps');}
function opening(){run('opening',openingRefs,{immediate:!p.openingItems,prompt:p.openingPrompt||cue},function(){
  paint('<h2>Warm-up · '+score('opening',openingRefs)+' / '+openingRefs.length+'</h2>'+openingRefs.map(function(r,i){return feedback(qget(r),block('opening'),i);}).join('')+'<div class="crow">'+nextButton()+'</div>');wire('gcNextStep',nextStep);});}

// ---- one section: lesson -> example -> check -> similar question ---------
function section(f){
  if(has(f.id+'-checks')){if(block(f.id+'-checks').done)return familyResult(f);return startCheck(f);}
  lesson(f);}
function lesson(f){
  var modelled=has(f.id+'-models')&&block(f.id+'-models').done,n=(f.checks||[]).length;
  paint('<div class="cbox"><h2>'+esc(f.title)+'</h2><p>'+esc(f.lesson)+'</p>'+(f.cue?'<div class="cmsg"><b>The check:</b> '+esc(f.cue)+'</div>':'')+'</div><div class="crow">'+
    (modelled?btn('gcChecks','Your turn · '+n+' question'+(n===1?'':'s')+' · '+clock(p.checkSeconds||90)+' each')+btn('gcModels','Worked example again',true)
             :btn('gcModels','Worked example')+btn('gcChecks','Skip to the check',true))+'</div>');
  wire('gcModels',function(){run(f.id+'-models',f.models,{immediate:true,model:true,prompt:f.prompt||cue},function(){startCheck(f);});});
  wire('gcChecks',function(){startCheck(f);});}
function startCheck(f){run(f.id+'-checks',f.checks,{prompt:f.prompt||cue},function(){familyResult(f);});}
function familyResult(f){
  var b=block(f.id+'-checks'),n=score(f.id+'-checks',f.checks),missed=n<f.checks.length,rb=has(f.id+'-reserve')?block(f.id+'-reserve'):null,offer=missed&&f.reserve&&!(rb&&rb.done);
  var html='<h2>'+esc(f.title)+' · '+n+' / '+f.checks.length+'</h2>'+f.checks.slice(0,b.answers.length).map(function(r,i){return feedback(qget(r),b,i);}).join('');
  if(rb&&rb.done)html+='<h3>Similar question</h3>'+feedback(qget(f.reserve),rb,0);
  html+='<div class="crow">'+(offer?btn('gcRepair','Try a similar question')+btn('gcNextStep','Next step',true):nextButton())+btn('gcLesson','Lesson again',true)+'</div>';
  paint(html);
  wire('gcRepair',function(){run(f.id+'-reserve',[f.reserve],{immediate:true,independent:false,prompt:f.prompt||cue},function(){familyResult(f);});});
  wire('gcNextStep',nextStep);wire('gcLesson',function(){lesson(f);});}

// ---- mixed check ---------------------------------------------------------
function mixed(){
  if(s.mixedStarted)return run('mixed',s.mixedRefs,{mixed:true,timed:!!block('mixed').timed,prompt:cue},mixedResult);
  var timed=timedMixed();s.mixedRefs=p.mixed.map(function(r){return {bankId:r.bankId};});s.mixedStarted=true;
  var b=block('mixed');b.timed=timed;b.started=Date.now();if(timed)b.deadline=b.started+p.seconds*1000;save();
  run('mixed',s.mixedRefs,{mixed:true,timed:timed,prompt:cue},mixedResult);}
function mixedResult(){paint('<h2>Mixed check · '+score('mixed',s.mixedRefs)+' / '+s.mixedRefs.length+'</h2>'+s.mixedRefs.map(function(r,i){return feedback(qget(r),block('mixed'),i);}).join('')+'<div class="crow">'+nextButton()+'</div>');wire('gcNextStep',nextStep);}

// ---- one question at a time ---------------------------------------------
function run(id,refs,opt,done){
  var b=block(id);b.started=b.started||Date.now();
  if(b.done){
    if(opt.mixed)return mixedResult();
    if(opt.immediate){paint(refs.map(function(r,i){return feedback(qget(r),b,i);}).join('')+'<div class="crow">'+btn('gcNext','Continue')+'</div>');wire('gcNext',done);return;}
    return done();}
  if(opt.timed&&Date.now()>=b.deadline){b.done=true;b.expired=true;b.ended=Date.now();save();post(id,refs,b);return mixedResult();}
  var i=b.index,q=qget(refs[i]);b.itemStarted=b.itemStarted||Date.now();
  var itemLimit=!opt.model&&!opt.mixed&&opt.independent!==false?(p.checkSeconds||90):0;
  if(itemLimit){b.timed=true;b.itemDeadlines=b.itemDeadlines||[];b.itemDeadlines[i]=b.itemDeadlines[i]||b.itemStarted+itemLimit*1000;}
  if(typeof recordExposure==='function')recordExposure(q.id,'class');
  var locked=b.answers[i]!==undefined,last=i===refs.length-1;
  function advance(){if(b.answers[i]===undefined)return;delete b.itemStarted;b.index++;if(b.index===refs.length){b.done=true;b.ended=Date.now();save();post(id,refs,b);return done();}save();run(id,refs,opt,done);}
  if(locked&&opt.immediate){paint(feedback(q,b,i)+'<div class="crow">'+btn('gcNext',last?'Finish':'Next')+'</div>');wire('gcNext',advance);return;}
  paint('<p class="cnote"><b>'+(opt.mixed?'Mixed check':opt.model?'Worked example':'Your turn')+'</b> · '+(i+1)+' of '+refs.length+'</p>'+
    (opt.timed||itemLimit?'<p id="gcTime" role="timer" aria-live="off"></p>':'')+
    '<p class="cnote">'+esc(opt.prompt||cue)+'</p>'+
    '<div class="cq">'+esc(q.passage).replace(/\n/g,'<br>')+'</div><p><b>'+esc(q.question)+'</b></p>'+
    '<div id="gcOptions">'+q.options.map(function(o,j){return '<button type="button" class="copt" data-letter="'+'ABCD'[j]+'"'+(locked?' disabled':'')+'>'+esc(o)+'</button>';}).join('')+'</div>'+
    '<div id="gcVerdict" aria-live="polite"></div><div class="crow">'+(locked?btn('gcNext',last?'Finish':'Next'):btn('gcLock','Check answer'))+'</div><p id="gcStatus" role="status"></p>');
  b.pendingAnswers=b.pendingAnswers||[];var selected=locked?b.answers[i]:b.pendingAnswers[i];
  document.querySelectorAll('#gcOptions .copt').forEach(function(el){if(el.dataset.letter===selected)el.classList.add('sel');el.onclick=function(){selected=el.dataset.letter;b.pendingAnswers[i]=selected;save();document.querySelectorAll('#gcOptions .copt').forEach(function(e){e.classList.toggle('sel',e===el);});};});
  if(typeof Eliminator!=='undefined')Eliminator.decorate(node('gcOptions'),{ns:'grammar:'+ctx.student+':'+ctx.set.setId+':'+id,id:q.id,selector:'.copt'});
  if(locked){node('gcVerdict').innerHTML=opt.mixed?'<p>Answer saved. Results come after the mixed check.</p>':'<p><b>'+(b.answers[i]===null?'No answer recorded.':b.answers[i]===q.answer?'Right.':'Not yet.')+'</b> '+(last?'The explanation comes next.':'Explanations come after this check.')+'</p>';
    if(late(b,i))node('gcStatus').textContent='Answered after the time limit.';}
  function overItem(){return itemLimit&&Date.now()>=b.itemDeadlines[i];}
  function commitCurrent(){
    if(b.answers[i]!==undefined)return;
    if(opt.timed&&Date.now()>=b.deadline)return run(id,refs,opt,done);
    if(!selected){node('gcStatus').textContent='Select an answer.';return;}
    var over=overItem();
    b.answers[i]=selected;b.notes[i]=b.notes[i]||'';b.help[i]=b.help[i]||'unrecorded';b.seen[i]=b.seen[i]===undefined?null:b.seen[i];
    b.seconds=b.seconds||[];b.seconds[i]=Math.round((Date.now()-b.itemStarted)/1000);
    b.expiredItems=b.expiredItems||[];b.expiredItems[i]=!!over;
    if(typeof recordExposure==='function')recordExposure(q.id,'class',selected===q.answer);
    save();run(id,refs,opt,done);}
  wire('gcLock',commitCurrent);wire('gcNext',advance);
  if(itemLimit&&!locked){
    var itemTick=function(){var left=Math.max(0,Math.ceil((b.itemDeadlines[i]-Date.now())/1000));
      if(left){if(node('gcTime'))node('gcTime').textContent=clock(left)+' left for this question';return;}
      stop();b.atDeadline=b.atDeadline||[];if(b.atDeadline[i]===undefined){b.atDeadline[i]=selected||null;save();}
      if(node('gcTime'))node('gcTime').textContent='Time is up. Choose your best answer and press Check; it is saved as over time.';};
    itemTick();if(!overItem())timer=setInterval(itemTick,250);}
  if(opt.timed){
    var tick=function(){var left=Math.max(0,Math.ceil((b.deadline-Date.now())/1000));if(node('gcTime'))node('gcTime').textContent=clock(left)+' left';if(!left)run(id,refs,opt,done);};
    tick();if(!b.done)timer=setInterval(tick,500);}
  save();}

home();}
window.GrammarClass={render:render};
})();
