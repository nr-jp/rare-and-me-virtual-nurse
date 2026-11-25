// Generates the files that are awkward to keep by hand:
//   js/icons.js        inline Phosphor icons used by the app
//   css/fonts.css      Plus Jakarta Sans, embedded so the app works offline
//   icons/*.png        home screen icons rendered from icons/icon.svg
// Run from the repo root: node tools/build-assets.mjs .
// A GitHub Action runs this and commits the result (see .github/workflows/build-assets.yml).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(process.argv[2] || path.join(here, '..'));
const phosphor = path.join(here, 'node_modules/@phosphor-icons/core/assets');
const fontFile = path.join(here, 'node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2');

const regular = `house heartbeat chart-bar books user-circle pill lightning star seal-question first-aid-kit list-checks
calendar-dots calendar-blank calendar-check caret-right caret-left caret-down caret-up x plus check check-circle lock-simple clock
phone phone-call phone-disconnect lifebuoy hand-heart lightbulb chats chats-circle info warning warning-circle sun sun-horizon moon
moon-stars eye heart drop arrow-up arrow-right arrow-left paper-plane-tilt bell bell-ringing gear shield-check note-pencil
magnifying-glass battery-low smiley-sad smiley smiley-meh brain bone barbell spiral fork-knife scales person-simple-walk
hand-waving sparkle trophy medal flag-banner path book-open clipboard-text arrows-clockwise timer hourglass-medium user users
stethoscope package barcode siren question article headset microphone dots-three trash pencil-simple sliders-horizontal
fast-forward arrow-counter-clockwise presentation-chart backspace thermometer bandaids plant mountains confetti target
graduation-cap cloud-sun calendar-heart seal-check drop-half toilet arrow-square-out hand-palm speaker-high copy flag
map-trifold calendar-plus prohibit sign-out shield-warning user-focus chat-circle-dots chat-teardrop-text notepad
phone-outgoing clock-countdown arrow-bend-up-left play fork-knife wine eyeglasses baby globe-hemisphere-west file-text
receipt truck currency-circle-dollar hand-coins identification-card door-open`.split(/\s+/).filter(Boolean);

const fill = `sun check-circle phone lock-simple lock star heart play seal-check x-circle moon lightning pill trophy medal sparkle
phone-call phone-disconnect arrow-up bell microphone microphone-slash speaker-high backspace plus check caret-right
warning info siren calendar-check clock chats-circle hand-heart book-open list-checks flag-banner eye user`.split(/\s+/).filter(Boolean);

const duotone = `house heartbeat chart-bar books user-circle`.split(/\s+/).filter(Boolean);

function inner(file) {
  const svg = fs.readFileSync(file, 'utf8');
  const m = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  return m[1].replace(/\s+/g, ' ').trim();
}

const out = {};
const missing = [];
for (const [list, dir, suffix, key] of [[regular, 'regular', '', ''], [fill, 'fill', '-fill', ':fill'], [duotone, 'duotone', '-duotone', ':duo']]) {
  for (const name of new Set(list)) {
    const f = path.join(phosphor, dir, `${name}${suffix}.svg`);
    if (!fs.existsSync(f)) { missing.push(`${dir}/${name}`); continue; }
    out[name + key] = inner(f);
  }
}
if (missing.length) { console.error('Missing icons:', missing.join(', ')); process.exit(1); }

fs.mkdirSync(path.join(appDir, 'js'), { recursive: true });
fs.mkdirSync(path.join(appDir, 'css'), { recursive: true });
fs.mkdirSync(path.join(appDir, 'icons'), { recursive: true });

const iconsJs = `// Phosphor Icons (MIT), https://phosphoricons.com. Generated file, do not edit by hand.
// Keys: "name" (regular), "name:fill", "name:duo" (duotone).
export const ICONS = ${JSON.stringify(out, null, 0).replace(/","/g, '",\n"')};

export function icon(name, size = 20, cls = '') {
  const body = ICONS[name] || ICONS['question'];
  return '<svg class="ic ' + cls + '" width="' + size + '" height="' + size + '" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">' + body + '</svg>';
}
`;
fs.writeFileSync(path.join(appDir, 'js/icons.js'), iconsJs);

const b64 = fs.readFileSync(fontFile).toString('base64');
const fontsCss = `/* Plus Jakarta Sans (variable, latin). Copyright 2020 The Plus Jakarta Sans Project Authors. SIL Open Font License 1.1.
   Embedded so the app works offline and installs as a single origin. */
@font-face {
  font-family: 'Plus Jakarta Sans';
  font-style: normal;
  font-display: block;
  font-weight: 200 800;
  src: url(data:font/woff2;base64,${b64}) format('woff2');
}
`;
fs.writeFileSync(path.join(appDir, 'css/fonts.css'), fontsCss);

const svg = fs.readFileSync(path.join(appDir, 'icons/icon.svg'));
for (const [file, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(path.join(appDir, 'icons', file));
}
console.log('icons:', Object.keys(out).length, '| js/icons.js', iconsJs.length, 'bytes | css/fonts.css', fontsCss.length, 'bytes | 3 PNG icons');
