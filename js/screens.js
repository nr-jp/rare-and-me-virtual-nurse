// Tab screens and pages: Home, My Care, Insights, Learning, Settings, plus support, appointments, schedule and symptom logging.
import { MED, ARTICLES, ABOUT, SYMPTOMS, SEVERITY, symptomById } from './data.js';
import {
  fill, h, add, ic, store, fresh, now, sod, addDays, iso, fromIso, diffDays, fmtDay, fmtLong, fmtDate, wdShort, moShort, relDay, greeting, lineStatus, cycleInfo, doseStats,
  openSheet, sheetHead, actionSheet, openView, closeView, closeAllViews, closeSheets, toast, celebrate, actions, sol, page, row, refreshAll, nextWeekday,
} from './core.js';
import { cycleCard, journeyBlock, scrollToCurrent, callDate, computeJourney, openCallDetails, openReminders, drawTrails } from './journey.js';
import { openUnlock, openJoin, openMeet, activate, activationProgress, callNurse } from './flows.js';

/* ---------- Shared bits ---------- */
function doseOf(dayIso) { return store.get().doses[dayIso] || {}; }
function setDose(dayIso, slot, val) { store.set((s) => ({ doses: { ...s.doses, [dayIso]: { ...(s.doses[dayIso] || {}), [slot]: val } } })); }
function isRestDay(d) { const n = diffDays(d, fromIso(store.get().treatmentStart)); return n >= 0 && (n % 28) >= 21; }
async function logDose(dayIso, slot) {
  const s = store.get(); const time = slot === 'am' ? s.reminders.am : s.reminders.pm; const cur = doseOf(dayIso)[slot];
  const acts = cur ? [{ label: cur === 'taken' ? 'Log as not taken' : 'I took this medication', value: cur === 'taken' ? 'skipped' : 'taken' }, { label: 'Delete this log', value: 'clear', role: 'destructive' }]
    : [{ label: 'I took this medication', value: 'taken' }, { label: 'I did not take this medication', value: 'skipped' }];
  const v = await actionSheet({ title: MED.brand + ' · ' + MED.dose, message: 'Take at ' + time, actions: acts });
  if (!v) return;
  setDose(dayIso, slot, v === 'clear' ? null : v);
  if (v === 'taken') toast('Logged as taken'); else if (v === 'skipped') toast('Logged as not taken', 'info'); else toast('Log removed', null);
}
function medCard(dayIso, slot, { compact } = {}) {
  const s = store.get(); const v = doseOf(dayIso)[slot]; const time = slot === 'am' ? s.reminders.am : s.reminders.pm;
  const badge = v === 'taken' ? h('span', { class: 'badge ok' }, 'Taken') : v === 'skipped' ? h('span', { class: 'badge warn' }, 'Not taken') : h('span', { class: 'badge' }, 'No log');
  return h('button', { class: 'med', onClick: () => logDose(dayIso, slot) },
    h('div', { class: 'top' }, h('span', { class: 'tile' }, ic('pill', 22)),
      h('div', { style: 'flex:1;min-width:0;text-align:left' }, h('div', { class: 'name' }, MED.brand), h('div', { class: 'sub' }, (compact ? '' : time + ' · ') + MED.dose)), badge),
    slot === 'am' && !v ? h('div', { class: 'note' }, ic('clipboard-text', 18), 'Swallow whole with water') : null,
    v === 'taken' ? h('div', { class: 'note ok' }, ic('check', 18), MED.dose + ' logged') : null);
}
function articleCard(a) {
  return h('button', { class: 'article', onClick: () => openArticle(a.id) },
    h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 't' }, a.title), h('div', { class: 'dt' }, a.date), h('span', { class: 'tag' + (a.branded ? ' sun' : '') }, a.tag)),
    h('div', { class: 'thumb', style: 'background:' + (a.tone === 'sun' ? 'linear-gradient(140deg,#fff3cf,#ffe19a)' : 'linear-gradient(140deg,#e8f0fa,#cfe0f3)') + ';color:' + (a.tone === 'sun' ? '#8a6500' : '#2a5a99') }, ic(a.icon, 38)));
}
function setupCard(compact) {
  const bar = h('i'); const steps = [h('div', { class: 'sstep done' }, h('span', { class: 'b' }, ic('check', 12)), 'Registered on your call'), h('div', { class: 'sstep' }, h('span', { class: 'b' }, ic('check', 12)), 'Linking your app and the program'), h('div', { class: 'sstep' }, h('span', { class: 'b' }, ic('check', 12)), 'Getting Sol and your journey ready')];
  const el = h('div', { class: 'setup' },
    h('div', { class: 'hstack', style: 'gap:12px;align-items:flex-start' }, sol(40, 'thinking'), h('div', { style: 'flex:1' }, h('h3', null, 'Setting up your nurse support'), h('p', null, 'This usually takes a few minutes after your call. We’ll let you know when it’s ready.'))),
    h('div', { class: 'bar' }, bar), compact ? null : h('div', { class: 'setup-steps' }, steps),
    h('div', { class: 'demo-hint', style: 'padding:0;margin-top:12px' }, 'Prototype: about 15 seconds. ', h('button', { onClick: () => activate(true) }, 'Skip the wait')));
  const tick = () => {
    if (!el.isConnected) return; const p = activationProgress(); bar.style.width = Math.round(p * 100) + '%';
    steps[1].className = 'sstep ' + (p > 0.55 ? 'done' : 'now'); steps[2].className = 'sstep ' + (p >= 1 ? 'done' : p > 0.55 ? 'now' : '');
    if (p < 1) setTimeout(tick, 400);
  };
  setTimeout(tick, 60);
  return el;
}
function readyCard() {
  return h('div', { class: 'hcard', style: 'border-radius:22px;background:linear-gradient(140deg,#fff,#fff7df);box-shadow:0 10px 30px rgba(160,120,20,.14);border-color:#fff' },
    h('div', { class: 'head' }, sol(52, 'speaking'), h('div', null, h('div', { class: 'kicker' }, MED.brand + ' support'), h('h3', null, 'Your nurse support is ready'))),
    h('p', null, 'Meet Sol, your assistant, and Sofia, your nurse. Then see your journey.'),
    h('div', { class: 'btnstack' }, h('button', { class: 'btn primary block', onClick: () => openMeet() }, 'Meet Sol and Sofia')));
}

/* ---------- Home ---------- */
export function homeTab() {
  const scroll = h('div', { class: 'scroll' }); const el = h('div', { class: 'screen tab-screen home' }, scroll);
  let lastKey = null;
  function update() {
    const s = store.get(); const top = scroll.scrollTop; const today = iso(now()); const rest = isRestDay(now());
    const key = s.stage + (s.metSol ? 'm' : ''); const animate = key !== lastKey; lastKey = key;
    const c = h('div', { class: 'home-content pad' + (animate ? ' rise' : '') });
    const dismiss = (k) => () => store.set((x) => ({ dismissed: { ...x.dismissed, [k]: true } }));

    if (s.stage === 'available' && !s.dismissed.support) {
      c.append(h('div', { class: 'hcard' },
        h('div', { class: 'head' }, h('span', { class: 'tile round' }, ic('lifebuoy', 26)), h('div', null, h('div', { class: 'kicker' }, 'For people taking ' + MED.brand), h('h3', null, 'Support is available for your treatment'))),
        h('p', null, 'Extra guidance made for ' + MED.brand + ', and a nurse you can talk to. You’ll need the batch code from your medication box.'),
        h('div', { class: 'btnstack' }, h('button', { class: 'btn primary block', onClick: () => openUnlock() }, 'Get support'), h('button', { class: 'btn secondary block', onClick: dismiss('support') }, 'Not now'))));
    }
    if (s.stage === 'unlocked' && !s.dismissed.join) {
      c.append(h('div', { class: 'hcard' },
        h('div', { class: 'head' }, h('span', { class: 'tile round' }, ic('lifebuoy', 26)), h('div', null, h('div', { class: 'kicker' }, MED.brand + ' support'), h('h3', null, 'Join the support program'))),
        h('p', null, 'A nurse can help you through your first weeks on treatment. Join to talk to them by phone.'),
        h('div', { class: 'btnstack' }, h('button', { class: 'btn primary block', onClick: () => openJoin() }, 'Join'), h('button', { class: 'btn secondary block', onClick: dismiss('join') }, 'Not now'))));
    }
    if (s.stage === 'activating') c.append(setupCard());
    if (s.stage === 'active' && !s.metSol) c.append(readyCard());
    if (s.stage === 'active' && s.metSol) {
      const cd = callDate(); const dd = cd ? diffDays(cd, now()) : 9;
      if (cd && !s.call.done && dd >= 0 && dd <= 1 && !s.dismissed['prep' + s.call.dayIso]) {
        c.append(h('div', { class: 'hcard', style: 'margin-bottom:12px' },
          h('div', { class: 'kicker' }, fmtLong(cd) + ' at ' + s.call.time), h('h3', { style: 'margin-top:2px' }, 'Take a moment to prepare for your call'),
          h('p', null, 'Note any questions you have and what you’d like to discuss with Sofia.'),
          h('div', { class: 'btnrow', style: 'margin-top:14px;justify-content:flex-end' }, h('button', { class: 'btn secondary md', onClick: dismiss('prep' + s.call.dayIso) }, 'Not now'), h('button', { class: 'btn primary md', onClick: () => openCallDetails() }, 'Prepare for call'))));
      }
      c.append(cycleCard());
      c.append(h('div', null,
        h('button', { class: 'ask', onClick: () => actions.openChat({ focus: true }) }, sol(34), h('span', { class: 'ph' }, 'Ask Sol about your treatment'), h('span', { class: 'send' }, ic('arrow-up', 18))),
        h('button', { class: 'nurse-strip', onClick: () => callNurse() }, h('span', { class: 'avatar' }, 'S', h('i', { class: 'on' + (lineStatus().open ? '' : ' off') })),
          h('span', { style: 'flex:1;min-width:0' }, h('div', { class: 't1' }, 'Sofia, your nurse'), h('div', { class: 't2' }, cd && !s.call.done && dd >= 0 ? 'Welcome call ' + relDay(cd, true) + ' at ' + s.call.time : lineStatus().label)),
          h('span', { class: 'callbtn' }, ic('phone:fill', 18)))));
    }

    const d = doseOf(today); const logged = ['am', 'pm'].filter((k) => d[k]).length;
    c.append(h('div', null, h('div', { class: 'section-h' }, h('span', null, 'Today’s medications'), rest ? null : h('button', { onClick: () => openSchedule() }, logged + '/2 logged', ic('caret-right', 14))),
      rest ? h('div', { class: 'med', style: 'pointer-events:none' }, h('div', { class: 'top' }, h('span', { class: 'tile sky' }, ic('moon', 22)), h('div', { style: 'text-align:left' }, h('div', { class: 'name' }, 'Rest week'), h('div', { class: 'sub' }, 'No ' + MED.brand + ' today. Cycle ' + (cycleInfo().cycle + 1) + ' starts ' + relDay(cycleInfo().nextCycle, true) + '.'))))
        : h('div', { class: 'stack', style: 'gap:10px' }, medCard(today, 'am'), medCard(today, 'pm'))));

    const todays = s.symptoms.filter((x) => x.date === today);
    c.append(h('div', null, h('div', { class: 'section-h' }, h('span', null, 'Check-in')),
      todays.length ? h('div', { class: 'hcard' }, h('div', { class: 'head' }, h('span', { class: 'tile round', style: 'background:var(--ok-bg);color:var(--ok)' }, ic('check', 24)), h('div', null, h('h3', null, 'Symptoms logged today'), h('div', { class: 'kicker' }, todays.flatMap((t) => t.items).map((i) => i.id === 'none' ? 'Symptom-free day' : symptomById(i.id).t).join(', ')))),
        h('div', { class: 'btnstack' }, h('button', { class: 'btn secondary block', onClick: () => openSymptoms() }, 'Log another')))
        : h('div', { class: 'hcard' },
          h('div', { class: 'head' }, h('span', { class: 'tile round' }, ic('lightning', 26)), h('h3', null, 'Experiencing any symptoms today?')),
          h('p', null, 'Log any symptoms or choose ‘none to log’ for a symptom-free day.'),
          h('div', { class: 'btnstack' }, h('button', { class: 'btn primary block', onClick: () => openSymptoms() }, 'Log symptoms'),
            h('button', { class: 'btn secondary block', onClick: () => { store.set((x) => ({ symptoms: [...x.symptoms, { date: today, items: [{ id: 'none', sev: 0 }] }] })); toast('Logged a symptom-free day'); } }, 'None to log')))));

    c.append(h('div', null, h('div', { class: 'section-h' }, h('span', null, 'Recommended for you')), articleCard(ARTICLES[s.stage === 'available' ? 1 : 0])));

    fill(scroll, h('div', { class: 'home-bg' }), h('div', { class: 'home-fade' }), h('div', { class: 'titlebar', style: 'position:relative' }, h('h1', null, greeting() + ', ' + s.name)), c);
    scroll.scrollTop = top;
  }
  return { el, update, name: 'home', scroll, theme: '#c9dcef' };
}

/* ---------- My Care ---------- */
export function careTab() {
  const scroll = h('div', { class: 'scroll' }); const el = h('div', { class: 'screen tab-screen' }, scroll);
  let lastKey = null;
  function update() {
    const s = store.get(); const top = scroll.scrollTop; const key = s.stage + (s.metSol ? 'm' : ''); const animate = key !== lastKey; lastKey = key;
    const c = h('div', { class: 'pad' + (animate ? ' rise' : '') });
    if (s.stage === 'active') {
      c.append(h('div', { class: 'shortcuts' },
        h('button', { class: 'shortcut', onClick: () => openSchedule() }, h('span', { class: 'tile sm' }, ic('list-checks', 18)), 'Medication schedule'),
        h('button', { class: 'shortcut', onClick: () => openAppointments() }, h('span', { class: 'tile sm' }, ic('calendar-dots', 18)), 'Appointments'),
        h('button', { class: 'shortcut', onClick: () => openSupport() }, h('span', { class: 'tile sm' }, ic('hand-heart', 18)), MED.brand + ' support')));
      if (!s.metSol) c.append(h('div', { style: 'margin-top:14px' }, readyCard()));
      else c.append(journeyBlock(animate));
    } else {
      const sub = s.stage === 'available' ? 'Access support for your treatment' : s.stage === 'unlocked' ? 'Support active. Join the nurse program' : 'Setting up your nurse support';
      c.append(h('div', { class: 'stack', style: 'margin-top:8px;gap:14px' },
        h('div', { class: 'list' }, row({ lead: 'list-checks', t1: 'Medication schedule', onClick: () => openSchedule() }), row({ lead: 'pill', t1: 'My medications', onClick: () => openSupport() })),
        h('div', { class: 'list' }, row({ lead: 'calendar-dots', t1: 'Appointments', onClick: () => openAppointments() })),
        h('div', { class: 'list' }, row({ lead: 'hand-heart', t1: MED.brand + ' support', t2: sub, onClick: () => openSupport() }))));
    }
    fill(scroll, h('div', { class: 'titlebar' }, h('h1', null, 'My Care')), c);
    scroll.scrollTop = top;
  }
  const v = { el, update, name: 'care', scroll, theme: '#f9f7f3' };
  v.focusCurrent = () => setTimeout(() => { drawTrails(scroll); scrollToCurrent(scroll, true); }, 380);
  return v;
}

/* ---------- Support page ---------- */
export function openSupport() {
  const v = page(MED.brand + ' support', (view) => {
    const s = store.get(); const ls = lineStatus(); const st = fromIso(s.treatmentStart);
    const out = h('div', { class: 'pad', style: 'padding-bottom:40px' });
    out.append(h('div', { style: 'padding-top:10px' },
      s.stage === 'available' ? h('span', { class: 'badge info' }, ic('lock-simple:fill', 13), 'Support available') : h('span', { class: 'badge ok' }, ic('check-circle:fill', 13), 'Support active'),
      h('h1', { style: 'font-size:24px;line-height:30px;font-weight:600;margin-top:8px;letter-spacing:-.015em' }, MED.brand), h('div', { class: 'muted' }, MED.generic)));
    if (s.stage === 'available') {
      out.append(h('p', { class: 'muted mt16', style: 'font-size:16px;line-height:24px' }, 'Additional support is available for your treatment. You will need the batch code from your medication box to access it.'));
      return out;
    }
    if (s.stage === 'unlocked') out.append(h('div', { class: 'card lg mt20', style: 'padding:16px;display:flex;gap:12px' }, ic('phone-call', 24), h('div', null, h('div', { style: 'font-weight:600' }, 'Nurse support'), h('div', { class: 'muted small', style: 'margin-top:2px' }, 'Free help from a nurse. Join with one phone call.'), h('button', { class: 'btn primary md', style: 'margin-top:12px', onClick: () => openJoin() }, 'Join the support program'))));
    if (s.stage === 'activating') out.append(h('div', { class: 'mt20' }, setupCard(true)));
    if (s.stage === 'active') {
      out.append(h('div', { class: 'card lg mt20', style: 'padding:16px' },
        h('div', { class: 'hstack', style: 'gap:12px' }, h('span', { class: 'avatar' }, 'S', h('i', { class: 'on' + (ls.open ? '' : ' off') })), h('div', { style: 'flex:1' }, h('div', { style: 'font-weight:600' }, 'Nurse line'), h('div', { class: 'muted small' }, 'Open ' + MED.hours + '.'))),
        h('button', { class: 'btn primary md', style: 'margin-top:12px', onClick: () => callNurse() }, ic('phone', 16), 'Call your nurse')));
      out.append(h('div', { class: 'card lg mt12', style: 'padding:16px' },
        h('div', { class: 'hstack', style: 'gap:12px' }, sol(40), h('div', { style: 'flex:1' }, h('div', { style: 'font-weight:600' }, 'Sol, your assistant ', h('span', { class: 'badge ai' }, 'AI')), h('div', { class: 'muted small' }, 'Here day and night, in the app.'))),
        h('div', { class: 'btnrow', style: 'margin-top:12px' }, h('button', { class: 'btn primary md', onClick: () => actions.openChat({ focus: true }) }, 'Ask Sol'), h('button', { class: 'btn secondary md', onClick: async () => { await closeView(view); actions.goTab('care', true); } }, 'See my journey'))));
    }
    const cd = callDate(); const callOpen = s.stage === 'active' && cd && !s.call.done && cd >= sod(now());
    out.append(h('div', { class: 'section-h' }, h('span', null, 'Appointments')),
      h('div', { class: 'list' }, row({ tile: { icon: 'calendar-dots', cls: 'sky' }, t1: 'Manage appointments', t2: callOpen ? 'Next: welcome call ' + relDay(cd, true) + ', ' + s.call.time : 'Calls and check-ups in one place', onClick: () => openAppointments() })));
    out.append(h('div', { class: 'section-h' }, h('span', null, 'Treatment')),
      h('div', { class: 'list' }, h('div', { class: 'kv' }, h('span', null, 'Start date'), h('span', null, fmtDate(st))), h('div', { class: 'kv' }, h('span', null, 'Cycle'), h('span', null, '21 days on, 7 days off')), h('div', { class: 'kv' }, h('span', null, 'Dose times'), h('span', null, s.reminders.am + ' and ' + s.reminders.pm))));
    out.append(h('div', { class: 'list mt16' },
      row({ lead: 'lightbulb', t1: 'Learn about your treatment', onClick: async () => { await closeView(view); actions.goTab('learning'); } }),
      row({ lead: 'chats', t1: 'Common questions', onClick: () => (s.stage === 'active' ? actions.openChat({}) : openAbout()) })),
    h('div', { class: 'list mt16' }, row({ lead: 'info', t1: 'About this support', onClick: () => openAbout() })));
    return out;
  }, { foot: () => h('div', { class: 'pagefoot', 'data-foot': '1' }) });
  // footer button only for the locked state
  const foot = v.el.querySelector('[data-foot]');
  const sync = () => { foot.replaceChildren(); foot.style.display = store.get().stage === 'available' ? '' : 'none'; if (store.get().stage === 'available') foot.append(h('button', { class: 'btn primary block', onClick: () => openUnlock() }, 'Get support')); };
  const up = v.update; v.update = () => { up(); sync(); }; sync();
  openView(v, 'page');
}
export function openAbout() {
  const open = new Set([0]);
  const v = page('About this support', () => h('div', { class: 'pad stack', style: 'padding-top:14px;padding-bottom:40px;gap:8px' }, ABOUT.map(([q, a], i) => {
    const el = h('div', { class: 'acc' + (open.has(i) ? ' open' : '') });
    el.append(h('button', { class: 'acc-h', onClick: () => { if (open.has(i)) open.delete(i); else open.add(i); el.classList.toggle('open'); } }, h('span', null, q), ic('caret-down', 18)), h('div', { class: 'acc-b' }, h('div', null, h('p', null, a))));
    return el;
  })));
  openView(v, 'page');
}

/* ---------- Appointments ---------- */
export function openAppointments() {
  let tab = 0;
  const v = page('Appointments', () => {
    const s = store.get(); const today = sod(now()); const st = fromIso(s.treatmentStart); const cd = callDate();
    const items = [];
    if (s.stage === 'active' && cd) items.push({ d: cd, time: s.call.time, title: 'Welcome call', tags: [['Support call', ''], [s.call.done || cd < today ? 'Done' : 'Confirmed', 'ok']], onClick: () => (s.call.done || cd < today ? null : openCallDetails()), past: s.call.done || cd < today });
    items.push({ d: nextWeekday(addDays(st, 23)), time: '09:00', title: 'Eye check', tags: [['Eye specialist', '']] });
    items.push({ d: nextWeekday(addDays(st, 30)), time: '14:30', title: 'Clinic visit', tags: [['NF1 clinic', '']] });
    items.push({ d: addDays(st, -6), time: '11:00', title: 'Clinic visit', tags: [['NF1 clinic', '']], past: true });
    items.forEach((x) => { if (x.past == null) x.past = x.d < today; });
    const list = items.filter((x) => (tab ? x.past : !x.past)).sort((a, b) => (tab ? b.d - a.d : a.d - b.d));
    const card = (x) => h('div', { class: 'list' }, h('button', { class: 'appt', onClick: x.onClick || null },
      h('span', { class: 'date' }, h('small', null, moShort(x.d)), h('b', null, String(x.d.getDate()).padStart(2, '0'))),
      h('span', { style: 'flex:1;min-width:0;text-align:left' }, h('div', { class: 'tm' }, relDay(x.d) + ' · ' + x.time), h('div', { class: 'ti' }, x.title), h('div', { class: 'tags' }, x.tags.map(([t, c]) => h('span', { class: 'badge ' + c }, t)))),
      x.onClick ? ic('caret-right', 18, 'muted') : null));
    const soon = list.filter((x) => Math.abs(diffDays(x.d, today)) <= 7); const later = list.filter((x) => Math.abs(diffDays(x.d, today)) > 7);
    const seg = h('div', { class: 'segctl', 'data-i': tab }, h('span', { class: 'thumb' }), ['Upcoming', 'Past'].map((t, i) => h('button', { class: i === tab ? 'on' : '', onClick: () => { tab = i; v.update(); } }, t)));
    return h('div', { class: 'pad', style: 'padding-bottom:40px' }, h('div', { style: 'padding-top:8px' }, seg),
      !list.length ? h('div', { class: 'empty' }, 'Nothing here yet.') : null,
      soon.length ? [h('div', { class: 'section-h' }, h('span', null, tab ? 'Recently' : 'This week')), h('div', { class: 'stack', style: 'gap:10px' }, soon.map(card))] : null,
      later.length ? [h('div', { class: 'section-h' }, h('span', null, tab ? 'Earlier' : 'Later')), h('div', { class: 'stack', style: 'gap:10px' }, later.map(card))] : null,
      s.stage === 'active' && !tab ? h('div', { class: 'banner mt20' }, ic('info', 18), h('span', null, h('b', null, 'Calls from your nurse appear here'), 'Support calls are booked by the nurse team and kept in sync. You can move them from the call itself.')) : null);
  });
  openView(v, 'page');
}

/* ---------- Medication schedule ---------- */
export function openSchedule() {
  let sel = iso(now());
  const v = page('Medication schedule', () => {
    const s = store.get(); const today = sod(now()); const d = fromIso(sel); const rec = doseOf(sel); const rest = isRestDay(d);
    const mon = addDays(today, -((today.getDay() + 6) % 7)); const strip = h('div', { class: 'weekstrip' });
    for (let i = 0; i < 7; i++) {
      const x = addDays(mon, i); const k = iso(x); const r = s.doses[k] || {}; const n = ['am', 'pm'].filter((q) => r[q] === 'taken').length; const rst = isRestDay(x);
      const before = x < fromIso(s.treatmentStart);
      strip.append(h('button', { class: 'wd' + (k === sel ? ' today' : '') + (rst ? ' rest' : ''), style: x > today ? 'opacity:.45' : '', onClick: () => { if (x <= today) { sel = k; v.update(); } } },
        h('span', { class: 'r', style: '--p:' + (before || rst ? 0 : n * 50) + '%' }, h('span', null, 'MTWTFSS'[i])), String(x.getDate())));
    }
    const logged = ['am', 'pm'].filter((q) => rec[q]).length;
    return h('div', { style: 'padding-bottom:40px' },
      h('div', { class: 'pad hstack', style: 'justify-content:space-between;align-items:flex-end;padding-top:6px' },
        h('div', null, h('h1', { style: 'font-size:24px;line-height:30px;font-weight:600;letter-spacing:-.015em' }, relDay(d)), h('div', { class: 'muted small' }, fmtLong(d))),
        rest ? null : h('div', { style: 'text-align:right' }, h('div', { style: 'font-size:22px;font-weight:600;line-height:26px' }, logged + ' of 2'), h('div', { class: 'muted small' }, 'logged'))),
      h('div', { class: 'mt12' }, strip),
      rest ? h('div', { class: 'pad mt20' }, h('div', { class: 'banner' }, ic('moon', 18), h('span', null, h('b', null, 'Rest day'), 'No ' + MED.brand + ' on days 22 to 28 of your cycle.')))
        : h('div', { class: 'pad' }, h('div', { class: 'section-h', style: 'font-weight:600;color:var(--text)' }, h('span', null, s.reminders.am)), medCard(sel, 'am', { compact: true }),
          h('div', { class: 'section-h', style: 'font-weight:600;color:var(--text)' }, h('span', null, s.reminders.pm)), medCard(sel, 'pm', { compact: true }),
          h('div', { class: 'lockline' }, ic('arrows-clockwise', 20), h('span', null, 'Cycle ' + cycleInfo().cycle + ', day ' + cycleInfo().day + ' of 28. Reminders ' + (s.reminders.on ? 'are on.' : 'are off.')), h('span', { class: 'spacer' }), h('button', { class: 'btn link', onClick: () => openReminders(store.get().steps['a-remind'] ? null : 'a-remind') }, s.reminders.on ? 'Change' : 'Turn on'))));
  });
  openView(v, 'page');
}

/* ---------- Symptom logging ---------- */
export function openSymptoms(preselect) {
  const picked = new Set(preselect ? [preselect] : []); const sev = {}; let step = 0;
  openSheet((api) => {
    const body = h('div', { class: 'sh-body' }); const foot = h('div', { class: 'sh-foot line' }); const head = h('div');
    const paint = () => {
      body.replaceChildren(); foot.replaceChildren(); fill(head, sheetHead(step === 0 ? 'Log symptoms' : step === 1 ? 'How strong?' : '', api));
      if (step === 0) {
        body.append(h('h2', null, 'Which symptoms are you experiencing?'), h('p', { class: 'lede' }, 'You will rate the severity of every chosen symptom next.'));
        SYMPTOMS.forEach((g) => { body.append(h('div', { class: 'sgroup' }, g.g)); const st = h('div', { class: 'stack', style: 'gap:8px' }); g.items.forEach((it) => {
          const el = h('button', { class: 'sym' + (picked.has(it.id) ? ' sel' : ''), onClick: () => { if (picked.has(it.id)) picked.delete(it.id); else picked.add(it.id); el.classList.toggle('sel'); btn.disabled = !picked.size; btn.textContent = picked.size ? 'Continue (' + picked.size + ')' : 'Continue'; } },
            h('span', { class: 'tile sm' }, ic(it.icon, 18)), it.t, h('span', { class: 'check' }, ic('check', 14)));
          st.append(el); }); body.append(st); });
        const btn = h('button', { class: 'btn primary block', disabled: !picked.size, onClick: () => { step = 1; paint(); } }, picked.size ? 'Continue (' + picked.size + ')' : 'Continue');
        foot.append(btn);
      } else if (step === 1) {
        const btn = h('button', { class: 'btn primary block', disabled: true }, 'Save');
        const check = () => { btn.disabled = [...picked].some((id) => sev[id] == null); };
        [...picked].forEach((id) => { const it = symptomById(id); const rowEl = h('div', { class: 'sevrow' });
          SEVERITY.forEach((lab, k) => rowEl.append(h('button', { class: 'sev' + (sev[id] === k ? ' sel' : ''), onClick: (e) => { sev[id] = k; [...rowEl.children].forEach((c) => c.classList.toggle('sel', c === e.currentTarget)); check(); } }, lab)));
          body.append(h('div', { style: 'margin-bottom:20px' }, h('div', { class: 'hstack', style: 'gap:10px;font-weight:500' }, h('span', { class: 'tile sm' }, ic(it.icon, 18)), it.t), rowEl)); });
        btn.addEventListener('click', () => { store.set((s) => ({ symptoms: [...s.symptoms, { date: iso(now()), items: [...picked].map((id) => ({ id, sev: sev[id] })) }] })); step = 2; paint(); });
        check(); foot.append(btn);
      } else {
        const s = store.get(); const names = [...picked].map((id) => symptomById(id).t.toLowerCase()).join(', ');
        body.append(h('div', { class: 'mark' }, ic('check', 30)), h('h2', { class: 'center mt20' }, 'Symptoms logged'), h('p', { class: 'lede center' }, 'Saved for ' + relDay(now(), true) + ': ' + names + '.'));
        if (picked.has('vision')) body.append(h('div', { class: 'care now mt20' }, h('div', { class: 'hd' }, ic('warning:fill', 22), 'Contact your doctor straight away'), h('p', null, 'Your leaflet says to tell your doctor straight away about blurred vision or any other change to your vision.')));
        if (s.stage === 'active') {
          body.append(h('div', { class: 'section-h' }, h('span', null, 'Want to talk about it?')), h('div', { class: 'list' },
            h('button', { class: 'row tiled', onClick: async () => { await api.close(); actions.openChat({ text: 'I have ' + names.split(', ')[0] }); } }, h('span', { class: 'tile' }, sol(26)), h('span', { class: 'grow' }, h('div', { class: 't1' }, 'Ask Sol'), h('div', { class: 't2' }, 'What the leaflet says, and who to tell.')), ic('caret-right', 18, 'chev')),
            h('button', { class: 'row tiled', onClick: async () => { await api.close(); callNurse(); } }, h('span', { class: 'tile sky' }, ic('phone', 22)), h('span', { class: 'grow' }, h('div', { class: 't1' }, 'Call a nurse'), h('div', { class: 't2' }, lineStatus().label)), ic('caret-right', 18, 'chev'))));
          body.append(h('div', { class: 'pv mt12' }, ic('users', 18), h('span', null, 'Your nurse team can see your symptom logs. Tell your doctor, pharmacist or nurse about anything that could be a side effect.')));
        }
        foot.append(h('button', { class: 'btn primary block', onClick: () => api.close() }, 'Done'));
      }
    };
    paint();
    return [head, body, foot];
  }, { tall: true });
}

/* ---------- Insights ---------- */
export function insightsTab() {
  const scroll = h('div', { class: 'scroll' }); const el = h('div', { class: 'screen tab-screen' }, scroll);
  function update() {
    const s = store.get(); const top = scroll.scrollTop; const st = doseStats(); const today = sod(now());
    const counts = {}; s.symptoms.forEach((l) => l.items.forEach((i) => { if (i.id !== 'none') counts[i.id] = (counts[i.id] || 0) + 1; }));
    const topId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const bars = h('div', { class: 'bars' });
    for (let i = 13; i >= 0; i--) { const k = iso(addDays(today, -i)); const log = s.symptoms.filter((l) => l.date === k).flatMap((l) => l.items).find((x) => x.id === topId); bars.append(h('i', { class: log ? 'hi' : '', style: 'height:' + (log ? 30 + log.sev * 22 : 6) + '%;animation-delay:' + ((13 - i) * 25) + 'ms' })); }
    const pct = st.due ? Math.round((st.taken / st.due) * 100) : 100;
    const j = computeJourney();
    fill(scroll, h('div', { class: 'titlebar' }, h('h1', null, 'Insights')), h('div', { class: 'pad' },
      h('div', { class: 'section-h', style: 'margin-top:8px' }, h('span', null, 'Symptoms'), h('span', { class: 'tiny' }, 'Last 14 days')),
      h('div', { class: 'card', style: 'padding:16px' }, topId ? [h('div', { class: 'tiny' }, 'Most days affected'), h('div', { class: 'hstack', style: 'justify-content:space-between;align-items:flex-end;gap:16px;margin-top:2px' }, h('div', null, h('div', { style: 'font-size:20px;font-weight:600;line-height:26px' }, symptomById(topId).t), h('div', { class: 'muted small' }, counts[topId] + (counts[topId] === 1 ? ' day' : ' days') + ' with symptoms logged')), h('div', { style: 'width:130px' }, bars))] : h('div', { class: 'muted' }, 'Log your symptoms to see patterns here.')),
      h('div', { class: 'section-h' }, h('span', null, 'Medications'), h('span', { class: 'tiny' }, 'Since you started')),
      h('div', { class: 'list' }, h('div', { class: 'adh' }, h('span', { class: 'tile' }, ic('pill', 22)), h('div', null, h('div', { style: 'font-weight:500' }, MED.brand), h('div', { class: 'muted small' }, st.taken + ' out of ' + st.due + ' taken as scheduled')), h('span', { class: 'pct' }, pct + '%'))),
      s.stage === 'active' && s.metSol ? [h('div', { class: 'section-h' }, h('span', null, 'Journey'), h('span', { class: 'tiny' }, 'Cycle ' + j.ci.cycle)),
        h('div', { class: 'list' }, h('button', { class: 'adh', style: 'width:100%;text-align:left', onClick: () => actions.goTab('care', true) }, h('span', { class: 'tile' }, ic('path', 22)), h('div', null, h('div', { style: 'font-weight:500' }, j.done + ' of ' + j.total + ' steps done'), h('div', { class: 'muted small' }, 'Shared with your nurse team')), h('span', { class: 'spacer' }), ic('caret-right', 18, 'muted')))] : null,
      h('p', { class: 'tiny mt20', style: 'padding:0 8px' }, 'Insights show what you have logged. They are not a diagnosis.')));
    scroll.scrollTop = top;
  }
  return { el, update, name: 'insights', scroll, theme: '#f9f7f3' };
}

/* ---------- Learning ---------- */
export function learningTab() {
  const scroll = h('div', { class: 'scroll' }); const el = h('div', { class: 'screen tab-screen' }, scroll);
  function update() {
    const s = store.get(); const top = scroll.scrollTop; const list = ARTICLES.filter((a) => !a.branded || s.stage !== 'available');
    fill(scroll, h('div', { class: 'titlebar' }, h('h1', null, 'Learning'), h('p', null, 'Tools and resources to help you navigate your journey.')),
      h('div', { class: 'pad' }, h('div', { class: 'section-h', style: 'margin-top:6px' }, h('span', null, list.length + ' articles')), h('div', { class: 'stack', style: 'gap:10px' }, list.map(articleCard))));
    scroll.scrollTop = top;
  }
  return { el, update, name: 'learning', scroll, theme: '#f9f7f3' };
}
export function openArticle(id) {
  const a = ARTICLES.find((x) => x.id === id); if (!a) return;
  const v = page('', () => h('div', { class: 'prose' },
    h('div', { class: 'cover', style: 'background:' + (a.tone === 'sun' ? 'linear-gradient(140deg,#fff3cf,#ffd772)' : 'linear-gradient(140deg,#e8f0fa,#bcd4ee)') + ';color:' + (a.tone === 'sun' ? '#8a6500' : '#2a5a99') }, ic(a.icon, 72)),
    h('span', { class: 'tag' + (a.branded ? ' sun' : ''), style: 'margin:0 0 10px' }, a.tag), h('h1', null, a.title), h('div', { class: 'muted small', style: 'margin-top:6px' }, a.date + ' · 2 min read'),
    a.body.map((p) => h('p', { class: 'selectable' }, p)),
    store.get().stage === 'active' && store.get().metSol ? h('button', { class: 'ask', style: 'margin-top:24px;box-shadow:none;border-color:var(--border)', onClick: () => actions.openChat({ focus: true }) }, sol(34), h('span', { class: 'ph' }, 'Ask Sol about this'), h('span', { class: 'send' }, ic('arrow-up', 18))) : null));
  openView(v, 'page');
}

/* ---------- Settings and prototype controls ---------- */
export function settingsTab(onPreset) {
  const scroll = h('div', { class: 'scroll' }); const el = h('div', { class: 'screen tab-screen' }, scroll);
  function update() {
    const s = store.get(); const top = scroll.scrollTop; const stageName = { available: 'Support available', unlocked: 'Support unlocked', activating: 'Setting up', active: 'Nurse support active' }[s.stage];
    const pb = (t, sub, fn, on) => h('button', { class: 'pbtn' + (on ? ' on' : ''), onClick: fn }, t, h('small', null, sub));
    fill(scroll, h('div', { class: 'titlebar' }, h('h1', null, 'Settings')), h('div', { class: 'pad' },
      h('div', { class: 'list' }, h('div', { class: 'profile' }, h('span', { class: 'av' }, s.name[0]), h('div', null, h('div', { style: 'font-weight:600;font-size:17px' }, s.name + ' Marin'), h('div', { class: 'muted small' }, 'NF1 · ' + MED.brand + ' since ' + fmtDay(fromIso(s.treatmentStart)))))),
      h('div', { class: 'list mt16' },
        row({ lead: 'bell', t1: 'Reminders', t2: s.reminders.on ? 'On, ' + s.reminders.am + ' and ' + s.reminders.pm : 'Off', onClick: () => openReminders(null) }),
        row({ lead: 'hand-heart', t1: MED.brand + ' support', t2: stageName, onClick: () => openSupport() }),
        row({ lead: 'info', t1: 'About this prototype', onClick: () => openAboutProto() })),
      h('div', { class: 'proto mt20' },
        h('h3', null, ic('presentation-chart', 18), 'Prototype controls'), h('p', null, 'For demos only. Jump between stages, move time forward and show the rules behind Sol.'),
        h('div', { class: 'grid' },
          pb('Start over', 'Support not unlocked yet', () => onPreset('available'), s.stage === 'available'),
          pb('Support unlocked', 'Batch code done, not joined', () => onPreset('unlocked'), s.stage === 'unlocked'),
          pb('Nurse active', 'Joined, journey started', () => onPreset('active'), s.stage === 'active'),
          pb('Presenter notes', s.presenter ? 'On: rules shown in chat' : 'Off', () => { store.set({ presenter: !s.presenter }); toast('Presenter notes ' + (!s.presenter ? 'on' : 'off'), 'presentation-chart'); }, s.presenter)),
        h('p', { style: 'margin-top:14px;font-weight:600;color:#4b3b8f' }, 'Time travel · ' + fmtDay(now()) + (s.dayOffset ? ' (+' + s.dayOffset + ' days)' : ' (today)')),
        h('div', { class: 'grid' },
          pb('+1 day', 'Call reminders', () => onPreset('time', 1)), pb('+3 days', 'Week 1 check-in opens', () => onPreset('time', 3)),
          pb('+1 week', 'More of cycle 1', () => onPreset('time', 7)), pb('Back to today', 'Reset the clock', () => onPreset('time', 0))),
        h('div', { class: 'grid' }, pb('Clear chats', 'Empty the history with Sol', () => { store.set({ chats: [], chatId: null, checkin: null }); toast('Chats cleared', null); })),
        h('p', { style: 'margin-top:14px;font-weight:600;color:#4b3b8f' }, 'Journey style'),
        h('div', { class: 'grid' },
          pb('Timeline', 'Default, one calm line', () => store.set({ journeyStyle: 'timeline' }), s.journeyStyle !== 'path'),
          pb('Original path', 'Winding and more playful', () => store.set({ journeyStyle: 'path' }), s.journeyStyle === 'path'))),
      h('p', { class: 'tiny center mt20' }, 'Concept prototype. Illustrative content, not for patient use.')));
    scroll.scrollTop = top;
  }
  return { el, update, name: 'settings', scroll, theme: '#f9f7f3' };
}
export function openAboutProto() {
  openSheet((api) => [sheetHead('About this prototype', api), h('div', { class: 'sh-body' },
    h('div', { class: 'center' }, sol(64)),
    h('p', { class: 'lede' }, 'A concept prototype of Sol, the assistant inside Rare & Me: the journey, the chat and the route to a human nurse.'),
    h('div', { class: 'list mt16' },
      h('div', { class: 'how' }, ic('warning', 22, 'lead'), h('div', null, h('div', { class: 't1' }, 'Not for patient use'), h('div', { class: 't2' }, 'Content is illustrative and has not been through medical, legal or regulatory review. It is not medical advice.'))),
      h('div', { class: 'how' }, ic('chats', 22, 'lead'), h('div', null, h('div', { class: 't1' }, 'Sol is scripted'), h('div', { class: 't2' }, 'Replies come from a fixed set of topics and rules that run on your device. No AI model is called and nothing leaves your phone.'))),
      h('div', { class: 'how' }, ic('phone', 22, 'lead'), h('div', null, h('div', { class: 't1' }, 'Calls are simulated'), h('div', { class: 't2' }, 'The phone number is a placeholder. No call is placed.'))))),
  h('div', { class: 'sh-foot' }, h('button', { class: 'btn primary block', onClick: () => api.close() }, 'Got it'))]);
}

actions.openSupport = openSupport; actions.openSchedule = openSchedule; actions.openAppointments = openAppointments; actions.openSymptoms = openSymptoms;
actions.openArticle = openArticle; actions.openReminders = () => openReminders(store.get().steps['a-remind'] ? null : 'a-remind');
export { fresh, closeAllViews, closeSheets, celebrate, add };
