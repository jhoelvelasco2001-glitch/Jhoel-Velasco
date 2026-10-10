/* Jhoel 1% — Panel de administración (IIFE, sin módulos)
   Con Supabase configurado trabaja sobre los datos reales (solo cuentas con rol
   "admin"). Sin configurar, funciona en modo demostración con datos de ejemplo. */
(function () {
  'use strict';

  var J1 = window.J1 || { live: false, config: {} };
  var db = J1.db;
  var LIVE = !!db;

  /* ---------- Utilidades ---------- */
  function safe(fn, name) { try { fn(); } catch (e) { if (window.console) console.warn('[admin] ' + name + ':', e); } }
  function $(id) { return document.getElementById(id); }
  var usd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(n) { n = Number(n) || 0; return (n < 0 ? '-' : '') + 'US$' + usd.format(Math.abs(n)); }
  function parseDate(s) { if (!s) return null; if (s instanceof Date) return s; return new Date(String(s).length === 10 ? s + 'T12:00:00' : s); }
  function fmtDate(d) { d = parseDate(d); return d ? d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '') : '—'; }
  function fmtDateTime(d) { d = parseDate(d); return d ? fmtDate(d) + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—'; }
  function isoDay(d) { var x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }
  function addMonths(d, n) { var x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function pill(text, kind) { return el('span', 'pill pill--' + kind, text); }
  function btn(text, cls, onClick) { var b = el('button', 'btn btn--sm ' + cls, text); b.type = 'button'; b.addEventListener('click', onClick); return b; }
  function toast(text) {
    var t = el('div', 'toast', text);
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); }, 3600);
    setTimeout(function () { t.remove(); }, 4100);
  }
  function errText(e) { return J1.errorText ? J1.errorText(e) : (e && e.message) || 'Ocurrió un error.'; }
  function fullName(p) { return ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || p.email || '—'; }
  function unwrap(r) { if (r.error) throw r.error; return r.data; }

  var KYC = { verified: ['Verificado', 'ok'], in_review: ['En revisión', 'warn'], pending: ['Pendiente', 'blue'], rejected: ['Rechazado', 'bad'] };
  var INV = { active: ['Activa', 'ok'], closing: ['En cierre', 'warn'], closed: ['Cerrada', 'blue'], none: ['Sin inversión', 'blue'] };
  var WST = { pending: ['Pendiente', 'warn'], approved: ['Aprobado', 'blue'], paid: ['Pagado', 'ok'], rejected: ['Rechazado', 'bad'] };
  var DOC = { id: 'Documento de identidad', selfie: 'Selfie con documento', address: 'Comprobante de domicilio' };

  /* ======================================================================
     API — real (Supabase) o demostración (en memoria)
     ====================================================================== */
  var api = LIVE ? liveApi() : demoApi();

  function liveApi() {
    return {
      guard: function () {
        return db.auth.getSession().then(function (r) {
          var s = r.data && r.data.session;
          if (!s) { location.replace('index.html#login'); throw new Error('sin sesión'); }
          return db.from('profiles').select('role').eq('id', s.user.id).single().then(function (p) {
            if (!p.data || p.data.role !== 'admin') { location.replace('panel.html'); throw new Error('sin permiso'); }
          });
        });
      },
      stats: function () { return db.rpc('admin_stats').then(unwrap).then(function (d) { return d[0]; }); },
      investors: function () { return db.rpc('admin_investors').then(unwrap); },
      movements: function (uid) { return db.from('movements').select('*').eq('user_id', uid).order('created_at', { ascending: false }).then(unwrap); },
      withdrawals: function () {
        return db.from('withdrawal_requests').select('*, profiles(first_name,last_name,email,phone)')
          .order('created_at', { ascending: false }).limit(500).then(unwrap);
      },
      processWithdrawal: function (id, status, note) { return db.rpc('admin_process_withdrawal', { p_id: id, p_status: status, p_note: note || null }).then(unwrap); },
      kycDocs: function () {
        return db.from('kyc_docs').select('*, profiles(first_name,last_name,email)').eq('status', 'pending')
          .order('created_at', { ascending: true }).then(unwrap).then(function (docs) {
            if (!docs.length) return docs;
            return db.storage.from('kyc').createSignedUrls(docs.map(function (d) { return d.path; }), 3600).then(function (r) {
              var urls = {};
              (r.data || []).forEach(function (u) { urls[u.path] = u.signedUrl; });
              docs.forEach(function (d) { d.url = urls[d.path] || null; });
              return docs;
            });
          });
      },
      reviewKyc: function (id, status, note) { return db.rpc('admin_review_kyc', { p_doc: id, p_status: status, p_note: note || null }).then(unwrap); },
      setKyc: function (uid, status) { return db.rpc('admin_set_kyc', { p_user: uid, p_status: status }).then(unwrap); },
      deposit: function (uid, amount, detail, start, promo) {
        return db.rpc('admin_register_deposit', { p_user: uid, p_amount: amount, p_detail: detail, p_start: start, p_promo: promo }).then(unwrap);
      },
      credit: function (real, commit, note) { return db.rpc('admin_credit_profits', { p_real_result: real, p_commit: commit, p_note: note || null }).then(unwrap); },
      results: function () { return db.from('monthly_results').select('*').order('created_at', { ascending: false }).limit(50).then(unwrap); },
      deposits: function () {
        return db.from('deposit_requests').select('*, profiles(first_name,last_name,email,phone)')
          .order('created_at', { ascending: false }).limit(500).then(function (r) {
            if (r.error) {
              if (/deposit_requests/.test(r.error.message || '')) throw new Error('Falta crear la tabla de depósitos: ejecuta supabase/02-depositos.sql en Supabase.');
              throw r.error;
            }
            var list = r.data;
            var paths = list.filter(function (d) { return d.receipt_path; }).map(function (d) { return d.receipt_path; });
            if (!paths.length) return list;
            return db.storage.from('receipts').createSignedUrls(paths, 3600).then(function (s) {
              var urls = {};
              (s.data || []).forEach(function (u) { urls[u.path] = u.signedUrl; });
              list.forEach(function (d) { d.url = urls[d.receipt_path] || null; });
              return list;
            });
          });
      },
      pendingDeposits: function () {
        return db.from('deposit_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
          .then(function (r) { return r.error ? 0 : (r.count || 0); });
      },
      processDeposit: function (id, status, note, promo) {
        return db.rpc('admin_process_deposit', { p_id: id, p_status: status, p_note: note || null, p_promo: !!promo }).then(unwrap);
      },
      signOut: function () { return db.auth.signOut(); }
    };
  }

  function demoApi() {
    var today = new Date(); today.setHours(12, 0, 0, 0);
    var n = 0;
    function id() { return 'u' + (++n); }
    var people = [
      ['Ana', 'Torres Quispe', 'Perú', 'verified', 5000, -86, true, 12],
      ['Carlos', 'Mendoza Ríos', 'Perú', 'verified', 1200, -61, true, 0],
      ['Lucía', 'Ramírez Soto', 'Chile', 'verified', 25000, -120, false, 3],
      ['Jorge', 'Paredes León', 'Colombia', 'in_review', 0, 0, false, 0],
      ['María', 'Fernández Gil', 'México', 'verified', 800, -40, true, 1],
      ['Diego', 'Salas Vera', 'Perú', 'pending', 0, 0, false, 0],
      ['Valeria', 'Castro Núñez', 'Ecuador', 'verified', 3500, -33, true, 0]
    ];
    var investors = people.map(function (p, i) {
      var uid = id();
      var start = p[4] ? addDays(today, p[5]) : null;
      var promo = p[6] && start ? addMonths(start, 3) : null;
      var months = start ? Math.floor(-p[5] / 30.4) : 0;
      var rate = 1 + Math.min(p[7] * 0.01, 1);
      var profits = 0;
      for (var m = 1; m <= months; m++) profits += p[4] * ((promo && addMonths(start, m) <= promo) ? 2 : rate) / 100;
      return {
        id: uid, email: p[0].toLowerCase() + '.' + p[1].split(' ')[0].toLowerCase() + '@ejemplo.com',
        first_name: p[0], last_name: p[1], phone: '+51 9' + (10000000 + i * 1234567).toString().slice(0, 8), country: p[2],
        doc_number: null, kyc_status: p[3], ref_code: 'JHOEL-' + p[0].toUpperCase().slice(0, 4) + (20 + i),
        referred_by_name: i === 1 ? 'Ana Torres Quispe' : null, created_at: addDays(today, (p[5] || -2) - 3).toISOString(),
        investment_id: start ? 'i' + uid : null, capital: p[4], start_date: start ? isoDay(start) : null,
        promo_until: promo ? isoDay(promo) : null, inv_status: start ? 'active' : 'none',
        profits_total: Math.round(profits * 100) / 100, available: Math.round(profits * 100) / 100, valid_refs: p[7], rate: rate
      };
    });
    var byName = function (f) { return investors.filter(function (x) { return x.first_name === f; })[0]; };
    var withdrawals = [
      { id: 101, user: byName('Ana'), type: 'profit', amount: 100, method: 'Yape / Plin', account: '+51 999 888 777', status: 'pending', created_at: addDays(today, -1).toISOString() },
      { id: 102, user: byName('Lucía'), type: 'profit', amount: 450, method: 'Transferencia bancaria', account: 'BCI 0012-3456-78', status: 'approved', created_at: addDays(today, -2).toISOString() },
      { id: 103, user: byName('María'), type: 'total', amount: 816, method: 'USDT (TRC20)', account: 'TQ7n…9xKp', status: 'pending', created_at: addDays(today, -3).toISOString() },
      { id: 99, user: byName('Ana'), type: 'profit', amount: 100, method: 'Transferencia bancaria', account: 'BCP 191-12345678-0-12', status: 'paid', created_at: addDays(today, -55).toISOString() }
    ].map(function (w) {
      w.user_id = w.user.id; w.profiles = { first_name: w.user.first_name, last_name: w.user.last_name, email: w.user.email, phone: w.user.phone };
      return w;
    });
    var docs = [
      { id: 7, user: byName('Jorge'), kind: 'id' }, { id: 8, user: byName('Jorge'), kind: 'selfie' }, { id: 9, user: byName('Jorge'), kind: 'address' }
    ].map(function (d) {
      d.user_id = d.user.id; d.status = 'pending'; d.created_at = addDays(today, -1).toISOString(); d.url = null;
      d.profiles = { first_name: d.user.first_name, last_name: d.user.last_name, email: d.user.email };
      return d;
    });
    var deposits = [
      { id: 501, user: byName('Valeria'), amount: 1500, method: 'binance', reference: '298374012938', status: 'pending', created_at: addDays(today, 0).toISOString() },
      { id: 502, user: byName('Diego'), amount: 300, method: 'yape', reference: 'OP-77120', status: 'pending', created_at: addDays(today, -1).toISOString() },
      { id: 490, user: byName('Ana'), amount: 5000, method: 'bank', reference: 'BCP 00918273', status: 'confirmed', created_at: addDays(today, -86).toISOString() }
    ].map(function (d) {
      d.user_id = d.user.id; d.url = null;
      d.profiles = { first_name: d.user.first_name, last_name: d.user.last_name, email: d.user.email, phone: d.user.phone };
      return d;
    });
    var results = [
      { created_at: addDays(today, -9).toISOString(), real_result: 1.85, credited: 3, total: 512.4, note: 'Cierre de septiembre' },
      { created_at: addDays(today, -40).toISOString(), real_result: 2.1, credited: 2, total: 365, note: 'Cierre de agosto' }
    ];
    var P = Promise.resolve.bind(Promise);
    return {
      guard: function () { return P(); },
      stats: function () {
        var open = withdrawals.filter(function (w) { return w.status === 'pending' || w.status === 'approved'; });
        return P({
          capital_total: investors.reduce(function (a, x) { return a + (x.inv_status !== 'none' ? x.capital : 0); }, 0),
          investors_active: investors.filter(function (x) { return x.inv_status === 'active'; }).length,
          investors_total: investors.length,
          withdrawals_pending: open.length,
          withdrawals_pending_amount: open.reduce(function (a, w) { return a + w.amount; }, 0),
          kyc_pending: Object.keys(docs.reduce(function (m, d) { if (d.status === 'pending') m[d.user_id] = 1; return m; }, {})).length,
          profits_month: 512.4
        });
      },
      investors: function () { return P(investors.slice()); },
      movements: function (uid) {
        var x = investors.filter(function (i) { return i.id === uid; })[0];
        if (!x || !x.start_date) return P([]);
        var list = [{ kind: 'deposit', amount: x.capital, detail: 'Transferencia bancaria', created_at: parseDate(x.start_date).toISOString() }];
        if (x.profits_total) list.unshift({ kind: 'profit', amount: x.profits_total, detail: 'Rentabilidad acumulada', created_at: today.toISOString() });
        return P(list);
      },
      withdrawals: function () { return P(withdrawals.slice()); },
      processWithdrawal: function (wid, status, note) {
        withdrawals.forEach(function (w) { if (w.id === wid) { w.status = status; w.admin_note = note || null; w.processed_at = new Date().toISOString(); } });
        return P();
      },
      kycDocs: function () { return P(docs.filter(function (d) { return d.status === 'pending'; })); },
      reviewKyc: function (did, status) {
        docs.forEach(function (d) { if (d.id === did) d.status = status === 'approved' ? 'approved' : 'rejected'; });
        return P();
      },
      setKyc: function (uid, status) { investors.forEach(function (x) { if (x.id === uid) x.kyc_status = status; }); return P(); },
      deposit: function (uid, amount, detail, start, promo) {
        investors.forEach(function (x) {
          if (x.id !== uid) return;
          if (x.inv_status === 'none') {
            if (amount < 100 || amount > 100000) throw new Error('La inversión inicial debe estar entre US$100 y US$100,000.');
            x.inv_status = 'active'; x.start_date = start; x.capital = amount;
            x.promo_until = promo ? isoDay(addMonths(parseDate(start), 3)) : null;
          } else x.capital += amount;
        });
        return P();
      },
      credit: function (real, commit, note) {
        var rows = investors.filter(function (x) {
          return x.inv_status === 'active' && addMonths(parseDate(x.start_date), 1) <= today;
        }).slice(0, 4).map(function (x) {
          var start = parseDate(x.start_date);
          var paid = Math.floor((today - start) / (30.4 * 86400000));
          var from = addMonths(start, Math.max(paid - 1, 0)), to = addMonths(start, Math.max(paid, 1));
          var target = x.promo_until && to <= parseDate(x.promo_until) ? 2 : x.rate;
          var applied = Math.min(target, real);
          return { user_id: x.id, name: x.first_name + ' ' + x.last_name, capital: x.capital, period_start: isoDay(from), period_end: isoDay(to),
                   target: target, applied: applied, amount: Math.round(x.capital * applied) / 100 };
        });
        if (commit) {
          results.unshift({ created_at: new Date().toISOString(), real_result: real, credited: rows.length,
                            total: rows.reduce(function (a, r) { return a + r.amount; }, 0), note: note });
        }
        return P(rows);
      },
      results: function () { return P(results.slice()); },
      deposits: function () { return P(deposits.slice()); },
      pendingDeposits: function () { return P(deposits.filter(function (d) { return d.status === 'pending'; }).length); },
      processDeposit: function (did, status, note) {
        deposits.forEach(function (d) {
          if (d.id !== did) return;
          d.status = status; d.admin_note = note || null; d.processed_at = new Date().toISOString();
          if (status === 'confirmed') investors.forEach(function (x) {
            if (x.id !== d.user_id) return;
            if (x.inv_status === 'none') { x.inv_status = 'active'; x.start_date = isoDay(new Date()); x.capital = d.amount; }
            else x.capital += d.amount;
          });
        });
        return P();
      },
      signOut: function () { return P(); }
    };
  }

  /* ======================================================================
     NAVEGACIÓN
     ====================================================================== */
  var VIEWS = ['resumen', 'inversionistas', 'depositos', 'retiros', 'verificaciones', 'rentabilidad'];
  var loaded = {};
  function showView(name) {
    if (VIEWS.indexOf(name) < 0) name = 'resumen';
    VIEWS.forEach(function (v) { $('view-' + v).hidden = v !== name; });
    [].slice.call(document.querySelectorAll('[data-view]')).forEach(function (a) {
      if (a.closest('.side__nav') || a.closest('.tabbar')) a.classList.toggle('is-active', a.getAttribute('data-view') === name);
    });
    window.scrollTo(0, 0);
    loadView(name);
  }
  function loadView(name, force) {
    if (loaded[name] && !force) return Promise.resolve();
    loaded[name] = true;
    var fn = { resumen: loadHome, inversionistas: loadInvestors, depositos: loadDeposits, retiros: loadWithdrawals, verificaciones: loadKyc, rentabilidad: loadResults }[name];
    return fn().catch(function (e) { loaded[name] = false; toast(errText(e)); });
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
    $('refresh').addEventListener('click', function () {
      loaded = {};
      var current = VIEWS.filter(function (v) { return !$('view-' + v).hidden; })[0];
      loadView(current, true).then(function () { toast('Datos actualizados.'); });
      refreshBadges();
    });
  }

  function emptyRow(body, cols, text) {
    var tr = el('tr'); var td = el('td', 'muted', text); td.colSpan = cols; tr.appendChild(td); body.appendChild(tr);
  }
  function whoCell(name, sub) {
    var d = el('div', 'who'); d.appendChild(el('strong', null, name)); if (sub) d.appendChild(el('span', null, sub)); return d;
  }

  /* ======================================================================
     RESUMEN
     ====================================================================== */
  function refreshBadges() {
    return api.stats().then(function (s) {
      var bw = $('badgeW'), bk = $('badgeK');
      bw.textContent = s.withdrawals_pending; bw.hidden = !s.withdrawals_pending;
      bk.textContent = s.kyc_pending; bk.hidden = !s.kyc_pending;
      api.pendingDeposits().then(function (n) { var bd = $('badgeD'); bd.textContent = n; bd.hidden = !n; });
      return s;
    });
  }
  function loadHome() {
    return Promise.all([refreshBadges(), api.withdrawals(), api.kycDocs()]).then(function (r) {
      var s = r[0];
      $('sCapital').textContent = money(s.capital_total);
      $('sInvestors').textContent = s.investors_active;
      $('sInvestorsMeta').textContent = 'activos de ' + s.investors_total + ' registrados';
      $('sWithdrawals').textContent = s.withdrawals_pending;
      $('sWithdrawalsMeta').textContent = money(s.withdrawals_pending_amount) + ' en total';
      $('sKyc').textContent = s.kyc_pending;
      $('sProfits').textContent = money(s.profits_month);

      var ul = $('homeW'); ul.innerHTML = '';
      var open = r[1].filter(function (w) { return w.status === 'pending' || w.status === 'approved'; }).slice(0, 5);
      if (!open.length) ul.appendChild(el('li', 'empty', 'No hay retiros por atender.'));
      open.forEach(function (w) {
        var li = el('li');
        li.appendChild(el('span', 'feed__ico feed__ico--withdraw', '↑'));
        var t = el('div', 'feed__txt');
        t.appendChild(el('strong', null, fullName(w.profiles || {})));
        t.appendChild(el('span', null, (w.type === 'total' ? 'Retiro total' : 'Ganancias') + ' · ' + fmtDate(w.created_at) + ' · ' + w.method));
        li.appendChild(t);
        var a = el('div', 'feed__amt', money(w.amount)); var sm = el('small'); sm.appendChild(pill(WST[w.status][0], WST[w.status][1])); a.appendChild(sm);
        li.appendChild(a); ul.appendChild(li);
      });

      var uk = $('homeK'); uk.innerHTML = '';
      var byUser = {};
      r[2].forEach(function (d) { (byUser[d.user_id] = byUser[d.user_id] || { p: d.profiles || {}, n: 0, at: d.created_at }).n++; });
      var keys = Object.keys(byUser);
      if (!keys.length) uk.appendChild(el('li', 'empty', 'No hay documentos por revisar.'));
      keys.slice(0, 5).forEach(function (k) {
        var x = byUser[k], li = el('li');
        li.appendChild(el('span', 'feed__ico feed__ico--deposit', '✓'));
        var t = el('div', 'feed__txt');
        t.appendChild(el('strong', null, fullName(x.p)));
        t.appendChild(el('span', null, x.n + (x.n === 1 ? ' documento' : ' documentos') + ' · ' + fmtDate(x.at)));
        li.appendChild(t);
        var a = el('div', 'feed__amt'); a.appendChild(pill('Por revisar', 'warn')); li.appendChild(a);
        uk.appendChild(li);
      });
    });
  }

  /* ======================================================================
     INVERSIONISTAS
     ====================================================================== */
  var investors = [];
  function loadInvestors() {
    return api.investors().then(function (list) { investors = list; renderInvestors(); });
  }
  function renderInvestors() {
    var q = $('invSearch').value.trim().toLowerCase();
    var body = $('invBody'); body.innerHTML = '';
    var list = investors.filter(function (x) {
      if (!q) return true;
      return (fullName(x) + ' ' + x.email + ' ' + x.ref_code + ' ' + (x.phone || '')).toLowerCase().indexOf(q) > -1;
    });
    if (!list.length) return emptyRow(body, 7, q ? 'Nadie coincide con la búsqueda.' : 'Aún no hay inversionistas registrados.');
    list.forEach(function (x) {
      var tr = el('tr'); tr.tabIndex = 0;
      var c1 = el('td'); c1.appendChild(whoCell(fullName(x), x.email + ' · ' + (x.country || '—'))); tr.appendChild(c1);
      var c2 = el('td'); var k = KYC[x.kyc_status] || ['—', 'blue']; c2.appendChild(pill(k[0], k[1])); tr.appendChild(c2);
      tr.appendChild(el('td', 'num', money(x.capital)));
      tr.appendChild(el('td', 'num', money(x.available)));
      tr.appendChild(el('td', 'num', String(x.valid_refs)));
      tr.appendChild(el('td', 'num', Number(x.rate).toFixed(2) + '%'));
      var c7 = el('td'); var s = INV[x.inv_status] || INV.none; c7.appendChild(pill(s[0], s[1])); tr.appendChild(c7);
      tr.addEventListener('click', function () { openDrawer(x); });
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') openDrawer(x); });
      body.appendChild(tr);
    });
  }

  var current = null, lastFocus = null;
  function openDrawer(x) {
    current = x; lastFocus = document.activeElement;
    $('dCode').textContent = x.ref_code;
    $('dName').textContent = fullName(x);
    var contact = $('dContact'); contact.innerHTML = '';
    contact.appendChild(document.createTextNode(x.email + ' · '));
    var wa = el('a', null, x.phone || 'sin teléfono');
    if (x.phone) { wa.href = 'https://wa.me/' + x.phone.replace(/\D/g, ''); wa.target = '_blank'; wa.rel = 'noopener'; wa.style.color = 'var(--ok)'; }
    contact.appendChild(wa);

    var rows = [
      ['País', x.country || '—'], ['Registrado', fmtDate(x.created_at)],
      ['Referido por', x.referred_by_name || '—'], ['Referidos válidos', String(x.valid_refs)],
      ['Tasa objetivo regular', Number(x.rate).toFixed(2) + '%'],
      ['Inversión', (INV[x.inv_status] || INV.none)[0]]
    ];
    if (x.inv_status !== 'none') {
      rows.push(['Capital', money(x.capital)], ['Inicio', fmtDate(x.start_date)],
                ['Promoción hasta', x.promo_until ? fmtDate(x.promo_until) : 'Sin promoción'],
                ['Rentabilidad acreditada', money(x.profits_total)], ['Ganancias disponibles', money(x.available)]);
    }
    var dl = $('dData'); dl.innerHTML = '';
    rows.forEach(function (r) { var d = el('div'); d.appendChild(el('dt', null, r[0])); d.appendChild(el('dd', null, r[1])); dl.appendChild(d); });

    $('dKyc').value = x.kyc_status;
    var isNew = x.inv_status === 'none';
    $('dDepTitle').textContent = isNew ? 'Registrar depósito inicial' : 'Agregar capital';
    $('dStartWrap').hidden = !isNew;
    $('dPromoWrap').hidden = !isNew;
    $('dStart').value = isoDay(new Date());
    $('dDeposit').reset(); $('dStart').value = isoDay(new Date());
    $('dMsg').textContent = '';

    var ul = $('dMov'); ul.innerHTML = ''; ul.appendChild(el('li', 'empty', 'Cargando…'));
    api.movements(x.id).then(function (list) {
      ul.innerHTML = '';
      if (!list.length) { ul.appendChild(el('li', 'empty', 'Sin movimientos.')); return; }
      var titles = { deposit: 'Depósito', profit: 'Rentabilidad', withdraw: 'Retiro de ganancias', capital_return: 'Devolución de capital' };
      list.forEach(function (m) {
        var li = el('li');
        li.appendChild(el('span', 'feed__ico feed__ico--' + (m.kind === 'capital_return' ? 'withdraw' : m.kind), { deposit: '↓', profit: '%' }[m.kind] || '↑'));
        var t = el('div', 'feed__txt'); t.appendChild(el('strong', null, titles[m.kind] || m.kind)); t.appendChild(el('span', null, fmtDate(m.created_at) + (m.detail ? ' · ' + m.detail : '')));
        li.appendChild(t);
        li.appendChild(el('div', 'feed__amt' + (m.amount > 0 ? ' pos' : ''), (m.amount > 0 ? '+' : '') + money(m.amount)));
        ul.appendChild(li);
      });
    }).catch(function (e) { ul.innerHTML = ''; ul.appendChild(el('li', 'empty', errText(e))); });

    $('drawer').hidden = false;
    document.body.classList.add('drawer-open');
    setTimeout(function () { $('drawer').querySelector('.auth__close').focus(); }, 50);
  }
  function closeDrawer() {
    $('drawer').hidden = true;
    document.body.classList.remove('drawer-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function initInvestors() {
    $('invSearch').addEventListener('input', renderInvestors);
    $('drawer').addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeDrawer(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('drawer').hidden) closeDrawer(); });

    $('dKycSave').addEventListener('click', function () {
      var v = $('dKyc').value;
      api.setKyc(current.id, v).then(function () {
        current.kyc_status = v; renderInvestors(); toast('Verificación actualizada: ' + KYC[v][0] + '.');
        loaded.verificaciones = false; refreshBadges();
      }).catch(function (e) { toast(errText(e)); });
    });

    $('dDeposit').addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = $('dMsg');
      var amount = Math.round(parseFloat($('dAmount').value) * 100) / 100;
      var isNew = current.inv_status === 'none';
      msg.classList.remove('is-error');
      if (!(amount > 0)) { msg.textContent = 'Escribe el monto recibido.'; msg.classList.add('is-error'); $('dAmount').focus(); return; }
      if (isNew && (amount < 100 || amount > 100000)) { msg.textContent = 'La inversión inicial debe estar entre US$100 y US$100,000.'; msg.classList.add('is-error'); return; }
      var detail = $('dDetail').value.trim() || 'Depósito';
      var submit = $('dDeposit').querySelector('button[type="submit"]');
      submit.disabled = true;
      api.deposit(current.id, amount, detail, $('dStart').value || isoDay(new Date()), isNew && $('dPromo').checked).then(function () {
        msg.textContent = 'Depósito de ' + money(amount) + ' registrado.';
        loaded.resumen = false;
        return api.investors().then(function (list) {
          investors = list; renderInvestors();
          var again = list.filter(function (x) { return x.id === current.id; })[0];
          if (again) { openDrawer(again); $('dMsg').textContent = 'Depósito de ' + money(amount) + ' registrado.'; }
        });
      }).catch(function (err) { msg.textContent = errText(err); msg.classList.add('is-error'); })
        .then(function () { submit.disabled = false; });
    });
  }

  /* ======================================================================
     RETIROS
     ====================================================================== */
  var wList = [], wFilter = 'open';
  function loadWithdrawals() { return api.withdrawals().then(function (l) { wList = l; renderWithdrawals(); }); }
  function renderWithdrawals() {
    var body = $('wBody'); body.innerHTML = '';
    var list = wList.filter(function (w) {
      if (wFilter === 'open') return w.status === 'pending' || w.status === 'approved';
      if (wFilter === 'all') return true;
      return w.status === wFilter;
    });
    if (wFilter === 'open') list.sort(function (a, b) { return parseDate(a.created_at) - parseDate(b.created_at); });
    if (!list.length) return emptyRow(body, 7, wFilter === 'open' ? 'No hay retiros por atender.' : 'No hay retiros en esta lista.');
    list.forEach(function (w) {
      var tr = el('tr');
      var hours = Math.round((Date.now() - parseDate(w.created_at)) / 3600000);
      var c0 = el('td'); c0.appendChild(whoCell(fmtDate(w.created_at), w.status === 'pending' || w.status === 'approved' ? 'hace ' + (hours < 48 ? hours + ' h' : Math.round(hours / 24) + ' días') : null)); tr.appendChild(c0);
      var p = w.profiles || {};
      var c1 = el('td'); c1.appendChild(whoCell(fullName(p), p.email)); tr.appendChild(c1);
      tr.appendChild(el('td', null, w.type === 'total' ? 'Retiro total' : 'Ganancias'));
      tr.appendChild(el('td', 'num', money(w.amount)));
      var c4 = el('td', 'dest'); c4.appendChild(document.createTextNode(w.method));
      var code = el('code', null, w.account); c4.appendChild(code);
      c4.appendChild(btn('Copiar', 'link-btn', function () {
        try { navigator.clipboard.writeText(w.account).then(function () { toast('Cuenta copiada.'); }, function () { toast('Selecciona y copia la cuenta.'); }); }
        catch (e) { toast('Selecciona y copia la cuenta.'); }
      }));
      c4.lastChild.className = 'link-btn';
      tr.appendChild(c4);
      var c5 = el('td'); c5.appendChild(pill(WST[w.status][0], WST[w.status][1]));
      if (w.admin_note) c5.appendChild(el('div', 'muted', w.admin_note));
      tr.appendChild(c5);

      var c6 = el('td'); var acts = el('div', 'acts');
      function act(status, note) {
        return api.processWithdrawal(w.id, status, note).then(function () {
          toast({ approved: 'Retiro aprobado.', paid: 'Retiro marcado como pagado.', rejected: 'Retiro rechazado.' }[status]);
          loaded.resumen = false; loaded.inversionistas = false;
          refreshBadges();
          return loadWithdrawals();
        }).catch(function (e) { toast(errText(e)); });
      }
      if (w.status === 'pending') acts.appendChild(btn('Aprobar', 'btn--ghost', function () { act('approved'); }));
      if (w.status === 'pending' || w.status === 'approved') {
        acts.appendChild(btn('Marcar pagado', 'btn--gold', function () { act('paid'); }));
        acts.appendChild(btn('Rechazar', 'btn--danger', function () {
          if (c6.querySelector('.note-row')) return;
          var row = el('div', 'note-row');
          var input = el('input'); input.placeholder = 'Motivo (lo verá el inversionista)'; input.setAttribute('aria-label', 'Motivo del rechazo');
          row.appendChild(input);
          row.appendChild(btn('Confirmar', 'btn--danger', function () {
            if (input.value.trim().length < 3) { input.focus(); toast('Escribe el motivo del rechazo.'); return; }
            act('rejected', input.value.trim());
          }));
          c6.appendChild(row); input.focus();
        }));
      }
      if (!acts.children.length) acts.appendChild(el('span', 'muted', w.processed_at ? fmtDateTime(w.processed_at) : '—'));
      c6.appendChild(acts);
      tr.appendChild(c6);
      body.appendChild(tr);
    });
  }
  function initWithdrawals() {
    [].slice.call(document.querySelectorAll('[data-wfilter]')).forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('[data-wfilter]').forEach(function (x) { x.classList.toggle('is-on', x === c); });
        wFilter = c.getAttribute('data-wfilter');
        renderWithdrawals();
      });
    });
  }

  /* ======================================================================
     DEPÓSITOS
     ====================================================================== */
  var dList = [], dFilter = 'pending';
  var PAY_NAME = { binance: 'Binance', bank: 'Transferencia bancaria', yape: 'Yape / Plin' };
  var DST = { pending: ['Por confirmar', 'warn'], confirmed: ['Confirmado', 'ok'], rejected: ['Rechazado', 'bad'] };
  function loadDeposits() { return api.deposits().then(function (l) { dList = l; renderDeposits(); }); }
  function renderDeposits() {
    var body = $('dBody'); body.innerHTML = '';
    var list = dList.filter(function (d) { return dFilter === 'all' || d.status === dFilter; });
    if (dFilter === 'pending') list.sort(function (a, b) { return parseDate(a.created_at) - parseDate(b.created_at); });
    if (!list.length) return emptyRow(body, 7, dFilter === 'pending' ? 'No hay depósitos por confirmar.' : 'No hay depósitos en esta lista.');
    list.forEach(function (d) {
      var tr = el('tr');
      tr.appendChild(el('td', 'muted', fmtDateTime(d.created_at)));
      var p = d.profiles || {};
      var c1 = el('td'); c1.appendChild(whoCell(fullName(p), p.email)); tr.appendChild(c1);
      tr.appendChild(el('td', 'num', money(d.amount)));
      var c3 = el('td', 'dest');
      c3.appendChild(el('span', 'pay-chip' + (d.method === 'binance' ? ' pay-chip--binance' : ''), PAY_NAME[d.method] || d.method));
      c3.appendChild(el('code', null, d.reference));
      tr.appendChild(c3);
      var c4 = el('td');
      if (d.url) { var a = el('a', 'doc-link', 'Ver comprobante'); a.href = d.url; a.target = '_blank'; a.rel = 'noopener'; c4.appendChild(a); }
      else c4.appendChild(el('span', 'muted', d.receipt_path ? 'No disponible' : 'Sin archivo'));
      tr.appendChild(c4);
      var c5 = el('td'); var s = DST[d.status] || ['—', 'blue']; c5.appendChild(pill(s[0], s[1]));
      if (d.admin_note) c5.appendChild(el('div', 'muted', d.admin_note));
      tr.appendChild(c5);

      var c6 = el('td'); var acts = el('div', 'acts');
      function act(status, note, promo) {
        return api.processDeposit(d.id, status, note, promo).then(function () {
          toast(status === 'confirmed' ? 'Depósito confirmado: ' + money(d.amount) + ' sumados al capital.' : 'Depósito rechazado.');
          loaded.resumen = false; loaded.inversionistas = false;
          refreshBadges();
          return loadDeposits();
        }).catch(function (e) { toast(errText(e)); });
      }
      if (d.status === 'pending') {
        var promoLbl = el('label', 'promo-check');
        var promo = el('input'); promo.type = 'checkbox';
        promoLbl.appendChild(promo); promoLbl.appendChild(document.createTextNode('Promoción 2% (solo primera inversión)'));
        acts.appendChild(btn('Confirmar', 'btn--gold', function () { act('confirmed', null, promo.checked); }));
        acts.appendChild(btn('Rechazar', 'btn--danger', function () {
          if (c6.querySelector('.note-row')) return;
          var row = el('div', 'note-row');
          var input = el('input'); input.placeholder = 'Motivo (ej. no llegó el pago)'; input.setAttribute('aria-label', 'Motivo del rechazo');
          row.appendChild(input);
          row.appendChild(btn('Confirmar', 'btn--danger', function () {
            if (input.value.trim().length < 3) { input.focus(); toast('Escribe el motivo del rechazo.'); return; }
            act('rejected', input.value.trim());
          }));
          c6.appendChild(row); input.focus();
        }));
        c6.appendChild(acts);
        c6.appendChild(promoLbl);
      } else {
        acts.appendChild(el('span', 'muted', d.processed_at ? fmtDateTime(d.processed_at) : '—'));
        c6.appendChild(acts);
      }
      tr.appendChild(c6);
      body.appendChild(tr);
    });
  }
  function initDeposits() {
    [].slice.call(document.querySelectorAll('[data-dfilter]')).forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('[data-dfilter]').forEach(function (x) { x.classList.toggle('is-on', x === c); });
        dFilter = c.getAttribute('data-dfilter');
        renderDeposits();
      });
    });
  }

  /* ======================================================================
     VERIFICACIONES
     ====================================================================== */
  function loadKyc() {
    return api.kycDocs().then(function (docs) {
      var body = $('kBody'); body.innerHTML = '';
      if (!docs.length) return emptyRow(body, 5, 'No hay documentos por revisar.');
      docs.forEach(function (d) {
        var tr = el('tr');
        tr.appendChild(el('td', 'muted', fmtDate(d.created_at)));
        var p = d.profiles || {};
        var c1 = el('td'); c1.appendChild(whoCell(fullName(p), p.email)); tr.appendChild(c1);
        tr.appendChild(el('td', null, DOC[d.kind] || d.kind));
        var c3 = el('td');
        if (d.url) { var a = el('a', 'doc-link', 'Ver archivo'); a.href = d.url; a.target = '_blank'; a.rel = 'noopener'; c3.appendChild(a); }
        else c3.appendChild(el('span', 'muted', LIVE ? 'No disponible' : 'Ejemplo sin archivo'));
        tr.appendChild(c3);
        var c4 = el('td'); var acts = el('div', 'acts');
        function review(status, note) {
          api.reviewKyc(d.id, status, note).then(function () {
            toast(status === 'approved' ? 'Documento aprobado.' : 'Documento rechazado.');
            loaded.inversionistas = false; loaded.resumen = false; refreshBadges();
            return loadKyc();
          }).catch(function (e) { toast(errText(e)); });
        }
        acts.appendChild(btn('Aprobar', 'btn--gold', function () { review('approved'); }));
        acts.appendChild(btn('Rechazar', 'btn--danger', function () {
          if (c4.querySelector('.note-row')) return;
          var row = el('div', 'note-row');
          var input = el('input'); input.placeholder = 'Motivo (ej. foto borrosa)'; input.setAttribute('aria-label', 'Motivo del rechazo');
          row.appendChild(input);
          row.appendChild(btn('Confirmar', 'btn--danger', function () {
            if (input.value.trim().length < 3) { input.focus(); toast('Escribe el motivo del rechazo.'); return; }
            review('rejected', input.value.trim());
          }));
          c4.appendChild(row); input.focus();
        }));
        c4.appendChild(acts);
        tr.appendChild(c4);
        body.appendChild(tr);
      });
    });
  }

  /* ======================================================================
     RENTABILIDAD
     ====================================================================== */
  var preview = null;
  function loadResults() {
    return api.results().then(function (list) {
      var body = $('rBody'); body.innerHTML = '';
      if (!list.length) return emptyRow(body, 5, 'Todavía no se ha acreditado rentabilidad.');
      list.forEach(function (r) {
        var tr = el('tr');
        tr.appendChild(el('td', 'muted', fmtDateTime(r.created_at)));
        tr.appendChild(el('td', 'num', Number(r.real_result).toFixed(2) + '%'));
        tr.appendChild(el('td', 'num', String(r.credited)));
        tr.appendChild(el('td', 'num pos', money(r.total)));
        tr.appendChild(el('td', 'muted', r.note || '—'));
        body.appendChild(tr);
      });
    });
  }
  function initProfits() {
    var form = $('pForm'), msg = $('pMsg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var real = parseFloat($('pReal').value);
      msg.classList.remove('is-error'); msg.textContent = '';
      if (isNaN(real) || real < 0 || real > 10) { msg.textContent = 'Escribe el resultado real del mes, entre 0 y 10%.'; msg.classList.add('is-error'); $('pReal').focus(); return; }
      api.credit(real, false).then(function (rows) {
        preview = { real: real, note: $('pNote').value.trim(), rows: rows };
        var body = $('pBody'); body.innerHTML = '';
        var total = rows.reduce(function (a, r) { return a + Number(r.amount); }, 0);
        $('pPreview').hidden = false;
        $('pConfirm').hidden = true;
        $('pSummary').textContent = rows.length
          ? rows.length + (rows.length === 1 ? ' cuenta' : ' cuentas') + ' con periodo cumplido · total ' + money(total)
          : 'Ninguna inversión tiene un periodo mensual cumplido pendiente de acreditar.';
        $('pCommit').hidden = !rows.length;
        $('pCommit').textContent = 'Acreditar ' + money(total);
        if (!rows.length) emptyRow(body, 6, 'No hay nada que acreditar hoy.');
        rows.forEach(function (r) {
          var tr = el('tr');
          tr.appendChild(el('td', null, r.name));
          tr.appendChild(el('td', 'muted', fmtDate(r.period_start) + ' – ' + fmtDate(r.period_end)));
          tr.appendChild(el('td', 'num', money(r.capital)));
          tr.appendChild(el('td', 'num', Number(r.target).toFixed(2) + '%'));
          tr.appendChild(el('td', 'num', Number(r.applied).toFixed(2) + '%'));
          tr.appendChild(el('td', 'num pos', money(r.amount)));
          body.appendChild(tr);
        });
        $('pPreview').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }).catch(function (err) { msg.textContent = errText(err); msg.classList.add('is-error'); });
    });

    $('pCommit').addEventListener('click', function () {
      if (!preview) return;
      var total = preview.rows.reduce(function (a, r) { return a + Number(r.amount); }, 0);
      $('pConfirmText').textContent = '¿Acreditar ' + money(total) + ' a ' + preview.rows.length + (preview.rows.length === 1 ? ' cuenta' : ' cuentas') +
        ' con un resultado real de ' + preview.real.toFixed(2) + '%? Esta acción no se puede deshacer.';
      $('pConfirm').hidden = false; $('pYes').focus();
    });
    $('pNo').addEventListener('click', function () { $('pConfirm').hidden = true; });
    $('pYes').addEventListener('click', function () {
      $('pYes').disabled = true;
      api.credit(preview.real, true, preview.note).then(function (rows) {
        var total = rows.reduce(function (a, r) { return a + Number(r.amount); }, 0);
        toast('Rentabilidad acreditada: ' + money(total) + ' a ' + rows.length + ' cuentas.');
        $('pPreview').hidden = true; preview = null; $('pForm').reset();
        loaded.resumen = false; loaded.inversionistas = false;
        return loadResults();
      }).catch(function (err) { toast(errText(err)); })
        .then(function () { $('pYes').disabled = false; });
    });
  }

  /* ======================================================================
     ARRANQUE
     ====================================================================== */
  function boot() {
    $('demoBar').hidden = LIVE;
    var d = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('today').textContent = d.charAt(0).toUpperCase() + d.slice(1);
    $('logout').addEventListener('click', function (e) {
      if (!LIVE) return;
      e.preventDefault();
      api.signOut().then(function () { location.href = 'index.html'; });
    });
    safe(initNav, 'nav');
    safe(initInvestors, 'inversionistas');
    safe(initDeposits, 'depositos');
    safe(initWithdrawals, 'retiros');
    safe(initProfits, 'rentabilidad');
    api.guard().then(function () {
      showView(location.hash.slice(1));
      $('loading').classList.add('is-done');
    }).catch(function (err) {
      var m = String(err && err.message);
      if (m === 'sin sesión' || m === 'sin permiso') return;
      $('loading').querySelector('span').textContent = 'No se pudo cargar. ' + errText(err);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
