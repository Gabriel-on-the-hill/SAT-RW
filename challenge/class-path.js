// Optional ordered learning route. Teaching checks are not mastery credits.
(function () {
  'use strict';
  var sessions = Object.create(null);
  function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function el(id) { return document.getElementById(id); }
  function button(id, text, ghost, disabled) { return '<button class="cbtn'+(ghost?' ghost':'')+'" id="'+id+'"'+(disabled?' disabled':'')+'>'+esc(text)+'</button>'; }
  function wire(id, fn) { if (el(id)) el(id).onclick = fn; }
  function state(ctx) {
    var key = ctx.student + ':' + ctx.set.setId;
    return sessions[key] || (sessions[key] = { taught:false, passed:false, form:0, transferStarted:false, transferDone:false, exited:false });
  }
  function render(ctx) {
    var path = ctx.set.learningPath, s = state(ctx);
    function paint(body) {
      ctx.paint(ctx.header() + body + '<div class="crow">'+button('lpHub','Back to hub',true)+'</div>');
      wire('lpHub',ctx.back);
    }
    function home() {
      var status = !s.taught ? 'Start with the learning route.' : !s.passed ? 'Complete four fresh checks before starting the clock.' : !s.transferDone ? 'The four checks passed. Close your notes for the independent set.' : !s.exited ? 'Review the misses and slow answers with your tutor, then try the exit checks.' : 'Class route complete. Return to the methods on your agreed practice days.';
      paint('<div class="cbox"><p>'+esc(path.intro)+'</p><p class="cnote">'+esc(path.order)+'</p></div><div class="cmsg">'+esc(status)+'</div><div class="crow">'+
        button('lpLearn',s.taught?'Revisit the learning route':'Start the learning route',true)+
        (s.taught&&!s.passed&&s.form<path.gates.length?button('lpGate','Four fresh checks'): '')+
        (s.passed&&!s.transferStarted?button('lpTransfer','Independent set: six questions, seven minutes'): '')+
        (s.transferStarted&&!s.transferDone?'<p class="cnote">Your independent set has started. Finish it before doing the exit checks. If you left it unfinished, use Resume on the hub.</p>':'')+
        (s.transferDone&&!s.exited?button('lpExit','Two exit checks'): '')+
        ((s.taught&&!s.passed)||s.exited?button('lpPractice','Untimed rehearsal',true): '')+'</div>'+
        (s.taught&&!s.passed&&s.form>=path.gates.length?'<div class="cmsg">Keep the clock off today. Rehearse the deciding methods with your tutor and check them on a different example.</div>':'')+
        (s.exited?'<div class="cbox"><b>Between classes</b><p>'+esc(path.schedule)+'</p></div>':'')+
        '<p class="cnote">Teaching answers and these four checks do not award mastery. Explain the deciding structure to your tutor; selecting an answer alone does not establish understanding. The route starts again after a page reload.</p>');
      wire('lpLearn',function(){ teach(s.repair ? s.repair.map(function(i){return path.steps[i];}) : path.steps, false); });
      wire('lpGate',gate);
      wire('lpExit',function(){teach(path.exit, true);});
      wire('lpPractice',function(){ctx.practice(6);});
      wire('lpTransfer',function(){
        if (!s.passed || s.transferStarted) return;
        var resolved = path.transfer.map(function(id){return ctx.bank.find(function(q){return q.id===id;});});
        if (resolved.some(function(q){return !q;})) { paint('<div class="cbanner">The independent set is incomplete. Ask your tutor to check its question list.</div>'); return; }
        // The authored transfer item is not in the scored challenge denominator.
        if(path.transferOriginal) resolved.splice(1,0,path.transferOriginal);
        if(ctx.transfer(resolved,420)) s.transferStarted=true;
      });
    }
    function teach(qs, exit) {
      var i=0, follow=false;
      function show() {
        var base=qs[i], q=follow?base.followUp:base, answered=false, missed=false;
        paint('<div class="cnote"><b>'+(exit?'Exit check':'Learning step')+' '+(i+1)+' of '+qs.length+'</b> · '+esc(base.stage)+(follow?' · different example':'')+'</div>'+
          (q.note?'<div class="cbox">'+esc(q.note).replace(/\n/g,'<br>')+'</div>':'')+
          '<div class="cq">'+esc(q.passage).replace(/\n/g,'<br>')+'</div><div class="cq"><b>'+esc(q.question)+'</b></div>'+
          '<label for="lpReason">Before choosing, give your deciding clue or structure (a short phrase is enough).</label><textarea id="lpReason" rows="2" style="display:block;width:100%;box-sizing:border-box;font:inherit;margin:.5rem 0;padding:.65rem" aria-describedby="lpPrompt"></textarea><div id="lpPrompt" class="cnote">Your tutor checks this reason. It is not graded automatically.</div>'+
          button('lpCommit','Commit the clue',true,true)+'<div id="lpOptions" style="display:none">'+q.options.map(function(o,j){return '<button class="copt" data-i="'+j+'">'+esc(o)+'</button>';}).join('')+'</div><div id="lpFeedback" aria-live="polite"></div><div class="crow">'+button('lpNext','Continue',false,true)+'</div>');
        el('lpReason').oninput=function(){el('lpCommit').disabled=el('lpReason').value.trim().length<2;};
        wire('lpCommit',function(){if(el('lpReason').value.trim().length<2)return;el('lpReason').disabled=true;el('lpCommit').style.display='none';el('lpOptions').style.display='block';});
        Array.prototype.forEach.call(document.querySelectorAll('#lpOptions button'),function(b){b.onclick=function(){
          if(answered || el('lpOptions').style.display==='none')return;
          if(el('lpReason').value.trim().length<2){el('lpPrompt').textContent='Add your deciding clue before choosing.';el('lpReason').focus();return;}
          answered=true;missed=Number(b.dataset.i)!==q.answer;
          el('lpReason').disabled=true;
          Array.prototype.forEach.call(document.querySelectorAll('#lpOptions button'),function(x){x.disabled=true;if(Number(x.dataset.i)===q.answer)x.classList.add('right');else if(x===b)x.classList.add('wrong');});
          el('lpFeedback').innerHTML='<div class="cexpl"><b>'+(missed?'Repair: ':'Correct: ')+'</b>'+esc(q.explanation)+'</div>';
          el('lpNext').disabled=false;
          if(missed&&!follow&&base.followUp)el('lpNext').textContent='Try a different example';
        };});
        wire('lpNext',function(){
          if(!answered)return;
          if(missed&&!follow&&base.followUp){follow=true;show();return;}
          follow=false;i++;
          if(i<qs.length){show();return;}
          if(exit)s.exited=true;else s.taught=true;
          home();
        });
      }
      show();
    }
    function gate() {
      if(!s.taught||s.passed||s.form>=path.gates.length)return;
      var qs=path.gates[s.form], answers=[], i=0;
      function show() {
        var q=qs[i];
        paint('<div class="cnote"><b>Fresh check '+(i+1)+' of '+qs.length+'</b> · notes closed · no hints</div><div class="cq">'+esc(q.passage)+'</div><div class="cq"><b>'+esc(q.question)+'</b></div><div id="lpOptions">'+q.options.map(function(o,j){return '<button class="copt" data-i="'+j+'">'+esc(o)+'</button>';}).join('')+'</div><div class="crow">'+button('lpNext',i===qs.length-1?'Submit all four':'Commit and continue',false,true)+'</div>');
        Array.prototype.forEach.call(document.querySelectorAll('#lpOptions button'),function(b){b.onclick=function(){answers[i]=Number(b.dataset.i);document.querySelectorAll('#lpOptions button').forEach(function(x){x.style.borderColor=x===b?'#7c3aed':'';});el('lpNext').disabled=false;};});
        wire('lpNext',function(){if(answers[i]===undefined)return;i++;if(i<qs.length){show();return;}
          var score=answers.filter(function(a,j){return a===qs[j].answer;}).length;
          s.form++;s.passed=score===qs.length;
          if (!s.passed) { s.taught=false; s.repair=qs.filter(function(q,j){return answers[j]!==q.answer;}).map(function(q){return q.step;}); }
          else s.repair=null;
          paint('<div class="cmsg '+(s.passed?'ok':'')+'"><b>'+score+' / '+qs.length+'</b> — '+(s.passed?'All four first answers are correct. Explain the deciding structures to your tutor before the timed set.':'Keep the clock off. Repair the missed structures, then use a different set of checks.')+'</div>'+qs.map(function(q,j){return '<div class="cexpl"><b>Check '+(j+1)+': '+(answers[j]===q.answer?'correct':'repair')+'</b><br>'+esc(q.explanation)+'</div>';}).join('')+'<div class="crow">'+button('lpHome','Return to class route')+'</div>');
          wire('lpHome',home);
        });
      }
      show();
    }
    home();
  }
  window.ChallengeLearning = {render:render, completeTransfer:function(ctx){state(ctx).transferDone=true;}};
})();
