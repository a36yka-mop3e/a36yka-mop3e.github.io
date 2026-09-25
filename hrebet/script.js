// обычный скрипт, а не модуль: так страница открывается и с сайта, и двойным кликом с диска.
// three.js есть только модулем, поэтому подгружаем его через import().
// С сайта берём свою копию; с диска браузер её не отдаёт - тогда с cdn
(async () => {
  let THREE;
  try { THREE = await import("./three.module.js"); }
  catch (e) { THREE = await import("https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js"); }
  gsap.registerPlugin(ScrollTrigger);

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = window.matchMedia("(max-width: 767px)").matches;

  /* ---------- рельеф: хребет + шум ---------- */
  function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) {
    let sum = 0, amp = 1, f = 1;
    for (let i = 0; i < 4; i++) { sum += amp * noise(x * f, y * f); amp *= .5; f *= 2.03; }
    return sum / 1.875;
  }
  const ridgeX = z => 7 * Math.sin(z * .045) + 3 * Math.sin(z * .11 + 1);
  function height(x, z) {
    const d = x - ridgeX(z);
    const ridge = 11 * Math.exp(-d * d / 140) * (.75 + .25 * Math.sin(z * .07 + .5));
    return ridge + fbm(x * .06 + 10, z * .06) * 4.5 + fbm(x * .2, z * .2) * .8;
  }

  /* ---------- трасса: из посёлка на гребень, по гребню, вниз в долину ---------- */
  const smooth = t => t * t * (3 - 2 * t);
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const s = i / 60, z = 52 - s * 104;
    let off = 0;
    if (s < .22) off = 28 * (1 - smooth(s / .22));
    else if (s > .8) off = -26 * smooth((s - .8) / .2);
    const x = ridgeX(z) + off + Math.sin(s * 40) * .8;
    pts.push(new THREE.Vector3(x, height(x, z) + .3, z));
  }
  const route = new THREE.CatmullRomCurve3(pts);

  /* ---------- сцена ---------- */
  const canvas = document.getElementById("scene");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    document.querySelector(".hud").hidden = true; // без видеокарты остаётся просто красивый фон
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 400);

  const hex = h => new THREE.Vector3(...[1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255));
  const seg = small ? 130 : 230;
  const geo = new THREE.PlaneGeometry(150, 150, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  // горизонтали как на топокарте: тонкая каждые 0,8 ед. высоты, жирная каждые 4
  const terrain = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: {
      uInk: { value: hex("#22304a") }, uFill: { value: hex("#f1f3ef") }, uFog: { value: hex("#f6d7c3") },
      uNear: { value: 40 }, uFar: { value: 150 }
    },
    vertexShader: `
      varying float vH; varying float vD; varying vec3 vN;
      void main() {
        vH = position.y; vN = normal;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vD = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uInk, uFill, uFog; uniform float uNear, uFar;
      varying float vH; varying float vD; varying vec3 vN;
      float contour(float v, float w) {
        float f = abs(fract(v - 0.5) - 0.5) / fwidth(v);
        return 1.0 - min(f / w, 1.0);
      }
      void main() {
        float minor = contour(vH * 1.25, 1.0);
        float major = contour(vH * 0.25, 1.7);
        float light = clamp(dot(normalize(vN), normalize(vec3(-0.4, 0.8, 0.5))), 0.0, 1.0);
        vec3 col = uFill * (0.86 + 0.14 * light);
        col = mix(col, uInk, minor * 0.32 + major * 0.8);
        gl_FragColor = vec4(mix(col, uFog, smoothstep(uNear, uFar, vD)), 1.0);
      }`
  }));
  scene.add(terrain);

  // вся трасса пунктиром, пройденная часть - яркой трубкой
  const preview = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(route.getPoints(500)),
    new THREE.LineDashedMaterial({ color: 0x22304a, dashSize: .6, gapSize: .5, transparent: true, opacity: .55 })
  );
  preview.computeLineDistances();
  scene.add(preview);

  const TUBE_SEG = 600, RADIAL = 8;
  const tube = new THREE.Mesh(new THREE.TubeGeometry(route, TUBE_SEG, .15, RADIAL), new THREE.MeshBasicMaterial({ color: 0xff5a1f }));
  scene.add(tube);

  const runner = new THREE.Mesh(new THREE.SphereGeometry(.55, 20, 20), new THREE.MeshBasicMaterial({ color: 0xff5a1f }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 20), new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: .25 }));
  scene.add(runner, halo);

  // флажки контрольных точек
  const KM = [0, 9, 21, 36, 42];
  KM.forEach(km => {
    const p = route.getPointAt(km / 42);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 3.2), new THREE.MeshBasicMaterial({ color: 0x22304a }));
    pole.position.set(p.x, p.y + 1.6, p.z);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .7), new THREE.MeshBasicMaterial({ color: 0xff5a1f, side: THREE.DoubleSide }));
    flag.position.set(p.x + .55, p.y + 2.8, p.z);
    scene.add(pole, flag);
  });

  /* ---------- профиль высот внизу ---------- */
  const N = 120, heights = [];
  for (let i = 0; i <= N; i++) heights.push(route.getPointAt(i / N).y);
  const hMin = Math.min(...heights), hMax = Math.max(...heights);
  const py = h => 56 - (h - hMin) / (hMax - hMin) * 50;
  const line = heights.map((h, i) => `${i ? "L" : "M"}${(i / N * 300).toFixed(1)} ${py(h).toFixed(1)}`).join(" ");
  const prof = document.getElementById("profile");
  prof.querySelector(".line").setAttribute("d", line);
  prof.querySelector(".done").setAttribute("d", line);
  prof.querySelector(".area").setAttribute("d", line + " L300 60 L0 60Z");
  const done = prof.querySelector(".done"), dot = document.getElementById("dot");
  const kmEl = document.getElementById("km"), altEl = document.getElementById("alt");
  const toMeters = h => Math.round(1150 + h * 105);

  /* ---------- прокрутка ведёт камеру по трассе ---------- */
  // ov = 1: вид сверху на весь хребет, ov = 0: камера за бегуном
  const state = { p: 0, ov: 1 };
  gsap.timeline({
    defaults: { ease: "none", duration: 1 },
    scrollTrigger: { trigger: "#story", start: "top top", end: "bottom bottom", scrub: 1 }
  })
    .to(state, { ov: 0, p: 0 })
    .to(state, { p: 9 / 42 })
    .to(state, { p: 21 / 42 })
    .to(state, { p: 36 / 42 })
    .to(state, { p: 1, ov: .6 });

  const camPos = new THREE.Vector3(0, 70, 95), camLook = new THREE.Vector3();
  const OVER_POS = new THREE.Vector3(8, 62, 88), OVER_LOOK = new THREE.Vector3(0, 0, -5);
  const tPos = new THREE.Vector3(), tLook = new THREE.Vector3();

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 768 ? 60 : 45;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  const clock = new THREE.Clock();
  let lastKm = "";
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    const p = Math.min(Math.max(state.p, 0), 1);
    const pt = route.getPointAt(p);
    const tan = route.getTangentAt(p);
    const ahead = route.getPointAt(Math.min(p + .06, 1));

    // точка за спиной бегуна и чуть сверху, смешанная с общим видом
    tPos.copy(pt).addScaledVector(tan, -15).add(new THREE.Vector3(-4, 9, 0)).lerp(OVER_POS, state.ov);
    tLook.copy(ahead).lerp(OVER_LOOK, state.ov);
    if (!reduced) tPos.x += Math.sin(t * .3) * .6;
    camPos.lerp(tPos, .08);
    camLook.lerp(tLook, .08);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    tube.geometry.setDrawRange(0, Math.floor(p * TUBE_SEG) * RADIAL * 6);
    runner.position.copy(pt);
    halo.position.copy(pt);
    halo.scale.setScalar(reduced ? 1.4 : 1.2 + Math.sin(t * 3) * .35);

    const km = (p * 42).toFixed(1).replace(".", ",");
    if (km !== lastKm) {
      lastKm = km;
      kmEl.textContent = km;
      altEl.textContent = toMeters(pt.y).toLocaleString("ru-RU");
      done.style.strokeDasharray = `${p} 1`;
      dot.style.left = p * 100 + "%";
      dot.style.top = py(pt.y) / 60 * 100 + "%";
    }
    renderer.render(scene, camera);
  });

  /* ---------- текст ---------- */
  if (!reduced) {
    gsap.from(".hero h1 span, .kicker, .lead", { y: 50, opacity: 0, stagger: .1, duration: 1.1, ease: "power4.out", delay: .2 });
    document.querySelectorAll(".chapter").forEach(ch => {
      gsap.from(ch.children, {
        y: 40, opacity: 0, stagger: .08, duration: .7, ease: "power3.out",
        scrollTrigger: { trigger: ch, start: "top 65%", toggleActions: "play none none reverse" }
      });
    });
  }
})();
