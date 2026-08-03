import { FormEvent, useState } from "react";
import { AlertTriangle, ArrowRight, Flame, Hand, RefreshCw, Settings, Sparkles } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Card } from "./components/Card";
import { DeckControl } from "./components/DeckControl";
import { SettingsDialog } from "./components/SettingsDialog";
import { useGameStore } from "./store/gameStore";

const phaseNames = { 1: "试炼", 2: "淬炼", 3: "终局" } as const;

export default function App() {
  const state = useGameStore(useShallow((store) => ({
    seed: store.seed,
    phase: store.phase,
    hand: store.hand,
    basicDeck: store.basicDeck,
    treasureDeck: store.treasureDeck,
    revealedTreasures: store.revealedTreasures,
    selectedMaterialIds: store.selectedMaterialIds,
    materialLimit: store.materialLimit,
    cauldronExplosions: store.cauldronExplosions,
    status: store.status,
    synthesis: store.synthesis,
    stagePromptVisible: store.stagePromptVisible,
    terminalScore: store.terminalScore,
    startGame: store.startGame,
    toggleMaterial: store.toggleMaterial,
    beginSynthesis: store.beginSynthesis,
    canSynthesize: store.canSynthesize,
    resolveRisk: store.resolveRisk,
    selectRetainedMaterials: store.selectRetainedMaterials,
    advanceStage: store.advanceStage,
    addTopTreasuresToHand: store.addTopTreasuresToHand,
  })));
  const [seedDraft, setSeedDraft] = useState(state.seed);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [retainedDraft, setRetainedDraft] = useState<string[]>([]);
  function handleDeal(event: FormEvent<HTMLFormElement>) { event.preventDefault(); state.startGame(seedDraft); }
  const summary = state.synthesis;
  const riskDecision = summary?.runtime.pendingDecision?.type === "risk-reveal"
    ? summary.runtime.pendingDecision
    : null;
  const retentionDecision = summary?.runtime.pendingDecision?.type === "retain-materials"
    ? summary.runtime.pendingDecision
    : null;
  const canSynthesize = state.canSynthesize();
  const activeMaterials = summary && summary.runtime.step !== "complete" ? summary.materials : [];
  const displayedHand = activeMaterials.length > 0 ? [...activeMaterials, ...state.hand] : state.hand;
  const activeMaterialIds = new Set(activeMaterials.map((card) => card.id));
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block"><div className="brand-seal" aria-hidden="true">炼</div><div><h1>御前炼金所</h1><p>合成流程原型</p></div></div>
        <div className="topbar-tools"><form className="seed-form" onSubmit={handleDeal}><label htmlFor="seed">牌局种子</label><div className="seed-controls"><input id="seed" value={seedDraft} onChange={(event) => setSeedDraft(event.target.value)} /><button type="submit" className="shuffle-button"><RefreshCw size={18} />重新发牌</button></div></form><button type="button" className="icon-button settings-button" aria-label="打开设置" title="设置" onClick={() => setSettingsOpen(true)}><Settings size={21} /></button></div>
      </header>
      <section className="status-rail" aria-label="牌局状态">
        <div><span>当前种子</span><strong data-testid="active-seed">{state.seed}</strong></div>
        <div><span>阶段</span><strong>Phase {state.phase} · {phaseNames[state.phase]}</strong></div>
        <div><span>手牌</span><strong>{state.hand.length}</strong></div>
      </section>
      <div className="workbench">
        <aside className="deck-rail">
          <DeckControl title="基础牌堆" count={state.basicDeck.length} tone="basic" />
          <DeckControl title="宝物牌堆" count={state.treasureDeck.length} tone="treasure" />
        </aside>
        <div className="play-area">
          <section className="play-section" aria-labelledby="hand-heading"><div className="section-heading"><div><Hand size={20} /><h2 id="hand-heading">当前手牌</h2></div><span>{displayedHand.length} 张 · 已选 {state.selectedMaterialIds.length}/{state.materialLimit}</span></div><div className="card-grid hand-grid">{displayedHand.map((card) => { const used = activeMaterialIds.has(card.id); return <Card key={card.id} card={card} selected={state.selectedMaterialIds.includes(card.id)} used={used} onClick={used ? undefined : () => state.toggleMaterial(card.id)} />; })}</div><div className="action-row"><button className="primary-action synthesize-button" disabled={!canSynthesize} onClick={state.beginSynthesis}><Flame size={18} />开始合成</button><span className="action-hint">先选择 4 张初始材料 · 雕像可增加额外材料位</span></div></section>
          {summary && <section className="synthesis-panel" aria-label="本次合成结算">
            <div className="section-heading"><div><Sparkles size={20} /><h2>本次合成</h2></div><span>总分 {summary.score}</span></div>
            <div className="synthesis-stats"><div><strong>{summary.safeQuota}</strong><span>安全额度</span></div><div><strong>{summary.riskResolved}/{summary.riskQuota}</strong><span>已翻开的风险牌数量/最大能翻开的风险牌数量</span></div><div><strong>{summary.gained.length}</strong><span>已获得</span></div><div><strong>{state.cauldronExplosions}/2</strong><span>炸锅</span></div></div>
            {state.status === "risk" && <div className="risk-controls">
              {riskDecision?.preview && <div className="risk-preview" data-testid="risk-preview"><span>银壶预览</span><strong>{riskDecision.preview.name}</strong><small>难度 {riskDecision.preview.difficulty ?? "-"} · 分值 {riskDecision.preview.synthesisScore}</small></div>}
              <div className="risk-warning"><AlertTriangle size={18} /><span>{riskDecision?.forced ? `必须翻完本次 ${summary.riskQuota} 张风险宝物。` : `风险宝物需要逐张决定，最多翻 ${summary.riskQuota} 张。`}</span></div>
              <div className="risk-actions"><button className="primary-action" onClick={() => state.resolveRisk(true)}>{riskDecision?.preview ? "翻开并结算" : "继续翻下一张"} <ArrowRight size={17} /></button><button className="secondary-action" disabled={riskDecision?.forced} onClick={() => state.resolveRisk(false)}>{riskDecision?.preview ? "不翻开并结束" : "停止翻牌"}</button></div>
            </div>}
            {state.status === "retention" && retentionDecision && <div className="risk-controls" data-testid="retention-controls">
              <div className="risk-warning"><Hand size={18} /><span>最多保留 {retentionDecision.count} 张合成材料</span></div>
              <div className="card-grid treasure-grid">{summary.materials.filter((card) => retentionDecision.candidateIds.includes(card.id)).map((card) => <Card key={card.id} card={card} selected={retainedDraft.includes(card.id)} onClick={() => setRetainedDraft((ids) => ids.includes(card.id) ? ids.filter((id) => id !== card.id) : ids.length < retentionDecision.count ? [...ids, card.id] : ids)} />)}</div>
              <div className="risk-actions"><button className="primary-action" onClick={() => { state.selectRetainedMaterials(retainedDraft); setRetainedDraft([]); }}>确认保留 <ArrowRight size={17} /></button></div>
            </div>}
            {state.status === "finished" && state.stagePromptVisible && <div className="stage-prompt"><strong>阶段提示卡：Phase {state.phase} 结算完成</strong><button className="primary-action" onClick={state.advanceStage}>进入下一阶段 <ArrowRight size={17} /></button></div>}
            {state.status === "game-over" && <div className="terminal-banner"><strong>终局完成</strong><span>稀有宝物终局分：{state.terminalScore ?? 0}</span></div>}
          </section>}
          <section className="play-section treasure-section" aria-labelledby="treasure-heading"><div className="section-heading"><div><Sparkles size={20} /><h2 id="treasure-heading">本次翻开的宝物</h2></div><span>{state.revealedTreasures.length} 张</span></div>{state.revealedTreasures.length === 0 ? <div className="empty-treasure" data-testid="empty-treasure"><span aria-hidden="true">◇</span><p>宝物台尚空</p></div> : <div className="card-grid treasure-grid">{state.revealedTreasures.map((card) => <Card key={card.id} card={card} />)}</div>}</section>
        </div>
      </div>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} canCheat={state.status === "idle"} onCheat={() => state.addTopTreasuresToHand(4)} />}
    </main>
  );
}
