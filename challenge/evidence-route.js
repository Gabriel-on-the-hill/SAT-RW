// An untimed class route. First responses are retained; teaching is not mastery credit.
(function () {
  'use strict';
  var previous = window.ChallengeLearning;
  function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function el(id) { return document.getElementById(id); }
  function btn(id, label, disabled) { return '<button class="cbtn" id="'+id+'"'+(disabled?' disabled':'')+'>'+esc(label)+'</button>'; }
  function wire(id, fn) { if (el(id)) el(id).onclick = fn; }
  function storageKey(ctx) { return 'satrw_sat_class_route:'+ctx.student+':'+ctx.set.setId; }
  function load(ctx) {
    try { var saved = JSON.parse(localStorage.getItem(storageKey(ctx))); if(saved && saved.version===1) return saved; } catch(e) {}
    return { version:1, sessionId:'class_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8), block:0, rows:[], choices:{}, posted:{} };
  }
  function render(ctx) {
    var path=ctx.set.learningPath, s=load(ctx), key=storageKey(ctx), storageFailed=false;
    function save() { try { localStorage.setItem(key,JSON.stringify(s)); } catch(e) { storageFailed=true; if(el('erStorage')) el('erStorage').textContent='This browser could not save the route. Download the class record before leaving.'; } }
    function paint(html) {
      ctx.paint(ctx.header()+'<p class="cnote">Untimed class work · first answers retained · no mastery credits</p>'+html+'<p id="erStorage" role="status" class="cnote">'+(storageFailed?'This browser could not save the route. Download the class record before leaving.':'Responses stay on this browser when you leave or reload.')+'</p><div class="crow">'+btn('erDownload','Download class record')+btn('erHub','Back to hub')+'</div>');
      wire('erHub',ctx.back); wire('erDownload',download);
    }
    function download() {
      var blob=new Blob([JSON.stringify({student:ctx.student,setId:ctx.set.setId,title:ctx.set.title,record:s},null,2)],{type:'application/json'});
      var url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=ctx.set.setId+'-class-record.json'; a.click(); URL.revokeObjectURL(url);
    }
    function question(item) { return ctx.bank.find(function(q){return q.id===item.id;}); }
    function passage(q) {
      // The graph supplies the visual; omit its flattened OCR from the prose.
      var text=q.passage;
      var marker=path.graphTextStarts && path.graphTextStarts[q.id];
      if(q.image && marker && text.indexOf(marker)>=0) text=text.slice(text.indexOf(marker));
      var image=q.image && /^assets\/[\w.-]+\.(png|jpg|svg)$/i.test(q.image) ? '<img src="'+esc(q.image)+'" alt="'+esc((path.graphAlts||{})[q.id]||'Question graph')+'" style="max-width:100%;height:auto;display:block;margin:1rem auto">' : '';
      return image+'<div class="cq">'+esc(text).replace(/&lt;u&gt;/g,'<u>').replace(/&lt;\/u&gt;/g,'</u>').replace(/\n/g,'<br>')+'</div><div class="cq"><b>'+esc(q.question)+'</b></div>';
    }
    function items(block) {
      if(block.exit) {
        var used=new Set(s.rows.map(function(r){return r.id;}));
        return [block.items.find(function(item){return !used.has(item.id);})].filter(Boolean);
      }
      return block.alternatives ? block.alternatives[s.choices[block.key]].items : block.items;
    }
    function firstRows(block) { return s.rows.filter(function(r){return r.block===block.key;}); }
    function post(block) {
      if(s.posted[block.key] || typeof syncSessionToSheet!=='function') return;
      var rows=firstRows(block), answered=rows.filter(function(r){return r.chosen!==null;}), qs=rows.map(function(r){
        var q=question(r); return {id:r.id,skill:q.skill,difficulty:q.difficulty,chosen:r.chosen||'',correct:q.answer,isCorrect:r.chosen===null?null:r.isCorrect,secs:0,trap:q.trapName||'',prediction:r.prediction+'\nExplanation: '+r.reason+'\nConditions: '+r.role+'; help: '+r.help+'; recognised: '+r.recognised};
      });
      // Teaching/discussion time is deliberately not reported as independent pace.
      syncSessionToSheet({student:ctx.student,date:new Date().toISOString(),sessionId:s.sessionId+'_'+block.key,source:'class-practice',assignmentId:ctx.set.setId,assignmentTitle:ctx.set.title+' · '+block.title,mode:'untimed-class',score:answered.filter(function(r){return r.isCorrect;}).length,total:answered.length,skills:Array.from(new Set(qs.map(function(q){return q.skill;}))),diffs:Array.from(new Set(qs.map(function(q){return q.difficulty;}))),questions:qs});
      s.posted[block.key]=true;save();
    }
    function assess(row) {
      return '<label>Help actually used <select class="erHelp" data-id="'+row.id+'">'+[['unrecorded','Choose after the attempt'],['none','No tutor help'],['process','Process cue'],['direction','Directional cue'],['model','Modelled']].map(function(o){return '<option value="'+o[0]+'"'+(row.help===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></label>';
    }
    function review(block) {
      var rows=firstRows(block);
      paint('<h2>'+esc(block.title)+' · review</h2><p>'+esc(block.review)+'</p>'+rows.map(function(r){var q=question(r);return '<div class="cbox"><b>'+esc(r.id)+' · '+(r.chosen===null?'Not attempted':esc(r.chosen)+' · '+(r.isCorrect?'correct':'repair'))+'</b><p><b>Your prediction:</b> '+esc(r.prediction)+'</p><p><b>Your explanation:</b> '+esc(r.reason)+'</p><p>'+esc(q.explanation)+'</p>'+assess(r)+'</div>';}).join('')+btn('erContinue','Continue the route'));
      document.querySelectorAll('.erHelp').forEach(function(select){select.onchange=function(){rows.find(function(r){return r.id===select.dataset.id;}).help=select.value;save();};});
      wire('erContinue',function(){post(block);s.block++;s.draft=null;save();home();});
    }
    function run(block) {
      var list=items(block), i=firstRows(block).length;
      if(i>=list.length) { review(block);return; }
      var item=list[i], q=question(item);
      if(!q) { paint('<div class="cbanner">A question is missing. Return to the hub and ask your tutor to check the class route.</div>');return; }
      var draft=s.draft && s.draft.id===q.id ? s.draft : {id:q.id,prediction:'',reason:'',chosen:null,revealed:false,recognised:false};
      s.draft=draft;save();
      paint('<h2>'+esc(block.title)+' · '+(i+1)+' of '+list.length+'</h2>'+(item.cue?'<div class="cbox">'+esc(item.cue)+'</div>':'')+passage(q)+
        '<label for="erPrediction">Your prediction</label><textarea id="erPrediction" rows="2" style="width:100%;box-sizing:border-box;font:inherit">'+esc(draft.prediction)+'</textarea>'+btn('erReveal','Commit prediction and show choices',!draft.prediction.trim())+
        '<div id="erChoices"'+(draft.revealed?'':' hidden')+'>'+q.options.map(function(o,j){var letter=String.fromCharCode(65+j);return '<button class="copt" data-answer="'+letter+'"'+(draft.chosen===letter?' aria-pressed="true"':' aria-pressed="false"')+'>'+esc(o)+'</button>';}).join('')+
        '<label for="erReason">'+esc(item.reasonPrompt||'Explain your decision in your own words.')+'</label><textarea id="erReason" rows="3" style="width:100%;box-sizing:border-box;font:inherit">'+esc(draft.reason)+'</textarea>'+btn('erCommit','Commit first answer',!(draft.chosen&&draft.reason.trim()))+'</div>'+
        '<p><label><input id="erRecognised" type="checkbox"'+(draft.recognised?' checked':'')+'> I recognise this question</label></p>'+btn('erSkip','Leave unanswered'));
      el('erPrediction').disabled=draft.revealed;el('erReveal').hidden=draft.revealed;
      function update() { draft.prediction=el('erPrediction').value;draft.reason=el('erReason').value;draft.recognised=el('erRecognised').checked;save();el('erReveal').disabled=!draft.prediction.trim();el('erCommit').disabled=!(draft.chosen&&draft.reason.trim()); }
      el('erPrediction').oninput=update;el('erReason').oninput=update;el('erRecognised').onchange=update;
      wire('erReveal',function(){update();if(!draft.prediction.trim())return;draft.revealed=true;save();run(block);});
      document.querySelectorAll('#erChoices [data-answer]').forEach(function(b){b.onclick=function(){if(!draft.revealed)return;draft.chosen=b.dataset.answer;document.querySelectorAll('#erChoices [data-answer]').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false');x.style.borderColor=x===b?'#7c3aed':'';});update();};});
      var committed=false;
      function commit(skip) {
        if(committed)return;
        update();if(!skip&&(!draft.revealed||!draft.chosen||!draft.reason.trim()))return;
        committed=true;
        s.rows.push({block:block.key,id:q.id,role:item.role,prediction:draft.prediction,reason:draft.reason,chosen:skip?null:draft.chosen,isCorrect:skip?null:draft.chosen===q.answer,recognised:draft.recognised,help:item.role==='modelled'?'model':'unrecorded',date:new Date().toISOString()});
        s.draft=null;save();
        // Met, not mastered: the exposure record keeps this item out of the unseen tier of later draws. No ledger row.
        if(typeof recordExposure==='function') recordExposure(q.id,'class',skip?null:draft.chosen===q.answer);
        // Opening answers are both committed before either explanation appears.
        if(block.batchFeedback && firstRows(block).length<list.length) run(block);else review(block);
      }
      wire('erCommit',function(){commit(false);});wire('erSkip',function(){commit(true);});
    }
    function finish() {
      paint('<h2>Class record</h2><p>'+esc(path.schedule)+'</p><p>Use the quality of the reasoning and the help recorded to agree the next practice. A correct letter alone is not a readiness test. Recognised items and modelled work are separate from fresh independent work.</p>'+s.rows.map(function(r){return '<div class="cbox"><b>'+esc(r.id)+' · '+esc(r.role)+'</b><p>'+ (r.chosen===null?'Not attempted':esc(r.chosen)+' · '+(r.isCorrect?'correct':'repair'))+' · help: '+esc(r.help)+(r.recognised?' · recognised':'')+'</p><p>'+esc(r.prediction)+'</p><p>'+esc(r.reason)+'</p></div>';}).join(''));
    }
    function home() {
      if(s.finishedAt){finish();return;}
      if(s.block>=path.blocks.length){finish();return;}
      var block=path.blocks[s.block];
      if((block.alternatives && s.choices[block.key]!==undefined)||(!block.alternatives && s.choices[block.key]==='start')||s.draft||firstRows(block).length) { run(block);return; }
      paint('<p>'+esc(path.intro)+'</p><p class="cnote">'+esc(path.order)+'</p><h2>'+esc(block.title)+'</h2><p>'+esc(block.intro)+'</p>'+ (block.alternatives?block.alternatives.map(function(a,j){return btn('erBranch'+j,a.label);}).join(' '):btn('erStart','Start this step'))+(block.optional?btn('erDefer','Defer this extension'):'')+btn('erFinish','Finish class and keep the record'));
      wire('erStart',function(){s.choices[block.key]='start';save();run(block);});
      (block.alternatives||[]).forEach(function(a,j){wire('erBranch'+j,function(){s.choices[block.key]=j;save();run(block);});});
      wire('erDefer',function(){s.choices[block.key]='deferred';s.block++;save();home();});
      wire('erFinish',function(){s.finishedAt=new Date().toISOString();save();finish();});
    }
    home();
  }
  window.ChallengeLearning={render:function(ctx){
    if(ctx.set.learningPath.route==='target-evidence')render(ctx);
    else if(previous)previous.render(ctx);
    else ctx.paint(ctx.header()+'<div class="cbanner">The class route did not load. Reload the page before starting.</div>');
  },completeTransfer:function(ctx){if(previous)previous.completeTransfer(ctx);}};
})();
