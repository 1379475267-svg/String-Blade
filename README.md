# String Blade

[English](#english) | [中文](#中文)

## English

**String Blade** is a browser-based guitar chord combat game built with Vite, TypeScript, Phaser, Web Audio API, and Web MIDI. It turns chord input into battle actions: play chords to attack, guard, parry, heal, dodge, shield, or follow rhythm-based chord progressions.

Live demo: [https://stringblade.netlify.app](https://stringblade.netlify.app)

### Preview

Screenshot and GIF placeholders are reserved for the project docs:

- `docs/images/gameplay.png` - Duel mode combat, projectiles, parry timing, and skill effects
- `docs/images/progression-mode.png` - Progression mode rhythm meter and chord sequence
- `docs/images/mic-calibration.png` - Microphone calibration controls and chord chart UI

### Gameplay

String Blade currently has two modes:

- **Duel Mode**: battle an enemy that fires projectiles over time. Use chord skills to attack, defend, and survive.
- **Progression Mode**: play a given chord progression in rhythm. Correct chords attack the enemy; wrong or missed chords damage the player.

Current Duel skills:

- `C`: basic slash / energy projectile attack
- `G`: guard, with perfect parry timing to reflect enemy attacks
- `Am`: small heal
- `Em`: dodge window
- `F`: heavy flame slash
- `Dm`: temporary shield

Progression mode grades timing as `Early`, `Good`, or `Perfect`. Better timing adds damage and score; perfect timing also restores a little HP.

### Input Modes

- Manual chord buttons for `C`, `G`, `Am`, `Em`, `D`, `Dm`, `E`, `A`, and `F`
- Microphone chord recognition through the Web Audio API
- Per-chord microphone calibration for all supported chords
- Web MIDI input for MIDI keyboards and digital pianos
- Built-in guitar chord diagrams for supported open chord shapes

### Features

- Phaser-powered 2D battle scene
- Web Audio microphone permission and browser-native chord detection
- Web MIDI API support
- Synthesized sound effects with Web Audio
- Real-time waveform and spectrum visualization
- FFT pitch-class scoring, autocorrelation pitch anchoring, calibration profiles, and multi-frame voting
- Duel combat with projectiles, guard timing, parry reflection, cooldowns, healing, dodging, shielding, and heavy attacks
- Progression mode with structured chord loops and visible rhythm timing
- Local best score, wave, and combo tracking
- Mobile-friendly layout and first-run onboarding
- Netlify deployment configuration

### Current Limitations

- Microphone chord recognition is affected by room noise, guitar tone, playing dynamics, tuning, and microphone quality.
- Browser microphone access usually requires HTTPS or `localhost`.
- The current chord detector is a lightweight gameplay prototype, not a professional music transcription tool.
- Calibration is available for all supported chords, but `C`, `G`, and `Am` are currently the best-tested shapes.
- Mobile browser support for Web Audio and Web MIDI can vary by device and browser.

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

### Roadmap

- **v0.2**: code structure refactor, richer Duel chord skills, improved calibration controls, pause/restart flow, and documentation polish
- **v0.3**: fuller level system, character art, stronger skill effects, improved calibration guidance
- **v1.0**: playable public demo, leaderboard, more music-game systems, and broader chord progression content

### License

String Blade is released under the MIT License. See [LICENSE](LICENSE).

## 中文

**String Blade** 是一个运行在浏览器里的吉他和弦战斗游戏，使用 Vite、TypeScript、Phaser、Web Audio API 和 Web MIDI 构建。它会把和弦输入转换成战斗动作：弹和弦可以攻击、防御、弹反、回血、闪避、开护盾，也可以按照节奏完成和弦走向。

在线试玩：[https://stringblade.netlify.app](https://stringblade.netlify.app)

### 项目预览

项目文档预留了以下截图或 GIF 占位：

- `docs/images/gameplay.png` - Duel 模式战斗、能量弹、弹反时机和技能效果
- `docs/images/progression-mode.png` - Progression 模式节奏条和和弦走向
- `docs/images/mic-calibration.png` - 麦克风校准控件和吉他和弦图界面

### 玩法

String Blade 当前有两个模式：

- **Duel 模式**：与会自动发射能量弹的敌人对战。玩家通过和弦技能攻击、防御并存活。
- **Progression 模式**：按照给定和弦走向和节奏演奏。弹对会攻击敌人，弹错或漏弹会受到伤害。

当前 Duel 技能：

- `C`：基础斩击 / 能量弹攻击
- `G`：防御，时机准确时可以完美弹反敌方攻击
- `Am`：小幅回血
- `Em`：闪避窗口
- `F`：重击 / 火焰斩
- `Dm`：临时护盾

Progression 模式会根据节奏判定 `Early`、`Good`、`Perfect`。时机越准，伤害和分数越高；Perfect 还会少量回血。

### 输入方式

- `C`、`G`、`Am`、`Em`、`D`、`Dm`、`E`、`A`、`F` 手动和弦按钮
- 通过 Web Audio API 进行麦克风和弦识别
- 为所有支持和弦提供逐和弦麦克风校准
- 支持 MIDI 键盘和电子琴的 Web MIDI 输入
- 内置支持和弦的吉他开放和弦图

### 功能

- Phaser 驱动的 2D 战斗场景
- Web Audio 麦克风权限与浏览器原生和弦检测
- Web MIDI API 支持
- Web Audio 合成战斗音效
- 实时波形和频谱显示
- FFT 音级评分、自相关音高锚定、校准配置和多帧投票
- Duel 战斗：能量弹、防御时机、弹反反射、技能冷却、回血、闪避、护盾和重击
- Progression 模式：规范和弦走向和可视化节奏判定
- 本地保存最高分、最高波次和最高连击
- 移动端友好布局和首次进入引导
- Netlify 部署配置

### 当前限制

- 麦克风和弦识别会受到环境噪声、吉他音色、弹奏力度、调音状态和麦克风质量影响。
- 浏览器麦克风权限通常需要 HTTPS 或 `localhost` 环境。
- 当前和弦识别是轻量级游戏原型，不是专业级音乐转录工具。
- 校准功能已经支持所有和弦，但目前 `C`、`G`、`Am` 是测试最充分的形状。
- 移动端浏览器对 Web Audio / Web MIDI 的支持可能因设备和浏览器而不同。

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

### 后续计划

- **v0.2**：代码结构重构、更多 Duel 和弦技能、校准控件优化、暂停/重开流程、文档完善
- **v0.3**：更完整的关卡系统、角色素材、更强的技能特效、更清晰的校准引导
- **v1.0**：可玩的正式公开 Demo、排行榜、更多音乐玩法和更丰富的和弦走向内容

### 许可证

String Blade 使用 MIT License 开源。详见 [LICENSE](LICENSE)。
