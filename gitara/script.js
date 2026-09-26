gsap.registerPlugin(ScrollTrigger);

const SVG_NS = "http://www.w3.org/2000/svg";
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- слова заголовков в обёртки, чтобы они выезжали из-под маски ---------- */
document.querySelectorAll(".split").forEach(el => {
  el.innerHTML = el.textContent.trim().split(/\s+/)
    .map(w => `<span class="w"><span>${w}</span></span>`).join(" ");
});

/* ---------- гриф и струны ---------- */
// стандартный строй, открытые струны от шестой к первой: E2 A2 D3 G3 B3 E4
const NOTES = [82.41, 110, 146.83, 196, 246.94, 329.63];
const LETTERS = ["E", "A", "D", "G", "B", "e"];
const FRETS = 6;
// аппликатуры первой позиции, от 6-й струны к 1-й; -1 = струну не играем
const CHORDS = {
  Em: [0, 2, 2, 0, 0, 0], Am: [-1, 0, 2, 2, 1, 0], C: [-1, 3, 2, 0, 1, 0],
  G: [3, 2, 0, 0, 0, 3], D: [-1, -1, 0, 2, 3, 2], E: [0, 2, 2, 1, 0, 0]
};
let chord = null; // null = свободно: звучит лад под курсором

const svg = document.getElementById("strings");
const mk = (tag, cls) => { const el = document.createElementNS(SVG_NS, tag); if (cls) el.setAttribute("class", cls); return el; };
const neck = mk("g"), fingers = mk("g");
neck.id = "neck";
svg.appendChild(neck);
let W = 0, H = 0, nutX = 0, fretX = [], neckTop = 0, neckBottom = 0, zoneBand = null;
const strings = NOTES.map((freq, i) => {
  const path = mk("path");
  path.setAttribute("stroke-width", (3.4 - i * 0.45).toFixed(2));
  const label = mk("text", "note");
  label.setAttribute("text-anchor", "end");
  label.textContent = LETTERS[i];
  svg.append(path, label);
  return { freq, path, label, i, y: 0, amp: 0, cx: 0 };
});
svg.appendChild(fingers); // точки-пальцы поверх струн

const heroText = document.querySelector(".hero-text");
const soundhole = document.querySelector(".soundhole");
const small = () => W < 768;

// лад под точкой x: левее порожка и правее последнего лада - открытая струна
function fretAt(x) {
  if (x < nutX) return 0;
  for (let n = 1; n <= FRETS; n++) if (x < fretX[n - 1]) return n;
  return 0;
}
// где палец прижимает струну на ладу n: чуть левее металлического порожка
const fingerX = n => { const a = n === 1 ? nutX : fretX[n - 2], b = fretX[n - 1]; return b - (b - a) * .38; };

function layoutStrings() {
  W = svg.clientWidth; H = svg.clientHeight;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  // струны под текстом; снизу место под кнопки аккордов
  const textBottom = heroText.offsetTop + heroText.offsetHeight;
  const top = Math.max(textBottom + 44, H * .5);
  const gap = Math.max(18, Math.min(H * .05, (H - (small() ? 190 : 160) - top) / 5.5));
  strings.forEach((s, i) => { s.y = top + i * gap; s.cx = W / 2; draw(s); });

  // гриф: лады сужаются к корпусу, как на настоящей гитаре (каждый следующий в 2^(1/12) раз короче)
  nutX = small() ? 34 : Math.max(60, W * .06);
  const neckEnd = W * (small() ? .86 : .66);
  const total = 1 - Math.pow(2, -FRETS / 12);
  fretX = Array.from({ length: FRETS }, (_, k) => nutX + (neckEnd - nutX) * (1 - Math.pow(2, -(k + 1) / 12)) / total);
  neckTop = top - gap * .6; neckBottom = top + gap * 5.6;

  neck.replaceChildren();
  const board = mk("rect", "board");
  board.setAttribute("x", nutX); board.setAttribute("y", neckTop);
  board.setAttribute("width", neckEnd - nutX + 14); board.setAttribute("height", neckBottom - neckTop);
  board.setAttribute("rx", 4);
  zoneBand = mk("rect", "zone");
  zoneBand.setAttribute("y", neckTop); zoneBand.setAttribute("height", neckBottom - neckTop);
  zoneBand.setAttribute("width", 0);
  const nut = mk("rect", "nut");
  nut.setAttribute("x", nutX - 6); nut.setAttribute("y", neckTop - 2); nut.setAttribute("width", 7); nut.setAttribute("height", neckBottom - neckTop + 4);
  neck.append(board, zoneBand, nut);
  fretX.forEach((x, k) => {
    const f = mk("rect", "fret");
    f.setAttribute("x", x - 1.5); f.setAttribute("y", neckTop); f.setAttribute("width", 3); f.setAttribute("height", neckBottom - neckTop);
    const num = mk("text", "fret-num");
    num.setAttribute("x", (k ? fretX[k - 1] : nutX) + (x - (k ? fretX[k - 1] : nutX)) / 2);
    num.setAttribute("y", neckBottom + 18); num.setAttribute("text-anchor", "middle");
    num.textContent = k + 1;
    neck.append(f, num);
  });
  // перламутровые метки на 3-м и 5-м ладу
  [3, 5].forEach(n => {
    const d = mk("circle", "inlay");
    d.setAttribute("cx", (fretX[n - 2] + fretX[n - 1]) / 2); d.setAttribute("cy", (strings[2].y + strings[3].y) / 2);
    d.setAttribute("r", Math.max(4, gap * .2));
    neck.append(d);
  });
  strings.forEach(s => { s.label.setAttribute("x", nutX - 14); s.label.setAttribute("y", s.y + 4); });

  soundhole.style.top = (top + gap * 2.5) + "px";
  soundhole.style.left = (small() ? W * 1.02 : W * .84) + "px";
  renderChord(false);
}
function draw(s) {
  // квадратичная кривая: вершина изгиба в половину смещения контрольной точки
  s.path.setAttribute("d", `M0 ${s.y} Q ${s.cx} ${s.y + s.amp * 2} ${W} ${s.y}`);
}

// пальцы аккорда на грифе и крестики у заглушённых струн
function renderChord(animate = true) {
  fingers.replaceChildren();
  strings.forEach(s => {
    const f = chord ? CHORDS[chord][s.i] : 0;
    s.label.textContent = f === -1 ? "×" : LETTERS[s.i];
    s.label.classList.toggle("muted", f === -1);
    s.path.classList.toggle("muted", f === -1);
    if (f > 0) {
      const dot = mk("circle", "finger");
      dot.setAttribute("cx", fingerX(f)); dot.setAttribute("cy", s.y);
      dot.setAttribute("r", Math.max(7, (strings[1].y - strings[0].y) * .34));
      fingers.appendChild(dot);
      if (animate) gsap.from(dot, { attr: { r: 0 }, duration: .35, delay: s.i * .04, ease: "back.out(2.5)" });
    }
  });
}

// в свободном режиме подсвечиваем лад под курсором
function showZone(x) {
  if (!zoneBand) return;
  const n = chord ? 0 : fretAt(x);
  if (!n) { zoneBand.setAttribute("width", 0); return; }
  const a = n === 1 ? nutX : fretX[n - 2];
  zoneBand.setAttribute("x", a); zoneBand.setAttribute("width", fretX[n - 1] - a);
}

// force от 0 (еле задел) до 1 (резко махнул): от неё зависят размах, громкость и звонкость
function pluck(s, x, dir, force, delayMs = 0) {
  const fret = chord ? CHORDS[chord][s.i] : fretAt(x);
  gsap.killTweensOf(s);
  s.cx = x;
  // заглушённая струна только глухо дёргается и молчит
  // медленное касание - струна еле вздрагивает, резкий взмах - размашисто вибрирует
  gsap.fromTo(s, { amp: dir * (fret === -1 ? 2 : 1 + Math.pow(force, 1.2) * 23) }, {
    amp: 0, duration: fret === -1 ? .3 : .7 + force * 1.5, delay: delayMs / 1000, ease: "elastic.out(1, 0.05)", onUpdate: () => draw(s)
  });
  if (fret === -1) return;
  // в свободном режиме на мгновение показываем, где прижата струна
  if (!chord && fret > 0) {
    const dot = mk("circle", "finger ghost");
    dot.setAttribute("cx", fingerX(fret)); dot.setAttribute("cy", s.y);
    dot.setAttribute("r", Math.max(6, (strings[1].y - strings[0].y) * .28));
    fingers.appendChild(dot);
    gsap.to(dot, { opacity: 0, duration: .9, delay: .15 + delayMs / 1000, onComplete: () => dot.remove() });
  }
  // каждый лад на полтона выше: частота умножается на 2^(лад/12)
  playNote(s, s.freq * Math.pow(2, fret / 12), force, delayMs);
}

let prev = null;
svg.addEventListener("pointermove", e => {
  const r = svg.getBoundingClientRect();
  const p = { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp };
  showZone(p.x);
  if (prev) {
    // сила = скорость движения поперёк струн, px/мс: медленно ~0.1, резкий взмах ~3
    const dt = Math.max(p.t - prev.t, 4);
    const force = Math.min(1, Math.max(.02, Math.pow(Math.abs(p.y - prev.y) / dt / 2.5, 1.2)));
    strings.forEach(s => {
      if ((prev.y - s.y) * (p.y - s.y) < 0) {
        // струна, которую мышь пересекла позже, и звучит позже - получается перебор, а не удар разом
        const k = (s.y - prev.y) / (p.y - prev.y);
        pluck(s, prev.x + (p.x - prev.x) * k, Math.sign(p.y - prev.y), force, k * dt);
      }
    });
  }
  prev = p;
});
svg.addEventListener("pointerleave", () => { prev = null; showZone(-1); });
// на телефоне мыши нет - струна дёргается касанием рядом с ней
svg.addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse") return;
  const r = svg.getBoundingClientRect(), y = e.clientY - r.top;
  const near = strings.reduce((a, b) => Math.abs(a.y - y) < Math.abs(b.y - y) ? a : b);
  if (Math.abs(near.y - y) < 24) pluck(near, e.clientX - r.left, 1, .55);
});
window.addEventListener("resize", layoutStrings);
layoutStrings();

/* ---------- звук: синтез щипка (алгоритм Карплуса-Стронга), без файлов ---------- */
// строй стандартный: 6-я E2 82,41 Гц ... 1-я E4 329,63 Гц
let audio = null, master = null;
const buffers = new Map();
const soundBtn = document.getElementById("sound");
const heroSound = document.getElementById("heroSound");
const hint = document.getElementById("hint");
const touch = window.matchMedia("(hover: none)").matches;
const soundOn = () => audio && soundBtn.getAttribute("aria-pressed") === "true";
function hintText() {
  if (chord) return `аккорд ${chord} зажат: ${touch ? "касайтесь струн" : "проведите по струнам"}`;
  return touch ? "коснитесь струны над нужным ладом" : "проведите по струнам: какой лад под курсором, тот и звучит. Чем резче, тем громче";
}

function ensureAudio() {
  if (audio) return;
  audio = new AudioContext();
  // ограничитель: если резко провести по всем шести, звук не хрипит
  master = audio.createDynamicsCompressor();
  master.threshold.value = -10; master.ratio.value = 8;
  master.connect(audio.destination);
}
// звук по умолчанию выключен; две кнопки - в шапке и у струн - всегда показывают одно и то же
function setSound(on) {
  if (on) { ensureAudio(); audio.resume(); }
  [soundBtn, heroSound].forEach(b => b.setAttribute("aria-pressed", on));
  soundBtn.textContent = on ? "Звук вкл" : "Включить звук";
  heroSound.querySelector("span").textContent = on ? "Звук включён" : "Включить звук";
}
soundBtn.addEventListener("click", () => setSound(!soundOn()));
heroSound.addEventListener("click", () => setSound(!soundOn()));
setSound(false);
hint.textContent = hintText();

// аккорды: выбрал - на грифе появились пальцы, провёл по струнам - сыграл аккорд
document.querySelectorAll(".chords button").forEach(b => b.addEventListener("click", () => {
  chord = b.dataset.chord || null;
  document.querySelectorAll(".chords button").forEach(x => x.setAttribute("aria-pressed", x === b));
  renderChord();
  showZone(-1);
  hint.textContent = hintText();
}));

// дёрнули струну с выключенным звуком - подмигиваем кнопкой, но не чаще раза в 3 секунды
let nudgedAt = 0;
function nudgeSound() {
  if (performance.now() - nudgedAt < 3000) return;
  nudgedAt = performance.now();
  gsap.fromTo([soundBtn, heroSound], { scale: 1 }, { scale: 1.12, duration: .18, yoyo: true, repeat: 3, ease: "power1.inOut" });
}

// damp - как долго звенит струна: у большого корпуса сустейн длиннее
// soft - сколько раз сгладить начальный шум: 0 = щелчок медиатора, 3 = мягко подушечкой пальца
function makePluck(freq, damp = 0.4985, soft = 0) {
  const rate = audio.sampleRate, len = Math.floor(rate * 4);
  const buf = audio.createBuffer(1, len, rate), out = buf.getChannelData(0);
  // усреднение соседних отсчётов удлиняет период на полотсчёта - вычитаем, чтобы нота не занижалась
  const period = Math.max(2, Math.round(rate / freq - .5)), ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  for (let pass = 0; pass < soft; pass++) {
    for (let i = 0; i < period; i++) ring[i] = (ring[i] + ring[(i + 1) % period]) * .5;
  }
  const peak = ring.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  for (let i = 0; i < period; i++) ring[i] /= peak;
  for (let i = 0; i < len; i++) {
    const j = i % period, next = (j + 1) % period;
    out[i] = ring[j];
    ring[j] = (ring[j] + ring[next]) * damp;
  }
  // последние 0,4 с плавно уводим в ноль: звук гаснет, а не обрывается на конце записи
  const fade = Math.floor(rate * .4);
  for (let i = 0; i < fade; i++) out[len - fade + i] *= Math.cos(i / fade * Math.PI / 2);
  return buf;
}

function playNote(s, freq, force, delayMs = 0) {
  if (!soundOn()) { nudgeSound(); return; }
  // три вида щипка: мягко пальцем, обычно, резко медиатором. Каждый синтезируем один раз
  const soft = force < .25 ? 3 : force < .6 ? 1 : 0;
  const key = freq.toFixed(2) + "-" + soft;
  if (!buffers.has(key)) buffers.set(key, makePluck(freq, .4985, soft));
  const t = audio.currentTime + delayMs / 1000;
  // струна не звучит двумя голосами сразу: прошлый звук глушим, как пальцем
  if (s.voice) {
    const g = s.voice.gain.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else g.cancelScheduledValues(t);
    g.setTargetAtTime(0, t, .015);
    s.voice.src.stop(t + .12);
  }
  const src = audio.createBufferSource(), tone = audio.createBiquadFilter(), gain = audio.createGain();
  src.buffer = buffers.get(key);
  tone.type = "lowpass";
  tone.frequency.value = 600 + force * 6000;          // резкий щипок звонче, мягкий глуше
  const peak = .03 + Math.pow(force, 1.4) * .45;      // еле задел - тихо, махнул - громко
  const attack = .002 + (1 - force) * .03;            // мягкое касание нарастает, резкое щёлкает сразу
  // затухание как у настоящей гитары: басы тянутся дольше, верхние струны гаснут быстрее
  const decay = 1.25 * Math.pow(82.41 / freq, .35);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.setTargetAtTime(0, t + attack, decay);
  src.connect(tone).connect(gain).connect(master);
  src.start(t);
  s.voice = { src, gain };
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
  ensureAudio();
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
    const t0 = audio.currentTime + i * .035;
    gain.gain.setValueAtTime(cfg.shape === "dread" ? .22 : cfg.shape === "parlor" ? .15 : .18, t0);
    // большой корпус звенит дольше, маленький гаснет быстрее
    gain.gain.setTargetAtTime(0, t0 + .05, cfg.shape === "dread" ? 1.6 : cfg.shape === "parlor" ? .9 : 1.2);
    src.connect(gain).connect(analyser);
    src.start(t0);
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
    .from(".play", { y: 16, opacity: 0, duration: .6 });
  tl.from("#neck", { opacity: 0, x: -40, duration: 1.2, ease: "expo.out" }, .15);

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
