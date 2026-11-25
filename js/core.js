// Core helpers: DOM, store, dates, layers (pages, modals, sheets), toasts, notifications, confetti, Sol avatar.
import { icon } from './icons.js';
export { icon };

/* ---------- DOM ---------- */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style') { if (typeof v === 'string') el.setAttribute('style', v); else Object.assign(el.style, v); }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  add(el, kids);
  return el;
}
export function add(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false || k === true) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return el;
}
export function fill(el, ...kids) { el.replaceChildren(); add(el, kids); return el; }
export const ic = (name, size = 20, cls = '') => h('span', { class: 'i ' + cls, html: icon(name, size) });
export const $ = (id) => document.getElementById(id);
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const actions = {}; // cross-module action registry, filled by each module

/* ---------- Dates ---------- */
const DAY = 86400000;
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MOL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function now() { return new Date(Date.now() + (store.get().dayOffset || 0) * DAY); }
export function sod(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
export function fromIso(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function diffDays(a, b) { return Math.round((sod(a) - sod(b)) / DAY); }
export const fmtDay = (d) => WD[d.getDay()] + ' ' + d.getDate() + ' ' + MO[d.getMonth()];
export const fmtLong = (d) => WDL[d.getDay()] + ' ' + d.getDate() + ' ' + MOL[d.getMonth()];
export const fmtDate = (d) => d.getDate() + ' ' + MO[d.getMonth()] + ' ' + d.getFullYear();
export const wdShort = (d) => WD[d.getDay()];
export const moShort = (d) => MO[d.getMonth()];
export function relDay(d, lower) {
  const n = diffDays(d, now());
  const s = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : fmtDay(d);
  return lower && Math.abs(n) <= 1 ? s.toLowerCase() : s;
}
export function nextWeekday(d) { let x = new Date(d); while (x.getDay() === 0 || x.getDay() === 6) x = addDays(x, 1); return x; }
export function greeting() { const hr = now().getHours(); return hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'; }
export function lineStatus() {
  const d = now(); const wd = d.getDay(); const hr = d.getHours() + d.getMinutes() / 60;
  const open = wd >= 1 && wd <= 5 && hr >= 9 && hr < 17;
  if (open) return { open, label: 'Open now, until 17:00' };
  let nx = sod(d); if (!(wd >= 1 && wd <= 5 && hr < 9)) nx = addDays(nx, 1);
  nx = nextWeekday(nx);
  const when = diffDays(nx, d) === 0 ? 'today' : diffDays(nx, d) === 1 ? 'tomorrow' : WD[nx.getDay()];
  return { open, label: 'Closed now. Opens ' + when + ' at 9:00' };
}

/* ---------- Store ---------- */
const KEY = 'ram-vn-proto';
const VERSION = 4;
export function fresh() {
  const t0 = sod(new Date());
  const doses = {};
  for (let i = 4; i >= 1; i--) doses[iso(addDays(t0, -i))] = { am: 'taken', pm: 'taken' };
  doses[iso(addDays(t0, -2))].pm = null;
  return {
    v: VERSION, stage: 'available', name: 'Elena', dayOffset: 0, treatmentStart: iso(addDays(t0, -4)), enrolDay: null, activatingSince: null,
    dismissed: {}, doses, symptoms: [{ date: iso(addDays(t0, -2)), items: [{ id: 'fatigue', sev: 1 }] }], steps: {}, justDone: null,
    call: { dayIso: null, time: '10:30', notes: '', moved: false, done: false }, chat: [], metSol: false, checkin: null,
    reminders: { on: false, am: '08:00', pm: '20:00' }, presenter: false, installSeen: false, tipSeen: false, notified: {},
  };
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === VERSION) return s; } catch (e) { /* storage unavailable */ }
  return fresh();
}
let state = load();
const subs = new Set();
export const store = {
  get: () => state,
  set(patch) {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    subs.forEach((f) => f(state));
  },
  sub(f) { subs.add(f); return () => subs.delete(f); },
};
export function cycleInfo() {
  const s = store.get(); const start = fromIso(s.treatmentStart);
  const dayN = diffDays(now(), start) + 1;
  const cycle = Math.floor((dayN - 1) / 28) + 1; const day = ((dayN - 1) % 28) + 1;
  return { dayN, cycle, day, on: day <= 21, restStart: addDays(start, (cycle - 1) * 28 + 21), nextCycle: addDays(start, cycle * 28), start };
}
export function dayNDate(n) { return addDays(fromIso(store.get().treatmentStart), n - 1); }
export function doseStats() {
  const s = store.get(); const start = fromIso(s.treatmentStart); const today = sod(now());
  let due = 0, taken = 0; const missed = [];
  for (let d = new Date(start); d < today; d = addDays(d, 1)) {
    const n = diffDays(d, start); if ((n % 28) >= 21) continue;
    const rec = s.doses[iso(d)] || {};
    for (const slot of ['am', 'pm']) { due++; if (rec[slot] === 'taken') taken++; else missed.push({ date: new Date(d), slot }); }
  }
  return { due, taken, missed };
}

/* ---------- Layers ---------- */
const stack = [];
let baseTheme = '#f9f7f3';
export function setBaseTheme(c) { baseTheme = c; applyTheme(); }
function applyTheme() {
  let c = baseTheme;
  for (const e of stack) if (e.view.theme) c = e.view.theme;
  const m = document.querySelector('meta[name="theme-color"]'); if (m && m.content !== c) m.content = c;
}
export function openView(view, kind = 'page') {
  const el = view.el; el.classList.add('view', kind);
  const below = stack.length ? stack[stack.length - 1].view.el : $('l-tabs');
  $('l-stack').append(el);
  stack.push({ view, kind, below });
  void el.offsetWidth; el.classList.add('in');
  if (kind === 'page') below.classList.add('under');
  applyTheme();
  if (view.onOpen) setTimeout(view.onOpen, 60);
  return view;
}
export function closeView(view, instant) {
  let idx = view ? stack.findIndex((e) => e.view === view) : stack.length - 1;
  if (idx < 0) return Promise.resolve();
  const removed = stack.splice(idx);
  const first = removed[0];
  for (const e of removed.slice(1)) { e.below.classList.remove('under'); e.view.el.remove(); e.view.onClose && e.view.onClose(); }
  first.below.classList.remove('under');
  first.view.el.classList.remove('in');
  applyTheme();
  first.view.onClose && first.view.onClose();
  refreshAll();
  return new Promise((r) => setTimeout(() => { first.view.el.remove(); r(); }, instant ? 0 : 500));
}
export function closeAllViews() { if (stack.length) return closeView(stack[0].view); return Promise.resolve(); }
export function topView() { return stack.length ? stack[stack.length - 1].view : null; }
const tabViews = [];
export function registerTabView(v) { tabViews.push(v); }
export function refreshAll() {
  for (const v of tabViews) v.update && v.update();
  for (const e of stack) e.view.update && e.view.update();
}

/* Sheets */
const sheets = [];
export function openSheet(build, opts = {}) {
  const host = $('l-sheets');
  const scrim = h('div', { class: 'scrim' });
  const sheet = h('div', { class: 'sheet' + (opts.tall ? ' tall' : '') + (opts.cls ? ' ' + opts.cls : '') });
  let closed = false;
  const api = {
    el: sheet,
    close(result) {
      if (closed) return Promise.resolve(result); closed = true;
      const i = sheets.indexOf(api); if (i >= 0) sheets.splice(i, 1);
      scrim.classList.remove('in'); sheet.classList.remove('in', 'dragging'); sheet.style.transform = '';
      return new Promise((r) => setTimeout(() => { scrim.remove(); sheet.remove(); if (opts.onClose) opts.onClose(result); r(result); }, 430));
    },
  };
  sheet.append(h('div', { class: 'grab' }));
  add(sheet, [build(api)]);
  host.append(scrim, sheet);
  sheets.push(api);
  void sheet.offsetWidth; scrim.classList.add('in'); sheet.classList.add('in');
  if (opts.dismissable !== false) { scrim.addEventListener('click', () => api.close()); dragToClose(sheet, api); }
  return api;
}
export function closeSheets() { return Promise.all(sheets.slice().map((s) => s.close())); }
function dragToClose(sheet, api) {
  let y0 = null, dy = 0, t0 = 0;
  const start = (e) => {
    const t = e.target.closest('.grab, .sh-head'); if (!t) return;
    y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); sheet.classList.add('dragging');
  };
  const move = (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = 'translate3d(0,' + dy + 'px,0)'; };
  const end = () => {
    if (y0 == null) return; const v = dy / Math.max(1, Date.now() - t0); y0 = null; sheet.classList.remove('dragging');
    if (dy > 120 || v > 0.6) api.close(); else sheet.style.transform = '';
  };
  sheet.addEventListener('touchstart', start, { passive: true });
  sheet.addEventListener('touchmove', move, { passive: true });
  sheet.addEventListener('touchend', end); sheet.addEventListener('touchcancel', end);
}
export function sheetHead(title, api, opts = {}) {
  return h('div', { class: 'sh-head' }, h('span', { class: 't' }, title || ''), opts.noClose ? null : h('button', { class: 'iconbtn', 'aria-label': 'Close', onClick: () => api.close() }, ic('x', 22)));
}
export function actionSheet({ title, message, actions: acts }) {
  return new Promise((resolve) => {
    const host = $('l-sheets');
    const scrim = h('div', { class: 'scrim' });
    let done = false;
    const close = (val) => { if (done) return; done = true; scrim.classList.remove('in'); box.classList.remove('in'); setTimeout(() => { scrim.remove(); box.remove(); resolve(val); }, 380); };
    const box = h('div', { class: 'asheet' },
      h('div', { class: 'grp' },
        title || message ? h('div', { class: 'ttl' }, title ? h('b', null, title) : null, message || null) : null,
        acts.map((a) => h('button', { class: (a.role || '') + (a.strong ? ' strong' : ''), onClick: () => close(a.value) }, a.label))),
      h('div', { class: 'grp' }, h('button', { class: 'strong', onClick: () => close(null) }, 'Cancel')));
    scrim.addEventListener('click', () => close(null));
    host.append(scrim, box); void box.offsetWidth; scrim.classList.add('in'); box.classList.add('in');
  });
}

/* Toast and in-app notification */
let toastEl, toastT;
export function toast(text, iconName = 'check-circle:fill') {
  if (toastEl) toastEl.remove();
  toastEl = h('div', { class: 'toast' }, iconName ? ic(iconName, 18) : null, text);
  $('l-top').append(toastEl); void toastEl.offsetWidth; toastEl.classList.add('in');
  clearTimeout(toastT);
  const el = toastEl;
  toastT = setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, 2400);
}
export function notify({ title, body, onTap, ttl = 7000 }) {
  const el = h('button', { class: 'notif' },
    h('span', { class: 'appi' }, sol(26)),
    h('span', { style: 'flex:1;min-width:0' }, h('div', { class: 't1' }, title), h('div', { class: 't2' }, body)),
    h('span', { class: 'when' }, 'now'));
  let gone = false;
  const out = () => { if (gone) return; gone = true; el.classList.remove('in'); setTimeout(() => el.remove(), 600); };
  el.addEventListener('click', () => { out(); onTap && onTap(); });
  $('l-top').append(el); void el.offsetWidth; el.classList.add('in');
  setTimeout(out, ttl);
  return out;
}

/* Confetti */
export function celebrate(power = 1) {
  const host = $('l-top'); const c = h('canvas', { class: 'confetti' }); host.append(c);
  const r = host.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = r.width * dpr; c.height = r.height * dpr; const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
  const cols = ['#ffd15c', '#f4b62a', '#ffe7a3', '#a9c6e6', '#2a2a2a', '#ffffff', '#ffdc85'];
  const N = Math.round(90 * power); const ps = [];
  for (let i = 0; i < N; i++) {
    const a = (-Math.PI / 2) + (Math.random() - 0.5) * 1.5; const sp = 7 + Math.random() * 11;
    ps.push({ x: r.width / 2 + (Math.random() - 0.5) * 80, y: r.height * 0.52, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: 5 + Math.random() * 7, c: cols[i % cols.length], r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, o: Math.random() < 0.35 });
  }
  let t = 0;
  (function tick() {
    t++; ctx.clearRect(0, 0, r.width, r.height);
    for (const p of ps) {
      p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, 1 - t / 130); ctx.fillStyle = p.c;
      if (p.o) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 7); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    if (t < 130) requestAnimationFrame(tick); else c.remove();
  })();
}

/* Sol, the virtual nurse avatar: a living sun, evolved from the V1 assistant mark */
let uid = 0;
export function sol(size = 40, state = 'idle', cls = '') {
  const id = 'sg' + (++uid); let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = (i * 30) * Math.PI / 180; const r1 = 35.5; const r2 = i % 2 ? 42 : 46;
    rays += '<line x1="' + (50 + r1 * Math.cos(a)).toFixed(2) + '" y1="' + (50 + r1 * Math.sin(a)).toFixed(2) + '" x2="' + (50 + r2 * Math.cos(a)).toFixed(2) + '" y2="' + (50 + r2 * Math.sin(a)).toFixed(2) + '"/>';
  }
  return h('span', {
    class: 'sol ' + cls, style: '--s:' + size + 'px', 'data-state': state, role: 'img', 'aria-label': 'Sol',
    html: '<i class="halo"></i><svg viewBox="0 0 100 100"><defs><radialGradient id="' + id + '" cx="38%" cy="30%" r="78%"><stop offset="0" stop-color="#fff8dc"/><stop offset=".42" stop-color="#ffd869"/><stop offset="1" stop-color="#f2a916"/></radialGradient></defs><g class="rays" stroke="#f4b62a" stroke-width="5.4" stroke-linecap="round">' + rays + '</g><circle class="core" cx="50" cy="50" r="25" fill="url(#' + id + ')"/></svg>',
  });
}

/* Small shared builders */
export function navbar(title, onBack, right) {
  return h('div', { class: 'navbar' },
    onBack ? h('button', { class: 'iconbtn', 'aria-label': 'Back', onClick: onBack }, ic('caret-left', 22)) : h('span'),
    h('div', { class: 't' }, title || ''), right || h('span'));
}
export function page(title, buildBody, opts = {}) {
  const body = h('div', { class: 'scroll' });
  const view = { el: null, theme: opts.theme };
  const bar = navbar(title, () => closeView(view), opts.right ? opts.right(view) : null);
  view.el = h('div', { class: opts.cls || '' }, bar, body, opts.foot ? opts.foot(view) : null);
  view.update = () => { const st = body.scrollTop; body.replaceChildren(); add(body, [buildBody(view)]); body.scrollTop = st; };
  view.update();
  return view;
}
export function row({ lead, tile, t1, t2, right, onClick, chev = true }) {
  return h('button', { class: 'row' + (tile ? ' tiled' : ''), onClick },
    tile ? h('span', { class: 'tile ' + (tile.cls || '') }, ic(tile.icon, 22)) : lead ? ic(lead, 22, 'lead') : null,
    h('span', { class: 'grow' }, h('div', { class: 't1' }, t1), t2 ? h('div', { class: 't2' }, t2) : null),
    right || null, chev ? ic('caret-right', 18, 'chev') : null);
}
