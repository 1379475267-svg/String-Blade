# String Blade

[English](#english) | [中文](#中文)

## English

**String Blade** is a browser-based rhythm combat prototype built with Vite,
TypeScript, Phaser, Web Audio, and Web MIDI. Use chords to launch attacks, guard
against enemy projectiles, and parry at the right moment to reflect damage back.

Live demo: [https://stringblade.netlify.app](https://stringblade.netlify.app)

### Gameplay

- `C` chord: launch an energy projectile attack.
- `G` chord: guard against incoming enemy projectiles.
- Perfect guard timing reflects the enemy projectile and prevents damage.
- Early guard reduces damage.
- Enemy projectiles are fired automatically over time.
- Combo, score, wave, player health, and enemy health update in real time.

### Input Modes

- Manual buttons: use the on-screen `C`, `G`, and `Am` buttons.
- Microphone: press `Start Mic` and allow browser microphone access.
- MIDI keyboard: press `Start MIDI`; play C major to attack and G major to guard.

### Features

- Vite + TypeScript project setup
- Phaser-powered 2D battle scene
- Web Audio microphone permission and chord detection
- Web MIDI API support for MIDI keyboards and digital pianos
- Synthesized Web Audio sound effects
- Real-time waveform and spectrum visualization
- C/G/Am chord detection from FFT pitch-class energy
- Projectile attacks, guard timing, perfect parries, and reflected enemy shots
- Netlify deployment configuration

### Run Locally

```bash
npm install
npm run dev
```

Open the local Vite URL shown in your terminal.

### Build

```bash
npm run build
```

The production files are generated in `dist/`.

### Deploy

This project is configured for Netlify with `netlify.toml`.

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `22`

### Notes

The chord detector is intentionally lightweight and browser-native. It is tuned
for prototype playability, not studio-grade music transcription. Future versions
can add calibration, pitch tracking, richer chord models, sprites, and cloud
leaderboards.

## 中文

**String Blade** 是一个运行在浏览器里的节奏战斗原型，使用 Vite、
TypeScript、Phaser、Web Audio 和 Web MIDI 构建。玩家通过和弦发动攻击、
防御敌人的能量弹，并在合适时机弹反攻击。

在线试玩：[https://stringblade.netlify.app](https://stringblade.netlify.app)

### 玩法

- `C` 和弦：发射自己的能量弹攻击敌人。
- `G` 和弦：防御敌人发来的能量弹。
- 时机恰当的防御会触发完美弹反，不掉血并把攻击反弹回去。
- 较早的防御可以减少受到的伤害。
- 敌人会随时间自动发射攻击弹。
- 连击、分数、波次、玩家血量和敌人血量都会实时变化。

### 输入方式

- 手动按钮：使用界面上的 `C`、`G`、`Am` 按钮。
- 麦克风：点击 `Start Mic` 并授权浏览器麦克风权限。
- MIDI 键盘：点击 `Start MIDI`；弹 C 大三和弦攻击，弹 G 大三和弦防御。

### 功能

- Vite + TypeScript 项目结构
- Phaser 驱动的 2D 战斗场景
- Web Audio 麦克风权限与和弦检测
- Web MIDI API 支持 MIDI 键盘和电子琴
- Web Audio 合成战斗音效
- 实时波形和频谱显示
- 基于 FFT 音级能量的 C/G/Am 和弦检测
- 能量弹攻击、防御时机、完美弹反、敌方攻击反射
- Netlify 部署配置

### 本地运行

```bash
npm install
npm run dev
```

然后打开终端中显示的 Vite 本地地址。

### 构建

```bash
npm run build
```

生产文件会生成到 `dist/` 目录。

### 部署

项目已经通过 `netlify.toml` 配置好 Netlify 部署。

- 构建命令：`npm run build`
- 发布目录：`dist`
- Node 版本：`22`

### 说明

当前和弦检测器是轻量级、浏览器原生的原型实现，目标是可玩性，而不是专业级音乐转录。
后续可以继续加入校准、音高追踪、更丰富的和弦模型、角色素材和云端排行榜。
