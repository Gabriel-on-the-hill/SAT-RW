(function(){
  'use strict';
  var S=HomeworkSelection, prefix=document.body.dataset.homeworkPrefix;
  var QB=[].concat(typeof questionBank_CS!=='undefined'?questionBank_CS:[],typeof questionBank_EOI!=='undefined'?questionBank_EOI:[],
    typeof questionBank_II!=='undefined'?questionBank_II:[],typeof questionBank_CON!=='undefined'?questionBank_CON:[]);
  if(prefix==='psat89')QB=QB.map(function(q){return Object.assign({},q,{difficulty:q.psatDifficulty||q.difficulty});});
  var map=S.index(QB), skills=Array.from(new Set(QB.map(function(q){return q.skill;}))).sort();
  var labels={SVA:'Subject–verb agreement',VForm:'Verb form',VTense:'Verb tense',Pron:'Pronouns',Poss:'Possessives',Mod:'Modifiers',
    Commas:'Commas',Semi:'Semicolons',Colon:'Colons',NoPunct:'No punctuation',Dash:'Dashes'};
  var days=[], active=null;
  function el(id){return document.getElementById(id);}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function ids(s){return String(s||'').split(/[\s,;]+/).filter(Boolean);}
  function student(){return el('student').value.trim();}
  function history(){return S.history(prefix,student());}
  function held(){return S.defaultHeld(QB).concat(ids(el('held').value));}
  function status(){
    var h=history();el('historyStatus').textContent=!student()?'Choose a student to check their local records.':
      !h.available?'History unavailable.':h.importedAt?'History imported '+new Date(h.importedAt).toLocaleString()+
      (h.latest?' · source’s last row timestamp: '+h.latest:'')+'. Later external work needs a new import.':'Local records checked; external history has not been imported.';
  }
  function invalidate(){el('output').hidden=true;el('audit').textContent='';}
  function freshSlot(){return {skills:['Form, Structure, and Sense'],diffs:['Medium'],ruleType:'SVA',intent:'fresh',preferredId:'',reserveIds:[],allowPool:false};}
  function pool(s){
    var h=history(), heldMap=new Set(held().map(function(id){return S.canonical(map,id);})), seen=new Set(Object.keys(h.seen).map(function(id){return S.canonical(map,id);}));
    return QB.filter(function(q){return S.matches(q,s) && S.valid(q) && !heldMap.has(q.id) && (s.intent!=='fresh' || !seen.has(q.id));});
  }
  function addDay(){days.push({focus:'',minutes:0,tip:'',slots:[freshSlot()]});render();invalidate();}
  function option(v,label,selected){return '<option value="'+esc(v)+'"'+(selected?' selected':'')+'>'+esc(label)+'</option>';}
  function render(){
    el('days').innerHTML=days.map(function(d,di){return '<section class="card day" data-day="'+di+'"><div class="top"><h2>Set '+(di+1)+'</h2><button data-action="removeDay" type="button">Remove set</button></div>'
      +'<div class="row"><label>Focus<input class="focus" value="'+esc(d.focus)+'"></label><label>Minutes (0 = untimed)<input class="minutes" type="number" min="0" step="0.01" value="'+d.minutes+'"></label></div>'
      +'<label>Instructions<textarea class="tip">'+esc(d.tip)+'</textarea></label>'
      +d.slots.map(function(s,si){var rules=Array.from(new Set(QB.filter(function(q){return q.skill===s.skills[0] && q.ruleType;}).map(function(q){return q.ruleType;}))).sort();
        return '<div class="slot" data-slot="'+si+'"><div class="top"><b>Question '+(si+1)+'</b><button data-action="removeSlot" type="button">Remove</button></div><div class="row">'
          +'<label>Skill<select class="skill">'+skills.map(function(v){return option(v,v,v===s.skills[0]);}).join('')+'</select></label>'
          +'<label>Method<select class="rule">'+option('','All methods',!s.ruleType)+rules.map(function(v){return option(v,labels[v]||v,v===s.ruleType);}).join('')+'</select></label>'
          +'<label>Difficulty<select class="diff">'+['Easy','Medium','Hard'].map(function(v){return option(v,v,s.diffs[0]===v);}).join('')+'</select></label>'
          +'<label>Purpose<select class="intent">'+[['fresh','Fresh practice'],['review','Deliberate review'],['follow-up','Class follow-up']].map(function(v){return option(v[0],v[1],s.intent===v[0]);}).join('')+'</select></label></div>'
          +'<div class="row"><label>Preferred question ID<input class="primaryId ids" value="'+esc(s.preferredId)+'"></label><label>Ordered backup IDs<input class="reserveIds ids" value="'+esc(s.reserveIds.join(', '))+'"></label></div>'
          +'<button data-action="pick" type="button">Browse matching questions</button><label><input class="fallback" type="checkbox" style="display:inline;width:auto"'+(s.allowPool?' checked':'')+'> Allow another official question from this exact target if backups run out</label>'
          +'<p class="muted">'+pool(s).length+' eligible matching candidates.</p></div>';}).join('')
      +'<button data-action="addSlot" type="button">+ Add question</button></section>';}).join('');
  }
  el('days').addEventListener('input',function(e){
    var card=e.target.closest('.day');if(!card)return;var d=days[Number(card.dataset.day)],box=e.target.closest('.slot');
    if(!box){if(e.target.classList.contains('focus'))d.focus=e.target.value;if(e.target.classList.contains('tip'))d.tip=e.target.value;if(e.target.classList.contains('minutes'))d.minutes=Number(e.target.value);}
    else{var s=d.slots[Number(box.dataset.slot)],c=e.target.classList;
      if(c.contains('skill')){s.skills=[e.target.value];s.ruleType='';s.preferredId='';s.reserveIds=[];render();}
      if(c.contains('rule')){s.ruleType=e.target.value;s.preferredId='';s.reserveIds=[];render();}
      if(c.contains('diff')){s.diffs=[e.target.value];s.preferredId='';s.reserveIds=[];render();}
      if(c.contains('intent')){s.intent=e.target.value;render();}
      if(c.contains('primaryId'))s.preferredId=e.target.value.trim();
      if(c.contains('reserveIds'))s.reserveIds=ids(e.target.value);
      if(c.contains('fallback'))s.allowPool=e.target.checked;
    }invalidate();
  });
  el('days').addEventListener('click',function(e){
    var action=e.target.dataset.action;if(!action)return;
    var card=e.target.closest('.day'),di=Number(card.dataset.day),box=e.target.closest('.slot'),si=box?Number(box.dataset.slot):null;
    if(action==='removeDay')days.splice(di,1);if(action==='addSlot')days[di].slots.push(freshSlot());if(action==='removeSlot')days[di].slots.splice(si,1);
    if(action==='pick'){active=days[di].slots[si];showPicker();return;}render();invalidate();
  });
  function showPicker(){
    var s=active,candidates=pool(s);el('pickerTarget').textContent=[s.skills[0],labels[s.ruleType]||s.ruleType||'all methods',s.diffs[0],candidates.length+' eligible'].join(' · ');
    el('questionPreview').textContent='Select a question to inspect its text, options and tutor key.';
    el('candidates').innerHTML=candidates.map(function(q){return '<button class="candidate" data-id="'+esc(q.id)+'" type="button"><b>'+esc(q.id)+'</b> · '+esc(q.ruleType||q.skill)+'<br>'+esc((q.passage||q.question).slice(0,140))+'</button>';}).join('');
    if(!el('picker').open)el('picker').showModal();
  }
  el('candidates').onclick=function(e){
    var button=e.target.closest('[data-id]');if(!button)return;var q=map[button.dataset.id];
    el('questionPreview').innerHTML='<p class="muted">'+esc(q.id)+' · '+esc(q.difficulty)+' · '+esc(q.origin)+' · '+
      (active.intent==='fresh'?'No recorded exposure':'Review or follow-up')+'</p><div class="preview">'+esc(q.passage||'')+'</div>'
      +(q.image?'<img class="figure" src="'+esc(q.image)+'" alt="Question figure">':'')+'<p><b>'+esc(q.question)+'</b></p>'
      +q.options.map(function(o){return '<p>'+esc(o)+'</p>';}).join('')+'<details><summary>Tutor key: '+esc(q.answer)+'</summary><p>'+esc(q.explanation)+'</p></details>'
      +'<button id="usePrimary" type="button">Use preferred</button> <button id="useReserve" type="button">Add backup</button><p id="previewMessage" role="status"></p>';
    if(typeof StrategyResponse!=='undefined'){
      var method=StrategyResponse.profile(q),notes=document.createElement('div');notes.className='preview';
      var heading=document.createElement('strong');heading.textContent='Method notes requested';notes.appendChild(heading);
      var instructions=document.createElement('p');instructions.textContent=method.instructions;notes.appendChild(instructions);
      method.fields.forEach(function(f){var line=document.createElement('p');line.textContent=f.label;notes.appendChild(line);});
      var phase=document.createElement('p');phase.textContent=method.phase==='with-options'?'Choices visible during the method check':'Method check before choices';notes.appendChild(phase);
      el('questionPreview').appendChild(notes);
    }
    var img=el('questionPreview').querySelector('img');if(img)img.onerror=function(){el('previewMessage').textContent='Figure could not load. Resolve it before assigning this item.';el('usePrimary').disabled=true;el('useReserve').disabled=true;};
    el('usePrimary').onclick=function(){active.preferredId=q.id;active.reserveIds=active.reserveIds.filter(function(id){return id!==q.id;});render();invalidate();el('previewMessage').textContent='Preferred question selected.';};
    el('useReserve').onclick=function(){if(q.id===active.preferredId || active.reserveIds.includes(q.id))return;active.reserveIds.push(q.id);render();invalidate();el('previewMessage').textContent='Backup '+active.reserveIds.length+' selected.';};
  };
  el('closePicker').onclick=function(){el('picker').close();};
  el('autoPick').onclick=function(){
    if(!student()){el('historyStatus').textContent='Enter the student name before selecting.';return;}
    var all=days.flatMap(function(d){return d.slots;}),used=new Set();
    all.forEach(function(s){var q=pool(s).find(function(q){return !used.has(q.id);});s.preferredId=q?q.id:'';s.reserveIds=[];if(q)used.add(q.id);});
    for(var n=0;n<2;n++)all.forEach(function(s){var q=pool(s).find(function(q){return !used.has(q.id);});if(q){s.reserveIds.push(q.id);used.add(q.id);}});
    render();invalidate();
  };
  ['student','start','through','title','held'].forEach(function(id){el(id).addEventListener('change',function(){status();render();invalidate();});});
  el('historyFile').onchange=function(){
    var file=el('historyFile').files[0];if(!file)return;
    file.text().then(function(text){var p=S.importHistory(text,student(),QB);S.saveImport(prefix,student(),p);status();
      el('historyStatus').textContent+=' '+p.rows+' rows checked; '+p.unknown.length+' IDs absent from this bank.';render();invalidate();
    }).catch(function(e){el('historyStatus').textContent=e.message;});
  };
  el('historyExport').onclick=function(){
    if(!student()){el('historyStatus').textContent='Choose a student first.';return;}
    var h=history(),payload={format:'homework-exposure-v1',student:student(),ids:Object.keys(h.seen),latest:h.latest||null};
    var url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');
    a.href=url;a.download='homework-history.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  };
  el('gen').onclick=function(){
    var errors=[],warnings=[],audit=[],h=history(),allPrimary=new Set();
    if(!student() || !el('start').value || !el('through').value || el('through').value<el('start').value)errors.push('Enter the student and a valid release/finish window.');
    if(!days.length)errors.push('Add at least one set.');
    if(!h.importedAt)warnings.push('External history has not been imported. Freshness is limited to local records.');
    if(!h.available)errors.push('History could not be read. Check browser storage.');
    if(days.length<2 || days.length>3)warnings.push('The homework standard normally uses 2–3 sets.');
    var plan={title:el('title').value.trim()||'Homework',start:el('start').value,through:el('through').value,unlock:'cumulative',version:new Date().toISOString(),review:0,heldIds:ids(el('held').value),days:[]};
    var seenAcross=Object.assign({},h.seen);
    var freshPrimaries=days.flatMap(function(d){return d.slots;}).filter(function(s){return s.intent==='fresh';}).map(function(s){return S.canonical(map,s.preferredId);});
    days.forEach(function(d,di){
      var result=S.resolve(QB,d.slots,{seen:seenAcross,held:held()}),fresh=d.slots.filter(function(s){return s.intent==='fresh';}).length;
      var reserveTrial=S.resolve(QB,d.slots,{seen:Object.assign({},h.seen,Object.fromEntries(freshPrimaries.map(function(id){return [id,true];}))),held:held()});
      if(!reserveTrial.complete)warnings.push('Set '+(di+1)+': the backups cannot replace every fresh preferred question together. Add distinct reserves.');
      if(!d.focus.trim())errors.push('Set '+(di+1)+': add a focus label.');
      if(days.some(function(other,oi){return oi<di && other.focus.trim()===d.focus.trim();}))errors.push('Set '+(di+1)+': focus must be unique this week.');
      if(!d.slots.length)errors.push('Set '+(di+1)+': add questions.');
      if(!Number.isFinite(d.minutes) || d.minutes<0)errors.push('Set '+(di+1)+': invalid time limit.');
      if(d.minutes>0 && di!==days.length-1)warnings.push('Set '+(di+1)+': the paced set normally comes last.');
      if(fresh<4 || fresh>6)warnings.push('Set '+(di+1)+': '+fresh+' fresh slots; the standard is 4–6.');
      if(d.slots.length-fresh>2)warnings.push('Set '+(di+1)+': more than two deliberate repeat slots.');
      if(d.minutes>0 && d.minutes*60/d.slots.length<70)warnings.push('Set '+(di+1)+': less than 70 seconds per question.');
      d.slots.forEach(function(s,si){
        var label='Set '+(di+1)+', question '+(si+1),q=map[s.preferredId],unique=new Set(),eligible=0;
        if(!q || !S.matches(q,s) || !S.valid(q))errors.push(label+': preferred item is missing, incomplete or outside the target.');
        if(s.skills[0]==='Form, Structure, and Sense' && !s.ruleType)warnings.push(label+': all grammar methods are enabled. Confirm they were taught.');
        s.reserveIds.forEach(function(id){var q=map[id],key=S.canonical(map,id);
          if(freshPrimaries.includes(key))warnings.push(label+': backup '+id+' is also a preferred fresh question this week.');
          if(!q || !S.matches(q,s) || !S.valid(q))errors.push(label+': backup '+id+' does not match the target.');
          else if(!unique.has(key) && key!==S.canonical(map,s.preferredId)){unique.add(key);
            if(S.resolve(QB,[Object.assign({},s,{preferredId:key,reserveIds:[],allowPool:false})],{seen:h.seen,held:held()}).complete)eligible++;}
        });
        if(eligible<2)warnings.push(label+': '+eligible+' eligible backups; aim for two.');
        if(!eligible && !s.allowPool)errors.push(label+': add a suitable backup or explicitly allow the same target pool.');
        if(q && allPrimary.has(q.id) && s.intent==='fresh')errors.push(label+': this preferred question is assigned earlier in the week.');
        if(q)allPrimary.add(q.id);
        var e=result.entries[si];if(!e || !e.id)errors.push(label+': no eligible question remains.');
        else{seenAcross[e.id]=true;if(e.substituted)warnings.push(label+': preview uses backup '+e.id+' because the preferred item is unavailable.');}
      });
      audit.push('<h3>Set '+(di+1)+' · '+esc(d.focus)+'</h3><p>'+d.slots.length+' total · '+fresh+' fresh · '+(d.slots.length-fresh)+' deliberate repeats · '+(d.minutes?Math.round(d.minutes*60)+' seconds':'untimed')+'</p>'
        +'<table><thead><tr><th>Question</th><th>Target</th><th>Preview ID</th><th>Backups</th></tr></thead><tbody>'+d.slots.map(function(s,si){return '<tr><td>'+(si+1)+'</td><td>'+esc([s.skills[0],labels[s.ruleType]||s.ruleType,s.diffs[0],s.intent].filter(Boolean).join(' · '))+'</td><td>'+esc(result.entries[si].id||'UNRESOLVED')+'</td><td>'+esc(s.reserveIds.join(', ')||'None')+'</td></tr>';}).join('')+'</tbody></table>');
      plan.days.push({n:di+1,focus:d.focus.trim(),minutes:d.minutes,review:0,tip:d.tip,slots:JSON.parse(JSON.stringify(d.slots))});
    });
    el('audit').innerHTML=errors.map(function(s){return '<p class="error">'+esc(s)+'</p>';}).concat(warnings.map(function(s){return '<p class="warn">'+esc(s)+'</p>';}),audit).join('');
    el('output').hidden=!!errors.length;if(errors.length)return;
    el('js').value=JSON.stringify(student())+': '+JSON.stringify(plan,null,2)+',';
  };
  el('copy').onclick=function(){navigator.clipboard.writeText(el('js').value).then(function(){el('copyStatus').textContent='Copied.';}).catch(function(){el('js').select();el('copyStatus').textContent='Select and copy the assignment code.';});};
  el('addDay').onclick=addDay;addDay();status();
})();
