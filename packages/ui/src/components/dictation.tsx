import type { ReactNode } from "react";
import { Button, Icon } from "./primitives";

export function DictationPlayButton({ playing, disabled, onClick }: { playing?: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className="dictation-play-button" disabled={disabled} onClick={onClick} aria-label={playing ? "正在播放" : "播放"}>
      <Icon name={playing ? "pause" : "play"} size={48} />
    </button>
  );
}

export function DictationPlayer({
  round,
  hint,
  playing,
  children,
  onPlay,
  disablePlay,
}: {
  round: string;
  hint?: string;
  playing?: boolean;
  children?: ReactNode;
  onPlay?: () => void;
  disablePlay?: boolean;
}) {
  return (
    <section style={{ display: "grid", placeItems: "center", height: 460, borderRadius: 20, background: "var(--accent-primary)", color: "var(--foreground-inverse)" }}>
      <div style={{ textAlign: "center" }}>
        <div className="chip" style={{ background: "var(--accent-warning)", border: 0, color: "var(--foreground-primary)", marginBottom: 26 }}>{round}</div>
        <div><DictationPlayButton playing={playing} disabled={disablePlay} onClick={onPlay} /></div>
        {hint ? <p style={{ marginTop: 28 }}>{hint}</p> : null}
        {children}
      </div>
    </section>
  );
}

export function DictationControlBar({
  onPrevious,
  onReplay,
  onNext,
  onPause,
  onSubmit,
  disablePrevious,
  disableReplay,
  disableNext,
  disableSubmit,
  submitLabel = "提交",
}: {
  onPrevious: () => void;
  onReplay: () => void;
  onNext: () => void;
  onPause: () => void;
  onSubmit: () => void;
  disablePrevious?: boolean;
  disableReplay?: boolean;
  disableNext?: boolean;
  disableSubmit?: boolean;
  submitLabel?: string;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 180px 180px 180px 220px", gap: 48, marginTop: 30 }}>
      <Button variant="secondary" size="lg" iconStart={<Icon name="back" />} disabled={disablePrevious} onClick={onPrevious}>上一词</Button>
      <Button variant="secondary" size="lg" iconStart={<Icon name="rotate" />} disabled={disableReplay} onClick={onReplay}>重播</Button>
      <Button variant="secondary" size="lg" iconStart={<Icon name="play" />} disabled={disableNext} onClick={onNext}>下一词</Button>
      <Button variant="secondary" size="lg" iconStart={<Icon name="pause" />} onClick={onPause}>暂停</Button>
      <Button variant="primary" size="lg" iconStart={<Icon name="check" />} disabled={disableSubmit} onClick={onSubmit}>{submitLabel}</Button>
    </div>
  );
}

export function SessionTopActions({
  correctCount = 0,
  wrongCount = 0,
  onSettings,
  onExit,
}: {
  correctCount?: number;
  wrongCount?: number;
  onSettings: () => void;
  onExit?: () => void;
}) {
  return (
    <div className="page-actions">
      <span className="chip"><span style={{ color: "var(--accent-success)" }}>●</span>&nbsp; 正确 {correctCount}</span>
      <span className="chip"><span style={{ color: "var(--accent-error)" }}>●</span>&nbsp; 错 {wrongCount}</span>
      <Button variant="secondary" size="sm" iconStart={<Icon name="settings" size={15} />} onClick={onSettings}>
        设置
      </Button>
      {onExit ? (
        <Button variant="danger" size="sm" onClick={onExit}>
          结束
        </Button>
      ) : null}
    </div>
  );
}
