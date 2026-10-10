/* Jhoel 1% — Panel del inversionista (IIFE, sin módulos)
   Con Supabase configurado en config.js muestra los datos reales del usuario.
   Sin configurar, funciona en modo demostración con datos de ejemplo. */
(function () {
  'use strict';

  var J1 = window.J1 || { live: false, config: {} };
  var db = J1.db;
  var LIVE = !!db;

  var CONFIG = {
    whatsapp: (J1.config && J1.config.whatsapp) || '51912536501',
    siteUrl: (J1.config && J1.config.siteUrl) || 'https://jhoel1.com',
    baseRate: 1.0,
    perReferral: 0.01,
    maxBonus: 1.0,
    promoRate: 2.0,
    minWithdraw: 10
  };

  /* ---------- Utilidades ---------- */
  function safe(fn, name) { try { fn(); } catch (e) { if (window.console) console.warn('[panel] ' + name + ':', e); } }
  function $(id) { return document.getElementById(id); }
  var usd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(n) { n = Number(n) || 0; return (n < 0 ? '-' : '') + 'US$' + usd.format(Math.abs(n)); }
  function fmtDate(d, withYear) {
    var o = { day: 'numeric', month: 'short' };
    if (withYear !== false) o.year = 'numeric';
    return d.toLocaleDateString('es-PE', o).replace(/\./g, '');
  }
  function parseDate(s) { if (!s) return null; if (s instanceof Date) return s; var d = new Date(s.length === 10 ? s + 'T12:00:00' : s); return d; }
  function addMonths(d, n) { var x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function dayDiff(a, b) { return Math.round((b - a) / 86400000); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function toast(text) {
    var t = el('div', 'toast', text);
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); }, 3600);
    setTimeout(function () { t.remove(); }, 4100);
  }
  function errText(e) { return J1.errorText ? J1.errorText(e) : (e && e.message) || 'Ocurrió un error.'; }
  var store = {
    get: function (k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };
  function waLink(text) { return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text); }

  var today = new Date(); today.setHours(12, 0, 0, 0);
  var KYC_STEPS = [
    ['id', 'Documento de identidad', 'Foto clara de tu DNI, cédula o pasaporte'],
    ['selfie', 'Selfie con documento', 'Tu rostro junto a tu documento'],
    ['address', 'Comprobante de domicilio', 'Recibo de luz, agua o banco con menos de 3 meses']
  ];
  var REQ_STATUS = {
    pending: ['En proceso', 'warn'], approved: ['Aprobado', 'blue'],
    paid: ['Pagado', 'ok'], rejected: ['Rechazado', 'bad']
  };

  /* ======================================================================
     DATOS
     S = estado que dibujan todas las vistas
     ====================================================================== */
  var S = null;

  /* ---------- Modo demostración ---------- */
  var REQ_KEY = 'j1_demo_requests';
  function demoState() {
    var cycleStart = addDays(today, -24);
    var start = addMonths(cycleStart, -2);
    var refs = [
      ['Carlos M.', 61, true], ['Lucía R.', 58, true], ['Jorge P.', 55, true], ['María F.', 51, true],
      ['Diego S.', 47, true], ['Valeria C.', 40, true], ['Andrés L.', 36, true], ['Rosa Q.', 30, true],
      ['Miguel A.', 22, true], ['Camila V.', 15, true], ['Luis H.', 9, true], ['Sofía G.', 6, true],
      ['Renzo T.', 3, false], ['Paola D.', 1, false]
    ];
    var capital = 5000;
    var p1 = addMonths(start, 1), p2 = addMonths(start, 2);
    var ledger = [
      { date: start, kind: 'deposit', amount: capital, detail: 'Transferencia bancaria' },
      { date: p1, kind: 'profit', amount: 100, rate: 2, detail: 'Rentabilidad 2.00% sobre US$5,000.00', periodEnd: p1 },
      { date: addDays(p1, 2), kind: 'withdraw', amount: -100, detail: 'Retiro de ganancias · Transferencia bancaria' },
      { date: p2, kind: 'profit', amount: 100, rate: 2, detail: 'Rentabilidad 2.00% sobre US$5,000.00', periodEnd: p2 }
    ];
    var requests = [{ date: addDays(p1, 2), type: 'profit', amount: 100, profit: 100, method: 'Transferencia bancaria', status: 'paid' }];
    store.get(REQ_KEY, []).forEach(function (r) {
      requests.push({ date: new Date(r.date), type: r.type, amount: r.amount, profit: r.profit != null ? r.profit : r.amount, method: r.method, status: 'pending' });
    });
    var closing = requests.some(function (r) { return r.type === 'total' && r.status === 'pending'; });
    return {
      user: { first: 'Ana', last: 'Torres Quispe', email: 'ana.torres@ejemplo.com', phone: '+51 9•• ••• 123',
              country: 'Perú', doc: 'DNI •••• 5678', role: 'investor', kyc: 'in_review', refCode: 'JHOEL-ANA27', createdAt: start },
      inv: { capital: capital, start: start, promoUntil: addMonths(start, 3), status: closing ? 'closing' : 'active' },
      referrals: refs.map(function (r) { return { name: r[0], date: addDays(today, -r[1]), valid: r[2] }; }),
      kycDocs: { id: { status: 'approved' }, selfie: { status: 'approved' }, address: null },
      ledger: ledger,
      requests: requests,
      deposits: store.get(DEP_KEY, []).map(function (d) {
        return { date: new Date(d.date), amount: d.amount, method: d.method, reference: d.reference, status: 'pending' };
      })
    };
  }
  var DEP_KEY = 'j1_demo_deposits';

  /* ---------- Datos reales (Supabase) ---------- */
  function liveState() {
    return db.auth.getSession().then(function (r) {
      var session = r.data && r.data.session;
      if (!session) { location.replace('index.html#login'); throw new Error('sin sesión'); }
      var uid = session.user.id;
      return Promise.all([
        db.from('profiles').select('*').eq('id', uid).single(),
        db.from('investments').select('*').eq('user_id', uid).in('status', ['active', 'closing']).maybeSingle(),
        db.from('movements').select('*').eq('user_id', uid).order('created_at', { ascending: true }),
        db.from('withdrawal_requests').select('*').eq('user_id', uid).order('created_at', { ascending: true }),
        db.rpc('my_referrals'),
        db.from('kyc_docs').select('*').eq('user_id', uid).order('created_at', { ascending: true }),
        db.from('deposit_requests').select('*').eq('user_id', uid).order('created_at', { ascending: true })
      ]).then(function (res) {
        // Si aún no se creó la tabla de depósitos (02-depositos.sql), el panel sigue funcionando
        if (res[6].error) res[6] = { data: [], error: null };
        for (var i = 0; i < res.length; i++) if (res[i].error) throw res[i].error;
        var p = res[0].data, inv = res[1].data;
        var kycDocs = { id: null, selfie: null, address: null };
        res[5].data.forEach(function (d) { kycDocs[d.kind] = { status: d.status, note: d.note }; });
        return {
          uid: uid,
          user: { first: p.first_name || 'Inversionista', last: p.last_name || '', email: p.email, phone: p.phone || '—',
                  country: p.country || '—', doc: p.doc_number || '—', role: p.role, kyc: p.kyc_status,
                  refCode: p.ref_code, createdAt: parseDate(p.created_at) },
          inv: inv ? { capital: Number(inv.capital), start: parseDate(inv.start_date), promoUntil: parseDate(inv.promo_until), status: inv.status } : null,
          referrals: res[4].data.map(function (x) { return { name: x.name, date: parseDate(x.created_at), valid: x.is_valid }; }),
          kycDocs: kycDocs,
          ledger: res[2].data.map(function (m) {
            return { date: parseDate(m.created_at), kind: m.kind, amount: Number(m.amount), rate: m.rate != null ? Number(m.rate) : null,
                     detail: m.detail || '', periodEnd: parseDate(m.period_end) };
          }),
          requests: res[3].data.map(function (w) {
            return { date: parseDate(w.created_at), type: w.type, amount: Number(w.amount), profit: Number(w.profit_part),
                     method: w.method, status: w.status, note: w.admin_note };
          }),
          deposits: res[6].data.map(function (d) {
            return { date: parseDate(d.created_at), amount: Number(d.amount), method: d.method, reference: d.reference,
                     status: d.status, note: d.admin_note };
          })
        };
      });
    });
  }

  /* ---------- Cálculos comunes ---------- */
  function derive(s) {
    s.validRefs = s.referrals.filter(function (r) { return r.valid; }).length;
    s.pendingRefs = s.referrals.length - s.validRefs;
    s.bonus = Math.min(s.validRefs * CONFIG.perReferral, CONFIG.maxBonus);
    s.regularRate = CONFIG.baseRate + s.bonus;
    s.profitsTotal = s.ledger.filter(function (m) { return m.kind === 'profit'; }).reduce(function (a, m) { return a + m.amount; }, 0);
    var reserved = s.requests.filter(function (r) { return r.status !== 'rejected'; }).reduce(function (a, r) { return a + r.profit; }, 0);
    s.available = Math.max(0, Math.round((s.profitsTotal - reserved) * 100) / 100);
    s.closing = !!(s.inv && s.inv.status === 'closing');

    // Periodos mensuales desde el inicio de la inversión
    s.periods = []; s.current = null;
    if (s.inv) {
      var paid = s.ledger.filter(function (m) { return m.kind === 'profit'; });
      var promoUntil = s.inv.promoUntil;
      for (var i = 1; i <= Math.max(7, paid.length + 4); i++) {
        var from = addMonths(s.inv.start, i - 1), to = addMonths(s.inv.start, i);
        var target = promoUntil && to <= promoUntil ? Math.max(CONFIG.promoRate, s.regularRate) : s.regularRate;
        var p = { i: i, from: from, to: to, total: dayDiff(from, to) };
        if (i <= paid.length) {
          p.state = 'paid'; p.full = paid[i - 1].amount; p.rate = paid[i - 1].rate || target;
        } else if (!s.current && from <= today) {
          p.state = 'now'; p.rate = target; p.full = s.inv.capital * target / 100;
          p.elapsed = Math.max(0, Math.min(p.total, dayDiff(from, today)));
          p.accrued = p.full * p.elapsed / p.total;
          s.current = p;
        } else {
          p.state = 'proj'; p.rate = target; p.full = s.inv.capital * target / 100;
        }
        s.periods.push(p);
      }
      // Mostrar como máximo los últimos 3 pagados y lo que viene
      var firstShown = Math.max(0, paid.length - 3);
      s.periods = s.periods.slice(firstShown, firstShown + 7);
    }

    // Movimientos para mostrar: libro + solicitudes de retiro aún no pagadas
    var titles = { deposit: 'Depósito', profit: 'Rentabilidad mensual', withdraw: 'Retiro de ganancias', capital_return: 'Devolución de capital' };
    var labels = { deposit: ['Completado', 'ok'], profit: ['Acreditado', 'ok'], withdraw: ['Pagado', 'ok'], capital_return: ['Pagado', 'ok'] };
    s.movements = s.ledger.map(function (m) {
      return { date: m.date, kind: m.kind, title: titles[m.kind] || m.kind, detail: m.detail, amount: m.amount, status: labels[m.kind] || ['—', 'blue'] };
    });
    s.requests.forEach(function (r) {
      if (r.status === 'paid') return;
      s.movements.push({
        date: r.date, kind: 'withdraw', title: r.type === 'total' ? 'Retiro total del capital' : 'Retiro de ganancias',
        detail: r.method, amount: -r.amount, status: REQ_STATUS[r.status] || ['—', 'blue'], muted: r.status === 'rejected'
      });
    });
    var METHOD = { binance: 'Binance', bank: 'Transferencia bancaria', yape: 'Yape / Plin' };
    (s.deposits || []).forEach(function (d) {
      if (d.status === 'confirmed') return;
      s.movements.push({
        date: d.date, kind: 'deposit', title: d.status === 'rejected' ? 'Depósito rechazado' : 'Depósito por confirmar',
        detail: (METHOD[d.method] || d.method) + ' · ' + d.reference + (d.note ? ' · ' + d.note : ''), amount: d.amount,
        status: d.status === 'rejected' ? ['Rechazado', 'bad'] : ['Por confirmar', 'warn'], muted: d.status === 'rejected'
      });
    });
    s.pendingDeposits = (s.deposits || []).filter(function (d) { return d.status === 'pending'; });
    s.movements.sort(function (a, b) { return b.date - a.date; });
    s.history = s.requests.slice().sort(function (a, b) { return b.date - a.date; }).map(function (r) {
      return { date: r.date, kind: 'withdraw', title: r.type === 'total' ? 'Retiro total del capital' : 'Retiro de ganancias',
               detail: r.method + (r.note ? ' · ' + r.note : ''), amount: -r.amount, status: REQ_STATUS[r.status] || ['—', 'blue'] };
    });
    return s;
  }

  function load() {
    var p = LIVE ? liveState() : Promise.resolve(demoState());
    return p.then(function (s) { S = derive(s); render(); });
  }

  /* ======================================================================
     VISTAS
     ====================================================================== */
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

  function render() {
    safe(renderHeader, 'cabecera');
    safe(renderSummary, 'resumen');
    safe(renderMovements, 'movimientos');
    safe(renderWithdrawals, 'retiros');
    safe(renderReferrals, 'referidos');
    safe(renderProfile, 'perfil');
  }

  function renderHeader() {
    var u = S.user;
    $('demoBar').hidden = LIVE;
    $('userFirst').textContent = u.first.split(' ')[0];
    $('avatar').textContent = ((u.first[0] || '') + (u.last[0] || '')).toUpperCase() || 'J1';
    var d = today.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('today').textContent = d.charAt(0).toUpperCase() + d.slice(1);
    $('adminLink').hidden = u.role !== 'admin';
  }

  function renderSummary() {
    var hasInv = !!S.inv;
    $('welcome').hidden = hasInv;
    $('perfGrid').hidden = !hasInv;
    $('stepKyc').classList.toggle('is-done', S.user.kyc === 'verified');

    var capital = hasInv ? S.inv.capital : 0;
    var accrued = S.current ? S.current.accrued : 0;
    $('kBalance').textContent = money(capital + S.available + accrued);
    $('kCapital').textContent = money(capital);
    $('kSince').textContent = hasInv ? fmtDate(S.inv.start) : '—';
    $('kAvailable').textContent = money(S.available);
    var promoActive = hasInv && S.inv.promoUntil && today < S.inv.promoUntil;
    var nowRate = S.current ? S.current.rate : S.regularRate;
    $('kRate').textContent = nowRate.toFixed(2) + '%';
    $('kRateMeta').textContent = promoActive
      ? 'Promoción activa · luego ' + S.regularRate.toFixed(2) + '%'
      : 'Base 1% + ' + S.bonus.toFixed(2) + '% por ' + S.validRefs + ' referidos';

    $('promoBanner').hidden = !promoActive || S.closing;
    if (promoActive) {
      $('promoEnd').textContent = fmtDate(S.inv.promoUntil);
      $('promoNext').textContent = S.regularRate.toFixed(2) + '%';
    }

    var c = S.current;
    if (c) {
      $('cycleRange').textContent = fmtDate(c.from, false) + ' – ' + fmtDate(c.to);
      $('cycleDays').textContent = c.elapsed;
      $('cycleTotal').textContent = c.total;
      $('ring').style.setProperty('--p', Math.round(c.elapsed / c.total * 100));
      $('cycleAccrued').textContent = money(c.accrued);
      $('cycleNext').textContent = c.to <= today ? 'Pendiente de acreditar' : fmtDate(c.to);
      $('cycleEst').textContent = money(c.full);
    }

    $('lvlRefs').textContent = S.validRefs;
    $('lvlBar').style.width = Math.min(S.validRefs, 100) + '%';
    var left = Math.max(0, 100 - S.validRefs);
    $('lvlTip').textContent = left ? 'Te faltan ' + left + ' referidos para llegar a 2.00% mensual.' : 'Alcanzaste el bono máximo de +1%.';

    renderFeed($('feedRecent'), S.movements.slice(0, 4));
    if (hasInv) renderChart();
  }

  function renderFeed(ul, items) {
    ul.innerHTML = '';
    if (!items.length) { ul.appendChild(el('li', 'empty', 'Aún no hay movimientos.')); return; }
    var icons = { deposit: '↓', profit: '%', withdraw: '↑', capital_return: '↑' };
    items.forEach(function (m) {
      var li = el('li');
      if (m.muted) li.style.opacity = '.6';
      var kindCls = m.kind === 'capital_return' ? 'withdraw' : m.kind;
      li.appendChild(el('span', 'feed__ico feed__ico--' + kindCls, icons[m.kind] || '•'));
      var t = el('div', 'feed__txt');
      t.appendChild(el('strong', null, m.title));
      t.appendChild(el('span', null, fmtDate(m.date) + (m.detail ? ' · ' + m.detail : '')));
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
    var periods = S.periods;
    if (!periods.length) { box.innerHTML = ''; return; }
    var W = 640, H = 230, padL = 44, padB = 28, padT = 22, padR = 8;
    var max = Math.max.apply(null, periods.map(function (p) { return p.full; }).concat([1]));
    var step = max > 400 ? 100 : max > 100 ? 50 : max > 40 ? 25 : 10;
    var top = Math.ceil(max / step) * step;
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
    var hgt = function (v) { return Math.max(0, plotH - (y(v) - padT)); };
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
      var label = fmtDate(p.to, false).split(' ')[1] || '';
      axis.appendChild(n('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle' }, label.charAt(0).toUpperCase() + label.slice(1)));
      if (p.state === 'now') {
        svg.appendChild(n('rect', { x: x, y: y(p.full), width: bw, height: hgt(p.full), rx: 5, 'class': 'bar-proj' }));
        svg.appendChild(n('rect', { x: x, y: y(p.accrued), width: bw, height: hgt(p.accrued), rx: 5, 'class': 'bar-now' }));
        svg.appendChild(n('text', { x: x + bw / 2, y: y(p.full) - 7, 'text-anchor': 'middle', 'class': 'val' }, '$' + Math.round(p.accrued)));
      } else {
        svg.appendChild(n('rect', { x: x, y: y(p.full), width: bw, height: hgt(p.full), rx: 5, 'class': p.state === 'paid' ? 'bar-paid' : 'bar-proj' }));
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
    var list = S.movements.filter(function (m) {
      if (movFilter === 'all') return true;
      if (movFilter === 'withdraw') return m.kind === 'withdraw' || m.kind === 'capital_return';
      return m.kind === movFilter;
    });
    if (!list.length) {
      var tr = el('tr'); var td = el('td', 'muted', 'No hay movimientos de este tipo.'); td.colSpan = 5; tr.appendChild(td); body.appendChild(tr); return;
    }
    list.forEach(function (m) {
      var tr = el('tr');
      if (m.muted) tr.style.opacity = '.6';
      tr.appendChild(el('td', 'muted', fmtDate(m.date)));
      tr.appendChild(el('td', null, m.title));
      tr.appendChild(el('td', 'muted', m.detail || '—'));
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
    var capital = S.inv ? S.inv.capital : 0;
    $('wAvail').textContent = money(S.available);
    $('cCapital').textContent = money(S.closing ? 0 : capital);
    $('cAvail').textContent = money(S.available);
    $('cTotal').textContent = money((S.closing ? 0 : capital) + S.available);
    $('cConfirmTotal').textContent = $('cTotal').textContent;
    $('closeStart').disabled = S.closing || !S.inv;
    $('wForm').querySelector('button[type="submit"]').disabled = S.closing || S.available < CONFIG.minWithdraw;
    var cMsg = $('cMsg');
    cMsg.classList.remove('is-error');
    cMsg.textContent = S.closing ? 'Tu solicitud de retiro total está en proceso. Recibirás tu capital en hasta 7 días hábiles desde la aprobación.' : '';
    if (LIVE && S.user.kyc !== 'verified' && S.inv) {
      $('wMsg').classList.remove('is-error');
      $('wMsg').textContent = 'Para retirar necesitas completar tu verificación de identidad en Mi perfil.';
    }
    renderFeed($('wHistory'), S.history);
  }

  function setMsg(m, text, bad) { m.textContent = text; m.classList.toggle('is-error', !!bad); }

  function requestWithdrawal(type, amount, method, account) {
    if (!LIVE) {
      var list = store.get(REQ_KEY, []);
      var profit = type === 'total' ? S.available : amount;
      list.push({ date: new Date().toISOString(), amount: type === 'total' ? S.inv.capital + S.available : amount, profit: profit, method: method, type: type });
      store.set(REQ_KEY, list);
      return Promise.resolve();
    }
    return db.rpc('request_withdrawal', { p_type: type, p_amount: amount, p_method: method, p_account: account })
      .then(function (r) { if (r.error) throw r.error; });
  }

  function initWithdraw() {
    var form = $('wForm'), amount = $('wAmount'), msg = $('wMsg');
    $('wMax').addEventListener('click', function () { amount.value = S.available.toFixed(2); amount.classList.remove('is-invalid'); });
    amount.addEventListener('input', function () { amount.classList.remove('is-invalid'); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = Math.round(parseFloat(amount.value) * 100) / 100;
      var account = $('wAccount').value.trim();
      if (!(v >= CONFIG.minWithdraw)) { setMsg(msg, 'El monto mínimo de retiro es ' + money(CONFIG.minWithdraw) + '.', true); amount.classList.add('is-invalid'); amount.focus(); return; }
      if (v > S.available + 0.001) { setMsg(msg, 'El monto supera tus ganancias disponibles (' + money(S.available) + ').', true); amount.classList.add('is-invalid'); amount.focus(); return; }
      if (account.length < 6) { setMsg(msg, 'Escribe la cuenta, número o dirección donde recibirás el dinero.', true); $('wAccount').focus(); return; }
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      requestWithdrawal('profit', v, $('wMethod').value, account).then(function () {
        form.reset();
        return load().then(function () { setMsg(msg, 'Solicitud registrada por ' + money(v) + '. Se procesará en un máximo de 48 horas.'); });
      }).catch(function (err) { btn.disabled = false; setMsg(msg, errText(err), true); });
    });

    $('closeStart').addEventListener('click', function () {
      if ($('wAccount').value.trim().length < 6) {
        setMsg($('cMsg'), 'Primero escribe en "Retirar ganancias" el método y la cuenta donde recibirás tu capital.', true);
        $('wAccount').focus();
        return;
      }
      setMsg($('cMsg'), '');
      $('closeConfirm').hidden = false; $('closeYes').focus();
    });
    $('closeNo').addEventListener('click', function () { $('closeConfirm').hidden = true; $('closeStart').focus(); });
    $('closeYes').addEventListener('click', function () {
      $('closeYes').disabled = true;
      requestWithdrawal('total', 0, $('wMethod').value, $('wAccount').value.trim()).then(function () {
        $('closeConfirm').hidden = true;
        return load().then(function () { toast('Solicitud de retiro total registrada.'); });
      }).catch(function (err) { setMsg($('cMsg'), errText(err), true); })
        .then(function () { $('closeYes').disabled = false; });
    });
  }

  /* ---------- Referidos ---------- */
  function renderReferrals() {
    var base = LIVE ? location.origin + location.pathname.replace(/[^/]*$/, '') : CONFIG.siteUrl + '/';
    var link = base + '?ref=' + S.user.refCode;
    $('refCode').textContent = S.user.refCode;
    $('refLink').value = link;
    $('shareWa').href = 'https://wa.me/?text=' + encodeURIComponent('Te invito a invertir con Jhoel 1%. Regístrate con mi código ' + S.user.refCode + ': ' + link);
    $('rValid').textContent = S.validRefs;
    $('rPending').textContent = S.pendingRefs;
    $('rBonus').textContent = '+' + S.bonus.toFixed(2) + '%';
    $('rRate').textContent = S.regularRate.toFixed(2) + '%';

    var body = $('refBody');
    body.innerHTML = '';
    if (!S.referrals.length) {
      var tr0 = el('tr'); var td0 = el('td', 'muted', 'Aún no tienes referidos. Comparte tu enlace para empezar.'); td0.colSpan = 4; tr0.appendChild(td0); body.appendChild(tr0); return;
    }
    S.referrals.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('td', null, r.name));
      tr.appendChild(el('td', 'muted', fmtDate(r.date)));
      var st = el('td');
      st.appendChild(el('span', 'pill ' + (r.valid ? 'pill--ok' : 'pill--warn'), r.valid ? 'Válido' : 'En verificación'));
      tr.appendChild(st);
      tr.appendChild(el('td', 'num' + (r.valid ? ' pos' : ' muted'), r.valid ? '+0.01%' : '—'));
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
  var KYC_LABEL = { verified: 'Verificado', in_review: 'En revisión', pending: 'Pendiente', rejected: 'Rechazado' };
  function renderProfile() {
    var u = S.user;
    function fill(dl, rows) {
      dl.innerHTML = '';
      rows.forEach(function (r) {
        var d = el('div'); d.appendChild(el('dt', null, r[0])); d.appendChild(el('dd', null, r[1])); dl.appendChild(d);
      });
    }
    fill($('profileData'), [
      ['Nombre', (u.first + ' ' + u.last).trim()], ['Correo', u.email], ['WhatsApp', u.phone],
      ['País', u.country], ['Documento', u.doc], ['Verificación', KYC_LABEL[u.kyc] || u.kyc],
      ['Miembro desde', u.createdAt ? fmtDate(u.createdAt) : '—']
    ]);
    if (S.inv) {
      var rows = [
        ['Plan', 'Jhoel 1% · Estándar'], ['Capital invertido', money(S.inv.capital)],
        ['Fecha de inicio', fmtDate(S.inv.start)]
      ];
      if (S.inv.promoUntil) rows.push(['Tasa promocional', CONFIG.promoRate.toFixed(2) + '% hasta ' + fmtDate(S.inv.promoUntil)]);
      rows.push(['Tasa regular objetivo', S.regularRate.toFixed(2) + '% mensual']);
      rows.push(['Día de abono', 'Cada ' + S.inv.start.getDate() + ' del mes']);
      rows.push(['Estado', S.closing ? 'En cierre' : 'Activa']);
      fill($('planData'), rows);
    } else {
      fill($('planData'), [['Estado', 'Sin inversión activa'], ['Inversión mínima', 'US$100']]);
    }

    var ol = $('kyc');
    ol.innerHTML = '';
    var verified = u.kyc === 'verified';
    KYC_STEPS.forEach(function (k, i) {
      var doc = S.kycDocs[k[0]];
      var st = verified ? 'approved' : doc ? doc.status : 'none';
      var li = el('li');
      li.appendChild(el('span', 'kyc__n ' + (st === 'approved' ? 'kyc__n--ok' : 'kyc__n--todo'), st === 'approved' ? '✓' : String(i + 1)));
      var t = el('div'); t.appendChild(el('strong', null, k[1]));
      t.appendChild(el('span', null, st === 'rejected' && doc.note ? 'Rechazado: ' + doc.note : k[2]));
      li.appendChild(t);
      if (st === 'approved') li.appendChild(el('span', 'pill pill--ok', 'Verificado'));
      else if (st === 'pending') li.appendChild(el('span', 'pill pill--warn', 'En revisión'));
      else {
        var side = el('div', 'kyc__side');
        if (st === 'rejected') side.appendChild(el('span', 'pill pill--bad', 'Rechazado'));
        var b = el('button', 'btn btn--ghost btn--sm', st === 'rejected' ? 'Subir de nuevo' : 'Subir');
        b.type = 'button'; b.setAttribute('data-kyc', k[0]);
        side.appendChild(b);
        li.appendChild(side);
      }
      ol.appendChild(li);
    });
  }

  function initKyc() {
    var input = $('kycFile'), kind = null;
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-kyc]');
      if (!b) return;
      if (!LIVE) { toast('En la demostración no se suben archivos. Con la plataforma conectada podrás subir fotos o PDF.'); return; }
      kind = b.getAttribute('data-kyc');
      input.value = '';
      input.click();
    });
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file || !kind) return;
      if (file.size > 8 * 1024 * 1024) { toast('El archivo pesa más de 8 MB. Usa una foto más liviana.'); return; }
      var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      var path = S.uid + '/' + kind + '-' + Date.now() + '.' + ext;
      toast('Subiendo documento…');
      db.storage.from('kyc').upload(path, file, { upsert: false, contentType: file.type }).then(function (r) {
        if (r.error) throw r.error;
        return db.rpc('submit_kyc_doc', { p_kind: kind, p_path: path });
      }).then(function (r) {
        if (r && r.error) throw r.error;
        return load();
      }).then(function () { toast('Documento enviado. Lo revisaremos pronto.'); })
        .catch(function (err) { toast(errText(err)); });
    });
  }

  /* ---------- Agregar capital ---------- */
  var BINANCE_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true"><g><rect x="13.3" y="13.3" width="5.4" height="5.4" transform="rotate(45 16 16)"/><rect x="13.3" y="4.8" width="5.4" height="5.4" transform="rotate(45 16 7.5)"/><rect x="13.3" y="21.8" width="5.4" height="5.4" transform="rotate(45 16 24.5)"/><rect x="4.8" y="13.3" width="5.4" height="5.4" transform="rotate(45 7.5 16)"/><rect x="21.8" y="13.3" width="5.4" height="5.4" transform="rotate(45 24.5 16)"/></g></svg>';
  var METHOD_NAME = { binance: 'Binance', bank: 'transferencia bancaria', yape: 'Yape / Plin' };

  function initDeposit() {
    var modal = $('dep');
    if (!modal) return;
    var PAY = (J1.config && J1.config.payments) || {};
    var st = { amount: 0, method: null, step: 1 };
    var lastFocus = null;

    function limits() {
      var cap = S && S.inv ? S.inv.capital : 0;
      var pending = S && S.pendingDeposits ? S.pendingDeposits.reduce(function (a, d) { return a + d.amount; }, 0) : 0;
      return { min: cap > 0 ? 50 : 100, max: Math.max(0, 100000 - cap - pending), cap: cap };
    }
    function rate() {
      if (!S) return 1;
      return S.current ? S.current.rate : S.regularRate;
    }
    function go(n) {
      st.step = n;
      [].slice.call(modal.querySelectorAll('[data-step]')).forEach(function (s) { s.hidden = Number(s.getAttribute('data-step')) !== n; });
      [].slice.call(modal.querySelectorAll('[data-step-dot]')).forEach(function (d) {
        var k = Number(d.getAttribute('data-step-dot'));
        d.classList.toggle('is-on', k === n || (n === 4 && k === 3));
        d.classList.toggle('is-done', k < n);
      });
      modal.querySelector('.dep__steps').hidden = n === 4;
      var first = modal.querySelector('[data-step="' + n + '"] input, [data-step="' + n + '"] button');
      if (first) setTimeout(function () { first.focus(); }, 50);
    }
    function open() {
      if (!S) return;
      if (S.closing) {
        toast('Tienes un retiro total en proceso. Cuando termine podrás volver a invertir.');
        return;
      }
      lastFocus = document.activeElement;
      st = { amount: 0, method: null, step: 1 };
      $('depAmount').value = '';
      $('depRef').value = ''; $('depFile').value = '';
      ['depMsg1', 'depMsg2', 'depMsg3'].forEach(function (id) { setMsg($(id), ''); });
      [].slice.call(modal.querySelectorAll('[data-amt]')).forEach(function (b) { b.classList.remove('is-on'); });
      [].slice.call(modal.querySelectorAll('[data-method]')).forEach(function (b) { b.setAttribute('aria-checked', 'false'); });
      var L = limits();
      $('depLimits').textContent = 'Mínimo ' + money(L.min).replace('.00', '') + ' · Disponible para invertir hasta ' + money(L.max).replace('.00', '');
      $('depAmount').min = L.min; $('depAmount').max = L.max;
      $('depTitle').textContent = L.cap > 0 ? 'Haz crecer tu inversión' : 'Empieza tu inversión';
      $('depRate').textContent = rate().toFixed(2) + '%';
      updateSummary();
      modal.hidden = false;
      document.body.classList.add('dep-open');
      go(1);
    }
    function close() {
      modal.hidden = true;
      document.body.classList.remove('dep-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function updateSummary() {
      var v = parseFloat($('depAmount').value) || 0;
      var L = limits();
      $('depNow').textContent = money(L.cap);
      $('depAfter').textContent = money(L.cap + v);
      $('depMonthly').textContent = money((L.cap + v) * rate() / 100);
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-deposit]')) { e.preventDefault(); open(); return; }
      if (!modal.hidden && e.target.closest('[data-dep-close]')) { close(); return; }
      var back = e.target.closest('[data-dep-back]');
      if (back && !modal.hidden) go(Number(back.getAttribute('data-dep-back')));
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });

    $('depAmount').addEventListener('input', function () {
      [].slice.call(modal.querySelectorAll('[data-amt]')).forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-amt') === $('depAmount').value); });
      setMsg($('depMsg1'), '');
      updateSummary();
    });
    [].slice.call(modal.querySelectorAll('[data-amt]')).forEach(function (b) {
      b.addEventListener('click', function () {
        $('depAmount').value = b.getAttribute('data-amt');
        $('depAmount').dispatchEvent(new Event('input'));
      });
    });

    $('depNext1').addEventListener('click', function () {
      var v = Math.round((parseFloat($('depAmount').value) || 0) * 100) / 100;
      var L = limits();
      if (v < L.min) { setMsg($('depMsg1'), 'El monto mínimo es ' + money(L.min) + '.', true); $('depAmount').focus(); return; }
      if (v > L.max) { setMsg($('depMsg1'), 'Puedes agregar como máximo ' + money(L.max) + ' (tope de US$100,000 por inversionista).', true); $('depAmount').focus(); return; }
      st.amount = v;
      $('depAmountLabel').textContent = money(v);
      go(2);
    });

    [].slice.call(modal.querySelectorAll('[data-method]')).forEach(function (b) {
      b.addEventListener('click', function () {
        st.method = b.getAttribute('data-method');
        modal.querySelectorAll('[data-method]').forEach(function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
        setMsg($('depMsg2'), '');
      });
    });

    function copyRow(label, value) {
      var row = el('div', 'copyrow');
      var t = el('div'); t.appendChild(el('span', null, label)); t.appendChild(el('code', null, value)); row.appendChild(t);
      var b = el('button', null, 'Copiar'); b.type = 'button';
      b.addEventListener('click', function () {
        try {
          navigator.clipboard.writeText(value).then(function () { b.textContent = 'Copiado ✓'; setTimeout(function () { b.textContent = 'Copiar'; }, 1600); },
            function () { toast('Selecciona y copia el dato.'); });
        } catch (err) { toast('Selecciona y copia el dato.'); }
      });
      row.appendChild(b);
      return row;
    }
    function list(items) { var ol = el('ol'); items.forEach(function (t) { ol.appendChild(el('li', null, t)); }); return ol; }
    function note(text, warn) { return el('p', 'dep__note' + (warn ? ' dep__note--warn' : ''), text); }
    function askData(box) {
      box.appendChild(note('Todavía no publicamos los datos de este medio de pago. Pídelos por WhatsApp y te respondemos al momento.', true));
      var a = el('a', 'btn btn--ghost btn--sm', 'Pedir datos por WhatsApp');
      a.href = waLink('Hola, quiero agregar ' + money(st.amount) + ' a mi inversión en Jhoel 1% por ' + METHOD_NAME[st.method] + '. ¿Me envías los datos de pago?');
      a.target = '_blank'; a.rel = 'noopener';
      box.appendChild(a);
    }

    function renderInfo() {
      var box = $('depInfo'); box.innerHTML = '';
      var amt = st.amount;
      if (st.method === 'binance') {
        var b = PAY.binance || {};
        $('depTotal').textContent = usd.format(amt) + ' USDT';
        if (!b.payId && !b.usdtTrc20 && !b.usdtBep20) { askData(box); return; }
        if (b.payId) {
          box.appendChild(el('h4', null, 'Binance Pay · sin comisión'));
          box.appendChild(copyRow('Binance Pay ID' + (b.payName ? ' · ' + b.payName : ''), b.payId));
          box.appendChild(list(['Abre Binance y entra a Pay → Enviar.', 'Pega el Pay ID y envía exactamente ' + usd.format(amt) + ' USDT.', 'Copia el número de orden y escríbelo abajo.']));
        }
        if (b.usdtTrc20) {
          box.appendChild(el('h4', null, 'Depósito USDT · red TRC20'));
          box.appendChild(copyRow('Dirección USDT (TRC20)', b.usdtTrc20));
        }
        if (b.usdtBep20) {
          box.appendChild(el('h4', null, 'Depósito USDT · red BEP20 (BSC)'));
          box.appendChild(copyRow('Dirección USDT (BEP20)', b.usdtBep20));
        }
        if (b.usdtTrc20 || b.usdtBep20) box.appendChild(note('Envía solo USDT y por la red indicada. Un envío por otra red puede perderse.', true));
        var open = el('a', 'btn btn--binance');
        open.innerHTML = BINANCE_SVG + '<span>Abrir Binance</span>';
        open.href = 'https://www.binance.com/'; open.target = '_blank'; open.rel = 'noopener';
        box.appendChild(open);
      } else if (st.method === 'bank') {
        var k = PAY.bank || {};
        $('depTotal').textContent = money(amt);
        if (!k.accountUsd && !k.accountPen) { askData(box); return; }
        if (k.bankName) box.appendChild(copyRow('Banco', k.bankName));
        if (k.holder) box.appendChild(copyRow('Titular', k.holder));
        if (k.accountUsd) box.appendChild(copyRow('Cuenta en dólares', k.accountUsd));
        if (k.cciUsd) box.appendChild(copyRow('CCI en dólares', k.cciUsd));
        if (k.accountPen) box.appendChild(copyRow('Cuenta en soles', k.accountPen));
        if (k.cciPen) box.appendChild(copyRow('CCI en soles', k.cciPen));
        box.appendChild(note('La cuenta de origen debe estar a tu nombre. Las comisiones del banco corren por tu cuenta.'));
      } else {
        var y = PAY.yape || {};
        $('depTotal').textContent = money(amt);
        if (!y.number) { askData(box); return; }
        box.appendChild(copyRow('Número Yape / Plin' + (y.holder ? ' · ' + y.holder : ''), y.number));
        if (y.exchangeNote) box.appendChild(note(y.exchangeNote));
      }
    }

    $('depNext2').addEventListener('click', function () {
      if (!st.method) { setMsg($('depMsg2'), 'Elige un medio de pago.', true); return; }
      renderInfo();
      go(3);
    });

    $('depForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var ref = $('depRef').value.trim();
      var file = $('depFile').files && $('depFile').files[0];
      var msg = $('depMsg3');
      if (ref.length < 4) { setMsg(msg, 'Escribe el número de orden, operación o ID de la transacción.', true); $('depRef').focus(); return; }
      if (file && file.size > 8 * 1024 * 1024) { setMsg(msg, 'El comprobante pesa más de 8 MB.', true); return; }
      var btn = $('depSend'); btn.disabled = true; btn.textContent = 'Enviando…';

      var done = function () {
        var name = METHOD_NAME[st.method];
        $('depDoneText').textContent = 'Verificaremos tu depósito de ' + money(st.amount) + ' por ' + name +
          ' y te avisaremos cuando quede registrado en tu inversión.';
        go(4);
        return load();
      };
      var p;
      if (!LIVE) {
        var list2 = store.get(DEP_KEY, []);
        list2.push({ date: new Date().toISOString(), amount: st.amount, method: st.method, reference: ref });
        store.set(DEP_KEY, list2);
        p = Promise.resolve();
      } else {
        var path = null;
        var up = Promise.resolve();
        if (file) {
          var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
          path = S.uid + '/deposito-' + Date.now() + '.' + ext;
          up = db.storage.from('receipts').upload(path, file, { contentType: file.type }).then(function (r) { if (r.error) throw r.error; });
        }
        p = up.then(function () {
          return db.rpc('request_deposit', { p_amount: st.amount, p_method: st.method, p_reference: ref, p_receipt_path: path });
        }).then(function (r) { if (r.error) throw r.error; });
      }
      p.then(done).catch(function (err) { setMsg(msg, errText(err), true); })
        .then(function () { btn.disabled = false; btn.textContent = 'Ya realicé el pago'; });
    });
  }

  function initSoon() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-soon]');
      if (!t) return;
      if (t.type === 'checkbox') e.preventDefault();
      toast('Esta opción estará disponible próximamente.');
    });
  }

  function initDemoReset() {
    var b = $('demoReset');
    if (!b) return;
    b.hidden = LIVE;
    b.addEventListener('click', function () {
      store.set(REQ_KEY, []); store.set(DEP_KEY, []);
      load().then(function () { toast('Demostración reiniciada.'); });
    });
  }

  function initLogout() {
    $('logout').addEventListener('click', function (e) {
      if (!LIVE) return;
      e.preventDefault();
      db.auth.signOut().then(function () { location.href = 'index.html'; });
    });
  }

  function boot() {
    safe(initNav, 'nav');
    safe(initFilters, 'filtros');
    safe(initWithdraw, 'retiro');
    safe(initCopy, 'copiar');
    safe(initKyc, 'kyc');
    safe(initSoon, 'pronto');
    safe(initLogout, 'salir');
    safe(initDemoReset, 'demo');
    safe(initDeposit, 'deposito');
    load().then(function () {
      $('loading').classList.add('is-done');
    }).catch(function (err) {
      if (String(err && err.message) === 'sin sesión') return;
      $('loading').querySelector('span').textContent = 'No se pudo cargar tu panel. ' + errText(err);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
