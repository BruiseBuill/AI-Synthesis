interface DeckControlProps {
  title: string;
  count: number;
  tone: "basic" | "treasure";
}

export function DeckControl({
  title,
  count,
  tone,
}: DeckControlProps) {
  return (
    <section className="deck-control" aria-label={title}>
      <div className={`deck-stack deck-stack-${tone}`} aria-hidden="true">
        <span className="deck-mark">炼</span>
      </div>
      <div className="deck-meta">
        <h2>{title}</h2>
        <p><strong>{count}</strong> 张</p>
      </div>
    </section>
  );
}
