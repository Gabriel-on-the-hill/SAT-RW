// eliminator.js — the Bluebook answer eliminator, on every surface that shows A–D.
//
// Added 5 Oct 2026. On the real digital test a student can switch on "cross out"
// and strike the choices she has ruled out, so the ones left standing are the ones
// she is actually deciding between. Our students sit that test, so the app should
// behave like it.
//
// HOW IT WORKS, AND WHY IT IS BUILT THIS WAY
//   • A toggle above the choices ("Cross out") turns the tool on for the device.
//     While it is on, each choice shows a small struck letter on its right. Tap it
//     to cross that choice out; tap "Undo" to bring it back.
//   • Tapping the CHOICE ITSELF still selects it, exactly as before. Crossing out
//     never selects and selecting never crosses out — the same split Bluebook makes.
//     Selecting a choice you had crossed out restores it (also Bluebook's rule).
//   • The strike control lives INSIDE each option button as a <span>, not beside it.
//     That keeps every surface's DOM unchanged: `box.children`, `.opt`, `.copt`,
//     `.option-btn` and `#xOptions button` all still find exactly the four options.
//     Its click is stopped before it reaches the option, so it can never select.
//     A disabled (graded) option receives no clicks at all, so a graded question
//     locks the tool for free.
//   • The selected choice cannot be crossed out. Crossing out the answer you have
//     chosen is a contradiction the scoring could not represent honestly.
//
// WHAT IS LOGGED
//   report(ns, id, answer) → { elim: "BD", elimAnswer: true|false }
//   `elim` is what is crossed out now; `elimAnswer` is whether the CORRECT answer was
//   crossed out at any point. That second one is the diagnostic: a student who
//   strikes the right answer is eliminating on "sounds wrong", not on the task.
//   Callers add both to the per-question payload; it rides in Raw payload and, once
//   the Apps Script is redeployed, in the Questions tab's "Crossed out" column.
//
// State is per tab (sessionStorage), keyed by a namespace the caller chooses (one
// per sitting) plus the question id, so going Back to a question shows what you
// crossed out, and a later sitting of the same question starts clean.
(function () {
  'use strict';
  var MODE_KEY = 'satrw_elim_on';
  var PFX = 'satrw_elim:';
  var LETTERS = ['A', 'B', 'C', 'D'];
  var mem = Object.create(null);
  var lastContainer = null;

  function key(ns, id) { return String(ns || '') + '|' + String(id || ''); }
  function load(k) {
    if (mem[k]) return mem[k];
    var s = null;
    try { s = JSON.parse(sessionStorage.getItem(PFX + k)); } catch (e) { }
    return (mem[k] = (s && Array.isArray(s.x) && Array.isArray(s.ever)) ? s : { x: [], ever: [] });
  }
  function save(k) { try { sessionStorage.setItem(PFX + k, JSON.stringify(mem[k])); } catch (e) { } }

  function isOn() { try { return localStorage.getItem(MODE_KEY) === '1'; } catch (e) { return false; } }
  function setOn(on) {
    try { localStorage.setItem(MODE_KEY, on ? '1' : '0'); } catch (e) { }
    paintMode();
  }
  function paintMode() {
    var on = isOn();
    document.documentElement.classList.toggle('elim-on', on);
    Array.prototype.forEach.call(document.querySelectorAll('.elim-toggle'), function (b) {
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.title = on ? 'Turn off cross out' : 'Turn on cross out';
    });
  }

  var CSS = [
    '.elim-bar{display:flex;justify-content:flex-end;margin:.15rem 0 .45rem}',
    '.elim-bar[hidden]{display:none}',
    '.elim-toggle{font:inherit;font-size:.78rem;font-weight:600;color:#334155;background:#fff;border:1.5px solid #cbd5e1;border-radius:999px;padding:.25rem .7rem;cursor:pointer;display:inline-flex;align-items:center;gap:.4rem}',
    '.elim-toggle s{letter-spacing:.04em}',
    '.elim-toggle[aria-pressed="true"]{background:#1e293b;color:#fff;border-color:#1e293b}',
    '.elim-opt{position:relative}',
    'html.elim-on .elim-opt{padding-right:3.4rem !important}',
    '.elim-x{display:none;position:absolute;right:.55rem;top:50%;transform:translateY(-50%);min-width:1.75rem;height:1.75rem;padding:0 .35rem;box-sizing:border-box;border:1.5px solid #64748b;border-radius:999px;background:#fff;color:#334155;font-size:.74rem;font-weight:700;line-height:1;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;z-index:1}',
    'html.elim-on .elim-x{display:inline-flex}',
    '.elim-x:hover,.elim-x:focus-visible{border-color:#1e293b;outline:none;box-shadow:0 0 0 2px rgba(30,41,59,.18)}',
    '.elim-out .elim-x{border-style:dashed}',
    '.elim-opt:disabled .elim-x,.elim-opt.sel .elim-x,.elim-opt.selected .elim-x,.elim-opt.pending .elim-x,.elim-opt[aria-pressed="true"] .elim-x{display:none !important}',
    '.elim-out{color:#94a3b8 !important}',
    '.elim-out>*:not(.elim-x){opacity:.55}',
    '.elim-out::after{content:"";position:absolute;left:.5rem;right:.5rem;top:50%;border-top:2px solid #64748b;pointer-events:none}',
    'html.elim-on .elim-out::after{right:4rem}',
    '@media (prefers-color-scheme:dark){.elim-toggle,.elim-x{background:#0f172a;color:#e2e8f0;border-color:#475569}.elim-toggle[aria-pressed="true"]{background:#e2e8f0;color:#0f172a}}'
  ].join('');
  function injectCss() {
    if (document.getElementById('elimCss')) return;
    var st = document.createElement('style');
    st.id = 'elimCss';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function letterOf(btn, i) {
    var d = btn.getAttribute('data-l') || btn.getAttribute('data-answer');
    if (d && /^[A-D]$/.test(d)) return d;
    var di = btn.getAttribute('data-i');
    if (di != null && /^[0-3]$/.test(di)) return LETTERS[Number(di)];
    var ol = btn.querySelector && btn.querySelector('.opt-letter');
    var t = ((ol ? ol.textContent : btn.textContent) || '').trim();
    if (/^[A-D][.)\s]/.test(t) || /^[A-D]$/.test(t)) return t[0];
    return LETTERS[i] || null;
  }
  function isSelected(btn) {
    return /(^|\s)(sel|selected|pending|chosen)(\s|$)/.test(btn.className) || btn.getAttribute('aria-pressed') === 'true';
  }
  function isHidden(el) {
    return !el || el.hidden || el.classList.contains('hidden') || el.style.display === 'none';
  }

  function paint(container) {
    var k = container.getAttribute('data-elim-key');
    if (!k) return;
    var st = load(k);
    Array.prototype.forEach.call(container.querySelectorAll('.elim-opt'), function (btn) {
      var L = btn.getAttribute('data-elim-l');
      var out = st.x.indexOf(L) >= 0;
      btn.classList.toggle('elim-out', out);
      var x = btn.querySelector('.elim-x');
      if (x) {
        x.innerHTML = out ? 'Undo' : '<s>' + L + '</s>';
        x.setAttribute('aria-label', out ? 'Undo cross out of choice ' + L : 'Cross out choice ' + L);
        x.setAttribute('aria-pressed', out ? 'true' : 'false');
      }
    });
  }

  function toggle(container, btn) {
    if (!btn || btn.disabled || isSelected(btn)) return false;
    var k = container.getAttribute('data-elim-key'), L = btn.getAttribute('data-elim-l');
    if (!k || !L) return false;
    var st = load(k), at = st.x.indexOf(L);
    if (at >= 0) st.x.splice(at, 1);
    else {
      st.x.push(L);
      if (st.ever.indexOf(L) < 0) st.ever.push(L);
    }
    save(k);
    paint(container);
    return true;
  }

  function restore(container, btn) {
    var k = container.getAttribute('data-elim-key'), L = btn.getAttribute('data-elim-l');
    var st = load(k), at = st.x.indexOf(L);
    if (at < 0) return;
    st.x.splice(at, 1);
    save(k);
    paint(container);
  }

  function syncBar(container) {
    var bar = container.__elimBar;
    if (bar) bar.hidden = isHidden(container);
  }

  // decorate(container, { ns, id, selector })
  //   container — the element holding the four option buttons
  //   ns, id    — namespace for this sitting + the question id
  //   selector  — how to find the options inside it (default: 'button')
  // Safe to call again after every re-render: it only adds what is missing.
  function decorate(container, opts) {
    if (!container || !opts) return;
    injectCss();
    var k = key(opts.ns, opts.id);
    container.setAttribute('data-elim-key', k);
    lastContainer = container;

    var btns = container.querySelectorAll(opts.selector || 'button');
    Array.prototype.forEach.call(btns, function (btn, i) {
      if (btn.classList.contains('elim-x')) return;
      var L = letterOf(btn, i);
      if (!L) return;
      btn.setAttribute('data-elim-l', L);
      btn.classList.add('elim-opt');
      if (!btn.querySelector('.elim-x')) {
        var x = document.createElement('span');
        x.className = 'elim-x';
        x.setAttribute('role', 'button');
        x.setAttribute('tabindex', '0');
        function act(e) {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          toggle(container, btn);
        }
        x.addEventListener('click', act);
        x.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') act(e);
        });
        btn.appendChild(x);
      }
    });

    // Selecting a crossed-out choice brings it back first. Capture phase, so it runs
    // before the surface's own click handler, which then selects as normal.
    if (!container.__elimWired) {
      container.__elimWired = true;
      container.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest || t.closest('.elim-x')) return;
        var btn = t.closest('.elim-opt');
        if (btn && btn.classList.contains('elim-out') && !btn.disabled) restore(container, btn);
      }, true);
    }

    // The toggle sits just above the choices and follows their visibility, so it is
    // not offered during the predict-first step, when the choices are still hidden.
    var bar = container.__elimBar;
    if (!bar || !bar.parentNode || bar.nextElementSibling !== container) {
      bar = document.createElement('div');
      bar.className = 'elim-bar';
      bar.innerHTML = '<button type="button" class="elim-toggle" aria-pressed="false"><s>ABC</s> Cross out</button>';
      bar.firstChild.addEventListener('click', function () { setOn(!isOn()); });
      if (container.parentNode) container.parentNode.insertBefore(bar, container);
      container.__elimBar = bar;
      if (typeof MutationObserver === 'function' && !container.__elimObs) {
        container.__elimObs = new MutationObserver(function () { syncBar(container); });
        container.__elimObs.observe(container, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
      }
    }
    syncBar(container);
    paintMode();
    paint(container);
  }

  function report(ns, id, answer) {
    var st = mem[key(ns, id)] || load(key(ns, id));
    return {
      elim: st.x.slice().sort().join(''),
      elimAnswer: !!(answer && st.ever.indexOf(answer) >= 0)
    };
  }

  // Shift + A–D crosses out (or restores) on the choices most recently shown, while
  // the tool is on and the cursor is not in a text box.
  document.addEventListener('keydown', function (e) {
    if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || !isOn()) return;
    var t = e.target && e.target.tagName;
    if (t === 'TEXTAREA' || t === 'INPUT' || t === 'SELECT' || (e.target && e.target.isContentEditable)) return;
    var L = (e.key || '').toUpperCase();
    if (LETTERS.indexOf(L) < 0) return;
    var c = lastContainer;
    if (!c || !document.body.contains(c) || isHidden(c)) return;
    var btn = c.querySelector('.elim-opt[data-elim-l="' + L + '"]');
    if (btn && toggle(c, btn)) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  window.Eliminator = { decorate: decorate, report: report, isOn: isOn, setOn: setOn, _key: key };
})();
