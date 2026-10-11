/* Exact homework slots. History is exposure evidence, never a mastery write. */
(function(root){
  'use strict';
  function index(bank){
    var map=Object.create(null);
    bank.forEach(function(q){ map[q.id]=q; (q.altIds||[]).forEach(function(id){map[id]=q;}); });
    return map;
  }
  function canonical(map,id){return map[id]?map[id].id:id;}
  function idSet(map,ids){
    var out=Object.create(null);
    (Array.isArray(ids)?ids:Object.keys(ids||{})).forEach(function(id){out[canonical(map,id)]=true;});
    return out;
  }
  function matches(q,s){
    return !!(q && Array.isArray(s.skills) && s.skills.length && s.skills.indexOf(q.skill)>=0
      && Array.isArray(s.diffs) && s.diffs.length && s.diffs.indexOf(q.difficulty)>=0
      && (!s.ruleType || s.ruleType===q.ruleType));
  }
  function valid(q){
    return !!(q && /^cb-/.test(q.origin||'') && q.question && (q.passage||q.image)
      && Array.isArray(q.options) && q.options.length===4 && /^[ABCD]$/.test(q.answer));
  }
  function resolve(bank,slots,opts){
    opts=opts||{};
    var map=index(bank), seen=idSet(map,opts.seen), held=idSet(map,opts.held), used=Object.create(null);
    var entries=slots.map(function(s,i){
      var intent=s.intent||'fresh', issues=[], selected=null;
      if(['fresh','review','follow-up'].indexOf(intent)<0) return {slot:i,id:null,intent:intent,issues:['Invalid intent']};
      var saved=(opts.previous||[])[i];
      var locked=!!(opts.locked||[])[i];
      var ids=[saved,s.preferredId].concat(s.reserveIds||[]).filter(Boolean);
      if(s.allowPool===true && !locked) ids=ids.concat(bank.filter(function(q){return matches(q,s);}).map(function(q){return q.id;}));
      if(locked) ids=[saved];
      var tried=Object.create(null);
      ids.some(function(id){
        var q=map[id], key=canonical(map,id);
        if(tried[key]) return false; tried[key]=true;
        var why=!q?'Missing item':!matches(q,s)?'Wrong target':!valid(q)?'Unverified or incomplete item':
          used[key]?'Already used in this set':(!locked && held[key])?'Held for assessment':
          (!locked && intent==='fresh' && seen[key])?'Recorded exposure':null;
        if(why){issues.push({id:id,reason:why});return false;}
        selected=key; used[key]=true; return true;
      });
      return {slot:i,id:selected,intent:intent,preferredId:s.preferredId||null,
        substituted:!!(selected && selected!==canonical(map,s.preferredId)),issues:issues};
    });
    var counts=Object.create(null);
    entries.forEach(function(e){if(e.id){var q=map[e.id], key=[q.skill,q.ruleType||'—',q.difficulty,e.intent].join(' | ');counts[key]=(counts[key]||0)+1;}});
    return {entries:entries,complete:entries.every(function(e){return !!e.id;}),counts:counts};
  }
  // RFC-style CSV quotes/newlines; only the named student's question rows are imported.
  function csv(text){
    text=String(text).replace(/^\uFEFF/,'');
    var rows=[],row=[],cell='',quoted=false;
    for(var i=0;i<text.length;i++){
      var c=text[i];
      if(c==='"'){if(quoted && text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
      else if(c===',' && !quoted){row.push(cell);cell='';}
      else if((c==='\n'||c==='\r') && !quoted){
        if(c==='\r' && text[i+1]==='\n')i++;
        row.push(cell); if(row.some(function(v){return v.trim();}))rows.push(row); row=[];cell='';
      }else cell+=c;
    }
    if(quoted)throw new Error('CSV has an unfinished quoted field.');
    row.push(cell);if(row.some(function(v){return v.trim();}))rows.push(row);
    return rows;
  }
  function importHistory(text,student,bank){
    if(!String(student||'').trim())throw new Error('Choose a student first.');
    var map=index(bank), result={ids:[],unknown:[],rows:0,latest:null};
    var ids=Object.create(null);
    if(/^\s*\{/.test(text)){
      var o=JSON.parse(text);
      if(o.format!=='homework-exposure-v1' || o.student!==student || !Array.isArray(o.ids))
        throw new Error('This history file belongs to another student or has the wrong format.');
      o.ids.forEach(function(id){if(typeof id!=='string')throw new Error('Invalid question ID.');ids[canonical(map,id.trim())]=true;});
      result.rows=o.ids.length;result.latest=o.latest||null;
    }else{
      var rows=csv(text), head=(rows.shift()||[]).map(function(h){return h.trim().toLowerCase();});
      var si=head.indexOf('student'), qi=head.indexOf('question id'), ti=head.indexOf('timestamp');
      if(si<0 || qi<0)throw new Error('Use the Questions export with Student and Question ID columns.');
      rows.forEach(function(r){
        if((r[si]||'').trim()!==student.trim())return;
        var id=(r[qi]||'').trim();if(!id)return;
        result.rows++;ids[canonical(map,id)]=true;
        // Preserve the source's timestamp text; do not guess its date convention.
        if(ti>=0 && r[ti])result.latest=r[ti];
      });
    }
    result.ids=Object.keys(ids);
    result.unknown=result.ids.filter(function(id){return !map[id];});
    if(!result.rows)throw new Error('No question records match this student. Check the name and export.');
    return result;
  }
  function historyKey(prefix,student){return prefix+'_hw_history_'+student;}
  function readHistory(prefix,student){
    try{return JSON.parse(localStorage.getItem(historyKey(prefix,student)))||{};}catch(e){return {};}
  }
  function saveImport(prefix,student,parsed){
    var h=readHistory(prefix,student), all=Object.create(null);
    (h.ids||[]).concat(parsed.ids).forEach(function(id){all[id]=true;});
    h={ids:Object.keys(all),importedAt:Date.now(),latest:parsed.latest||h.latest||null};
    // Do not claim an import succeeded if storage could not retain it.
    localStorage.setItem(historyKey(prefix,student),JSON.stringify(h));return h;
  }
  function history(prefix,student,sittingId){
    var h=readHistory(prefix,student), seen=Object.create(null), available=true;
    (h.ids||[]).forEach(function(id){seen[id]=true;});
    try{
      var progress=JSON.parse(localStorage.getItem(prefix+'_progress_'+student))||{};
      var exposure=JSON.parse(localStorage.getItem(prefix+'_seen_'+student))||{};
      Object.keys(progress).concat(Object.keys(exposure)).forEach(function(id){seen[id]=true;});
      var baselines=JSON.parse(localStorage.getItem(prefix+'_baseline_'+student))||[];
      baselines.forEach(function(b){(b.items||[]).forEach(function(q){if(q.id)seen[q.id]=true;});});
      var routePrefix=prefix==='satrw'?'satrw_sat_class_route:'+student+':':'psat89_classroute_'+student+'_';
      for(var k=0;k<localStorage.length;k++){
        var name=localStorage.key(k);if(name.indexOf(routePrefix)!==0)continue;
        var route=JSON.parse(localStorage.getItem(name))||{};
        (route.rows||[]).forEach(function(q){if(q.id)seen[q.id]=true;});
        if(route.draft && route.draft.id)seen[route.draft.id]=true;
      }
      var presented=JSON.parse(localStorage.getItem(prefix+'_hw_presented_'+student))||{};
      Object.keys(presented).forEach(function(id){if(presented[id].some(function(s){return s!==sittingId;}))seen[id]=true;});
    }catch(e){available=false;}
    return {seen:seen,importedAt:h.importedAt||null,latest:h.latest||null,available:available};
  }
  function notePresented(prefix,student,id,sittingId){
    try{
      var key=prefix+'_hw_presented_'+student, o=JSON.parse(localStorage.getItem(key))||{};
      var list=o[id]||(o[id]=[]);if(list.indexOf(sittingId)<0)list.push(sittingId);
      localStorage.setItem(key,JSON.stringify(o));
    }catch(e){}
  }
  function noteRecognition(prefix,student,id){
    var previous=readHistory(prefix,student), next=saveImport(prefix,student,{ids:[id],latest:null});
    next.importedAt=previous.importedAt||null;
    localStorage.setItem(historyKey(prefix,student),JSON.stringify(next));return next;
  }
  function defaultHeld(bank){
    var ids=[];
    if(typeof BASELINE_FORMS!=='undefined' && typeof buildBaselineForm==='function')
      BASELINE_FORMS.forEach(function(f){ids=ids.concat(buildBaselineForm(bank,f).questions.map(function(q){return q.id;}));});
    return ids;
  }
  function version(plan,spec){return JSON.stringify([plan.start,plan.version||'',spec.n,spec.slots,spec.minutes||0,spec.heldIds||[]]);}
  var api={index:index,canonical:canonical,matches:matches,valid:valid,resolve:resolve,csv:csv,
    importHistory:importHistory,readHistory:readHistory,saveImport:saveImport,history:history,
    notePresented:notePresented,noteRecognition:noteRecognition,defaultHeld:defaultHeld,version:version};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  root.HomeworkSelection=api;
})(typeof window!=='undefined'?window:globalThis);
