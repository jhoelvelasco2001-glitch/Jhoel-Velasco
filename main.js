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
    // Dirección del servidor de cuentas (backend). Mientras esté vacía, el registro
    // se envía como solicitud por WhatsApp y el inicio de sesión muestra un aviso.
    authApi: '',
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
      if (!d.get('acepto')) { msg.textContent = 'Debes aceptar los Términos y Condiciones para continuar.'; msg.classList.add('is-error'); return; }

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

  function initTerms() {
    var btn = document.getElementById('termsToggle');
    var items = [].slice.call(document.querySelectorAll('.clause'));
    if (!btn || !items.length) return;
    btn.addEventListener('click', function () {
      var open = items.some(function (d) { return !d.open; });
      items.forEach(function (d) { d.open = open; });
      btn.textContent = open ? 'Cerrar todas las cláusulas' : 'Abrir todas las cláusulas';
    });
  }

  /* ---------- Idiomas (Google Translate con selector propio) ---------- */
  var LANG_KEY = 'googtrans';

  function readLang() {
    var m = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/]+\/([^;]+)/);
    return m ? decodeURIComponent(m[1]) : 'es';
  }

  function writeLang(code) {
    var host = location.hostname;
    var expire = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
    [ '', ';domain=' + host, ';domain=.' + host.replace(/^www\./, '') ].forEach(function (d) {
      document.cookie = LANG_KEY + '=;' + expire + ';path=/' + d;
    });
    if (code !== 'es') {
      document.cookie = LANG_KEY + '=/es/' + code + ';path=/';
      if (host.indexOf('.') > -1) document.cookie = LANG_KEY + '=/es/' + code + ';path=/;domain=.' + host.replace(/^www\./, '');
    }
  }

  function loadTranslator(onFail) {
    if (document.getElementById('gtScript')) return;
    window.googleTranslateElementInit = function () {
      /* global google */
      new google.translate.TranslateElement({ pageLanguage: 'es', autoDisplay: false }, 'google_translate_element');
    };
    var s = document.createElement('script');
    s.id = 'gtScript';
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.onerror = onFail;
    document.body.appendChild(s);
  }

  function toast(text) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); }, 3800);
    setTimeout(function () { t.remove(); }, 4400);
  }

  function initLang() {
    var wrap = document.getElementById('lang');
    var btn = document.getElementById('langBtn');
    var menu = document.getElementById('langMenu');
    var code = document.getElementById('langCode');
    if (!wrap || !btn || !menu) return;

    var current = readLang();
    var label = current.split('-')[0].toUpperCase();
    code.textContent = label;
    [].slice.call(menu.querySelectorAll('[data-lang]')).forEach(function (b) {
      b.setAttribute('aria-selected', b.getAttribute('data-lang') === current ? 'true' : 'false');
    });
    var fail = function () { toast('No se pudo cargar el traductor. Revisa tu conexión e inténtalo de nuevo.'); };
    if (current !== 'es') loadTranslator(fail);

    function close() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { var sel = menu.querySelector('[aria-selected="true"]') || menu.querySelector('button'); sel.focus(); }
    });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { close(); btn.focus(); } });

    menu.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lang]');
      if (!b) return;
      var lang = b.getAttribute('data-lang');
      close();
      if (lang === current) return;
      writeLang(lang);
      location.reload();
    });
  }

  /* ---------- Acceso: iniciar sesión / registrarse ---------- */
  function initAuth() {
    var modal = document.getElementById('auth');
    if (!modal) return;
    var forms = [].slice.call(modal.querySelectorAll('.auth__form'));
    var lastFocus = null;

    function show(view) {
      forms.forEach(function (f) {
        f.hidden = f.getAttribute('data-view') !== view;
        var m = f.querySelector('.auth__msg');
        if (m) { m.textContent = ''; m.classList.remove('is-error'); }
      });
      var active = modal.querySelector('.auth__form:not([hidden]) input');
      if (active) setTimeout(function () { active.focus(); }, 60);
    }
    function open(view) {
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.body.classList.add('auth-open');
      show(view);
      var nav = document.getElementById('nav');
      if (nav && nav.classList.contains('is-open')) document.getElementById('navToggle').click();
    }
    function close() {
      modal.hidden = true;
      document.body.classList.remove('auth-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-auth]');
      if (trigger) {
        e.preventDefault();
        var view = trigger.getAttribute('data-auth');
        if (modal.hidden) open(view); else show(view);
        return;
      }
      if (e.target.closest('[data-auth-close]')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) close();
    });

    [].slice.call(modal.querySelectorAll('.pw__toggle')).forEach(function (t) {
      t.addEventListener('click', function () {
        var input = t.previousElementSibling;
        var showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        t.textContent = showing ? 'Ver' : 'Ocultar';
        t.setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');
      });
    });

    var regPass = document.getElementById('regPass');
    var meter = modal.querySelector('.pw__meter i');
    function strength(p) {
      var s = 0;
      if (p.length >= 8) s++;
      if (/[A-Z]/.test(p)) s++;
      if (/\d/.test(p)) s++;
      if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++;
      return s;
    }
    if (regPass && meter) {
      regPass.addEventListener('input', function () {
        var s = strength(regPass.value);
        meter.style.width = (s * 25) + '%';
        meter.style.background = s <= 1 ? '#ff8a7a' : s === 2 ? '#e9c46a' : '#5fd38d';
      });
    }

    function fail(form, msg, field) {
      var m = form.querySelector('.auth__msg');
      m.textContent = msg; m.classList.add('is-error');
      if (field) { field.classList.add('is-invalid'); field.focus(); }
      return false;
    }
    function ok(form, msg) {
      var m = form.querySelector('.auth__msg');
      m.classList.remove('is-error');
      m.textContent = msg;
      return m;
    }
    modal.addEventListener('input', function (e) { e.target.classList && e.target.classList.remove('is-invalid'); });

    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    function waLink(text) { return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text); }
    function appendLink(m, href, label) {
      var a = document.createElement('a');
      a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = label;
      m.appendChild(document.createTextNode(' '));
      m.appendChild(a);
    }

    // Iniciar sesión
    var login = document.getElementById('loginForm');
    login.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('loginEmail');
      var pass = document.getElementById('loginPass');
      if (!emailRe.test(email.value.trim())) return fail(login, 'Escribe un correo electrónico válido.', email);
      if (pass.value.length < 8) return fail(login, 'La contraseña tiene al menos 8 caracteres.', pass);
      if (!CONFIG.authApi) {
        var m = ok(login, 'El panel de inversionistas se habilitará muy pronto. Te avisaremos por WhatsApp.');
        appendLink(m, waLink('Hola, quiero información sobre el acceso a mi cuenta Jhoel 1%. Correo: ' + email.value.trim()), 'Escríbenos');
        return;
      }
      // Cuando exista el backend: POST CONFIG.authApi + '/login'
    });

    // Registrarse
    var reg = document.getElementById('registerForm');
    reg.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = function (id) { return document.getElementById(id); };
      var first = f('regFirst'), last = f('regLast'), email = f('regEmail'), country = f('regCountry'),
          phone = f('regPhone'), pass = f('regPass'), ref = f('regRef');
      if (!first.value.trim()) return fail(reg, 'Escribe tus nombres.', first);
      if (!last.value.trim()) return fail(reg, 'Escribe tus apellidos.', last);
      if (!emailRe.test(email.value.trim())) return fail(reg, 'Escribe un correo electrónico válido.', email);
      if (!country.value) return fail(reg, 'Selecciona tu país.', country);
      if (phone.value.replace(/\D/g, '').length < 8) return fail(reg, 'Escribe tu número de WhatsApp con código de país.', phone);
      if (strength(pass.value) < 3) return fail(reg, 'La contraseña necesita 8 caracteres, una mayúscula y un número.', pass);
      if (!f('regAdult').checked) return fail(reg, 'Debes ser mayor de 18 años para registrarte.');
      if (!f('regTerms').checked) return fail(reg, 'Debes aceptar los Términos y Condiciones.');

      if (!CONFIG.authApi) {
        // Sin backend: se envía la solicitud por WhatsApp (nunca la contraseña).
        var text = 'Hola, quiero crear mi cuenta en Jhoel 1%.\n' +
          'Nombre: ' + first.value.trim() + ' ' + last.value.trim() + '\n' +
          'Correo: ' + email.value.trim() + '\n' +
          'País: ' + country.value + '\n' +
          'WhatsApp: ' + phone.value.trim() +
          (ref.value.trim() ? '\nCódigo de referido: ' + ref.value.trim() : '');
        var url = waLink(text);
        var win = window.open(url, '_blank', 'noopener');
        var m = ok(reg, '¡Gracias, ' + first.value.trim() + '! Confirma tu solicitud por WhatsApp y activaremos tu cuenta tras verificar tu identidad.');
        if (!win) appendLink(m, url, 'Enviar por WhatsApp');
        return;
      }
      // Cuando exista el backend: POST CONFIG.authApi + '/register'
    });

    // Recuperar contraseña
    var forgot = document.getElementById('forgotForm');
    forgot.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('forgotEmail');
      if (!emailRe.test(email.value.trim())) return fail(forgot, 'Escribe un correo electrónico válido.', email);
      var m = ok(forgot, 'Si el correo está registrado, recibirás las instrucciones en unos minutos.');
      if (!CONFIG.authApi) appendLink(m, waLink('Hola, necesito recuperar el acceso a mi cuenta Jhoel 1%. Correo: ' + email.value.trim()), 'O escríbenos por WhatsApp');
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
    safe(initTerms, 'terms');
    safe(initLang, 'lang');
    safe(initAuth, 'auth');
    safe(initYear, 'year');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
