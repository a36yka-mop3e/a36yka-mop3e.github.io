gsap.registerPlugin(Flip);

// при "уменьшить движение" в системе анимации почти мгновенные, но всё работает
const T = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.01 : 1;

const COLS = ["Приём макета", "Печать", "Резка и сборка", "Готово к выдаче"];
const COL_COLORS = ["var(--cyan)", "var(--magenta)", "var(--yellow)", "#19c27a"];

// inks: какие краски нужны - C, M, Y, K
const ORDERS = [
  { num: 412, client: "Северный ветер", product: "Баннер 3×1 м, 2 шт", due: "сегодня 18:00", urgent: true, inks: [1, 1, 1, 1], col: 1 },
  { num: 413, client: "Кофейня «Зёрна»", product: "Меню А4 с ламинацией, 40 шт", due: "завтра", inks: [1, 1, 1, 1], col: 0 },
  { num: 414, client: "Фитнес-клуб «Пульс»", product: "Флаеры А6, 2000 шт", due: "сегодня 16:00", urgent: true, inks: [0, 1, 0, 1], col: 1 },
  { num: 415, client: "Студия «Лён»", product: "Визитки, 500 шт", due: "29 сен", inks: [0, 0, 0, 1], col: 0 },
  { num: 416, client: "Автосервис «Гараж 12»", product: "Наклейки на авто, 6 шт", due: "завтра", inks: [1, 0, 1, 1], col: 2 },
  { num: 417, client: "Школа танцев «Па»", product: "Плакаты А2, 30 шт", due: "сегодня 20:00", urgent: true, inks: [1, 1, 1, 1], col: 0 },
  { num: 418, client: "Пекарня «Утро»", product: "Стикеры на коробки, 1000 шт", due: "30 сен", inks: [0, 1, 1, 1], col: 2 },
  { num: 419, client: "Клиника «Дента+»", product: "Буклеты, 300 шт", due: "вчера", inks: [1, 0, 0, 1], col: 3 },
  { num: 420, client: "Магазин «Кедр»", product: "Ролл-ап 0,85×2 м", due: "сегодня", inks: [1, 1, 1, 1], col: 3 }
];
let nextNum = 421;

const board = document.getElementById("board");
const lists = [...document.querySelectorAll(".list")];
const toastsBox = document.getElementById("toasts");
const urgentOnly = document.getElementById("urgentOnly");

/* ---------- карточки ---------- */
function cardEl(o) {
  const el = document.createElement("article");
  el.className = "card" + (o.urgent ? " urgent" : "");
  el.innerHTML = `
    <div class="top"><span class="num"></span>
      <svg class="handle" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="5"/><path d="M10 1v18M1 10h18"/></svg></div>
    <h3></h3><p></p>
    <div class="meta"><span class="due"></span>
      <span class="cmyk" title="Краски">${o.inks.map(v => `<i class="${v ? "on" : ""}"></i>`).join("")}</span></div>`;
  // текст из формы кладём через textContent, не через разметку
  el.querySelector(".num").textContent = "№ " + o.num;
  el.querySelector("h3").textContent = o.client;
  el.querySelector("p").textContent = o.product;
  el.querySelector(".due").textContent = o.due;
  el.dataset.num = o.num;
  return el;
}

function addStamp(card, animate) {
  if (card.querySelector(".stamp")) return;
  const s = document.createElement("span");
  s.className = "stamp";
  s.textContent = "ГОТОВО";
  card.appendChild(s);
  if (animate) {
    gsap.fromTo(s, { scale: 2.6, opacity: 0, rotation: -28 },
      { scale: 1, opacity: 1, rotation: -9, duration: .35 * T, ease: "back.out(2.2)", delay: .3 * T });
  }
}

ORDERS.forEach(o => {
  const el = cardEl(o);
  lists[o.col].appendChild(el);
  if (o.col === 3) addStamp(el, false);
});

const colOf = card => lists.indexOf(card.closest(".list"));

/* ---------- счётчики колонок: старое число уезжает вверх, новое выезжает снизу ---------- */
function updateCounts() {
  lists.forEach(list => {
    const span = list.parentNode.querySelector(".count");
    const n = list.querySelectorAll(".card:not(.hidden)").length;
    if (span.textContent === String(n)) return;
    span.textContent = n;
    gsap.fromTo(span, { yPercent: 70, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .3 * T, ease: "power3.out" });
  });
}

/* ---------- уведомления ---------- */
function toast(text, color) {
  const t = document.createElement("div");
  t.className = "toast";
  t.style.setProperty("--c", color);
  t.innerHTML = `<span class="dot"></span><span class="msg"></span><span class="time"></span>`;
  t.querySelector(".msg").textContent = text;
  toastsBox.appendChild(t);
  if (toastsBox.children.length > 3) toastsBox.firstElementChild.remove();

  const tl = gsap.timeline({ onComplete: () => t.remove() });
  tl.from(t, { y: 30, opacity: 0, scale: .94, duration: .35 * T, ease: "back.out(1.7)" })
    .fromTo(t.querySelector(".time"), { scaleX: 1 }, { scaleX: 0, duration: 3.2, ease: "none" })
    .to(t, { x: 40, opacity: 0, duration: .22 * T, ease: "power2.in" });
  // навёл мышь - уведомление не пропадает, пока читаешь
  t.addEventListener("mouseenter", () => tl.pause());
  t.addEventListener("mouseleave", () => tl.resume());
}

/* ---------- перетаскивание ---------- */
let drag = null;

board.addEventListener("pointerdown", e => {
  const card = e.target.closest(".card");
  if (!card || e.button !== 0) return;
  // на телефоне тянем только за значок приводки, иначе нельзя прокрутить доску
  if (e.pointerType !== "mouse" && !e.target.closest(".handle")) return;
  e.preventDefault();
  const r = card.getBoundingClientRect();
  drag = { card, r, x0: e.clientX, y0: e.clientY, offX: e.clientX - r.left, offY: e.clientY - r.top, started: false, from: colOf(card) };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp, { once: true });
});

function beginDrag() {
  const { card, r } = drag;
  const ph = document.createElement("div");
  ph.className = "placeholder";
  ph.style.height = r.height + "px";
  card.before(ph);
  drag.ph = ph;
  card.style.width = r.width + "px";
  card.classList.add("dragging");
  document.body.appendChild(card);
  gsap.set(card, { x: r.left, y: r.top });
  gsap.to(card, { rotation: 2.5, scale: 1.03, duration: .2 * T, ease: "power2.out" });
  drag.xTo = gsap.quickTo(card, "x", { duration: .16 * T, ease: "power3" });
  drag.yTo = gsap.quickTo(card, "y", { duration: .16 * T, ease: "power3" });
  drag.started = true;
}

function onMove(e) {
  if (!drag.started) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
    beginDrag();
  }
  drag.xTo(e.clientX - drag.offX);
  drag.yTo(e.clientY - drag.offY);

  const col = document.elementFromPoint(e.clientX, e.clientY)?.closest(".col");
  document.querySelectorAll(".col.over").forEach(c => c !== col && c.classList.remove("over"));
  if (!col) return;
  col.classList.add("over");
  const list = col.querySelector(".list");
  const before = [...list.querySelectorAll(".card:not(.hidden)")].find(c => {
    const b = c.getBoundingClientRect();
    return e.clientY < b.top + b.height / 2;
  }) || null;
  if (drag.ph.parentNode === list && drag.ph.nextElementSibling === before) return;

  // соседние карточки плавно расступаются
  const state = Flip.getState(".list .card, .placeholder");
  list.insertBefore(drag.ph, before);
  Flip.from(state, { duration: .25 * T, ease: "power2.out" });
}

function onUp() {
  window.removeEventListener("pointermove", onMove);
  if (!drag.started) { drag = null; return; }
  const { card, ph, from } = drag;
  const state = Flip.getState(card);
  card.classList.remove("dragging");
  gsap.set(card, { clearProps: "all" });
  ph.replaceWith(card);
  Flip.from(state, { duration: .4 * T, ease: "power3.out" });
  document.querySelectorAll(".col.over").forEach(c => c.classList.remove("over"));

  const to = colOf(card);
  if (to !== from) {
    updateCounts();
    toast(`${card.querySelector(".num").textContent} → ${COLS[to]}`, COL_COLORS[to]);
    if (to === 3) addStamp(card, true);
    else card.querySelector(".stamp")?.remove();
  }
  drag = null;
}

/* ---------- фильтр "только срочные" ---------- */
urgentOnly.addEventListener("change", () => {
  const cards = document.querySelectorAll(".list .card");
  const state = Flip.getState(cards);
  cards.forEach(c => c.classList.toggle("hidden", urgentOnly.checked && !c.classList.contains("urgent")));
  Flip.from(state, {
    duration: .45 * T, ease: "power2.inOut", absolute: true,
    onEnter: els => gsap.fromTo(els, { opacity: 0, scale: .85 }, { opacity: 1, scale: 1, duration: .35 * T }),
    onLeave: els => gsap.to(els, { opacity: 0, scale: .85, duration: .3 * T })
  });
  updateCounts();
});

/* ---------- боковая панель "Новый заказ" ---------- */
const drawer = document.getElementById("drawer");
const backdrop = document.getElementById("backdrop");
const form = document.getElementById("orderForm");
const submit = form.querySelector(".submit");

function openDrawer() {
  drawer.hidden = backdrop.hidden = false;
  gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: .3 * T });
  gsap.fromTo(drawer, { xPercent: 100 }, { xPercent: 0, duration: .5 * T, ease: "expo.out" });
  gsap.from(".drawer .field, .drawer .switch, .drawer .submit",
    { y: 14, opacity: 0, stagger: .04, duration: .4 * T, delay: .12 * T, ease: "power3.out" });
  form.client.focus({ preventScroll: true });
}
function closeDrawer() {
  gsap.to(backdrop, { opacity: 0, duration: .25 * T, onComplete: () => { backdrop.hidden = true; } });
  gsap.to(drawer, { xPercent: 100, duration: .3 * T, ease: "power3.in", onComplete: () => { drawer.hidden = true; } });
}

document.getElementById("newOrder").addEventListener("click", openDrawer);
document.getElementById("closeDrawer").addEventListener("click", closeDrawer);
backdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !drawer.hidden) closeDrawer(); });

form.addEventListener("submit", e => {
  e.preventDefault();
  if (submit.dataset.state !== "idle") return;
  submit.dataset.state = "loading";

  setTimeout(() => {
    submit.dataset.state = "done";
    setTimeout(() => {
      closeDrawer();
      const o = {
        num: nextNum++, client: form.client.value, product: `${form.product.value}, ${form.qty.value} шт`,
        due: form.due.value, urgent: form.urgent.checked, inks: [1, 1, 1, 1]
      };
      const el = cardEl(o);
      if (urgentOnly.checked && !o.urgent) el.classList.add("hidden");
      const state = Flip.getState(lists[0].querySelectorAll(".card"));
      lists[0].prepend(el);
      Flip.from(state, {
        duration: .4 * T, ease: "power2.out",
        onEnter: els => gsap.fromTo(els, { opacity: 0, y: -24, scale: .95 },
          { opacity: 1, y: 0, scale: 1, duration: .5 * T, ease: "back.out(1.6)" })
      });
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1400);
      updateCounts();
      toast(`Заказ № ${o.num} создан`, COL_COLORS[0]);
      setTimeout(() => { submit.dataset.state = "idle"; }, 400);
    }, 700);
  }, 900);
});

if (window.matchMedia("(hover: none)").matches) {
  document.querySelector(".note").textContent = "тяните карточку за значок ⌖ в углу · концепт интерфейса, данные вымышленные";
}

/* ---------- первое появление ---------- */
updateCounts();
gsap.timeline({ defaults: { ease: "power3.out" } })
  .from(".bar > *", { y: -12, opacity: 0, stagger: .06, duration: .5 * T })
  .to(".ink .level i", { scaleX: (i, el) => el.dataset.v / 100, stagger: .08, duration: .9 * T }, "-=.2")
  .from(".col", { y: 24, opacity: 0, stagger: .07, duration: .5 * T }, "<")
  .from(".list .card", { y: 14, opacity: 0, stagger: .035, duration: .4 * T, clearProps: "transform,opacity" }, "-=.25");
