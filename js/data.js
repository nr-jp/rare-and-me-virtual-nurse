// Content for the prototype. Illustrative only. Treatment facts paraphrase the public Ezmekly patient leaflet
// and have not been through medical, legal or regulatory review.

export const MED = {
  brand: 'Ezmekly', generic: 'mirdametinib', dose: '4 mg', phone: '090 909 0090', nurse: 'Sofia',
  hours: 'Mon to Fri, 9:00 to 17:00', maker: 'the company that makes Ezmekly',
};

export const PHASES = [
  { id: 'p1', k: 'Phase 1', title: 'Getting set up', tone: 'sky', steps: [
    { id: 'unlock', type: 'setup', icon: 'barcode', title: 'Unlock Ezmekly support', meta: 'Batch code verified', about: 'You confirmed your medication with the batch code on your pack. That switched on guidance made for Ezmekly.' },
    { id: 'join', type: 'setup', icon: 'phone-call', title: 'Join the support program', meta: 'Registered by phone', about: 'One call to the nurse line set you up. Your nurse team and this app now share the same record.' },
    { id: 'meet', type: 'setup', icon: 'sun', title: 'Meet Sol and Sofia', meta: 'Your assistant and your nurse', about: 'Sol is here day and night for questions. Sofia is your nurse, by phone, for anything you would rather talk through.' },
    { id: 'call1', type: 'call', icon: 'phone', title: 'Welcome call with Sofia', about: 'Sofia calls to say hello, hear how the first days have gone and answer your questions. About 15 minutes.' },
  ] },
  { id: 'p2', k: 'Phase 2', title: 'Your first cycle', tone: 'sun', steps: [
    { id: 'l-day', type: 'lesson', icon: 'pill', title: 'How Ezmekly fits your day', mins: 2, about: 'When to take it, how to take it, and a simple way to make it stick.' },
    { id: 'l-cycle', type: 'lesson', icon: 'arrows-clockwise', title: 'Your 28-day rhythm', mins: 2, about: 'Treatment days, rest days, and how the app keeps count for you.' },
    { id: 'a-remind', type: 'action', icon: 'bell', title: 'Set your reminders', mins: 1, about: 'Two gentle nudges a day that pause by themselves in your rest week.' },
    { id: 'l-checks', type: 'lesson', icon: 'eye', title: 'Checks along the way', mins: 2, about: 'The routine eye and heart checks that come with Ezmekly, and why they matter.' },
    { id: 'l-side', type: 'lesson', icon: 'first-aid-kit', title: 'Side effects: what to look for, who to tell', mins: 3, about: 'What people notice most, who to tell, and what happens when you do.' },
    { id: 'c-week1', type: 'checkin', icon: 'chats-circle', title: 'Week 1 check-in with Sol', opensDay: 8, mins: 2, about: 'Three quick questions about your first week. Your answers go to your nurse team so Sofia is up to speed before she calls.' },
    { id: 'm-week1', type: 'milestone', icon: 'medal', title: 'First week done', after: 'c-week1', about: 'One week of Ezmekly behind you.' },
    { id: 'l-plan', type: 'lesson', icon: 'lifebuoy', title: 'When a dose does not go to plan', mins: 2, opensDay: 8, about: 'Forgotten doses, sick days and what the leaflet says to do.' },
    { id: 'c-week2', type: 'checkin', icon: 'chats-circle', title: 'Week 2 check-in with Sol', opensDay: 15, mins: 2, about: 'A short check-in on how the routine is settling.' },
    { id: 'l-rest', type: 'lesson', icon: 'moon', title: 'Getting ready for your rest week', opensDay: 19, mins: 2, about: 'What changes on days 22 to 28, and how cycle 2 starts.' },
    { id: 'call2', type: 'call', icon: 'phone', title: 'End of cycle call with Sofia', opensDay: 24, about: 'Sofia calls near the end of the cycle to hear how it went. You can pick the time once it opens.' },
    { id: 'm-cycle1', type: 'milestone', icon: 'trophy', title: 'Cycle 1 complete', opensDay: 29, about: 'A full cycle: 21 treatment days and a rest week.' },
  ] },
  { id: 'p3', k: 'Phase 3', title: 'Finding your rhythm', tone: 'sand', preview: true, note: 'Cycles 2 and 3. Check-ins with Sol move from weekly to once a cycle, with a call from Sofia each cycle.', steps: [
    { id: 'p3a', type: 'checkin', icon: 'chats-circle', title: 'Cycle 2 check-in with Sol' },
    { id: 'p3b', type: 'lesson', icon: 'stethoscope', title: 'Getting the most from clinic visits' },
    { id: 'p3c', type: 'call', icon: 'phone', title: 'Cycle 2 call with Sofia' },
    { id: 'p3d', type: 'milestone', icon: 'medal', title: 'Three cycles' },
  ] },
  { id: 'p4', k: 'Phase 4', title: 'Staying on track', tone: 'sand', preview: true, note: 'From month 4. A monthly check-in with Sol and a call with Sofia every three months, for as long as you are on treatment.', steps: [
    { id: 'p4a', type: 'checkin', icon: 'chats-circle', title: 'Monthly check-in with Sol' },
    { id: 'p4b', type: 'call', icon: 'phone', title: 'Quarterly call with Sofia' },
    { id: 'p4c', type: 'milestone', icon: 'trophy', title: 'Six months' },
  ] },
];

export const LESSONS = {
  'l-day': { src: 'Ezmekly patient leaflet, section 3', done: 'You know how Ezmekly fits your day.', cards: [
    { art: 'capsules', title: 'Twice a day, every treatment day', body: 'Ezmekly is taken twice a day, about 12 hours apart. Most people tie it to something they already do, like breakfast and getting ready for bed.' },
    { art: 'clock', title: 'Pick two times you can keep', body: 'Your app is set to 08:00 and 20:00. If your days change, you can move the times in your medication schedule.' },
    { art: ['drop', 'sky'], title: 'With or without food', body: 'You can take Ezmekly with a meal or on an empty stomach. Swallow the capsules whole with water. Don’t chew, break or open them.' },
    { quiz: 'You took your morning capsules at 8:00. When is the evening dose due?', options: ['Around 14:00', 'Around 20:00', 'Any time before bed'], answer: 1, right: 'That’s it. About 12 hours apart.', wrong: 'Not quite. The two doses are about 12 hours apart, so around 20:00.' },
  ] },
  'l-cycle': { src: 'Ezmekly patient leaflet, section 3', done: 'You know your 28-day rhythm.', cards: [
    { art: 'cycle', title: 'Treatment comes in 28-day cycles', body: 'Each cycle has two parts: 21 days when you take Ezmekly, then 7 days when you don’t.' },
    { art: ['sun', 'sun'], title: 'Days 1 to 21: treatment days', body: 'Two doses a day. Your journey shows the day you are on, so you never have to count.' },
    { art: ['moon', 'sky'], title: 'Days 22 to 28: your rest week', body: 'A planned break that is part of the treatment. Reminders pause by themselves and start again on day 1 of the next cycle.' },
    { quiz: 'What happens on days 22 to 28?', options: ['I take a double dose', 'A planned break from Ezmekly', 'I only take the morning dose'], answer: 1, right: 'Yes. The break is part of the plan, not a missed week.', wrong: 'Not quite. Days 22 to 28 are a planned break from Ezmekly.' },
    { art: ['calendar-check', 'sun'], title: 'How long does it go on?', body: 'Cycles repeat for as long as your doctor recommends. Sol and Sofia are here for each one.' },
  ] },
  'l-checks': { src: 'Ezmekly patient leaflet, sections 2 and 4', done: 'You know the checks that come with Ezmekly.', cards: [
    { art: ['stethoscope', 'sun'], title: 'Your care team keeps a close eye', body: 'Ezmekly comes with a few routine checks. They are there to catch things early, often before you would notice anything yourself.' },
    { art: ['eye', 'sky'], title: 'Eye checks', body: 'An eye specialist checks your vision before you start and regularly during treatment. If your vision changes or goes blurry between checks, tell your doctor straight away.' },
    { art: ['heartbeat', 'sky'], title: 'Heart checks', body: 'Your doctor checks how well your heart is working before and during treatment.' },
    { quiz: 'Your vision goes blurry on a Tuesday evening. What do you do?', options: ['Wait for my next eye check', 'Tell my doctor straight away', 'Skip a dose and see how it goes'], answer: 1, right: 'Exactly. A change in vision is one to raise straight away.', wrong: 'The leaflet is clear on this one: tell your doctor straight away.' },
    { art: ['calendar-check', 'sun'], title: 'Keep them in one place', body: 'Add your check-ups to Appointments so they sit next to your calls with Sofia. Your logs can help you remember what to mention.' },
  ] },
  'l-side': { src: 'Ezmekly patient leaflet, section 4', done: 'You know what to look for and who to tell.', cards: [
    { art: ['first-aid-kit', 'sun'], title: 'Most people notice something', body: 'Side effects are common with Ezmekly. Many are easier to manage when your care team hears about them early.' },
    { art: ['list-checks', 'sun'], title: 'The ones people mention most', body: 'A skin rash that can look like acne, diarrhea, feeling or being sick, tiredness, and muscle or bone pain. The full list is in your leaflet.' },
    { art: ['phone-call', 'sky'], title: 'Who to tell', body: 'Tell your doctor, pharmacist or nurse about any side effect, including ones that are not in the leaflet. For changes in your vision, tell your doctor straight away.' },
    { art: ['note-pencil', 'sun'], title: 'Log it while it’s fresh', body: 'A quick symptom log keeps the dates and details straight for your next appointment.' },
    { art: ['shield-check', 'sky'], title: 'One thing to know', body: 'When you mention a side effect to Sol or to a nurse, it is passed to the safety team at the company that makes Ezmekly. That is standard, and it helps make medicines safer for everyone.' },
    { quiz: 'True or false: Sol or Sofia can tell you to change your dose.', options: ['True', 'False'], answer: 1, right: 'Correct. Only your doctor changes your dose. Sol and Sofia help you get to them.', wrong: 'It’s false. Only your doctor changes your dose. Sol and Sofia help you get to them.' },
  ] },
  'l-plan': { src: 'Ezmekly patient leaflet, section 3', done: 'You know what to do when a dose does not go to plan.', cards: [
    { art: ['lifebuoy', 'sun'], title: 'It happens to everyone', body: 'A missed alarm, a long day, a stomach bug. Here is what your leaflet says, so you are not guessing in the moment.' },
    { art: ['clock', 'sun'], title: 'If you forget a dose', body: 'Skip it and take your next dose at the usual time. Don’t take a double dose to make up for it.' },
    { art: ['drop-half', 'sky'], title: 'If you are sick after a dose', body: 'Don’t take an extra dose. Take the next one at the usual time.' },
    { quiz: 'At lunch you realise you forgot this morning’s dose. What does the leaflet say?', options: ['Take two this evening', 'Skip it and take the evening dose as usual'], answer: 1, right: 'Right. No doubling up.', wrong: 'Not this one. The leaflet says to skip it and take the next dose as usual.' },
    { art: ['note-pencil', 'sun'], title: 'And log it', body: 'Mark the dose as not taken. It helps your care team see the real picture, and nobody is keeping score.' },
  ] },
  'l-rest': { src: 'Ezmekly patient leaflet, section 3', done: 'You are ready for your rest week.', cards: [
    { art: ['moon', 'sky'], title: 'Your first rest week is close', body: 'After day 21 you pause Ezmekly for 7 days. It is a planned part of every cycle.' },
    { art: ['bell', 'sun'], title: 'What changes in the app', body: 'Dose reminders pause. Your journey keeps counting the days and tells you when cycle 2 starts.' },
    { art: ['phone-call', 'sky'], title: 'A good moment to check in', body: 'Sofia calls near the end of the cycle to hear how it went. Jot down anything you want to ask.' },
    { art: ['sun', 'sun'], title: 'Starting again', body: 'On day 1 of cycle 2 you start your two daily doses again, unless your doctor tells you something different.' },
  ] },
};

export const SYMPTOMS = [
  { g: 'Energy and rest', items: [{ id: 'fatigue', icon: 'battery-low', t: 'Fatigue or low energy' }, { id: 'sleep', icon: 'moon', t: 'Trouble sleeping' }] },
  { g: 'Skin and appearance', items: [{ id: 'rash', icon: 'sparkle', t: 'Skin rash' }, { id: 'dry', icon: 'drop', t: 'Dry or itchy skin' }] },
  { g: 'Digestive', items: [{ id: 'nausea', icon: 'spiral', t: 'Nausea' }, { id: 'vomiting', icon: 'drop-half', t: 'Vomiting' }, { id: 'diarrhea', icon: 'toilet', t: 'Diarrhea' }, { id: 'appetite', icon: 'fork-knife', t: 'Loss of appetite' }] },
  { g: 'Pain and discomfort', items: [{ id: 'pain', icon: 'smiley-sad', t: 'Pain (general)' }, { id: 'headache', icon: 'brain', t: 'Headache' }, { id: 'muscle', icon: 'bone', t: 'Joint or muscle pain' }] },
  { g: 'Eyes', items: [{ id: 'vision', icon: 'eye', t: 'Changes in vision' }] },
];
export const SEVERITY = ['Mild', 'Moderate', 'High', 'Severe'];
export const symptomById = (id) => { for (const g of SYMPTOMS) for (const i of g.items) if (i.id === id) return i; return null; };

export const ARTICLES = [
  { id: 'cycle', tag: 'Ezmekly', branded: true, icon: 'arrows-clockwise', tone: 'sun', title: 'Your 28-day cycle, explained', date: '12 Nov 2026', body: [
    'Ezmekly is taken in cycles of 28 days. For the first 21 days you take it twice a day. For the last 7 days you take a planned break.',
    'The break is part of the treatment plan. Your journey in My Care shows which day you are on, when your rest week starts and when the next cycle begins.',
    'Cycles repeat for as long as your doctor recommends. If anything about your schedule is unclear, your doctor, pharmacist or nurse can go through it with you.'] },
  { id: 'nf1', tag: 'About NF1', icon: 'book-open', tone: 'sky', title: 'Understanding plexiform neurofibromas', date: '3 Nov 2026', body: [
    'Plexiform neurofibromas are tumors that grow along nerves. They are not cancerous, but depending on where they are they can cause pain, weakness or changes in how a part of the body looks or works.',
    'They happen in some people with neurofibromatosis type 1, or NF1. Everyone’s experience is different, which is why your own care team is the best guide to what to expect.',
    'Keeping a simple record of symptoms over time can make appointments easier. The Insights tab turns your logs into a picture you can share.'] },
  { id: 'skin', tag: 'Daily life', icon: 'drop', tone: 'sky', title: 'Looking after your skin during treatment', date: '28 Oct 2026', body: [
    'Skin changes are among the side effects people on Ezmekly mention most. A rash can be bumpy or look like acne.',
    'Tell your doctor if you get a rash. They can suggest ways to look after your skin, and they may want to see it.',
    'Logging when a rash started and how it changes gives your care team a clearer picture than memory alone.'] },
  { id: 'nausea', tag: 'Daily life', icon: 'fork-knife', tone: 'sun', title: 'Eating when you feel sick', date: '18 Nov 2026', body: [
    'Feeling sick is among the side effects people on Ezmekly mention most. Small changes to how you eat and drink can make it easier to get through.',
    'Try smaller meals more often, and stop when you feel full. Sip water slowly through the day instead of drinking a lot at once.',
    'Tell your doctor, pharmacist or nurse if you feel sick. If you can’t keep food or fluids down, contact them straight away.'] },
  { id: 'eye', tag: 'Appointments', icon: 'eye', tone: 'sun', title: 'Getting ready for an eye check', date: '21 Oct 2026', body: [
    'Eye checks are a routine part of treatment with Ezmekly. An eye specialist looks at your vision before you start and regularly while you are on treatment.',
    'Before the appointment, note anything you have noticed: blurry vision, changes in what you can see, or eye discomfort. Bring your glasses or contact lens details if you have them.',
    'Between checks, tell your doctor straight away if your vision changes. Don’t wait for the next appointment.'] },
  { id: 'talk', tag: 'Wellbeing', icon: 'chats', tone: 'sky', title: 'Talking to family and friends about NF1', date: '14 Oct 2026', body: [
    'Starting a new treatment is a lot to carry, and people close to you often want to help but don’t know how.',
    'It can help to decide what you want to share first. Some people start with the practical side: the schedule, the check-ups, what a tired day looks like.',
    'If you would like to talk it through with someone, your nurse is a good place to start.'] },
];

export const ABOUT = [
  ['What is the support program?', 'The support program gives you guidance about your treatment with Ezmekly, phone support from a nurse, and Sol, an AI assistant in the app. It’s free to use.'],
  ['What can a nurse help me with?', 'Taking Ezmekly, side effects you notice, and practical questions. Nurses don’t diagnose or change your dose. Your doctor does that.'],
  ['What can Sol help me with?', 'Sol is an AI assistant. It answers questions using approved information about Ezmekly and what you have logged in the app, guides you through your journey, and points you to a nurse or your doctor when you need a person. It doesn’t give medical advice.'],
  ['Who runs this program?', 'The program is provided by the company that makes Ezmekly. Nurse support is run by a specialist nurse team on their behalf. Nurses are there to support you, not to promote any medicine.'],
  ['How do I get help?', 'Ask Sol at any time. To talk to a nurse, tap Call a nurse. Nurses are available Mon to Fri, 9:00 to 17:00.'],
  ['What happens to what I share?', 'What you share is used to run the program. Your nurse team can see your journey progress and your logs. If you mention a side effect, it must be reported to the company that makes Ezmekly.'],
  ['Is this medical advice?', 'The information here is general, not medical advice. In a medical emergency, call your local emergency number or contact your doctor.'],
  ['How do I leave the program?', 'To leave the support program, call a nurse. When your treatment ends, nurse support ends too. Your guidance stays.'],
];
