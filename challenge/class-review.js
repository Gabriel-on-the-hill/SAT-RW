// Complete, separated question cards for every class-route review surface.
(function () {
  'use strict';
  function esc(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function rich(v) { return esc(v).replace(/&lt;(\/?)(u|i|em|b|strong|sub|sup)&gt;/gi,'<$1$2>').replace(/\n\n+/g,'</p><p>').replace(/\n/g,'<br>'); }
  function installStyle() {
    if(document.getElementById('classReviewStyle'))return;
    var e=document.createElement('style');e.id='classReviewStyle';e.textContent=
      '.class-review{border:1px solid #cbd5e1;border-radius:14px;margin:24px 0;background:#fff;color:#172238;overflow:hidden;text-align:left;box-shadow:0 2px 8px #17223808}' +
      '.class-review__head{padding:16px 20px;background:#edf3f8;border-bottom:1px solid #cbd5e1;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}' +
      '.class-review h3,.class-review h4{margin:0;font-weight:700;line-height:1.4}.class-review h3{font-size:1.1rem}.class-review h4{font-size:.85rem;text-transform:uppercase;letter-spacing:.06em;color:#43556d;margin-bottom:12px}' +
      '.class-review__section{padding:20px}.class-review__section+.class-review__section{border-top:1px solid #dce4ec}.class-review__passage{line-height:1.65;margin:0 0 16px}.class-review__stem{line-height:1.5;font-weight:650}' +
      '.class-review__options{list-style:none;padding:0;margin:16px 0 0;display:grid;gap:9px}.class-review__option{border:1px solid #d7dfe7;border-radius:8px;padding:12px;line-height:1.5;display:flex;gap:12px;align-items:flex-start}' +
      '.class-review__option.is-correct{border:2px solid #237a56;background:#f0faf4}.class-review__option.is-selected:not(.is-correct){border:2px solid #b34a3e;background:#fff6f4}.class-review__tags{font-size:.8rem;display:block;font-weight:650;margin-top:6px}' +
      '.class-review__explanation{background:#f7fafc;border-left:4px solid #486b91;line-height:1.65}.class-review__explanation p{margin:0 0 12px}.class-review__explanation p:last-child{margin-bottom:0}' +
      '.class-review__summary{line-height:1.6;margin:0 0 10px}.class-review details{margin-top:12px}.class-review summary{cursor:pointer;font-weight:600}.class-review__id{font-size:.8rem;color:#55667a}.class-review img{display:block;max-width:100%;height:auto;margin:12px auto}' +
      '@media(max-width:520px){.class-review__head,.class-review__section{padding:14px}.class-review__option{padding:10px}.class-review{margin:18px 0}}';
    document.head.appendChild(e);
  }
  function render(q,o) {
    installStyle();o=o||{};
    var correct=typeof q.answer==='number'?'ABCD'[q.answer]:q.answer;
    var chosen=typeof o.chosen==='number'?'ABCD'[o.chosen]:o.chosen;
    var status=!chosen?'Not answered':chosen===correct?'Correct':'Review this answer';
    var figure=q.image&&/^(?:assets\/)[\w./-]+\.(?:png|jpe?g|svg|webp)$/i.test(q.image)?'<img src="'+esc(q.image)+'" alt="'+esc(q.alt||'Question figure')+'">':'';
    var grid=q.table?'<div style="overflow-x:auto"><table><caption>'+esc(q.table.caption||'Question data')+'</caption><thead><tr>'+q.table.headers.map(function(v){return '<th scope="col" style="padding:8px;border:1px solid #cbd5e1">'+esc(v)+'</th>';}).join('')+'</tr></thead><tbody>'+q.table.rows.map(function(row){return '<tr>'+row.map(function(v){return '<td style="padding:8px;border:1px solid #cbd5e1">'+esc(v)+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>':'';
    var options=(q.options||[]).map(function(v,i){var l='ABCD'[i],isRight=l===correct,isSelected=l===chosen;
      return '<li class="class-review__option'+(isRight?' is-correct':'')+(isSelected?' is-selected':'')+'"><b>'+l+'</b><span>'+rich(String(v).replace(/^[ABCD][.)]\s*/,''))+(isRight||isSelected?'<span class="class-review__tags">'+(isSelected?'Your answer':'')+(isSelected&&isRight?' · ':'')+(isRight?'Correct answer':'')+'</span>':'')+'</span></li>';
    }).join('');
    return '<article class="class-review" data-question-id="'+esc(q.id||q.bankId||'')+'"><header class="class-review__head"><h3>Question '+esc(o.number||1)+'</h3><span>'+esc(status)+'</span><span class="class-review__id">'+esc(q.id||q.bankId||'')+'</span></header>'+
      '<section class="class-review__section"><h4>Question</h4>'+figure+grid+'<div class="class-review__passage"><p>'+rich(q.passage)+'</p></div><p class="class-review__stem">'+rich(q.question)+'</p><ol class="class-review__options">'+options+'</ol></section>'+
      '<section class="class-review__section"><h4>Your response</h4><p class="class-review__summary">Your answer: <b>'+esc(chosen||'Not answered')+'</b> · Correct answer: <b>'+esc(correct)+'</b>'+(o.expired?' · After the time limit':'')+'</p>'+
      (o.note?'<p><b>Your original note:</b> '+rich(o.note)+'</p>':o.note===false?'':'<p>No typed note recorded. Oral or paper reasoning may have been used.</p>')+
      (o.reason?'<p><b>Your explanation:</b> '+rich(o.reason)+'</p>':'')+
      (o.conditions?'<details><summary>Attempt details</summary><p>'+esc(o.conditions)+'</p></details>':'')+'</section>'+
      '<section class="class-review__section class-review__explanation"><h4>Explanation</h4><p>'+rich(q.explanation)+'</p></section></article>';
  }
  window.ClassReview={render:render};
})();
