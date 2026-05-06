import type { CSSProperties, ReactNode } from "react";
import type { LibraryType } from "@dictation/domain";
import { Icon } from "../primitives";

export type LibraryCardViewModel = {
  id: number;
  title: string;
  subtitle?: string;
  label?: string;
  type: LibraryType | "empty";
  wordCount: number;
  progress?: number;
  accuracy?: number;
  coverColor?: string;
};

export function LibraryCard({
  library,
  onClick,
  action,
}: {
  library: LibraryCardViewModel;
  onClick?: () => void;
  action?: ReactNode;
}) {
  const variant = library.type === "wrong_book" || library.type === "favorite" ? "system" : library.type;
  if (variant === "system") {
    return (
      <article
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter") onClick?.();
        }}
        className={`library-card ${variant}`}
        style={{ "--card-color": library.coverColor } as CSSProperties}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
          <span className="icon-button icon-button-lg" style={{ boxShadow: "none" }}>
            <Icon name={library.type === "favorite" ? "star" : "alert"} />
          </span>
          <span>
            <strong style={{ display: "block", fontSize: 18 }}>{library.title}</strong>
            <span style={{ fontSize: 13, opacity: 0.85 }}>{library.subtitle}</span>
          </span>
        </span>
        {action}
      </article>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`library-card ${variant}`}
      style={{ "--card-color": library.coverColor } as CSSProperties}
    >
      <span className="library-label">{library.label}</span>
      <h3 className="library-title">{library.title}</h3>
      {library.progress ? (
        <div style={{ width: "84%", marginTop: 58 }}>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${library.progress}%`, background: "rgba(255,255,255,0.9)" }} />
          </div>
        </div>
      ) : null}
      <span className="library-meta">{library.subtitle ?? `${library.wordCount} 词`}</span>
    </button>
  );
}

export function EmptyLibraryCard({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" className="library-card empty" onClick={onClick}>
      <Icon name="plus" size={30} />
      <strong style={{ marginTop: 18 }}>新建词库</strong>
      <span className="library-meta" style={{ marginTop: 8 }}>
        或导入 Excel / CSV
      </span>
    </button>
  );
}
