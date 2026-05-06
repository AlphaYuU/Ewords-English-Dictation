import type { ReactNode } from "react";

export function SettingItem({
  title,
  description,
  value,
  control,
  onClick,
}: {
  title: string;
  description?: string;
  value?: ReactNode;
  control?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="setting-item" onClick={onClick} style={{ width: "100%", background: "transparent", borderLeft: 0, borderRight: 0, borderTop: 0, textAlign: "left" }}>
      <span>
        <strong>{title}</strong>
        {description ? <span className="word-row-sub" style={{ display: "block" }}>{description}</span> : null}
      </span>
      <span>{control ?? value}</span>
    </button>
  );
}
