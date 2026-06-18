import { chordOrder } from '../game/audio/AudioChordDetector'

const chordButtons = chordOrder
  .map((chord) => `<button id="pad${chord}" type="button"><span>${chord}</span><small>Chord</small></button>`)
  .join('')

const calibrationButtons = chordOrder
  .map((chord) => `<button id="cal${chord}" type="button">Cal ${chord}</button>`)
  .join('')

export const createLayout = (root: HTMLElement) => {
  root.innerHTML = `
    <main class="game-shell" data-paused="false">
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
        <div class="pause-overlay" aria-hidden="true">Paused</div>
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
          <div id="rhythmMeter" class="rhythm-meter">
            <span class="good-zone"></span>
            <span class="perfect-zone"></span>
            <i></i>
          </div>
          <strong id="rhythmRating" class="rhythm-rating">Ready</strong>
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
          <div class="run-controls">
            <button id="pauseButton" type="button">Pause</button>
            <button id="restartButton" type="button">Restart</button>
            <strong id="pauseState">Live</strong>
          </div>
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
            ${calibrationButtons}
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
            <div><strong>Am+</strong><span>Skills</span></div>
          </div>
          <p>Launch energy shots, guard enemy projectiles, and use extra chords for healing, dodging, shields, and heavy attacks.</p>
          <button id="startGameButton" type="button">Start Playing</button>
        </div>
      </section>
    </main>
  `
}
