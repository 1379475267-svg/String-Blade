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
        <span>State</span><strong id="battleStatus">C attack / G guard</strong>
        <span>Chord</span><strong id="detected">-</strong>
        <span>Lock</span><strong id="confidence">0%</strong>
        <span>Input</span><strong id="volume">0%</strong>
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
  </main>
`

const hud: Record<string, HTMLElement> = {
  score: document.querySelector<HTMLElement>('#score')!,
  combo: document.querySelector<HTMLElement>('#combo')!,
  wave: document.querySelector<HTMLElement>('#wave')!,
  target: document.querySelector<HTMLElement>('#target')!,
  defense: document.querySelector<HTMLElement>('#defense')!,
  status: document.querySelector<HTMLElement>('#battleStatus')!,
  detected: document.querySelector<HTMLElement>('#detected')!,
  confidence: document.querySelector<HTMLElement>('#confidence')!,
  volume: document.querySelector<HTMLElement>('#volume')!,
  mic: document.querySelector<HTMLElement>('#micState')!,
  midi: document.querySelector<HTMLElement>('#midiState')!,
  C: document.querySelector<HTMLElement>('#padC')!,
  G: document.querySelector<HTMLElement>('#padG')!,
  Am: document.querySelector<HTMLElement>('#padAm')!,
}

const detector = new AudioChordDetector()
let battleScene: BattleScene | null = null
const midiInput = new MidiChordInput((chord) => {
  battleScene?.triggerChord(chord, true)
})

const writeHud = (state: BattleHudState) => {
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

  for (const chord of chordOrder) {
    hud[chord].classList.toggle('is-target', chord === state.target)
    hud[chord].classList.toggle('is-defense', chord === state.defense)
    hud[chord].classList.toggle('is-detected', chord === state.detected)
  }
}

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
