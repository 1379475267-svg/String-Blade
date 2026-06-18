# String Blade

String Blade is a browser rhythm combat prototype built with Vite, TypeScript,
Canvas, and the Web Audio API. Play C, G, and Am chords into the microphone to
trigger sword attacks, build combo, and defeat wave-based enemies.

## Features

- Vite + TypeScript project setup
- Full-screen Canvas stick-fighter battle scene
- Microphone permission flow through `getUserMedia`
- Real-time waveform and spectrum visualization
- Lightweight C, G, and Am chord detection from FFT pitch-class energy
- Chord-driven attack animation with target chord rotation
- Enemy health, player health, combo, score, and wave progression
- Manual chord buttons for testing without microphone input

## Run Locally

```bash
npm install
npm run dev
```

Open the local Vite URL, press `Start Mic`, and allow microphone access.

## Build

```bash
npm run build
```

The production files are generated in `dist/`.

## GitHub Pages

After pushing this repository to GitHub, the simplest deployment path is:

1. Add a GitHub Actions workflow that runs `npm ci` and `npm run build`.
2. Publish the `dist/` folder with GitHub Pages.
3. Enable Pages for the repository in GitHub settings.

## Notes

The chord detector is intentionally small and browser-native. It is tuned for
prototype playability, not studio-grade music transcription. For better accuracy,
future versions can add calibration, pitch tracking, and a larger chord model.
