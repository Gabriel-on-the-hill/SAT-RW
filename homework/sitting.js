/* Browser state for precise daily homework; legacy plans keep their existing draw. */
(function(root){
  'use strict';
  function open(opts){
    var S=HomeworkSelection, spec=opts.spec, student=opts.student, prefix=opts.prefix;
    var key=prefix+'_hwsitting_'+student+'_'+opts.plan.start+'_'+spec.n;
    var signature=S.version(opts.plan,spec), data=null, saved=null, storageOK=true;
    try{saved=JSON.parse(localStorage.getItem(key));}catch(e){storageOK=false;}
    if(saved && saved.version!==signature && (saved.records||[]).some(function(r){return r && r.chosen;}))
      throw new Error('This assignment changed after work began. Your answers are saved; ask your tutor to issue a separate set.');
    data=saved && saved.version===signature?saved:{version:signature,sittingId:'hw_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2),
      entries:[],nav:[],records:[],events:[],startedAt:null,deadline:null,finished:false,index:0};
    var map=S.index(opts.bank), snapshot, result;
    function save(){
      try{localStorage.setItem(key,JSON.stringify(data));storageOK=true;}catch(e){storageOK=false;}
      return storageOK;
    }
    function refresh(){
      snapshot=S.history(prefix,student,data.sittingId);
      result=S.resolve(opts.bank,spec.slots,{seen:snapshot.seen,held:S.defaultHeld(opts.bank).concat(opts.plan.heldIds||[],spec.heldIds||[]),
        previous:data.entries.map(function(e){return e.id;}),
        locked:spec.slots.map(function(s,i){var n=data.nav[i];return !!data.deadline || !!data.finished || !!(n && n.graded);})});
      result.entries.forEach(function(e,i){
        var old=data.entries[i];
        if(old && old.id!==e.id){
          data.events.push({at:Date.now(),slot:i,from:old.id,to:e.id,reason:'history refresh'});
          data.nav[i]=null;data.records[i]=null;
        }
      });
      data.entries=result.entries;data.snapshot={importedAt:snapshot.importedAt,latest:snapshot.latest,available:snapshot.available};
      save();return result;
    }
    refresh();
    function questions(){return data.entries.map(function(e){return e.id?map[e.id]:null;});}
    function status(){return !snapshot.available?'History unavailable.':snapshot.importedAt?
      'History imported '+new Date(snapshot.importedAt).toLocaleString()+'. Later external work needs a new import.':
      'Local records checked. No external history has been imported.';}
    function controls(container,onImport){
      var p=document.createElement('p');p.className='sub';p.textContent=status();container.appendChild(p);
      if(data.deadline)return;
      var label=document.createElement('label');label.textContent='Update question history (Questions CSV or your history file)';
      var input=document.createElement('input');input.type='file';input.accept='.csv,.json';input.id='hwHistoryFile';label.appendChild(input);
      container.appendChild(label);
      var message=document.createElement('p');message.setAttribute('role','status');container.appendChild(message);
      input.onchange=function(){
        var file=input.files && input.files[0];if(!file)return;
        file.text().then(function(text){
          var parsed=S.importHistory(text,student,opts.bank);S.saveImport(prefix,student,parsed);
          refresh();message.textContent=parsed.rows+' question records checked; '+parsed.unknown.length+' IDs absent from this bank.';
          p.textContent=status();onImport();
        }).catch(function(e){message.textContent=e.message;});
      };
    }
    function recognize(i){
      var q=questions()[i];if(!q)return null;
      S.noteRecognition(prefix,student,q.id);
      var n=data.nav[i]||{};
      var canReplace=!data.deadline && !n.graded && (spec.slots[i].intent||'fresh')==='fresh';
      data.events.push({at:Date.now(),slot:i,id:q.id,reason:'recognized',replaced:canReplace});
      n.recognized=true;data.nav[i]=n;
      if(canReplace)refresh();else save();
      return {question:q,replaced:canReplace};
    }
    function preflight(container,start){
      container.innerHTML='';
      var card=document.createElement('div');card.className='done-card';container.appendChild(card);
      var timed=spec.minutes>0;
      var h=document.createElement('h2');h.textContent=timed?'Ready for your timed set':'Ready for your homework';card.appendChild(h);
      var count=document.createElement('p');card.appendChild(count);
      var button=document.createElement('button');button.type='button';button.className='btn';button.id='hwStart';button.textContent=timed?'Start timed set':'Start set';card.appendChild(button);
      function update(){
        var missing=data.entries.filter(function(e){return !e.id;}).length;
        count.textContent=spec.slots.length+' questions · '+(timed?Math.round(spec.minutes*60)+' seconds. ':'Untimed. ')+
          (missing?missing+' question slots need a suitable backup. Ask your tutor.':timed?'The clock starts when you press Start.':'Import newer question records here before starting.');
        button.disabled=timed && (!!missing || !storageOK);
        if(!timed && missing)button.textContent='Start available questions';
        if(timed && !storageOK)count.textContent='This browser could not save the sitting. Enable storage before starting the timed set.';
      }
      controls(card,update);update();
      button.onclick=function(){
        refresh();update();if(button.disabled)return;
        data.startedAt=Date.now();if(timed)data.deadline=data.startedAt+Math.round(spec.minutes*60)*1000;
        if(!save() && timed){data.deadline=null;update();return;}start();
      };
    }
    return {data:data,save:save,refresh:refresh,questions:questions,status:status,controls:controls,recognize:recognize,preflight:preflight};
  }
  root.HomeworkSitting={open:open};
})(window);
