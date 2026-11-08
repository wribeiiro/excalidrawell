import { useStore } from '../store/store';

export function EmptyHint() {
  const empty = useStore((s) => s.elements.length === 0);
  if (!empty) return null;
  return (
    <div className="empty-hint" aria-hidden="true">
      <h1>
        <mark>excalidrawell</mark>
      </h1>
      <p>Escolha uma ferramenta à esquerda e desenhe.</p>
      <p className="empty-keys">
        <kbd>R</kbd> retângulo <kbd>A</kbd> seta <kbd>T</kbd> texto <kbd>?</kbd> todos os atalhos
      </p>
    </div>
  );
}
