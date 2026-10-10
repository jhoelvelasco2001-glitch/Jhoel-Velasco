/* Jhoel 1% — Moneda 3D del inicio (Three.js r128, IIFE)
   Si el navegador no tiene WebGL se queda la imagen del logo. */
(function () {
  'use strict';

  function start() {
    var mark = document.getElementById('heroMark');
    var canvas = document.getElementById('coin3d');
    if (!mark || !canvas || !window.THREE) return;
    var THREE = window.THREE;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { return; }
    if (!renderer.getContext()) return;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 7.8);

    /* ---------- Entorno para reflejos metálicos (generado, sin descargas) ---------- */
    var env = document.createElement('canvas');
    env.width = 1024; env.height = 512;
    var g = env.getContext('2d');
    var sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#05060a'); sky.addColorStop(.42, '#2a2112'); sky.addColorStop(.5, '#fff1c8');
    sky.addColorStop(.58, '#3a2a10'); sky.addColorStop(1, '#030305');
    g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
    function blob(x, y, r, color) {
      var rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, color); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    blob(220, 170, 160, 'rgba(255,236,190,.95)');
    blob(760, 140, 140, 'rgba(70,150,255,.85)');
    blob(560, 380, 180, 'rgba(255,200,110,.6)');
    blob(940, 300, 120, 'rgba(255,255,255,.7)');
    var envTex = new THREE.CanvasTexture(env);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    envTex.encoding = THREE.sRGBEncoding;
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(envTex).texture;
    envTex.dispose();

    /* ---------- Luces ---------- */
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    var key = new THREE.DirectionalLight(0xfff0d0, 1.6); key.position.set(3, 4, 6); scene.add(key);
    var rim = new THREE.PointLight(0x2f8bff, 2.4, 20); rim.position.set(-4, -1, -3); scene.add(rim);
    var warm = new THREE.PointLight(0xe9c46a, 1.4, 20); warm.position.set(4, -3, 3); scene.add(warm);

    /* ---------- Moneda ---------- */
    var R = 1.55, T = 0.24, FACE = R * 0.84;
    var coin = new THREE.Group();
    scene.add(coin);

    var gold = new THREE.MeshStandardMaterial({ color: 0xe0b552, metalness: 1, roughness: 0.22 });

    // Canto estriado
    var ridges = document.createElement('canvas');
    ridges.width = 1024; ridges.height = 8;
    var rc = ridges.getContext('2d');
    for (var i = 0; i < 1024; i += 8) { rc.fillStyle = '#fff'; rc.fillRect(i, 0, 4, 8); rc.fillStyle = '#000'; rc.fillRect(i + 4, 0, 4, 8); }
    var ridgeTex = new THREE.CanvasTexture(ridges);
    ridgeTex.wrapS = THREE.RepeatWrapping; ridgeTex.repeat.set(2, 1);
    var edgeMat = gold.clone(); edgeMat.bumpMap = ridgeTex; edgeMat.bumpScale = 0.02;
    var edge = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, 160, 1, true), edgeMat);
    edge.rotation.x = Math.PI / 2;
    coin.add(edge);

    // Aro dorado con bisel en ambas caras
    function rimAt(z, flip) {
      var ring = new THREE.Mesh(new THREE.RingGeometry(FACE, R, 160), gold);
      ring.position.z = z; if (flip) ring.rotation.y = Math.PI;
      coin.add(ring);
      var bevel = new THREE.Mesh(new THREE.TorusGeometry(FACE, 0.045, 20, 160), gold);
      bevel.position.z = z; coin.add(bevel);
      var outer = new THREE.Mesh(new THREE.TorusGeometry(R - 0.02, 0.03, 16, 160), gold);
      outer.position.z = z; coin.add(outer);
    }
    rimAt(T / 2, false);
    rimAt(-T / 2, true);

    // Caras con el logo
    var faceCanvas = document.createElement('canvas');
    faceCanvas.width = faceCanvas.height = 1024;
    var faceTex = new THREE.CanvasTexture(faceCanvas);
    faceTex.encoding = THREE.sRGBEncoding;
    faceTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    var faceMat = new THREE.MeshStandardMaterial({
      map: faceTex, emissiveMap: faceTex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.55,
      metalness: 0.55, roughness: 0.3
    });
    var front = new THREE.Mesh(new THREE.CircleGeometry(FACE, 160), faceMat);
    front.position.z = T / 2 - 0.002; coin.add(front);
    var back = new THREE.Mesh(new THREE.CircleGeometry(FACE, 160), faceMat);
    back.position.z = -T / 2 + 0.002; back.rotation.y = Math.PI; coin.add(back);

    var img = new Image();
    img.onload = function () {
      var c = faceCanvas.getContext('2d');
      var bg = c.createRadialGradient(512, 430, 60, 512, 512, 560);
      bg.addColorStop(0, '#12141c'); bg.addColorStop(1, '#030305');
      c.fillStyle = bg; c.fillRect(0, 0, 1024, 1024);
      var s = 880;
      c.drawImage(img, (1024 - s) / 2, (1024 - s) / 2 + 10, s, s);
      // anillo de puntos grabado
      c.strokeStyle = 'rgba(233,196,106,.35)'; c.lineWidth = 3;
      c.setLineDash([2, 14]); c.beginPath(); c.arc(512, 512, 488, 0, Math.PI * 2); c.stroke();
      faceTex.needsUpdate = true;
      mark.classList.add('has-3d');
    };
    img.src = (document.querySelector('#heroMark img') || {}).src || 'assets/img/logo.webp';

    /* ---------- Órbita con punto de luz ---------- */
    var orbit = new THREE.Group();
    var orbitRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.25, 0.006, 8, 240),
      new THREE.MeshBasicMaterial({ color: 0xe9c46a, transparent: true, opacity: 0.45 })
    );
    orbit.add(orbitRing);
    var spark = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 24), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));
    orbit.add(spark);
    var sparkLight = new THREE.PointLight(0xffe2a0, 1.2, 4); spark.add(sparkLight);
    orbit.rotation.set(1.15, 0.25, 0);
    scene.add(orbit);

    var orbit2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.55, 0.004, 8, 240),
      new THREE.MeshBasicMaterial({ color: 0x2f8bff, transparent: true, opacity: 0.35 })
    );
    orbit2.rotation.set(1.35, -0.45, 0);
    scene.add(orbit2);

    /* ---------- Tamaño, interacción y animación ---------- */
    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);

    var tx = 0, ty = 0, mx = 0, my = 0;
    window.addEventListener('pointermove', function (e) {
      var r = mark.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 0.9;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 0.6;
    }, { passive: true });

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(canvas);
    }
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var clock = new THREE.Clock();

    function loop() {
      requestAnimationFrame(loop);
      if (!visible) return;
      var t = clock.getElapsedTime();
      var speed = reduced ? 0.15 : 1;
      mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
      coin.rotation.y = Math.sin(t * 0.45 * speed) * 0.55 + mx;
      coin.rotation.x = Math.sin(t * 0.3 * speed) * 0.08 + my;
      coin.position.y = Math.sin(t * 0.9 * speed) * 0.08;
      var a = t * 0.7 * speed;
      spark.position.set(Math.cos(a) * 2.25, Math.sin(a) * 2.25, 0);
      orbit.rotation.z = t * 0.05;
      orbit2.rotation.z = -t * 0.04;
      renderer.render(scene, camera);
    }
    loop();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
