// Boot, app shell, tabs, the Sol button and the dock, prototype presets and timed triggers.
import {
  fill, h, ic, $, store, fresh, setBaseTheme, registerTabView, refreshAll, actions, sol, now, sod, addDays, iso, fromIso, nextWeekday, notify, toast,
  closeAllViews, closeSheets, openSheet, sheetHead, diffDays, fmtDay, wait, row,
} from './core.js';
import { homeTab, careTab, insightsTab, learningTab, settingsTab, openSymptoms, openSchedule } from './screens.js';
import './chat.js';
import { watchActivation, openMeet } from './flows.js';
import { callDate, openCallDetails, computeJourney } from './journey.js';

const app = $('app');
const lTabs = h('div', { id: 'l-tabs', class: 'layer' });
app.append(lTabs, h('div', { id: 'l-stack', class: 'layer' }), h('div', { id: 'l-sheets', class: 'layer' }), h('div', { id: 'l-top', class: 'layer' }));

/* ---------- Tabs ---------- */
const TABS = [['home', 'Home', 'house'], ['care', 'My Care', 'heartbeat'], ['insights', 'Insights', 'chart-bar'], ['learning', 'Learning', 'books'], ['settings', 'Settings', 'user-circle']];
const views = { home: homeTab(), care: careTab(), insights: insightsTab(), learning: learningTab(), settings: settingsTab(preset) };
let current = 'home';
const tabbar = h('nav', { class: 'tabbar' });
const fab = h('button', { class: 'fab', 'aria-label': 'Quick actions' }, ic('plus', 26));
const dock = h('div', { class: 'dock hide' },
  h('button', { class: 'ask-b', onClick: () => actions.openChat({ focus: true }) }, sol(44, 'idle', 'dark'), h('span', { class: 'grow' }, 'Ask Sol', h('small', null, 'AI, answers from your materials')), ic('arrow-right', 18)));
Object.values(views).forEach((v) => { lTabs.append(v.el); registerTabView(v); });
lTabs.append(dock, fab, tabbar);

function paintTabbar() {
  const s = store.get(); const j = s.stage === 'active' && s.metSol ? computeJourney() : null;
  fill(tabbar, ...TABS.map(([id, label, icon]) => h('button', { class: 'tab' + (id === current ? ' on' : ''), 'aria-label': label, onClick: () => goTab(id) },
    ic(id === current ? icon + ':duo' : icon, 24), label, id === 'care' && current !== 'care' && j && j.current ? h('i', { class: 'dot' }) : null)));
}
function syncChrome() {
  const s = store.get(); const live = s.stage === 'active' && s.metSol;
  const showDock = live && current === 'care';
  dock.classList.toggle('hide', !showDock);
  fab.classList.toggle('hide', showDock || current === 'settings');
  paintTabbar();
}
fab.addEventListener('click', () => {
  const s = store.get(); hideTip(); const live = s.stage === 'active' && s.metSol;
  // Sol sits at the top of the quick actions, set apart from the logging shortcuts.
  openSheet((api) => [sheetHead('', api), h('div', { class: 'sh-body', style: 'padding-bottom:calc(18px + var(--safe-b))' },
    live ? h('button', { class: 'solrow', onClick: async () => { await api.close(); actions.openChat({ focus: true }); } }, sol(44, 'idle'),
      h('span', { class: 'grow' }, h('div', { class: 't1' }, 'Ask Sol ', h('span', { class: 'badge ai' }, 'AI')), h('div', { class: 't2' }, 'Your assistant. Answers from your materials.')), h('span', { class: 'go' }, ic('arrow-right', 18))) : null,
    h('div', { class: 'list' + (live ? ' mt12' : '') },
      row({ tile: { icon: 'lightning' }, t1: 'Log symptoms', onClick: async () => { await api.close(); openSymptoms(); }, chev: false }),
      row({ tile: { icon: 'first-aid-kit' }, t1: 'Log medication', onClick: async () => { await api.close(); openSchedule(); }, chev: false })))]);
});
export function goTab(id, focus) {
  current = id;
  Object.entries(views).forEach(([k, v]) => v.el.classList.toggle('on', k === id));
  setBaseTheme(views[id].theme || '#f9f7f3'); syncChrome();
  if (id === 'care' && focus && views.care.focusCurrent) views.care.focusCurrent();
  if (id === 'home') setTimeout(maybeTip, 900);
}
actions.goTab = goTab;

/* ---------- Sol tip, shown once after meeting Sol ---------- */
let tipEl = null;
function hideTip() { if (tipEl) { const t = tipEl; tipEl = null; t.classList.add('out'); setTimeout(() => t.remove(), 260); } }
function maybeTip() {
  const s = store.get();
  if (tipEl || s.tipSeen || !(s.stage === 'active' && s.metSol) || current !== 'home') return;
  tipEl = h('div', { class: 'fab-tip' }, 'Tap + to ask Sol'); lTabs.append(tipEl);
  store.set({ tipSeen: true }); setTimeout(hideTip, 5200);
}

/* ---------- Prototype presets and time travel ---------- */
async function preset(kind, n) {
  await closeSheets(); await closeAllViews();
  const keep = { presenter: store.get().presenter, journeyStyle: store.get().journeyStyle, installSeen: true };
  if (kind === 'time') {
    const s = store.get(); const from = sod(now()); const offset = n === 0 ? 0 : (s.dayOffset || 0) + n; const doses = { ...s.doses };
    if (n > 0) { // the simulated patient keeps logging on the days we skip
      const start = fromIso(s.treatmentStart);
      for (let i = 0; i < n; i++) { const d = addDays(from, i); if ((diffDays(d, start) % 28) >= 21) continue; const k = iso(d); doses[k] = { am: 'taken', pm: 'taken', ...(doses[k] || {}) }; if (!doses[k].am) doses[k].am = 'taken'; if (!doses[k].pm) doses[k].pm = 'taken'; }
    }
    store.set({ dayOffset: offset, doses });
    toast(n === 0 ? 'Back to today' : 'Now ' + fmtDay(now()), 'clock');
    setTimeout(triggers, 1400); return;
  }
  const f = { ...fresh(), ...keep };
  if (kind === 'unlocked') f.stage = 'unlocked';
  if (kind === 'active') { const t = sod(new Date()); f.stage = 'active'; f.enrolDay = iso(t); f.metSol = true; f.tipSeen = true; f.solAck = true; f.call = { ...f.call, dayIso: iso(nextWeekday(addDays(t, 2))) }; }
  store.set(f); goTab(kind === 'active' ? 'care' : 'home', kind === 'active');
  toast(kind === 'available' ? 'Started over' : kind === 'unlocked' ? 'Support unlocked' : 'Nurse support active', 'presentation-chart');
}

/* ---------- Timed triggers: deterministic outreach at journey time points ---------- */
function triggers() {
  const s = store.get();
  if (s.stage === 'activating') return watchActivation();
  if (!(s.stage === 'active' && s.metSol)) return;
  const mark = (k) => store.set((x) => ({ notified: { ...x.notified, [k]: true } }));
  const j = computeJourney(); const queue = [];
  for (const id of ['c-week1', 'c-week2']) {
    const st = j.phases[1].steps.find((x) => x.id === id);
    if (st && (st.state === 'current' || st.state === 'open') && !s.notified[id]) queue.push(() => { mark(id); notify({ title: 'Sol', body: 'Your week ' + (id === 'c-week1' ? 1 : 2) + ' check-in is ready. It takes two minutes.', onTap: () => actions.openChat({ checkin: id }) }); });
  }
  const cd = callDate();
  if (cd && !s.call.done) {
    const dd = diffDays(cd, now()); const k = 'call' + dd + s.call.dayIso;
    if (dd === 1 && !s.notified[k]) queue.push(() => { mark(k); notify({ title: 'Call tomorrow', body: 'A nurse will call you tomorrow at ' + s.call.time + '.', onTap: () => openCallDetails() }); });
    if (dd === 0 && !s.notified[k]) queue.push(() => { mark(k); notify({ title: 'Your call is today', body: 'A nurse will call you at ' + s.call.time + '. Tap to add notes.', onTap: () => openCallDetails() }); });
  }
  queue.slice(0, 2).forEach((fn, i) => setTimeout(fn, i * 8200));
}

/* ---------- Boot ---------- */
let lastStage = store.get().stage + store.get().metSol;
store.sub((s) => {
  refreshAll(); syncChrome();
  const key = s.stage + s.metSol;
  if (key !== lastStage) { lastStage = key; if (s.stage === 'active' && s.metSol) setTimeout(maybeTip, 2600); }
});
refreshAll(); goTab('home');

const splash = h('div', { class: 'splash' }, h('div', { class: 'hill' }),
  h('div', { class: 'logo' }, sol(104, 'idle'), h('h1', null, 'Rare & Me'), h('div', { class: 'tagl' }, 'With you between visits')),
  h('div', { class: 'proto-tag' }, 'Concept prototype · not for patient use'));
$('l-top').append(splash);
setTimeout(() => { splash.classList.add('out'); setTimeout(() => splash.remove(), 700); setTimeout(triggers, 1200); setTimeout(installHint, 5000); }, 1500);

// Fit the app to the visible viewport so the chat composer sits on top of the iOS keyboard.
const vv = window.visualViewport; const root = document.documentElement;
if (vv && window.matchMedia('(max-width: 619px)').matches) {
  const fit = () => { root.style.setProperty('--vvh', vv.height + 'px'); root.style.setProperty('--vvo', vv.offsetTop + 'px'); };
  vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
}
document.addEventListener('touchstart', () => {}, { passive: true }); // enables :active states on iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshAll(); triggers(); } });

function installHint() {
  const s = store.get(); const ios = /iphone|ipad|ipod/i.test(navigator.userAgent); const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  if (!ios || standalone || s.installSeen) return;
  const el = h('div', { class: 'install' }, sol(36, 'idle', 'dark'), h('div', null, h('b', null, 'Make it feel like the real app. '), 'Tap Share, then Add to Home Screen.'),
    h('button', { class: 'x', 'aria-label': 'Dismiss', onClick: () => { el.classList.remove('in'); store.set({ installSeen: true }); setTimeout(() => el.remove(), 600); } }, ic('x', 18)));
  lTabs.append(el); requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { if (el.isConnected) { el.classList.remove('in'); setTimeout(() => el.remove(), 600); } }, 12000);
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
window.__proto = { store, preset, goTab, openMeet, triggers }; // handy for demos and tests
