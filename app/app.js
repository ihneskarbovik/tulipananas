"use strict";
/* Tulipananas – webversjonen. Samme quiz-filer og bilder som iPhone-appen.
   Resultatene lagres bare i denne nettleseren (localStorage). */

const BASE = "../";                       // quizzes/ og images/ ligger ett nivå opp
const STORE = "tulipananas.history.v1";
const view = document.getElementById("view");

/* ---------- små hjelpere ---------- */
const pad = n => String(n).padStart(2, "0");
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const longDay = k => { const s = parseDay(k).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" }); return s[0].toUpperCase() + s.slice(1); };
const shortDay = k => parseDay(k).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
const monthTitle = k => parseDay(k).toLocaleDateString("nb-NO", { month: "long", year: "numeric" });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const imgURL = o => /^https?:/.test(o.image) ? o.image : BASE + o.image;
const iAm = o => o.shareName || o.name;
const greeting = () => { const h = new Date().getHours(); return h >= 5 && h < 10 ? "God morgen" : h >= 10 && h < 18 ? "God dag" : "God kveld"; };

const MUSHROOM = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 36 180 176"><path d="M70 118 C 68 156, 62 188, 60 206 L 140 206 C 138 188, 132 156, 130 118 Z" fill="#FCF7F2" stroke="#4A3228" stroke-width="5" stroke-linejoin="round"/><path d="M16 118 C 14 40, 186 40, 184 118 C 184 134, 16 134, 16 118 Z" fill="#C26B4A" stroke="#4A3228" stroke-width="5" stroke-linejoin="round"/><g fill="#FCF7F2"><circle cx="62" cy="76" r="11"/><circle cx="114" cy="74" r="12"/><circle cx="152" cy="92" r="10"/><circle cx="40" cy="108" r="7"/><circle cx="96" cy="100" r="8"/></g><g stroke="#4A3228" stroke-width="4.5" stroke-linecap="round" fill="none"><path d="M81 150 q7 7 14 0"/><path d="M105 150 q7 7 14 0"/><path d="M93 166 q7 6 14 0"/></g><circle cx="78" cy="165" r="6.5" fill="#C26B4A" opacity=".6"/><circle cx="122" cy="165" r="6.5" fill="#C26B4A" opacity=".6"/></svg>`)}`;

/* ---------- historikk ---------- */
function loadHistory() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } }
function saveHistory(h) { try { localStorage.setItem(STORE, JSON.stringify(h)); } catch {} }
function record(day, quiz, outcome) { const h = loadHistory(); h[day] = { date: day, quizTitle: quiz.title, outcome }; saveHistory(h); }
function streak(h, today) {
  let d = parseDay(today); if (!h[today]) d.setDate(d.getDate() - 1);
  let n = 0; while (h[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); } return n;
}

/* ---------- quiz ---------- */
async function fetchQuiz(day) {
  const r = await fetch(`${BASE}quizzes/${day}.json`, { cache: "no-cache" });
  if (!r.ok) throw new Error("mangler");
  return r.json();
}
function score(quiz, answers) {
  const tot = {};
  quiz.questions.forEach((q, i) => {
    const opt = q.options.find(o => o.id === answers[i]);
    if (opt) for (const [k, v] of Object.entries(opt.scores)) tot[k] = (tot[k] || 0) + v;
  });
  let best = quiz.outcomes[0];               // likt? Da vinner den som står først
  for (const o of quiz.outcomes) if ((tot[o.id] || 0) > (tot[best.id] || 0)) best = o;
  return best;
}

/* ---------- skjermer ---------- */
let state = { tab: "today", quiz: null, day: dayKey(), answers: [], index: 0, mode: "start", shown: null };

async function showToday() {
  state.day = dayKey();
  const done = loadHistory()[state.day];
  if (done) return showResult(done, true);
  view.innerHTML = `<div class="blob"></div><p class="lead">Henter dagens tema …</p>`;
  try {
    state.quiz = state.quiz && state.quiz.date === state.day ? state.quiz : await fetchQuiz(state.day);
  } catch {
    view.innerHTML = `<div class="thinking"><div><img src="${MUSHROOM}" alt=""><h2 style="margin-top:16px">Fant ikke dagens tema</h2>
      <p class="lead">Sjekk at du er koblet til nettet, og prøv igjen.</p><button class="btn" id="retry">Prøv igjen</button></div></div>`;
    document.getElementById("retry").onclick = showToday; return;
  }
  const q = state.quiz, cover = q.outcomes[0];
  const mins = Math.max(1, Math.round(q.questions.length * 15 / 60));
  view.innerHTML = `<div class="blob"></div>
    <p class="lead">${greeting()}</p>
    <h1>Hvem er du<br>i dag?</h1>
    <p class="lead" style="margin-top:6px">${longDay(state.day)}</p>
    <div class="card theme-card">
      <div class="cover" style="background-image:url('${imgURL(cover)}')"></div>
      <div class="body">
        <div class="overline">Dagens tema</div>
        <h3>${esc(q.title)}</h3>
        ${q.intro ? `<p class="lead">${esc(q.intro)}</p>` : ""}
        <div class="meta"><span>${mins} min</span><span>${q.questions.length} spørsmål</span><span>${q.outcomes.length} mulige svar</span></div>
      </div>
    </div>
    <button class="btn" id="start">Start</button>
    ${installHint()}`;
  document.getElementById("start").onclick = () => { state.answers = []; state.index = 0; showQuestion(); };
}

function showQuestion() {
  const q = state.quiz, i = state.index, question = q.questions[i];
  view.innerHTML = `
    <div class="qhead"><button class="back" id="back" ${i === 0 ? "disabled" : ""} aria-label="Forrige spørsmål">‹</button><span>${i + 1} av ${q.questions.length}</span></div>
    <div class="bar"><i style="width:${(i / q.questions.length) * 100}%"></i></div>
    <h2 class="question">${esc(question.text)}</h2>
    ${question.options.map(o => `<button class="opt ${state.answers[i] === o.id ? "sel" : ""}" data-id="${esc(o.id)}"><span>${esc(o.text)}</span><i class="dot"></i></button>`).join("")}`;
  document.getElementById("back").onclick = () => { state.index--; showQuestion(); };
  let locked = false;
  view.querySelectorAll(".opt").forEach(b => b.onclick = () => {
    if (locked) return; locked = true;
    view.querySelectorAll(".opt").forEach(x => x.classList.remove("sel")); b.classList.add("sel");
    state.answers[i] = b.dataset.id;
    setTimeout(() => {
      if (i + 1 < q.questions.length) { state.index++; showQuestion(); }
      else finish();
    }, 250);
  });
  window.scrollTo(0, 0);
}

function finish() {
  const outcome = score(state.quiz, state.answers);
  record(state.day, state.quiz, outcome);
  view.innerHTML = `<div class="thinking"><div><img src="${MUSHROOM}" alt=""><h2 style="margin-top:16px">Soppen tenker …</h2></div></div>`;
  setTimeout(() => showResult(loadHistory()[state.day], true), 1600);
}

/* Fire merkelapper rundt bildet, som på en plantegning. Samme mål som i iPhone-appen. */
function calloutLayout(w, count) {
  const cx = w / 2, cy = 170, r = 80;
  const on = deg => { const a = deg * Math.PI / 180; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  return [
    { line: [[0, 56], [cx - 60, 56]], anchor: on(-130), box: { left: 0, bottom: 340 - 52, width: cx - 60 }, align: "left" },
    { line: [[w, 86], [cx + 70, 86]], anchor: on(-45), box: { right: 0, bottom: 340 - 82, width: w - cx - 70 }, align: "right" },
    { line: [[w, 276], [cx + 60, 276]], anchor: on(40), box: { right: 0, top: 280, width: w - cx - 60 }, align: "right" },
    { line: [[0, 292], [cx - 50, 292]], anchor: on(130), box: { left: 0, top: 296, width: cx - 50 }, align: "left" },
  ].slice(0, count);
}

function annotated(o) {
  const traits = (o.traits || []).slice(0, 4);
  return `<div class="annot" id="annot" style="${traits.length ? "" : "height:220px"}">
    <div class="circle" style="background-image:url('${imgURL(o)}'),url('${MUSHROOM}');${traits.length ? "" : "top:10px"}"></div>
    <svg id="lines" aria-hidden="true"></svg>
    ${traits.map((t, i) => `<div class="trait" data-i="${i}"><b>${esc(t.title)}</b>${esc(t.text)}</div>`).join("")}
  </div>`;
}
function layoutAnnotations(o) {
  const el = document.getElementById("annot"); if (!el) return;
  const traits = (o.traits || []).slice(0, 4), w = el.clientWidth, slots = calloutLayout(w, traits.length);
  document.getElementById("lines").innerHTML = slots.map(s =>
    `<polyline points="${s.line[0]} ${s.line[1]} ${s.anchor}" fill="none" stroke="var(--rose)" stroke-width="1.1"/><circle cx="${s.anchor[0]}" cy="${s.anchor[1]}" r="3" fill="var(--rose)"/>`).join("");
  el.querySelectorAll(".trait").forEach((t, i) => {
    const b = slots[i].box; t.style.cssText = "";
    for (const [k, v] of Object.entries(b)) t.style[k] = v + "px";
    t.style.textAlign = slots[i].align;
  });
}

function showResult(entry, isToday) {
  const o = entry.outcome;
  state.shown = entry;
  view.innerHTML = `
    <p class="lead">${isToday ? "I dag er du" : "Den dagen var du"}</p>
    <h1>${esc(o.name)}</h1>
    ${annotated(o)}
    <p class="desc">${esc(o.description)}</p>
    <div class="card fact"><div class="overline">Visste du?</div><p>${esc(o.funFact)}</p></div>
    <button class="btn" id="share">Del «Jeg er ${esc(iAm(o))}»</button>
    ${isToday ? `<p class="small">Nytt tema i morgen.</p>` : `<button class="btn" id="back" style="background:var(--surface);color:var(--ink)">Tilbake</button>`}`;
  layoutAnnotations(o);
  document.getElementById("share").onclick = () => share(entry);
  const back = document.getElementById("back"); if (back) back.onclick = showHistory;
  window.scrollTo(0, 0);
}

function showHistory() {
  const h = loadHistory(), days = Object.keys(h).sort().reverse(), n = streak(h, dayKey());
  if (!days.length) {
    view.innerHTML = `<h1>Tidligere</h1><div class="thinking" style="min-height:40dvh"><div><img src="${MUSHROOM}" alt="" style="animation:none;width:110px">
      <h2 style="margin-top:16px">Ingen resultater ennå</h2><p class="lead">Ta dagens quiz, så dukker resultatet opp her.</p></div></div>`;
    return;
  }
  let html = `<h1>Tidligere</h1>
    <div class="streak"><span class="n">${n}</span><div><b>${n === 1 ? "dag" : "dager"} på rad</b><div class="lead" style="font-size:14px">${h[dayKey()] ? "Kom tilbake i morgen for å holde rekken." : "Ta dagens quiz for å holde rekken."}</div></div></div>`;
  let month = "";
  for (const d of days) {
    const m = monthTitle(d); if (m !== month) { month = m; html += `<div class="month">${esc(m)}</div>`; }
    const e = h[d];
    html += `<button class="row" data-day="${d}"><span class="thumb" style="background-image:url('${imgURL(e.outcome)}'),url('${MUSHROOM}')"></span>
      <span class="t"><b>${esc(e.outcome.name)}</b><span>${esc(e.quizTitle)}</span></span><span class="d">${shortDay(d)}</span></button>`;
  }
  view.innerHTML = html;
  view.querySelectorAll(".row").forEach(r => r.onclick = () => showResult(h[r.dataset.day], r.dataset.day === dayKey()));
}

function installHint() {
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) return "";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `<div class="card install">${ios
    ? `<b>Har du iPhone?</b> Last ned appen i <a href="https://apps.apple.com/no/app/id6815816618">App Store</a>.`
    : `<b>Legg Tulipananas på hjemskjermen:</b> trykk på menyen ⋮ i nettleseren og velg «Legg til på startskjermen».`}</div>`;
}

/* ---------- delebilde (kvadratisk, som i iPhone-appen) ---------- */
function loadImage(src) {
  return new Promise(res => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}
function wrap(ctx, text, maxW) {
  const words = text.split(" "), lines = []; let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines.slice(0, 2);
}
async function drawShareCard(o) {
  await document.fonts.load('17px "Tulip Italic"');
  const S = 3, W = 440, c = document.createElement("canvas"); c.width = c.height = W * S;
  const x = c.getContext("2d"); x.scale(S, S);
  const C = { canvas: "#F6ECE3", blush: "#F0DACA", ink: "#4A3228", soft: "#9A7B6A", rose: "#C26B4A" };
  const sans = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  x.fillStyle = C.canvas; x.fillRect(0, 0, W, W);
  x.globalAlpha = .7; x.fillStyle = C.blush; x.beginPath(); x.arc(220, 390, 260, 0, 7); x.fill(); x.globalAlpha = 1;

  // «Jeg er …» på én linje, krymper ved lange navn
  let k = 1;
  const measure = () => { x.font = `${22 * k}px ${sans}`; const a = x.measureText("Jeg er ").width; x.font = `bold ${26 * k}px ${sans}`; return a + x.measureText(iAm(o)).width; };
  while (measure() > 392 && k > .5) k -= .05;
  x.textBaseline = "alphabetic";
  x.font = `${22 * k}px ${sans}`; x.fillStyle = C.soft; x.fillText("Jeg er ", 24, 52); const a = x.measureText("Jeg er ").width;
  x.font = `bold ${26 * k}px ${sans}`; x.fillStyle = C.ink; x.fillText(iAm(o), 24 + a, 52);

  // bildet i sirkel
  const ox = 24, oy = 62, w = 392, cx = ox + w / 2, cy = oy + 170;
  x.fillStyle = C.blush; x.beginPath(); x.arc(cx, cy, 100, 0, 7); x.fill();
  const img = (await loadImage(imgURL(o))) || (await loadImage(MUSHROOM));
  if (img) {
    x.save(); x.beginPath(); x.arc(cx, cy, 100, 0, 7); x.clip();
    const s = Math.max(200 / img.width, 200 / img.height), iw = img.width * s, ih = img.height * s;
    x.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih); x.restore();
  }
  // merkelapper
  const traits = (o.traits || []).slice(0, 4);
  calloutLayout(w, traits.length).forEach((s, i) => {
    x.strokeStyle = C.rose; x.lineWidth = 1.1; x.beginPath();
    x.moveTo(ox + s.line[0][0], oy + s.line[0][1]); x.lineTo(ox + s.line[1][0], oy + s.line[1][1]); x.lineTo(ox + s.anchor[0], oy + s.anchor[1]); x.stroke();
    x.fillStyle = C.rose; x.beginPath(); x.arc(ox + s.anchor[0], oy + s.anchor[1], 3, 0, 7); x.fill();
    const b = s.box, right = s.align === "right", tx = right ? ox + w : ox;
    x.textAlign = right ? "right" : "left";
    x.font = `12.5px ${sans}`; const lines = wrap(x, traits[i].text, b.width);
    const below = b.top !== undefined, lineY = oy + s.line[0][1];
    let y = below ? lineY + 4 + 15 : lineY - 4 - lines.length * 15.5;
    x.font = `600 13.5px ${sans}`; x.fillStyle = C.rose; x.fillText(traits[i].title, tx, y); y += 16;
    x.font = `12.5px ${sans}`; x.fillStyle = C.ink; lines.forEach(l => { x.fillText(l, tx, y); y += 15.5; });
  });
  // bunntekst
  x.textAlign = "left"; x.font = '17px "Tulip Italic", Georgia, serif'; x.fillStyle = C.ink; x.fillText("tulipananas", 24, 420);
  x.textAlign = "right"; x.font = `12px ${sans}`; x.fillStyle = C.soft; x.fillText("Hvem er du i dag?", 416, 420);
  return new Promise(res => c.toBlob(res, "image/png"));
}
async function share(entry) {
  const btn = document.getElementById("share"); btn.disabled = true;
  try {
    const blob = await drawShareCard(entry.outcome);
    const file = new File([blob], `tulipananas-${entry.date}.png`, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });           // bare bildet, ingen tekst
    } else {
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    }
  } catch (e) { /* brukeren avbrøt */ }
  btn.disabled = false;
}

/* ---------- navigasjon ---------- */
document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => {
  document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x === b));
  state.tab = b.dataset.tab; state.tab === "today" ? showToday() : showHistory();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.tab === "today" && dayKey() !== state.day) showToday();
});
addEventListener("resize", () => { if (state.shown && document.getElementById("annot")) layoutAnnotations(state.shown.outcome); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
showToday();
