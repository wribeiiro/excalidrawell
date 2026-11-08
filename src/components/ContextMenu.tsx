import type { ReactNode } from 'react';
import {
  copySelection,
  deleteSelected,
  duplicateSelected,
  groupSelected,
  layerSelected,
  selectAll,
  toggleLockSelected,
  ungroupSelected,
  zoomToFit,
} from '../store/commands';
import { useStore } from '../store/store';
import { getSelected } from '../scene/selection';

export function ContextMenu() {
  const menu = useStore((s) => s.contextMenu);
  const set = useStore((s) => s.set);
  const elements = useStore((s) => s.elements);
  const selectedIds = useStore((s) => s.selectedIds);
  if (!menu) return null;

  const selected = getSelected(elements, selectedIds);
  const locked = selected.length > 0 && selected.every((el) => el.locked);
  const grouped = selected.some((el) => el.groupId);

  const entry = (label: string, action: () => void, hint?: ReactNode) => (
    <button
      role="menuitem"
      onClick={() => {
        action();
        set({ contextMenu: null });
      }}
    >
      {label}
      {hint && <kbd>{hint}</kbd>}
    </button>
  );

  const left = Math.min(menu.x, window.innerWidth - 230);
  const top = Math.min(menu.y, window.innerHeight - (selected.length ? 360 : 90));

  return (
    <div className="menu context-menu" style={{ left, top }} role="menu">
      {selected.length === 0 ? (
        <>
          {entry('Selecionar tudo', selectAll, 'Ctrl A')}
          {entry('Enquadrar tudo', () => zoomToFit(), 'Shift 1')}
        </>
      ) : (
        <>
          {entry(
            'Copiar',
            () => {
              const text = copySelection();
              if (text) void navigator.clipboard.writeText(text);
            },
            'Ctrl C',
          )}
          {entry('Duplicar', duplicateSelected, 'Ctrl D')}
          {selected.length > 1 && !grouped && entry('Agrupar', groupSelected, 'Ctrl G')}
          {grouped && entry('Desagrupar', ungroupSelected, 'Ctrl ⇧ G')}
          <hr />
          {entry('Trazer para frente', () => layerSelected('front'), 'Ctrl Alt ]')}
          {entry('Avançar', () => layerSelected('forward'), 'Ctrl ]')}
          {entry('Recuar', () => layerSelected('backward'), 'Ctrl [')}
          {entry('Enviar para trás', () => layerSelected('back'), 'Ctrl Alt [')}
          <hr />
          {entry(locked ? 'Destravar' : 'Travar', toggleLockSelected, 'Ctrl ⇧ L')}
          {entry('Excluir', deleteSelected, 'Del')}
        </>
      )}
    </div>
  );
}
