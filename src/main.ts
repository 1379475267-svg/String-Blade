import Phaser from 'phaser'
import './style.css'
import { AudioChordDetector, type ChordName, chordOrder } from './game/audio/AudioChordDetector'
import { MidiChordInput } from './game/input/MidiChordInput'
import { BattleScene, type BattleHudState } from './game/scenes/BattleScene'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="game-shell">
    <section class="stage" aria-label="String Blade battle arena">
      <div id="game"></div>
      <div class="topbar">
        <div class="brand">
          <span class="brand-mark"></span>
          <div>
            <h1>String Blade</h1>
            <span class="subtitle">Phaser Chord Combat</span>
          </div>
        </div>
        <div class="stats" aria-label="battle status">
          <span><small>Score</small><strong id="score">0</strong></span>
          <span><small>Combo</small><strong id="combo">0x</strong></span>
          <span><small>Wave</small><strong id="wave">1</strong></span>
        </div>
      </div>
      <div class="best-panel" aria-label="best run">
        <span>Best</span>
        <strong id="bestScore">0</strong>
        <small>Wave <b id="bestWave">1</b> / Combo <b id="bestCombo">0x</b></small>
      </div>
      <div class="target-panel" aria-label="target chord">
        <span>Attack</span>
        <strong id="target">C</strong>
        <em>strike chord</em>
        <span>Guard</span>
        <strong id="defense">G</strong>
        <em>parry chord</em>
      </div>
    </section>

    <aside class="control-panel" aria-label="audio controls">
      <div class="panel-header">
        <span>Audio Core</span>
        <strong id="micState" data-state="idle">Mic off</strong>
      </div>
      <button id="micButton" class="primary-action" type="button">
        <span class="button-icon"></span>
        Start Mic
      </button>
      <button id="midiButton" class="secondary-action" type="button">
        <span class="button-icon"></span>
        Start MIDI
      </button>
      <div class="meter-grid">
        <span>MIDI</span><strong id="midiState" data-state="idle">MIDI off</strong>
        <span>Cal</span><strong id="calibrationState">Calibration off</strong>
        <span>State</span><strong id="battleStatus">C attack / G guard</strong>
        <span>Chord</span><strong id="detected">-</strong>
        <span>Lock</span><strong id="confidence">0%</strong>
        <span>Input</span><strong id="volume">0%</strong>
      </div>
      <div class="calibration-panel">
        <div class="panel-header compact">
          <span>Mic Tuning</span>
          <strong>Hold chord</strong>
        </div>
        <div class="calibration-pad" aria-label="microphone calibration controls">
          <button id="calC" type="button">Cal C</button>
          <button id="calG" type="button">Cal G</button>
          <button id="calAm" type="button">Cal Am</button>
        </div>
      </div>
      <div class="blade-panel">
        <div class="panel-header compact">
          <span>Blade Keys</span>
          <strong>Manual</strong>
        </div>
        <div class="chord-pad" aria-label="manual chord controls">
          <button id="padC" type="button"><span>C</span><small>Attack</small></button>
          <button id="padG" type="button"><span>G</span><small>Guard</small></button>
          <button id="padAm" type="button"><span>Am</span><small>Later</small></button>
        </div>
      </div>
    </aside>

    <section id="onboarding" class="onboarding" aria-label="how to play">
      <div class="onboarding-panel">
        <span class="eyebrow">String Blade</span>
        <h2>Chord Combat</h2>
        <div class="guide-grid">
          <div><strong>C</strong><span>Attack</span></div>
          <div><strong>G</strong><span>Guard / Parry</span></div>
          <div><strong>Cal</strong><span>Tune mic input</span></div>
        </div>
        <p>Launch energy shots, guard enemy projectiles, and parry at the last moment to reflect damage.</p>
        <button id="startGameButton" type="button">Start Playing</button>
      </div>
    </section>
  </main>
`

type BestStats = {
  score: number
  wave: number
  combo: number
}

const bestStatsKey = 'string-blade-best-stats'

const loadBestStats = (): BestStats => {
  try {
    const saved = localStorage.getItem(bestStatsKey)
    return saved ? { score: 0, wave: 1, combo: 0, ...JSON.parse(saved) } : { score: 0, wave: 1, combo: 0 }
  } catch {
    return { score: 0, wave: 1, combo: 0 }
  }
}

const saveBestStats = (stats: BestStats) => {
  try {
    localStorage.setItem(bestStatsKey, JSON.stringify(stats))
  } catch {
    // Best stats are a nice-to-have; gameplay should continue if storage is unavailable.
  }
}

const hud: Record<string, HTMLElement> = {
  score: document.querySelector<HTMLElement>('#score')!,
  combo: document.querySelector<HTMLElement>('#combo')!,
  wave: document.querySelector<HTMLElement>('#wave')!,
  bestScore: document.querySelector<HTMLElement>('#bestScore')!,
  bestWave: document.querySelector<HTMLElement>('#bestWave')!,
  bestCombo: document.querySelector<HTMLElement>('#bestCombo')!,
  target: document.querySelector<HTMLElement>('#target')!,
  defense: document.querySelector<HTMLElement>('#defense')!,
  status: document.querySelector<HTMLElement>('#battleStatus')!,
  detected: document.querySelector<HTMLElement>('#detected')!,
  confidence: document.querySelector<HTMLElement>('#confidence')!,
  volume: document.querySelector<HTMLElement>('#volume')!,
  mic: document.querySelector<HTMLElement>('#micState')!,
  midi: document.querySelector<HTMLElement>('#midiState')!,
  calibration: document.querySelector<HTMLElement>('#calibrationState')!,
  C: document.querySelector<HTMLElement>('#padC')!,
  G: document.querySelector<HTMLElement>('#padG')!,
  Am: document.querySelector<HTMLElement>('#padAm')!,
}

const detector = new AudioChordDetector()
let battleScene: BattleScene | null = null
let bestStats = loadBestStats()
const midiInput = new MidiChordInput((chord) => {
  battleScene?.triggerChord(chord, true)
})

const writeBestStats = () => {
  hud.bestScore.textContent = String(bestStats.score)
  hud.bestWave.textContent = String(bestStats.wave)
  hud.bestCombo.textContent = `${bestStats.combo}x`
}

const writeHud = (state: BattleHudState) => {
  const currentCombo = Number.parseInt(String(state.combo), 10) || 0
  const nextBest = {
    score: Math.max(bestStats.score, state.score),
    wave: Math.max(bestStats.wave, state.wave),
    combo: Math.max(bestStats.combo, currentCombo),
  }
  if (
    nextBest.score !== bestStats.score ||
    nextBest.wave !== bestStats.wave ||
    nextBest.combo !== bestStats.combo
  ) {
    bestStats = nextBest
    saveBestStats(bestStats)
    writeBestStats()
  }

  hud.score.textContent = String(state.score)
  hud.combo.textContent = `${state.combo}x`
  hud.wave.textContent = String(state.wave)
  hud.target.textContent = state.target
  hud.defense.textContent = state.defense
  hud.status.textContent = state.status
  hud.detected.textContent = state.detected ?? '-'
  hud.confidence.textContent = `${Math.round(state.confidence * 100)}%`
  hud.volume.textContent = `${Math.round(state.volume * 100)}%`
  hud.mic.textContent = detector.message
  hud.mic.dataset.state = detector.state
  hud.midi.textContent = midiInput.message
  hud.midi.dataset.state = midiInput.state
  hud.calibration.textContent = detector.calibrationStatus.message

  for (const chord of chordOrder) {
    hud[chord].classList.toggle('is-target', chord === state.target)
    hud[chord].classList.toggle('is-defense', chord === state.defense)
    hud[chord].classList.toggle('is-detected', chord === state.detected)
  }
}

writeBestStats()

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#101722',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  scene: [
    new BattleScene({
      onHudChange: writeHud,
    }),
  ],
}

const phaserGame = new Phaser.Game(config)

phaserGame.events.once(Phaser.Core.Events.READY, () => {
  battleScene = phaserGame.scene.getScene('BattleScene') as BattleScene
})

const triggerManualChord = (chord: ChordName) => {
  battleScene?.triggerChord(chord, true)
}

document.querySelector<HTMLButtonElement>('#micButton')!.addEventListener('click', () => {
  void detector.start()
})
document.querySelector<HTMLButtonElement>('#midiButton')!.addEventListener('click', () => {
  void midiInput.start()
})
document.querySelector<HTMLButtonElement>('#padC')!.addEventListener('click', () => triggerManualChord('C'))
document.querySelector<HTMLButtonElement>('#padG')!.addEventListener('click', () => triggerManualChord('G'))
document.querySelector<HTMLButtonElement>('#padAm')!.addEventListener('click', () => triggerManualChord('Am'))
document.querySelector<HTMLButtonElement>('#calC')!.addEventListener('click', () => detector.startCalibration('C'))
document.querySelector<HTMLButtonElement>('#calG')!.addEventListener('click', () => detector.startCalibration('G'))
document.querySelector<HTMLButtonElement>('#calAm')!.addEventListener('click', () => detector.startCalibration('Am'))

const onboarding = document.querySelector<HTMLElement>('#onboarding')!
const dismissOnboarding = () => {
  onboarding.classList.add('is-hidden')
  try {
    localStorage.setItem('string-blade-onboarding-seen', 'true')
  } catch {
    // Ignore storage failures in strict privacy modes.
  }
}

try {
  if (localStorage.getItem('string-blade-onboarding-seen') === 'true') {
    onboarding.classList.add('is-hidden')
  }
} catch {
  // Leave onboarding visible when storage cannot be read.
}

document.querySelector<HTMLButtonElement>('#startGameButton')!.addEventListener('click', dismissOnboarding)

const syncAudioToScene = () => {
  const detection = detector.read()
  battleScene?.setAudioData({
    detected: detection.chord,
    confidence: detection.confidence,
    volume: detection.volume,
    spectrum: detection.spectrum,
    waveform: detection.waveform,
  })

  if (detection.chord) {
    battleScene?.triggerChord(detection.chord, false)
  }

  requestAnimationFrame(syncAudioToScene)
}

syncAudioToScene()
