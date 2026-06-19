import Phaser from 'phaser'
import { type ChordName, chords } from '../audio/AudioChordDetector'
import { SoundEffects } from '../audio/SoundEffects'
import { type Difficulty, type ProgressionLevel, getLevelForDifficulty } from '../music/ChordLibrary'

export type BattleHudState = {
  score: number
  combo: number
  wave: number
  mode: BattleMode
  difficulty: Difficulty
  levelName: string
  progression: ChordName[]
  progressionIndex: number
  rhythmTimeLeft: number
  rhythmBeatSeconds: number
  rhythmRating: RhythmRating
  target: ChordName
  defense: ChordName
  status: string
  detected: ChordName | null
  confidence: number
  volume: number
  playerHp: number
  enemyHp: number
  paused: boolean
}

type EnemyState = {
  hp: number
  maxHp: number
  attackTimer: number
  level: number
}

type Projectile = {
  sprite: Phaser.GameObjects.Container
  trail: Phaser.GameObjects.Graphics
  from: Phaser.Math.Vector2
  to: Phaser.Math.Vector2
  chord: ChordName
  target: 'enemy' | 'player'
  damage: number
  life: number
  duration: number
}

type BattleSceneConfig = {
  onHudChange: (state: BattleHudState) => void
}

export type BattleMode = 'duel' | 'progression'
export type RhythmRating = 'ready' | 'early' | 'good' | 'perfect' | 'miss'

const ATTACK_CHORD: ChordName = 'C'
const DEFENSE_CHORD: ChordName = 'G'
const GUARD_WINDOW_SECONDS = 0.85
const PERFECT_WINDOW_SECONDS = 0.34
const PERFECT_RHYTHM_SECONDS = 0.28
const GOOD_RHYTHM_SECONDS = 0.68

const DUEL_SKILL_COOLDOWNS: Partial<Record<ChordName, { manual: number; audio: number }>> = {
  C: { manual: 260, audio: 760 },
  G: { manual: 220, audio: 620 },
  Am: { manual: 1500, audio: 1900 },
  Em: { manual: 1200, audio: 1600 },
  F: { manual: 1900, audio: 2400 },
  Dm: { manual: 2100, audio: 2600 },
}

export class BattleScene extends Phaser.Scene {
  private readonly onHudChange: (state: BattleHudState) => void
  private readonly sounds = new SoundEffects()
  private player!: Phaser.GameObjects.Container
  private enemy!: Phaser.GameObjects.Container
  private playerHealth!: Phaser.GameObjects.Graphics
  private enemyHealth!: Phaser.GameObjects.Graphics
  private targetRing!: Phaser.GameObjects.Container
  private targetText!: Phaser.GameObjects.Text
  private audioRibbon!: Phaser.GameObjects.Graphics
  private projectiles: Projectile[] = []
  private spectrum: Uint8Array<ArrayBufferLike> = new Uint8Array(1024)
  private waveform: Uint8Array<ArrayBufferLike> = new Uint8Array(1024)
  private detectedChord: ChordName | null = null
  private confidence = 0
  private volume = 0
  private playerHp = 100
  private enemyState: EnemyState = this.makeEnemy(1)
  private combo = 0
  private score = 0
  private wave = 1
  private expectedChord: ChordName = ATTACK_CHORD
  private mode: BattleMode = 'duel'
  private difficulty: Difficulty = 'easy'
  private level: ProgressionLevel = getLevelForDifficulty('easy')
  private progressionIndex = 0
  private rhythmTimer = this.level.beatSeconds
  private rhythmRating: RhythmRating = 'ready'
  private gameOver = false
  private paused = false
  private status = 'C attack / G guard'
  private lastAttackAt = 0
  private readonly skillCooldowns = new Map<ChordName, number>()
  private dodgeUntil = 0
  private shieldUntil = 0
  private readonly handleResize = () => this.layout()

  constructor(config: BattleSceneConfig) {
    super('BattleScene')
    this.onHudChange = config.onHudChange
  }

  create() {
    this.createWorld()
    this.player = this.createStickFighter(0xeff6f4, chords.C.color, false)
    this.enemy = this.createStickFighter(0x151014, chords.Am.color, true)
    this.playerHealth = this.add.graphics()
    this.enemyHealth = this.add.graphics()
    this.audioRibbon = this.add.graphics()
    this.targetRing = this.createTargetRing()
    this.scale.on('resize', this.handleResize)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize)
    })
    this.layout()
    this.emitHud()
  }

  update(_time: number, deltaMs: number) {
    const delta = Math.min(0.05, deltaMs / 1000)
    if (this.gameOver) {
      this.emitHud()
      return
    }
    if (this.paused) {
      this.drawHealthBars()
      this.drawAudioRibbon()
      this.emitHud()
      return
    }

    if (this.mode === 'progression') {
      this.rhythmTimer -= delta
      if (this.rhythmTimer <= 0) {
        this.missProgressionChord('Missed chord')
      }
    }

    if (this.mode === 'duel') {
      this.enemyState.attackTimer -= delta
      if (this.enemyState.attackTimer <= 0) {
        this.fireEnemyAttack()
        this.enemyState.attackTimer = Math.max(1.9, 3.4 - this.wave * 0.14)
      }
    }

    if (this.playerHp <= 0) {
      this.endGame()
    }

    this.updateProjectiles(delta)
    this.drawHealthBars()
    this.drawAudioRibbon()
    this.emitHud()
  }

  setAudioData(data: {
    detected: ChordName | null
    confidence: number
    volume: number
    spectrum: Uint8Array<ArrayBufferLike>
    waveform: Uint8Array<ArrayBufferLike>
  }) {
    this.detectedChord = data.detected
    this.confidence = data.confidence
    this.volume = data.volume
    this.spectrum = data.spectrum
    this.waveform = data.waveform
  }

  triggerChord(chord: ChordName, manual: boolean) {
    const now = performance.now()
    if (this.gameOver) {
      this.resetRun()
    }
    if (this.paused) {
      this.status = 'Paused'
      this.emitHud()
      return
    }

    if (this.mode === 'progression') {
      this.triggerProgressionChord(chord, now, manual)
      return
    }

    this.triggerDuelSkill(chord, now, manual)
  }

  setMode(mode: BattleMode) {
    this.mode = mode
    this.resetRun()
  }

  setDifficulty(difficulty: Difficulty) {
    this.difficulty = difficulty
    this.level = getLevelForDifficulty(difficulty)
    this.resetRun()
  }

  togglePaused() {
    if (this.gameOver) {
      return
    }
    this.paused = !this.paused
    this.status = this.paused ? 'Paused' : 'Battle resumed'
    this.emitHud()
  }

  restartRun() {
    this.resetRun()
    this.emitHud()
  }

  private createWorld() {
    this.add.rectangle(0, 0, 10, 10, 0x101722).setOrigin(0)
    this.add.graphics().setName('background')
  }

  private layout() {
    const { width, height } = this.scale
    const background = this.children.getByName('background') as Phaser.GameObjects.Graphics
    background.clear()
    background.fillGradientStyle(0x101722, 0x101722, 0x263247, 0x15191f, 1)
    background.fillRect(0, 0, width, height)
    background.fillStyle(0xf2c14e, 0.08)
    background.fillCircle(width * 0.72, height * 0.2, 120)

    background.fillStyle(0x2b394f, 0.72)
    for (let i = 0; i < 10; i += 1) {
      const x = (i / 9) * width
      const peak = height * (0.42 + (i % 3) * 0.04)
      background.beginPath()
      background.moveTo(x - width * 0.15, height * 0.62)
      background.lineTo(x, peak)
      background.lineTo(x + width * 0.18, height * 0.62)
      background.closePath()
      background.fillPath()
    }

    background.fillStyle(0x1b222b, 1)
    background.fillRect(0, height * 0.68, width, height * 0.32)
    background.lineStyle(1, 0x4fb3ff, 0.12)
    for (let i = 0; i < 7; i += 1) {
      const x = width * (0.18 + i * 0.11)
      background.lineBetween(x, height * 0.68, x - width * 0.08, height)
    }
    for (let i = 0; i < 6; i += 1) {
      const y = height * 0.72 + i * 28
      background.lineBetween(0, y, width, y + Math.sin(i) * 8)
    }

    const groundY = height * 0.67
    this.player.setPosition(width * 0.25, groundY)
    this.enemy.setPosition(width * 0.73, groundY)
    this.targetRing.setPosition(width * 0.5, height * 0.2)
    this.drawHealthBars()
    this.drawAudioRibbon()
  }

  private createStickFighter(bodyColor: number, bladeColor: number, mirrored: boolean) {
    const direction = mirrored ? -1 : 1
    const container = this.add.container(0, 0)
    const glow = this.add.ellipse(0, 12, 126, 36, bladeColor, 0.16)
    const body = this.add.graphics()
    body.lineStyle(7, bodyColor, 1)
    body.strokeCircle(0, -104, 17)
    body.beginPath()
    body.moveTo(0, -84)
    body.lineTo(0, -42)
    body.lineTo(-24 * direction, 0)
    body.moveTo(0, -42)
    body.lineTo(28 * direction, 0)
    body.moveTo(0, -68)
    body.lineTo(32 * direction, -76)
    body.strokePath()
    body.lineStyle(6, bladeColor, 1)
    body.beginPath()
    body.moveTo(32 * direction, -76)
    body.lineTo(92 * direction, -122)
    body.strokePath()
    container.add([glow, body])
    this.tweens.add({
      targets: container,
      y: '+=4',
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    })
    return container
  }

  private createTargetRing() {
    const container = this.add.container(0, 0)
    const ring = this.add.graphics()
    this.targetText = this.add
      .text(0, 0, this.expectedChord, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '44px',
        fontStyle: '900',
        color: chords[this.expectedChord].cssColor,
      })
      .setOrigin(0.5)
    container.add([ring, this.targetText])
    this.drawTargetRing(ring)
    return container
  }

  private updateTargetRing() {
    const ring = this.targetRing.getAt(0) as Phaser.GameObjects.Graphics
    this.drawTargetRing(ring)
  }

  private drawTargetRing(ring: Phaser.GameObjects.Graphics) {
    ring.clear()
    ring.fillStyle(chords[this.expectedChord].color, 0.14)
    ring.fillCircle(0, 0, 76)
    ring.lineStyle(2, chords[this.expectedChord].color, 0.72)
    ring.strokeCircle(0, 0, 50)
    this.targetText.setText(this.expectedChord)
    this.targetText.setColor(chords[this.expectedChord].cssColor)
  }

  private drawHealthBars() {
    const groundY = this.scale.height * 0.67
    this.drawHealthBar(this.playerHealth, this.player.x - 86, groundY - 190, 172, 11, this.playerHp / 100, 0x58d68d)
    this.drawHealthBar(
      this.enemyHealth,
      this.enemy.x - 94,
      groundY - 198,
      188,
      11,
      this.enemyState.hp / this.enemyState.maxHp,
      0xef5d60,
    )
  }

  private drawHealthBar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    value: number,
    color: number,
  ) {
    graphics.clear()
    graphics.fillStyle(0x000000, 0.38)
    graphics.fillRect(x, y, width, height)
    graphics.fillStyle(0xffffff, 0.1)
    graphics.fillRect(x, y, width, 2)
    graphics.fillStyle(color, 1)
    graphics.fillRect(x, y, width * Phaser.Math.Clamp(value, 0, 1), height)
    graphics.lineStyle(1, 0xffffff, 0.3)
    graphics.strokeRect(x, y, width, height)
  }

  private drawAudioRibbon() {
    const { width, height } = this.scale
    const baseY = height - 58
    const ribbonHeight = 70
    this.audioRibbon.clear()
    this.audioRibbon.fillStyle(0x04070a, 0.58)
    this.audioRibbon.fillRect(0, height - ribbonHeight, width, ribbonHeight)
    this.audioRibbon.lineStyle(1, 0x4fb3ff, 0.2)
    this.audioRibbon.lineBetween(0, height - ribbonHeight, width, height - ribbonHeight)

    this.audioRibbon.lineStyle(3, this.detectedChord ? chords[this.detectedChord].color : 0xffffff, this.detectedChord ? 0.9 : 0.34)
    const step = width / Math.max(1, this.waveform.length - 1)
    this.audioRibbon.beginPath()
    for (let i = 0; i < this.waveform.length; i += 6) {
      const x = i * step
      const y = baseY + ((this.waveform[i] - 128) / 128) * 22
      if (i === 0) {
        this.audioRibbon.moveTo(x, y)
      } else {
        this.audioRibbon.lineTo(x, y)
      }
    }
    this.audioRibbon.strokePath()

    const bars = 42
    const barWidth = width / bars
    for (let i = 0; i < bars; i += 1) {
      const sampleIndex = Math.floor((i / bars) * Math.min(180, this.spectrum.length - 1))
      const value = this.spectrum[sampleIndex] / 255
      this.audioRibbon.fillStyle(0xf2c14e, 0.18 + value * 0.72)
      this.audioRibbon.fillRect(i * barWidth, height - 10 - value * 46, Math.max(2, barWidth - 4), value * 46)
    }
  }

  private triggerDuelSkill(chord: ChordName, now: number, manual: boolean) {
    if (!this.canUseSkill(chord, now, manual)) {
      return
    }

    if (chord === 'C') {
      this.basicSlash(now)
      return
    }
    if (chord === 'G') {
      this.guard()
      return
    }
    if (chord === 'Am') {
      this.healSkill(now)
      return
    }
    if (chord === 'Em') {
      this.dodgeSkill(now)
      return
    }
    if (chord === 'F') {
      this.heavySlash(now)
      return
    }
    if (chord === 'Dm') {
      this.shieldSkill(now)
      return
    }

    this.status = `${chord} is not mapped in Duel yet`
  }

  private canUseSkill(chord: ChordName, now: number, manual: boolean) {
    const cooldown = DUEL_SKILL_COOLDOWNS[chord]
    if (!cooldown) {
      return true
    }

    const lastUsed = this.skillCooldowns.get(chord) ?? 0
    const duration = manual ? cooldown.manual : cooldown.audio
    if (now - lastUsed < duration) {
      return false
    }

    this.skillCooldowns.set(chord, now)
    return true
  }

  private basicSlash(now: number) {
    this.lastAttackAt = now
    const damage = chords.C.damage + this.combo * 2
    this.combo += 1
    this.score += 8
    this.status = 'C slash launched'
    this.sounds.attack('C')
    this.firePlayerAttack('C', damage, 0.34)
  }

  private healSkill(now: number) {
    this.lastAttackAt = now
    const heal = 12 + Math.min(8, Math.floor(this.combo / 3))
    this.playerHp = Math.min(100, this.playerHp + heal)
    this.score += 6
    this.status = `Am recover +${heal} HP`
    this.sounds.waveClear()
    this.spawnShield(chords.Am.color, 0.48)
    this.spawnHitBurst(this.player.x + 16, this.player.y - 92, 0x58d68d, 10)
  }

  private dodgeSkill(now: number) {
    this.dodgeUntil = now + 900
    this.score += 6
    this.status = 'Em dodge window'
    this.sounds.guard()
    this.spawnShield(chords.Em.color, 0.42)
    this.tweens.add({
      targets: this.player,
      x: this.player.x - 34,
      duration: 120,
      yoyo: true,
      ease: 'Quad.out',
    })
  }

  private heavySlash(now: number) {
    this.lastAttackAt = now
    const damage = chords.F.damage + 18 + this.combo * 2
    this.combo += 1
    this.score += 14
    this.status = 'F heavy flame slash'
    this.sounds.attack('F')
    this.cameraShake(0.006)
    this.firePlayerAttack('F', damage, 0.42)
    this.spawnHitBurst(this.player.x + 72, this.player.y - 128, chords.F.color, 8)
  }

  private shieldSkill(now: number) {
    this.shieldUntil = now + 2200
    this.score += 5
    this.status = 'Dm shield active'
    this.sounds.guard()
    this.spawnShield(chords.Dm.color, 0.7)
  }

  private firePlayerAttack(chord: ChordName, damage: number, duration: number) {
    const from = new Phaser.Math.Vector2(this.player.x + 82, this.player.y - 124)
    const to = new Phaser.Math.Vector2(this.enemy.x - 54, this.enemy.y - 112)
    this.fireProjectile({ chord, from, to, target: 'enemy', damage, duration })
  }

  private triggerProgressionChord(chord: ChordName, now: number, manual: boolean) {
    if (now - this.lastAttackAt < (manual ? 180 : 560)) {
      return
    }
    this.lastAttackAt = now

    if (chord !== this.expectedChord) {
      this.missProgressionChord(`Wrong chord: ${chord}`)
      return
    }

    const timing = this.rateRhythmHit()
    this.rhythmRating = timing.rating
    const damage = chords[chord].damage + Math.ceil(this.combo * 1.5 + timing.damageBonus)
    this.combo += 1
    this.score += damage + timing.scoreBonus
    if (timing.rating === 'perfect') {
      this.playerHp = Math.min(100, this.playerHp + 3)
      this.cameraShake(0.006)
      this.spawnShield(0xf2c14e, 0.5)
    }
    this.status = `${timing.label}: ${chord}`
    this.sounds.attack(chord)
    this.fireProgressionAttack(chord, damage)
    this.advanceProgression()
  }

  private rateRhythmHit() {
    // Progression mode rewards hits that land close to the end of the visible beat meter.
    if (this.rhythmTimer <= PERFECT_RHYTHM_SECONDS) {
      return { rating: 'perfect' as const, label: 'Perfect rhythm', damageBonus: 18, scoreBonus: 34 }
    }
    if (this.rhythmTimer <= GOOD_RHYTHM_SECONDS) {
      return { rating: 'good' as const, label: 'Good rhythm', damageBonus: 9, scoreBonus: 16 }
    }
    return { rating: 'early' as const, label: 'Early hit', damageBonus: 0, scoreBonus: 4 }
  }

  private fireProgressionAttack(chord: ChordName, damage: number) {
    const from = new Phaser.Math.Vector2(this.player.x + 82, this.player.y - 124)
    const to = new Phaser.Math.Vector2(this.enemy.x - 54, this.enemy.y - 112)
    this.fireProjectile({ chord, from, to, target: 'enemy', damage, duration: 0.34 })
  }

  private advanceProgression() {
    this.progressionIndex = (this.progressionIndex + 1) % this.level.chords.length
    if (this.progressionIndex === 0) {
      this.wave += 1
      this.score += 50 + this.combo * 5
    }
    this.expectedChord = this.level.chords[this.progressionIndex]
    this.rhythmTimer = this.level.beatSeconds
    this.updateTargetRing()
  }

  private missProgressionChord(reason: string) {
    const damage = this.difficulty === 'easy' ? 8 : this.difficulty === 'normal' ? 12 : 16
    this.rhythmRating = 'miss'
    this.playerHp = Math.max(0, this.playerHp - damage)
    this.combo = 0
    this.status = `${reason} -${damage} HP`
    this.sounds.hit()
    this.cameraShake(0.007)
    this.spawnHitBurst(this.player.x, this.player.y - 72, 0xef5d60, 8)
    this.advanceProgression()
  }

  private fireEnemyAttack() {
    const from = new Phaser.Math.Vector2(this.enemy.x - 82, this.enemy.y - 120)
    const to = new Phaser.Math.Vector2(this.player.x + 46, this.player.y - 104)
    this.status = 'Incoming attack'
    this.sounds.enemyAttack()
    this.fireProjectile({
      chord: DEFENSE_CHORD,
      from,
      to,
      target: 'player',
      damage: 13 + this.wave,
      duration: Math.max(0.9, 1.35 - this.wave * 0.04),
    })
  }

  private fireProjectile(options: {
    chord: ChordName
    from: Phaser.Math.Vector2
    to: Phaser.Math.Vector2
    target: 'enemy' | 'player'
    damage: number
    duration: number
  }) {
    const color = options.target === 'player' ? 0xef5d60 : chords[options.chord].color
    const trail = this.add.graphics()
    const body = this.add.ellipse(0, 0, 58, 28, color, 1)
    const core = this.add.ellipse(10, -2, 24, 12, 0xffffff, 0.92)
    const sprite = this.add.container(options.from.x, options.from.y, [body, core])
    sprite.setRotation(Phaser.Math.Angle.BetweenPoints(options.from, options.to))
    this.projectiles.push({
      sprite,
      trail,
      from: options.from,
      to: options.to,
      chord: options.chord,
      target: options.target,
      damage: options.damage,
      life: 0,
      duration: options.duration,
    })
  }

  private updateProjectiles(delta: number) {
    for (const projectile of this.projectiles) {
      projectile.life += delta
      const progress = Phaser.Math.Clamp(projectile.life / projectile.duration, 0, 1)
      const eased = progress
      const x = Phaser.Math.Linear(projectile.from.x, projectile.to.x, eased)
      const y = Phaser.Math.Linear(projectile.from.y, projectile.to.y, eased)
      const angle = Phaser.Math.Angle.Between(projectile.from.x, projectile.from.y, projectile.to.x, projectile.to.y)
      const tail = 96 * (1 - progress * 0.3)
      const color = projectile.target === 'player' ? 0xef5d60 : chords[projectile.chord].color

      projectile.sprite.setPosition(x, y)
      projectile.trail.clear()
      projectile.trail.fillStyle(color, 0.28 * (1 - progress * 0.4))
      projectile.trail.beginPath()
      projectile.trail.moveTo(x - Math.cos(angle) * tail, y - Math.sin(angle) * tail)
      projectile.trail.lineTo(x - Math.cos(angle + 0.22) * 28, y - Math.sin(angle + 0.22) * 28)
      projectile.trail.lineTo(x + Math.cos(angle) * 26, y + Math.sin(angle) * 26)
      projectile.trail.lineTo(x - Math.cos(angle - 0.22) * 28, y - Math.sin(angle - 0.22) * 28)
      projectile.trail.closePath()
      projectile.trail.fillPath()
    }

    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i]
      if (projectile.life >= projectile.duration) {
        this.resolveProjectileImpact(projectile)
        projectile.sprite.destroy()
        projectile.trail.destroy()
        this.projectiles.splice(i, 1)
      }
    }
  }

  private guard() {
    const incoming = this.findNearestIncoming()
    if (!incoming) {
      this.status = 'Guard ready'
      this.sounds.guard()
      this.spawnShield(0x4fb3ff, 0.38)
      return
    }

    const timeToImpact = incoming.duration - incoming.life
    // Guard has a wider block window and a tighter perfect-parry window near impact.
    if (timeToImpact <= PERFECT_WINDOW_SECONDS) {
      this.reflectProjectile(incoming)
      this.combo += 1
      this.score += 42 + this.combo * 4
      this.status = 'Perfect parry'
      this.sounds.parry()
      this.spawnShield(0xf2c14e, 0.75)
      this.cameraShake(0.008)
      return
    }

    if (timeToImpact <= GUARD_WINDOW_SECONDS) {
      incoming.damage = Math.ceil(incoming.damage * 0.35)
      incoming.sprite.setAlpha(0.45)
      this.status = 'Guard reduced damage'
      this.sounds.guard()
      this.spawnShield(0x4fb3ff, 0.58)
      return
    }

    this.status = 'Guard too early'
    this.sounds.guard()
    this.spawnShield(0x4fb3ff, 0.28)
  }

  private findNearestIncoming() {
    let nearest: Projectile | undefined
    let nearestTimeToImpact = Number.POSITIVE_INFINITY

    for (const projectile of this.projectiles) {
      if (projectile.target !== 'player') {
        continue
      }

      const timeToImpact = projectile.duration - projectile.life
      if (timeToImpact < nearestTimeToImpact) {
        nearest = projectile
        nearestTimeToImpact = timeToImpact
      }
    }

    return nearest
  }

  private reflectProjectile(projectile: Projectile) {
    projectile.target = 'enemy'
    projectile.damage = Math.ceil(projectile.damage * 1.45)
    projectile.chord = DEFENSE_CHORD
    projectile.from = new Phaser.Math.Vector2(projectile.sprite.x, projectile.sprite.y)
    projectile.to = new Phaser.Math.Vector2(this.enemy.x - 54, this.enemy.y - 112)
    projectile.life = 0
    projectile.duration = 0.34
    projectile.sprite.setAlpha(1)
    projectile.sprite.setRotation(Phaser.Math.Angle.BetweenPoints(projectile.from, projectile.to))
  }

  private resolveProjectileImpact(projectile: Projectile) {
    const color = projectile.target === 'player' ? 0xef5d60 : chords[projectile.chord].color
    this.spawnImpact(projectile.to.x, projectile.to.y, color)

    if (projectile.target === 'player') {
      const now = performance.now()
      if (now <= this.dodgeUntil) {
        this.combo += 1
        this.score += 18
        this.status = 'Em dodge avoided damage'
        this.sounds.guard()
        this.spawnShield(chords.Em.color, 0.52)
        return
      }

      const damage = now <= this.shieldUntil ? Math.ceil(projectile.damage * 0.25) : projectile.damage
      if (now <= this.shieldUntil) {
        this.status = `Dm shield reduced -${damage} HP`
        this.shieldUntil = 0
        this.spawnShield(chords.Dm.color, 0.58)
      } else {
        this.status = `Hit -${damage} HP`
      }
      this.playerHp = Math.max(0, this.playerHp - damage)
      this.combo = 0
      this.sounds.hit()
      this.cameraShake(0.008)
      this.spawnHitBurst(this.player.x, this.player.y - 72, 0xef5d60, 8)
      return
    }

    this.enemyState.hp = Math.max(0, this.enemyState.hp - projectile.damage)
    this.score += projectile.damage
    if (this.mode !== 'progression') {
      this.status = projectile.chord === DEFENSE_CHORD ? 'Returned attack hit' : 'Attack hit'
    }
    this.sounds.playerImpact(projectile.chord)
    this.flashEnemy(projectile.chord)
    if (this.enemyState.hp <= 0) {
      this.advanceWave()
    }
  }

  private spawnShield(color: number, alpha: number) {
    const shield = this.add.circle(this.player.x + 20, this.player.y - 86, 54).setStrokeStyle(4, color, alpha)
    this.tweens.add({
      targets: shield,
      scale: 1.35,
      alpha: 0,
      duration: 240,
      ease: 'Quad.out',
      onComplete: () => shield.destroy(),
    })
  }

  private flashEnemy(chord: ChordName) {
    this.tweens.add({
      targets: this.enemy,
      scaleX: 1.08,
      scaleY: 0.94,
      duration: 70,
      yoyo: true,
      ease: 'Quad.out',
    })
    this.spawnHitBurst(this.enemy.x - 42, this.enemy.y - 94, chords[chord].color, 12)
  }

  private spawnImpact(x: number, y: number, color: number) {
    const ring = this.add.circle(x, y, 12).setStrokeStyle(3, color, 0.75)
    this.tweens.add({
      targets: ring,
      radius: 54,
      alpha: 0,
      duration: 260,
      ease: 'Quad.out',
      onComplete: () => ring.destroy(),
    })
  }

  private spawnHitBurst(x: number, y: number, color: number, count: number) {
    for (let i = 0; i < count; i += 1) {
      const particle = this.add.circle(x, y, Phaser.Math.Between(2, 5), color, 0.9)
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
      const distance = Phaser.Math.Between(22, 72)
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: Phaser.Math.Between(220, 420),
        ease: 'Quad.out',
        onComplete: () => particle.destroy(),
      })
    }
  }

  private advanceWave() {
    this.wave += 1
    this.score += 100 + this.combo * 12
    this.expectedChord = ATTACK_CHORD
    this.enemyState = this.makeEnemy(this.wave)
    this.cameraShake(0.01)
    this.sounds.waveClear()
    this.spawnImpact(this.enemy.x, this.enemy.y - 96, 0xf2c14e)
    this.updateTargetRing()
  }

  private resetRun() {
    this.projectiles.forEach((projectile) => {
      projectile.sprite.destroy()
      projectile.trail.destroy()
    })
    this.projectiles = []
    this.playerHp = 100
    this.enemyState = this.makeEnemy(1)
    this.combo = 0
    this.score = 0
    this.wave = 1
    this.progressionIndex = 0
    this.rhythmTimer = this.level.beatSeconds
    this.rhythmRating = 'ready'
    this.gameOver = false
    this.paused = false
    this.skillCooldowns.clear()
    this.lastAttackAt = 0
    this.dodgeUntil = 0
    this.shieldUntil = 0
    this.expectedChord = this.mode === 'progression' ? this.level.chords[0] : ATTACK_CHORD
    this.status = this.mode === 'progression' ? this.level.name : 'C attack / G / Am / Em / F / Dm skills'
    this.updateTargetRing()
  }

  private endGame() {
    this.playerHp = 0
    this.combo = 0
    this.gameOver = true
    this.status = 'Game over - play a chord to restart'
    this.cameraShake(0.012)
  }

  private cameraShake(intensity: number) {
    this.cameras.main.shake(120, intensity)
  }

  private makeEnemy(level: number): EnemyState {
    return {
      hp: 70 + level * 18,
      maxHp: 70 + level * 18,
      attackTimer: Math.max(1.7, 3.2 - level * 0.16),
      level,
    }
  }

  private emitHud() {
    this.onHudChange({
      score: this.score,
      combo: this.combo,
      wave: this.wave,
      mode: this.mode,
      difficulty: this.difficulty,
      levelName: this.level.name,
      progression: this.level.chords,
      progressionIndex: this.progressionIndex,
      rhythmTimeLeft: Math.max(0, this.rhythmTimer),
      rhythmBeatSeconds: this.level.beatSeconds,
      rhythmRating: this.rhythmRating,
      target: this.expectedChord,
      defense: DEFENSE_CHORD,
      status: this.status,
      detected: this.detectedChord,
      confidence: this.confidence,
      volume: this.volume,
      playerHp: this.playerHp,
      enemyHp: this.enemyState.hp / this.enemyState.maxHp,
      paused: this.paused,
    })
  }
}
