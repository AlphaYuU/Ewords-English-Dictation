import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  Database,
  Download,
  Eye,
  Headphones,
  History,
  Keyboard,
  Library,
  List,
  Loader2,
  Minus,
  Pause,
  PencilLine,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Shuffle,
  SkipForward,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";

export type IconName =
  | "alert"
  | "book"
  | "check"
  | "chevronDown"
  | "database"
  | "download"
  | "eye"
  | "headphones"
  | "history"
  | "keyboard"
  | "library"
  | "list"
  | "minus"
  | "pause"
  | "pencil"
  | "play"
  | "plus"
  | "rotate"
  | "search"
  | "settings"
  | "shuffle"
  | "skip"
  | "star"
  | "trash"
  | "upload"
  | "x"
  | "back";

const icons = {
  alert: AlertTriangle,
  book: BookOpen,
  check: Check,
  chevronDown: ChevronDown,
  database: Database,
  download: Download,
  eye: Eye,
  headphones: Headphones,
  history: History,
  keyboard: Keyboard,
  library: Library,
  list: List,
  minus: Minus,
  pause: Pause,
  pencil: PencilLine,
  play: Play,
  plus: Plus,
  rotate: RotateCcw,
  search: Search,
  settings: Settings,
  shuffle: Shuffle,
  skip: SkipForward,
  star: Star,
  trash: Trash2,
  upload: Upload,
  x: X,
  back: ChevronLeft,
};

export function Icon({ name, size = 18, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  const Component = icons[name];
  return <Component aria-hidden size={size} strokeWidth={1.8} fill={filled && name === "star" ? "currentColor" : "none"} />;
}

export function Button({
  variant = "primary",
  size = "md",
  iconStart,
  iconEnd,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "text";
  size?: "sm" | "md" | "lg" | "dialog";
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
}) {
  return (
    <button className={`button button-${variant} button-${size} ${className}`} {...props}>
      {iconStart}
      {children}
      {iconEnd}
    </button>
  );
}

export function IconButton({
  icon,
  size = "md",
  label,
  active = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; size?: "sm" | "md" | "lg"; label: string; active?: boolean }) {
  const iconSize = size === "lg" ? 22 : size === "md" ? 18 : 16;
  return (
    <button className={`icon-button icon-button-${size} ${active ? "is-active" : ""} ${className}`} aria-label={label} title={label} {...props}>
      <Icon name={icon} size={iconSize} filled={active} />
    </button>
  );
}

export function SearchBar({
  variant = "desktop",
  value,
  onChange,
  placeholder,
  onFocus,
  onSubmit,
  disabled = false,
}: {
  variant?: "desktop" | "sidebar" | "dialog";
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onFocus?: () => void;
  onSubmit?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={`search-bar search-${variant} ${disabled ? "is-disabled" : ""}`}>
      <Search aria-hidden size={16} strokeWidth={1.8} />
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit?.();
        }}
        placeholder={placeholder}
      />
      {value ? (
        <button className="button button-text button-sm" aria-label="清空" disabled={disabled} onClick={() => onChange("")} type="button">
          <Icon name="x" size={14} />
        </button>
      ) : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="textarea" {...props} />;
}

export function Chip({
  selected,
  children,
  onClick,
}: {
  selected?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={`chip ${selected ? "is-selected" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={option.value === value ? "is-active" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <button type="button" className={`switch ${checked ? "is-on" : ""}`} onClick={() => onChange(!checked)} />;
}

export function ProgressBar({ value, tone = "success" }: { value: number; tone?: "success" | "danger" | "accent" }) {
  const color = tone === "danger" ? "var(--accent-error)" : tone === "accent" ? "var(--accent-primary)" : "var(--accent-success)";
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function LoadingState({ label = "加载中" }: { label?: string }) {
  return (
    <div className="loading-state">
      <p>
        <Loader2 aria-hidden size={20} /> {label}
      </p>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div>
        <Database aria-hidden size={38} strokeWidth={1.5} color="var(--accent-primary)" />
        <h2>{title}</h2>
        <p>{description}</p>
        {action ? <div style={{ marginTop: 22 }}>{action}</div> : null}
      </div>
    </div>
  );
}

export function ErrorState({ title = "出现问题", description }: { title?: string; description: string }) {
  return (
    <div className="error-state">
      <div>
        <AlertTriangle aria-hidden size={38} color="var(--accent-error)" />
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}
