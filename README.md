# Étude — Piano Theory Trainer

Étude is a browser-based piano theory and practice app for developing your ear, reading skills, and keyboard technique. The app is contained in a single HTML file and does not need a build step.

**Live app:** [https://maurs9.github.io/etude/piano-theory-trainer.html](https://maurs9.github.io/etude/piano-theory-trainer.html)

## Features

- Theory handbook, reading exercises, and score study
- Targeted drills, accompaniment, sight-singing, and ear training
- Free play, progress tracking, and practice planning
- USB MIDI and direct Web Bluetooth MIDI support (e.g. Kawai ES120)
- Local browser storage for settings and progress, with backup export and import
- Installable app shell (PWA) with offline support and Screen Wake Lock after an initial online visit

## Digital piano setup (Kawai ES120 / MIDI)

1. Open [https://maurs9.github.io/etude/piano-theory-trainer.html](https://maurs9.github.io/etude/piano-theory-trainer.html) in **Google Chrome** or **Microsoft Edge** (Android, Windows, or macOS).
2. In **Settings → App & screen**, click **Install** to install Étude as a standalone offline app and enable **Keep the screen on**.
3. Connect your piano:
   - **Bluetooth MIDI (wireless):** Turn on Bluetooth MIDI on your Kawai ES120 (disconnect it from other apps first), then go to **Settings → Bluetooth MIDI (direct) → Connect**.
   - **USB MIDI (wired):** Connect the piano's **USB to Host** port to your device via USB-C; it will appear automatically under **Settings → MIDI input**.

## Run locally

With Python 3 installed, start a web server from the project directory:

```sh
python3 -m http.server 8777
```

Open [http://localhost:8777/piano-theory-trainer.html](http://localhost:8777/piano-theory-trainer.html). Serving over localhost or HTTPS is recommended for browser features such as the service worker and microphone access; permissions may be required.

## Tests

The test suite uses Node.js, npm, Python 3, and Playwright. By default it launches an installed Google Chrome browser.

```sh
npm ci
npm test
```

Alternatively, install Playwright's Chromium with `npx playwright install chromium` and set `PW_CHANNEL` to an empty value before running the tests. The Playwright configuration starts its own local server on port 8787.

## Project structure

- `piano-theory-trainer.html` — application
- `sw.js`, `manifest.webmanifest`, `icons/` — installable app and offline assets
- `tests/`, `playwright.config.mjs` — Playwright tests and configuration
- `package.json`, `package-lock.json` — test tooling and locked dependencies
