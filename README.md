# Geometry Dash · Offline Recreation

An original single-player web recreation built from an empty repository. It uses original level layouts, vector graphics, and synthesized audio. It does not contain the commercial game's source, official levels, artwork, or music, and is not an exact port of the full commercial game.

## Run

Requires Node.js 22 or newer. There are no third-party application dependencies.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm start
```

The static development server listens on port 3000. Set `PORT` to change it. It serves files only; gameplay, the editor, and saves run entirely in the browser.

```sh
npm run check
npm test
npm run build
node scripts/serve.mjs --dist
```

`dist/` can be deployed to any static host. HTTPS (or localhost) enables the service worker and installable app. After the first successful load and cache installation, the app can load offline. Local storage holds progress and custom levels; export a save from Stats before clearing browser data or moving devices.

`npm test` runs the Node regression suite for physics, collision geometry, trigger timelines, checkpoints, save imports, progression, purchases, and audio state. `npm run check` checks JavaScript syntax; `npm run build` creates the static deployment files.

The cloud environment already provides Python Playwright and `/usr/bin/chromium`. With the development server running, run the browser checks in a second terminal:

```sh
python3 tests/browser_smoke.py
```

`GAME_TEST_URL` can select another local port. The smoke suite uses isolated browser profiles, permits only local requests, and disables downloads. It checks menus and level filters, actual gameplay and retries, editor saves and test-mode reward exclusion, purchases, mobile controls, settings, and an offline reload. It does not install a browser or download external assets. All 14 campaign courses and all 3 lab courses were also traversed successfully through the actual engine in deterministic simulations during development.

## Deploy to Vercel

Import this repository into Vercel using its root directory, or publish from the repository root with an already installed, authenticated Vercel CLI:

```sh
vercel --prod
```

`vercel.json` installs from the lockfile, runs `npm run build`, and serves `dist/` as a static site. Use Node.js 22 or newer; no environment variables or backend services are required. The service worker uses `Cache-Control: no-cache` so browsers check for updates. Saves belong to each deployment's browser origin; use the in-game export/import controls to move progress to another domain.

## Play

- Space, W, Up, click, or tap: jump/action. Hold for cube repeat jumps, ship thrust, wave movement, and robot jump height.
- Left/Right or A/D: move in platformer levels. Touch controls appear on mobile.
- P: pause. R: restart. C: place a practice checkpoint. X: remove the latest checkpoint.
- Practice mode has automatic and manual checkpoints and separate progress. Platformer levels can also contain their own checkpoints, which work during normal play.

The original campaign contains 12 classic levels and 2 platformer levels. Three additional lab courses demonstrate editable groups, triggers, slopes, saws, checkpoints, jetpack movement, and teleports; labs are excluded from campaign rewards. The level catalog supports search and classic/platformer filters, and the campaign selector shows both normal and practice progress.

Eight movement forms—cube, ship, ball, UFO, wave, robot, spider, and swing—have different controls and physics. Platformer jetpack presentation uses ship flight. Portals support form and size changes, explicit gravity, speed, dual players, mirrored views, reversed travel, and teleports. Dual players can receive separate portal effects. Pads and interactive orbs include colored impulses, gravity changes, dash, spider, teleport, and trigger effects. Slopes and rotated geometry participate in collisions, and saws use their circular hazard area.

Physics and visuals are original approximations; the implementation does not claim measured commercial-game constants or full feature parity. There are no accounts, multiplayer features, online level browsing, or required remote services.

## Create locally

The workshop offers 13 object types: spike, block, slope, saw, coin, pad, orb, portal, checkpoint, trigger, start position, decoration, and text. Place on a snapped grid or freely, inspect positions and dimensions, and set colors, opacity, visibility, collision activity, groups, layers, and rotation.

- Shift-click or drag a selection region to select several objects. Duplicate, rotate, flip, or nudge a selection; undo and redo preserve level changes.
- Configure move, rotate, color, alpha, toggle, spawn, pickup-counter, follow, gravity, camera, sound, stop-sound, end, and pulse triggers. Groups connect targets; duration, delay, and easing control their local timelines.
- Set a start position's form, size, gravity, speed, direction, and dual state, then choose **Test here**. Editor test runs do not change progress, statistics, or currency.
- Save levels on this device, remix an original course, or import/export level JSON. Imported data is validated and cannot execute scripts; linked object IDs remain connected when a course is copied.

Practice and platformer checkpoints restore local gameplay state, including group motion, delayed triggers, counters, camera effects, and logical audio state. The soundtrack and sound effects are synthesized locally; music/SFX toggles, volume, reduced motion, and automatic practice checkpoints are configurable.

## Progress and the local shop

Classic campaign clears earn stars; platformer campaign clears earn moons. Up to three original secret coins per campaign course are retained from completed runs. Normal first clears also earn **100 orbs per difficulty rating**. Every **500 lifetime orbs** earns a key, and achievements award diamonds once. These are this recreation's original reward rules, not the commercial game's reward table. Practice, lab, custom, and editor test clears do not award campaign completion rewards.

The garage includes 24 original cube icons, primary/secondary colors, and five trail choices. The local shop offers 20 unlocks: 12 icons, six colors, and two trails. Purchases deduct earned currency and persist with the profile; owned items can be equipped without another purchase. Achievements, attempts, jumps, play time, normal/practice progress, inventory, and balances are saved locally. Export/import the complete profile from Stats to back it up or move it to another browser origin.

## Development

The [reference research notes](docs/reference-research.md) track the user's viewing restrictions, source-access status, local findings, and the commercial-game behavior still awaiting verification.

`src/engine.js` owns physics, collisions, rendering, and input. `src/runtime.js` runs group effects and trigger timelines. `src/levels.js` defines original campaign/lab courses and validates local level JSON; `src/editor.js` implements the workshop. `src/store.js` persists progression, currency, purchases, and profiles. `src/audio.js` generates original audio, and `src/icons.js` draws the shared original icon designs. `src/app.js` connects the interface to these modules.

Each cloud task already has an isolated environment. Use the checkout under `/workspace/geometry-dash`; do not create an additional Git worktree unless explicitly requested.
