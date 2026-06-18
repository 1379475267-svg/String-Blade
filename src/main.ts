import './style.css'

type ChordName = 'C' | 'G' | 'Am'
type MicState = 'idle' | 'asking' | 'ready' | 'denied'

type Spark = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
}

type Slash = {
  chord: ChordName
  age: number
  duration: number
}

type Enemy = {
  hp: number
  maxHp: number
  attackTimer: number
  level: number
  hitFlash: number
}

type Detection = {
  chord: ChordName | null
  confidence: number
  volume: number
  spectrum: Uint8Array<ArrayBufferLike>
  waveform: Uint8Array<ArrayBufferLike>
}

const chords: Record<ChordName, { notes: number[]; color: string; damage: number }> = {
  C: { notes: [0, 4, 7], color: '#f2c14e', damage: 18 },
  G: { notes: [7, 11, 2], color: '#4fb3ff', damage: 21 },
  Am: { notes: [9, 0, 4], color: '#ef5d60', damage: 24 },
}

const chordOrder: ChordName[] = ['C', 'G', 'Am']

class AudioChordDetector {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private frequencyData = new Uint8Array(1024)
  private timeData = new Uint8Array(1024)
  private stream: MediaStream | null = null

  state: MicState = 'idle'
  message = 'Mic off'

  async start() {
    this.state = 'asking'
    this.message = 'Requesting mic'

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      this.context = new AudioContext()
      const source = this.context.createMediaStreamSource(this.stream)
      this.analyser = this.context.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.74
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
      this.timeData = new Uint8Array(this.analyser.fftSize)
      source.connect(this.analyser)
      this.state = 'ready'
      this.message = 'Mic live'
    } catch {
      this.state = 'denied'
      this.message = 'Mic blocked'
    }
  }

  read(): Detection {
    if (!this.analyser || !this.context) {
      return {
        chord: null,
        confidence: 0,
        volume: 0,
        spectrum: this.frequencyData,
        waveform: this.timeData,
      }
    }

    this.analyser.getByteFrequencyData(this.frequencyData)
    this.analyser.getByteTimeDomainData(this.timeData)

    const volume = this.getVolume()
    if (volume < 0.035) {
      return {
        chord: null,
        confidence: 0,
        volume,
        spectrum: this.frequencyData,
        waveform: this.timeData,
      }
    }

    const pitchEnergy = new Array<number>(12).fill(0)
    const sampleRate = this.context.sampleRate
    const binWidth = sampleRate / this.analyser.fftSize

    for (let i = 2; i < this.frequencyData.length; i += 1) {
      const frequency = i * binWidth
      if (frequency < 75 || frequency > 1200) {
        continue
      }

      const midi = Math.round(69 + 12 * Math.log2(frequency / 440))
      const pitchClass = ((midi % 12) + 12) % 12
      const energy = this.frequencyData[i] / 255
      pitchEnergy[pitchClass] += energy * energy
    }

    const totalEnergy = pitchEnergy.reduce((sum, value) => sum + value, 0)
    if (totalEnergy <= 0) {
      return {
        chord: null,
        confidence: 0,
        volume,
        spectrum: this.frequencyData,
        waveform: this.timeData,
      }
    }

    let bestChord: ChordName | null = null
    let bestScore = 0

    for (const chord of chordOrder) {
      const template = chords[chord].notes
      const chordEnergy = template.reduce((sum, note) => sum + pitchEnergy[note], 0)
      const nearbyPenalty = template.reduce((sum, note) => {
        const lower = (note + 11) % 12
        const upper = (note + 1) % 12
        return sum + pitchEnergy[lower] * 0.18 + pitchEnergy[upper] * 0.18
      }, 0)
      const score = (chordEnergy - nearbyPenalty) / totalEnergy
      if (score > bestScore) {
        bestScore = score
        bestChord = chord
      }
    }

    return {
      chord: bestScore > 0.34 ? bestChord : null,
      confidence: Math.max(0, Math.min(1, bestScore)),
      volume,
      spectrum: this.frequencyData,
      waveform: this.timeData,
    }
  }

  private getVolume() {
    let sum = 0
    for (const value of this.timeData) {
      const centered = (value - 128) / 128
      sum += centered * centered
    }
    return Math.sqrt(sum / this.timeData.length)
  }
}

class StringBladeGame {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly detector = new AudioChordDetector()
  private readonly sparks: Spark[] = []
  private readonly slashes: Slash[] = []
  private readonly hud: Record<string, HTMLElement>
  private enemy: Enemy = this.makeEnemy(1)
  private playerHp = 100
  private combo = 0
  private score = 0
  private wave = 1
  private expectedChord: ChordName = 'C'
  private lastTimestamp = performance.now()
  private lastTriggerAt = 0
  private detectedChord: ChordName | null = null
  private confidence = 0
  private volume = 0
  private spectrum: Uint8Array<ArrayBufferLike> = new Uint8Array(1024)
  private waveform: Uint8Array<ArrayBufferLike> = new Uint8Array(1024)
  private running = true

  constructor(canvas: HTMLCanvasElement, hud: Record<string, HTMLElement>) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.hud = hud
    this.resize()
    window.addEventListener('resize', () => this.resize())
    requestAnimationFrame((time) => this.tick(time))
  }

  startMic() {
    void this.detector.start()
  }

  manualChord(chord: ChordName) {
    this.triggerChord(chord, performance.now(), true)
  }

  private tick(timestamp: number) {
    const delta = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000)
    this.lastTimestamp = timestamp

    this.readAudio()
    this.update(delta, timestamp)
    this.draw(timestamp)
    this.writeHud()

    if (this.running) {
      requestAnimationFrame((time) => this.tick(time))
    }
  }

  private readAudio() {
    const detection = this.detector.read()
    this.detectedChord = detection.chord
    this.confidence = detection.confidence
    this.volume = detection.volume
    this.spectrum = detection.spectrum
    this.waveform = detection.waveform

    if (detection.chord) {
      this.triggerChord(detection.chord, performance.now(), false)
    }
  }

  private update(delta: number, timestamp: number) {
    if (this.playerHp <= 0) {
      this.playerHp = 100
      this.combo = 0
      this.score = Math.max(0, this.score - 50)
      this.enemy = this.makeEnemy(this.wave)
    }

    this.enemy.attackTimer -= delta
    this.enemy.hitFlash = Math.max(0, this.enemy.hitFlash - delta * 3)
    if (this.enemy.attackTimer <= 0) {
      this.playerHp = Math.max(0, this.playerHp - 9 - this.wave)
      this.combo = 0
      this.enemy.attackTimer = Math.max(1.7, 3.2 - this.wave * 0.16)
      this.burst(this.canvas.width * 0.23, this.canvas.height * 0.62, 10, '#d64550')
    }

    for (const slash of this.slashes) {
      slash.age += delta
    }
    for (let index = this.slashes.length - 1; index >= 0; index -= 1) {
      if (this.slashes[index].age >= this.slashes[index].duration) {
        this.slashes.splice(index, 1)
      }
    }

    for (const spark of this.sparks) {
      spark.life -= delta
      spark.x += spark.vx * delta
      spark.y += spark.vy * delta
      spark.vy += 180 * delta
    }
    for (let index = this.sparks.length - 1; index >= 0; index -= 1) {
      if (this.sparks[index].life <= 0) {
        this.sparks.splice(index, 1)
      }
    }

    if (this.enemy.hp <= 0) {
      this.wave += 1
      this.score += 100 + this.combo * 12
      this.expectedChord = chordOrder[this.wave % chordOrder.length]
      this.enemy = this.makeEnemy(this.wave)
      this.burst(this.canvas.width * 0.74, this.canvas.height * 0.54, 28, '#f2c14e')
    }

    if (timestamp - this.lastTriggerAt > 1800 && this.combo > 0) {
      this.combo = Math.max(0, this.combo - 1)
    }
  }

  private triggerChord(chord: ChordName, timestamp: number, manual: boolean) {
    if (timestamp - this.lastTriggerAt < (manual ? 260 : 760)) {
      return
    }

    const matchesTarget = chord === this.expectedChord
    const baseDamage = chords[chord].damage
    const damage = matchesTarget ? baseDamage + this.combo * 2 : Math.ceil(baseDamage * 0.34)
    this.enemy.hp = Math.max(0, this.enemy.hp - damage)
    this.enemy.hitFlash = 1
    this.combo = matchesTarget ? this.combo + 1 : 0
    this.score += damage + (matchesTarget ? 8 : 0)
    this.lastTriggerAt = timestamp
    this.slashes.push({ chord, age: 0, duration: 0.34 })
    this.burst(this.canvas.width * 0.72, this.canvas.height * 0.52, matchesTarget ? 20 : 8, chords[chord].color)

    if (matchesTarget) {
      const nextIndex = (chordOrder.indexOf(this.expectedChord) + 1) % chordOrder.length
      this.expectedChord = chordOrder[nextIndex]
    }
  }

  private makeEnemy(level: number): Enemy {
    return {
      hp: 70 + level * 18,
      maxHp: 70 + level * 18,
      attackTimer: Math.max(1.7, 3.2 - level * 0.16),
      level,
      hitFlash: 0,
    }
  }

  private burst(x: number, y: number, count: number, color: string) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const speed = 90 + Math.random() * 260
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 0.32 + Math.random() * 0.42,
        maxLife: 0.74,
        color,
      })
    }
  }

  private resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    const rect = this.canvas.getBoundingClientRect()
    this.canvas.width = Math.floor(rect.width * ratio)
    this.canvas.height = Math.floor(rect.height * ratio)
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  private draw(timestamp: number) {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    const ctx = this.ctx
    ctx.clearRect(0, 0, width, height)
    this.drawBackground(ctx, width, height)
    this.drawArena(ctx, width, height, timestamp)
    this.drawAudioRibbon(ctx, width, height)
    this.drawSparks(ctx)
  }

  private drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const sky = ctx.createLinearGradient(0, 0, 0, height)
    sky.addColorStop(0, '#162032')
    sky.addColorStop(0.52, '#263447')
    sky.addColorStop(1, '#171b1f')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = '#324055'
    for (let i = 0; i < 9; i += 1) {
      const x = (i / 8) * width
      const mountainHeight = height * (0.22 + (i % 3) * 0.04)
      ctx.beginPath()
      ctx.moveTo(x - width * 0.18, height * 0.68)
      ctx.lineTo(x, height * 0.68 - mountainHeight)
      ctx.lineTo(x + width * 0.2, height * 0.68)
      ctx.closePath()
      ctx.fill()
    }

    ctx.fillStyle = '#202730'
    ctx.fillRect(0, height * 0.69, width, height * 0.31)
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'
    ctx.lineWidth = 1
    for (let i = 0; i < 6; i += 1) {
      const y = height * 0.72 + i * 26
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y + Math.sin(i) * 8)
      ctx.stroke()
    }
  }

  private drawArena(ctx: CanvasRenderingContext2D, width: number, height: number, timestamp: number) {
    const playerX = width * 0.25
    const enemyX = width * 0.73
    const groundY = height * 0.67
    const bob = Math.sin(timestamp / 220) * 2

    this.drawHealthBar(ctx, playerX - 88, groundY - 188, 176, 12, this.playerHp / 100, '#58d68d')
    this.drawHealthBar(ctx, enemyX - 92, groundY - 196, 184, 12, this.enemy.hp / this.enemy.maxHp, '#ef5d60')
    this.drawStickFighter(ctx, playerX, groundY + bob, '#e8edf2', '#58d68d', false)
    this.drawStickFighter(ctx, enemyX, groundY - bob, this.enemy.hitFlash > 0 ? '#fff1f0' : '#1b1115', '#ef5d60', true)
    this.drawExpectedGlyph(ctx, width, height)

    for (const slash of this.slashes) {
      this.drawSlash(ctx, playerX, enemyX, groundY, slash)
    }
  }

  private drawStickFighter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    bodyColor: string,
    bladeColor: string,
    mirrored: boolean,
  ) {
    const direction = mirrored ? -1 : 1
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = bodyColor
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.arc(x, y - 104, 17, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y - 84)
    ctx.lineTo(x, y - 42)
    ctx.lineTo(x - 24 * direction, y)
    ctx.moveTo(x, y - 42)
    ctx.lineTo(x + 28 * direction, y)
    ctx.moveTo(x, y - 68)
    ctx.lineTo(x + 32 * direction, y - 76)
    ctx.stroke()

    ctx.strokeStyle = bladeColor
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(x + 32 * direction, y - 76)
    ctx.lineTo(x + 92 * direction, y - 122)
    ctx.stroke()
    ctx.restore()
  }

  private drawSlash(ctx: CanvasRenderingContext2D, playerX: number, enemyX: number, groundY: number, slash: Slash) {
    const progress = slash.age / slash.duration
    const color = chords[slash.chord].color
    ctx.save()
    ctx.globalAlpha = Math.max(0, 1 - progress)
    ctx.strokeStyle = color
    ctx.lineWidth = 10
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(playerX + 80 + progress * 80, groundY - 130 + progress * 20)
    ctx.quadraticCurveTo((playerX + enemyX) / 2, groundY - 210, enemyX - 36, groundY - 98 + progress * 18)
    ctx.stroke()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
    ctx.restore()
  }

  private drawHealthBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    value: number,
    color: string,
  ) {
    ctx.fillStyle = 'rgba(0,0,0,0.38)'
    ctx.fillRect(x, y, width, height)
    ctx.fillStyle = color
    ctx.fillRect(x, y, width * Math.max(0, Math.min(1, value)), height)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.strokeRect(x, y, width, height)
  }

  private drawExpectedGlyph(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.beginPath()
    ctx.arc(width * 0.5, height * 0.2, 58, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = chords[this.expectedChord].color
    ctx.font = '700 42px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.expectedChord, width * 0.5, height * 0.2)
    ctx.restore()
  }

  private drawAudioRibbon(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const baseY = height - 54
    const ribbonHeight = 62
    ctx.save()
    ctx.fillStyle = 'rgba(4, 7, 10, 0.44)'
    ctx.fillRect(0, height - ribbonHeight, width, ribbonHeight)

    ctx.strokeStyle = this.detectedChord ? chords[this.detectedChord].color : 'rgba(255,255,255,0.34)'
    ctx.lineWidth = 2
    ctx.beginPath()
    const step = width / Math.max(1, this.waveform.length - 1)
    for (let i = 0; i < this.waveform.length; i += 6) {
      const x = i * step
      const y = baseY + ((this.waveform[i] - 128) / 128) * 22
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()

    const bars = 42
    const barWidth = width / bars
    for (let i = 0; i < bars; i += 1) {
      const sampleIndex = Math.floor((i / bars) * Math.min(180, this.spectrum.length - 1))
      const value = this.spectrum[sampleIndex] / 255
      ctx.fillStyle = `rgba(242, 193, 78, ${0.16 + value * 0.74})`
      ctx.fillRect(i * barWidth, height - 8 - value * 42, Math.max(2, barWidth - 3), value * 42)
    }
    ctx.restore()
  }

  private drawSparks(ctx: CanvasRenderingContext2D) {
    ctx.save()
    for (const spark of this.sparks) {
      ctx.globalAlpha = Math.max(0, spark.life / spark.maxLife)
      ctx.fillStyle = spark.color
      ctx.beginPath()
      ctx.arc(spark.x, spark.y, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private writeHud() {
    this.hud.score.textContent = String(this.score)
    this.hud.combo.textContent = `${this.combo}x`
    this.hud.wave.textContent = String(this.wave)
    this.hud.target.textContent = this.expectedChord
    this.hud.detected.textContent = this.detectedChord ?? '-'
    this.hud.confidence.textContent = `${Math.round(this.confidence * 100)}%`
    this.hud.volume.textContent = `${Math.round(this.volume * 100)}%`
    this.hud.mic.textContent = this.detector.message
    this.hud.mic.dataset.state = this.detector.state

    for (const chord of chordOrder) {
      this.hud[chord].classList.toggle('is-target', chord === this.expectedChord)
      this.hud[chord].classList.toggle('is-detected', chord === this.detectedChord)
    }
  }
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="game-shell">
    <section class="stage" aria-label="String Blade battle arena">
      <canvas id="arena"></canvas>
      <div class="topbar">
        <div class="brand">
          <span class="brand-mark"></span>
          <h1>String Blade</h1>
        </div>
        <div class="stats" aria-label="battle status">
          <span>Score <strong id="score">0</strong></span>
          <span>Combo <strong id="combo">0x</strong></span>
          <span>Wave <strong id="wave">1</strong></span>
        </div>
      </div>
      <div class="target-panel" aria-label="target chord">
        <span>Target</span>
        <strong id="target">C</strong>
      </div>
    </section>

    <aside class="control-panel" aria-label="audio controls">
      <button id="micButton" class="primary-action" type="button">Start Mic</button>
      <div class="meter-grid">
        <span>Mic</span><strong id="micState" data-state="idle">Mic off</strong>
        <span>Chord</span><strong id="detected">-</strong>
        <span>Lock</span><strong id="confidence">0%</strong>
        <span>Input</span><strong id="volume">0%</strong>
      </div>
      <div class="chord-pad" aria-label="manual chord controls">
        <button id="padC" type="button">C</button>
        <button id="padG" type="button">G</button>
        <button id="padAm" type="button">Am</button>
      </div>
    </aside>
  </main>
`

const hud: Record<string, HTMLElement> = {
  score: document.querySelector<HTMLElement>('#score')!,
  combo: document.querySelector<HTMLElement>('#combo')!,
  wave: document.querySelector<HTMLElement>('#wave')!,
  target: document.querySelector<HTMLElement>('#target')!,
  detected: document.querySelector<HTMLElement>('#detected')!,
  confidence: document.querySelector<HTMLElement>('#confidence')!,
  volume: document.querySelector<HTMLElement>('#volume')!,
  mic: document.querySelector<HTMLElement>('#micState')!,
  C: document.querySelector<HTMLElement>('#padC')!,
  G: document.querySelector<HTMLElement>('#padG')!,
  Am: document.querySelector<HTMLElement>('#padAm')!,
}

const game = new StringBladeGame(document.querySelector<HTMLCanvasElement>('#arena')!, hud)

document.querySelector<HTMLButtonElement>('#micButton')!.addEventListener('click', () => game.startMic())
document.querySelector<HTMLButtonElement>('#padC')!.addEventListener('click', () => game.manualChord('C'))
document.querySelector<HTMLButtonElement>('#padG')!.addEventListener('click', () => game.manualChord('G'))
document.querySelector<HTMLButtonElement>('#padAm')!.addEventListener('click', () => game.manualChord('Am'))
