// Enrolment flows: batch code unlock, joining by phone, the (simulated) call, activation and meeting Sol and Sofia.
import { MED } from './data.js';
import {
  fill, h, add, ic, store, now, sod, addDays, nextWeekday, iso, fmtDay, fmtLong, relDay, lineStatus, openSheet, sheetHead, actionSheet,
  openView, closeView, closeSheets, closeAllViews, celebrate, toast, notify, actions, sol, wait, refreshAll,
} from './core.js';
import { callDate, openCallDetails } from './journey.js';

/* ---------- Batch code ---------- */
export function openUnlock() {
  let code = ''; let verifying = false;
  const fmt = (c) => [c.slice(0, 3), c.slice(3, 5), c.slice(5, 8)].filter(Boolean).join(' ');
  openSheet((api) => {
    const box = h('div', { class: 'code-box focus' });
    const btn = h('button', { class: 'btn primary block', disabled: true }, 'Continue');
    const paint = () => { fill(box, code ? h('span', null, fmt(code)) : h('span', { class: 'ph' }, 'e.g. 000 00 000'), verifying ? null : h('i', { class: 'caret' })); btn.disabled = code.length < 8; };
    const key = (k) => { if (verifying) return; if (k === 'del') code = code.slice(0, -1); else if (code.length < 8) code += k; paint(); };
    const pad = h('div', { class: 'keypad' });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].forEach((k) => pad.append(k === '' ? h('span', { class: 'key blank' }) : h('button', { class: 'key' + (k === 'del' ? ' del' : ''), 'aria-label': k === 'del' ? 'Delete' : k, onClick: () => key(k) }, k === 'del' ? ic('backspace', 26) : k)));
    btn.addEventListener('click', async () => {
      verifying = true; btn.classList.add('loading'); paint(); box.classList.remove('focus');
      await wait(1500);
      store.set((s) => ({ stage: 'unlocked', dismissed: { ...s.dismissed, join: false } }));
      await api.close(); openUnlocked();
    });
    paint();
    return [
      sheetHead('', api),
      h('div', { class: 'sh-body', style: 'padding-bottom:6px' },
        h('h2', null, 'Access your support for ' + MED.brand),
        h('p', { class: 'lede' }, 'You’ll need to enter the batch code that comes with your medication. It is shown on the packet, often near the expiry date.'),
        h('div', { class: 'code-field' }, h('label', null, 'Batch code'), box),
        h('div', { class: 'demo-hint' }, 'Prototype: any 8 digits work. ', h('button', { onClick: () => { code = '01923847'; paint(); } }, 'Fill a demo code')),
        h('div', { class: 'pack' }, h('div', { class: 'l1' }), h('div', { class: 'l2' }), h('div', { class: 'sq' }),
          h('div', { class: 'bn' }, 'Batch No.', h('b', null, '000 00 000'), ic('arrow-bend-up-left', 18, 'arrow')), h('div', { class: 'ex' }, 'Exp. Date: SEP 2027')),
        h('div', { style: 'height:16px' }), btn,
        h('button', { class: 'btn text block', style: 'margin-top:2px', onClick: () => api.close() }, 'I don’t have it right now')),
      pad,
    ];
  }, { tall: true });
}
function openUnlocked() {
  celebrate(0.6);
  openSheet((api) => [
    sheetHead('', api),
    h('div', { class: 'sh-body' },
      h('div', { class: 'mark' }, ic('check', 30)),
      h('h2', { class: 'center mt20' }, MED.brand + ' support is active'),
      h('div', { class: 'incl' }, h('div', { class: 'lbl' }, 'What’s included'),
        h('div', { class: 'list' },
          h('div', { class: 'how' }, ic('lightbulb', 22, 'lead'), h('div', null, h('div', { class: 't1' }, 'Learn about your treatment'), h('div', { class: 't2' }, 'Guidance and tips about your medication.'))),
          h('div', { class: 'how' }, ic('phone', 22, 'lead'), h('div', null, h('div', { class: 't1' }, 'Support program'), h('div', { class: 't2' }, 'Join the support program to talk to a nurse by phone, and get a virtual nurse in the app.')))))),
    h('div', { class: 'sh-foot' }, h('button', { class: 'btn primary block', onClick: async () => { await api.close(); actions.openSupport(); } }, 'View my support')),
  ]);
}

/* ---------- Join by phone ---------- */
export function openJoin() {
  const ls = lineStatus();
  openSheet((api) => [
    sheetHead('', api),
    h('div', { class: 'sh-body' },
      h('h2', { class: 'center' }, 'Join the support program'),
      h('p', { class: 'lede center' }, 'Free phone support from a nurse, alongside your usual care.'),
      h('div', { class: 'incl' }, h('div', { class: 'lbl' }, 'How it works'),
        h('div', { class: 'list' },
          h('div', { class: 'how' }, ic('phone', 22, 'lead'), h('div', null, h('div', { class: 't1' }, 'Talk to a nurse'), h('div', { class: 't2' }, 'Call when you want to talk. Your nurse may call you too.'))),
          h('div', { class: 'how' }, ic('chats', 22, 'lead'), h('div', null, h('div', { class: 't1' }, 'What a nurse can help with'), h('div', { class: 't2' }, 'Taking your medication, side effects and practical questions. Nurses don’t diagnose or change your dose.'))),
          h('div', { class: 'how' }, ic('sun', 22, 'lead'), h('div', null, h('div', { class: 't1' }, 'A virtual nurse in between'), h('div', { class: 't2' }, 'Once you have joined, Sol answers questions in the app day and night and shows you what comes next.'))),
          h('div', { class: 'how' }, ic('user-focus', 22, 'lead'), h('div', null, h('div', { class: 't1' }, 'Join in one call'), h('div', { class: 't2' }, 'There is nothing to fill in first. You are set up while you talk.')))))),
    h('div', { class: 'sh-foot' },
      h('div', { class: 'hours' }, h('i', { class: 'live' + (ls.open ? '' : ' off') }), 'Open ' + MED.hours),
      h('button', { class: 'btn primary block', onClick: async () => {
        const go = await actionSheet({ actions: [{ label: 'Call ' + MED.phone, value: true }] });
        if (go) { await api.close(); startCall({ join: true }); }
      } }, ic('phone', 18), 'Call ' + MED.phone)),
  ], { tall: true });
}

/* ---------- Simulated call ---------- */
export function startCall({ join = false } = {}) {
  let t = 0; let timer; let connected = false; let ready = false; const timers = [];
  const st = h('div', { class: 'st' }, 'Calling…');
  const caps = h('div', { class: 'captions' });
  const end = h('button', { class: 'cbtn end' }, h('span', { class: 'c' }, ic('phone-disconnect:fill', 30)), 'End');
  const mute = h('button', { class: 'cbtn', onClick: (e) => e.currentTarget.classList.toggle('on') }, h('span', { class: 'c' }, ic('microphone-slash:fill', 26)), 'Mute');
  const spk = h('button', { class: 'cbtn', onClick: (e) => e.currentTarget.classList.toggle('on') }, h('span', { class: 'c' }, ic('speaker-high:fill', 26)), 'Speaker');
  const view = { theme: '#3a311c' };
  view.el = h('div', { class: 'callscreen', style: 'display:flex;flex-direction:column' },
    h('div', { class: 'who' }, h('div', { class: 'ring' }, join ? ic('headset', 46) : 'S'), h('h2', null, join ? 'Nurse line' : 'Sofia, nurse team'), st),
    caps, h('div', { class: 'callctl' }, mute, end, spk));
  const cap = (who, text, sys) => caps.append(sys ? h('div', { class: 'cap sys' }, ic('check-circle:fill', 20), h('span', null, text)) : h('div', { class: 'cap' }, h('small', null, who), text));
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  later(1700, () => {
    connected = true; view.el.classList.add('connected');
    timer = setInterval(() => { t++; st.textContent = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }, 1000); st.textContent = '00:00';
    if (join) {
      later(500, () => cap('Sofia, nurse', 'Hello, you’ve reached the Ezmekly support line. I’m Sofia. Would you like to join the program?'));
      later(3600, () => cap('Sofia, nurse', 'I’ll take your name and date of birth, and read you the consent. It takes a couple of minutes.'));
      later(6800, () => { cap('', 'Registered. You can hang up when you’re ready.', true); ready = true; end.classList.add('pulse'); });
    } else {
      later(500, () => cap('Sofia, nurse', 'Hi ' + store.get().name + ', it’s Sofia. I can see your journey and your check-ins, so we can pick up where you are.'));
      later(3800, () => cap('', 'This is a prototype. A real call would open your phone app.', true));
    }
  });
  end.addEventListener('click', async () => {
    timers.forEach(clearTimeout); clearInterval(timer);
    await closeView(view);
    if (join) {
      if (connected) { store.set({ stage: 'activating', activatingSince: Date.now() }); await closeAllViews(); actions.goTab('home'); watchActivation(); toast('Thanks for joining', 'phone-call:fill'); }
      else toast('Call ended', null);
    } else if (connected && t >= 1) {
      const s = store.get(); const cd = callDate();
      if (cd && !s.call.done && iso(cd) === iso(now())) store.set((x) => ({ call: { ...x.call, done: true } }));
      toast('Call ended · ' + st.textContent, 'phone:fill');
    }
  });
  openView(view, 'modal');
}

/* ---------- Activation ---------- */
const ACTIVATE_MS = 14000;
let watchT = null;
export function watchActivation() {
  clearTimeout(watchT);
  const s = store.get(); if (s.stage !== 'activating') return;
  const left = Math.max(0, ACTIVATE_MS - (Date.now() - s.activatingSince));
  watchT = setTimeout(() => activate(true), left);
}
export function activate(announce) {
  clearTimeout(watchT);
  const s = store.get(); if (s.stage === 'active') return;
  const today = sod(now());
  store.set({ stage: 'active', enrolDay: iso(today), activatingSince: null, call: { ...s.call, dayIso: iso(nextWeekday(addDays(today, 2))), time: '10:30', done: false, moved: false } });
  if (announce) notify({ title: 'Rare & Me', body: 'Your nurse support is ready.', onTap: () => openMeet(), ttl: 9000 });
}
export function activationProgress() {
  const s = store.get(); if (s.stage !== 'activating') return 1;
  return Math.min(1, (Date.now() - s.activatingSince) / ACTIVATE_MS);
}

/* ---------- Meet Sol and Sofia ---------- */
export function openMeet() {
  if (store.get().stage !== 'active') return;
  closeSheets();
  let i = 0; const s = store.get(); const cd = callDate();
  const view = { theme: '#cfe0f1' };
  const pager = h('div', { class: 'pager' }, h('i'), h('i'), h('i'));
  const mk = (artEl, title, lede, extra, label, onNext) => h('div', { class: 'pane' }, h('div', { class: 'art' }, artEl), h('div', null, h('h1', null, title), h('p', { class: 'lede' }, lede), extra || null,
    h('div', { style: 'height:18px' }), h('button', { class: 'btn primary block', style: 'height:54px;font-size:16px;font-weight:600', onClick: onNext }, label)));
  let rise = null;
  const go = (n) => {
    i = n; panes.forEach((p, k) => { p.classList.toggle('on', k === i); p.classList.toggle('off', k < i); });
    [...pager.children].forEach((d, k) => d.classList.toggle('on', k === i));
    if (rise) rise.style.opacity = i === 0 ? 1 : 0;
  };
  const finish = async () => {
    store.set({ metSol: true });
    await closeView(view); actions.goTab('care', true); celebrate(0.8);
  };
  const panes = [
    mk(h('div', { class: 'rise-in' }, sol(164, 'idle')), 'Your nurse support is ready', 'You’re registered, ' + s.name + '. From here you have two people in your corner, and a clear view of what happens next.', null, 'Meet them', () => go(1)),
    mk(sol(150, 'speaking'), 'This is Sol', 'Your virtual nurse. Here day and night, in the app.',
      h('div', { class: 'facts' },
        h('div', { class: 'fact' }, ic('check-circle:fill', 20), h('div', null, h('b', null, 'Answers and guides'), h('span', { class: 'd' }, 'Uses approved information about Ezmekly and what you log here.'))),
        h('div', { class: 'fact' }, ic('warning', 20), h('div', null, h('b', null, 'An AI, not a nurse or doctor'), h('span', { class: 'd' }, 'No medical advice, no diagnosis, no dose changes. If you mention a side effect, it is reported to the safety team.')))),
      'I understand', () => go(2)),
    mk(h('span', { class: 'avatar', style: 'width:132px;height:132px;font-size:52px;box-shadow:0 20px 40px rgba(60,100,160,.25)' }, 'S'), 'And this is Sofia', 'Your nurse. A real person, by phone, ' + MED.hours + '.',
      h('div', { class: 'facts' },
        h('div', { class: 'fact' }, ic('calendar-check', 20), h('div', null, h('b', null, 'Welcome call ' + (cd ? relDay(cd, true) + ' at ' + s.call.time : 'soon')), h('span', { class: 'd' }, 'She calls you. You can move the time whenever you like.'))),
        h('div', { class: 'fact' }, ic('phone', 20), h('div', null, h('b', null, 'One tap away'), h('span', { class: 'd' }, 'You never need Sol’s permission to talk to a nurse.')))),
      'See my journey', finish),
  ];
  view.el = h('div', { class: 'meet' }, h('div', { class: 'sky' }, h('div', { class: 'hill' })), panes,
    h('div', { style: 'position:absolute;left:0;right:0;top:calc(var(--safe-t) + 14px)' }, pager));
  openView(view, 'fade');
  requestAnimationFrame(() => go(0));
}

/* ---------- Calling a nurse once enrolled ---------- */
export function callNurse() {
  const s = store.get();
  if (s.stage !== 'active') return openJoin();
  const ls = lineStatus(); const cd = callDate(); const callOpen = cd && !s.call.done && cd >= sod(now());
  openSheet((api) => [
    sheetHead('Talk to a nurse', api),
    h('div', { class: 'sh-body' },
      h('div', { class: 'center', style: 'padding-top:4px' }, h('span', { class: 'avatar lg', style: 'margin:0 auto' }, 'S', h('i', { class: 'on' + (ls.open ? '' : ' off'), style: 'width:16px;height:16px' })),
        h('h2', { class: 'mt12' }, 'Sofia and the nurse team'), h('p', { class: 'lede', style: 'margin-top:4px' }, ls.label)),
      h('div', { class: 'list mt20' },
        callOpen ? h('button', { class: 'row tiled', onClick: async () => { await api.close(); openCallDetails(); } }, h('span', { class: 'tile sky' }, ic('calendar-check', 22)), h('span', { class: 'grow' }, h('div', { class: 't1' }, 'Welcome call ' + relDay(cd, true) + ', ' + s.call.time), h('div', { class: 't2' }, 'Sofia calls you. Tap to prepare or move it.')), ic('caret-right', 18, 'chev')) : null,
        h('button', { class: 'row tiled', onClick: async () => { await api.close(); actions.openChat({ focus: true }); } }, h('span', { class: 'tile' }, sol(26)), h('span', { class: 'grow' }, h('div', { class: 't1' }, 'Rather type? Ask Sol'), h('div', { class: 't2' }, 'Your virtual nurse, here day and night.')), ic('caret-right', 18, 'chev'))),
      h('p', { class: 'small muted mt16 center' }, 'In an emergency, call your local emergency number.')),
    h('div', { class: 'sh-foot' }, h('button', { class: 'btn sky block', style: 'height:52px', onClick: async () => { await api.close(); startCall({}); } }, ic('phone:fill', 18), 'Call ' + MED.phone)),
  ]);
}

actions.openUnlock = openUnlock; actions.openJoin = openJoin; actions.callNurse = callNurse; actions.openMeet = openMeet;
export { refreshAll, fmtDay, fmtLong, add };
