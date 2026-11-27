// The journey: step logic, the cycle ring, the path, step sheets, the lesson player, reminders and call details.
import { PHASES, LESSONS, MED } from './data.js';
import {
  fill, h, add, ic, store, cycleInfo, dayNDate, fromIso, now, sod, fmtDay, fmtLong, relDay, addDays, nextWeekday, iso, diffDays,
  openSheet, sheetHead, openView, closeView, celebrate, toast, actions, sol, lineStatus, wait, closeSheets,
} from './core.js';

/* ---------- Logic ---------- */
export function callDate() { const s = store.get(); return s.call.dayIso ? fromIso(s.call.dayIso) : null; }
export function typeLabel(st) {
  if (st.type === 'lesson') return 'Lesson' + (st.mins ? ' · ' + st.mins + ' min' : '');
  if (st.type === 'action') return 'Quick task' + (st.mins ? ' · ' + st.mins + ' min' : '');
  if (st.type === 'checkin') return 'Check-in · ' + (st.mins || 2) + ' min';
  if (st.type === 'call') return 'Call with your nurse';
  if (st.type === 'milestone') return 'Milestone';
  return '';
}
export function computeJourney() {
  const s = store.get(); const ci = cycleInfo(); const today = sod(now());
  let current = null; let nextTimed = null;
  const phases = PHASES.map((ph) => {
    let prevDone = true; let prevTitle = null;
    const steps = ph.steps.map((st) => {
      let state = 'locked'; let sub = typeLabel(st); let opens = null; let need = null;
      if (ph.preview) { state = 'locked'; }
      else if (st.type === 'setup') {
        const done = st.id === 'meet' ? s.metSol : s.stage === 'active';
        state = done ? 'done' : 'open'; sub = st.meta;
      } else if (st.type === 'call') {
        if (st.id === 'call1') {
          const cd = callDate(); const done = s.call.done || (cd && cd < today);
          state = done ? 'done' : 'call'; sub = done ? 'Done' : cd ? relDay(cd) + ', ' + s.call.time : 'To be scheduled';
        } else {
          opens = dayNDate(st.opensDay);
          if (ci.dayN >= st.opensDay) { state = 'call'; sub = 'Sofia will suggest a time'; } else { state = 'timed'; sub = 'Opens ' + fmtDay(opens); }
        }
      } else if (st.type === 'milestone') {
        const done = st.after ? !!s.steps[st.after] : (ci.dayN >= st.opensDay && prevDone);
        state = done ? 'done' : 'locked'; sub = done ? 'Milestone reached' : 'Milestone';
        if (!done && st.opensDay) { opens = dayNDate(st.opensDay); sub = 'Milestone · ' + fmtDay(opens); }
      } else if (st.type === 'checkin') {
        // Check-ins follow the calendar, like the nurse cadence they mirror. They never wait on lessons.
        const done = !!s.steps[st.id];
        if (done) { state = 'done'; sub = 'Done'; }
        else if (ci.dayN >= st.opensDay) { state = 'open'; }
        else { state = 'timed'; opens = dayNDate(st.opensDay); sub = 'Opens ' + fmtDay(opens); }
      } else {
        const done = !!s.steps[st.id]; const dateOk = !st.opensDay || ci.dayN >= st.opensDay;
        if (done) { state = 'done'; sub = 'Done'; }
        else if (!dateOk) { state = 'timed'; opens = dayNDate(st.opensDay); sub = 'Opens ' + fmtDay(opens); }
        else if (!prevDone) { state = 'locked'; need = prevTitle; }
        else { state = 'open'; }
        prevDone = done; prevTitle = st.title;
      }
      const out = { ...st, state, sub, opens, need, phaseId: ph.id };
      if (!ph.preview && state === 'open' && st.type !== 'setup' && !current) { out.state = 'current'; current = out; }
      if (!ph.preview && state === 'timed' && !nextTimed && st.type !== 'call') nextTimed = out;
      return out;
    });
    const done = steps.filter((x) => x.state === 'done').length;
    return { ...ph, steps, done, total: steps.length };
  });
  const all = phases.filter((p) => !p.preview).flatMap((p) => p.steps);
  return { phases, current, nextTimed, done: all.filter((x) => x.state === 'done').length, total: all.length, ci };
}
export function findStep(id) { for (const p of computeJourney().phases) for (const st of p.steps) if (st.id === id) return st; return null; }
let justDone = null;
export function completeStep(id) {
  justDone = id;
  store.set((s) => ({ steps: { ...s.steps, [id]: Date.now() } }));
}

/* ---------- Cycle ring ---------- */
export function cycleRing(size, { onSun = false, small = false, animate = true } = {}) {
  const ci = cycleInfo(); const seg = 360 / 28; const gap = small ? 4 : 3.2; const r = 43; let d = '';
  const sw = small ? 9 : 8.5;
  const pt = (a) => [50 + r * Math.cos(a * Math.PI / 180), 50 + r * Math.sin(a * Math.PI / 180)];
  for (let i = 0; i < 28; i++) {
    const a0 = -90 + i * seg + gap / 2; const a1 = -90 + (i + 1) * seg - gap / 2;
    const [x0, y0] = pt(a0); const [x1, y1] = pt(a1); const n = i + 1; let col; let w = sw;
    if (n === ci.day) { col = '#2a2a2a'; w = sw + 3.5; }
    else if (n <= 21) col = n < ci.day ? (onSun ? '#e09a00' : '#f4b62a') : (onSun ? '#f4c26b' : '#ffd98a'); // days still to come stay orange, only lighter
    else col = n < ci.day ? '#6f9bd0' : (onSun ? '#9fc0e6' : '#cfe0f3');
    d += '<path class="seg" d="M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A' + r + ' ' + r + ' 0 0 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + '" stroke="' + col + '" stroke-width="' + w + '"' + (animate ? ' style="animation-delay:' + (i * 18) + 'ms"' : '') + '/>';
  }
  const wrap = h('div', { class: 'ringwrap' + (small ? ' sm' : '') + (animate ? ' ring-in' : ''), style: 'width:' + size + 'px;height:' + size + 'px' });
  wrap.innerHTML = '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '" fill="none" stroke-linecap="butt">' + d + '</svg>';
  wrap.append(h('div', { class: 'mid' }, h('div', null, h('b', null, small ? String(ci.day) : 'Day ' + ci.day), h('small', null, 'of 28'))));
  return wrap;
}

/* ---------- The cycle card. One card, shown the same on Home and on My Care. ---------- */
export function cycleCard() {
  const j = computeJourney(); const ci = j.ci; const s = store.get(); const cd = callDate(); const cur = j.current;
  const callOpen = cd && !s.call.done && cd >= sod(now()); const left = ci.on ? 21 - ci.day : 0;
  let next = null;
  if (cur) {
    next = h('button', { class: 'jnext', onClick: (e) => { e.stopPropagation(); startStep(cur); } },
      h('span', { class: 'nico' }, ic(cur.icon, 22)),
      h('span', { style: 'min-width:0;flex:1' }, h('div', { class: 't1' }, cur.title), h('div', { class: 't2' }, 'Next on your journey · ' + typeLabel(cur).split(' · ')[1])),
      h('span', { class: 'go' }, ic('arrow-right', 18)));
  } else if (j.nextTimed) {
    next = h('div', { class: 'jnext quiet' }, h('span', { class: 'nico' }, ic('check', 22)),
      h('span', { style: 'min-width:0;flex:1' }, h('div', { class: 't1' }, 'You’re up to date'), h('div', { class: 't2' }, j.nextTimed.title + ' opens ' + relDay(j.nextTimed.opens, true))));
  }
  return h('div', { class: 'hero', onClick: () => actions.goTab('care', true) },
    h('div', { class: 'top' }, cycleRing(112, { onSun: true, animate: false }),
      h('div', { style: 'flex:1;min-width:0' },
        h('div', { class: 'k' }, 'Cycle ' + ci.cycle + ' · ' + j.done + ' of ' + j.total + ' steps'),
        h('h3', null, ci.on ? (left === 0 ? 'Last treatment day' : left + ' treatment ' + (left === 1 ? 'day' : 'days') + ' to go') : 'Rest week'),
        h('div', { class: 'facts2' },
          h('div', null, ic('moon', 15), ci.on ? 'Rest week: ' + fmtDay(ci.restStart) : 'Cycle ' + (ci.cycle + 1) + ': ' + fmtDay(ci.nextCycle)),
          h('div', null, ic('phone', 15), callOpen ? 'Call with Sofia ' + relDay(cd, true) + ', ' + s.call.time : '2 calls with Sofia this cycle')))),
    h('div', { class: 'legend' }, h('span', null, h('i', { style: 'background:#e09a00' }), 'Done'), h('span', null, h('i', { style: 'background:#f4c26b' }), 'Treatment days'), h('span', null, h('i', { style: 'background:#9fc0e6' }), 'Rest days'), h('span', null, h('i', { style: 'background:#2a2a2a' }), 'Today')),
    next);
}

/* ---------- My Care journey ---------- */
// Two calmer layouts, switchable in the prototype controls while the look is being decided.
function calmHead(ph, cls) {
  return h('div', { class: cls }, h('div', null, h('span', { class: 'k' }, ph.k), h('b', null, ph.title)), h('span', { class: 'cnt' }, ph.preview ? 'Later' : ph.done + ' of ' + ph.total));
}
function timelineBlock(j) {
  return j.phases.map((ph) => h('section', { class: 'tl' }, calmHead(ph, 'tl-h'),
    h('div', { class: 'tl-rows' }, ph.steps.map((st) => {
      const cur = st.state === 'current';
      return h('button', { class: 'tl-row ' + st.state + (st.type === 'call' ? ' call' : '') + (st.type === 'milestone' ? ' ms' : ''), 'data-cur': cur ? '1' : null, onClick: () => openStep(st.id) },
        h('span', { class: 'tl-m' }, st.state === 'done' ? ic('check', 12) : st.type === 'call' && st.state === 'call' ? ic('phone:fill', 11) : null),
        h('span', { class: 'tl-t' }, h('b', null, st.title), h('small', null, cur ? 'Next · ' + st.sub : st.sub)),
        cur ? h('span', { class: 'tl-go' }, 'Start') : null);
    })),
    ph.preview ? h('div', { class: 'future-note' }, ic('info', 18), h('span', null, ph.note)) : null));
}
function cardsBlock(j) {
  return j.phases.map((ph) => h('section', { class: 'ck' }, calmHead(ph, 'ck-h'),
    ph.preview ? null : h('div', { class: 'ck-bar' }, h('i', { style: 'width:' + Math.round((ph.done / ph.total) * 100) + '%' })),
    h('div', { class: 'ck-rows' }, ph.steps.map((st) => {
      const cur = st.state === 'current';
      return h('button', { class: 'ck-row ' + st.state, 'data-cur': cur ? '1' : null, onClick: () => openStep(st.id) },
        h('span', { class: 'ck-box' }, st.state === 'done' ? ic('check', 14) : st.type === 'call' ? ic('phone', 14) : st.type === 'milestone' ? ic('flag-banner', 14) : st.state === 'timed' ? ic('clock', 14) : st.state === 'locked' ? ic('lock-simple', 13) : null),
        h('span', { class: 'ck-t' }, h('b', null, st.title), h('small', null, cur ? 'Next · ' + st.sub : st.sub)),
        ic('caret-right', 16, 'chev'));
    })),
    ph.preview ? h('div', { class: 'ck-note' }, ph.note) : null));
}
export function journeyBlock() {
  const j = computeJourney(); const style = store.get().journeyStyle || 'path';
  const wrap = h('div', null, cycleCard());
  if (style !== 'path') { add(wrap, [style === 'timeline' ? timelineBlock(j) : cardsBlock(j)]); justDone = null; return wrap; }
  j.phases.forEach((ph) => {
    const complete = ph.done === ph.total;
    const head = h('div', { class: 'phase-h', 'data-tone': complete ? 'done' : ph.tone },
      h('div', null, h('span', { class: 'k' }, ph.k), h('b', null, ph.title)),
      h('span', { class: 'cnt' }, ph.preview ? [ic('lock-simple:fill', 13), 'Later'] : complete ? [ic('check', 13), 'Complete'] : ph.done + ' of ' + ph.total));
    const path = h('div', { class: 'path' });
    ph.steps.forEach((st, i) => {
      const x = Math.round(46 + 40 * Math.sin(i * 0.95 + (ph.id === 'p2' ? 0.4 : 0)));
      const cls = ['node'];
      if (st.state === 'done') cls.push('done'); if (st.state === 'current') cls.push('current'); if (st.state === 'open') cls.push('open');
      if (st.state === 'timed') cls.push('timed'); if (st.type === 'call' && (st.state === 'call' || st.state === 'done')) cls.push('call');
      if (st.type === 'milestone') cls.push('milestone'); if (justDone === st.id || (justDone && st.after === justDone)) cls.push('just');
      let glyph = st.icon;
      if (st.state === 'done' && st.type !== 'milestone' && st.type !== 'call') glyph = 'check';
      const badge = st.state === 'locked' ? 'lock:fill' : st.state === 'timed' ? 'clock:fill' : null;
      const node = h('span', { class: cls.join(' '), 'data-id': st.id, 'data-state': st.state },
        ic(glyph, st.type === 'milestone' ? 34 : 28), st.state === 'current' ? h('span', { class: 'start-tag' }, 'Start') : null,
        badge ? h('span', { class: 'lk' }, ic(badge, 13)) : null);
      const subIcon = st.state === 'timed' ? 'calendar-blank' : st.type === 'call' && st.state !== 'done' ? 'phone' : st.state === 'done' ? 'check' : null;
      const rowEl = h('button', { class: 'jrow ' + (st.state === 'locked' || st.state === 'timed' ? 'locked' : st.state), style: '--x:' + x + 'px', onClick: () => openStep(st.id) },
        node, h('span', { class: 'jlabel' }, h('b', null, st.title), h('small', null, subIcon ? ic(subIcon, 13) : null, st.sub)));
      path.append(rowEl);
    });
    const sec = h('section', { class: 'phase' }, head, path);
    if (ph.preview) sec.append(h('div', { class: 'future-note' }, ic('info', 18), h('span', null, ph.note)));
    wrap.append(sec);
  });
  requestAnimationFrame(() => { drawTrails(wrap); justDone = null; });
  return wrap;
}
export function drawTrails(root) {
  root.querySelectorAll('.path').forEach((path) => {
    const old = path.querySelector('svg.trail'); if (old) old.remove();
    const pr = path.getBoundingClientRect(); if (!pr.width) return;
    const nodes = [...path.querySelectorAll('.node')];
    const pts = nodes.map((n) => { const r = n.getBoundingClientRect(); return [r.left - pr.left + r.width / 2, r.top - pr.top + r.height / 2 + 3]; });
    const mk = (arr) => arr.map((p, i) => { if (!i) return 'M' + p[0] + ' ' + p[1]; const q = arr[i - 1]; const my = (q[1] + p[1]) / 2; return 'C' + q[0] + ' ' + my + ' ' + p[0] + ' ' + my + ' ' + p[0] + ' ' + p[1]; }).join(' ');
    let k = 0; while (k < nodes.length && nodes[k].dataset.state === 'done') k++;
    const hasCur = k < nodes.length && (nodes[k].dataset.state === 'current' || nodes[k].dataset.state === 'call');
    const prog = pts.slice(0, Math.min(nodes.length, k + (hasCur ? 1 : 0)));
    const ns = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('class', 'trail');
    svg.innerHTML = '<path d="' + mk(pts) + '" fill="none" stroke="#ddd3bd" stroke-width="6" stroke-linecap="round" stroke-dasharray="1 14"/>' +
      (prog.length > 1 ? '<path class="prog" d="' + mk(prog) + '" fill="none" stroke="#f4b62a" stroke-width="7" stroke-linecap="round"/>' : '');
    path.prepend(svg);
    const p = svg.querySelector('.prog');
    if (p && root.querySelector('.node.just')) {
      const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L * 0.35; p.getBoundingClientRect();
      p.style.transition = 'stroke-dashoffset 1s cubic-bezier(.22,.9,.24,1)'; p.style.strokeDashoffset = 0;
    }
  });
}
export function scrollToCurrent(scroller, smooth) {
  const n = scroller.querySelector('.node.current, [data-cur]') || scroller.querySelector('.node.call:not(.done)');
  if (!n) return;
  const sr = scroller.getBoundingClientRect(); const nr = n.getBoundingClientRect();
  const top = scroller.scrollTop + (nr.top - sr.top) - sr.height * 0.42;
  scroller.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
}

/* ---------- Step sheets ---------- */
export function startStep(st) {
  if (st.id === 'meet') return actions.openMeet();
  if (st.type === 'lesson') return openLesson(st.id);
  if (st.type === 'action') return openReminders(st.id);
  if (st.type === 'checkin') return actions.openChat({ checkin: st.id });
  if (st.type === 'call') return openCallDetails();
  openStep(st.id);
}
export function openStep(id) {
  const st = findStep(id); if (!st) return;
  if (st.id === 'call1' && st.state !== 'done') return openCallDetails();
  const isCall = st.type === 'call';
  const nodeCls = 'node ' + (st.state === 'done' ? 'done' : st.state === 'current' ? 'current' : st.state === 'timed' ? 'timed' : st.state === 'open' ? 'open' : '') + (isCall && st.state !== 'locked' && st.state !== 'timed' ? ' call' : '') + (st.type === 'milestone' ? ' milestone' : '') + (store.get().journeyStyle !== 'path' ? ' flat' : '');
  openSheet((api) => {
    let cta = null; let lock = null;
    const go = (fn) => async () => { await api.close(); fn(); };
    if (st.state === 'done') {
      if (st.type === 'lesson') cta = h('button', { class: 'btn secondary block', onClick: go(() => openLesson(st.id, true)) }, 'Review lesson');
      else if (st.type === 'action') cta = h('button', { class: 'btn secondary block', onClick: go(() => openReminders(st.id)) }, 'Change reminders');
      else if (st.type === 'checkin') cta = h('button', { class: 'btn secondary block', onClick: go(() => actions.openChat({})) }, 'Open chat with Sol');
    } else if (st.state === 'current' || st.state === 'open') {
      const label = st.type === 'lesson' ? 'Start lesson' : st.type === 'action' ? 'Set reminders' : st.type === 'checkin' ? 'Start check-in with Sol' : st.id === 'meet' ? 'Meet Sol and Sofia' : 'Continue';
      cta = h('button', { class: 'btn primary block', onClick: go(() => startStep(st)) }, label);
    } else if (st.state === 'timed') {
      lock = h('div', { class: 'lockline' }, ic('clock', 20), h('span', null, 'Opens on ' + fmtLong(st.opens) + '. ', st.type === 'call' ? 'You will be able to pick a time then.' : 'Sol will let you know when it is ready.'));
    } else if (st.state === 'call') {
      lock = h('div', { class: 'lockline' }, ic('phone', 20), h('span', null, 'Sofia will suggest a time. You can also call the nurse line whenever it is open.'));
      cta = h('button', { class: 'btn sky block', onClick: go(() => actions.callNurse()) }, ic('phone:fill', 18), 'Call a nurse');
    } else if (st.type !== 'milestone') {
      lock = h('div', { class: 'lockline' }, ic('lock-simple', 20), h('span', null, st.need ? 'Finish “' + st.need + '” first.' : 'This step opens later in your journey.'));
    }
    return [
      sheetHead('', api),
      h('div', { class: 'sh-body stepsheet center' },
        h('div', { class: 'big', style: 'display:grid;place-items:center' }, h('span', { class: nodeCls, style: 'width:76px;height:76px;margin:0' }, ic(st.state === 'done' && st.type !== 'milestone' && !isCall ? 'check' : st.icon, 34))),
        h('div', { class: 'kind' + (isCall ? ' sky' : '') }, st.state === 'done' ? [ic('check-circle:fill', 14), 'Done'] : typeLabel(st)),
        h('h2', { class: 'mt8' }, st.title),
        h('p', { class: 'lede' }, st.about || (st.type === 'milestone' ? 'A marker on the way. You reach it by keeping going.' : 'Part of your journey later on.')),
        lock),
      cta ? h('div', { class: 'sh-foot' }, cta) : h('div', { style: 'height:calc(18px + var(--safe-b))' }),
    ];
  });
}

/* ---------- Call details and moving a call ---------- */
export function openCallDetails() {
  const s = store.get(); const cd = callDate(); if (!cd) return actions.callNurse();
  openSheet((api) => {
    const ta = h('textarea', { placeholder: 'For example: is it normal to feel more tired in week one?', maxlength: 400 });
    ta.value = s.call.notes || '';
    ta.addEventListener('input', () => store.get().call.notes !== ta.value && silentCallPatch({ notes: ta.value }));
    return [
      sheetHead('Support call', api),
      h('div', { class: 'sh-body' },
        h('div', { class: 'center', style: 'padding-top:6px' },
          h('span', { class: 'avatar lg', style: 'margin:0 auto' }, 'S'),
          h('h2', { class: 'mt12' }, 'Welcome call with Sofia'),
          h('p', { class: 'lede', style: 'margin-top:4px' }, fmtLong(cd) + ' at ' + s.call.time),
          h('div', { class: 'meta-row', style: 'justify-content:center' }, h('span', { class: 'badge' }, 'Support call'), h('span', { class: 'badge ok' }, s.call.moved ? 'Moved by you' : 'Confirmed'))),
        h('div', { class: 'list mt20' },
          h('div', { class: 'how' }, h('span', { class: 'tile sky sm' }, ic('phone-call', 18)), h('div', null, h('div', { class: 't1' }, 'Sofia calls you'), h('div', { class: 't2' }, 'On the number you gave when you joined. About 15 minutes.'))),
          h('div', { class: 'how' }, h('span', { class: 'tile sky sm' }, ic('chats', 18)), h('div', null, h('div', { class: 't1' }, 'What it covers'), h('div', { class: 't2' }, 'How the first days have gone, your questions, and what the next weeks look like.')))),
        h('div', { class: 'notes' }, h('div', { class: 'section-h', style: 'margin-top:18px' }, h('span', null, 'Notes for your call')), ta,
          h('div', { class: 'tiny', style: 'padding:6px 8px 0' }, 'Only you see these notes.'))),
      h('div', { class: 'sh-foot line' }, h('div', { class: 'btnstack' },
        h('button', { class: 'btn primary block', onClick: async () => { await api.close(); openMoveCall(); } }, ic('calendar-blank', 18), 'Move this call'),
        h('button', { class: 'btn secondary block', onClick: async () => { await api.close(); actions.callNurse(); } }, ic('phone', 18), 'Call the nurse line now'))),
    ];
  }, { tall: true });
}
function silentCallPatch(patch) { const s = store.get(); s.call = { ...s.call, ...patch }; try { localStorage.setItem('ram-vn-proto', JSON.stringify(s)); } catch (e) { /* ignore */ } }
export function openMoveCall() {
  const s = store.get(); const cd = callDate();
  const base = sod(now());
  const d1 = nextWeekday(addDays(base, 1)); const d2 = nextWeekday(addDays(d1, 1)); const d3 = nextWeekday(addDays(d2, 1));
  const slots = [[d1, '09:30', 'Morning'], [d1, '14:00', 'Afternoon'], [d2, '10:30', 'Morning'], [d2, '15:30', 'Afternoon'], [d3, '11:00', 'Morning']]
    .filter(([d, t]) => !(cd && iso(d) === iso(cd) && t === s.call.time));
  let sel = -1;
  openSheet((api) => {
    const btn = h('button', { class: 'btn primary block', disabled: true }, 'Confirm new time');
    const list = h('div', { class: 'slots' });
    slots.forEach(([d, t, part], i) => {
      const el = h('button', { class: 'slot', onClick: () => { sel = i; [...list.children].forEach((c, k) => c.classList.toggle('sel', k === i)); btn.disabled = false; } },
        h('span', null, fmtDay(d) + ', ' + t, h('small', null, ' · ' + part)), h('span', { class: 'radio' }));
      list.append(el);
    });
    btn.addEventListener('click', async () => {
      const [d, t] = slots[sel];
      store.set((st) => ({ call: { ...st.call, dayIso: iso(d), time: t, moved: true } }));
      await api.close(); toast('Call moved to ' + fmtDay(d) + ', ' + t);
    });
    return [sheetHead('Move your call', api),
      h('div', { class: 'sh-body' }, h('p', { class: 'muted' }, 'Pick a time that suits you. Sofia’s calendar updates straight away.'), list),
      h('div', { class: 'sh-foot line' }, btn)];
  });
}

/* ---------- Reminders (action step) ---------- */
export function openReminders(stepId) {
  const s = store.get(); let on = true; let am = s.reminders.am;
  const pmOf = (t) => String((parseInt(t, 10) + 12) % 24).padStart(2, '0') + ':00';
  openSheet((api) => {
    const sw = h('button', { class: 'switch on', 'aria-label': 'Reminders', onClick: () => { on = !on; sw.classList.toggle('on', on); } });
    const pmLine = h('b', null, pmOf(am));
    const picks = h('div', { class: 'timepick' });
    ['07:00', '08:00', '09:00', '10:00'].forEach((t) => picks.append(h('button', { class: t === am ? 'sel' : '', onClick: (e) => { am = t; [...picks.children].forEach((c) => c.classList.toggle('sel', c === e.currentTarget)); pmLine.textContent = pmOf(am); } }, t)));
    return [sheetHead('Set your reminders', api),
      h('div', { class: 'sh-body' },
        h('div', { class: 'list' },
          h('div', { class: 'row', style: 'pointer-events:auto' }, h('span', { class: 'tile' }, ic('bell', 22)), h('span', { class: 'grow' }, h('div', { class: 't1' }, 'Dose reminders'), h('div', { class: 't2' }, 'Two a day on treatment days')), sw)),
        h('div', { class: 'section-h' }, h('span', null, 'Morning dose')), picks,
        h('div', { class: 'lockline', style: 'margin-top:14px' }, ic('moon', 20), h('span', null, 'Evening reminder at ', pmLine, ', 12 hours later. Reminders pause by themselves in your rest week.'))),
      h('div', { class: 'sh-foot' }, h('button', { class: 'btn primary block', onClick: async () => {
        const first = !store.get().steps[stepId];
        store.set({ reminders: { on, am, pm: pmOf(am) } });
        await api.close();
        if (first && stepId) { completeStep(stepId); celebrate(0.7); toast('Reminders set. Step complete'); actions.goTab('care', true); } else toast('Reminders updated');
      } }, 'Save reminders'))];
  });
}

/* ---------- Lesson player ---------- */
function art(spec) {
  if (spec === 'capsules') return h('div', { class: 'art-disc' }, h('div', { class: 'capsules' }, h('i', { class: 'capsule' }), h('i', { class: 'capsule g' })));
  if (spec === 'clock') return h('div', { class: 'art-disc' }, sol(92), h('span', { class: 'art-badge a' }, '08:00'), h('span', { class: 'art-badge b dark' }, '20:00'));
  if (spec === 'cycle') { const r = cycleRing(196, { onSun: false }); fill(r.querySelector('.mid'), h('div', null, h('b', { style: 'font-size:34px;line-height:36px' }, '28'), h('small', { style: 'font-size:13px' }, 'day cycle'))); return r; }
  const [name, tone] = spec;
  if (name === 'sun') return h('div', { class: 'art-disc' }, sol(104));
  return h('div', { class: 'art-disc' + (tone === 'sky' ? ' sky' : ''), style: tone === 'sky' ? '' : 'color:#7a5a00' }, ic(name, 92));
}
export function openLesson(stepId, review) {
  const st = findStep(stepId); const L = LESSONS[stepId]; if (!L) return;
  let i = 0; let answered = false;
  const prog = h('div', { class: 'lprog' }); L.cards.forEach(() => prog.append(h('i')));
  const stage = h('div', { class: 'lstage' });
  const btn = h('button', { class: 'btn primary block' }, 'Continue');
  const foot = h('div', { class: 'lfoot' }, btn);
  const view = { theme: '#fff3cf' };
  const cards = L.cards.map((c) => {
    if (c.quiz) {
      const fb = h('div');
      const opts = h('div', { class: 'qopts' });
      c.options.forEach((o, k) => opts.append(h('button', { class: 'qopt', onClick: () => {
        if (answered) return; answered = true; const ok = k === c.answer;
        [...opts.children].forEach((el, n) => { if (n === c.answer) el.classList.add('right'); else if (n === k) el.classList.add('wrong'); else el.classList.add('dim'); });
        fill(fb, h('div', { class: 'qfb ' + (ok ? 'ok' : 'no') }, ok ? c.right : c.wrong));
        btn.disabled = false; btn.classList.toggle('sun', ok);
      } }, h('span', null, o), h('span', { class: 'mk' }, ic('check', 16)))));
      return h('div', { class: 'lcard' }, h('div', { style: 'height:8%' }),
        h('div', { class: 'kind', style: 'font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:var(--sun-700)' }, 'Quick check'),
        h('h2', { class: 'mt8' }, c.quiz), opts, fb);
    }
    return h('div', { class: 'lcard' }, h('div', { class: 'lart' }, art(c.art)), h('h2', null, c.title), h('p', null, c.body),
      h('div', { class: 'lsrc' }, ic('book-open', 14), 'Source: ' + L.src));
  });
  const done = h('div', { class: 'done-pane' },
    h('div', { class: 'burst' }, sol(150, 'speaking')),
    h('h2', null, review ? 'All refreshed' : 'Step complete'),
    h('p', null, L.done),
    h('div', { class: 'reward' }, h('span', { class: 'nico', style: 'width:28px;height:28px;border-radius:50%;background:linear-gradient(180deg,#ffdf80,#ffc93c);display:grid;place-items:center;color:#4a3600' }, ic('check', 16)), h('span', { class: 'rw' }, '')));
  add(stage, [cards, done]);
  const show = () => {
    cards.forEach((c, k) => { c.classList.toggle('on', k === i); c.classList.toggle('off', k < i); });
    [...prog.children].forEach((p, k) => p.classList.toggle('on', k <= i));
    answered = false; const isQuiz = !!L.cards[i].quiz; btn.disabled = isQuiz; btn.classList.remove('sun');
    btn.textContent = i === L.cards.length - 1 ? 'Finish' : 'Continue';
  };
  let finished = false;
  btn.addEventListener('click', async () => {
    if (finished) { await closeView(view); actions.goTab('care', true); return; }
    if (i < L.cards.length - 1) { i++; show(); return; }
    finished = true; cards.forEach((c) => { c.classList.remove('on'); c.classList.add('off'); });
    if (!review) completeStep(stepId);
    const j = computeJourney();
    done.querySelector('.rw').textContent = j.done + ' of ' + j.total + ' steps on your journey';
    done.classList.add('on'); btn.textContent = 'Back to my journey'; btn.classList.add('sun'); btn.disabled = false;
    foot.append(h('button', { class: 'btn text block', style: 'margin-top:6px', onClick: async () => { await closeView(view); actions.openChat({ about: st.title }); } }, 'Ask Sol about this'));
    await wait(180); celebrate(1);
  });
  view.el = h('div', { class: 'lesson' },
    h('div', { class: 'ltop' }, h('button', { class: 'iconbtn', 'aria-label': 'Close', onClick: () => closeView(view) }, ic('x', 22)), prog, h('span', { style: 'width:8px' })),
    stage, foot);
  openView(view, 'modal');
  requestAnimationFrame(show);
}
export { MED, closeSheets, diffDays, lineStatus };
