# String Blade

String Blade is a browser rhythm combat prototype built with Vite, TypeScript,
Phaser, and the Web Audio API. Play attack and guard chords into the microphone
to trade projectiles, parry enemy shots, build combo, and defeat wave-based
enemies.

## Features

- Vite + TypeScript project setup
- Full-screen Phaser stick-fighter battle scene
- Microphone permission flow through `getUserMedia`
- Web MIDI API input for MIDI keyboards and digital pianos
- Synthesized Web Audio sound effects for attacks, guards, parries, hits, and wave clears
- Real-time waveform and spectrum visualization
- Lightweight C, G, and Am chord detection from FFT pitch-class energy
- C chord projectile attacks
- G chord guard and perfect parry timing
- Enemy projectile attacks with reduced damage on guard
- Perfect parries reflect enemy attacks without taking damage
- Enemy health, player health, combo, score, and wave progression
- Manual chord buttons for testing without microphone input

## Run Locally

```bash
npm install
npm run dev
```

Open the local Vite URL, press `Start Mic`, and allow microphone access. Use
`C` to attack and `G` to guard. Guard shortly before an enemy projectile lands to
reduce damage; guard at the last moment to reflect it back without taking damage.

You can also press `Start MIDI` in a browser that supports Web MIDI. With a MIDI
keyboard connected, play C major to attack and G major to guard/parry.

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
