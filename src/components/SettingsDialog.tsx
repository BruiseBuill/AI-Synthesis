import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, BookOpen, Database, RefreshCw, RotateCcw, Upload, X } from "lucide-react";
import { countCards, getDifficultyStats } from "../data/cardData";
import { useGameStore } from "../store/gameStore";

interface SettingsDialogProps {
  onClose: () => void;
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [activeView, setActiveView] = useState<"data" | "rules">("data");
  const [chartVisible, setChartVisible] = useState(false);
  const definitions = useGameStore((state) => state.cardDefinitions);
  const source = useGameStore((state) => state.cardDataSource);
  const status = useGameStore((state) => state.cardDataStatus);
  const message = useGameStore((state) => state.cardDataMessage);
  const reloadBundled = useGameStore((state) => state.reloadBundledCardData);
  const importFile = useGameStore((state) => state.importCardDataFile);
  const restoreBuiltIn = useGameStore((state) => state.restoreBuiltInCardData);
  const loading = status === "loading";
  const difficultyStats = useMemo(() => getDifficultyStats(definitions), [definitions]);
  const maxDifficultyCount = Math.max(...difficultyStats.map((item) => item.count), 1);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`settings-dialog ${chartVisible || activeView === "rules" ? "settings-dialog-expanded" : ""}`} role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <div><Database size={19} aria-hidden="true" /><h2 id="settings-title">设置</h2></div>
          <button type="button" className="icon-button dialog-close" onClick={onClose} aria-label="关闭设置" title="关闭设置"><X size={20} /></button>
        </header>
        <div className="settings-tabs" role="tablist" aria-label="设置内容">
          <button type="button" id="data-tab" role="tab" aria-selected={activeView === "data"} aria-controls="data-settings-panel" tabIndex={activeView === "data" ? 0 : -1} onClick={() => setActiveView("data")}>
            <Database size={16} aria-hidden="true" />卡牌数据
          </button>
          <button type="button" id="rules-tab" role="tab" aria-selected={activeView === "rules"} aria-controls="basic-rulebook" tabIndex={activeView === "rules" ? 0 : -1} onClick={() => setActiveView("rules")}>
            <BookOpen size={16} aria-hidden="true" />基础规则
          </button>
        </div>
        {activeView === "data" ? <div id="data-settings-panel" role="tabpanel" aria-labelledby="data-tab">
          <div className="data-source-summary">
            <span>当前数据源</span>
            <strong>{source.fileName}</strong>
            <p>{definitions.length} 条定义 · {countCards(definitions)} 张宝物牌</p>
            {source.importedAt && <time dateTime={source.importedAt}>上次导入 {new Date(source.importedAt).toLocaleString("zh-CN")}</time>}
          </div>
          <div className="settings-actions">
            <button type="button" className="primary-action reload-data-button" onClick={() => void reloadBundled()} disabled={loading}>
              <RefreshCw size={18} aria-hidden="true" />重载 CardData.xlsm
            </button>
            <button type="button" className="secondary-action" onClick={() => fileInput.current?.click()} disabled={loading}>
              <Upload size={17} aria-hidden="true" />选择 Excel 文件
            </button>
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              accept=".xlsm,.xlsx,application/vnd.ms-excel.sheet.macroEnabled.12,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void importFile(file);
                event.currentTarget.value = "";
              }}
            />
            <button type="button" className="secondary-action difficulty-chart-button" aria-expanded={chartVisible} aria-controls="difficulty-chart" onClick={() => setChartVisible((visible) => !visible)}>
              <BarChart3 size={17} aria-hidden="true" />{chartVisible ? "收起难度统计" : "查看难度统计"}
            </button>
            <button type="button" className="text-action" onClick={() => void restoreBuiltIn()} disabled={loading || source.type === "built-in"}>
              <RotateCcw size={15} aria-hidden="true" />恢复内置数据
            </button>
          </div>
          {chartVisible && <section id="difficulty-chart" className="difficulty-chart" aria-label="牌库难度统计">
            <div className="difficulty-chart-heading">
              <strong>难度分布</strong>
              <span>柱顶为累计占比</span>
            </div>
            <div className="difficulty-chart-scroll">
              <div className="difficulty-bars" style={{ gridTemplateColumns: `repeat(${difficultyStats.length}, minmax(26px, 1fr))`, minWidth: `${Math.max(difficultyStats.length * 36, 280)}px` }}>
                {difficultyStats.map((item) => <div className="difficulty-column" key={item.difficulty} data-difficulty={item.difficulty} role="img" aria-label={`难度 ${item.difficulty}，${item.count} 张，小于等于该难度占 ${item.cumulativePercentage}%`}>
                  <span className="difficulty-percentage">{item.cumulativePercentage}%</span>
                  <div className="difficulty-bar-track">
                    <div className="difficulty-bar" style={{ height: `${Math.max((item.count / maxDifficultyCount) * 100, 6)}%` }}><span>{item.count}</span></div>
                  </div>
                  <span className="difficulty-label">{item.difficulty}</span>
                </div>)}
              </div>
            </div>
          </section>}
          {message && <p className={`data-message data-message-${status}`} role={status === "error" ? "alert" : "status"}>{message}</p>}
          <p className="settings-note">导入成功后会保存到此浏览器，并使用当前种子重新开始牌局。</p>
        </div> : <section id="basic-rulebook" className="rulebook-panel" role="tabpanel" aria-labelledby="rules-tab">
          <header className="rulebook-heading">
            <BookOpen size={20} aria-hidden="true" />
            <div><h3>基础规则</h3><p>单人炼金流程概览</p></div>
          </header>
          <ol className="rulebook-steps">
            <li><strong>目标</strong><p>通过多轮合成获取宝物；第三阶段结束时，按持有的稀有宝物计算终局总分。</p></li>
            <li><strong>选择材料</strong><p>每次合成先选择 4 张手牌作为初始材料。材料效果可能提高本次可加入的牌数上限。</p></li>
            <li><strong>计算总分</strong><p>合成总分由材料卡面分、材料效果和当前阶段加分共同决定。效果按 Priority 从小到大结算。</p></li>
            <li><strong>翻开宝物</strong><p>材料的最终有效颜色决定安全额度与风险额度。先结算安全宝物，再逐张决定是否继续翻开风险宝物。</p></li>
            <li><strong>获取与炸锅</strong><p>总分达到难度或满足额外获取条件时获得宝物。风险宝物获取失败会炸锅；第二次炸锅会立即结束本次合成。</p></li>
            <li><strong>阶段与终局</strong><p>阶段提示会推进牌局并重整宝物牌堆。第三次遇到阶段提示时牌局结束并展示终局分数。</p></li>
          </ol>
        </section>}
      </section>
    </div>
  );
}
