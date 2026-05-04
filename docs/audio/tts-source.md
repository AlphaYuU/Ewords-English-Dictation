# TTS Source

This app uses a controlled local TTS path only. Browser / system Web Speech is intentionally not used, so UK and US pronunciation cannot silently collapse to the same system voice.

## Selected Engine

- Engine: Piper TTS
- Preferred executable: `rhasspy/piper` release line
- Runtime license: MIT for the archived `rhasspy/piper` project
- Current upstream note: newer `piper-tts` / `OHF-Voice/piper1-gpl` packages are GPL-3.0-or-later, so closed-source commercial redistribution should not bundle those newer GPL packages unless the whole distribution is license-compatible.

## Recommended Voices

- US: `en_US-lessac-medium`
- UK: `en_GB-alan-medium`

The selected voices are from `rhasspy/piper-voices`, whose Hugging Face repository marks them as MIT licensed. MIT permits commercial use, modification, distribution, and private use as long as the license notice is preserved.

## Local Paths

By default the desktop app looks for:

- Piper executable: `%APPDATA%/Ewords Dictation/tts/piper/piper.exe`
- US voice: `%APPDATA%/Ewords Dictation/tts/voices/en_US-lessac-medium.onnx`
- US voice config: `%APPDATA%/Ewords Dictation/tts/voices/en_US-lessac-medium.onnx.json`
- UK voice: `%APPDATA%/Ewords Dictation/tts/voices/en_GB-alan-medium.onnx`
- UK voice config: `%APPDATA%/Ewords Dictation/tts/voices/en_GB-alan-medium.onnx.json`

These can be overridden:

- `DICTATION_PIPER_EXE`
- `DICTATION_PIPER_US_MODEL`
- `DICTATION_PIPER_UK_MODEL`

For local Windows development, run:

```powershell
corepack pnpm tts:setup
```

The script downloads the archived `rhasspy/piper` Windows build plus the selected voice models into the default paths above.

Generated `.wav` files are cached under the app `audio-cache` directory and are removed by Settings -> Clear cache.
