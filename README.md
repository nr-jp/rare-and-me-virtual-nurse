# Rare & Me: virtual nurse prototype

Concept prototype of the virtual nurse inside Rare & Me. It is an installable web app (PWA) made of static files, with no backend.

**Not for patient use.** The content is illustrative. Treatment facts paraphrase the public Ezmekly patient leaflet and have not been through medical, legal or regulatory review. Sol is scripted: no AI model is called and nothing leaves the device. Phone calls are simulated and the number is a placeholder.

## What it shows

- **The journey.** A step by step path through the support program and the first treatment cycle. Some steps unlock by progress, some by date, and calls with the human nurse sit on the same path.
- **Sol, the virtual nurse.** One persistent chat, with a pinned disclaimer and no connectors. Topics are detected, and fixed rules decide what happens next: dose questions, side effects, vision changes, interactions and emergencies each have one set response.
- **The human nurse.** One tap from Home, the journey and the chat. The welcome call is visible, can be moved, and has room for notes.
- **The story before it.** Support available, batch code, joining by phone, a short wait while the program activates, then meeting Sol and Sofia.

## Put it on GitHub Pages

1. Open the repository on GitHub and go to **Settings**, then **Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose branch **main** and folder **/ (root)**, then **Save**.
4. After about a minute the site is live at `https://<your-account>.github.io/<repository-name>/`.

On iPhone, open that address in Safari, tap **Share**, then **Add to Home Screen**. Opened from the home screen it runs full screen and works offline.

Pages sites are public to anyone with the address. The page asks search engines not to index it, but that is a request, not a lock.

## A five minute demo

1. Home shows that support is available. Tap **Get support**, then **Fill a demo code** and **Continue**.
2. **View my support**, then **Join the support program** and place the call. End the call when it says you are registered.
3. Wait about 15 seconds on Home, or tap **Skip the wait**. Tap the notification and meet Sol and Sofia.
4. On the journey, start the first lesson and finish it. Tap the welcome call to move it or add notes.
5. Tap **Ask Sol**. Try "I forgot my dose this morning", "I have a rash", "my vision is blurry" and "can I drink grapefruit juice with it".
6. In **Settings**, use **+3 days**. Sol sends the week 1 check-in. Do it, then look at the journey again.

## Prototype controls

Settings has a dashed panel for demos:

- **Start over**, **Support unlocked**, **Nurse active**: jump to a stage.
- **Presenter notes**: shows the rule behind each of Sol's answers inside the chat.
- **Time travel**: move the date forward to trigger call reminders and check-ins.
- **Clear chat**: empty the thread with Sol.

## Files

```
index.html              app shell and iOS settings
manifest.webmanifest    install details
sw.js                   offline cache
css/base.css            tokens, app shell, buttons, cards
css/home.css            Home, Sol avatar, sheets, batch code, call screen, meeting Sol
css/journey.css         My Care, the path, step sheets, lessons
css/chat.css            chat, other pages, toasts, splash
css/fonts.css           Plus Jakarta Sans, embedded (generated)
js/app.js               boot, tabs, Sol button, prototype presets, timed triggers
js/core.js              helpers, state, navigation, sheets, toasts, Sol avatar
js/data.js              journey, lessons, articles and other content
js/journey.js           journey logic, path, lessons, reminders, call details
js/chat.js              Sol: chat surface and the rule-first reply engine
js/flows.js             batch code, joining by phone, activation, meeting Sol and Sofia
js/screens.js           Home, My Care, Insights, Learning, Settings and their pages
js/icons.js             icons (generated)
icons/                  app icon artwork, plus PNG versions (generated)
tools/                  the script that makes the generated files
```

To change what Sol says, edit `respond()` in `js/chat.js`. To change the journey, edit `PHASES` and `LESSONS` in `js/data.js`.

After changing files, raise the version in `sw.js` (`ram-vn-v1` to `ram-vn-v2`) so phones pick up the new version.

### Generated files

`js/icons.js`, `css/fonts.css` and the PNG icons are made by `tools/build-assets.mjs`. A GitHub Action (`.github/workflows/build-assets.yml`) runs it and commits the result whenever `tools/` or the icon artwork changes, so the repository always holds plain static files that Pages can serve as they are.

## Credits

- Typeface: Plus Jakarta Sans, SIL Open Font License 1.1.
- Icons: Phosphor Icons, MIT License.
- Visual language follows the Rare & Me V1 app designs.

Ezmekly is a trademark of its owner. This prototype has not been reviewed or approved by the marketing authorisation holder.
