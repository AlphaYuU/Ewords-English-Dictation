import { useNavigate } from "react-router-dom";
import { Button, Icon, SettingItem } from "@dictation/ui";
import { useSettingsStore } from "../stores/settings-store";
import { exportTatoebaAttributionCsv, openExternalUrl, saveTextFile, selectDesktopDataBackupFile } from "../services/desktop-bridge";

const externalLinks = {
  ecdict: "https://github.com/skywind3000/ECDICT",
  tatoeba: "https://tatoeba.org/",
  piper: "https://github.com/rhasspy/piper",
  piperVoices: "https://huggingface.co/rhasspy/piper-voices",
};

export function SettingsPage() {
  const navigate = useNavigate();
  const settings = useSettingsStore((state) => state.settings);
  const libraries = useSettingsStore((state) => state.libraries);
  const words = useSettingsStore((state) => state.words);
  const units = useSettingsStore((state) => state.units);
  const sessions = useSettingsStore((state) => state.sessions);
  const results = useSettingsStore((state) => state.results);
  const history = useSettingsStore((state) => state.history);
  const searchHistory = useSettingsStore((state) => state.searchHistory);
  const openDialog = useSettingsStore((state) => state.openDialog);
  const restoreBackup = useSettingsStore((state) => state.restoreBackup);
  const exportData = () => {
    const exportPayload = { version: 1, exportedAt: Date.now(), libraries, units, words, sessions, results, history, searchHistory, settings };
    return saveTextFile("dictation-data.json", JSON.stringify(exportPayload, null, 2), "application/json;charset=utf-8");
  };
  const restoreDataBackup = async () => {
    const selected = await selectDesktopDataBackupFile();
    if (!selected) return;
    try {
      restoreBackup(JSON.parse(selected.text));
    } catch {
      openDialog("import-failed");
    }
  };
  return (
    <>
      <header className="page-topbar">
        <div><h1 className="page-title">设置</h1><p className="page-subtitle">管理你的数据、偏好和应用信息</p></div>
      </header>
      <div className="settings-layout">
        <main className="settings-main">
          <section className="settings-card settings-data-card">
            <h2>数据管理</h2>
            <p className="page-subtitle">导出、恢复、清理缓存和重置本地数据</p>
            <div className="settings-action-grid">
              <Button
                variant="primary"
                size="lg"
                iconStart={<Icon name="download" />}
                onClick={() => void exportData()}
              >
                导出数据
              </Button>
              <Button variant="secondary" size="lg" iconStart={<Icon name="database" />} onClick={() => void restoreDataBackup()}>恢复备份数据</Button>
              <Button variant="danger" size="lg" iconStart={<Icon name="trash" />} onClick={() => openDialog("clear-cache")}>清除缓存</Button>
              <Button variant="danger" size="lg" iconStart={<Icon name="trash" />} onClick={() => openDialog("clear-data")}>清空数据</Button>
            </div>
          </section>
          <section className="settings-card settings-about-card">
            <h2>关于</h2>
            <div className="settings-about-list">
              <SettingItem title="应用名称" value="Ewords" />
              <SettingItem title="软件作者" value="Lemon" />
              <SettingItem title="当前版本" value="v1.0.0" />
              <SettingItem title="数据来源" value="ECDICT、Tatoeba、Piper TTS" />
              <SettingItem title="授权协议" value="MIT、CC BY 2.0 FR / CC0" />
            </div>
          </section>
        </main>
        <aside className="settings-aside">
          <section className="settings-card settings-open-source-card">
            <h2>第三方内容与许可</h2>
            <div className="settings-license-list">
              <LicenseSummary name="ECDICT" description="单词、释义、音标、词形和标签" license="MIT" />
              <LicenseSummary name="Tatoeba" description="部分中英文例句文本" license="CC BY / CC0" wide />
              <LicenseSummary name="Piper TTS" description="英音 / 美音本地合成" license="MIT" />
            </div>
            <p className="settings-license-note">
              本应用未使用 Tatoeba 音频文件。<br />
              完整许可与署名可在对应说明中查看。
            </p>
            <div className="settings-detail-actions">
              <Button variant="secondary" size="sm" className="settings-detail-button settings-detail-button-wide" onClick={() => navigate("/settings/about-dictionary")}>
                查看 ECDICT 许可
              </Button>
              <Button variant="secondary" size="sm" className="settings-detail-button" onClick={() => navigate("/settings/about-examples")}>
                Tatoeba 署名
              </Button>
              <Button variant="secondary" size="sm" className="settings-detail-button" onClick={() => navigate("/settings/about-tts")}>
                TTS 许可
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export function AboutDictionaryPage() {
  const navigate = useNavigate();
  return (
    <section className="settings-detail-page">
      <button type="button" className="back-link" onClick={() => navigate("/settings")}>‹ 返回设置</button>
      <header className="page-topbar">
        <div>
          <h1 className="page-title">ECDICT 许可</h1>
          <p className="page-subtitle">词典数据来源与许可说明</p>
        </div>
      </header>
      <section className="settings-license-panel settings-license-panel-compact">
        <h2>MIT License</h2>
        <p>ECDICT 词典数据采用 MIT License。<br />可复制、修改、合并、发布、分发、再授权和销售，但需保留版权声明和许可声明。</p>
        <p>本应用使用 ECDICT 的单词、释义、音标、词形变化和标签字段。</p>
        <p>ECDICT 及其贡献者与本应用无从属、合作或背书关系，相关数据版权仍归原作者或贡献者所有。</p>
        <div className="settings-meta-row">
          <ExternalCapsule label="来源网站：GitHub · skywind3000/ECDICT" url={externalLinks.ecdict} />
          <span className="settings-info-capsule">开源协议：MIT</span>
        </div>
      </section>
    </section>
  );
}

export function AboutExamplesPage() {
  const navigate = useNavigate();
  const openDialog = useSettingsStore((state) => state.openDialog);
  const handleExport = async () => {
    try {
      await exportTatoebaAttributionCsv();
    } catch {
      openDialog("export-failed");
    }
  };
  return (
    <section className="settings-detail-page">
      <button type="button" className="back-link" onClick={() => navigate("/settings")}>‹ 返回设置</button>
      <header className="page-topbar">
        <div>
          <h1 className="page-title">Tatoeba 例句署名</h1>
          <p className="page-subtitle">例句文本来源、许可与导出说明</p>
        </div>
      </header>
      <section className="settings-license-panel settings-license-panel-tatoeba">
        <h2>Tatoeba Project</h2>
        <p>本应用使用筛选后的部分中英文例句文本。<br />例句可能采用 CC BY 2.0 FR 或 CC0 1.0，具体以 Tatoeba 原句页面显示为准。</p>
        <p>完整例句、作者、许可和原句链接可导出 CSV 查看。</p>
        <div className="settings-meta-row">
          <ExternalCapsule label="来源网站：Tatoeba.org" url={externalLinks.tatoeba} />
          <span className="settings-info-capsule">许可：CC BY 2.0 FR / CC0 1.0</span>
        </div>
        <div className="settings-export-row">
          <Button variant="primary" size="lg" className="settings-export-button" iconStart={<Icon name="download" />} onClick={() => void handleExport()}>
            导出例句与署名
          </Button>
          <div className="settings-export-meta">CSV 包含：单词、例句、作者、许可、Tatoeba 原句链接</div>
        </div>
        <div className="settings-divider" />
        <h3>导出格式</h3>
        <p>导出的 CSV 每行对应一组例句，包含英文与中文句子 ID、作者、许可和原句链接。<br />用户可以按需查看、保存或归档。</p>
        <p className="settings-detail-note">说明：本应用未使用 Tatoeba 音频文件。</p>
      </section>
    </section>
  );
}

export function AboutTtsPage() {
  const navigate = useNavigate();
  return (
    <section className="settings-detail-page">
      <button type="button" className="back-link" onClick={() => navigate("/settings")}>‹ 返回设置</button>
      <header className="page-topbar">
        <div>
          <h1 className="page-title">Piper TTS 许可</h1>
          <p className="page-subtitle">本地发音生成引擎与语音模型说明</p>
        </div>
      </header>
      <section className="settings-license-panel settings-license-panel-tts">
        <h2>本地发音生成</h2>
        <p>英音 / 美音由本地 Piper TTS 生成。<br />本应用未使用 Tatoeba 音频文件，生成的 wav 只作为本地缓存，可在设置中清除。</p>
        <TtsResourceRow
          name="Piper 引擎"
          source="来源网站：GitHub · rhasspy/piper"
          url={externalLinks.piper}
          license="MIT"
        />
        <TtsResourceRow
          name="en_US-lessac-medium.onnx"
          source="来源网站：Hugging Face · rhasspy/piper-voices"
          url={externalLinks.piperVoices}
          license="MIT"
        />
        <TtsResourceRow
          name="en_GB-alan-medium.onnx"
          source="来源网站：Hugging Face · rhasspy/piper-voices"
          url={externalLinks.piperVoices}
          license="MIT"
        />
        <p className="settings-detail-note">Piper 与语音模型均在本地使用。<br />许可信息以当前打包版本为准。</p>
      </section>
    </section>
  );
}

function LicenseSummary({ name, description, license, wide = false }: { name: string; description: string; license: string; wide?: boolean }) {
  return (
    <div className="settings-license-item">
      <div>
        <strong>{name}</strong>
        <span>{description}</span>
      </div>
      <span className={`settings-license-pill ${wide ? "is-wide" : ""}`}>{license}</span>
    </div>
  );
}

function ExternalCapsule({ label, url }: { label: string; url: string }) {
  return (
    <button type="button" className="settings-info-capsule settings-info-capsule-link" onClick={() => void openExternalUrl(url)}>
      {label}
    </button>
  );
}

function TtsResourceRow({ name, source, url, license }: { name: string; source: string; url: string; license: string }) {
  return (
    <button type="button" className="settings-resource-row settings-resource-row-link" onClick={() => void openExternalUrl(url)}>
      <div>
        <strong>{name}</strong>
        <span>{source}</span>
      </div>
      <span>{license}</span>
    </button>
  );
}
