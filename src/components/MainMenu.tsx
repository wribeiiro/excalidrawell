import { FileDown, FolderOpen, Grid3x3, ImageDown, Keyboard, Moon, Sun, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { openSceneFile, saveSceneFile } from '../io/file';
import { toggleGrid, toggleTheme } from '../store/commands';
import { useStore } from '../store/store';

export function MainMenu({ onClose }: { onClose: () => void }) {
  const theme = useStore((s) => s.theme);
  const grid = useStore((s) => s.grid);
  const set = useStore((s) => s.set);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!ref.current?.contains(target) && !target.closest('[aria-label="Menu"]')) onClose();
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [onClose]);

  const item = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <div className="menu main-menu" ref={ref} role="menu">
      <button role="menuitem" onClick={item(openSceneFile)}>
        <FolderOpen size={16} /> Abrir quadro <kbd>Ctrl O</kbd>
      </button>
      <button role="menuitem" onClick={item(saveSceneFile)}>
        <FileDown size={16} /> Salvar em arquivo <kbd>Ctrl S</kbd>
      </button>
      <button role="menuitem" onClick={item(() => set({ dialog: 'export' }))}>
        <ImageDown size={16} /> Exportar imagem <kbd>Ctrl ⇧ E</kbd>
      </button>
      <hr />
      <button role="menuitem" onClick={item(toggleGrid)}>
        <Grid3x3 size={16} /> {grid ? 'Ocultar grade' : 'Mostrar grade'} <kbd>Ctrl '</kbd>
      </button>
      <button role="menuitem" onClick={item(toggleTheme)}>
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        {theme === 'dark' ? 'Tema claro' : 'Tema escuro'} <kbd>Alt ⇧ D</kbd>
      </button>
      <button role="menuitem" onClick={item(() => set({ dialog: 'help' }))}>
        <Keyboard size={16} /> Atalhos <kbd>?</kbd>
      </button>
      <hr />
      <button role="menuitem" className="danger" onClick={item(() => set({ dialog: 'reset' }))}>
        <Trash2 size={16} /> Limpar quadro
      </button>
    </div>
  );
}
