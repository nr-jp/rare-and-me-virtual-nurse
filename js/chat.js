// Sol, the assistant. The chat follows Ivar's Assistant V1 design (full-screen cover, chats sidebar, trace steps,
// source pills, a talk-to-a-person card, follow-ups, a composer with suggested questions), in Rare & Me branding.
// Replies are scripted: topics are detected and each topic has one fixed reply. No AI model is called.
import { MED, ABOUT, ARTICLES, SEVERITY, symptomById } from './data.js';
import {
  h, ic, store, cycleInfo, doseStats, now, sod, fmtDay, relDay, addDays, iso, moShort, lineStatus,
  openSheet, sheetHead, openView, closeView, actions, sol, wait, toast,
} from './core.js';
import { computeJourney, callDate, completeStep } from './journey.js';

/* ---------- Reply building blocks (same shapes as Ivar's scripted chat) ---------- */
const T = (text) => ({ kind: 'text', text });
const S = (source, excerpt, ms = 850) => ({ kind: 'search', source, excerpt, ms });
const SRC = (...sources) => ({ kind: 'sources', sources });
const Z = (ms = 300) => ({ kind: 'sleep', ms });
const ESC = { kind: 'escalation' };
const NOTE = (t) => ({ kind: 'note', t });

const LEAF = (n, title, description) => ({ label: 'Package leaflet', title: 'Section ' + n + ': ' + title, description });
const L1 = LEAF(1, 'What Ezmekly is', 'Ezmekly contains mirdametinib. It is used for plexiform neurofibromas in people with NF1.');
const L2 = LEAF(2, 'Before you take Ezmekly', 'Checks before and during treatment, other medicines, and driving.');
const L3 = LEAF(3, 'How to take Ezmekly', 'Twice a day, about 12 hours apart, with or without food. 21 days on, then 7 days off.');
const L4 = LEAF(4, 'Possible side effects', 'The side effects people can get with Ezmekly, and who to tell.');
const L5 = LEAF(5, 'How to store Ezmekly', 'Keep it in the original pack, out of the sight and reach of children.');
const learn = (id) => { const a = ARTICLES.find((x) => x.id === id); return { label: 'Learn', title: a.title, description: 'Article in Learning, 2 min read.', go: 'article', arg: id }; };

// The questions Sol suggests. Tapping one, or typing it, gives its scripted reply.
const Q = {
  sick: 'I feel a bit sick after my evening dose. Is that normal?',
  take: 'How do I take Ezmekly?',
  symptoms: 'How have my symptoms been this week?',
  doses: 'Have I missed any doses this week?',
  call: 'When is my next call?',
  double: 'I forgot yesterday’s dose. Can I take two today?',
  food: 'Can I take it with food?',
  tell: 'Who do I tell about side effects?',
  rest: 'What happens in my rest week?',
  cantEat: 'I can’t keep food down',
  next: 'What’s next on my journey?',
};
const SUGGESTED = ['sick', 'take', 'symptoms', 'doses', 'call', 'double'];
const MENU = [
  { label: 'Side effects', icon: 'pill', text: 'What side effects can I expect?' },
  { label: 'Storage and travel', icon: 'suitcase', text: 'How do I store Ezmekly when I travel?', sep: true },
  { label: 'Missed a dose', icon: 'clock-counter-clockwise', text: 'What do I do if I miss a dose?' },
];
const PLACEHOLDER = 'Ask about your treatment...';
const FALLBACK = 'I can help with questions about your treatment, like side effects, how to take it and your schedule.\n\nI don’t have approved information to answer that one, and I’d rather not guess.';
const norm = (t) => t.trim().toLowerCase().replace(/[’']/g, "'");

/* ---------- What the app knows ---------- */
function weekRange() {
  const to = sod(now()); const from = addDays(to, -6);
  return from.getMonth() === to.getMonth() ? from.getDate() + ' to ' + to.getDate() + ' ' + moShort(to) : from.getDate() + ' ' + moShort(from) + ' to ' + to.getDate() + ' ' + moShort(to);
}
function weekSymptoms() {
  const s = store.get(); const from = iso(addDays(sod(now()), -6)); const by = {};
  s.symptoms.filter((l) => l.date >= from).forEach((l) => l.items.forEach((i) => { if (i.id === 'none') return; const b = by[i.id] || (by[i.id] = { days: new Set(), sev: 0 }); b.days.add(l.date); b.sev = Math.max(b.sev, i.sev || 0); }));
  return Object.keys(by).map((id) => ({ id, name: symptomById(id).t, days: by[id].days.size, sev: SEVERITY[by[id].sev].toLowerCase() }));
}
const dayCount = (n) => n + (n === 1 ? ' day' : ' days');
function symptomLines() { const w = weekSymptoms(); return w.length ? w.map((x) => '- **' + x.name + '** on ' + dayCount(x.days) + ', ' + x.sev).join('\n') : '- No symptoms logged'; }
function symSource() { const w = weekSymptoms(); return { label: 'Your symptom log', title: 'Symptoms, ' + weekRange(), description: w.length ? w.map((x) => x.name + ' on ' + dayCount(x.days)).join(', ') + '.' : 'Nothing logged in the last 7 days.', go: 'insights' }; }
function noEntry() { const m = doseStats().missed.filter((x) => !(store.get().doses[iso(x.date)] || {})[x.slot]); return m.length ? m[m.length - 1] : null; }
const slotName = (m) => (m.slot === 'am' ? 'morning' : 'evening');
function medSource() { const st = doseStats(); const m = noEntry(); return { label: 'Your medication log', title: 'Doses since you started', description: st.taken + ' of ' + st.due + ' logged as taken.' + (m ? ' ' + fmtDay(m.date) + ', ' + slotName(m) + ', not logged.' : ''), go: 'schedule' }; }
function callSource() { const s = store.get(); const cd = callDate(); return { label: 'Your appointments', title: 'Welcome call with Sofia', description: fmtDay(cd) + ' at ' + s.call.time + ', by phone.', go: 'appointments' }; }
function journeySource() { const j = computeJourney(); return { label: 'Your journey', title: 'Cycle ' + j.ci.cycle + ', day ' + j.ci.day + ' of 28', description: j.done + ' of ' + j.total + ' steps done in this cycle.', go: 'journey' }; }

/* ---------- Scripted replies ---------- */
const sideLead = 'Tell your doctor, pharmacist or nurse about it. Mention when it started and how it has changed.';
const B = {
  sick: () => ({ fu: ['food', 'tell'], reply: [
    S('your package leaflet', 'Feeling or being sick is among the side effects people mention most with Ezmekly.'),
    S('articles in Learn', 'Eat smaller meals and stop when you feel full. Sip water slowly through the day.', 700), Z(),
    T('Your package leaflet lists feeling sick (nausea) among the side effects people **mention most** with Ezmekly.\n\nSome things that can help, from Learn:\n\n- Eating smaller meals, and stopping when you feel full.\n- Sipping water slowly through the day.\n\nTell your doctor, pharmacist or nurse about it. If you can’t keep food or fluids down, contact them straight away.'),
    SRC(L4, learn('nausea')), NOTE('A side effect was mentioned. The safety report to the sponsor runs in the background and is always on. Ivar’s design does not show the patient a notice.')] }),
  take: () => { const s = store.get(); return { fu: ['food', 'rest'], reply: [
    S('your package leaflet', 'Take Ezmekly twice a day, about 12 hours apart, with or without food. Swallow the capsules whole with water.'), Z(),
    T('Your package leaflet says:\n\n- Take it **twice a day**, about **12 hours** apart.\n- Swallow the capsules whole with water. Don’t chew, break or open them.\n- Take it for **21 days**, then stop for **7 days**. That is one cycle.\n\nYour app has your doses at ' + s.reminders.am + ' and ' + s.reminders.pm + '.'),
    SRC(L3, { label: 'Your medication schedule', title: 'Dose times', description: s.reminders.am + ' and ' + s.reminders.pm + ', on treatment days.', go: 'schedule' })] }; },
  food: () => ({ reply: [S('your package leaflet', 'Ezmekly can be taken with or without food.', 800), Z(),
    T('Yes. Your package leaflet says you can take Ezmekly **with or without food**. Swallow the capsules whole with water.'), SRC(L3)] }),
  tell: () => ({ reply: [S('your package leaflet', 'Tell your doctor, pharmacist or nurse about any side effect, including ones not listed in the leaflet.', 800), Z(),
    T('Tell your **doctor, pharmacist or nurse** about any side effect, including ones that are not in the leaflet.\n\nFor changes in your vision, tell your doctor straight away.'), SRC(L4)] }),
  rest: () => { const ci = cycleInfo(); return { fu: ['next'], reply: [S('your package leaflet', 'Take Ezmekly for 21 days, then stop for 7 days. This 28-day period is one cycle.', 800), S('your journey', 'Cycle ' + ci.cycle + ', day ' + ci.day + ' of 28.', 600), Z(),
    T((ci.on ? 'You’re on **day ' + ci.day + '** of cycle ' + ci.cycle + '. Your rest week starts ' + relDay(ci.restStart, true) + '.' : 'You’re in your rest week, day ' + ci.day + ' of 28. Cycle ' + (ci.cycle + 1) + ' starts ' + relDay(ci.nextCycle, true) + '.') + '\n\nIn the rest week you take a planned **7 day break** from Ezmekly. It is part of every cycle. Reminders pause and start again on day 1 of the next cycle.'),
    SRC(L3, journeySource())] }; },
  symptoms: () => ({ fu: ['doses', 'call'], reply: [S('your symptom log', symSource().description, 800), Z(),
    T('From your symptom log for ' + weekRange() + ':\n\n' + symptomLines() + '\n\n' + (weekSymptoms().length ? 'You can bring this up on your next call with Sofia.' : 'If you notice anything, you can log it in Symptoms.')), SRC(symSource())] }),
  doses: () => { const st = doseStats(); const m = noEntry(); return { reply: [S('your medication log', medSource().description, 800), Z(),
    T('Your log shows **' + st.taken + ' of ' + st.due + '** doses taken since you started.\n\n' + (m ? 'The ' + slotName(m) + ' dose on ' + fmtDay(m.date) + ' has no entry. If you took it, you can add it in your medication schedule.' : 'Nothing is missing from your log.')), SRC(medSource())] }; },
  call: () => { const s = store.get(); const cd = callDate(); const open = cd && !s.call.done && cd >= sod(now());
    if (!open) return { reply: [S('your appointments', 'No support call is booked at the moment.', 700), Z(), T('You don’t have a call booked right now. You can reach the nurse line, open ' + MED.hours + '.'), SRC({ label: 'Your appointments', title: 'Appointments', description: 'Calls and check-ups in one place.', go: 'appointments' })] };
    return { reply: [S('your appointments', 'Welcome call with Sofia, ' + fmtDay(cd) + ' at ' + s.call.time + ', by phone.', 700), Z(),
      T('Your next one is the **welcome call with Sofia**, ' + relDay(cd, true) + ' at ' + s.call.time + '. She calls you, and you can move the time in your appointments.'), SRC(callSource())] }; },
  next: () => { const j = computeJourney(); const c = j.current; return { reply: [S('your journey', j.done + ' of ' + j.total + ' steps done in this cycle.', 700), Z(),
    T('You’re **' + j.done + ' of ' + j.total + '** steps into this cycle.\n\n' + (c ? 'Next is **' + c.title + '**. You can start it from My Care.' : j.nextTimed ? 'You’re up to date. Next to open is **' + j.nextTimed.title + '**, ' + relDay(j.nextTimed.opens, true) + '.' : 'You’re up to date.')), SRC(journeySource())] }; },
  double: () => ({ reply: [Z(200), ESC, NOTE('Dose question. Sol does not answer and shows no leaflet text. The same card every time.')] }),
  cantEat: () => ({ reply: [Z(200), ESC] }),
};
const esc = (lead, note, hard) => ({ hard: !!hard, reply: [Z(200), ...(lead ? [T(lead)] : []), ESC, ...(note ? [NOTE(note)] : [])] });
const SIDE = [
  [/rash|acne|pimple|spots|\bskin\b|itch/, 'A skin rash', 'skin'], [/diarrh|loose stool|the runs|upset stomach/, 'Diarrhea'], [/vomit|throwing up|threw up|being sick/, 'Being sick'],
  [/tired|fatigue|exhaust|no energy|worn out|wiped/, 'Tiredness'], [/headache|migraine/, 'Headache'], [/muscle|joint|bone|back pain|aching|aches/, 'Muscle or bone pain'],
];

function respond(text) {
  const s = store.get(); const q = norm(text);
  const exact = Object.keys(Q).find((k) => norm(Q[k]) === q);
  if (exact) return { key: exact, hard: exact === 'cantEat', ...B[exact]() };

  // Things Sol must not answer go to a person. Fixed rules, the same card every time.
  if (/suicid|kill myself|end my life|hurt myself|harm myself|self.?harm|don'?t want to (live|be here)/.test(q)) return esc('I’m really glad you told me. You deserve support from a person right now. If you might act on these thoughts, call your local emergency number.', 'Emergency language. Fixed signpost. Sol does not assess risk or contact anyone.', true);
  if (/(can'?t|cannot|hard to|trouble|difficulty|struggling to) breath|chest pain|faint(ed|ing)?\b|collaps|unconscious|seizure|severe bleed|emergency|ambulance|\b(999|911|112)\b|allergic reaction|swollen (face|tongue|throat|lips)/.test(q)) return esc('If this could be an emergency, don’t wait for me. Call your local emergency number now.', 'Emergency language. Fixed signpost.', true);
  if (/blurr|vision|eyesight|can'?t see|seeing (double|spots|flashes)|eye (pain|problem)s?|my eyes?\b|floaters/.test(q) && !/eye (check|test|exam|appointment|specialist)/.test(q)) return esc('A change in your vision is something your doctor needs to hear about straight away.', 'Vision change. The urgency comes from the leaflet, not from a model.', true);
  if (/can'?t keep (food|fluids?|anything|water) down|keep(ing)? (nothing|anything) down/.test(q)) return { key: 'cantEat', hard: true, ...B.cantEat() };

  // What the app knows
  if (/have i missed|did i miss|missed any|how many doses|doses? (taken|logged)|did i take|have i taken|my (doses|logs?)\b|adherence|on track|how am i doing/.test(q)) return { key: 'doses', ...B.doses() };
  if (/my symptoms|symptoms? (been|this week|log)|how have i been/.test(q)) return { key: 'symptoms', ...B.symptoms() };
  if (/when is my|next call|welcome call|next (consultation|appointment)|call with (sofia|my nurse)/.test(q)) return { key: 'call', ...B.call() };
  if (/what'?s next|what is next|next step|journey|where am i|progress|what should i do|what now/.test(q)) return { key: 'next', ...B.next() };

  // Taking it
  if (/how (do|should|can) i take|how to take|swallow|chew|open (the |a |my )?capsules?|crush|dissolve|what time|when (do|should) i take|how often|twice a day/.test(q)) return { key: 'take', ...B.take() };
  if (/with(out)? food|\bfood\b|empty stomach|with (a )?meal|with milk/.test(q)) return { key: 'food', ...B.food() };
  if (/rest week|\bcycle\b|\bbreak\b|21 days|28 days|7 days|week off|days? off|what day|which day/.test(q)) return { key: 'rest', ...B.rest() };

  // Dose decisions, other medicines and pregnancy: no answer, a person.
  if (/overdose|took too (much|many)|taken too (much|many)|double dose|took (two|2|both)|take (two|2|both|double)|(miss|forgot|forget|skipp?ed|late|extra|catch up|make up|didn'?t take).{0,40}(dose|capsule|tablet|pill|ezmekly|medication|medicine|\bit\b)|(dose|capsule|pill|medication|ezmekly).{0,30}(miss|forgot|late|skip)|sick after|threw up after|vomit(ed)? after|should i (still )?take|take it (now|today|later|tonight)|(increase|decrease|reduce|lower|higher|change|adjust|half|halve|split).{0,20}(dose|capsule|ezmekly|medication)|how (many|much) (should|do|can) i take|(dose|capsule).{0,12}(too (high|low|strong)|wrong)|stop taking|stop (the |my )?(treatment|ezmekly|medication)|come off|give up (on )?(the )?(treatment|ezmekly)|pause (the |my )?(treatment|ezmekly)/.test(q)) return { key: 'double', ...B.double() };
  if (/grapefruit|alcohol|\bwine\b|\bbeer\b|drinking|ibuprofen|paracetamol|antibiotic|supplement|vitamin|herbal|st\.? john|other (medicine|medication|drug|tablet)s?|interact|vaccin|painkiller/.test(q)) return esc(null, 'Other medicines, food or drink. Topic detected, fixed signpost. No model judgement.');
  if (/pregnan|contracepti|birth control|breast.?feed|fertility|condom|having a baby|trying for a baby/.test(q)) return esc(null, 'Pregnancy and contraception. Fixed signpost.');

  // Side effects: what the leaflet lists, and who to tell
  if (/nause|feel(ing)? (a bit |really |so |very )?sick|queasy/.test(q)) return { key: 'sick', ...B.sick() };
  for (const [re, label, art] of SIDE) if (re.test(q)) return { fu: ['tell'], reply: [S('your package leaflet', label + ' is listed as a side effect people can get with Ezmekly.'), Z(), T(label + ' is listed in your package leaflet as a side effect people can get with Ezmekly.\n\n' + sideLead + '\n\nYou can log it in Symptoms, so the dates are right for your next appointment.'), SRC(...(art ? [L4, learn(art)] : [L4]))] };
  if (/side.?effects?|reaction|symptom|feel(ing)? (unwell|ill|bad|awful|rough|worse|off|strange|weird)|not feeling (well|good|right|great)|unwell|\bpain\b|hurts?\b|sore\b/.test(q)) return { fu: ['tell'], reply: [S('your package leaflet', 'The side effects people mention most: a skin rash, diarrhea, feeling or being sick, tiredness, and muscle or bone pain.'), Z(), T('Side effects are common with Ezmekly. The ones people mention most:\n\n- A skin rash that can look like acne\n- Diarrhea\n- Feeling or being sick\n- Tiredness\n- Muscle or bone pain\n\nThe full list is in your leaflet. ' + sideLead), SRC(L4)] };

  // Everyday questions
  if (/eye (check|test|exam|appointment|specialist)|heart (check|scan|test)|check.?ups?|blood test|monitor/.test(q)) return { reply: [S('your package leaflet', 'Your vision and your heart are checked before you start and during treatment.'), Z(), T('Ezmekly comes with routine checks:\n\n- An eye specialist checks your **vision** before you start and regularly during treatment.\n- Your doctor checks how your **heart** is working before and during treatment.\n\nYour clinic sets the dates. You can keep them in your appointments.'), SRC(L2, { label: 'Your appointments', title: 'Appointments', description: 'Calls and check-ups in one place.', go: 'appointments' })] };
  if (/\bstor(e|age|ing)\b|fridge|travel|holiday|flight|abroad|time zone|temperature|keep (it|them)/.test(q)) return { reply: [S('your package leaflet', 'Keep Ezmekly in the original pack, out of the sight and reach of children.'), Z(), T('Keep Ezmekly in its **original pack**, out of the sight and reach of children. The full storage instructions are in section 5 of your leaflet.\n\nIf you’re crossing time zones, your doctor, pharmacist or nurse can help you plan your dose times before you go.'), SRC(L5)] };
  if (/driv|\bcar\b|machine/.test(q)) return { reply: [S('your package leaflet', 'Ezmekly can cause tiredness and blurred vision.', 800), Z(), T('Your leaflet says Ezmekly can cause tiredness and blurred vision. If you feel tired or your vision is affected, don’t drive or use machines.'), SRC(L2)] };
  if (/what is ezmekly|what'?s ezmekly|how does (it|ezmekly) work|mirdametinib|\bmek\b|what does (it|ezmekly) do/.test(q)) return { reply: [S('your package leaflet', 'Ezmekly contains the active substance mirdametinib.', 800), Z(), T('Ezmekly contains **mirdametinib**. It blocks a protein called MEK, which is involved in the growth of plexiform neurofibromas in people with NF1.'), SRC(L1, learn('cycle'))] };
  if (/nf1|neurofibrom|plexiform|my condition|tumou?rs?/.test(q)) return { reply: [S('articles in Learn', 'Plexiform neurofibromas are tumors that grow along nerves.', 800), Z(), T('Plexiform neurofibromas are tumors that grow along nerves in some people with neurofibromatosis type 1, or NF1. They are not cancerous, but they can cause symptoms depending on where they are.'), SRC(learn('nf1'))] };
  if (/how long|when will it (work|start|help)|is it working|shrink|get(ting)? better|results|cure|will it work/.test(q)) return { reply: [Z(), T('That’s a question for your doctor, because the answer depends on you. Treatment continues in cycles for as long as your doctor recommends.\n\nIt can help to note it down for your next call with Sofia.')] };
  if (/remind/.test(q)) return { reply: [Z(), T(s.reminders.on ? 'Your reminders are on at ' + s.reminders.am + ' and ' + s.reminders.pm + '. They pause by themselves in your rest week.' : 'Your reminders are off at the moment. You can turn them on in your medication schedule.'), SRC({ label: 'Your medication schedule', title: 'Dose reminders', description: 'Two a day on treatment days.', go: 'schedule' })] };
  if (/sofia|my nurse|speak (to|with)|talk (to|with)|real person|\bhuman\b|call (a|the|my) nurse|phone (a|the|my)? ?nurse|call me\b/.test(q)) return esc('Of course. You never need my permission to talk to a person.');
  if (/scared|afraid|anxious|anxiety|worried|worry|overwhelm|lonely|\balone\b|depress|\bsad\b|crying|stress|can'?t cope|fed up|hopeless|frighten|nervous/.test(q)) return esc('That sounds like a lot to carry, and it makes sense. I’m an AI, so this is something a person does better. Sofia talks with people about exactly this.');
  if (/are you (a |an )?(real|human|person|nurse|robot|ai|bot|doctor)|who are you|what are you|are you real|is this (a )?(real|bot|ai)/.test(q)) return { reply: [Z(), T('I’m **Sol**, an AI assistant. I’m not a nurse or a doctor, and I’m not a person.\n\nI answer from approved information about Ezmekly and from what you have logged in this app. I don’t give medical advice and I can’t change your treatment.')] };
  if (/privacy|my data|who (can )?sees?|confidential|shared? with|what happens to/.test(q)) return { reply: [Z(), T(ABOUT[5][1])] };
  if (/cost|price|\bpay|insurance|reimburs|refill|deliver|pharmacy|prescription|run(ning)? (out|low)|ran (out|low)|supply|order more|more capsules/.test(q)) return esc('I can’t help with costs, insurance, deliveries or refills yet. Sofia’s team can point you in the right direction.', 'Outside V1 scope, so Sol hands it to the human team.');
  if (/what can you (do|help)|what do you do|^help\b|how can you help/.test(q)) return { reply: [Z(), T('Three things:\n\n- I answer questions about Ezmekly from approved information, and show where each answer comes from.\n- I can look at what you have logged in this app.\n- I point you to Sofia or your doctor when you need a person.')] };
  if (/^(hi|hello|hey|hiya|good (morning|afternoon|evening))\b/.test(q)) return { reply: [T('Hi ' + s.name + '. What’s on your mind?')] };
  if (/thank|cheers|\bgreat\b|perfect|got it|^ok(ay)?\b|helpful/.test(q)) return { reply: [T('Any time, ' + s.name + '.')] };
  return { reply: [Z(), T(FALLBACK), NOTE('No match. Sol says so. Nothing is generated outside approved content.')] };
}

/* ---------- Check-in. Follows Ivar's script, including logging for the patient. ---------- */
const CHIPS = [
  ['Mostly fine. I felt a bit sick after dinner yesterday.'],
  ['No, I can still eat. It passes after an hour or so.', 'I can’t keep food down'],
  ['Yes please', 'No thanks'],
  ['Yes, I just forgot to log it', 'No, I missed it'],
  ['Yes', 'No'],
];
const weekOf = (id) => (id === 'c-week2' ? 2 : 1);
function checkinOpen(id) {
  const st = doseStats(); const wk = weekOf(id);
  return { reply: [T('**Week ' + wk + ' check-in**\n\nYou asked me to check in after your ' + (wk === 1 ? 'first week' : 'second week') + ' on Ezmekly. Here’s what your app shows:\n\n- **' + st.taken + ' of ' + st.due + '** doses logged as taken\n' + symptomLines() + '\n\nHow have you been feeling?'), SRC(medSource(), symSource())] };
}
function checkinWrap(c, lead) {
  const s = store.get(); const st = doseStats(); const cd = callDate(); const open = cd && !s.call.done && cd >= sod(now());
  store.set({ checkin: null }); completeStep(c.id);
  return { reply: [Z(), T(lead + ' Your log now shows **' + st.taken + ' of ' + st.due + '** doses taken.\n\n' + (open ? 'Your welcome call with Sofia is **' + relDay(cd, true) + ' at ' + s.call.time + '**. ' : '') + 'I’ll check in again next week.\n\nYou can pause check-ins any time in Settings.'), ...(open ? [SRC(callSource())] : []),
    NOTE('Sol logged for the patient in this check-in. That is write-back, which the source of truth places after V1 (Agentic PSP). The answers are also shared with the nurse team.')] };
}
function checkinAnswer(text) {
  const c = { ...store.get().checkin }; const q = norm(text); const yes = /^(yes|yep|yeah|ok|sure|please)/.test(q) && !/^no\b/.test(q);
  const go = (step, res) => { store.set({ checkin: { ...c, step } }); return res; };
  if (c.step === 0) return go(1, { reply: [Z(200), T('Thanks for telling me.\n\nIs it stopping you eating or drinking?')] });
  if (c.step === 1) return go(2, { reply: [S('your package leaflet', 'Feeling or being sick is among the side effects people mention most with Ezmekly.', 800), S('articles in Learn', 'Eat small meals more often, and sip fluids between meals.', 700), Z(),
    T('Feeling sick is listed in your leaflet as a side effect people can get. Smaller meals and slow sips can help.\n\nShould I log it in your symptoms? **Nausea, mild, yesterday evening.**'), SRC(L4, learn('nausea'))] });
  if (c.step === 2) {
    if (yes) store.set((s) => ({ symptoms: [...s.symptoms, { date: iso(addDays(sod(now()), -1)), items: [{ id: 'nausea', sev: 0 }] }] }));
    const m = noEntry(); const lead = yes ? 'Logged. You can change it in Symptoms.' : 'No problem, I’ve left your symptoms as they are.';
    if (!m) return checkinWrap(c, lead);
    return go(3, { reply: [Z(), T(lead + '\n\nOne more thing. There’s no dose logged for **' + fmtDay(m.date) + ', ' + slotName(m) + '**. Did you take it?')] });
  }
  if (c.step === 3) {
    if (yes) return go(4, { reply: [Z(200), T('No problem. Should I log it as taken?')] });
    return checkinWrap(c, 'Thanks for telling me. I’ve left it as not logged, and Sofia can go through it with you.');
  }
  if (yes) { const m = noEntry(); if (m) store.set((s) => ({ doses: { ...s.doses, [iso(m.date)]: { ...(s.doses[iso(m.date)] || {}), [m.slot]: 'taken' } } })); return checkinWrap(c, 'Done.'); }
  return checkinWrap(c, 'No problem, I’ve left it as it is.');
}

/* ---------- Conversations ---------- */
let view = null; let listEl = null; let taEl; let sendEl; let micEl; let sideEl = null; let citeEl = null; let menuEl = null; let busy = false; let rec = null; let speakBtn = null;
const allChats = () => store.get().chats || [];
const current = () => allChats().find((c) => c.id === store.get().chatId) || null;
const usedKeys = () => new Set(((current() || {}).msgs || []).filter((m) => m.key).map((m) => m.key));
const inCheckin = () => { const c = store.get().checkin; return !!c && c.chatId === store.get().chatId; };
function saveMsg(m, title) {
  store.set((s) => {
    let id = s.chatId; let list = s.chats || [];
    if (!id || !list.some((c) => c.id === id)) { id = 'c' + Date.now(); list = [{ id, ts: Date.now(), title: title || m.t || 'New chat', msgs: [] }, ...list]; }
    return { chatId: id, chats: list.map((c) => (c.id === id ? { ...c, ts: Date.now(), title: c.title === 'New chat' && m.t ? m.t : c.title, msgs: [...c.msgs, m] } : c)) };
  });
}
const toParts = (reply) => reply.filter((x) => x.kind !== 'sleep').map((x) => (x.kind === 'search' ? { type: 'search', source: x.source, excerpt: x.excerpt } : x.kind === 'text' ? { type: 'text', text: x.text } : x.kind === 'sources' ? { type: 'sources', sources: x.sources } : x.kind === 'note' ? { type: 'note', t: x.t } : { type: 'escalation' }));

/* ---------- Message parts ---------- */
function inline(el, text, st) {
  text.split('**').forEach((seg, k) => {
    if (!seg) return; const host = k % 2 ? h('b') : el;
    if (st) seg.split(/(\s+)/).forEach((w) => { if (!w) return; if (/^\s+$/.test(w)) host.append(' '); else host.append(h('span', { class: 'w', style: 'animation-delay:' + (st.i++ * 18) + 'ms' }, w)); });
    else host.append(seg);
    if (k % 2) el.append(host);
  });
}
function mdBlock(text, live) {
  const st = live ? { i: 0 } : null; const out = h('div', { class: 'md' });
  text.split('\n\n').forEach((para) => {
    const lines = para.split('\n');
    if (lines.every((l) => l.startsWith('- '))) { const ul = h('ul'); lines.forEach((l) => { const li = h('li'); inline(li, l.slice(2), st); ul.append(li); }); out.append(ul); return; }
    const p = h('p'); lines.forEach((l, i) => { if (i) p.append(h('br')); inline(p, l.startsWith('- ') ? '• ' + l.slice(2) : l, st); }); out.append(p);
  });
  out.dataset.words = st ? st.i : 0;
  return out;
}
function traceStep(p, running) {
  const el = h('div', { class: 'tstep' + (running ? ' run' : '') });
  const head = h('button', { class: 'thead', 'aria-expanded': 'false', onClick: () => { if (running) return; head.setAttribute('aria-expanded', String(el.classList.toggle('open'))); if (el.classList.contains('open')) setTimeout(() => scrollIfNear(), 220); } },
    h('span', { class: 'tico' }, running ? h('i', { class: 'tspin' }) : ic('magnifying-glass', 14)), h('span', { class: 'tlab' }, (running ? 'Checking ' : 'Checked ') + p.source), running ? null : ic('caret-right', 12, 'tcar'));
  el.append(head, h('div', { class: 'tbody' }, h('div', null, h('p', null, p.excerpt || ''))));
  return el;
}
const GO = {
  article: (arg) => actions.openArticle(arg), schedule: () => actions.openSchedule(), appointments: () => actions.openAppointments(), symptoms: () => actions.openSymptoms(),
  insights: async () => { await closeView(view); actions.goTab('insights'); }, journey: async () => { await closeView(view); actions.goTab('care', true); },
};
function closeCite() { if (citeEl) { citeEl.remove(); citeEl = null; } }
function citeCard(anchor, sc) {
  closeCite();
  const rr = view.el.getBoundingClientRect(); const ar = anchor.getBoundingClientRect(); const W = 256;
  const left = Math.max(12, Math.min(ar.left - rr.left + ar.width / 2 - W / 2, rr.width - W - 12));
  const below = ar.bottom - rr.top + 6; const up = below + 150 > rr.height;
  const card = h('div', { class: 'citecard', role: 'dialog', style: 'left:' + left + 'px;width:' + W + 'px;' + (up ? 'bottom:' + (rr.height - (ar.top - rr.top) + 6) + 'px' : 'top:' + below + 'px') },
    h('div', { class: 'ct' }, sc.title), h('div', { class: 'cd' }, sc.description),
    sc.go ? h('button', { class: 'cl', onClick: () => { closeCite(); GO[sc.go](sc.arg); } }, 'Open in the app') : null);
  citeEl = h('div', { class: 'citescrim', onClick: (e) => { if (e.target === citeEl) closeCite(); } }, card);
  view.el.append(citeEl);
}
function sourcesRow(list) {
  return h('div', { class: 'srcs' }, list.map((sc) => h('button', { class: 'cite', 'aria-label': 'Source: ' + sc.label, onClick: (e) => (sc.go === 'article' ? GO.article(sc.arg) : citeCard(e.currentTarget, sc)) }, sc.label)));
}
function escalationCard() {
  const item = (icon, t1, t2, fn) => h('button', { class: 'erow', onClick: fn }, h('span', { class: 'tile sm plain' }, ic(icon, 18)), h('span', { class: 'grow' }, h('div', { class: 't1' }, t1), h('div', { class: 't2' }, t2)), ic('caret-right', 16, 'chev'));
  return h('div', { class: 'esc', role: 'alert' },
    h('div', { class: 'eh' }, h('b', null, 'Please talk to a person about this'), h('span', null, 'I can’t help with this question. You can reach someone here:')),
    item('phone', 'Support line', lineStatus().open ? 'Call your nurse team. Open now' : 'Call your nurse team, ' + MED.hours, () => actions.callNurse()),
    item('stethoscope', 'Your nurse or doctor', 'Use the number from your care team', () => toast('Use the number your care team gave you', 'stethoscope')),
    item('ambulance', 'Emergency services', 'Call your local emergency number if it’s urgent', () => toast('Prototype: no call is placed', 'phone')));
}
function stopSpeaking() { try { window.speechSynthesis.cancel(); } catch (e) { /* not available */ } if (speakBtn) { speakBtn.classList.remove('on'); speakBtn = null; } }
function speak(text, btn) {
  if (!('speechSynthesis' in window)) return toast('Read aloud is not available here', 'speaker-high');
  const was = speakBtn === btn; stopSpeaking(); if (was) return;
  const u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; u.onend = u.onerror = () => { if (speakBtn === btn) stopSpeaking(); };
  speakBtn = btn; btn.classList.add('on'); window.speechSynthesis.speak(u);
}
function msgActions(parts) {
  const text = parts.filter((p) => p.type === 'text').map((p) => p.text).join('\n\n').replace(/\*\*/g, '').replace(/^- /gm, ''); if (!text) return null;
  const sp = h('button', { class: 'mact', 'aria-label': 'Read aloud', onClick: () => speak(text, sp) }, ic('speaker-high', 16));
  return h('div', { class: 'macts' }, h('button', { class: 'mact', 'aria-label': 'Copy', onClick: () => { try { navigator.clipboard.writeText(text); } catch (e) { /* ignore */ } toast('Copied'); } }, ic('copy', 16)), sp);
}
const noteEl = (t) => h('div', { class: 'pnote' }, ic('presentation-chart', 16), h('span', null, h('b', null, 'Presenter note. '), t));
function renderMsg(m) {
  if (m.r === 'u') return h('div', { class: 'msg user' }, h('div', { class: 'bub' }, m.t));
  const el = h('div', { class: 'msg bot' }); let trace = null;
  m.parts.forEach((p) => {
    if (p.type === 'search') { if (!trace) { trace = h('div', { class: 'trace' }); el.append(trace); } trace.append(traceStep(p)); return; }
    trace = null;
    if (p.type === 'text') el.append(mdBlock(p.text)); else if (p.type === 'sources') el.append(sourcesRow(p.sources)); else if (p.type === 'escalation') el.append(escalationCard());
    else if (p.type === 'note' && store.get().presenter) el.append(noteEl(p.t));
  });
  const a = msgActions(m.parts); if (a) el.append(a);
  return el;
}

/* ---------- Chat surface ---------- */
function scrollDown(smooth = true) { if (listEl) requestAnimationFrame(() => listEl && listEl.scrollTo({ top: listEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })); }
function scrollIfNear() { if (listEl && listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 260) scrollDown(); }
function emptyState() {
  const s = store.get();
  return h('div', { class: 'chat-empty' }, sol(88, 'idle'), h('h2', null, 'Hi ' + s.name), h('p', null, 'Ask about Ezmekly, your schedule or what you have logged. Each answer shows where it comes from.'),
    h('div', { class: 'sugs' }, SUGGESTED.map((k) => h('button', { class: 'sug', onClick: () => send(Q[k]) }, h('span', null, Q[k]), ic('arrow-up-right', 16)))));
}
function quickReplies() {
  if (!listEl) return; listEl.querySelectorAll('.fups').forEach((x) => x.remove());
  const c = current(); if (busy || !c || !c.msgs.length) return;
  let opts = [];
  if (inCheckin()) opts = CHIPS[store.get().checkin.step] || [];
  else { const last = c.msgs[c.msgs.length - 1]; const used = usedKeys(); if (last.r === 's') opts = (last.fu || []).filter((k) => !used.has(k)).map((k) => Q[k]); }
  if (!opts.length) return;
  listEl.append(h('div', { class: 'fups' }, opts.map((o) => h('button', { class: 'fup', onClick: () => send(o) }, o))));
  scrollDown();
}
function renderHistory() {
  if (!listEl) return; closeCite(); listEl.replaceChildren();
  const c = current();
  if (!c || !c.msgs.length) { listEl.append(emptyState()); return; }
  c.msgs.forEach((m) => { const el = renderMsg(m); el.style.animation = 'none'; listEl.append(el); });
  quickReplies(); scrollDown(false);
}
async function deliver(res, lead = 600) {
  const m = { r: 's', parts: toParts(res.reply), key: res.key || null, fu: res.fu || null, ts: Date.now() };
  const chatId = store.get().chatId;
  const el = h('div', { class: 'msg bot' }); const typing = h('span', { class: 'typing' }, h('i'), h('i'), h('i'));
  el.append(typing); listEl.append(el); scrollDown();
  await wait(lead); saveMsg(m);
  const here = () => !!listEl && el.isConnected && store.get().chatId === (chatId || store.get().chatId);
  typing.remove(); let trace = null;
  for (const st of res.reply) {
    if (!here()) return;
    if (st.kind === 'sleep') { await wait(st.ms); continue; }
    if (st.kind === 'search') { if (!trace) { trace = h('div', { class: 'trace' }); el.append(trace); } const row = traceStep(st, true); trace.append(row); scrollDown(); await wait(st.ms); row.replaceWith(traceStep(st)); continue; }
    trace = null;
    if (st.kind === 'text') { const b = mdBlock(st.text, true); el.append(b); scrollDown(); await wait(Math.min(1700, 220 + Number(b.dataset.words) * 18)); }
    else if (st.kind === 'sources') { el.append(sourcesRow(st.sources)); scrollDown(); await wait(140); }
    else if (st.kind === 'escalation') { el.append(escalationCard()); scrollDown(); await wait(220); }
    else if (st.kind === 'note' && store.get().presenter) el.append(noteEl(st.t));
  }
  if (!here()) return;
  const a = msgActions(m.parts); if (a) el.append(a);
  scrollDown();
}
function updateSend() { if (sendEl) sendEl.disabled = busy || !taEl.value.trim(); }
export async function send(text) {
  text = (text || '').trim(); if (!text || busy || !listEl) return;
  busy = true; updateSend(); closeCite(); closeMenu(); stopSpeaking();
  listEl.querySelectorAll('.fups, .chat-empty').forEach((x) => x.remove());
  const m = { r: 'u', t: text, ts: Date.now() }; saveMsg(m); listEl.append(renderMsg(m)); scrollDown();
  let res = respond(text);
  if (inCheckin() && !res.hard) res = checkinAnswer(text); // emergencies still win inside a check-in
  try { await deliver(res); } finally { busy = false; updateSend(); quickReplies(); }
}
async function startCheckin(id) {
  if (store.get().steps[id] || busy) return;
  busy = true; updateSend();
  const chatId = 'c' + Date.now();
  store.set((s) => ({ chatId, chats: [{ id: chatId, ts: Date.now(), title: 'Week ' + weekOf(id) + ' check-in', msgs: [] }, ...(s.chats || [])], checkin: { id, step: 0, chatId } }));
  renderHistory(); listEl.querySelectorAll('.chat-empty').forEach((x) => x.remove());
  try { await deliver(checkinOpen(id), 700); } finally { busy = false; updateSend(); quickReplies(); }
}
function newChat() { if (busy) return; stopSpeaking(); store.set({ chatId: null }); renderHistory(); if (taEl) { taEl.value = ''; updateSend(); } }

/* Composer menu and dictation */
function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
function openMenu(anchor) {
  if (menuEl) return closeMenu();
  const rr = view.el.getBoundingClientRect(); const ar = anchor.getBoundingClientRect();
  const pick = (t) => { closeMenu(); taEl.value = t; taEl.dispatchEvent(new Event('input')); taEl.focus(); };
  const box = h('div', { class: 'cmenu', role: 'menu', style: 'left:' + (ar.left - rr.left) + 'px;bottom:' + (rr.height - (ar.top - rr.top) + 8) + 'px' },
    h('div', { class: 'cmh' }, 'Suggested questions'),
    MENU.map((a) => [h('button', { role: 'menuitem', onClick: () => pick(a.text) }, ic(a.icon, 18), a.label), a.sep ? h('i', { class: 'cms' }) : null]));
  menuEl = h('div', { class: 'citescrim', onClick: (e) => { if (e.target === menuEl) closeMenu(); } }, box);
  view.el.append(menuEl);
}
function toggleMic() {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (rec) { rec.stop(); return; }
  if (!R) return toast('Use the microphone on your keyboard to dictate', 'microphone');
  try {
    const base = taEl.value.trim(); rec = new R(); rec.lang = 'en-GB'; rec.interimResults = true;
    rec.onresult = (e) => { taEl.value = (base ? base + ' ' : '') + Array.from(e.results).map((r) => r[0].transcript).join(''); taEl.dispatchEvent(new Event('input')); };
    rec.onend = rec.onerror = () => { rec = null; if (micEl) micEl.classList.remove('on'); if (taEl) taEl.placeholder = PLACEHOLDER; };
    rec.start(); micEl.classList.add('on'); taEl.placeholder = 'Listening...';
  } catch (e) { rec = null; toast('Use the microphone on your keyboard to dictate', 'microphone'); }
}

/* Chats sidebar: history, New chat, About Sol */
function closeSide() { if (!sideEl) return; const el = sideEl; sideEl = null; el.classList.remove('in'); setTimeout(() => el.remove(), 320); }
function openSide() {
  if (sideEl || !view) return; closeCite(); closeMenu();
  const s = store.get(); const list = allChats().filter((c) => c.msgs.length).sort((a, b) => b.ts - a.ts);
  const day = (ts) => { const n = Math.round((sod(new Date()) - sod(new Date(ts))) / 86400000); return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : fmtDay(new Date(ts)); };
  const panel = h('div', { class: 'side', role: 'dialog', 'aria-label': 'Chats' },
    h('div', { class: 'side-h' }, h('b', null, 'Chats'), h('button', { class: 'iconbtn', 'aria-label': 'Close chats', onClick: closeSide }, ic('sidebar-simple', 22))),
    h('button', { class: 'side-new', onClick: () => { closeSide(); newChat(); } }, ic('note-pencil', 20), 'New chat'),
    h('div', { class: 'side-list' }, list.length ? [h('div', { class: 'side-k' }, 'History'), list.map((c) => h('button', { class: 'side-item' + (c.id === s.chatId ? ' on' : ''), onClick: () => { if (busy) return; closeSide(); stopSpeaking(); store.set({ chatId: c.id }); renderHistory(); } },
      h('span', { class: 't1' }, c.title), h('span', { class: 't2' }, day(c.ts))))] : h('p', { class: 'side-empty' }, 'Your earlier chats will show up here.')),
    h('button', { class: 'side-about', onClick: () => { closeSide(); openAboutSol(); } }, ic('info', 20), 'About Sol'));
  sideEl = h('div', { class: 'sidewrap' }, h('div', { class: 'sidescrim', onClick: closeSide }), panel);
  view.el.append(sideEl); requestAnimationFrame(() => sideEl && sideEl.classList.add('in'));
}

/* "Meet your assistant": shown before the first chat (must be acknowledged) and from the sidebar */
export function openAboutSol(first) {
  return new Promise((resolve) => {
    const item = (icon, t1, t2) => h('div', { class: 'ms-item' }, ic(icon, 22), h('div', null, h('div', { class: 't1' }, t1), h('div', { class: 't2' }, t2)));
    const link = (t) => h('button', { class: 'ms-link', onClick: () => toast('Prototype: ' + t + ' would open here', 'info') }, t);
    openSheet((api) => [
      first ? h('div', { style: 'height:6px' }) : sheetHead('', api),
      h('div', { class: 'sh-body meet-sol' }, h('div', { class: 'ms-art' }, sol(112, 'idle')),
        h('h2', { class: 'center' }, 'Meet Sol, your assistant'),
        h('div', { class: 'ms-list' },
          item('warning:fill', 'Not a medical advisor', 'The information is for general use only and doesn’t replace advice from your healthcare team. For anything urgent, contact them directly.'),
          item('sparkle:fill', 'Answers from AI', 'Sol uses AI and can make mistakes. Each answer shows where it comes from, so you can check.'),
          item('clipboard-text:fill', 'Uses your information', 'Your medications, symptoms and appointments. Not call recordings or notes.'))),
      h('div', { class: 'sh-foot' }, first ? h('button', { class: 'btn primary block', onClick: () => { store.set({ solAck: true }); api.close(true); } }, 'Start chat') : null,
        h('p', { class: 'ms-fine' }, first ? 'By continuing, you agree to our ' : 'See our ', link('Terms'), ' and ', link('Privacy Policy'), '.')),
    ], { dismissable: !first, onClose: resolve, cls: first ? 'nograb' : '' });
  });
}

export async function openChat(opts = {}) {
  if (store.get().stage !== 'active') return;
  if (!view) {
    listEl = h('div', { class: 'chat-scroll' });
    taEl = h('textarea', { rows: 1, placeholder: PLACEHOLDER, 'aria-label': 'Message', enterkeyhint: 'send' });
    sendEl = h('button', { class: 'cbtn2 send', disabled: true, 'aria-label': 'Send' }, ic('arrow-up', 18));
    micEl = h('button', { class: 'cbtn2 ghost', 'aria-label': 'Dictate', onClick: toggleMic }, ic('microphone', 20));
    const plus = h('button', { class: 'cbtn2 outline', 'aria-label': 'Suggested questions', onClick: (e) => openMenu(e.currentTarget) }, ic('plus', 18));
    const grow = () => { taEl.style.height = 'auto'; taEl.style.height = Math.min(120, taEl.scrollHeight) + 'px'; updateSend(); };
    taEl.addEventListener('input', grow);
    taEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendEl.click(); } });
    taEl.addEventListener('focus', () => setTimeout(() => scrollDown(), 350));
    sendEl.addEventListener('click', () => { const v = taEl.value; taEl.value = ''; grow(); send(v); });
    const v = { theme: '#fbf3dc' };
    v.el = h('div', { class: 'chat' },
      h('div', { class: 'chat-bg' }),
      h('div', { class: 'chat-top' },
        h('button', { class: 'iconbtn', 'aria-label': 'Chats', onClick: openSide }, ic('sidebar-simple', 22)),
        h('div', { class: 'chat-id' }, sol(28, 'idle'), h('b', null, 'Sol'), h('span', { class: 'badge ai' }, 'AI')),
        h('button', { class: 'iconbtn', 'aria-label': 'Close chat', onClick: () => closeView(v) }, ic('x', 22))),
      listEl,
      h('div', { class: 'composer' }, h('div', { class: 'box' }, taEl, h('div', { class: 'crow' }, plus, h('span', { class: 'spacer' }), micEl, sendEl)),
        h('button', { class: 'foot', onClick: () => openAboutSol() }, 'Sol is an AI assistant, not a nurse or doctor. It can make mistakes.')));
    const onVV = () => scrollDown(false);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onVV);
    v.onClose = () => { if (window.visualViewport) window.visualViewport.removeEventListener('resize', onVV); stopSpeaking(); if (rec) rec.stop(); view = null; listEl = null; sideEl = null; citeEl = null; menuEl = null; };
    v.update = () => {};
    view = v; renderHistory(); openView(v, 'modal');
  }
  if (!store.get().solAck) { await wait(350); await openAboutSol(true); if (!view) return; }
  if (opts.checkin) return startCheckin(opts.checkin);
  if (opts.about) {
    if (busy) return; busy = true; store.set({ chatId: null }); renderHistory(); listEl.querySelectorAll('.chat-empty').forEach((x) => x.remove());
    try { await deliver({ reply: [T('You just finished **' + opts.about + '**. Is there anything from it you’d like to go over?')], fu: ['take', 'food', 'next'] }, 500); } finally { busy = false; updateSend(); quickReplies(); }
    return;
  }
  if (opts.text) { setTimeout(() => send(opts.text), 380); return; }
  if (opts.focus && store.get().solAck) setTimeout(() => taEl && current() && taEl.focus(), 520);
}
actions.openChat = openChat;
