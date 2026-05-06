# Ewords Dictation

一款英语听写应用程序，内置雅思，托福，GRE，四六级，考研英语，高考英语和中考英语8个词库。具有英美音听写，词典搜索，错题本，历史回顾等功能。

## Stack

Electron + React + TypeScript + Vite
React Router
Zustand
SQLite through `node:sqlite`
Piper TTS for local pronunciation
Vitest and Playwright for verification

## Development

安装依赖：

```bash
corepack pnpm install
```

创建数据库：

```bash
corepack pnpm db:seed
```

准备本地 Piper TTS：

```bash
corepack pnpm tts:setup
```

启动：

```bash
corepack pnpm dev
```

打包：

```bash
corepack pnpm package:win
```


## License

The original source code of this project is licensed under the Apache License 2.0.

Third-party data, TTS runtime files, voice models, and bundled resources remain under their original licenses. See `THIRD_PARTY_NOTICES.md` for details.
