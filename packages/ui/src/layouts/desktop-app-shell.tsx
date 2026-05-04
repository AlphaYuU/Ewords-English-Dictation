import type { ReactNode } from "react";
import { Icon, SearchBar } from "../components/primitives";

export type SidebarItem = {
  label: string;
  route: string;
  icon: "library" | "book" | "headphones" | "history" | "settings";
};

export function DesktopAppShell({
  children,
  activeRoute,
  searchValue,
  onSearchChange,
  onSearchFocus,
  onSearchSubmit,
  searchPanel,
  onNavigate,
  wrongBookCount = 0,
  favoriteCount = 0,
  sidebarDisabled = false,
}: {
  children: ReactNode;
  activeRoute: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchFocus: () => void;
  onSearchSubmit?: () => void;
  searchPanel?: ReactNode;
  onNavigate: (route: string) => void;
  wrongBookCount?: number;
  favoriteCount?: number;
  sidebarDisabled?: boolean;
}) {
  const nav: SidebarItem[] = [
    { label: "我的词库", route: "/library", icon: "library" },
    { label: "词典", route: "/dictionary", icon: "book" },
    { label: "开始听写", route: "/practice", icon: "headphones" },
    { label: "历史记录", route: "/history", icon: "history" },
  ];
  return (
    <div className="desktop-shell">
      <aside className="desktop-sidebar">
        <div className={`sidebar-search ${sidebarDisabled ? "is-disabled" : ""}`}>
          <SearchBar
            variant="sidebar"
            value={searchValue}
            onChange={onSearchChange}
            onFocus={onSearchFocus}
            onSubmit={onSearchSubmit}
            placeholder="搜索词库 / 单词"
            disabled={sidebarDisabled}
          />
          {sidebarDisabled ? null : searchPanel}
        </div>
        <p className="sidebar-section-label">Workspace</p>
        <nav className="sidebar-nav">
          {nav.map((item) => (
            <button
              key={item.route}
              type="button"
              className={`sidebar-nav-item ${activeRoute.startsWith(item.route.split("?")[0]) ? "is-active" : ""}`}
              disabled={sidebarDisabled}
              onClick={() => onNavigate(item.route)}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <p className="sidebar-section-label">Pinned</p>
        <div className="sidebar-nav">
          <button type="button" className={`sidebar-pin-item ${activeRoute.startsWith("/wrong-book") ? "is-active" : ""}`} disabled={sidebarDisabled} onClick={() => onNavigate("/wrong-book")}>
            <span className="sidebar-pin-main"><Icon name="alert" size={15} />错题本</span>
            <span style={{ color: "var(--accent-error)" }}>{wrongBookCount}</span>
          </button>
          <button type="button" className={`sidebar-pin-item ${activeRoute.startsWith("/favorites") ? "is-active" : ""}`} disabled={sidebarDisabled} onClick={() => onNavigate("/favorites")}>
            <span className="sidebar-pin-main"><Icon name="star" size={15} />收藏夹</span>
            <span>{favoriteCount}</span>
          </button>
        </div>
        <div className="sidebar-bottom">
          <button
            type="button"
            className={`sidebar-nav-item ${activeRoute.startsWith("/settings") ? "is-active" : ""}`}
            disabled={sidebarDisabled}
            onClick={() => onNavigate("/settings")}
          >
            <Icon name="settings" size={16} />
            <span>设置</span>
          </button>
        </div>
      </aside>
      <main className="desktop-main">{children}</main>
    </div>
  );
}
