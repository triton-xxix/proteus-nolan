// Tenet, both ways: the page's own JS. Reads the engine's --sc-p; never edits the engine.
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, body = doc.body;
  var divider = doc.getElementById('divider');
  if (!divider) return;
  var folioAct = divider.querySelector('.folio__act');
  var folioNum = divider.querySelector('.folio__num');
  var folioDay = divider.querySelector('.folio__day');
  var modeWorld = body.classList.contains('mode-world');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var steps = Array.prototype.slice.call(doc.querySelectorAll('.step--fwd'));
  var pincerAct = doc.querySelector('.act--pincer');
  var resolveAct = doc.querySelector('.act--resolve');
  var redClock = doc.querySelector('.pz__clock--red');
  var blueClock = doc.querySelector('.pz__clock--blue');
  var worldClock = doc.querySelector('.pincer__world');
  var lastState = '';

  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function mmss(min) { var s = Math.round(min * 60); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function progressOf(el) { var v = parseFloat(getComputedStyle(el).getPropertyValue('--sc-p')); return isNaN(v) ? 0 : v; }

  // The step nearest the viewport centre decides the folio.
  function nearestStep() {
    var mid = window.innerHeight / 2, best = null, bestD = Infinity;
    for (var i = 0; i < steps.length; i++) {
      var r = steps[i].getBoundingClientRect();
      if (r.height === 0) continue;
      var cue = steps[i].querySelector('.step__cue');
      var op = cue ? parseFloat(getComputedStyle(cue).opacity) : 1;
      if (op < 0.4) continue;
      var d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < bestD) { bestD = d; best = steps[i]; }
    }
    return best;
  }

  function frame() {
    var s = nearestStep();
    var actName = 'The rule', n = '1', day = 'the 14th';
    if (s) {
      actName = s.getAttribute('data-act') || actName;
      n = modeWorld ? s.getAttribute('data-world') : s.getAttribute('data-watch');
      day = s.getAttribute('data-day') || '';
    }
    var hero = doc.querySelector('.act--hero');
    if (hero && hero.getBoundingClientRect().bottom > window.innerHeight * 0.6) { actName = 'The rule'; n = '1'; day = 'the 14th'; }
    if (folioAct.textContent !== actName) folioAct.textContent = actName;
    if (folioNum.textContent !== n) folioNum.textContent = n;
    if (folioDay.textContent !== day) folioDay.textContent = day;

    // The pincer: scroll is ten minutes.
    var worldMin = '-';
    if (pincerAct) {
      var p = progressOf(pincerAct);
      var r = pincerAct.getBoundingClientRect();
      var on = r.top < window.innerHeight && r.bottom > 0;
      body.classList.toggle('is-pincer', on);
      if (on) {
        var m = reduce ? 5 : p * 10;
        var remaining = mmss(10 - m);
        if (redClock) redClock.textContent = remaining;
        if (blueClock) blueClock.textContent = remaining;
        if (worldClock) worldClock.textContent = mmss(m);
        worldMin = m.toFixed(1);
      }
    }

    // The close: the divider travels to the edge over the last act's own height.
    var dividerPct = 50;
    if (resolveAct && !modeWorld) {
      var rr = resolveAct.getBoundingClientRect();
      var span = Math.max(rr.height - window.innerHeight * 0.4, 1);
      var t = clamp((window.innerHeight * 0.85 - rr.top) / span);
      if (reduce) t = t > 0.5 ? 1 : 0;
      root.style.setProperty('--tn-collapse', t.toFixed(3));
      dividerPct = Math.round(50 + 50 * t);
      root.style.setProperty('--tn-divider', String(dividerPct));
      if (t >= 0.999) divider.setAttribute('data-sc-verify-hold', 'true'); else divider.removeAttribute('data-sc-verify-hold');
    }

    var state = (modeWorld ? 'world' : 'watch') + '|' + actName.toLowerCase().replace(/\s+/g, '-') + '|' + n + '|' + dividerPct + '|' + worldMin;
    if (state !== lastState && divider.hasAttribute('data-sc-verify-state')) { divider.setAttribute('data-sc-verify-state', state); lastState = state; }
  }

  var ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; frame(); }); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  // The mode toggle carries you to the same event on the other page.
  Array.prototype.forEach.call(doc.querySelectorAll('[data-mode-link]'), function (a) {
    a.addEventListener('click', function (ev) {
      var s = nearestStep();
      if (!s) return;
      ev.preventDefault();
      var id = s.getAttribute('data-ev');
      var href = a.getAttribute('href').split('#')[0];
      var glyph = divider.querySelector('.divider__line');
      if (glyph && !reduce) { glyph.style.transition = 'transform 240ms cubic-bezier(0.23,1,0.32,1)'; glyph.style.transform = 'scaleY(-1)'; }
      setTimeout(function () { window.location.href = href + '#ev-' + id; }, reduce ? 0 : 240);
    });
  });

  // Landing on #ev-<id>: inside a pinned act, park the act where that step's cue is open.
  function landOnHash() {
    var h = window.location.hash;
    if (!h || h.indexOf('#ev-') !== 0) return;
    var el = doc.getElementById(h.slice(1));
    if (!el) return;
    var act = el.closest('[data-sc-act]');
    if (act && act.getAttribute('data-sc-act') === 'pin') {
      var cue = el.querySelector('.step__cue');
      var win = cue && cue.getAttribute('data-sc-cue');
      var mid = 0.5;
      if (win) { var parts = win.split(/\s+/).map(parseFloat); mid = parts.length > 1 ? (parts[0] + parts[1]) / 2 : Math.min(parts[0] + 0.15, 0.95); }
      var top = act.getBoundingClientRect().top + window.scrollY;
      var travel = Math.max(act.offsetHeight - window.innerHeight, 1);
      window.scrollTo({ top: top + travel * mid, behavior: 'instant' });
    } else {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  }
  window.addEventListener('load', function () { setTimeout(function () { landOnHash(); frame(); }, 60); });
  frame();
})();
