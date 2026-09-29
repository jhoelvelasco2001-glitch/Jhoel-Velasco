/* Jhoel 1% — interacciones (IIFE, sin módulos) */
(function () {
  'use strict';

  /* ======================================================================
     CONFIGURACIÓN — edita estos valores
     ====================================================================== */
  var CONFIG = {
    // Número de WhatsApp con código de país, solo dígitos (ej. Perú: 51987654321).
    // Mientras esté vacío, el formulario mostrará un aviso en lugar de abrir WhatsApp.
    whatsapp: '51912536501',
    baseRate: 1.0,          // % mensual objetivo base
    perReferral: 0.01,      // % adicional por referido válido
    maxBonus: 1.0,          // % adicional máximo por referidos
    promoRate: 2.0,         // % mensual promocional
    promoMonths: 3          // meses de promoción de lanzamiento
  };

  document.documentElement.classList.remove('no-js');

  function safe(fn, name) {
    try { fn(); } catch (e) { if (window.console) console.warn('[init] ' + name + ' falló:', e); }
  }

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function money(n) { return 'US' + usd.format(Math.round(n)); }

  /* ---------- Splash ---------- */
  function initSplash() {
    var splash = document.getElementById('splash');
    if (!splash) return;
    var hide = function () { splash.classList.add('is-hidden'); };
    if (document.readyState === 'complete') setTimeout(hide, 500);
    else window.addEventListener('load', function () { setTimeout(hide, 500); });
    setTimeout(hide, 3000);
  }

  /* ---------- Nav ---------- */
  function initNav() {
    var nav = document.getElementById('nav');
    var toggle = document.getElementById('navToggle');
    var links = document.getElementById('navLinks');
    var onScroll = function () { nav.classList.toggle('is-scrolled', window.scrollY > 30); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  /* ---------- Reveal on scroll (threshold bajo + red de seguridad 6s) ---------- */
  function initReveal() {
    var items = [].slice.call(document.querySelectorAll('.reveal'));
    var showAll = function () { items.forEach(function (el) { el.classList.add('is-in'); }); };
    if (!('IntersectionObserver' in window)) { showAll(); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var siblings = el.parentElement ? [].slice.call(el.parentElement.children).filter(function (c) { return c.classList.contains('reveal'); }) : [];
        var idx = Math.max(0, siblings.indexOf(el));
        el.style.transitionDelay = Math.min(idx * 90, 450) + 'ms';
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -5% 0px' });

    items.forEach(function (el) { io.observe(el); });
    setTimeout(showAll, 6000);
  }

  /* ---------- Contadores ---------- */
  function initCounters() {
    var els = [].slice.call(document.querySelectorAll('[data-count]'));
    if (!els.length || !('IntersectionObserver' in window)) return;
    var run = function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var start = null, dur = 1600;
      var step = function (t) {
        if (!start) start = t;
        var p = Math.min((t - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toFixed(dec);
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = target.toFixed(dec);
      };
      requestAnimationFrame(step);
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.05 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Resplandor que sigue al cursor + tilt del logo ---------- */
  function initPointer() {
    if (!window.matchMedia('(hover: hover)').matches) return;
    var glow = document.querySelector('.cursor-glow');
    var mark = document.getElementById('heroMark');
    var markImg = mark ? mark.querySelector('img') : null;
    var x = -999, y = -999, gx = x, gy = y;

    window.addEventListener('pointermove', function (e) { x = e.clientX; y = e.clientY; }, { passive: true });
    (function loop() {
      gx += (x - gx) * 0.12; gy += (y - gy) * 0.12;
      if (glow) glow.style.transform = 'translate3d(' + gx + 'px,' + gy + 'px,0)';
      requestAnimationFrame(loop);
    })();

    if (mark && markImg) {
      mark.addEventListener('pointermove', function (e) {
        var r = mark.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        markImg.style.transform = 'perspective(900px) rotateY(' + (px * 12) + 'deg) rotateX(' + (-py * 12) + 'deg)';
      });
      mark.addEventListener('pointerleave', function () { markImg.style.transform = ''; });
    }

    [].slice.call(document.querySelectorAll('.pillar')).forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---------- Simulador ---------- */
  function monthlyRate(month, refs, promo) {
    var bonus = Math.min(refs * CONFIG.perReferral, CONFIG.maxBonus);
    var regular = CONFIG.baseRate + bonus;
    if (promo && month <= CONFIG.promoMonths) return Math.max(regular, CONFIG.promoRate);
    return regular;
  }

  function initSimulator() {
    var cap = document.getElementById('simCapital');
    var capNum = document.getElementById('simCapitalNum');
    var refs = document.getElementById('simRefs');
    var months = document.getElementById('simMonths');
    var promo = document.getElementById('simPromo');
    var compound = document.getElementById('simCompound');
    var chart = document.getElementById('simChart');
    if (!cap || !chart) return;

    var out = {
      capital: document.getElementById('outCapital'),
      refs: document.getElementById('outRefs'),
      months: document.getElementById('outMonths'),
      rate: document.getElementById('resRate'),
      gain: document.getElementById('resGain'),
      total: document.getElementById('resTotal')
    };

    function paint(range) {
      var p = (range.value - range.min) / (range.max - range.min) * 100;
      range.style.setProperty('--p', p + '%');
    }

    function clampCapital(v) {
      v = parseFloat(v);
      if (isNaN(v)) v = 100;
      return Math.min(100000, Math.max(100, v));
    }

    function update() {
      var c = clampCapital(cap.value);
      var r = parseInt(refs.value, 10);
      var m = parseInt(months.value, 10);
      var isPromo = promo.checked;
      var isComp = compound.checked;

      out.capital.textContent = money(c);
      out.refs.textContent = r;
      out.months.textContent = m + (m === 1 ? ' mes' : ' meses');
      [cap, refs, months].forEach(paint);

      var balance = c, gains = 0, rows = [];
      for (var i = 1; i <= m; i++) {
        var rate = monthlyRate(i, r, isPromo);
        var base = isComp ? balance : c;
        var g = base * rate / 100;
        gains += g;
        balance = c + gains;
        rows.push({ month: i, rate: rate, total: balance, promo: isPromo && i <= CONFIG.promoMonths });
      }

      var regular = monthlyRate(CONFIG.promoMonths + 1, r, false);
      out.rate.textContent = isPromo && m > 0
        ? CONFIG.promoRate.toFixed(2) + '% → ' + regular.toFixed(2) + '%'
        : regular.toFixed(2) + '%';
      out.gain.textContent = money(gains);
      out.total.textContent = money(balance);

      var maxGain = rows.length ? rows[rows.length - 1].total - c : 0;
      chart.innerHTML = '';
      rows.forEach(function (row) {
        var col = document.createElement('div');
        col.className = 'col' + (row.promo ? ' promo' : '');
        col.setAttribute('data-tip', 'Mes ' + row.month + ' · ' + row.rate.toFixed(2) + '% · +' + money(row.total - c));
        var gainI = document.createElement('i');
        gainI.className = 'gain';
        gainI.style.height = (maxGain > 0 ? (row.total - c) / maxGain * 100 : 0) + '%';
        col.appendChild(gainI);
        chart.appendChild(col);
      });
    }

    cap.addEventListener('input', function () { capNum.value = cap.value; update(); });
    capNum.addEventListener('change', function () {
      var v = clampCapital(capNum.value);
      capNum.value = v; cap.value = v; update();
    });
    [refs, months, promo, compound].forEach(function (el) {
      el.addEventListener('input', update);
      el.addEventListener('change', update);
    });
    update();
  }

  /* ---------- Formulario de contacto → WhatsApp ---------- */
  function initContact() {
    var form = document.getElementById('contactForm');
    var msg = document.getElementById('contactMsg');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      msg.classList.remove('is-error');
      var d = new FormData(form);
      var nombre = (d.get('nombre') || '').toString().trim();
      var tel = (d.get('telefono') || '').toString().trim();
      if (!nombre || !tel) { msg.textContent = 'Por favor completa tu nombre y teléfono.'; msg.classList.add('is-error'); return; }
      if (!d.get('acepto')) { msg.textContent = 'Debes confirmar que leíste el aviso de riesgo.'; msg.classList.add('is-error'); return; }

      var text = 'Hola, quiero información sobre Jhoel 1%.\n' +
        'Nombre: ' + nombre + '\n' +
        'Teléfono: ' + tel + '\n' +
        (d.get('correo') ? 'Correo: ' + d.get('correo') + '\n' : '') +
        'Monto de interés: ' + d.get('monto');

      if (!CONFIG.whatsapp) {
        msg.textContent = 'Gracias, ' + nombre + '. El canal de contacto se habilitará muy pronto.';
        return;
      }
      var url = 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text);
      var win = window.open(url, '_blank', 'noopener');
      msg.textContent = win ? 'Abriendo WhatsApp… ' : 'Tu mensaje está listo. ';
      var link = document.createElement('a');
      link.href = url; link.target = '_blank'; link.rel = 'noopener';
      link.textContent = 'Si no se abrió, toca aquí para enviarlo por WhatsApp.';
      msg.appendChild(link);
    });
  }

  function initYear() {
    var y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  }

  function boot() {
    safe(initSplash, 'splash');
    safe(initNav, 'nav');
    safe(initReveal, 'reveal');
    safe(initCounters, 'counters');
    safe(initPointer, 'pointer');
    safe(initSimulator, 'simulator');
    safe(initContact, 'contact');
    safe(initYear, 'year');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
