import { CircleHelp, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { zoomBy, zoomReset } from '../store/commands';
import { useStore } from '../store/store';

export function BottomControls() {
  const zoom = useStore((s) => s.viewport.zoom);
  const canUndo = useStore((s) => s.past.length > 0 || s.elements !== s.committed);
  const canRedo = useStore((s) => s.future.length > 0);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const set = useStore((s) => s.set);

  return (
    <>
      <div className="bottom-controls">
        <div className="strip">
          <button aria-label="Diminuir zoom" title="Diminuir zoom (Ctrl -)" onClick={() => zoomBy(1 / 1.2)}>
            <Minus size={16} />
          </button>
          <button className="zoom-value" title="Voltar para 100% (Ctrl 0)" onClick={zoomReset}>
            {Math.round(zoom * 100)}%
          </button>
          <button aria-label="Aumentar zoom" title="Aumentar zoom (Ctrl +)" onClick={() => zoomBy(1.2)}>
            <Plus size={16} />
          </button>
        </div>
        <div className="strip">
          <button aria-label="Desfazer" title="Desfazer (Ctrl Z)" disabled={!canUndo} onClick={undo}>
            <Undo2 size={16} />
          </button>
          <button aria-label="Refazer" title="Refazer (Ctrl Shift Z)" disabled={!canRedo} onClick={redo}>
            <Redo2 size={16} />
          </button>
        </div>
      </div>
      <button className="square-btn help-btn" aria-label="Atalhos" title="Atalhos (?)" onClick={() => set({ dialog: 'help' })}>
        <CircleHelp size={16} />
      </button>
    </>
  );
}
