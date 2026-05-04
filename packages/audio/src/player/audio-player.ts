export type PlayAudioRequest = {
  wordId: number;
  word: string;
  accent: "uk" | "us";
  speed: 0.5 | 1 | 1.5;
};

export interface AudioService {
  play(request: PlayAudioRequest): Promise<void>;
  prepare(request: PlayAudioRequest): Promise<boolean>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  replay(): Promise<void>;
  setSpeed(speed: 0.5 | 1 | 1.5): Promise<void>;
}

type DesktopAudioBridge = {
  dictationBridge?: {
    audio?: {
      play: (request: PlayAudioRequest) => Promise<{ ok: boolean; fileUrl?: string; filePath?: string; dataUrl?: string; reason?: string }>;
      prepare?: (request: PlayAudioRequest) => Promise<{ ok: boolean; fileUrl?: string; filePath?: string; reason?: string }>;
      playFile?: (request: { filePath: string }) => Promise<{ ok: boolean; reason?: string }>;
      stop: () => Promise<boolean>;
      pause: () => Promise<boolean>;
    };
  };
};

export class ControlledAudioService implements AudioService {
  private currentAudio: HTMLAudioElement | null = null;
  private lastRequest: PlayAudioRequest | null = null;

  async play(request: PlayAudioRequest): Promise<void> {
    this.lastRequest = request;
    const bridge = typeof window === "undefined" ? undefined : (window as Window & DesktopAudioBridge).dictationBridge?.audio;
    if (!bridge) {
      throw new Error("PIPER_BRIDGE_UNAVAILABLE");
    }
    const response = await bridge.play(request).catch((error) => {
      throw error instanceof Error ? error : new Error(String(error));
    });
    const audioUrl = response?.dataUrl ?? response?.fileUrl;
    if (!response?.ok || !audioUrl) {
      throw new Error(response?.reason ?? "PIPER_AUDIO_UNAVAILABLE");
    }
    if (response.filePath && bridge.playFile) {
      const systemPlayback = await bridge.playFile({ filePath: response.filePath });
      if (systemPlayback?.ok) return;
    }
    try {
      await this.playFile(audioUrl, 1, request.word);
    } catch (error) {
      if (!response.filePath || !bridge.playFile) throw error;
      const fallback = await bridge.playFile({ filePath: response.filePath });
      if (!fallback?.ok) throw new Error(fallback?.reason ?? "SYSTEM_AUDIO_PLAYBACK_FAILED");
    }
  }

  async prepare(request: PlayAudioRequest): Promise<boolean> {
    const bridge = typeof window === "undefined" ? undefined : (window as Window & DesktopAudioBridge).dictationBridge?.audio;
    if (!bridge?.prepare) return false;
    const response = await bridge.prepare(request).catch(() => null);
    return Boolean(response?.ok);
  }

  async pause(): Promise<void> {
    this.currentAudio?.pause();
    const bridge = typeof window === "undefined" ? undefined : (window as Window & DesktopAudioBridge).dictationBridge?.audio;
    await bridge?.pause();
  }

  async stop(): Promise<void> {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    const bridge = typeof window === "undefined" ? undefined : (window as Window & DesktopAudioBridge).dictationBridge?.audio;
    await bridge?.stop();
  }

  async replay(): Promise<void> {
    if (this.lastRequest) await this.play(this.lastRequest);
  }

  async setSpeed(speed: 0.5 | 1 | 1.5): Promise<void> {
    if (this.lastRequest) this.lastRequest = { ...this.lastRequest, speed };
    if (this.currentAudio) this.currentAudio.playbackRate = speed;
  }

  private async playFile(fileUrl: string, speed: 0.5 | 1 | 1.5, word: string): Promise<void> {
    await this.stop();
    const audio = new Audio(fileUrl);
    audio.preload = "auto";
    audio.muted = false;
    audio.volume = 1;
    audio.playbackRate = speed;
    this.currentAudio = audio;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let loadedDurationMs = 0;
      const watchdogMs = estimatePlaybackWatchdogMs(word, speed);
      const watchdog = window.setTimeout(() => {
        finish();
      }, watchdogMs);
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const fail = (reason?: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(reason instanceof Error ? reason : new Error("AUDIO_PLAYBACK_FAILED"));
      };
      const metadataLoaded = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          loadedDurationMs = audio.duration * 1000;
          window.clearTimeout(watchdog);
          window.setTimeout(finish, Math.max(1200, loadedDurationMs / speed + 1200));
        }
      };
      const cleanup = () => {
        window.clearTimeout(watchdog);
        audio.removeEventListener("ended", finish);
        audio.removeEventListener("error", fail);
        audio.removeEventListener("loadedmetadata", metadataLoaded);
        if (this.currentAudio === audio) this.currentAudio = null;
      };
      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("error", fail, { once: true });
      audio.addEventListener("loadedmetadata", metadataLoaded, { once: true });
      void audio.play().catch(fail);
    });
  }
}

function estimatePlaybackWatchdogMs(word: string, speed: 0.5 | 1 | 1.5): number {
  const normalizedLength = Math.max(1, word.trim().length);
  const estimatedMs = 1000 + normalizedLength * 260;
  return Math.max(2500, Math.min(12000, estimatedMs / speed + 2500));
}
