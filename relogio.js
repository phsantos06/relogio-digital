const $ = (id) => document.getElementById(id);
const pad = (n, d = 2) => String(Math.floor(n)).padStart(d, "0");
const store = {
  get: (k, fallback) => { try { const v = localStorage.getItem("relogio:" + k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set: (k, v) => { try { localStorage.setItem("relogio:" + k, JSON.stringify(v)); } catch {} },
};

/* ================= ABAS ================= */
const tabs = [...document.querySelectorAll('[role="tab"]')];
const ink = document.querySelector(".tabs__ink");

function abrirAba(tab, focar = false) {
  tabs.forEach((t, i) => {
    const ativo = t === tab;
    t.setAttribute("aria-selected", ativo);
    t.tabIndex = ativo ? 0 : -1;
    $(t.getAttribute("aria-controls")).hidden = !ativo;
    if (ativo) ink.style.transform = `translateX(${i * 100}%)`;
  });
  if (focar) tab.focus();
  store.set("aba", tab.id);
}
tabs.forEach((t, i) => {
  t.addEventListener("click", () => abrirAba(t));
  t.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const prox = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    abrirAba(prox, true);
  });
});
abrirAba($(store.get("aba", "tab-relogio")) || tabs[0]);

/* ================= RELÓGIO ================= */
const fmt12 = $("formato12");
const mostrarSeg = $("mostrarSeg");
fmt12.checked = store.get("12h", false);
mostrarSeg.checked = store.get("seg", true);

const dataFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function atualizarRelogio() {
  const agora = new Date();
  let h = agora.getHours();
  const m = agora.getMinutes();
  const s = agora.getSeconds();

  let sufixo = "";
  if (fmt12.checked) { sufixo = h < 12 ? "AM" : "PM"; h = h % 12 || 12; }

  $("hora").textContent = `${pad(h)}:${pad(m)}`;
  $("seg").textContent = `:${pad(s)}`;
  $("ampm").textContent = sufixo;
  const dataTxt = dataFmt.format(agora);
  $("data").textContent = dataTxt.charAt(0).toUpperCase() + dataTxt.slice(1);
  $("barra-min").style.transform = `scaleX(${s / 59})`;

  const hr = agora.getHours();
  const periodo = hr < 5 ? "noite" : hr < 12 ? "manha" : hr < 18 ? "tarde" : "noite";
  document.body.dataset.periodo = periodo;
  $("saudacao").textContent = hr < 5 ? "Boa madrugada" : hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite";

  if ($("relogio").hidden === false) document.title = `${pad(h)}:${pad(m)} — Relógio Digital`;
}

fmt12.addEventListener("change", () => { store.set("12h", fmt12.checked); atualizarRelogio(); });
mostrarSeg.addEventListener("change", () => { store.set("seg", mostrarSeg.checked); document.body.classList.toggle("sem-seg", !mostrarSeg.checked); });
document.body.classList.toggle("sem-seg", !mostrarSeg.checked);

// ao voltar para a aba, redesenha na hora (o navegador congela animações em segundo plano)
document.addEventListener("visibilitychange", () => { if (!document.hidden) { atualizarRelogio(); if (sw.rodando) desenharSw(); } });

// alinha a atualização à virada do segundo
atualizarRelogio();
setTimeout(() => { atualizarRelogio(); setInterval(atualizarRelogio, 1000); }, 1000 - (Date.now() % 1000));

/* ================= CRONÔMETRO ================= */
const sw = { inicio: 0, acumulado: 0, rodando: false, raf: 0, voltas: [], ultimaVolta: 0 };
const swBtn = $("sw-start"), swLap = $("sw-lap"), swReset = $("sw-reset");

function formatarMs(ms) {
  const cs = Math.floor(ms / 10) % 100;
  const totalS = Math.floor(ms / 1000);
  const h = Math.floor(totalS / 3600);
  const base = `${h ? pad(h) + ":" : ""}${pad((totalS / 60) % 60)}:${pad(totalS % 60)}`;
  return { base, cs: pad(cs) };
}
const tempoSw = () => sw.acumulado + (sw.rodando ? performance.now() - sw.inicio : 0);

function desenharSw() {
  const { base, cs } = formatarMs(tempoSw());
  $("sw-display").innerHTML = `${base}<span class="digits__sec">.${cs}</span>`;
  if (sw.rodando) sw.raf = requestAnimationFrame(desenharSw);
}

function alternarSw() {
  if (sw.rodando) { sw.acumulado = tempoSw(); sw.rodando = false; cancelAnimationFrame(sw.raf); desenharSw(); }
  else { sw.inicio = performance.now(); sw.rodando = true; desenharSw(); }
  swBtn.textContent = sw.rodando ? "Pausar" : "Continuar";
  swBtn.classList.toggle("is-running", sw.rodando);
  swLap.disabled = !sw.rodando;
  swReset.disabled = false;
}

function volta() {
  const t = tempoSw();
  sw.voltas.push(t - sw.ultimaVolta);
  sw.ultimaVolta = t;
  const lista = $("sw-laps");
  const min = Math.min(...sw.voltas), max = Math.max(...sw.voltas);
  lista.innerHTML = sw.voltas.map((v, i) => {
    const { base, cs } = formatarMs(v);
    const cls = sw.voltas.length > 2 ? (v === min ? "is-best" : v === max ? "is-worst" : "") : "";
    return `<li class="${cls}"><span>Volta ${i + 1}</span><span>${base}.${cs}</span></li>`;
  }).reverse().join("");
}

function zerarSw() {
  cancelAnimationFrame(sw.raf);
  Object.assign(sw, { inicio: 0, acumulado: 0, rodando: false, voltas: [], ultimaVolta: 0 });
  $("sw-laps").innerHTML = "";
  swBtn.textContent = "Iniciar";
  swBtn.classList.remove("is-running");
  swLap.disabled = swReset.disabled = true;
  desenharSw();
}
swBtn.addEventListener("click", alternarSw);
swLap.addEventListener("click", volta);
swReset.addEventListener("click", zerarSw);

/* ================= TEMPORIZADOR ================= */
const CIRC = 2 * Math.PI * 54;
const tm = { total: 5 * 60 * 1000, restante: 5 * 60 * 1000, fim: 0, rodando: false, timer: 0 };
const tmBtn = $("tm-start");

function desenharTm() {
  const ms = Math.max(0, tm.rodando ? tm.fim - Date.now() : tm.restante);
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  $("tm-display").textContent = `${h ? h + ":" : ""}${pad((s / 60) % 60)}:${pad(s % 60)}`;
  $("tm-ring").style.strokeDashoffset = CIRC * (1 - ms / tm.total);
  if (tm.rodando) document.title = `⏳ ${$("tm-display").textContent} — Temporizador`;
  return ms;
}

function definirTm(ms) {
  pararTm();
  tm.total = tm.restante = Math.max(1000, ms);
  document.querySelector(".ring").classList.remove("timer-done");
  $("tm-min").value = Math.floor(tm.total / 60000);
  $("tm-sec").value = Math.floor(tm.total / 1000) % 60;
  desenharTm();
}

function pararTm() {
  clearInterval(tm.timer);
  if (tm.rodando) tm.restante = Math.max(0, tm.fim - Date.now());
  tm.rodando = false;
  tmBtn.textContent = tm.restante < tm.total && tm.restante > 0 ? "Continuar" : "Iniciar";
  tmBtn.classList.remove("is-running");
}

function alternarTm() {
  if (tm.rodando) return pararTm();
  if (tm.restante <= 0) definirTm(tm.total);
  garantirAudio();
  tm.fim = Date.now() + tm.restante;
  tm.rodando = true;
  tmBtn.textContent = "Pausar";
  tmBtn.classList.add("is-running");
  tm.timer = setInterval(() => { if (desenharTm() <= 0) concluirTm(); }, 200);
}

function concluirTm() {
  clearInterval(tm.timer);
  tm.rodando = false;
  tm.restante = 0;
  desenharTm();
  tmBtn.textContent = "Iniciar";
  tmBtn.classList.remove("is-running");
  document.querySelector(".ring").classList.add("timer-done");
  document.title = "⏰ Tempo esgotado!";
  bip();
  const toast = $("toast");
  toast.hidden = false;
  setTimeout(() => (toast.hidden = true), 5000);
  if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
}

document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
  document.querySelectorAll(".chip").forEach((x) => x.classList.toggle("is-on", x === c));
  definirTm(+c.dataset.min * 60000);
}));
$("tm-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const min = Math.min(999, Math.max(0, parseInt($("tm-min").value, 10) || 0));
  const sec = Math.min(59, Math.max(0, parseInt($("tm-sec").value, 10) || 0));
  document.querySelectorAll(".chip").forEach((x) => x.classList.remove("is-on"));
  definirTm((min * 60 + sec) * 1000);
});
tmBtn.addEventListener("click", alternarTm);
$("tm-reset").addEventListener("click", () => definirTm(tm.total));
$("tm-ring").style.strokeDasharray = CIRC;
desenharTm();

/* som sem arquivo externo */
let audio;
function garantirAudio() { try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch {} }
function bip() {
  if (!audio) return;
  [0, 0.35, 0.7].forEach((t) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, audio.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.3, audio.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.25);
    o.connect(g).connect(audio.destination);
    o.start(audio.currentTime + t);
    o.stop(audio.currentTime + t + 0.3);
  });
}

/* ================= TELA CHEIA + ATALHOS ================= */
function telaCheia() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}
$("tela-cheia").addEventListener("click", telaCheia);

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, button") && e.key === " ") return;
  if (e.key.toLowerCase() === "f" && !e.target.matches("input")) telaCheia();
  if (e.key === " ") {
    e.preventDefault();
    if (!$("cronometro").hidden) alternarSw();
    else if (!$("timer").hidden) alternarTm();
  }
});
