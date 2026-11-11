(function () {
  'use strict';

  // One large square is 1 mm x 1 mm x 0.1 mm deep = 0.1 uL, so count x 10^4 = cells per mL.
  var CHAMBER_FACTOR = 1e4;
  var STORE_KEY = 'hemocytocount.state';
  var THEME_KEY = 'hemocytocount.theme';
  // Grid positions (row-major, 3 x 3) of the squares that take counts: four corners and the centre.
  var COUNT_POSITIONS = [0, 2, 4, 6, 8];

  function parseCount(value) {
    if (value === '' || value == null) return null;
    var n = Number(value);
    return isFinite(n) && n >= 0 ? n : null;
  }

  // squares: [{ live: string, dead: string }]; a square is "counted" when either box holds a value.
  function calculate(squares, dilution, volume) {
    var counted = 0, live = 0, dead = 0;
    squares.forEach(function (sq) {
      var l = parseCount(sq.live), d = parseCount(sq.dead);
      if (l === null && d === null) return;
      counted += 1;
      live += l || 0;
      dead += d || 0;
    });
    var res = { counted: counted, live: live, dead: dead, liveConc: null, deadConc: null, totalConc: null,
      viability: null, liveTotal: null, deadTotal: null, allTotal: null };
    if (!counted || !(dilution > 0)) return res;
    res.liveConc = live / counted * dilution * CHAMBER_FACTOR;
    res.deadConc = dead / counted * dilution * CHAMBER_FACTOR;
    res.totalConc = res.liveConc + res.deadConc;
    if (live + dead > 0) res.viability = live / (live + dead) * 100;
    if (volume > 0) {
      res.liveTotal = res.liveConc * volume;
      res.deadTotal = res.deadConc * volume;
      res.allTotal = res.totalConc * volume;
    }
    return res;
  }

  // Overlays concentrations typed in by hand. Up to two of live/dead/total are
  // taken as given and the third follows from total = live + dead.
  function applyManual(res, manual, volume) {
    var has = function (k) { return manual && typeof manual[k] === 'number'; };
    if (!has('live') && !has('dead') && !has('total')) return res;
    var L, D, T;
    if (has('total')) {
      T = manual.total;
      if (has('live')) { L = manual.live; D = T - L; }
      else if (has('dead')) { D = manual.dead; L = T - D; }
      else { L = null; D = null; }
    } else {
      L = has('live') ? manual.live : res.liveConc;
      D = has('dead') ? manual.dead : res.deadConc;
      T = L !== null && D !== null ? L + D : null;
    }
    var out = { counted: res.counted, live: res.live, dead: res.dead, manual: true, conflict: false,
      viability: null, liveTotal: null, deadTotal: null, allTotal: null };
    if (L !== null && L < 0) { L = null; out.conflict = true; }
    if (D !== null && D < 0) { D = null; out.conflict = true; }
    out.liveConc = L; out.deadConc = D; out.totalConc = T;
    if (L !== null && D !== null && T > 0) out.viability = L / T * 100;
    if (volume > 0) {
      if (L !== null) out.liveTotal = L * volume;
      if (D !== null) out.deadTotal = D * volume;
      if (T !== null) out.allTotal = T * volume;
    }
    return out;
  }

  var SUPERS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

  // Accepts 1250000, 1,250,000, 1.25e6, 1.25E+06, 1.25 x 10^6 and 1.25 × 10⁶.
  function parseCells(text) {
    var s = String(text == null ? '' : text).trim();
    if (!s) return null;
    s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, function (run) {
      return '^' + run.replace(/./g, function (ch) {
        return ch === '⁺' ? '+' : ch === '⁻' ? '-' : String(SUPERS.indexOf(ch));
      });
    });
    s = s.replace(/[\s\u00a0\u202f]/g, '').replace(/−/g, '-');
    if (/^\d+,\d+$/.test(s.split(/[ex×*·]/i)[0]) && !/^\d{1,3},\d{3}$/.test(s.split(/[ex×*·]/i)[0])) s = s.replace(',', '.');
    s = s.replace(/,/g, '');
    var m = /^(\d+\.?\d*|\.\d+)(?:(?:[x×*·]10\^?|e)([+-]?\d+))?$/i.exec(s);
    var n;
    if (m) n = Number(m[1]) * Math.pow(10, Number(m[2] || 0));
    else if ((m = /^10\^([+-]?\d+)$/.exec(s))) n = Math.pow(10, Number(m[1]));
    else return NaN;
    return isFinite(n) ? n : NaN;
  }

  // Plain-text version of formatCells for editable boxes and the clipboard.
  function formatCellsText(x, sci) {
    if (x === null || x === undefined) return '';
    if (x === 0) return '0';
    if (!sci) return Math.round(x).toLocaleString('en-GB');
    var parts = x.toExponential(2).split('e');
    var exp = String(Number(parts[1])).replace(/./g, function (ch) {
      return ch === '-' ? '⁻' : SUPERS.charAt(Number(ch));
    });
    return parts[0] + ' × 10' + exp;
  }

  function formatCells(x, sci) {
    if (x === null) return '—';
    if (x === 0) return '0';
    if (!sci) return Math.round(x).toLocaleString('en-GB');
    var parts = x.toExponential(2).split('e');
    return parts[0] + ' × 10<sup>' + Number(parts[1]) + '</sup>';
  }

  function formatVolume(x) {
    if (x >= 0.001 && x < 1e6) return String(Number(x.toPrecision(3)));
    var parts = x.toExponential(2).split('e');
    return parts[0] + ' × 10<sup>' + Number(parts[1]) + '</sup>';
  }

  window.hemocytocount = { calculate: calculate, applyManual: applyManual, parseCells: parseCells,
    formatCells: formatCells, formatCellsText: formatCellsText, formatVolume: formatVolume };

  var $ = function (id) { return document.getElementById(id); };
  var squares = [];
  var selected = 0;
  var soundOn = true;
  var CONC_KEYS = ['live', 'dead', 'total'];
  // Hand-entered concentrations, oldest first: [{ key: 'live', value: 1.2e6 }].
  var manual = [];

  // ---------- Haemocytometer drawing ----------
  function buildGridSvg() {
    var s = '<svg viewBox="-2 -2 304 304" aria-hidden="true" focusable="false">';
    var line = function (x1, y1, x2, y2, cls) {
      return '<line class="' + cls + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
    };
    var i, p;
    COUNT_POSITIONS.forEach(function (pos) {
      var x = (pos % 3) * 100, y = Math.floor(pos / 3) * 100;
      s += '<rect class="' + (pos === 4 ? 'g-centre' : 'g-tint') + '" x="' + x + '" y="' + y + '" width="100" height="100"/>';
    });
    // Centre square: 25 groups of 16 small squares.
    for (i = 1; i < 20; i++) {
      p = 100 + i * 5;
      s += line(p, 100, p, 200, 'g-fine') + line(100, p, 200, p, 'g-fine');
    }
    // Side squares: closely ruled in one direction.
    for (i = 1; i < 20; i++) {
      p = 100 + i * 5;
      s += line(p, 0, p, 100, 'g-fine') + line(p, 200, p, 300, 'g-fine');
      s += line(0, p, 100, p, 'g-fine') + line(200, p, 300, p, 'g-fine');
    }
    // Main rulings: every 0.25 mm outside the centre, every 0.2 mm inside it.
    for (i = 0; i <= 12; i++) {
      p = i * 25;
      if (p > 100 && p < 200) {
        s += line(p, 0, p, 100, 'g-line') + line(p, 200, p, 300, 'g-line');
        s += line(0, p, 100, p, 'g-line') + line(200, p, 300, p, 'g-line');
      } else {
        s += line(p, 0, p, 300, 'g-line') + line(0, p, 300, p, 'g-line');
      }
    }
    for (i = 1; i < 5; i++) {
      p = 100 + i * 20;
      s += line(p, 100, p, 200, 'g-line') + line(100, p, 200, p, 'g-line');
    }
    // Counting rule: include cells touching the top and left boundary of each counted square.
    COUNT_POSITIONS.forEach(function (pos) {
      var x = (pos % 3) * 100, y = Math.floor(pos / 3) * 100;
      s += '<path class="g-rule" d="M' + x + ' ' + (y + 100) + 'V' + y + 'H' + (x + 100) + '"/>';
    });
    return s + '</svg>';
  }

  function buildHemo() {
    var hemo = $('hemo');
    var html = buildGridSvg() + '<div class="squares">';
    var n = 0;
    for (var pos = 0; pos < 9; pos++) {
      if (COUNT_POSITIONS.indexOf(pos) === -1) { html += '<div></div>'; continue; }
      n += 1;
      html += '<div class="square" data-index="' + (n - 1) + '">' +
        '<span class="square-num">' + n + '</span>' +
        '<label class="count count-live"><span>Live</span>' +
        '<input type="number" inputmode="numeric" min="0" step="1" placeholder="–" data-kind="live" aria-label="Square ' + n + ' live cells"></label>' +
        '<label class="count count-dead"><span>Dead</span>' +
        '<input type="number" inputmode="numeric" min="0" step="1" placeholder="–" data-kind="dead" aria-label="Square ' + n + ' dead cells"></label>' +
        '</div>';
    }
    hemo.innerHTML = html + '</div>';

    Array.prototype.forEach.call(hemo.querySelectorAll('.square'), function (el, i) {
      var sq = {
        el: el,
        live: el.querySelector('[data-kind="live"]'),
        dead: el.querySelector('[data-kind="dead"]')
      };
      squares.push(sq);
      el.addEventListener('click', function () { select(i); });
      [sq.live, sq.dead].forEach(function (input) {
        input.addEventListener('focus', function () { select(i); });
        input.addEventListener('input', function () { manual = []; update(); });
      });
    });

    var picker = $('squarePicker');
    squares.forEach(function (sq, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = String(i + 1);
      b.setAttribute('aria-label', 'Square ' + (i + 1));
      b.addEventListener('click', function () { select(i); });
      picker.appendChild(b);
    });
  }

  function select(i) {
    selected = i;
    squares.forEach(function (sq, j) { sq.el.classList.toggle('selected', j === i); });
    Array.prototype.forEach.call($('squarePicker').children, function (b, j) {
      b.setAttribute('aria-pressed', j === i ? 'true' : 'false');
    });
    updateTally();
  }

  // ---------- Tally clicker ----------
  var audioCtx = null;

  function ensureAudio() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    try {
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return true;
    } catch (e) { return false; }
  }

  function playClick(freq) {
    if (!soundOn) return;
    if (!ensureAudio()) return;
    try {
      var len = Math.floor(audioCtx.sampleRate * 0.04);
      var buffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
      }
      var src = audioCtx.createBufferSource();
      src.buffer = buffer;
      var filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = 1.2;
      var gain = audioCtx.createGain();
      gain.gain.value = 1.6;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      src.start();
    } catch (e) { /* audio unavailable */ }
  }

  function tally(kind, delta, silent) {
    var input = squares[selected][kind];
    var current = parseCount(input.value);
    if (delta < 0 && !current) return false;
    input.value = String(Math.max(0, Math.floor(current || 0) + delta));
    manual = [];
    if (!silent) {
      playClick(delta < 0 ? 900 : kind === 'live' ? 2600 : 1700);
      if (navigator.vibrate) navigator.vibrate(12);
    }
    update();
    return true;
  }

  function updateTally() {
    var sq = squares[selected];
    $('tallyLiveCount').textContent = parseCount(sq.live.value) || 0;
    $('tallyDeadCount').textContent = parseCount(sq.dead.value) || 0;
  }

  function setSound(on) {
    soundOn = on;
    var b = $('soundBtn');
    b.textContent = on ? '🔊 Sound on' : '🔇 Sound off';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  var locked = false;

  function setLocked(on) {
    locked = on;
    var b = $('lockBtn');
    b.textContent = on ? '🔒 Locked' : '🔓 Lock page';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.title = on ? 'Scrolling is disabled. Tap to unlock.' : 'Disable scrolling while you tally.';
    document.documentElement.classList.toggle('locked', on);
    if (on) $('tallyCard').scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }

  // ---------- Results ----------
  function numberFrom(id) {
    var v = $(id).value;
    return v === '' ? NaN : Number(v);
  }

  function update() {
    var sci = $('sciToggle').checked;
    var volume = numberFrom('volume');
    var res = calculate(squares.map(function (sq) {
      return { live: sq.live.value, dead: sq.dead.value };
    }), numberFrom('dilution'), volume);

    $('summary').textContent = res.counted
      ? res.counted + (res.counted === 1 ? ' square' : ' squares') + ' counted · ' + res.live + ' live · ' + res.dead + ' dead'
      : 'No squares counted yet.';

    var given = {};
    manual.forEach(function (m) { given[m.key] = m.value; });
    res = applyManual(res, given, volume);
    var note = $('manualNote');
    note.hidden = !manual.length;
    note.classList.toggle('warn', !!res.conflict);
    if (manual.length) {
      var names = manual.map(function (m) { return m.key; }).sort().join(' and ');
      $('manualText').textContent = res.conflict
        ? 'The entered ' + names + ' cells/mL do not add up (total is smaller than its part).'
        : 'Using the ' + names + ' cells/mL you entered.';
    }
    CONC_KEYS.forEach(function (key) {
      var el = $(key + 'Conc');
      el.parentNode.classList.toggle('manual', given[key] !== undefined);
      // Leave a box alone while it is being typed in.
      if (el.dataset.dirty && document.activeElement === el) return;
      el.value = formatCellsText(res[key + 'Conc'], sci);
      el.classList.remove('invalid');
    });
    $('viability').textContent = res.viability === null ? '—' : res.viability.toFixed(1) + ' %';
    $('liveTotal').innerHTML = formatCells(res.liveTotal, sci);
    $('deadTotal').innerHTML = formatCells(res.deadTotal, sci);
    $('allTotal').innerHTML = formatCells(res.allTotal, sci);

    var target = numberFrom('targetMantissa') * Math.pow(10, numberFrom('targetExponent'));
    var out = $('volNeeded');
    note = $('volNote');
    note.className = 'hint';
    note.textContent = 'Based on the live cell concentration above.';
    if (res.liveConc > 0 && target > 0 && isFinite(target)) {
      var mL = target / res.liveConc;
      out.innerHTML = formatVolume(mL) + ' mL <small>(' + formatVolume(mL * 1000) + ' µL)</small>';
      if (volume > 0 && mL > volume) {
        note.className = 'hint warn';
        note.textContent = 'This is more than the ' + formatVolume(volume).replace(/<[^>]+>/g, '') +
          ' mL of suspension available — you do not have enough live cells.';
      }
    } else {
      out.textContent = '—';
      if (!(res.liveConc > 0)) note.textContent = 'Enter live cell counts or a live cells/mL value above to calculate a volume.';
    }

    updateTally();
    save();
  }

  // ---------- Persistence ----------
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        counts: squares.map(function (sq) { return [sq.live.value, sq.dead.value]; }),
        volume: $('volume').value,
        dilution: $('dilution').value,
        sci: $('sciToggle').checked,
        sound: soundOn,
        mantissa: $('targetMantissa').value,
        exponent: $('targetExponent').value,
        selected: selected,
        manual: manual
      }));
    } catch (e) { /* storage unavailable */ }
  }

  function restore() {
    var st;
    try { st = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { st = null; }
    if (!st) return;
    (st.counts || []).forEach(function (c, i) {
      if (!squares[i] || !c) return;
      squares[i].live.value = c[0] || '';
      squares[i].dead.value = c[1] || '';
    });
    if (st.volume != null) $('volume').value = st.volume;
    if (st.dilution) $('dilution').value = st.dilution;
    if (typeof st.sci === 'boolean') $('sciToggle').checked = st.sci;
    if (typeof st.sound === 'boolean') soundOn = st.sound;
    if (st.mantissa != null) $('targetMantissa').value = st.mantissa;
    if (st.exponent != null) $('targetExponent').value = st.exponent;
    if (st.selected >= 0 && st.selected < squares.length) selected = st.selected;
    if (Array.isArray(st.manual)) {
      manual = st.manual.filter(function (m) {
        return m && CONC_KEYS.indexOf(m.key) !== -1 && typeof m.value === 'number' && isFinite(m.value) && m.value >= 0;
      }).slice(-2);
    }
  }

  // ---------- Theme ----------
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $('themeBtn').textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* storage unavailable */ }
  }

  // ---------- Wiring ----------
  buildHemo();
  restore();
  setSound(soundOn);
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  select(selected);
  update();

  // Multi-touch: every finger counts on touch-down, so Live and Dead can be
  // pressed together or in quick succession. Clicks only handle the keyboard.
  function bindTally(id, kind, delta) {
    var btn = $(id);
    var active = {};
    var release = function (e) {
      delete active[e.pointerId];
      if (!Object.keys(active).length) btn.classList.remove('pressed');
    };
    if (window.PointerEvent) {
      btn.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        btn.classList.add('pressed');
        // While the page can still scroll, a touch only counts on release, so
        // a swipe that starts on a button neither counts nor clicks.
        var pending = e.pointerType === 'touch' && !locked;
        active[e.pointerId] = { pending: pending };
        if (!pending) tally(kind, delta);
      });
      btn.addEventListener('pointerup', function (e) {
        var press = active[e.pointerId];
        if (press && press.pending) tally(kind, delta);
        release(e);
      });
      ['pointercancel', 'pointerleave'].forEach(function (type) {
        btn.addEventListener(type, release);
      });
      btn.addEventListener('click', function (e) { if (e.detail === 0) tally(kind, delta); });
    } else {
      btn.addEventListener('click', function () { tally(kind, delta); });
    }
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  bindTally('tallyLive', 'live', 1);
  bindTally('tallyDead', 'dead', 1);
  bindTally('undoLive', 'live', -1);
  bindTally('undoDead', 'dead', -1);
  // iOS only unlocks audio on touchend/click, not on touch-down.
  ['touchend', 'click'].forEach(function (type) {
    document.addEventListener(type, function () { if (soundOn) ensureAudio(); }, { passive: true });
  });
  $('soundBtn').addEventListener('click', function () { setSound(!soundOn); playClick(2600); save(); });
  $('lockBtn').addEventListener('click', function () { setLocked(!locked); });
  document.addEventListener('touchmove', function (e) {
    if (locked && !(e.target.closest && e.target.closest('dialog[open]'))) e.preventDefault();
  }, { passive: false });

  ['volume', 'dilution', 'targetMantissa', 'targetExponent'].forEach(function (id) {
    $(id).addEventListener('input', update);
  });
  $('sciToggle').addEventListener('change', update);

  // Editable concentrations: tap to highlight, type to override, copy button.
  function setManual(key, value) {
    manual = manual.filter(function (m) { return m.key !== key; });
    if (value !== null) manual.push({ key: key, value: value });
    // Two values fix the third, so the oldest entry gives way.
    if (manual.length > 2) manual.shift();
  }
  CONC_KEYS.forEach(function (key) {
    var el = $(key + 'Conc');
    el.addEventListener('focus', function () {
      setTimeout(function () { if (document.activeElement === el) el.select(); }, 0);
    });
    el.addEventListener('input', function () {
      el.dataset.dirty = '1';
      var n = parseCells(el.value);
      el.classList.toggle('invalid', n !== n);
      if (n !== n) return;
      setManual(key, n);
      update();
    });
    el.addEventListener('blur', function () { delete el.dataset.dirty; update(); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter') el.blur(); });
  });
  $('clearManualBtn').addEventListener('click', function () { manual = []; update(); });

  function copyText(text, el) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(el); });
    }
    return Promise.resolve(legacyCopy(el));
  }
  function legacyCopy(el) {
    try { el.focus(); el.select(); return document.execCommand('copy'); } catch (e) { return false; }
  }
  Array.prototype.forEach.call(document.querySelectorAll('.copy-btn'), function (btn) {
    btn.addEventListener('click', function () {
      var el = $(btn.dataset.copy);
      if (!el.value) return;
      copyText(el.value, el).then(function (ok) {
        btn.textContent = ok ? '✓' : '✕';
        btn.classList.toggle('copied', ok);
        setTimeout(function () { btn.textContent = '⧉'; btn.classList.remove('copied'); }, 1200);
      });
    });
  });

  $('resetBtn').addEventListener('click', function () {
    var hasCounts = manual.length || squares.some(function (sq) { return sq.live.value !== '' || sq.dead.value !== ''; });
    if (hasCounts && !window.confirm('Reset all counts to zero?')) return;
    squares.forEach(function (sq) { sq.live.value = ''; sq.dead.value = ''; });
    manual = [];
    select(0);
    update();
  });

  $('themeBtn').addEventListener('click', function () {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  var dialog = $('instructions');
  $('instructionsBtn').addEventListener('click', function () {
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  });
  function closeDialog() {
    if (dialog.close) dialog.close(); else dialog.removeAttribute('open');
  }
  $('closeX').addEventListener('click', closeDialog);
  $('closeBtn').addEventListener('click', closeDialog);
  dialog.addEventListener('click', function (e) { if (e.target === dialog) closeDialog(); });
})();
