import Phaser from 'phaser'
import './style.css'
import { AudioChordDetector, type ChordName, chordOrder } from './game/audio/AudioChordDetector'
import { MidiChordInput } from './game/input/MidiChordInput'
import { guitarChordShapes, type Difficulty } from './game/music/ChordLibrary'
import { BattleScene, type BattleHudState } from './game/scenes/BattleScene'

const chordButtons = chordOrder
  .map((chord) => `<button id="pad${chord}" type="button"><span>${chord}</span><small>Chord</small></button>`)
  .join('')

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
      <div class="progression-panel" aria-label="chord progression">
        <span id="levelName">Duel Mode</span>
        <div id="progressionSteps" class="progression-steps"></div>
        <div id="rhythmMeter" class="rhythm-meter"><i></i></div>
      </div>
    </section>

    <aside class="control-panel" aria-label="audio controls">
      <div class="mode-panel">
        <div class="panel-header compact">
          <span>Game Mode</span>
          <strong id="modeLabel">Duel</strong>
        </div>
        <div class="segmented-control">
          <button id="modeDuel" type="button" class="is-selected">Duel</button>
          <button id="modeProgression" type="button">Progression</button>
        </div>
        <select id="difficultySelect" aria-label="difficulty">
          <option value="easy">Easy</option>
          <option value="normal">Normal</option>
          <option value="hard">Hard</option>
        </select>
      </div>
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
          <span>Chord Keys</span>
          <strong>Manual</strong>
        </div>
        <div class="chord-pad" aria-label="manual chord controls">
          ${chordButtons}
        </div>
      </div>
      <div class="chord-chart-panel">
        <div class="panel-header compact">
          <span>Guitar Shape</span>
          <strong id="chartChord">C</strong>
        </div>
        <div id="chordChart" class="chord-chart"></div>
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
  mode: document.querySelector<HTMLElement>('#modeLabel')!,
  level: document.querySelector<HTMLElement>('#levelName')!,
  progression: document.querySelector<HTMLElement>('#progressionSteps')!,
  rhythm: document.querySelector<HTMLElement>('#rhythmMeter i')!,
  chartChord: document.querySelector<HTMLElement>('#chartChord')!,
  chordChart: document.querySelector<HTMLElement>('#chordChart')!,
  target: document.querySelector<HTMLElement>('#target')!,
  defense: document.querySelector<HTMLElement>('#defense')!,
  status: document.querySelector<HTMLElement>('#battleStatus')!,
  detected: document.querySelector<HTMLElement>('#detected')!,
  confidence: document.querySelector<HTMLElement>('#confidence')!,
  volume: document.querySelector<HTMLElement>('#volume')!,
  mic: document.querySelector<HTMLElement>('#micState')!,
  midi: document.querySelector<HTMLElement>('#midiState')!,
  calibration: document.querySelector<HTMLElement>('#calibrationState')!,
}

for (const chord of chordOrder) {
  hud[chord] = document.querySelector<HTMLElement>(`#pad${chord}`)!
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

const renderChordChart = (chord: ChordName) => {
  const shape = guitarChordShapes[chord]
  const strings = 6
  const frets = 5
  const width = 210
  const height = 160
  const left = 34
  const top = 26
  const gridWidth = 142
  const gridHeight = 104
  const stringGap = gridWidth / (strings - 1)
  const fretGap = gridHeight / frets
  const dots = shape.frets
    .map((fret, index) => {
      const x = left + index * stringGap
      if (fret === 'x') {
        return `<text x="${x}" y="17" text-anchor="middle" class="muted">x</text>`
      }
      if (fret === 0) {
        return `<text x="${x}" y="17" text-anchor="middle" class="open">o</text>`
      }
      const y = top + (fret - 0.5) * fretGap
      const finger = shape.fingers[index]
      return `<g><circle cx="${x}" cy="${y}" r="10" class="finger"/><text x="${x}" y="${y + 4}" text-anchor="middle" class="finger-text">${finger}</text></g>`
    })
    .join('')
  const stringLines = Array.from({ length: strings }, (_, index) => {
    const x = left + index * stringGap
    return `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + gridHeight}" class="string"/>`
  }).join('')
  const fretLines = Array.from({ length: frets + 1 }, (_, index) => {
    const y = top + index * fretGap
    return `<line x1="${left}" y1="${y}" x2="${left + gridWidth}" y2="${y}" class="${index === 0 ? 'nut' : 'fret'}"/>`
  }).join('')

  hud.chartChord.textContent = chord
  hud.chordChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${chord} guitar chord chart">
      <text x="${width / 2}" y="148" text-anchor="middle" class="chart-title">${chord}</text>
      ${stringLines}
      ${fretLines}
      ${dots}
    </svg>
  `
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
  const mode = state.mode ?? 'duel'
  hud.mode.textContent = mode === 'duel' ? 'Duel' : 'Progression'
  hud.level.textContent = mode === 'duel' ? 'Duel Mode' : state.levelName || 'Progression'
  const progression = mode === 'progression' ? state.progression ?? [] : []
  hud.progression.innerHTML = progression
    .map((chord, index) => `<span class="${index === state.progressionIndex ? 'is-current' : ''}">${chord}</span>`)
    .join('')
  hud.rhythm.style.width =
    mode === 'progression'
      ? `${Math.max(0, Math.min(100, (state.rhythmTimeLeft / 2.6) * 100))}%`
      : '100%'
  hud.target.textContent = state.target
  hud.defense.textContent = mode === 'duel' ? state.defense : '-'
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
    hud[chord].classList.toggle('is-defense', mode === 'duel' && chord === state.defense)
    hud[chord].classList.toggle('is-detected', chord === state.detected)
  }

  renderChordChart(state.target)
}

writeBestStats()
renderChordChart('C')

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
for (const chord of chordOrder) {
  document.querySelector<HTMLButtonElement>(`#pad${chord}`)!.addEventListener('click', () => triggerManualChord(chord))
}
document.querySelector<HTMLButtonElement>('#calC')!.addEventListener('click', () => detector.startCalibration('C'))
document.querySelector<HTMLButtonElement>('#calG')!.addEventListener('click', () => detector.startCalibration('G'))
document.querySelector<HTMLButtonElement>('#calAm')!.addEventListener('click', () => detector.startCalibration('Am'))
document.querySelector<HTMLButtonElement>('#modeDuel')!.addEventListener('click', () => {
  battleScene?.setMode('duel')
  document.querySelector<HTMLButtonElement>('#modeDuel')!.classList.add('is-selected')
  document.querySelector<HTMLButtonElement>('#modeProgression')!.classList.remove('is-selected')
})
document.querySelector<HTMLButtonElement>('#modeProgression')!.addEventListener('click', () => {
  battleScene?.setMode('progression')
  document.querySelector<HTMLButtonElement>('#modeProgression')!.classList.add('is-selected')
  document.querySelector<HTMLButtonElement>('#modeDuel')!.classList.remove('is-selected')
})
document.querySelector<HTMLSelectElement>('#difficultySelect')!.addEventListener('change', (event) => {
  const difficulty = (event.currentTarget as HTMLSelectElement).value as Difficulty
  battleScene?.setDifficulty(difficulty)
})

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
