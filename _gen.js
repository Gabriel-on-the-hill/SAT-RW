const fs=require('fs');
const DIR='c:/Antigravity/SAT GUIDES/WAYNE/MasteryApp/';
function load(f){let t=fs.readFileSync(DIR+f,'utf8');t=t.replace(/^const\s+\w+\s*=\s*/,'').replace(/;\s*$/,'');return JSON.parse(t);}
const all=[].concat(load('data-craft-structure.js'),load('data-info-ideas.js'),load('data-conventions.js'),load('data-expression-of-ideas.js'));

const SEL=[
 {n:1, id:'50e2cbb3', dom:'Craft & Structure', skill:'Words in Context', diff:'Easy',   focus:'Use context (restatement) to choose a common word. A miss = weak context-clue habit or fell for the familiar-definition trap.'},
 {n:2, id:'d8d1ecaa', dom:'Craft & Structure', skill:'Words in Context', diff:'Medium', focus:'Negative-direction context. A miss = wrong logical direction or imprecise word sense.'},
 {n:3, id:'2b18fad1', dom:'Craft & Structure', skill:'Text Structure & Purpose', diff:'Medium', focus:'Function of a sentence in a narrative. A miss = naming the topic instead of what the sentence DOES.'},
 {n:4, id:'d60bc86d', dom:'Craft & Structure', skill:'Text Structure & Purpose', diff:'Hard', focus:'Main purpose with close purpose-verbs (illustrate vs argue vs explain). A miss = purpose-verb / intensity confusion.'},
 {n:5, id:'2592e0de', dom:'Information & Ideas', skill:'Central Ideas & Details', diff:'Easy', focus:'Main idea vs detail. A miss = chose a true detail instead of the whole-text idea.'},
 {n:6, id:'2584bcfb', dom:'Information & Ideas', skill:'Command of Evidence (Textual)', diff:'Medium', focus:'Pick the finding that weakens a claim. A miss = chose data about the wrong variable.'},
 {n:7, id:'46e45728', dom:'Information & Ideas', skill:'Command of Evidence (Quantitative)', diff:'Easy', focus:'Read a simple two-column table. A miss = partial read (checked one column only).'},
 {n:8, id:'a13c1c66', dom:'Information & Ideas', skill:'Inferences', diff:'Hard', focus:'Bounded inference. A miss = overgeneralized beyond the single trait discussed.'},
 {n:9, id:'26c8c88c', dom:'Standard English Conventions', skill:'Boundaries', diff:'Easy', focus:'Dependent + independent clause -> comma. A miss = fragment or semicolon/colon misuse.'},
 {n:10, id:'36944347', dom:'Standard English Conventions', skill:'Form, Structure & Sense', diff:'Medium', focus:'Pronoun-antecedent agreement (plural). A miss = number-agreement error.'},
 {n:11, id:'594b4a94', dom:'Standard English Conventions', skill:'Boundaries', diff:'Hard', focus:'Essential appositive takes NO punctuation. A miss = over-punctuating essential info.'},
 {n:12, id:'d2b81427', dom:'Standard English Conventions', skill:'Form, Structure & Sense', diff:'Hard', focus:'Dangling-modifier repair. A miss = subject not placed right after the modifier.'},
 {n:13, id:'1c36e3e1', dom:'Expression of Ideas', skill:'Transitions', diff:'Easy', focus:'Comparison transition. A miss = wrong logical direction.'},
 {n:14, id:'3c925481', dom:'Expression of Ideas', skill:'Rhetorical Synthesis', diff:'Medium', focus:'Goal = give an example of a fruit with vitamin C. A miss = accurate-but-off-task choice.'},
 {n:15, id:'00e0170f', dom:'Expression of Ideas', skill:'Transitions', diff:'Hard', focus:'Emphasis ("in fact") vs contrast. A miss = wrong direction (chose a contrast word).'}
];

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function stripU(s){return String(s).replace(/<\/?u>/g,'');}
function cleanExp(e){var parts=String(e).split(/─{3,}/);return (parts.length>1?parts.slice(1).join(' '):e).trim();}

const recs=SEL.map(s=>{
  const q=all.find(x=>x.id===s.id);
  if(!q) throw new Error('MISSING ID '+s.id);
  if(!q.answer||!/^[A-D]$/.test(q.answer)) throw new Error('BAD ANSWER '+s.id);
  if(!q.options||q.options.length!==4) throw new Error('BAD OPTIONS '+s.id);
  return Object.assign({},s,{q});
});

function quantPassageHTML(q){
  const must=['9.28','15.81','12.64','18.93','12.48','18.87','adult females','adult males','Mountain Lions'];
  must.forEach(m=>{ if(!q.passage.includes(m)) throw new Error('QUANT VERIFY FAIL: '+m); });
  const idx=q.passage.indexOf('Wildlife researcher');
  if(idx<0) throw new Error('QUANT prose split fail');
  const prose=q.passage.slice(idx).replace(/\s+/g,' ').trim();
  const tbl='<table class="dtable"><caption>Daily Distance Traveled by Adult Mountain Lions in Three Seasons</caption>'+
   '<thead><tr><th>Season</th><th>Kilometers per day (adult females)</th><th>Kilometers per day (adult males)</th></tr></thead>'+
   '<tbody>'+
   '<tr><td>cold-dry</td><td>9.28</td><td>15.81</td></tr>'+
   '<tr><td>monsoon</td><td>12.64</td><td>18.93</td></tr>'+
   '<tr><td>hot-dry</td><td>12.48</td><td>18.87</td></tr>'+
   '</tbody></table>';
  return tbl+'<p class="passage">'+esc(prose)+'</p>';
}

let body='';
let meta=[];
recs.forEach(r=>{
  const q=r.q;
  let passHTML;
  if(r.id==='46e45728'){ passHTML=quantPassageHTML(q); }
  else { passHTML='<p class="passage">'+esc(stripU(q.passage).replace(/\s+/g,' ').trim())+'</p>'; }
  let opts='';
  q.options.forEach(o=>{
    const mm=o.match(/^\s*([A-D])[.)]\s*([\s\S]*)$/);
    const L=mm?mm[1]:o.slice(0,1); const txt=mm?mm[2]:o;
    opts+='<label class="opt" data-val="'+L+'"><input type="radio" name="q'+r.n+'" value="'+L+'"><span class="ol">'+L+'</span><span class="ot">'+esc(txt.trim())+'</span></label>';
  });
  body+='<section class="qblock" id="q'+r.n+'-block">'+
    '<div class="qhead"><span class="qnum">Question '+r.n+'</span></div>'+
    passHTML+
    '<p class="stem">'+esc(q.question)+'</p>'+
    '<div class="opts">'+opts+'</div>'+
    '</section>';
});

const css=`
:root{--ink:#1a1a1a;--mut:#666;--line:#d8d8d8;--accent:#1b4965;--ok:#1b7f4b;--no:#b3261e;--okbg:#e7f5ec;--nobg:#fdecea;}
*{box-sizing:border-box}
body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:var(--ink);max-width:820px;margin:0 auto;padding:28px 22px 90px;line-height:1.5;background:#fff}
h1{font-size:24px;margin:0 0 4px} .sub{color:var(--mut);margin:0 0 18px;font-size:14px}
.card{border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin:0 0 22px;background:#fafafa}
.card h2{font-size:15px;margin:0 0 8px;letter-spacing:.02em;text-transform:uppercase;color:var(--accent)}
.card ul{margin:6px 0 0;padding-left:18px} .card li{margin:3px 0;font-size:14px}
.fields{display:flex;gap:24px;flex-wrap:wrap;margin-top:12px;font-size:14px}
.fields span{border-bottom:1px solid var(--ink);min-width:220px;display:inline-block;padding-bottom:2px}
.qblock{border-top:1px solid var(--line);padding:20px 0 8px}
.qhead{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.qnum{font-weight:700;color:var(--accent);font-size:14px;letter-spacing:.03em}
.classify{color:var(--mut);font-size:13px}
.passage{margin:0 0 12px}
.dtable{border-collapse:collapse;margin:0 0 12px;font-size:14px;width:100%}
.dtable caption{caption-side:top;text-align:left;font-weight:600;margin-bottom:6px}
.dtable th,.dtable td{border:1px solid var(--line);padding:6px 10px;text-align:left}
.dtable thead th{background:#eef2f5}
.stem{font-weight:600;margin:0 0 10px}
.opts{display:flex;flex-direction:column;gap:8px}
.opt{display:flex;align-items:flex-start;gap:10px;border:1px solid var(--line);border-radius:8px;padding:9px 12px;cursor:pointer;background:#fff}
.opt:hover{border-color:#9bb}
.opt input{margin-top:3px}
.ol{font-weight:700;min-width:16px}
.opt.correct{background:var(--okbg);border-color:var(--ok)}
.opt.wrong{background:var(--nobg);border-color:var(--no)}
.badge{font-size:12px;font-weight:700;padding:2px 8px;border-radius:20px}
.b-ok{background:var(--okbg);color:var(--ok)} .b-no{background:var(--nobg);color:var(--no)}
.exp{background:#f4f6f8;border-left:3px solid var(--accent);padding:10px 14px;margin-top:12px;border-radius:0 8px 8px 0;font-size:13.5px}
.exp p{margin:6px 0} .focus{color:#333} .official{color:#444}
.bar{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid var(--line);padding:10px 16px;display:flex;gap:10px;justify-content:center;box-shadow:0 -2px 8px rgba(0,0,0,.05)}
button{font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer}
button.sec{background:#fff;color:var(--accent)}
#summary{display:none;border:2px solid var(--accent);border-radius:10px;padding:16px 18px;margin:8px 0 22px;background:#fff}
#summary h2{margin-top:0;color:var(--accent)}
#summary table{border-collapse:collapse;width:100%;font-size:14px;margin-top:8px}
#summary td,#summary th{border:1px solid var(--line);padding:6px 10px;text-align:left}
.note{font-size:12.5px;color:var(--mut);margin-top:10px}
@media print{.bar{display:none}.opt{break-inside:avoid}.qblock{break-inside:avoid}}
`;

const clientjs=`
var META=[${meta.join(',')}];
function reveal(){
 var total=0,byDom={},byDiff={};
 for(var i=0;i<META.length;i++){
  var m=META[i],n=m.n,chosen=null,rs=document.getElementsByName('q'+n);
  for(var j=0;j<rs.length;j++){if(rs[j].checked)chosen=rs[j].value;}
  var blk=document.getElementById('q'+n+'-block'),opts=blk.querySelectorAll('.opt');
  for(var k=0;k<opts.length;k++){var v=opts[k].getAttribute('data-val');
   if(v===m.ans)opts[k].classList.add('correct');
   if(chosen&&v===chosen&&chosen!==m.ans)opts[k].classList.add('wrong');}
  var ok=chosen===m.ans; if(ok)total++;
  byDom[m.d]=byDom[m.d]||{c:0,t:0};byDom[m.d].t++;if(ok)byDom[m.d].c++;
  byDiff[m.diff]=byDiff[m.diff]||{c:0,t:0};byDiff[m.diff].t++;if(ok)byDiff[m.diff].c++;
  var e=document.getElementById('q'+n+'-exp');if(e)e.style.display='block';
  var b=document.getElementById('q'+n+'-badge');if(b){b.style.display='inline-block';b.textContent=ok?'Correct':(chosen?'Incorrect':'No answer');b.className='badge '+(ok?'b-ok':'b-no');}
 }
 var cs=document.querySelectorAll('.classify');for(var x=0;x<cs.length;x++)cs[x].style.display='inline';
 var domOrder=['Craft & Structure','Information & Ideas','Standard English Conventions','Expression of Ideas'];
 var h='<h2>Results &mdash; '+total+' / 15 correct</h2>';
 h+='<table><tr><th>Domain</th><th>Score</th></tr>';
 for(var d=0;d<domOrder.length;d++){var o=byDom[domOrder[d]];if(o)h+='<tr><td>'+domOrder[d]+'</td><td>'+o.c+' / '+o.t+'</td></tr>';}
 h+='</table><table style="margin-top:10px"><tr><th>Difficulty</th><th>Score</th></tr>';
 var dl=['Easy','Medium','Hard'];for(var z=0;z<dl.length;z++){var o2=byDiff[dl[z]];if(o2)h+='<tr><td>'+dl[z]+'</td><td>'+o2.c+' / '+o2.t+'</td></tr>';}
 h+='</table><p class="note">Reading guide: this is a <b>placement screener</b>, not a precise sub-skill diagnosis. With 3&ndash;4 items per domain, treat a low domain score as a <b>flag to confirm</b> with a full Bluebook practice test, not a final verdict. Difficulty tiers (Easy/Medium/Hard) are College Board empirical difficulty, used here as a proxy for below/at/above grade level.</p>';
 var s=document.getElementById('summary');s.innerHTML=h;s.style.display='block';s.scrollIntoView({behavior:'smooth'});
}
`;

const html='<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>SAT Reading & Writing - Baseline Assessment</title><style>'+css+'</style></head><body>'+
 '<h1>SAT Reading &amp; Writing &mdash; Baseline Assessment</h1>'+
 '<p class="sub">15 questions &middot; 20 minutes</p>'+
 '<div class="card"><div class="fields"><span>Name: </span><span>Date: </span></div></div>'+
 body+
 '<div class="bar"><button class="sec" onclick="window.print()">Print</button></div>'+
 '</body></html>';

const out='c:/Antigravity/SAT GUIDES/WAYNE/SAT R&W Baseline Assessment.html';
fs.writeFileSync(out,html,'utf8');

console.log('WROTE: '+out+'  ('+html.length+' bytes)');
console.log('\n=== EXTRACTION CROSS-CHECK (verbatim from source) ===');
recs.forEach(r=>{
  console.log('Q'+r.n+' ['+r.id+'] '+r.diff+' | '+r.dom+' / '+r.skill+'  ANS='+r.q.answer);
  console.log('   passage: '+stripU(r.q.passage).replace(/\s+/g,' ').slice(0,72));
  console.log('   stem   : '+r.q.question.slice(0,72));
});
const counts={Easy:0,Medium:0,Hard:0},doms={};
recs.forEach(r=>{counts[r.diff]++;doms[r.dom]=(doms[r.dom]||0)+1;});
console.log('\nDifficulty:',JSON.stringify(counts));
console.log('Domains:',JSON.stringify(doms));
