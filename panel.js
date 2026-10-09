/* Jhoel 1% — Panel del inversionista (IIFE, sin módulos)
   Mientras no exista un servidor de cuentas, el panel funciona en modo
   demostración con datos de ejemplo generados a partir de la fecha de hoy. */
(function () {
  'use strict';

  var CONFIG = {
    whatsapp: '51912536501',
    siteUrl: 'https://jhoel1.com',
    baseRate: 1.0,
    perReferral: 0.01,
    maxBonus: 1.0,
    promoRate: 2.0,
    promoMonths: 3,
    minWithdraw: 10
  };

  /* ---------- Utilidades ---------- */
  function safe(fn, name) { try { fn(); } catch (e) { if (window.console) console.warn('[panel] ' + name + ':', e); } }
  function $(id) { return document.getElementById(id); }
  var usd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(n) { return (n < 0 ? '-' : '') + 'US$' + usd.format(Math.abs(n)); }
  function fmtDate(d, withYear) {
    var o = { day: 'numeric', month: 'short' };
    if (withYear !== false) o.year = 'numeric';
    return d.toLocaleDateString('es-PE', o).replace(/\./g, '');
  }
  function addMonths(d, n) { var x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function dayDiff(a, b) { return Math.round((b - a) / 86400000); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function toast(text) {
    var t = el('div', 'toast', text);
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); }, 3200);
    setTimeout(function () { t.remove(); }, 3700);
  }
  var store = {
    get: function (k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };

  /* ---------- Datos de ejemplo ---------- */
  var today = new Date(); today.setHours(12, 0, 0, 0);
  var cycleStart = addMonths(addDays(today, -24), 0);
  var start = addMonths(cycleStart, -2);

  var DEMO = {
    user: {
      first: 'Ana', last: 'Torres Quispe', email: 'ana.torres@ejemplo.com',
      phone: '+51 9•• ••• 123', country: 'Perú', doc: 'DNI •••• 5678'
    },
    capital: 5000,
    start: start,
    refCode: 'JHOEL-ANA27',
    referrals: [
      ['Carlos M.', 61, 'ok'], ['Lucía R.', 58, 'ok'], ['Jorge P.', 55, 'ok'], ['María F.', 51, 'ok'],
      ['Diego S.', 47, 'ok'], ['Valeria C.', 40, 'ok'], ['Andrés L.', 36, 'ok'], ['Rosa Q.', 30, 'ok'],
      ['Miguel A.', 22, 'ok'], ['Camila V.', 15, 'ok'], ['Luis H.', 9, 'ok'], ['Sofía G.', 6, 'ok'],
      ['Renzo T.', 3, 'pending'], ['Paola D.', 1, 'pending']
    ],
    kyc: [
      ['Documento de identidad', 'DNI verificado', true],
      ['Selfie con documento', 'Verificada', true],
      ['Comprobante de domicilio', 'Recibo de luz, agua o banco con menos de 3 meses', false]
    ]
  };

  var validRefs = DEMO.referrals.filter(function (r) { return r[2] === 'ok'; }).length;
  var pendingRefs = DEMO.referrals.length - validRefs;
  var bonus = Math.min(validRefs * CONFIG.perReferral, CONFIG.maxBonus);
  var regularRate = CONFIG.baseRate + bonus;
  var promoEnd = addMonths(start, CONFIG.promoMonths);

  function rateForPeriod(i) { return i <= CONFIG.promoMonths ? Math.max(CONFIG.promoRate, regularRate) : regularRate; }

  // Periodos: 1 y 2 acreditados, 3 en curso.
  var periods = [];
  for (var i = 1; i <= 7; i++) {
    var from = addMonths(start, i - 1), to = addMonths(start, i);
    var rate = rateForPeriod(i);
    var full = DEMO.capital * rate / 100;
    var state = to <= today ? 'paid' : (from <= today ? 'now' : 'proj');
    var total = dayDiff(from, to), elapsed = Math.max(0, Math.min(total, dayDiff(from, today)));
    periods.push({ i: i, from: from, to: to, rate: rate, full: full, state: state, total: total, elapsed: elapsed, accrued: state === 'now' ? full * elapsed / total : 0 });
  }
  var current = periods.filter(function (p) { return p.state === 'now'; })[0];

  var REQ_KEY = 'j1_demo_requests';
  function requests() { return store.get(REQ_KEY, []); }

  function movements() {
    var list = [{ date: start, kind: 'deposit', title: 'Depósito inicial', detail: 'Transferencia bancaria', amount: DEMO.capital, status: ['Completado', 'ok'] }];
    periods.forEach(function (p) {
      if (p.state !== 'paid') return;
      list.push({ date: p.to, kind: 'profit', title: 'Rentabilidad mensual', detail: p.rate.toFixed(2) + '% sobre ' + money(DEMO.capital), amount: p.full, status: ['Acreditado', 'ok'] });
    });
    var firstPaid = periods[0];
    if (firstPaid.state === 'paid') {
      list.push({ date: addDays(firstPaid.to, 2), kind: 'withdraw', title: 'Retiro de ganancias', detail: 'Transferencia bancaria', amount: -firstPaid.full, status: ['Procesado', 'ok'] });
    }
    requests().forEach(function (r) {
      list.push({ date: new Date(r.date), kind: 'withdraw', title: r.type === 'total' ? 'Retiro total del capital' : 'Retiro de ganancias', detail: r.method, amount: -r.amount, status: ['En proceso', 'warn'] });
    });
    return list.sort(function (a, b) { return b.date - a.date; });
  }

  function available() {
    var profits = 0, out = 0;
    movements().forEach(function (m) {
      if (m.kind === 'profit') profits += m.amount;
      if (m.kind === 'withdraw') out += -m.amount;
    });
    return Math.max(0, Math.round((profits - out) * 100) / 100);
  }
  function isClosed() { return requests().some(function (r) { return r.type === 'total'; }); }

  /* ---------- Navegación ---------- */
  var VIEWS = ['resumen', 'movimientos', 'retiros', 'referidos', 'perfil'];
  function showView(name) {
    if (VIEWS.indexOf(name) < 0) name = 'resumen';
    VIEWS.forEach(function (v) { $('view-' + v).hidden = v !== name; });
    [].slice.call(document.querySelectorAll('[data-view]')).forEach(function (a) {
      if (a.closest('.side__nav') || a.closest('.tabbar')) a.classList.toggle('is-active', a.getAttribute('data-view') === name);
    });
    window.scrollTo(0, 0);
  }
  function initNav() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-view]');
      if (!a) return;
      e.preventDefault();
      var v = a.getAttribute('data-view');
      if (location.hash !== '#' + v) history.pushState(null, '', '#' + v);
      showView(v);
    });
    window.addEventListener('popstate', function () { showView(location.hash.slice(1)); });
    showView(location.hash.slice(1));
  }

  /* ---------- Resumen ---------- */
  function renderSummary() {
    var u = DEMO.user;
    $('userFirst').textContent = u.first;
    $('avatar').textContent = (u.first[0] + u.last[0]).toUpperCase();
    var d = today.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('today').textContent = d.charAt(0).toUpperCase() + d.slice(1);

    var avail = available();
    var accrued = current ? current.accrued : 0;
    var closed = isClosed();

    $('kBalance').textContent = money(DEMO.capital + avail + accrued);
    $('kCapital').textContent = money(DEMO.capital);
    $('kSince').textContent = fmtDate(start);
    $('kAvailable').textContent = money(avail);
    var nowRate = current ? current.rate : regularRate;
    $('kRate').textContent = nowRate.toFixed(2) + '%';
    $('kRateMeta').textContent = today < promoEnd
      ? 'Promoción activa · luego ' + regularRate.toFixed(2) + '%'
      : 'Base 1% + ' + bonus.toFixed(2) + '% por ' + validRefs + ' referidos';

    var promo = $('promoBanner');
    promo.hidden = !(today < promoEnd) || closed;
    $('promoEnd').textContent = fmtDate(promoEnd);
    $('promoNext').textContent = regularRate.toFixed(2) + '%';

    if (current) {
      $('cycleRange').textContent = fmtDate(current.from, false) + ' – ' + fmtDate(current.to);
      $('cycleDays').textContent = current.elapsed;
      $('cycleTotal').textContent = current.total;
      $('ring').style.setProperty('--p', Math.round(current.elapsed / current.total * 100));
      $('cycleAccrued').textContent = money(current.accrued);
      $('cycleNext').textContent = fmtDate(current.to);
      $('cycleEst').textContent = money(current.full);
    }

    $('lvlRefs').textContent = validRefs;
    $('lvlBar').style.width = Math.min(validRefs, 100) + '%';
    var left = Math.max(0, 100 - validRefs);
    $('lvlTip').textContent = left ? 'Te faltan ' + left + ' referidos para llegar a 2.00% mensual.' : 'Alcanzaste el bono máximo de +1%.';

    renderFeed($('feedRecent'), movements().slice(0, 4));
    renderChart();
  }

  function renderFeed(ul, items) {
    ul.innerHTML = '';
    if (!items.length) { ul.appendChild(el('li', 'empty', 'Aún no hay movimientos.')); return; }
    var icons = { deposit: '↓', profit: '%', withdraw: '↑' };
    items.forEach(function (m) {
      var li = el('li');
      li.appendChild(el('span', 'feed__ico feed__ico--' + m.kind, icons[m.kind]));
      var t = el('div', 'feed__txt');
      t.appendChild(el('strong', null, m.title));
      t.appendChild(el('span', null, fmtDate(m.date) + ' · ' + m.detail));
      li.appendChild(t);
      var a = el('div', 'feed__amt' + (m.amount > 0 ? ' pos' : ''), (m.amount > 0 ? '+' : '') + money(m.amount));
      var pill = el('small', null);
      pill.appendChild(el('span', 'pill pill--' + m.status[1], m.status[0]));
      a.appendChild(pill);
      li.appendChild(a);
      ul.appendChild(li);
    });
  }

  function renderChart() {
    var box = $('chart');
    var W = 640, H = 230, padL = 44, padB = 28, padT = 22, padR = 8;
    var max = Math.max.apply(null, periods.map(function (p) { return p.full; }));
    var top = Math.ceil(max / 25) * 25;
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');
    function n(tag, attrs, text) {
      var e = document.createElementNS(ns, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      if (text != null) e.textContent = text;
      return e;
    }
    var defs = n('defs', {});
    var g = n('linearGradient', { id: 'gPaid', x1: 0, y1: 0, x2: 0, y2: 1 });
    g.appendChild(n('stop', { offset: 0, 'stop-color': '#fff3c4' }));
    g.appendChild(n('stop', { offset: 1, 'stop-color': '#b8872b' }));
    defs.appendChild(g); svg.appendChild(defs);

    var plotH = H - padB - padT, plotW = W - padL - padR;
    var y = function (v) { return padT + plotH - v / top * plotH; };
    var grid = n('g', { 'class': 'grid' }), axis = n('g', { 'class': 'axis' });
    for (var t = 0; t <= 4; t++) {
      var v = top * t / 4, yy = y(v);
      grid.appendChild(n('line', { x1: padL, x2: W - padR, y1: yy, y2: yy }));
      axis.appendChild(n('text', { x: padL - 8, y: yy + 4, 'text-anchor': 'end' }, '$' + Math.round(v)));
    }
    svg.appendChild(grid);

    var slot = plotW / periods.length, bw = Math.min(46, slot * .56);
    periods.forEach(function (p, idx) {
      var x = padL + slot * idx + (slot - bw) / 2;
      var label = fmtDate(p.to, false).split(' ')[1];
      axis.appendChild(n('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle' }, label.charAt(0).toUpperCase() + label.slice(1)));
      if (p.state === 'now') {
        svg.appendChild(n('rect', { x: x, y: y(p.full), width: bw, height: plotH - (y(p.full) - padT), rx: 5, 'class': 'bar-proj' }));
        svg.appendChild(n('rect', { x: x, y: y(p.accrued), width: bw, height: plotH - (y(p.accrued) - padT), rx: 5, 'class': 'bar-now' }));
        svg.appendChild(n('text', { x: x + bw / 2, y: y(p.full) - 7, 'text-anchor': 'middle', 'class': 'val' }, '$' + Math.round(p.accrued)));
      } else {
        svg.appendChild(n('rect', { x: x, y: y(p.full), width: bw, height: plotH - (y(p.full) - padT), rx: 5, 'class': p.state === 'paid' ? 'bar-paid' : 'bar-proj' }));
        svg.appendChild(n('text', { x: x + bw / 2, y: y(p.full) - 7, 'text-anchor': 'middle', 'class': 'val' }, '$' + Math.round(p.full)));
      }
    });
    svg.appendChild(axis);
    box.innerHTML = '';
    box.appendChild(svg);
  }

  /* ---------- Movimientos ---------- */
  var movFilter = 'all';
  function renderMovements() {
    var body = $('movBody');
    body.innerHTML = '';
    var list = movements().filter(function (m) { return movFilter === 'all' || m.kind === movFilter; });
    if (!list.length) {
      var tr = el('tr'); var td = el('td', 'muted', 'No hay movimientos de este tipo.'); td.colSpan = 5; tr.appendChild(td); body.appendChild(tr); return;
    }
    list.forEach(function (m) {
      var tr = el('tr');
      tr.appendChild(el('td', 'muted', fmtDate(m.date)));
      tr.appendChild(el('td', null, m.title));
      tr.appendChild(el('td', 'muted', m.detail));
      tr.appendChild(el('td', 'num' + (m.amount > 0 ? ' pos' : ''), (m.amount > 0 ? '+' : '') + money(m.amount)));
      var st = el('td'); st.appendChild(el('span', 'pill pill--' + m.status[1], m.status[0])); tr.appendChild(st);
      body.appendChild(tr);
    });
  }
  function initFilters() {
    [].slice.call(document.querySelectorAll('.chip')).forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('.chip').forEach(function (x) { x.classList.toggle('is-on', x === c); });
        movFilter = c.getAttribute('data-filter');
        renderMovements();
      });
    });
  }

  /* ---------- Retiros ---------- */
  function renderWithdrawals() {
    var avail = available();
    var closed = isClosed();
    $('wAvail').textContent = money(avail);
    $('cCapital').textContent = money(closed ? 0 : DEMO.capital);
    $('cAvail').textContent = money(avail);
    $('cTotal').textContent = money((closed ? 0 : DEMO.capital) + avail);
    $('cConfirmTotal').textContent = $('cTotal').textContent;
    $('closeStart').disabled = closed;
    $('wForm').querySelector('button[type="submit"]').disabled = closed || avail < CONFIG.minWithdraw;
    if (closed) $('cMsg').textContent = 'Tu solicitud de retiro total está en proceso. Recibirás tu capital en hasta 7 días hábiles desde la aprobación.';

    var hist = movements().filter(function (m) { return m.kind === 'withdraw'; });
    renderFeed($('wHistory'), hist);
  }

  function initWithdraw() {
    var form = $('wForm'), amount = $('wAmount'), msg = $('wMsg');
    $('wMax').addEventListener('click', function () { amount.value = available().toFixed(2); amount.classList.remove('is-invalid'); });
    amount.addEventListener('input', function () { amount.classList.remove('is-invalid'); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      msg.classList.remove('is-error');
      var v = parseFloat(amount.value), avail = available();
      var account = $('wAccount').value.trim();
      if (!(v >= CONFIG.minWithdraw)) { msg.textContent = 'El monto mínimo de retiro es ' + money(CONFIG.minWithdraw) + '.'; msg.classList.add('is-error'); amount.classList.add('is-invalid'); amount.focus(); return; }
      if (v > avail + 0.001) { msg.textContent = 'El monto supera tus ganancias disponibles (' + money(avail) + ').'; msg.classList.add('is-error'); amount.classList.add('is-invalid'); amount.focus(); return; }
      if (account.length < 6) { msg.textContent = 'Escribe la cuenta, número o dirección donde recibirás el dinero.'; msg.classList.add('is-error'); $('wAccount').focus(); return; }

      var list = requests();
      list.push({ date: new Date().toISOString(), amount: Math.round(v * 100) / 100, method: $('wMethod').value, type: 'profit' });
      store.set(REQ_KEY, list);
      form.reset();
      msg.textContent = 'Solicitud registrada por ' + money(v) + '. Se procesará en un máximo de 48 horas.';
      refresh();
    });

    $('closeStart').addEventListener('click', function () { $('closeConfirm').hidden = false; $('closeYes').focus(); });
    $('closeNo').addEventListener('click', function () { $('closeConfirm').hidden = true; $('closeStart').focus(); });
    $('closeYes').addEventListener('click', function () {
      var list = requests();
      list.push({ date: new Date().toISOString(), amount: DEMO.capital + available(), method: 'Transferencia bancaria', type: 'total' });
      store.set(REQ_KEY, list);
      $('closeConfirm').hidden = true;
      refresh();
      toast('Solicitud de retiro total registrada.');
    });
  }

  /* ---------- Referidos ---------- */
  function renderReferrals() {
    var link = CONFIG.siteUrl + '/?ref=' + DEMO.refCode;
    $('refCode').textContent = DEMO.refCode;
    $('refLink').value = link;
    $('shareWa').href = 'https://wa.me/?text=' + encodeURIComponent('Te invito a invertir con Jhoel 1%. Regístrate con mi código ' + DEMO.refCode + ': ' + link);
    $('rValid').textContent = validRefs;
    $('rPending').textContent = pendingRefs;
    $('rBonus').textContent = '+' + bonus.toFixed(2) + '%';
    $('rRate').textContent = regularRate.toFixed(2) + '%';

    var body = $('refBody');
    body.innerHTML = '';
    DEMO.referrals.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('td', null, r[0]));
      tr.appendChild(el('td', 'muted', fmtDate(addDays(today, -r[1]))));
      var st = el('td');
      st.appendChild(el('span', 'pill ' + (r[2] === 'ok' ? 'pill--ok' : 'pill--warn'), r[2] === 'ok' ? 'Válido' : 'En verificación'));
      tr.appendChild(st);
      tr.appendChild(el('td', 'num' + (r[2] === 'ok' ? ' pos' : ' muted'), r[2] === 'ok' ? '+0.01%' : '—'));
      body.appendChild(tr);
    });
  }
  function initCopy() {
    $('copyBtn').addEventListener('click', function () {
      var input = $('refLink');
      var done = function () { toast('Enlace copiado.'); };
      var fallback = function () { input.focus(); input.select(); toast('Selecciona y copia el enlace.'); };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(input.value).then(done, fallback);
        else fallback();
      } catch (e) { fallback(); }
    });
  }

  /* ---------- Perfil ---------- */
  function renderProfile() {
    var u = DEMO.user;
    function fill(dl, rows) {
      dl.innerHTML = '';
      rows.forEach(function (r) {
        var d = el('div'); d.appendChild(el('dt', null, r[0])); d.appendChild(el('dd', null, r[1])); dl.appendChild(d);
      });
    }
    fill($('profileData'), [
      ['Nombre', u.first + ' ' + u.last], ['Correo', u.email], ['WhatsApp', u.phone],
      ['País', u.country], ['Documento', u.doc], ['Miembro desde', fmtDate(start)]
    ]);
    fill($('planData'), [
      ['Plan', 'Jhoel 1% · Estándar'], ['Capital invertido', money(DEMO.capital)],
      ['Fecha de inicio', fmtDate(start)],
      ['Tasa promocional', CONFIG.promoRate.toFixed(2) + '% hasta ' + fmtDate(promoEnd)],
      ['Tasa regular', regularRate.toFixed(2) + '% mensual'],
      ['Día de abono', 'Cada ' + start.getDate() + ' del mes']
    ]);
    var ol = $('kyc');
    ol.innerHTML = '';
    DEMO.kyc.forEach(function (k, i) {
      var li = el('li');
      li.appendChild(el('span', 'kyc__n ' + (k[2] ? 'kyc__n--ok' : 'kyc__n--todo'), k[2] ? '✓' : String(i + 1)));
      var t = el('div'); t.appendChild(el('strong', null, k[0])); t.appendChild(el('span', null, k[1])); li.appendChild(t);
      if (k[2]) li.appendChild(el('span', 'pill pill--ok', 'Verificado'));
      else { var b = el('button', 'btn btn--ghost btn--sm', 'Subir'); b.type = 'button'; b.setAttribute('data-soon', ''); li.appendChild(b); }
      ol.appendChild(li);
    });
  }

  function initSoon() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-soon]');
      if (!t) return;
      if (t.type === 'checkbox') e.preventDefault();
      toast('Esta opción se activará cuando la plataforma esté conectada.');
    });
  }

  function refresh() {
    safe(renderSummary, 'resumen');
    safe(renderMovements, 'movimientos');
    safe(renderWithdrawals, 'retiros');
  }

  function boot() {
    safe(initNav, 'nav');
    refresh();
    safe(renderReferrals, 'referidos');
    safe(renderProfile, 'perfil');
    safe(initFilters, 'filtros');
    safe(initWithdraw, 'retiro');
    safe(initCopy, 'copiar');
    safe(initSoon, 'pronto');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
