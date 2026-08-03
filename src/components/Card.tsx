import { memo } from "react";
import { Gem, Sparkles } from "lucide-react";
import type { GameCard } from "../game-core/cards";

const colorNames = { R: "红", Y: "黄", B: "蓝", W: "白", Special: "稀有" } as const;

interface CardProps {
  card: GameCard;
  selected?: boolean;
  used?: boolean;
  onClick?: () => void;
}

export const Card = memo(function Card({ card, selected = false, used = false, onClick }: CardProps) {
  const isRare = card.kind === "rare";
  return (
    <article
      className={`game-card color-${card.color.toLowerCase()} ${card.resolution ? `resolution-${card.resolution}` : ""}`}
      data-card-id={card.id}
      data-selected={selected}
      data-used={used}
      data-resolution={card.resolution ?? ""}
      data-testid={card.kind === "base" ? "hand-card" : "treasure-card"}
      aria-label={`${colorNames[card.color]}色 ${card.name}`}
      aria-disabled={used || undefined}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => { if (event.key === "Enter" || event.key === " ") onClick(); } : undefined}
    >
      <div className="card-color-bar" aria-hidden="true" />
      {card.resolution && <span className="resolution-label">{card.resolution === "gained" ? "已获得" : card.resolution === "failed" ? "获取失败" : "炸锅损毁"}</span>}
      <header className="card-header">
        <span className="color-name">{colorNames[card.color]}</span>
        {isRare ? <Sparkles size={16} aria-hidden="true" /> : <Gem size={16} aria-hidden="true" />}
      </header>
      <div className="card-title-block">
        <h3>{card.name}</h3>
        <span>{card.kind === "base" ? "基础材料" : isRare ? "稀有宝物" : "宝物"}</span>
      </div>
      <section className={`card-effect ${card.additionalAcquireMethod ? "has-additional-acquire" : ""}`} aria-label="卡牌效果">
        <div><span>效果</span></div>
        <p>{card.effect}</p>
        {card.additionalAcquireMethod ? (
          <div className="additional-acquire-method">
            <span>额外获取</span>
            <p>{card.additionalAcquireMethod}</p>
          </div>
        ) : null}
      </section>
      <dl className="card-stats">
        <div><dt>难度</dt><dd>{card.difficulty ?? "-"}</dd></div>
        <div><dt>合成分</dt><dd>{card.synthesisScore}</dd></div>
      </dl>
    </article>
  );
});
