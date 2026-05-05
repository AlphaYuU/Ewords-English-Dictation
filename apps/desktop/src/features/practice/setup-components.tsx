import { useState } from "react";
import { Icon, Switch } from "@dictation/ui";

export function SummaryTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ padding: 12, borderRadius: 10, background: "var(--surface-muted)", textAlign: "center" }}>
      <span className="page-subtitle">{label}</span>
      <strong style={{ display: "block", fontSize: 24, color: accent ? "var(--accent-primary)" : undefined }}>{value}</strong>
    </div>
  );
}

export function ChoiceCardGroup<T extends string>({
  options,
  value,
  onChange,
  selectedTone,
  subtitles,
  icons,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  selectedTone: "warm" | "cool";
  subtitles?: Partial<Record<T, string>>;
  icons?: Partial<Record<T, Parameters<typeof Icon>[0]["name"]>>;
}) {
  return (
    <div className={`practice-choice-grid practice-choice-${selectedTone}`}>
      {options.map((option) => (
        <ChoiceCardButton
          key={option.value}
          label={option.label}
          selected={option.value === value}
          subtitle={subtitles?.[option.value]}
          icon={icons?.[option.value]}
          onClick={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}

function ChoiceCardButton({
  label,
  selected,
  subtitle,
  icon,
  onClick,
}: {
  label: string;
  selected: boolean;
  subtitle?: string;
  icon?: Parameters<typeof Icon>[0]["name"];
  onClick: () => void;
}) {
  return (
    <button type="button" className={`practice-choice-card ${selected ? "is-selected" : ""}`} onClick={onClick}>
      {icon ? <Icon name={icon} size={18} /> : null}
      <strong>{label}</strong>
      {subtitle ? <span>{subtitle}</span> : null}
    </button>
  );
}

export function SettingSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange?: (checked: boolean) => void }) {
  const [local, setLocal] = useState(checked);
  return (
    <div className="setting-item">
      <span>{label}</span>
      <Switch checked={onChange ? checked : local} onChange={onChange ?? setLocal} />
    </div>
  );
}
