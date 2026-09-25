// обычный скрипт, а не модуль: так страница открывается и с сайта, и двойным кликом с диска.
// three.js есть только модулем, поэтому подгружаем его через import().
// С сайта берём свою копию; с диска браузер её не отдаёт - тогда с cdn
gsap.registerPlugin(ScrollTrigger);
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const small = window.matchMedia("(max-width: 767px)").matches;

/* ================= рельеф и трасса (нужны и 3D, и профилям дистанций) ================= */
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
const smooth = t => t * t * (3 - 2 * t);
function routeXZ(s) {
  const z = 52 - s * 104;
  let off = 0;
  if (s < .22) off = 28 * (1 - smooth(s / .22));
  else if (s > .8) off = -26 * smooth((s - .8) / .2);
  return [ridgeX(z) + off + Math.sin(s * 40) * .8, z];
}
// высоты вдоль трассы с равным шагом (для профилей), пересчёт в метры
const PROF_N = 160;
const profH = [];
for (let i = 0; i <= PROF_N; i++) { const [x, z] = routeXZ(i / PROF_N); profH.push(height(x, z)); }
const hMin = Math.min(...profH), hMax = Math.max(...profH);
const toMeters = h => Math.round(1050 + (h - hMin) / (hMax - hMin) * 1420); // вершина = 2 470 м

function profilePath(from, to, w, h, pad) {
  const i0 = Math.round(from * PROF_N), i1 = Math.round(to * PROF_N);
  const seg = profH.slice(i0, i1 + 1), lo = Math.min(...seg), hi = Math.max(...seg);
  const py = v => h - pad - (v - lo) / Math.max(hi - lo, 1) * (h - pad * 2);
  return seg.map((v, i) => `${i ? "L" : "M"}${(i / (seg.length - 1) * w).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");
}

/* ================= разделы под полётом ================= */
// профили дистанций
document.querySelectorAll(".dist").forEach(card => {
  const d = profilePath(+card.dataset.from, +card.dataset.to, 300, 70, 6);
  card.querySelector(".line").setAttribute("d", d);
  card.querySelector(".area").setAttribute("d", d + " L300 70 L0 70Z");
});

// регистрация: выбор дистанции
const PRICES = { 42: "6 500 ₽", 21: "4 500 ₽", 10: "2 500 ₽" };
const regPrice = document.getElementById("regPrice");
function pick(d) {
  document.querySelectorAll(".reg-pick button").forEach(b => b.setAttribute("aria-pressed", b.dataset.d === d));
  if (regPrice.textContent === PRICES[d]) return;
  regPrice.textContent = PRICES[d];
  gsap.fromTo(regPrice, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .35, ease: "power3.out" });
}
document.querySelectorAll(".reg-pick button").forEach(b => b.addEventListener("click", () => pick(b.dataset.d)));
document.querySelectorAll("[data-pick]").forEach(a => a.addEventListener("click", () => pick(a.dataset.pick)));

const toastEl = document.getElementById("toast");
let toastTimer;
document.getElementById("regBtn").addEventListener("click", () => {
  toastEl.textContent = "Это концепт сайта: регистрация здесь не работает";
  toastEl.hidden = false;
  gsap.fromTo(toastEl, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .35, ease: "back.out(1.7)" });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => gsap.to(toastEl, { opacity: 0, duration: .25, onComplete: () => { toastEl.hidden = true; } }), 2600);
});

// рюкзак
const packBtns = [...document.querySelectorAll("#packItems button")];
const packN = document.getElementById("packN"), packW = document.getElementById("packW");
const packMsg = document.getElementById("packMsg"), bagFill = document.getElementById("bagFill");
const TOTAL_G = packBtns.reduce((s, b) => s + +b.dataset.g, 0);
packBtns.forEach(b => {
  b.setAttribute("aria-pressed", "false");
  b.addEventListener("click", () => {
    b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true");
    const on = packBtns.filter(x => x.getAttribute("aria-pressed") === "true");
    const g = on.reduce((s, x) => s + +x.dataset.g, 0);
    packN.textContent = on.length;
    gsap.to(packW, { textContent: g, duration: .4, snap: { textContent: 10 }, ease: "power2.out" });
    gsap.to(bagFill, { scaleY: g / TOTAL_G, duration: .5, ease: "back.out(1.4)" });
    const done = on.length === packBtns.length;
    packMsg.textContent = done ? "Рюкзак собран, на старт пустят" : `Не хватает: ${packBtns.length - on.length}`;
    packMsg.classList.toggle("ok", done);
    if (done) gsap.fromTo("#bag", { rotation: -6 }, { rotation: 0, duration: .8, ease: "elastic.out(1, .3)" });
  });
});

if (!reduced) {
  gsap.from(".hero h1 span, .kicker, .lead, .stats div", { y: 40, opacity: 0, stagger: .08, duration: 1, ease: "power4.out", delay: .2 });
  document.querySelectorAll(".chapter").forEach(ch => {
    gsap.from(ch.children, {
      y: 40, opacity: 0, stagger: .07, duration: .7, ease: "power3.out",
      scrollTrigger: { trigger: ch, start: "top 65%", toggleActions: "play none none reverse" }
    });
  });
  gsap.utils.toArray(".block").forEach(b => gsap.from(b.children, {
    y: 30, opacity: 0, stagger: .08, duration: .8, ease: "power3.out",
    scrollTrigger: { trigger: b, start: "top 80%", once: true }
  }));
  gsap.from(".dist", { y: 50, opacity: 0, stagger: .12, duration: .8, ease: "power3.out", scrollTrigger: { trigger: ".dist-grid", start: "top 85%", once: true } });
  // линия расписания прорисовывается прокруткой
  const tl = document.querySelector(".timeline");
  const rail = document.createElement("span"); rail.className = "rail"; tl.prepend(rail);
  gsap.fromTo(rail, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: tl, start: "top 70%", end: "bottom 60%", scrub: true } });
  gsap.from(".timeline li", { x: -24, opacity: 0, stagger: .08, duration: .6, ease: "power3.out", scrollTrigger: { trigger: tl, start: "top 75%", once: true } });
  gsap.from(".tier", { y: 30, opacity: 0, stagger: .1, duration: .6, scrollTrigger: { trigger: ".tiers", start: "top 85%", once: true } });
}

/* ================= 3D ================= */
(async () => {
  let THREE;
  try { THREE = await import("./three.module.js"); }
  catch (e) { THREE = await import("https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js"); }

  const pts = [];
  for (let i = 0; i <= 60; i++) { const [x, z] = routeXZ(i / 60); pts.push(new THREE.Vector3(x, height(x, z) + .3, z)); }
  const route = new THREE.CatmullRomCurve3(pts);
  const routeSamples = route.getSpacedPoints(240);

  const canvas = document.getElementById("scene");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    document.querySelector(".hud").hidden = true; // без видеокарты остаётся красивый фон и весь текст
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 400);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c2b0, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1e0, 1.4); sun.position.set(-30, 50, 20); scene.add(sun);

  const hex = h => new THREE.Vector3(...[1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255));
  const seg = small ? 130 : 230;
  const geo = new THREE.PlaneGeometry(150, 150, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const all = [];
  for (let i = 0; i < pos.count; i++) { const y = height(pos.getX(i), pos.getZ(i)); pos.setY(i, y); all.push(y); }
  geo.computeVertexNormals();
  all.sort((a, b) => a - b);
  const WATER = all[Math.floor(all.length * .07)], SNOW = all[Math.floor(all.length * .985)];

  // горизонтали как на топокарте + озеро в низинах + снег на вершине
  const terrain = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: {
      uInk: { value: hex("#22304a") }, uLow: { value: hex("#e4eadd") }, uHigh: { value: hex("#f3f4f0") },
      uWaterC: { value: hex("#bcd3e3") }, uFog: { value: hex("#f6d7c3") },
      uWater: { value: WATER }, uSnow: { value: SNOW }, uNear: { value: 40 }, uFar: { value: 150 }
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
      uniform vec3 uInk, uLow, uHigh, uWaterC, uFog; uniform float uWater, uSnow, uNear, uFar;
      varying float vH; varying float vD; varying vec3 vN;
      float contour(float v, float w) {
        float f = abs(fract(v - 0.5) - 0.5) / fwidth(v);
        return 1.0 - min(f / w, 1.0);
      }
      void main() {
        float light = clamp(dot(normalize(vN), normalize(vec3(-0.4, 0.8, 0.5))), 0.0, 1.0);
        vec3 fill = mix(uLow, uHigh, smoothstep(2.0, 9.0, vH));
        fill = mix(fill, vec3(1.0), smoothstep(uSnow - 0.6, uSnow + 0.3, vH));
        vec3 col = fill * (0.86 + 0.14 * light);
        float minor = contour(vH * 1.25, 1.0);
        float major = contour(vH * 0.25, 1.7);
        col = mix(col, uInk, minor * 0.3 + major * 0.75);
        if (vH < uWater) {
          float ripple = contour(vH * 6.0, 1.0);
          col = mix(uWaterC, vec3(1.0), ripple * 0.35);
        }
        gl_FragColor = vec4(mix(col, uFog, smoothstep(uNear, uFar, vD)), 1.0);
      }`
  }));
  scene.add(terrain);

  // лес: конусы на склонах ниже гребня, не на тропе и не в озере
  const nearRoute = (x, z, r) => routeSamples.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < r * r);
  const TREES = small ? 700 : 1600;
  const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(.42, 1.3, 6), new THREE.MeshLambertMaterial({ color: 0x3f5e4c }), TREES);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), tp = new THREE.Vector3();
  let placed = 0, tries = 0;
  while (placed < TREES && tries < TREES * 12) {
    tries++;
    const x = (hash(tries, 1.3) - .5) * 140, z = (hash(2.7, tries) - .5) * 140;
    const y = height(x, z);
    const slope = Math.abs(height(x + .8, z) - y) + Math.abs(height(x, z + .8) - y);
    if (y < WATER + .4 || y > 8.5 || slope > 1.6 || hash(x, z) > .75 || nearRoute(x, z, 1.8)) continue;
    const s = .7 + hash(z, x) * .7;
    m4.compose(tp.set(x, y + .55 * s, z), q, sc.set(s, s, s));
    trees.setMatrixAt(placed++, m4);
  }
  trees.count = placed;
  scene.add(trees);

  // посёлок у старта
  const start = route.getPointAt(0);
  const houseGeo = new THREE.BoxGeometry(1, .7, .8), roofGeo = new THREE.ConeGeometry(.78, .55, 4);
  roofGeo.rotateY(Math.PI / 4);
  const wall = new THREE.MeshLambertMaterial({ color: 0xffffff }), roof = new THREE.MeshLambertMaterial({ color: 0x22304a });
  for (let i = 0, n = 0; n < 16 && i < 200; i++) {
    const a = hash(i, 9.1) * Math.PI * 2, r = 2.5 + hash(9.1, i) * 6;
    const x = start.x + Math.cos(a) * r, z = start.z + Math.sin(a) * r + 2;
    if (nearRoute(x, z, 1.4)) continue;
    const y = height(x, z);
    const h = new THREE.Mesh(houseGeo, wall), rf = new THREE.Mesh(roofGeo, roof);
    h.position.set(x, y + .35, z); rf.position.set(x, y + .97, z);
    h.rotation.y = rf.rotation.y = hash(i, i) * Math.PI;
    scene.add(h, rf); n++;
  }

  // облака: мягкие пятна на уровне гребня, медленно плывут
  const cc = document.createElement("canvas"); cc.width = cc.height = 128;
  const cx = cc.getContext("2d"), grd = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  cx.fillStyle = grd; cx.fillRect(0, 0, 128, 128);
  const cloudTex = new THREE.CanvasTexture(cc);
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: .55 + hash(i, 3) * .3, depthWrite: false }));
    const s = 14 + hash(i, 4) * 18;
    sp.scale.set(s * 1.8, s * .7, 1);
    sp.position.set((hash(i, 5) - .5) * 150, 11 + hash(i, 6) * 5, (hash(i, 7) - .5) * 130);
    scene.add(sp); clouds.push(sp);
  }

  // трасса: пунктир целиком, пройденная часть - яркой трубкой
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

  // остальные участники бегут сами по себе, каждый в своём темпе
  const PACK = 34;
  const others = new THREE.InstancedMesh(new THREE.SphereGeometry(.26, 10, 10), new THREE.MeshBasicMaterial({ color: 0xff9a70 }), PACK);
  const othersData = Array.from({ length: PACK }, (_, i) => ({ u: hash(i, 11), v: .004 + hash(11, i) * .006 }));
  scene.add(others);

  // контрольные пункты: флажки в 3D и подписи поверх
  const CPS = [
    { km: 0, name: "Старт · Сосновка" }, { km: 9, name: "КП-1 · Лесной кордон" },
    { km: 21, name: "КП-2 · перевал Кедровый" }, { km: 36, name: "КП-3 · Курумник" }, { km: 42, name: "Финиш · Озёрный" }
  ];
  const labelsBox = document.getElementById("labels");
  CPS.forEach(cp => {
    const p = route.getPointAt(cp.km / 42);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 3.2), new THREE.MeshBasicMaterial({ color: 0x22304a }));
    pole.position.set(p.x, p.y + 1.6, p.z);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .7), new THREE.MeshBasicMaterial({ color: 0xff5a1f, side: THREE.DoubleSide }));
    flag.position.set(p.x + .55, p.y + 2.8, p.z);
    scene.add(pole, flag);
    cp.anchor = new THREE.Vector3(p.x, p.y + 3.4, p.z);
    cp.el = document.createElement("div");
    cp.el.className = "cp";
    cp.el.innerHTML = `${cp.name} <b>${toMeters(p.y - .3).toLocaleString("ru-RU")} м</b>`;
    labelsBox.appendChild(cp.el);
  });

  /* ---------- профиль высот в приборной панели ---------- */
  const py = h => 56 - (h - hMin) / (hMax - hMin) * 50;
  const line = profH.map((h, i) => `${i ? "L" : "M"}${(i / PROF_N * 300).toFixed(1)} ${py(h).toFixed(1)}`).join(" ");
  const prof = document.getElementById("profile");
  prof.querySelector(".line").setAttribute("d", line);
  prof.querySelector(".done").setAttribute("d", line);
  prof.querySelector(".area").setAttribute("d", line + " L300 60 L0 60Z");
  const done = prof.querySelector(".done"), dot = document.getElementById("dot");
  const kmEl = document.getElementById("km"), altEl = document.getElementById("alt");

  /* ---------- прокрутка ведёт камеру по трассе ---------- */
  // ov = 1: вид сверху на весь хребет, ov = 0: камера за бегуном
  const state = { p: 0, ov: 1 };
  gsap.timeline({
    defaults: { ease: "none", duration: 1 },
    scrollTrigger: { trigger: "#flight", start: "top top", end: "bottom bottom", scrub: 1 }
  })
    .to(state, { ov: 0, p: 0 })
    .to(state, { p: 9 / 42 })
    .to(state, { p: 21 / 42 })
    .to(state, { p: 36 / 42 })
    .to(state, { p: 1, ov: .45 });

  // когда лист с разделами закрыл экран, 3D не рисуем - бережём батарею и слабые ноутбуки
  let paused = false;
  ScrollTrigger.create({
    trigger: "#content", start: "top 40%",
    onEnter: () => document.body.classList.add("past"),
    onLeaveBack: () => document.body.classList.remove("past")
  });
  ScrollTrigger.create({
    trigger: "#content", start: "top top",
    onEnter: () => { paused = true; }, onLeaveBack: () => { paused = false; }
  });

  const camPos = new THREE.Vector3(8, 62, 88), camLook = new THREE.Vector3();
  const OVER_POS = new THREE.Vector3(8, 62, 88), OVER_LOOK = new THREE.Vector3(0, 0, -5);
  const tPos = new THREE.Vector3(), tLook = new THREE.Vector3(), UP = new THREE.Vector3(-4, 9, 0), v = new THREE.Vector3();

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
    const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
    if (paused) return;
    const p = Math.min(Math.max(state.p, 0), 1);
    const pt = route.getPointAt(p), tan = route.getTangentAt(p);
    const ahead = route.getPointAt(Math.min(p + .06, 1));

    tPos.copy(pt).addScaledVector(tan, -15).add(UP).lerp(OVER_POS, state.ov);
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

    if (!reduced) {
      othersData.forEach((o, i) => {
        o.u = (o.u + o.v * dt) % 1;
        const op = route.getPointAt(o.u).add(v.set(0, .15, 0));
        // вплотную к камере бегуны раздуваются в кляксы - таких прячем
        const s = op.distanceTo(camera.position) < 12 ? 0 : 1;
        m4.compose(op, q, sc.set(s, s, s));
        others.setMatrixAt(i, m4);
      });
      others.instanceMatrix.needsUpdate = true;
      clouds.forEach((c, i) => { c.position.x += dt * (.4 + i % 3 * .2); if (c.position.x > 85) c.position.x = -85; });
    }

    // подписи КП: переводим точку из 3D в координаты экрана
    const W = window.innerWidth, H = window.innerHeight;
    CPS.forEach(cp => {
      v.copy(cp.anchor).project(camera);
      const dist = camera.position.distanceTo(cp.anchor);
      const show = v.z < 1 && dist < 70 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      cp.el.style.opacity = show ? Math.min(1, (70 - dist) / 20) : 0;
      if (show) cp.el.style.transform = `translate(${(v.x * .5 + .5) * W}px, ${(-v.y * .5 + .5) * H}px) translate(-50%, -100%)`;
    });

    const km = (p * 42).toFixed(1).replace(".", ",");
    if (km !== lastKm) {
      lastKm = km;
      kmEl.textContent = km;
      altEl.textContent = toMeters(pt.y - .3).toLocaleString("ru-RU");
      done.style.strokeDasharray = `${p} 1`;
      dot.style.left = p * 100 + "%";
      dot.style.top = py(pt.y - .3) / 60 * 100 + "%";
    }
    renderer.render(scene, camera);
  });
})();
