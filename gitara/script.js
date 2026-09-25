gsap.registerPlugin(ScrollTrigger);

const SVG_NS = "http://www.w3.org/2000/svg";
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- слова заголовков в обёртки, чтобы они выезжали из-под маски ---------- */
document.querySelectorAll(".split").forEach(el => {
  el.innerHTML = el.textContent.trim().split(/\s+/)
    .map(w => `<span class="w"><span>${w}</span></span>`).join(" ");
});

/* ---------- струны ---------- */
// ноты открытых струн, от шестой к первой
const NOTES = [82.41, 110, 146.83, 196, 246.94, 329.63];
const svg = document.getElementById("strings");
let W = 0, H = 0;
const strings = NOTES.map((freq, i) => {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("stroke-width", (3.4 - i * 0.45).toFixed(2));
  svg.appendChild(path);
  return { freq, path, y: 0, amp: 0, cx: 0 };
});

const heroText = document.querySelector(".hero-text");
const soundhole = document.querySelector(".soundhole");

function layoutStrings() {
  W = svg.clientWidth; H = svg.clientHeight;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  // струны всегда под текстом, чтобы не перечёркивать заголовок
  const textBottom = heroText.offsetTop + heroText.offsetHeight;
  const top = Math.max(textBottom + 40, H * 0.58);
  const gap = Math.min(H * 0.045, (H - 70 - top) / 5);
  strings.forEach((s, i) => { s.y = top + i * gap; s.cx = W / 2; draw(s); });
  soundhole.style.top = (top + gap * 2.5) + "px";
}
function draw(s) {
  // квадратичная кривая: вершина изгиба в половину смещения контрольной точки
  s.path.setAttribute("d", `M0 ${s.y} Q ${s.cx} ${s.y + s.amp * 2} ${W} ${s.y}`);
}

function pluck(s, x, dir, force) {
  gsap.killTweensOf(s);
  s.cx = x;
  gsap.fromTo(s, { amp: dir * Math.min(22, 8 + force) }, {
    amp: 0, duration: 1.8, ease: "elastic.out(1, 0.05)", onUpdate: () => draw(s)
  });
  playNote(s.freq, force);
}

let prev = null;
svg.addEventListener("pointermove", e => {
  const r = svg.getBoundingClientRect();
  const p = { x: e.clientX - r.left, y: e.clientY - r.top };
  if (prev) {
    strings.forEach(s => {
      if ((prev.y - s.y) * (p.y - s.y) < 0) pluck(s, p.x, Math.sign(p.y - prev.y), Math.abs(p.y - prev.y));
    });
  }
  prev = p;
});
svg.addEventListener("pointerleave", () => { prev = null; });
// на телефоне мыши нет - струна дёргается касанием рядом с ней
svg.addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse") return;
  const r = svg.getBoundingClientRect(), y = e.clientY - r.top;
  const near = strings.reduce((a, b) => Math.abs(a.y - y) < Math.abs(b.y - y) ? a : b);
  if (Math.abs(near.y - y) < 24) pluck(near, e.clientX - r.left, 1, 14);
});
if (window.matchMedia("(hover: none)").matches) {
  document.querySelector(".hint").textContent = "коснитесь струны";
}
window.addEventListener("resize", layoutStrings);
layoutStrings();

/* ---------- звук: синтез щипка (алгоритм Карплуса-Стронга), без файлов ---------- */
let audio = null;
const buffers = new Map();
const soundBtn = document.getElementById("sound");

soundBtn.addEventListener("click", () => {
  if (!audio) {
    audio = new AudioContext();
    NOTES.forEach(f => buffers.set(f, makePluck(f)));
  }
  const on = soundBtn.getAttribute("aria-pressed") !== "true";
  soundBtn.setAttribute("aria-pressed", on);
  soundBtn.textContent = on ? "Звук вкл" : "Звук выкл";
  if (on) audio.resume();
});

// damp - как долго звенит струна: у большого корпуса сустейн длиннее
function makePluck(freq, damp = 0.4985) {
  const rate = audio.sampleRate, len = Math.floor(rate * 2.6);
  const buf = audio.createBuffer(1, len, rate), out = buf.getChannelData(0);
  const period = Math.round(rate / freq), ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  for (let i = 0; i < len; i++) {
    const j = i % period, next = (j + 1) % period;
    out[i] = ring[j];
    ring[j] = (ring[j] + ring[next]) * damp;
  }
  return buf;
}

function playNote(freq, force) {
  if (!audio || soundBtn.getAttribute("aria-pressed") !== "true") return;
  const src = audio.createBufferSource(), gain = audio.createGain();
  src.buffer = buffers.get(freq);
  gain.gain.value = Math.min(0.35, 0.08 + force / 120);
  src.connect(gain).connect(audio.destination);
  src.start();
}

/* ---------- силуэты корпусов ---------- */
const SHAPES = { parlor: [38, 28, 52], om: [48, 34, 64], dread: [58, 50, 70] };
function bodyPath([u, w, l]) {
  const R = x => 100 + x, L = x => 100 - x;
  return `M100 110 C${R(u * .7)} 110 ${R(u)} 125 ${R(u)} 150 C${R(u)} 175 ${R(w)} 180 ${R(w)} 195
    C${R(w)} 212 ${R(l)} 220 ${R(l)} 250 C${R(l)} 278 ${R(l * .55)} 290 100 290
    C${L(l * .55)} 290 ${L(l)} 278 ${L(l)} 250 C${L(l)} 220 ${L(w)} 212 ${L(w)} 195
    C${L(w)} 180 ${L(u)} 175 ${L(u)} 150 C${L(u)} 125 ${L(u * .7)} 110 100 110Z`;
}
document.querySelectorAll(".card").forEach((card, n) => {
  const [u] = SHAPES[card.dataset.shape];
  const d = bodyPath(SHAPES[card.dataset.shape]);
  card.querySelector(".body").innerHTML =
    (n === 0 ? `<defs><radialGradient id="burst" cx=".5" cy=".7" r=".6">
       <stop offset="0" stop-color="#e9a94b"/><stop offset=".45" stop-color="#c8741e"/><stop offset="1" stop-color="#2a1208"/></radialGradient></defs>` : "") +
    `<rect class="neck" x="93" y="0" width="14" height="118"/>
     <rect class="neck" x="88" y="0" width="24" height="28" rx="3"/>
     <path class="outline" d="${d}"/>
     <circle class="hole" cx="100" cy="182" r="${(u * .36).toFixed(1)}"/>`;
});

/* ---------- уведомление для кнопок, которые в концепте никуда не отправляют ---------- */
const toastEl = document.getElementById("toast");
let toastTimer;
function toast(text) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  gsap.fromTo(toastEl, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .35, ease: "back.out(1.7)" });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => gsap.to(toastEl, { opacity: 0, duration: .25, onComplete: () => { toastEl.hidden = true; } }), 2600);
}
document.getElementById("send").addEventListener("click", () => toast("Это концепт сайта: заявка мастеру никуда не уйдёт"));
document.getElementById("visitBtn").addEventListener("click", () => toast("Это концепт сайта: запись здесь не работает"));

/* ---------- конструктор гитары ---------- */
const PRICE = { shape: { parlor: 140000, om: 180000, dread: 195000 }, top: { spruce: 0, cedar: 12000 },
  finish: { natural: 0, burst: 15000, black: 10000 }, rosette: { shell: 8000, wood: 0 } };
const NAMES = { parlor: "Парлор", om: "Оркестровая", dread: "Дредноут", spruce: "ель", cedar: "кедр",
  natural: "натуральное", burst: "санбёрст", black: "чёрное", shell: "перламутр", wood: "деревянная розетка" };
const TOP_COLOR = { spruce: "#e8c98e", cedar: "#c98a57" };
const cfg = { shape: "om", top: "spruce", finish: "burst", rosette: "shell", lefty: false };
const gBody = document.getElementById("gBody"), gRos = document.getElementById("gRosette"), gHole = document.getElementById("gHole");
const priceEl = document.getElementById("price"), weeksEl = document.getElementById("weeks");
const priceObj = { v: 0 };
gBody.setAttribute("d", bodyPath(SHAPES.om));

function renderGuitar(first) {
  const [u] = SHAPES[cfg.shape];
  const t = first ? 0 : .6;
  gsap.to(gBody, { attr: { d: bodyPath(SHAPES[cfg.shape]) }, duration: t, ease: "elastic.out(1, .6)" });
  gsap.to(gRos, { attr: { r: u * .42 }, duration: t, ease: "power3.out" });
  gsap.to(gHole, { attr: { r: u * .33 }, duration: t, ease: "power3.out" });
  gBody.style.fill = cfg.finish === "burst" ? "url(#gBurst)" : cfg.finish === "black" ? "#17100c" : TOP_COLOR[cfg.top];
  gRos.style.stroke = cfg.rosette === "shell" ? "#3fa7a0" : "#8a5a2e";
  gsap.to("#gFlip", { scaleX: cfg.lefty ? -1 : 1, transformOrigin: "50% 50%", duration: t, ease: "power3.inOut" });

  const total = PRICE.shape[cfg.shape] + PRICE.top[cfg.top] + PRICE.finish[cfg.finish] + PRICE.rosette[cfg.rosette];
  gsap.to(priceObj, { v: total, duration: first ? 0 : .5, ease: "power2.out",
    onUpdate: () => { priceEl.textContent = (Math.round(priceObj.v / 100) * 100).toLocaleString("ru-RU"); } });
  weeksEl.textContent = 9 + (cfg.finish === "burst" ? 1 : 0) + (cfg.lefty ? 1 : 0);
  document.getElementById("summary").textContent =
    [NAMES[cfg.shape], NAMES[cfg.top], NAMES[cfg.finish], NAMES[cfg.rosette]].join(" · ") + (cfg.lefty ? " · под левую руку" : "");
}
document.querySelectorAll(".opts").forEach(group => {
  group.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    group.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
    cfg[group.dataset.opt] = b.dataset.v;
    renderGuitar();
    gsap.fromTo("#guitar", { y: -6 }, { y: 0, duration: .5, ease: "bounce.out" });
  }));
});
document.getElementById("lefty").addEventListener("change", e => { cfg.lefty = e.target.checked; renderGuitar(); });
renderGuitar(true);

// аккорд ми минор тем корпусом, который выбран, с осциллограммой
const CHORD = [82.41, 123.47, 164.81, 196, 246.94, 329.63];
const DAMP = { parlor: .4970, om: .4985, dread: .4993 };
const listenBtn = document.getElementById("listen");
const scope = document.getElementById("scope"), sctx = scope.getContext("2d");
let analyser, scopeData, scopeUntil = 0;
function drawScope() {
  sctx.clearRect(0, 0, scope.width, scope.height);
  sctx.lineWidth = 2.5; sctx.strokeStyle = "#e9a94b"; sctx.beginPath();
  if (analyser && performance.now() < scopeUntil) {
    analyser.getFloatTimeDomainData(scopeData);
    for (let i = 0; i < scopeData.length; i++) {
      const x = i / (scopeData.length - 1) * scope.width, y = scope.height / 2 + scopeData[i] * scope.height * 1.6;
      i ? sctx.lineTo(x, y) : sctx.moveTo(x, y);
    }
    requestAnimationFrame(drawScope);
  } else {
    sctx.moveTo(0, scope.height / 2); sctx.lineTo(scope.width, scope.height / 2);
    listenBtn.classList.remove("playing");
  }
  sctx.stroke();
}
drawScope();
listenBtn.addEventListener("click", () => {
  if (!audio) { audio = new AudioContext(); NOTES.forEach(f => buffers.set(f, makePluck(f))); }
  audio.resume();
  if (!analyser) {
    analyser = audio.createAnalyser(); analyser.fftSize = 1024;
    scopeData = new Float32Array(analyser.fftSize);
    analyser.connect(audio.destination);
  }
  const damp = DAMP[cfg.shape];
  CHORD.forEach((f, i) => {
    const key = f + "-" + cfg.shape;
    if (!buffers.has(key)) buffers.set(key, makePluck(f, damp));
    const src = audio.createBufferSource(), gain = audio.createGain();
    src.buffer = buffers.get(key);
    gain.gain.value = cfg.shape === "dread" ? .22 : cfg.shape === "parlor" ? .15 : .18;
    src.connect(gain).connect(analyser);
    src.start(audio.currentTime + i * .035);
  });
  listenBtn.classList.add("playing");
  const wasIdle = performance.now() >= scopeUntil;
  scopeUntil = performance.now() + 2600;
  if (wasIdle) drawScope();
  // струны на картинке тоже дрожат
  gsap.fromTo(".g-strings path", { x: 0 }, { x: .8, duration: .05, repeat: 20, yoyo: true, stagger: .035, ease: "none", clearProps: "x" });
});

// очередь: полоски этапов заполняются при прокрутке
document.querySelectorAll(".q").forEach(q => {
  const stage = +q.dataset.stage || 0;
  q.querySelectorAll(".q-steps i").forEach((el, i) => {
    const fill = i < stage - 1 ? 1 : i === stage - 1 ? .55 : 0;
    gsap.to(el, { "--fill": fill, duration: .8, delay: i * .12, ease: "power2.out",
      scrollTrigger: { trigger: q, start: "top 90%", once: true } });
  });
});

/* ---------- анимации ---------- */
const mm = gsap.matchMedia();

mm.add("(prefers-reduced-motion: no-preference)", () => {
  // первый экран: струны натягиваются, слова поднимаются
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  strings.forEach(s => {
    const len = s.path.getTotalLength();
    gsap.set(s.path, { strokeDasharray: len, strokeDashoffset: len });
  });
  tl.from(".soundhole", { scale: .7, opacity: 0, duration: 1.4, ease: "expo.out" })
    .to(strings.map(s => s.path), {
      strokeDashoffset: 0, duration: 1.1, stagger: .08, ease: "power2.inOut",
      onComplete: () => gsap.set(strings.map(s => s.path), { clearProps: "strokeDasharray,strokeDashoffset" })
    }, "<.1")
    .from(".hero h1 .w > span", { yPercent: 110, duration: .9, stagger: .045 }, "<.2")
    .from(".eyebrow, .lead", { y: 16, opacity: 0, duration: .7, stagger: .1 }, "-=.5")
    .from(".hint", { opacity: 0, duration: .6 });

  // розетка чуть уезжает при прокрутке
  gsap.to(".soundhole", {
    yPercent: -30, rotate: 25, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });

  // счётчики
  document.querySelectorAll(".count").forEach(el => {
    const obj = { v: 0 };
    gsap.to(obj, {
      v: +el.dataset.to, duration: 1.6, ease: "power2.out",
      onUpdate: () => { el.textContent = Math.round(obj.v); },
      scrollTrigger: { trigger: el, start: "top 85%", once: true }
    });
  });
  gsap.from(".sheet div", {
    x: -30, opacity: 0, stagger: .08, duration: .7, ease: "power2.out",
    scrollTrigger: { trigger: ".sheet", start: "top 80%", once: true }
  });

  // карточки появляются пачкой
  gsap.set(".card", { y: 60, opacity: 0 });
  ScrollTrigger.batch(".card", {
    start: "top 85%", once: true,
    onEnter: els => gsap.to(els, { y: 0, opacity: 1, stagger: .12, duration: .9, ease: "power3.out" })
  });

  gsap.from(".visit h2 .w > span", {
    yPercent: 110, stagger: .05, duration: .9, ease: "power3.out",
    scrollTrigger: { trigger: ".visit", start: "top 70%", once: true }
  });
});

// горизонтальная лента этапов - только на широком экране
// без анимаций счётчики сразу показывают итоговые числа
mm.add("(prefers-reduced-motion: reduce)", () => {
  document.querySelectorAll(".count").forEach(el => { el.textContent = el.dataset.to; });
});

mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
  const track = document.getElementById("track");
  const dist = () => track.scrollWidth - window.innerWidth;

  const move = gsap.to(track, {
    x: () => -dist(), ease: "none",
    scrollTrigger: {
      trigger: ".process", start: "top top", end: () => "+=" + dist(),
      pin: true, scrub: 1, invalidateOnRefresh: true
    }
  });
  gsap.to("#bar", {
    scaleX: 1, ease: "none",
    scrollTrigger: { trigger: ".process", start: "top top", end: () => "+=" + dist(), scrub: true }
  });

  // чертёж каждого этапа рисуется, пока этап въезжает в кадр
  document.querySelectorAll(".stage").forEach(stage => {
    const lines = stage.querySelectorAll(".draw path, .draw circle");
    lines.forEach(p => {
      const len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
    });
    gsap.to(lines, {
      strokeDashoffset: 0, stagger: .05, ease: "none",
      scrollTrigger: { containerAnimation: move, trigger: stage, start: "left 85%", end: "left 35%", scrub: true }
    });
  });
});

// наклон карточек за мышкой
mm.add("(hover: hover) and (prefers-reduced-motion: no-preference)", () => {
  const cleanups = [];
  document.querySelectorAll(".card").forEach(card => {
    const rx = gsap.quickTo(card, "rotationX", { duration: .5, ease: "power3" });
    const ry = gsap.quickTo(card, "rotationY", { duration: .5, ease: "power3" });
    const onMove = e => {
      const r = card.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - .5) * 14);
      rx(-((e.clientY - r.top) / r.height - .5) * 10);
    };
    const onLeave = () => { rx(0); ry(0); };
    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerleave", onLeave);
    cleanups.push(() => { card.removeEventListener("pointermove", onMove); card.removeEventListener("pointerleave", onLeave); });
  });
  return () => cleanups.forEach(fn => fn());
});

// шрифты подгрузились - пересчитать позиции триггеров
document.fonts.ready.then(() => { layoutStrings(); ScrollTrigger.refresh(); });
