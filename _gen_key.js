const fs=require('fs');
const DIR='c:/Antigravity/SAT GUIDES/WAYNE/MasteryApp/';
function load(f){let t=fs.readFileSync(DIR+f,'utf8');t=t.replace(/^const\s+\w+\s*=\s*/,'').replace(/;\s*$/,'');return JSON.parse(t);}
const all=[].concat(load('data-craft-structure.js'),load('data-info-ideas.js'),load('data-conventions.js'),load('data-expression-of-ideas.js'));

// same blueprint as the assessment (ids drive verbatim answer lookup)
const SEL=[
 {n:1, id:'50e2cbb3', dom:'Craft & Structure', skill:'Words in Context', diff:'Easy'},
 {n:2, id:'d8d1ecaa', dom:'Craft & Structure', skill:'Words in Context', diff:'Medium'},
 {n:3, id:'2b18fad1', dom:'Craft & Structure', skill:'Text Structure & Purpose', diff:'Medium'},
 {n:4, id:'d60bc86d', dom:'Craft & Structure', skill:'Text Structure & Purpose', diff:'Hard'},
 {n:5, id:'2592e0de', dom:'Information & Ideas', skill:'Central Ideas & Details', diff:'Easy'},
 {n:6, id:'2584bcfb', dom:'Information & Ideas', skill:'Command of Evidence (Textual)', diff:'Medium'},
 {n:7, id:'46e45728', dom:'Information & Ideas', skill:'Command of Evidence (Quantitative)', diff:'Easy'},
 {n:8, id:'a13c1c66', dom:'Information & Ideas', skill:'Inferences', diff:'Hard'},
 {n:9, id:'26c8c88c', dom:'Standard English Conventions', skill:'Boundaries', diff:'Easy'},
 {n:10, id:'36944347', dom:'Standard English Conventions', skill:'Form, Structure & Sense', diff:'Medium'},
 {n:11, id:'594b4a94', dom:'Standard English Conventions', skill:'Boundaries', diff:'Hard'},
 {n:12, id:'d2b81427', dom:'Standard English Conventions', skill:'Form, Structure & Sense', diff:'Hard'},
 {n:13, id:'1c36e3e1', dom:'Expression of Ideas', skill:'Transitions', diff:'Easy'},
 {n:14, id:'3c925481', dom:'Expression of Ideas', skill:'Rhetorical Synthesis', diff:'Medium'},
 {n:15, id:'00e0170f', dom:'Expression of Ideas', skill:'Transitions', diff:'Hard'}
];
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

const rows=SEL.map(s=>{
  const q=all.find(x=>x.id===s.id);
  if(!q) throw new Error('MISSING ID '+s.id);
  if(!/^[A-D]$/.test(q.answer)) throw new Error('BAD ANSWER '+s.id);
  return Object.assign({},s,{ans:q.answer});
});

const diffColor={Easy:'#1b7f4b',Medium:'#9a6a00',Hard:'#b3261e'};
let trs='';
rows.forEach(r=>{
  trs+='<tr><td class="n">'+r.n+'</td><td class="a">'+r.ans+'</td><td>'+esc(r.dom)+'</td><td>'+esc(r.skill)+'</td>'+
       '<td><span class="d" style="color:'+diffColor[r.diff]+'">'+r.diff+'</span></td></tr>';
});

const css=`
*{box-sizing:border-box}
body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:760px;margin:0 auto;padding:26px 22px;line-height:1.45}
h1{font-size:20px;margin:0 0 2px}
.sub{color:#666;font-size:13px;margin:0 0 16px}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th,td{border:1px solid #ccc;padding:5px 9px;text-align:left}
thead th{background:#1b4965;color:#fff;font-weight:600}
td.n{text-align:center;width:34px;font-weight:600}
td.a{text-align:center;width:46px;font-weight:800;font-size:15px;color:#1b4965}
.d{font-weight:700}
.grid{display:flex;gap:18px;flex-wrap:wrap;margin-top:18px}
.box{border:1px solid #ccc;border-radius:8px;padding:10px 14px;font-size:13px;min-width:230px}
.box h3{margin:0 0 6px;font-size:13px;color:#1b4965;text-transform:uppercase;letter-spacing:.03em}
.box .line{display:flex;justify-content:space-between;border-bottom:1px dotted #ccc;padding:3px 0}
.box .line b{font-weight:600}
.tot{margin-top:8px;font-size:15px;font-weight:700}
.note{font-size:11.5px;color:#666;margin-top:14px}
@media print{body{padding:10px}.note{margin-top:10px}}
`;

const html='<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'+
 '<title>SAT R&W Baseline - Answer Key</title><style>'+css+'</style></head><body>'+
 '<h1>SAT Reading &amp; Writing &mdash; Baseline Answer Key</h1>'+
 '<p class="sub">Student: ____________________________   Date: ______________   Score: ______ / 15</p>'+
 '<table><thead><tr><th>#</th><th>Ans</th><th>Domain</th><th>Sub-skill</th><th>Difficulty</th></tr></thead><tbody>'+
 trs+'</tbody></table>'+
 '<div class="grid">'+
 '<div class="box"><h3>By Domain</h3>'+
 '<div class="line"><b>Craft &amp; Structure</b><span>____ / 4</span></div>'+
 '<div class="line"><b>Information &amp; Ideas</b><span>____ / 4</span></div>'+
 '<div class="line"><b>Standard English Conventions</b><span>____ / 4</span></div>'+
 '<div class="line"><b>Expression of Ideas</b><span>____ / 3</span></div></div>'+
 '<div class="box"><h3>By Difficulty</h3>'+
 '<div class="line"><b>Easy (below-grade)</b><span>____ / 5</span></div>'+
 '<div class="line"><b>Medium (grade-level)</b><span>____ / 5</span></div>'+
 '<div class="line"><b>Hard (above-grade)</b><span>____ / 5</span></div>'+
 '<div class="tot">Total: ____ / 15</div></div>'+
 '</div>'+
 '<p class="note">Placement screener, not a precise sub-skill diagnosis (3&ndash;4 items per domain). Treat a low domain score as a flag to confirm with a full Bluebook practice test. Difficulty = College Board empirical difficulty, used as a proxy for below/at/above grade level. A flat 5/5/5 form runs harder than a live Module 1, so scores read slightly lower than Bluebook.</p>'+
 '</body></html>';

const out='c:/Antigravity/SAT GUIDES/WAYNE/SAT R&W Baseline - Answer Key.html';
fs.writeFileSync(out,html,'utf8');
console.log('WROTE: '+out+'  ('+html.length+' bytes)');
console.log('ANSWER STRING: '+rows.map(r=>r.n+r.ans).join('  '));
