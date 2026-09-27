/* Jhoel Velasco — interacciones. IIFE clásico, sin módulos. */
(function () {
  "use strict";

  function safe(fn, name) {
    try { fn(); } catch (e) { console.warn("[init " + name + "]", e); }
  }

  // Degradado que sigue al cursor (hero y contacto)
  function initMouseGradient() {
    var targets = document.querySelectorAll("[data-mouse-gradient]");
    if (!targets.length || matchMedia("(hover: none)").matches) return;
    var raf = null, x = 70, y = 40;
    document.addEventListener("mousemove", function (e) {
      x = (e.clientX / window.innerWidth) * 100;
      y = (e.clientY / window.innerHeight) * 100;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        targets.forEach(function (t) {
          t.style.setProperty("--mx", x + "%");
          t.style.setProperty("--my", y + "%");
        });
        raf = null;
      });
    });
  }

  // Nav con fondo al hacer scroll
  function initNav() {
    var nav = document.querySelector(".nav");
    if (!nav) return;
    var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 40); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Aparición al hacer scroll + red de seguridad de 6s
  function initReveal() {
    var els = document.querySelectorAll(".reveal:not([data-split])");
    var show = function (el) { el.classList.add("is-visible"); };
    if (!("IntersectionObserver" in window)) { els.forEach(show); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { show(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -40px 0px" });
    els.forEach(function (el) { io.observe(el); });
    setTimeout(function () { els.forEach(show); }, 6000);
  }

  // Contadores animados
  function initCountUp() {
    var nums = document.querySelectorAll("[data-count]");
    if (!nums.length || !("IntersectionObserver" in window)) return;
    var run = function (el) {
      var end = parseInt(el.getAttribute("data-count"), 10);
      var start = performance.now(), dur = 1600;
      var step = function (now) {
        var p = Math.min((now - start) / dur, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      el.textContent = "0";
      requestAnimationFrame(step);
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.05 });
    nums.forEach(function (n) { io.observe(n); });
  }

  // Inclinación 3D suave en los certificados
  function initTilt() {
    if (matchMedia("(hover: none)").matches) return;
    document.querySelectorAll("[data-tilt]").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = "perspective(900px) rotateY(" + (px * 7) + "deg) rotateX(" + (-py * 7) + "deg) translateY(-4px)";
      });
      card.addEventListener("mouseleave", function () { card.style.transform = ""; });
    });
  }

  function initYear() {
    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }

  function boot() {
    safe(initMouseGradient, "mouseGradient");
    safe(initNav, "nav");
    safe(initReveal, "reveal");
    safe(initCountUp, "countUp");
    safe(initTilt, "tilt");
    safe(initYear, "year");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
