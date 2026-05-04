import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAppStore } from "../stores/app-store";
import { hasDesktopBridge } from "../services/desktop-bridge";

export function Providers({ children }: { children: ReactNode }) {
  const hydrateFromDatabase = useAppStore((state) => state.hydrateFromDatabase);
  const hydrationStatus = useAppStore((state) => state.hydrationStatus);
  const hydrationError = useAppStore((state) => state.hydrationError);
  useEffect(() => {
    void hydrateFromDatabase();
  }, [hydrateFromDatabase]);

  if (hasDesktopBridge() && hydrationStatus !== "ready") {
    return (
      <main className="app-loading-gate">
        <section>
          <h1>{hydrationStatus === "error" ? "数据加载失败" : "正在加载本地数据"}</h1>
          <p>{hydrationStatus === "error" ? hydrationError ?? "无法打开本地数据库。" : "正在读取词库、词典和听写历史。"}</p>
          {hydrationStatus === "error" ? <button type="button" onClick={() => void hydrateFromDatabase()}>重试</button> : null}
        </section>
      </main>
    );
  }

  return children;
}
