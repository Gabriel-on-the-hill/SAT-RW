// Method evidence, not guesses at an answer choice. No free-text correctness grading.
(function(root){
  'use strict';
  var t=function(id,label,placeholder){return {id:id,label:label,placeholder:placeholder||'',kind:'text'};};
  var s=function(id,label,options){return {id:id,label:label,kind:'select',options:options.concat(['Not sure yet'])};};
  var profiles={
    sva:{title:'Agreement check',instructions:'Find the subject that controls the verb. Give its number before comparing the verb choices.',fields:[t('subject','Controlling subject / head noun','Give the head word, or both parts of a compound subject and their joining word.'),s('number','Subject number → required verb number',['Singular → singular','Plural → plural'])]},
    verbForm:{title:'Verb-form check',instructions:'Use the sentence structure to decide what job the blank must do. You do not need to guess the answer wording.',fields:[t('subject','Subject of the clause'),t('finite','Finite verb already present','Name it, or write “none”.'),t('job','Job required at the blank','Main predicate, part of a verb phrase, or a non-finite modifier? Explain the structure.') ]},
    tense:{title:'Time relationship',instructions:'Establish the time relationship before comparing the verb forms.',fields:[t('actions','Actions and time clues'),t('sequence','Required time relationship','Which action happens first, or what time frame must stay consistent?')]},
    pronoun:{title:'Pronoun reference',instructions:'Identify what the pronoun refers to and the grammatical features it must preserve.',fields:[t('referent','Word or idea the pronoun refers to'),t('features','Required number / person / grammatical role')]},
    possessive:{title:'Possession check',instructions:'Work out who owns what and whether the owner is singular or plural.',fields:[t('owner','Owner and its number'),t('possession','What is possessed / required relationship')]},
    modifier:{title:'Modifier attachment',instructions:'Identify what the descriptive phrase modifies and where that word belongs.',fields:[t('modified','Word or idea being modified'),t('attachment','Required attachment / position')]},
    grammar:{title:'Sentence structure',instructions:'Name the feature being tested and the sentence evidence that decides it. Use only the method you have been taught.',fields:[t('feature','Grammatical feature to check'),t('evidence','Sentence feature that decides it')]},
    boundaries:{title:'Boundary structure',instructions:'Classify the actual parts at the blank. They may be clauses, phrases, an interruption or list items. Decide the construction before choosing punctuation.',fields:[t('left','Structure before the blank','Independent clause, dependent clause, phrase, list item or interrupted clause? Identify the relevant words.'),t('right','Structure after the blank','Classify this part and identify the relevant words.'),t('join','Required connection / construction','Clause join, explanation, paired interruption, list separation, or another construction?')]},
    transitions:{title:'Logical relationship',instructions:'Predict the relationship, rather than a particular transition word.',fields:[t('relationship','Relationship between the ideas'),t('content','What the second idea does to the first','Use the actual ideas to justify the relationship.')]},
    synthesis:{title:'Writing goal',instructions:'Identify the goal and the useful notes. You do not need to compose the answer sentence.',fields:[t('goal','Goal the answer must accomplish'),t('notes','Notes / details needed for that goal')]},
    words:{title:'Meaning in context',instructions:'State the meaning needed in this sentence, using your own word or phrase.',fields:[t('meaning','Meaning required here')]},
    mainIdea:{title:'Main claim',instructions:'State the text’s main claim with its scope and any important qualification.',fields:[t('claim','Main claim, scope and qualification')]},
    detail:{title:'Detail retrieval',instructions:'Locate the detail the question asks about. State what the text actually says, including any limit.',fields:[t('detail','Requested detail and the text that supports it')]},
    inference:{title:'Supported inference',instructions:'State what follows from the text and the detail that supports it. Do not add an outside assumption.',fields:[t('inference','Inference and supporting detail')]},
    purpose:{title:'Function in the text',instructions:'Explain the job of the part named in the question and how it contributes to the argument.',fields:[t('function','Function of the named part and its contribution')]},
    structure:{title:'Text organisation',instructions:'Describe how the text moves from one part to the next.',fields:[t('organisation','Sequence of functions in the text')]},
    crossText:{title:'Compare the claims',instructions:'Compare the two claims, including their qualifications, before choosing a response.',fields:[t('claims','Each text’s relevant claim'),t('relationship','Relationship between those claims')]},
    evidence:{title:'Evidence requirement',instructions:'Identify the exact claim, including its direction and limits, then state what evidence would support or challenge it as the question asks.',fields:[t('claim','Exact claim and its direction / limits'),t('test','What the required evidence must establish')]},
    data:{title:'Data-to-claim check',instructions:'Connect the claim to the relevant comparison in the figure. Reading a true number alone is not enough.',fields:[t('claim','What the claim requires'),t('comparison','Relevant groups / values / change, with units'),t('connection','How that comparison supports or challenges the claim')]},
    deciding:{title:'Deciding step',instructions:'State the first deciding step from the method you have been taught and the question evidence it uses.',fields:[t('step','Deciding step and question evidence')]}
  };
  function key(q){
    q=q||{};var skill=q.skill||'',stem=q.question||'';
    if(skill==='Form, Structure, and Sense')return ({SVA:'sva',VForm:'verbForm',VTense:'tense',Pron:'pronoun',Poss:'possessive',Mod:'modifier'})[q.ruleType]||'grammar';
    return ({Boundaries:'boundaries',Transitions:'transitions','Rhetorical Synthesis':'synthesis','Words in Context':'words',Inferences:'inference','Cross-Text Connections':'crossText','Command of Evidence — Textual':'evidence','Command of Evidence — Quantitative':'data'})[skill]
      ||(skill==='Central Ideas and Details'?(/according to|which.*detail|states that/i.test(stem)?'detail':'mainIdea'):
      skill==='Text Structure and Purpose'?(/overall structure|organization|organisation|structure of the text/i.test(stem)?'structure':'purpose'):'deciding');
  }
  function profile(q,override){
    var raw=override || (q&&q.responseProfile),k=typeof raw==='string'?raw:(raw&&raw.key)||key(q),base=profiles[k];
    if(!base)throw new Error('Unknown method response profile: '+k);
    var out={key:k,title:base.title,instructions:base.instructions,fields:base.fields.map(function(f){var copy=Object.assign({},f);if(f.options)copy.options=f.options.slice();return copy;}),phase:'before-options'};
    if(raw && typeof raw==='object'){
      if(raw.title)out.title=String(raw.title);if(raw.instructions)out.instructions=String(raw.instructions);
      if(raw.phase){if(!['before-options','with-options'].includes(raw.phase))throw new Error('Invalid method response phase');out.phase=raw.phase;}
      if(raw.fields){
        if(!Array.isArray(raw.fields)||!raw.fields.length||raw.fields.length>6)throw new Error('Provide 1–6 method response fields');
        var ids={};out.fields=raw.fields.map(function(f){
          if(!f || !/^[a-z][a-z0-9_-]*$/.test(f.id)||ids[f.id]||!String(f.label||'').trim())throw new Error('Invalid or duplicate response field');
          ids[f.id]=true;var field={id:f.id,label:String(f.label),placeholder:String(f.placeholder||''),kind:f.kind||'text'};
          if(!['text','select'].includes(field.kind))throw new Error('Invalid response field kind');
          if(field.kind==='select'){if(!Array.isArray(f.options)||!f.options.length)throw new Error('A select field needs options');field.options=f.options.map(String);}
          return field;
        });
      }
    }
    return out;
  }
  function meaningful(value){var v=String(value||'').trim();return !!v && !/^(?:_+|-{2,}|\.{2,})$/.test(v);}
  function complete(p,values){return p.fields.every(function(f){var v=String((values||{})[f.id]||'').trim();return meaningful(v) && (f.kind!=='select'||f.options.includes(v));});}
  function text(p,values){return (p.phase==='with-options'?'[Method notes with choices visible]\n':'')+p.fields.map(function(f){return f.label+': '+String((values||{})[f.id]||'').trim();}).join('\n');}
  function mount(first,q,options){
    options=options||{};var p=profile(q,options.profile),doc=first.ownerDocument,box=doc.createElement('div'),nodes={},original=first.value;
    box.className='method-response';box.dataset.profile=p.key;box.dataset.phase=p.phase;
    first.parentNode.insertBefore(box,first);
    if(options.intro!==false){var intro=doc.createElement('p');intro.textContent=p.instructions;intro.style.cssText='font-size:.9rem;margin:.35rem 0 .7rem';box.appendChild(intro);}
    var oldLabel=doc.querySelector('label[for="'+first.id+'"]');if(oldLabel){oldLabel.textContent='Your method notes';oldLabel.removeAttribute('for');}
    p.fields.forEach(function(f,i){
      var id=i?first.id+'_'+f.id:first.id,label=doc.createElement('label');label.htmlFor=id;label.textContent=f.label;label.style.cssText='display:block;font-weight:650;font-size:.9rem;margin:.65rem 0 .25rem';box.appendChild(label);
      var input=i||f.kind==='select'?doc.createElement(f.kind==='select'?'select':'textarea'):first;
      if(!i && input!==first){first.remove();input.id=id;}
      input.id=id;input.dataset.responseField=f.id;input.style.cssText='display:block;width:100%;box-sizing:border-box;font:inherit;padding:.55rem;border:1px solid #b8c4d8;border-radius:7px;background:var(--surface,#fff);color:inherit';
      if(f.kind==='select'){
        var blank=doc.createElement('option');blank.value='';blank.textContent='Choose…';input.appendChild(blank);
        f.options.forEach(function(v){var o=doc.createElement('option');o.value=v;o.textContent=v;input.appendChild(o);});
      }else{input.rows=2;input.placeholder=f.placeholder;}
      input.value=(options.values||{})[f.id] || (!i?original:'');box.appendChild(input);nodes[f.id]=input;
    });
    var handle={profile:p,box:box,values:function(){var v={};p.fields.forEach(function(f){v[f.id]=nodes[f.id].value;});return v;},
      complete:function(){return complete(p,handle.values());},text:function(){return text(p,handle.values());},
      freeze:function(on){p.fields.forEach(function(f){nodes[f.id].disabled=!!on;});},
      restore:function(values){p.fields.forEach(function(f){nodes[f.id].value=(values||{})[f.id]||'';});},
      missing:function(){return p.fields.filter(function(f){return !meaningful(nodes[f.id].value);}).map(function(f){return f.label;});},
      focusMissing:function(){var f=p.fields.find(function(f){return !meaningful(nodes[f.id].value);});if(f)nodes[f.id].focus();}};
    p.fields.forEach(function(f){['input','change'].forEach(function(event){nodes[f.id].addEventListener(event,function(){if(options.onChange)options.onChange(handle);});});});
    return handle;
  }
  var api={profile:profile,complete:complete,text:text,mount:mount};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.StrategyResponse=api;
})(typeof window!=='undefined'?window:null);
