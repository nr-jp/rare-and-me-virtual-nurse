// Sol, the virtual nurse: the chat surface and a scripted engine.
// The engine is deliberately rule-first: topics are detected, and what happens next is a fixed rule, never a model judgement.
import { MED, ABOUT, symptomById } from './data.js';
import {
  h, add, ic, store, cycleInfo, doseStats, now, sod, fmtDay, relDay, addDays, iso, fromIso, lineStatus,
  openSheet, sheetHead, openView, closeView, celebrate, actions, sol, wait, diffDays,
} from './core.js';
import { computeJourney, callDate, typeLabel, startStep, completeStep, openCallDetails } from './journey.js';

const T = (t) => ({ k: 't', t });
const NOTE = (t) => ({ k: 'note', t });
const LEAFLET = 'Ezmekly patient leaflet';
const SUGGEST = ['What’s next on my journey?', 'I missed a dose', 'I have a side effect', 'How do I take it?', 'When is my call?', 'How am I doing?'];

/* ---------- Engine ---------- */
const SIDE = [
  { id: 'rash', re: /rash|acne|pimple|spots|skin|itch/i, label: 'A skin rash', listed: true, body: 'Your leaflet asks you to tell your doctor if you get a rash, which may be bumpy or look like acne. They can suggest ways to look after your skin.' },
  { id: 'diarrhea', re: /diarrh|loose stool|the runs|upset stomach/i, label: 'Diarrhea', listed: true },
  { id: 'vomiting', re: /vomit|throwing up|threw up|being sick/i, label: 'Being sick', listed: true },
  { id: 'nausea', re: /nause|feel(ing)? sick|queasy/i, label: 'Feeling sick', listed: true },
  { id: 'fatigue', re: /tired|fatigue|exhaust|no energy|worn out|wiped/i, label: 'Tiredness', listed: true },
  { id: 'headache', re: /headache|migraine/i, label: 'Headache', listed: true },
  { id: 'muscle', re: /muscle|joint|bone|back pain|aching|aches/i, label: 'Muscle or bone pain', listed: true },
  { id: 'pain', re: /pain|sore|cramp|hurts?\b/i, label: 'Pain', listed: false },
  { id: 'dry', re: /dry skin|dryness/i, label: 'Dry skin', listed: true },
  { id: null, re: /hair|mouth sore|ulcer|swell|swollen|heart|palpitation|side.?effect|reaction|symptom|feel(ing)? (unwell|ill|bad|awful|rough|worse|off|strange|weird)|not feeling (well|good|right|great)|unwell/i, label: null, listed: false },
];
const GENERIC_CARE = 'They can tell you what it means for you and what can help. Mention when it started and how it has changed. If it feels severe or is getting worse quickly, contact your doctor now or use your local emergency number.';

function sideEffect(hit) {
  const b = [T('I’m sorry you’re dealing with that.' + (hit.listed ? ' ' + hit.label + ' is listed in your leaflet as a side effect people can get with Ezmekly.' : ''))];
  b.push({ k: 'care', lvl: 'soon', title: 'Tell your doctor, pharmacist or nurse', body: hit.body || GENERIC_CARE });
  b.push({ k: 'act', icon: 'note-pencil', t1: hit.id ? 'Log ' + symptomById(hit.id).t.toLowerCase() : 'Log a symptom', t2: 'So the dates are right for your next appointment', go: 'symptoms', arg: hit.id });
  b.push({ k: 'pv' });
  b.push(NOTE('Rule: side effect mentioned. Same fixed path every time: signpost to the care team, offer to log, safety report to sponsor PV. Sol does not grade severity or decide who gets a person.'));
  return { b, how: { topic: 'A possible side effect', used: [LEAFLET + ', section 4'], rule: 'Side effect rule: point to your care team and report to the safety team' }, status: 'Checking your leaflet' };
}

function respond(text) {
  const s = store.get(); const name = s.name; const q = text.toLowerCase(); const ci = cycleInfo(); const cd = callDate();
  const callOpen = cd && !s.call.done && cd >= sod(now());

  // 1. Emergency language. Fixed signpost.
  if (/suicid|kill myself|end my life|hurt myself|harm myself|self.?harm|don'?t want to (live|be here)/i.test(q)) {
    return { b: [T('I’m really glad you told me. You deserve support from a person right now.'),
      { k: 'care', lvl: 'sos', title: 'Please reach out now', body: 'If you might act on these thoughts or you are in danger, call your local emergency number. You can also contact a crisis line in your country, your doctor, or someone you trust. You don’t have to carry this alone.' },
      { k: 'call' }, NOTE('Rule: emergency language. Fixed signpost. Sol does not assess risk or contact anyone on the patient’s behalf.')],
    how: { topic: 'Urgent support', used: [], rule: 'Emergency rule: point to emergency help' }, status: 'Here with you' };
  }
  if (/(can'?t|cannot|hard to|trouble|difficulty|struggling to) breath|chest pain|faint(ed|ing)?\b|collaps|unconscious|seizure|severe bleed|emergency|ambulance|\b(999|911|112)\b|allergic reaction|swollen (face|tongue|throat|lips)/i.test(q)) {
    return { b: [{ k: 'care', lvl: 'sos', title: 'Call your local emergency number now', body: 'If this could be an emergency, don’t wait for me or for the nurse line. Call your local emergency number or go to the nearest emergency department.' },
      T('I’m an AI and I can’t call anyone for you. If it turns out not to be an emergency, your doctor or the nurse line can help from here.'), { k: 'pv' },
      NOTE('Rule: emergency language. Fixed signpost. Sol does not assess the situation or contact anyone.')],
    how: { topic: 'A possible emergency', used: [], rule: 'Emergency rule: point to emergency help' }, status: 'Here with you' };
  }
  if (/overdose|took too (much|many)|taken too (much|many)|double dose by mistake|took (two|2|both) (doses|by mistake)/i.test(q)) {
    return { b: [{ k: 'care', lvl: 'now', title: 'Contact your doctor or pharmacist straight away', body: 'Your leaflet says to contact your doctor or pharmacist straight away if you take more Ezmekly than you should. Have the pack with you when you call.' },
      { k: 'call' }, NOTE('Rule: possible overdose. The leaflet sets the action. Sol adds nothing of its own.')],
    how: { topic: 'Taking more than prescribed', used: [LEAFLET + ', section 3'], rule: 'Dose rule: no advice, point to a person' }, status: 'Checking your leaflet' };
  }
  // 2. Vision. The leaflet sets the urgency.
  if (/blurr|vision|eyesight|can'?t see|seeing (double|spots|flashes)|eye (pain|problem)s?|my eyes?\b|floaters/i.test(q) && !/eye (check|test|exam|appointment|specialist)/i.test(q)) {
    return { b: [T('Thank you for telling me. A change in your vision is something your doctor needs to hear about straight away.'),
      { k: 'care', lvl: 'now', title: 'Contact your doctor straight away', body: 'Your leaflet says to tell your doctor straight away if you get blurred vision or any other change to your vision. Don’t wait for your next eye check.' },
      { k: 'act', icon: 'note-pencil', t1: 'Log changes in vision', t2: 'So the dates are right when you speak to them', go: 'symptoms', arg: 'vision' }, { k: 'pv' },
      NOTE('Rule: vision change. Urgency comes from the leaflet, not from the model. Signpost to the doctor, offer the nurse line, safety report.')],
    how: { topic: 'A change in your vision', used: [LEAFLET + ', sections 2 and 4'], rule: 'Side effect rule: point to your doctor and report to the safety team' }, status: 'Checking your leaflet' };
  }
  if (/why can'?t you|why won'?t you|why not (just )?tell/i.test(q)) {
    return { b: [T('Because the right answer depends on things I can’t see or judge, like your full history and how you are feeling today. Dose decisions belong to your doctor.'), T('What I can do is show you the approved information and get you to a person quickly.'), { k: 'call' }],
      how: { topic: 'What Sol can and can’t do', used: [], rule: null } };
  }
  // 3. How to take it (education, from the leaflet)
  if (/how (do|should|can) i take|how to take|swallow|chew|open (the |a |my )?capsules?|crush|dissolve|what time|when (do|should) i take (it|ezmekly|my)|how often|twice a day/i.test(q)) {
    return { b: [T('Ezmekly is taken twice a day, about 12 hours apart, with or without food. Capsules are swallowed whole with water, not chewed, broken or opened.'),
      T('Your app has your doses at ' + s.reminders.am + ' and ' + s.reminders.pm + '.'),
      { k: 'src', sec: 'Section 3 · How to take Ezmekly', pts: ['Take it twice a day, about 12 hours apart.', 'Take it with or without food.', 'Swallow capsules whole with water. Do not chew, break or open them.', 'Take it for 21 days, then stop for 7 days. That is one 28-day cycle.'] },
      { k: 'act', icon: 'list-checks', t1: 'Open medication schedule', t2: 'See and log today’s doses', go: 'schedule' }],
    how: { topic: 'How to take Ezmekly', used: [LEAFLET + ', section 3', 'Your medication schedule'], rule: null }, status: 'Checking your leaflet' };
  }
  // 4. Dose questions. The hard edge.
  if (/stop taking|stop (the |my )?(treatment|ezmekly|medication)|come off|quit|give up (on )?(the )?(treatment|ezmekly)|pause (the |my )?(treatment|ezmekly)/i.test(q)) {
    return { b: [T('Stopping or pausing treatment is a decision to make with your doctor. Your leaflet says not to stop taking Ezmekly unless your doctor tells you to.'),
      { k: 'care', lvl: 'soon', title: 'Talk to your doctor before you stop', body: 'Tell them what is making you think about it. There may be things they can change or help with.' },
      { k: 'call' }, NOTE('Rule: dose or treatment decision. No advice. Signpost to the prescriber, offer the nurse line. This is also a persistence signal the PSP would want to see.')],
    how: { topic: 'Stopping treatment', used: [LEAFLET + ', section 3'], rule: 'Dose rule: no advice, point to a person' }, status: 'Checking your leaflet' };
  }
  if (/(increase|decrease|reduce|lower|higher|change|adjust|half|halve|split).{0,20}(dose|capsule|ezmekly|medication)|how (many|much) (should|do|can) i take|(dose|capsule).{0,12}(too (high|low|strong)|wrong)/i.test(q)) {
    return { b: [T('Only your doctor sets or changes your dose. I can’t advise on that, and neither can a nurse.'),
      T('Your app has Ezmekly ' + MED.dose + ' at ' + s.reminders.am + ' and ' + s.reminders.pm + ', as it was entered when you set it up.'), { k: 'call' },
      NOTE('Rule: dose question. No advice. Sol can read back what is in the app, nothing more.')],
    how: { topic: 'Your dose', used: ['Your medication schedule'], rule: 'Dose rule: no advice, point to a person' }, status: 'Looking at your schedule' };
  }
  if (/(miss|forgot|forget|skipp?ed|late|double|extra|two doses|catch up|make up|didn'?t take).{0,40}(dose|capsule|tablet|pill|ezmekly|medication|medicine|\bit\b)|(dose|capsule|pill|medication|ezmekly).{0,30}(miss|forgot|late|skip)|sick after|threw up after|vomit(ed)? after|can i (still )?take|should i (still )?take|take it (now|today|later|tonight)/i.test(q)) {
    const vomit = /sick after|threw up|vomit/i.test(q);
    return { b: [T('I can’t tell you what to do about a specific dose. That one is for your doctor, pharmacist or nurse.'), T('Here is what your leaflet says about it.'),
      { k: 'src', open: true, sec: vomit ? 'Section 3 · If you are sick after taking Ezmekly' : 'Section 3 · If you forget to take Ezmekly', pts: vomit ? ['If you are sick (vomit) after taking a dose, do not take an extra dose.', 'Take your next dose at the usual time.'] : ['If you forget a dose, skip it and take your next dose at the usual time.', 'Do not take a double dose to make up for a forgotten one.'] },
      { k: 'call' }, { k: 'chips', o: ['Open medication schedule', 'Why can’t you tell me?'] },
      NOTE('Rule: dose question. Sol never answers in its own words. It surfaces the approved leaflet section and offers a person. Open decision: whether leaflet text should appear here at all.')],
    how: { topic: 'A missed or late dose', used: [LEAFLET + ', section 3'], rule: 'Dose rule: no advice, show the leaflet, point to a person' }, status: 'Checking your leaflet' };
  }
  // 5. Interactions. Topic detected, fixed signpost.
  if (/grapefruit|alcohol|\bwine\b|\bbeer\b|drinking|ibuprofen|paracetamol|antibiotic|supplement|vitamin|herbal|st\.? john|other (medicine|medication|drug|tablet)s?|interact|vaccin|painkiller/i.test(q)) {
    return { b: [T('Good thing to check, and it needs someone who knows everything you take. I can’t check how Ezmekly fits with other medicines, food or drink for you.'),
      { k: 'care', lvl: 'soon', title: 'Ask your doctor or pharmacist', body: 'Tell them about all the medicines and supplements you take, including ones you buy yourself. Your leaflet covers this in section 2.' },
      NOTE('Rule: interaction topic detected (the grapefruit juice case). Fixed signpost. No model judgement.')],
    how: { topic: 'Other medicines, food or drink', used: [LEAFLET + ', section 2'], rule: 'Interaction rule: point to doctor or pharmacist' }, status: 'Checking your leaflet' };
  }
  if (/pregnan|contracepti|birth control|breast.?feed|fertility|condom|having a baby|trying for a baby/i.test(q)) {
    return { b: [T('This is an important one to go through with your doctor. Your leaflet has specific rules on pregnancy, contraception and breastfeeding while taking Ezmekly, including for a period after your last dose.'),
      { k: 'care', lvl: 'soon', title: 'Talk to your doctor', body: 'They will tell you what applies to you and for how long. Tell them straight away if you or your partner become pregnant.' }, { k: 'call' }],
    how: { topic: 'Pregnancy and contraception', used: [LEAFLET + ', section 2'], rule: 'Point to your doctor' }, status: 'Checking your leaflet' };
  }
  if (/eye (check|test|exam|appointment|specialist)|heart (check|scan|test)|check.?ups?|blood test|monitor/i.test(q)) {
    return { b: [T('Ezmekly comes with routine checks. An eye specialist checks your vision before you start and regularly during treatment, and your doctor checks how your heart is working before and during treatment.'),
      T('Your clinic sets the dates. You can keep them next to your calls with Sofia.'), { k: 'act', icon: 'calendar-blank', t1: 'Open appointments', t2: 'Calls and check-ups in one place', go: 'appointments' }],
    how: { topic: 'Checks during treatment', used: [LEAFLET + ', section 2', 'Your appointments'], rule: null }, status: 'Checking your leaflet' };
  }
  // 6. Side effects. One fixed path.
  for (const hit of SIDE) if (hit.re.test(q)) return sideEffect(hit);

  // 7. Everyday questions
  if (/\bfood\b|\beat|meal|empty stomach|breakfast|dinner|with milk/i.test(q)) {
    return { b: [T('You can take Ezmekly with or without food. Capsules are swallowed whole with water.'), { k: 'src', sec: 'Section 3 · How to take Ezmekly', pts: ['Take it with or without food.', 'Swallow capsules whole with water.'] }],
      how: { topic: 'Ezmekly and food', used: [LEAFLET + ', section 3'], rule: null }, status: 'Checking your leaflet' };
  }
  if (/cycle|rest week|\bbreak\b|21 days|28 days|7 days|week off|days? off|what day|which day/i.test(q)) {
    const left = 21 - ci.day;
    const b = [T(ci.on ? 'You’re on day ' + ci.day + ' of cycle ' + ci.cycle + '. ' + (left > 0 ? left + ' treatment ' + (left === 1 ? 'day' : 'days') + ' to go, then your rest week starts ' + relDay(ci.restStart, true) + '.' : 'Today is your last treatment day before the rest week.') : 'You’re in your rest week, day ' + ci.day + ' of 28. Cycle ' + (ci.cycle + 1) + ' starts ' + relDay(ci.nextCycle, true) + '.'),
      T('Each cycle is 28 days: 21 days of Ezmekly, then a 7 day break.')];
    if (/why/i.test(q)) b.push(T('The break is part of how Ezmekly is prescribed. If you want to understand what it means for you, your doctor is the right person to ask.'));
    b.push({ k: 'journey' });
    return { b, how: { topic: 'Your treatment cycle', used: [LEAFLET + ', section 3', 'Your treatment start date'], rule: null }, status: 'Looking at your schedule' };
  }
  if (/how long|when will it (work|start|help)|is it working|shrink|get(ting)? better|results|cure|will it work/i.test(q)) {
    return { b: [T('That’s a question for your doctor, because the answer depends on you. Treatment continues in cycles for as long as your doctor recommends, and people respond differently.'),
      T('If it helps, put it in your notes so it doesn’t slip your mind when you speak to Sofia or your doctor.'),
      callOpen ? { k: 'act', icon: 'note-pencil', t1: 'Add to notes for your call', t2: 'Welcome call with Sofia, ' + relDay(cd, true), go: 'callnotes' } : { k: 'call' }],
    how: { topic: 'How treatment is going', used: [LEAFLET + ', section 3'], rule: 'Point to your doctor' } };
  }
  if (/driv|\bcar\b|machine/i.test(q)) {
    return { b: [T('Your leaflet says Ezmekly can cause tiredness and blurred vision. If you feel tired or your vision is affected, don’t drive or use machines.')],
      how: { topic: 'Driving', used: [LEAFLET + ', section 2'], rule: null }, status: 'Checking your leaflet' };
  }
  if (/\bstor(e|age|ing)\b|fridge|travel|holiday|flight|abroad|time zone|temperature|keep (it|them)/i.test(q)) {
    return { b: [T('Keep Ezmekly in its original pack, out of the sight and reach of children. The full storage instructions are in section 5 of your leaflet.'),
      T('If you are traveling across time zones, your doctor, pharmacist or nurse can help you plan your dose times before you go.'), { k: 'call' }],
    how: { topic: 'Storage and travel', used: [LEAFLET + ', section 5'], rule: null }, status: 'Checking your leaflet' };
  }
  if (/what is ezmekly|what'?s ezmekly|how does (it|ezmekly) work|mirdametinib|\bmek\b|what does (it|ezmekly) do/i.test(q)) {
    return { b: [T('Ezmekly contains mirdametinib. It blocks a protein called MEK, which is involved in the growth of plexiform neurofibromas in people with NF1.'),
      { k: 'act', icon: 'book-open', t1: 'Your 28-day cycle, explained', t2: 'Article · Learning', go: 'article', arg: 'cycle' }],
    how: { topic: 'What Ezmekly is', used: [LEAFLET + ', section 1'], rule: null }, status: 'Checking your leaflet' };
  }
  if (/nf1|neurofibrom|plexiform|my condition|tumou?rs?/i.test(q)) {
    return { b: [T('Plexiform neurofibromas are tumors that grow along nerves in some people with neurofibromatosis type 1, or NF1. They are not cancerous, but they can cause symptoms depending on where they are.'),
      { k: 'act', icon: 'book-open', t1: 'Understanding plexiform neurofibromas', t2: 'Article · Learning', go: 'article', arg: 'nf1' }],
    how: { topic: 'About NF1', used: ['Rare & Me learning library'], rule: null } };
  }
  if (/how am i doing|adherence|my (doses|logs?)\b|doses? (taken|logged)|did i take|have i taken|on track/i.test(q)) {
    const st = doseStats(); const b = [{ k: 'stat' }, T('Since you started, your log shows ' + st.taken + ' of ' + st.due + ' doses taken.')];
    if (st.missed.length) { const m = st.missed[st.missed.length - 1]; b.push(T('The ' + (m.slot === 'am' ? 'morning' : 'evening') + ' dose on ' + fmtDay(m.date) + ' has no log. If you took it, you can add it.')); b.push({ k: 'act', icon: 'list-checks', t1: 'Open medication schedule', t2: 'Add or correct a log', go: 'schedule' }); }
    else b.push(T('Nothing missing. That is a strong start.'));
    return { b, how: { topic: 'Your dose log', used: ['Your medication logs'], rule: null }, status: 'Looking at your logs' };
  }
  if (/when is my|next call|welcome call|sofia|my nurse|speak (to|with)|talk (to|with) (a |my |the )?(nurse|human|person|someone)|real person|\bhuman\b|call (a|the|my) nurse|phone (a|the|my)? ?nurse|call me|\bring\b/i.test(q)) {
    return { b: [T(callOpen ? 'Your welcome call with Sofia is ' + relDay(cd, true) + ' at ' + s.call.time + '. She calls you, and you can move it if the time doesn’t suit.' : 'You can reach the nurse line directly.'), { k: 'call' }],
      how: { topic: 'Talking to a nurse', used: ['Your support program'], rule: 'The way to a person is always open' }, status: 'Looking at your calls' };
  }
  if (/what'?s next|what is next|next step|journey|where am i|progress|what should i do|to.?do|what now/i.test(q)) {
    const j = computeJourney(); const b = [T('You’re ' + j.done + ' of ' + j.total + ' steps into this cycle’s journey.')];
    if (!j.current && j.nextTimed) b.push(T('You’re up to date. Next to open is “' + j.nextTimed.title + '”, ' + relDay(j.nextTimed.opens, true) + '.'));
    b.push({ k: 'journey' });
    return { b, how: { topic: 'Your journey', used: ['Your journey progress'], rule: null }, status: 'Looking at your journey' };
  }
  if (/open medication schedule|log (a |my |today'?s )?(dose|doses|medication)|mark.{0,12}taken|i (just )?took (it|my)/i.test(q)) {
    return { b: [T('You can log it in your medication schedule.'), { k: 'act', icon: 'list-checks', t1: 'Open medication schedule', t2: 'See and log today’s doses', go: 'schedule' }, NOTE('V1 is read-only: Sol links to the log. Writing back into the record is the Agentic PSP step.')],
      how: { topic: 'Logging a dose', used: [], rule: null } };
  }
  if (/log (a |my )?symptom|track (a |my )?symptom/i.test(q)) {
    return { b: [T('Of course.'), { k: 'act', icon: 'note-pencil', t1: 'Log a symptom', t2: 'Takes less than a minute', go: 'symptoms' }], how: { topic: 'Logging a symptom', used: [], rule: null } };
  }
  if (/remind/i.test(q)) {
    return { b: [T(s.reminders.on ? 'Your reminders are on at ' + s.reminders.am + ' and ' + s.reminders.pm + '. They pause by themselves in your rest week.' : 'Your reminders are off at the moment.'), { k: 'act', icon: 'bell', t1: s.reminders.on ? 'Change reminders' : 'Set your reminders', t2: 'Two a day on treatment days', go: 'reminders' }],
      how: { topic: 'Reminders', used: ['Your settings'], rule: null } };
  }
  if (/scared|afraid|anxious|anxiety|worried|worry|overwhelm|lonely|\balone\b|depress|\bsad\b|crying|stress|can'?t cope|fed up|hopeless|frighten|nervous/i.test(q)) {
    return { b: [T('That sounds like a lot to carry, and it makes sense. Starting a treatment brings up more than the practical side.'),
      T('I’m an AI, so I can listen and point you to things, but this is something a person does better. Sofia talks with people about exactly this.'), { k: 'call' },
      { k: 'act', icon: 'book-open', t1: 'Talking to family and friends about NF1', t2: 'Article · Learning', go: 'article', arg: 'talk' }],
    how: { topic: 'How you are feeling', used: [], rule: 'The way to a person is always open' }, status: 'Here with you' };
  }
  if (/are you (a |an )?(real|human|person|nurse|robot|ai|bot|doctor)|who are you|what are you|are you real|is this (a )?(real|bot|ai)/i.test(q)) {
    return { b: [T('I’m Sol, an AI assistant. I’m not a nurse or a doctor, and I’m not a person.'), T('I answer from approved information about Ezmekly and from what you have logged in this app. I don’t give medical advice and I can’t change your treatment. When you need a person, I’ll point you to Sofia or your doctor.')],
      how: { topic: 'What Sol is', used: [], rule: null } };
  }
  if (/privacy|my data|who (can )?sees?|confidential|shared? with|what happens to/i.test(q)) {
    return { b: [T(ABOUT[5][1]), T('You can read more under About this support in My Care.')], how: { topic: 'What happens to what you share', used: ['About this support'], rule: null } };
  }
  if (/cost|price|\bpay|insurance|reimburs|refill|deliver|pharmacy|prescription|run(ning)? (out|low)|ran (out|low)|supply|order more|more capsules/i.test(q)) {
    return { b: [T('I can’t help with costs, insurance, deliveries or refills yet. Sofia’s team can point you in the right direction.'), { k: 'call' },
      NOTE('V1 scope is enrolment, treatment education and adherence. Coverage, financial support and delivery sit on the roadmap, so Sol hands these to the human team.')],
    how: { topic: 'Costs, supply and delivery', used: [], rule: 'Outside what Sol covers today' } };
  }
  if (/leave (the )?program|unenrol|opt.?out|stop (the )?support|cancel (the )?(program|support)/i.test(q)) {
    return { b: [T('To leave the support program, call a nurse. Your guidance in the app stays, and nurse support ends when your treatment ends.'), { k: 'call' }], how: { topic: 'Leaving the program', used: ['About this support'], rule: null } };
  }
  if (/what can you (do|help)|what do you do|^help\b|how can you help/i.test(q)) {
    return { b: [T('Three things. I answer questions about Ezmekly from approved information. I keep track of your journey and what comes next. And I get you to Sofia or your doctor when you need a person.'), { k: 'chips', o: SUGGEST.slice(0, 4) }], how: { topic: 'What Sol can do', used: [], rule: null } };
  }
  if (/^(hi|hello|hey|hiya|good (morning|afternoon|evening))\b/i.test(q)) return { b: [T('Hi ' + name + '. What’s on your mind?'), { k: 'chips', o: SUGGEST.slice(0, 4) }], how: null };
  if (/thank|cheers|\bgreat\b|perfect|got it|^ok(ay)?\b|helpful/i.test(q)) return { b: [T('Any time, ' + name + '.')], how: null };

  return { b: [T('I don’t have approved information to answer that well, and I’d rather not guess.'), T('Here is what I can help with, or you can take it straight to a nurse.'), { k: 'chips', o: SUGGEST.slice(0, 4) }, { k: 'call' },
    NOTE('No match. Sol says so and offers a person. Nothing is generated outside approved content.')],
  how: { topic: 'Not covered', used: [], rule: 'No approved answer: say so and offer a person' } };
}

/* ---------- Check-in (deterministic, opened from the journey or a notification) ---------- */
function checkinAsk(step) {
  const s = store.get(); const wk = s.checkin.id === 'c-week2' ? 2 : 1; const st = doseStats();
  if (step === 0) return { b: [T(wk === 1 ? 'It’s been a week on Ezmekly, ' + s.name + '. Got two minutes for three quick questions?' : 'Two weeks in, ' + s.name + '. Got two minutes for three quick questions?'), { k: 'chips', o: ['Let’s do it', 'Not now'] }], how: { topic: 'Week ' + wk + ' check-in', used: ['Your journey'], rule: 'Scheduled check-in, opened by you' } };
  if (step === 1) return { b: [T('How has taking Ezmekly been this week?'), { k: 'chips', o: ['Smooth', 'A few bumps', 'Hard going'] }] };
  if (step === 2) return { b: [{ k: 'stat' }, T('Your log shows ' + st.taken + ' of ' + st.due + ' doses taken so far. Does that sound right?'), { k: 'chips', o: ['Yes, that’s right', 'I missed one or two', 'I missed more than that'] }], how: { topic: 'Your dose log', used: ['Your medication logs'], rule: null } };
  if (step === 2.5) return { b: [T('Thanks for being straight with me. What got in the way?'), { k: 'chips', o: ['I forgot', 'I felt unwell', 'I ran low on capsules', 'My routine changed'] }] };
  if (step === 3) return { b: [T('Last one. Is there anything you would like to talk through with Sofia?'), { k: 'chips', o: ['No, I’m good', 'Yes, I’d like to talk'] }] };
  return null;
}
function checkinAnswer(text) {
  const s = store.get(); const c = { ...s.checkin }; const q = text.toLowerCase(); const pre = [];
  const next = (step, extra = []) => { c.step = step; store.set({ checkin: c }); const a = checkinAsk(step); return { b: [...pre, ...extra, ...a.b], how: a.how || null }; };
  if (c.step === 0) {
    if (/not now|later|no\b/.test(q)) { store.set({ checkin: null }); return { b: [T('No problem. It stays open in your journey for when you are ready.')], how: null }; }
    return next(1);
  }
  if (c.step === 1) {
    c.a1 = text; pre.push(T(/smooth|good|fine|easy|well/.test(q) ? 'Good to hear.' : /hard|difficult|tough|bad/.test(q) ? 'I’m sorry it has been hard. Thank you for saying so.' : 'That is common in the first weeks.'));
    return next(2);
  }
  if (c.step === 2) {
    c.a2 = text;
    if (/missed|no\b|not|more/.test(q) && !/yes/.test(q)) return next(2.5);
    pre.push(T('Great.')); return next(3);
  }
  if (c.step === 2.5) {
    c.a2b = text; const extra = [];
    if (/unwell|sick|ill|side/.test(q)) { extra.push(T('I’m sorry you felt unwell.'), { k: 'care', lvl: 'soon', title: 'Tell your doctor, pharmacist or nurse', body: GENERIC_CARE }, { k: 'act', icon: 'note-pencil', t1: 'Log a symptom', t2: 'So the dates are right for your next appointment', go: 'symptoms' }, { k: 'pv' }, NOTE('Rule: side effect mentioned inside a check-in. Same fixed path as anywhere else.')); }
    else if (/low|ran|supply|capsule/.test(q)) extra.push(T('Running low is stressful. Sofia’s team can help you sort out your next supply.'), { k: 'call' });
    else if (/routine|changed|schedule/.test(q)) extra.push(T('Routines shift. You can see your dose times in the medication schedule. If you want to move them, check with your nurse or pharmacist how to keep the two doses about 12 hours apart.'));
    else extra.push(T(s.reminders.on ? 'Forgetting is the most common reason. Your reminders are on at ' + s.reminders.am + ' and ' + s.reminders.pm + ', so tell me if the times stop working for you.' : 'Forgetting is the most common reason. Reminders can help, and there is a quick step for them in your journey.'));
    return next(3, extra);
  }
  if (c.step === 3) {
    c.a3 = text; const yes = /yes|talk|call|please/.test(q) && !/^no/.test(q);
    const id = c.id; const wk = id === 'c-week2' ? 2 : 1;
    store.set({ checkin: null }); completeStep(id);
    const b = [];
    if (yes) b.push(T('You can reach her on the nurse line. Your answers go to her team either way, so she will have the context.'), { k: 'call' });
    b.push(T('That’s your week ' + wk + ' check-in done. Thank you, ' + s.name + '.'), { k: 'shared' }, { k: 'journey' },
      NOTE('Check-in answers are relayed to the PSP CRM (iBond for Rare & Me), so the nurse sees them before the next call. The model does not decide who gets a call.'));
    return { b, how: { topic: 'Week ' + wk + ' check-in', used: ['Your answers', 'Your medication logs'], rule: 'Shared with your nurse team' }, party: true };
  }
  return null;
}

/* ---------- Chat surface ---------- */
let view = null; let listEl; let statusEl; let avatarEl; let busy = false; let suggEl; let taEl; let sendEl;
const push = (m) => store.set((s) => ({ chat: [...s.chat, m] }));
function setStatus(txt, state) {
  if (!statusEl) return;
  statusEl.textContent = txt || 'Your virtual nurse'; avatarEl.dataset.state = state || 'idle';
}
function scrollDown(smooth = true) { if (listEl) requestAnimationFrame(() => listEl.scrollTo({ top: listEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })); }

function callBlock() {
  const s = store.get(); const ls = lineStatus(); const cd = callDate(); const callOpen = cd && !s.call.done && cd >= sod(now());
  return h('div', { class: 'callcard' },
    h('div', { class: 'hd' }, h('span', { class: 'avatar' }, 'S', h('i', { class: 'on' + (ls.open ? '' : ' off') })),
      h('div', null, h('div', { class: 't1' }, 'Sofia and the nurse team'), h('div', { class: 't2' }, ls.label))),
    callOpen ? h('div', { class: 'next' }, ic('calendar-check', 16), 'Welcome call ' + relDay(cd, true) + ' at ' + s.call.time) : null,
    h('div', { class: 'btnrow' },
      h('button', { class: 'btn sky sm', onClick: () => actions.callNurse() }, ic('phone:fill', 15), 'Call a nurse'),
      callOpen ? h('button', { class: 'btn secondary sm', onClick: () => openCallDetails() }, 'Prepare or move call') : null));
}
function statBlock() {
  const st = doseStats(); const s = store.get(); const today = sod(now()); const week = h('div', { class: 'week' });
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i); const rec = s.doses[iso(d)] || {}; const before = d < fromIso(s.treatmentStart);
    const cell = (v) => h('i', { class: before ? '' : v === 'taken' ? 't' : (i === 0 ? '' : 'm') });
    week.append(h('div', { class: 'd' }, h('div', { class: 'p' }, cell(rec.am), cell(rec.pm)), ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]));
  }
  return h('div', { class: 'statblk' }, h('div', { class: 'hstack', style: 'justify-content:space-between' },
    h('div', null, h('div', { class: 'n' }, st.taken + ' of ' + st.due), h('div', { class: 'l' }, 'doses logged as taken since you started')),
    h('span', { class: 'tile round' }, ic('pill', 26))), week);
}
function journeyBlockChat() {
  const j = computeJourney(); const cur = j.current;
  if (cur) return h('button', { class: 'jblk', onClick: async () => { if (cur.type !== 'checkin') await closeView(view); startStep(cur); } },
    h('span', { class: 'nico' }, ic(cur.icon, 22)), h('span', { style: 'flex:1;min-width:0' }, h('div', { class: 't1' }, cur.title), h('div', { class: 't2' }, 'Next on your journey · ' + typeLabel(cur).split(' · ')[1])), ic('arrow-right', 18));
  return h('button', { class: 'jblk', onClick: async () => { await closeView(view); actions.goTab('care', true); } },
    h('span', { class: 'nico' }, ic('path', 22)), h('span', { style: 'flex:1;min-width:0' }, h('div', { class: 't1' }, 'Open my journey'), h('div', { class: 't2' }, j.done + ' of ' + j.total + ' steps done in this cycle')), ic('arrow-right', 18));
}
const GO = {
  symptoms: (arg) => actions.openSymptoms(arg), schedule: () => actions.openSchedule(), appointments: () => actions.openAppointments(),
  reminders: () => actions.openReminders(), article: (arg) => actions.openArticle(arg), callnotes: () => openCallDetails(),
};
function renderBlock(b, live) {
  if (b.k === 't') {
    const el = h('div', { class: 'txt' });
    if (live) b.t.split(' ').forEach((w, i) => { el.append(h('span', { class: 'w', style: 'animation-delay:' + (i * 26) + 'ms' }, w), ' '); }); else el.textContent = b.t;
    return el;
  }
  if (b.k === 'src') {
    const el = h('div', { class: 'blk src' + (b.open ? ' open' : '') });
    el.append(h('button', { class: 'src-h', onClick: () => { el.classList.toggle('open'); if (el.classList.contains('open')) setTimeout(() => scrollDown(), 200); } },
      h('span', { class: 'tile sm' }, ic('book-open', 18)), h('span', { style: 'min-width:0;text-align:left' }, h('div', { class: 't1' }, LEAFLET), h('div', { class: 't2' }, b.sec)), ic('caret-down', 18, 'chev')),
    h('div', { class: 'src-b' }, h('div', null, h('ul', null, b.pts.map((p) => h('li', null, p))), h('div', { class: 'fine' }, 'Summary of the approved leaflet. Always read the leaflet that comes in your pack.'))));
    return el;
  }
  if (b.k === 'care') {
    return h('div', { class: 'blk care ' + (b.lvl === 'now' ? 'now' : b.lvl === 'sos' ? 'sos' : '') },
      h('div', { class: 'hd' }, ic(b.lvl === 'sos' ? 'siren:fill' : b.lvl === 'now' ? 'warning:fill' : 'stethoscope', 22), b.title), h('p', null, b.body),
      b.lvl !== 'sos' ? h('div', { class: 'btnrow' }, h('button', { class: 'btn secondary sm', onClick: () => actions.callNurse() }, ic('phone', 15), 'Call a nurse')) : null);
  }
  if (b.k === 'pv') return h('div', { class: 'blk pv' }, ic('shield-check', 18), h('span', null, 'Because you mentioned a possible side effect, it is passed to the safety team at ' + MED.maker + '. This is routine and does not affect your care.'));
  if (b.k === 'shared') return h('div', { class: 'blk pv' }, ic('users', 18), h('span', null, 'Shared with your nurse team: your check-in answers and your dose log. Sofia sees them before your next call.'));
  if (b.k === 'call') return h('div', { class: 'blk' }, callBlock());
  if (b.k === 'stat') return h('div', { class: 'blk' }, statBlock());
  if (b.k === 'journey') return h('div', { class: 'blk' }, journeyBlockChat());
  if (b.k === 'act') return h('div', { class: 'blk' }, h('button', { class: 'actblk', onClick: () => GO[b.go] && GO[b.go](b.arg) }, h('span', { class: 'tile sm' }, ic(b.icon, 18)), h('span', { style: 'flex:1;min-width:0;text-align:left' }, h('div', { class: 't1' }, b.t1), h('div', { class: 't2' }, b.t2)), ic('caret-right', 16, 'muted')));
  if (b.k === 'note') return store.get().presenter ? h('div', { class: 'pnote' }, ic('presentation-chart', 16), h('span', null, h('b', null, 'Presenter note. '), b.t)) : null;
  if (b.k === 'chips') return h('div', { class: 'qreplies' }, b.o.map((o) => h('button', { class: 'chip', onClick: () => send(o) }, o)));
  return null;
}
function provRow(m) {
  if (!m.how) return null;
  const chips = [];
  (m.how.used || []).forEach((u) => chips.push(h('button', { class: 'provchip', onClick: () => openHow(m) }, ic(/leaflet/i.test(u) ? 'book-open' : 'list-checks', 13), u.replace(LEAFLET + ', ', 'Leaflet, '))));
  if (m.how.rule) chips.push(h('button', { class: 'provchip', onClick: () => openHow(m) }, ic('shield-check', 13), 'Why this answer'));
  return chips.length ? h('div', { class: 'prov' }, chips) : null;
}
function openHow(m) {
  openSheet((api) => [sheetHead('How Sol answered', api), h('div', { class: 'sh-body' },
    h('div', { class: 'list' },
      h('div', { class: 'how' }, h('span', { class: 'tile sm' }, ic('chat-circle-dots', 18)), h('div', null, h('div', { class: 't1' }, 'Understood as'), h('div', { class: 't2' }, m.how.topic))),
      (m.how.used || []).length ? h('div', { class: 'how' }, h('span', { class: 'tile sm' }, ic('book-open', 18)), h('div', null, h('div', { class: 't1' }, 'Looked at'), h('div', { class: 't2' }, m.how.used.join('. ') + '.'))) : null,
      m.how.rule ? h('div', { class: 'how' }, h('span', { class: 'tile sm' }, ic('shield-check', 18)), h('div', null, h('div', { class: 't1' }, 'Rule that applied'), h('div', { class: 't2' }, m.how.rule + '.'))) : null),
    h('p', { class: 'small muted mt16', style: 'padding:0 4px' }, 'Sol answers from approved information about Ezmekly and from what you have logged. It does not give medical advice, and fixed rules decide when it points you to a person.')),
  h('div', { style: 'height:calc(14px + var(--safe-b))' })]);
}
function renderMsg(m) {
  if (m.r === 'u') return h('div', { class: 'msg user' }, h('div', { class: 'bub' }, m.t));
  const el = h('div', { class: 'msg bot' });
  m.b.forEach((b) => { if (b.k === 'chips') return; const n = renderBlock(b, false); if (n) el.append(n); });
  const p = provRow(m); if (p) el.append(p);
  return el;
}
function renderHistory() {
  listEl.replaceChildren();
  const chat = store.get().chat;
  if (!chat.length) { listEl.append(hero()); return; }
  let lastDay = null;
  chat.forEach((m, i) => {
    const d = new Date(m.ts); const key = iso(d);
    if (key !== lastDay) { listEl.append(h('div', { class: 'daysep' }, diffDays(d, new Date()) === 0 ? 'Today' : fmtDay(d))); lastDay = key; }
    const el = renderMsg(m); el.style.animation = 'none'; listEl.append(el);
    if (i === chat.length - 1 && m.r === 's') { const cb = m.b.find((b) => b.k === 'chips'); if (cb) el.append(renderBlock(cb)); }
  });
  scrollDown(false);
}
function hero() {
  const s = store.get();
  return h('div', { class: 'chat-hero' }, sol(104, 'idle'),
    h('h2', null, 'Hi ' + s.name + ', what’s on your mind?'),
    h('p', null, 'Ask about Ezmekly, your schedule or what comes next. To talk to a person, tap Nurse at the top.'),
    h('div', { class: 'chips wrap', style: 'justify-content:center;margin-top:18px;gap:8px' }, SUGGEST.slice(0, 5).map((o) => h('button', { class: 'chip', onClick: () => send(o) }, o))));
}
async function deliver(res) {
  const typing = h('div', { class: 'msg bot' }, h('span', { class: 'typing' }, h('i'), h('i'), h('i')));
  listEl.append(typing); scrollDown();
  setStatus('Thinking', 'thinking'); await wait(650 + Math.random() * 350);
  if (res.status && res.status !== 'Here with you') { setStatus(res.status, 'thinking'); await wait(700); }
  const m = { r: 's', b: res.b, how: res.how, ts: Date.now() };
  push(m);
  if (!listEl) return;
  const el = h('div', { class: 'msg bot' }); typing.replaceWith(el);
  setStatus('Sol is replying', 'speaking');
  for (const b of res.b) {
    const n = renderBlock(b, true); if (!n) continue;
    el.append(n); scrollDown();
    await wait(b.k === 't' ? Math.min(1500, 240 + b.t.split(' ').length * 26) : 320);
    if (!listEl) return;
  }
  const p = provRow(m); if (p) { el.append(p); scrollDown(); }
  setStatus(null, 'idle');
  if (res.party) { celebrate(1); }
}
export async function send(text) {
  text = (text || '').trim(); if (!text || busy || !listEl) return;
  busy = true; updateSend();
  listEl.querySelectorAll('.qreplies').forEach((q) => q.remove());
  const heroEl = listEl.querySelector('.chat-hero'); if (heroEl) { heroEl.remove(); listEl.append(h('div', { class: 'daysep' }, 'Today')); }
  const m = { r: 'u', t: text, ts: Date.now() }; push(m); listEl.append(renderMsg(m)); scrollDown();
  let res = null;
  if (store.get().checkin) {
    // Safety and dose rules still win inside a check-in.
    const probe = respond(text);
    const guarded = probe.how && /rule/i.test(probe.how.rule || '') && !/No approved|Outside|always open/i.test(probe.how.rule || '');
    const step = store.get().checkin.step;
    if (guarded && step !== 2.5) { const again = checkinAsk(step); res = { ...probe, b: [...probe.b, T('When you are ready, back to the check-in.'), ...again.b] }; } else res = checkinAnswer(text);
  }
  if (!res) res = respond(text);
  try { await deliver(res); } finally { busy = false; updateSend(); }
}
function updateSend() { if (sendEl) sendEl.disabled = busy || !taEl.value.trim(); syncSugg(); }
function syncSugg() { if (suggEl && listEl) suggEl.classList.toggle('off', !!listEl.querySelector('.chat-hero') || !!store.get().checkin || !!listEl.querySelector('.qreplies')); }

export function openChat(opts = {}) {
  if (store.get().stage !== 'active') return;
  if (!view) {
    avatarEl = sol(42, 'idle');
    statusEl = h('div', { class: 'st' });
    listEl = h('div', { class: 'chat-scroll' });
    taEl = h('textarea', { rows: 1, placeholder: 'Ask Sol', 'aria-label': 'Message Sol', enterkeyhint: 'send' });
    sendEl = h('button', { class: 'send', disabled: true, 'aria-label': 'Send' }, ic('arrow-up', 20));
    const grow = () => { taEl.style.height = 'auto'; taEl.style.height = Math.min(110, taEl.scrollHeight) + 'px'; updateSend(); };
    taEl.addEventListener('input', grow);
    taEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendEl.click(); } });
    taEl.addEventListener('focus', () => setTimeout(() => scrollDown(), 350));
    sendEl.addEventListener('click', () => { const v = taEl.value; taEl.value = ''; grow(); send(v); });
    suggEl = h('div', { class: 'sugg' }, h('div', { class: 'chips' }, SUGGEST.map((o) => h('button', { class: 'chip', onClick: () => send(o) }, o))));
    const v = { theme: '#fbf3dc' };
    v.el = h('div', { class: 'chat' },
      h('div', { class: 'chat-bg' }),
      h('div', { class: 'chat-top' },
        h('button', { class: 'iconbtn', 'aria-label': 'Close chat', onClick: () => closeView(v) }, ic('caret-down', 22)),
        h('div', { class: 'chat-id' }, avatarEl, h('div', { style: 'min-width:0' }, h('div', { class: 'nm' }, 'Sol', h('span', { class: 'badge ai' }, 'AI')), statusEl)),
        h('button', { class: 'nursepill', onClick: () => actions.callNurse() }, ic('phone:fill', 15), 'Nurse')),
      h('button', { class: 'disclaimer', onClick: () => openAboutSol() }, ic('info', 16), h('span', null, h('b', null, 'Sol is an AI assistant, not a nurse or doctor. '), 'It shares approved information, not medical advice.'), ic('caret-right', 14)),
      listEl, suggEl,
      h('div', { class: 'composer' }, h('div', { class: 'box' }, taEl, sendEl)));
    v.onClose = () => { view = null; listEl = null; statusEl = null; };
    v.update = () => {};
    view = v; setStatus(null, 'idle'); renderHistory(); syncSugg(); openView(v, 'modal');
    if (window.visualViewport) { const onVV = () => scrollDown(false); window.visualViewport.addEventListener('resize', onVV); const oc = v.onClose; v.onClose = () => { window.visualViewport.removeEventListener('resize', onVV); oc(); }; }
  }
  if (opts.checkin) { startCheckin(opts.checkin); return; }
  if (opts.about) { busy = true; const hEl = listEl.querySelector('.chat-hero'); if (hEl) hEl.remove(); deliver({ b: [T('You just finished “' + opts.about + '”. Anything from it you would like to go over?'), { k: 'chips', o: ['How do I take it?', 'What if I miss a dose?', 'What’s next on my journey?'] }], how: null }).finally(() => { busy = false; updateSend(); }); return; }
  if (opts.text) { setTimeout(() => send(opts.text), 420); return; }
  if (opts.focus) setTimeout(() => taEl && taEl.focus(), 520);
}
async function startCheckin(id) {
  const s = store.get(); if (s.steps[id]) return;
  if (busy) return; busy = true; updateSend();
  const hEl = listEl.querySelector('.chat-hero'); if (hEl) { hEl.remove(); listEl.append(h('div', { class: 'daysep' }, 'Today')); }
  listEl.querySelectorAll('.qreplies').forEach((q) => q.remove());
  store.set({ checkin: { id, step: 0 } });
  await wait(450);
  try { await deliver(checkinAsk(0)); } finally { busy = false; updateSend(); }
}
export function openAboutSol() {
  openSheet((api) => [sheetHead('', api),
    h('div', { class: 'sh-body' }, h('div', { class: 'center' }, sol(64), h('h2', { class: 'mt12' }, 'About Sol')),
      h('div', { class: 'list mt20' },
        h('div', { class: 'how' }, h('span', { class: 'tile' }, ic('warning', 22)), h('div', null, h('div', { class: 't1' }, 'Not a medical advisor'), h('div', { class: 't2' }, 'Sol is an AI assistant. The information it gives is general and does not replace advice from your healthcare team. It can’t diagnose, and it can’t tell you to change your dose.'))),
        h('div', { class: 'how' }, h('span', { class: 'tile' }, ic('book-open', 22)), h('div', null, h('div', { class: 't1' }, 'Approved information only'), h('div', { class: 't2' }, 'Answers come from approved material about Ezmekly, like your patient leaflet, and from what you have logged in the app.'))),
        h('div', { class: 'how' }, h('span', { class: 'tile' }, ic('shield-check', 22)), h('div', null, h('div', { class: 't1' }, 'Side effects are reported'), h('div', { class: 't2' }, 'If you mention a possible side effect, it is passed to the safety team at ' + MED.maker + '.'))),
        h('div', { class: 'how' }, h('span', { class: 'tile sky' }, ic('phone', 22)), h('div', null, h('div', { class: 't1' }, 'A person is always one tap away'), h('div', { class: 't2' }, 'You never need Sol’s permission to talk to a nurse. In an emergency, call your local emergency number.'))))),
    h('div', { class: 'sh-foot' }, h('button', { class: 'btn primary block', onClick: () => api.close() }, 'I understand'))]);
}
actions.openChat = openChat;
