# Geometry Dash · Offline Recreation

An original single-player web recreation built from an empty repository. It uses original level layouts, vector graphics, and synthesized audio. It does not contain the commercial game's source, official levels, artwork, or music, and is not an exact port of the full commercial game.

## Run

Requires Node.js 22 or newer. There are no third-party application dependencies.

```sh
npm ci --ignore-scripts
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

In the cloud environment, `python3 tests/browser_smoke.py` also exercises the app in installed Chromium while the development server runs. It checks gameplay, local saves, the editor, mobile controls, and an offline reload. All 14 campaign courses were traversed successfully in deterministic engine simulations during development; the committed unit suite covers physics and persistence regressions.

## Deploy to Vercel

Import this repository into Vercel using its root directory, or publish from the repository root with an authenticated Vercel CLI:

```sh
npx vercel --prod
```

`vercel.json` installs from the lockfile, runs `npm run build`, and serves `dist/` as a static site. Use Node.js 22 or newer; no environment variables or backend services are required. The service worker uses `Cache-Control: no-cache` so browsers check for updates. Saves belong to each deployment's browser origin; use the in-game export/import controls to move progress to another domain.

## Play

- Space, W, Up, click, or tap: jump/action. Hold for cube repeat jumps, ship thrust, wave movement, and robot jump height.
- Left/Right or A/D: move in platformer levels. Touch controls appear on mobile.
- P: pause. R: restart. C: place a practice checkpoint. X: remove the latest checkpoint.
- Practice mode has automatic and manual checkpoints. It keeps separate progress; normal completion earns campaign stars and coins.

The original campaign contains 12 classic levels and 2 platformer levels. Eight movement forms—cube, ship, ball, UFO, wave, robot, spider, and swing—have different controls and physics. Portals switch forms, gravity, size, speed, or dual mode; pads and interactive orbs affect jumps.

The local editor supports building and testing levels, undo/redo, saving, deleting, and JSON import/export. Icons, colors, trails, audio settings, achievements, and save backups work locally. There are no accounts, multiplayer features, online level browsing, or required remote services.

## Development

The [reference research notes](docs/reference-research.md) track the user's viewing restrictions, source-access status, local findings, and the commercial-game behavior still awaiting verification.

`src/engine.js` owns physics, collisions, rendering, and input. `src/levels.js` defines the original campaign and validates custom geometry. `src/editor.js` implements the local editor. `src/store.js` persists profiles, and `src/audio.js` generates original audio. `src/app.js` connects the interface to these modules.

Each cloud task already has an isolated environment. Use the checkout under `/workspace/geometry-dash`; do not create an additional Git worktree unless explicitly requested.
