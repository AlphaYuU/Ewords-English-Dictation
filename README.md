# Ewords Dictation

一款英语听写应用程序，内置雅思，托福，GRE，四六级，考研英语，高考英语和中考英语8个词库。具有英美音听写，词典搜索，错题本，历史回顾等功能。

## Stack

Electron + React + TypeScript + Vite
React Router
Zustand
SQLite through `node:sqlite`
Piper TTS for local pronunciation
Vitest and Playwright for verification

## License

The original source code of this project is licensed under the Apache License 2.0.

Third-party data, TTS runtime files, voice models, and bundled resources remain under their original licenses. See `THIRD_PARTY_NOTICES.md` for details.

## Demo

https://www.lemyu.com/projects/dictation

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

## 应用界面

### 词库总览

内置 IELTS、TOEFL、GRE、四六级、考研英语、高考英语和中考英语词库，并支持错题本、收藏夹、自建词库和导入单词。

<img width="2163" height="1397" alt="cb12f7df73f1e18b465f5ad7b8fd2ce4" src="https://github.com/user-attachments/assets/e1dba109-d116-4ea1-ba4c-c4a198e6d45b" />

### 听写设置

支持设置听写来源、抽取数量、顺序/随机、英音/美音、打字/纸笔模式、播放次数、词间间隔和批改规则。

<img width="2163" height="1397" alt="3868f46aa56b3300aafd835c95be4a85" src="https://github.com/user-attachments/assets/995df8c7-d236-483c-9108-c72de13ac6dd" />

### 选择听写来源

支持按词库、Unit 或单词自由选择听写范围，可组合多个来源生成本次听写列表。

<img width="2163" height="1397" alt="4f34cae450cbca5377d3e9c35eb1e5ac" src="https://github.com/user-attachments/assets/94582809-7b4f-497a-b3c6-2515b63a0744" />


