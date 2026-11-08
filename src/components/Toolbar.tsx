import {
  ArrowRight,
  Circle,
  Diamond,
  Eraser,
  Hand,
  Image,
  Lock,
  LockOpen,
  Menu,
  Minus,
  MousePointer2,
  Pencil,
  Square,
  Type,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { pickImage } from '../interaction/keyboard';
import type { Tool } from '../model/types';
import { useStore } from '../store/store';
import { MainMenu } from './MainMenu';

const TOOLS: { tool: Tool; icon: LucideIcon; label: string; shortcut: string; digit?: string }[] = [
  { tool: 'hand', icon: Hand, label: 'Mover o quadro', shortcut: 'H' },
  { tool: 'select', icon: MousePointer2, label: 'Selecionar', shortcut: 'V ou 1', digit: '1' },
  { tool: 'rectangle', icon: Square, label: 'Retângulo', shortcut: 'R ou 2', digit: '2' },
  { tool: 'diamond', icon: Diamond, label: 'Losango', shortcut: 'D ou 3', digit: '3' },
  { tool: 'ellipse', icon: Circle, label: 'Elipse', shortcut: 'O ou 4', digit: '4' },
  { tool: 'arrow', icon: ArrowRight, label: 'Seta', shortcut: 'A ou 5', digit: '5' },
  { tool: 'line', icon: Minus, label: 'Linha', shortcut: 'L ou 6', digit: '6' },
  { tool: 'freedraw', icon: Pencil, label: 'Desenho livre', shortcut: 'P ou 7', digit: '7' },
  { tool: 'text', icon: Type, label: 'Texto', shortcut: 'T ou 8', digit: '8' },
];

const HINTS: Partial<Record<Tool, string>> = {
  select: 'Para mover o quadro, arraste com a roda do mouse, com a barra de espaço ou com a ferramenta de mão',
  hand: 'Arraste para mover o quadro',
  arrow: 'Clique para criar vários pontos, arraste para uma única seta',
  line: 'Clique para criar vários pontos, arraste para uma única linha',
  freedraw: 'Clique e arraste, solte quando terminar',
  text: 'Clique em qualquer lugar para escrever',
  eraser: 'Clique ou arraste sobre o que quer apagar',
};

export function Toolbar() {
  const current = useStore((s) => s.tool);
  const locked = useStore((s) => s.toolLocked);
  const hasSelection = useStore((s) => s.selectedIds.size > 0);
  const setTool = useStore((s) => s.setTool);
  const set = useStore((s) => s.set);
  const [menuOpen, setMenuOpen] = useState(false);
  const hint = current === 'select' && hasSelection ? undefined : HINTS[current];

  return (
    <>
      <button
        className="square-btn menu-btn"
        aria-label="Menu"
        aria-expanded={menuOpen}
        title="Menu"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <Menu size={16} />
      </button>
      {menuOpen && <MainMenu onClose={() => setMenuOpen(false)} />}

      <div className="toolbar-area">
        <nav className="toolbar island" aria-label="Ferramentas">
          <button
            className="tool-btn"
            aria-label="Manter ferramenta ativa"
            aria-pressed={locked}
            title="Manter ferramenta ativa depois de desenhar (Q)"
            onClick={() => set({ toolLocked: !locked })}
          >
            {locked ? <Lock size={16} /> : <LockOpen size={16} />}
          </button>
          <span className="toolbar-divider" />
          {TOOLS.map(({ tool, icon: Icon, label, shortcut, digit }) => (
            <button
              key={tool}
              className="tool-btn"
              data-tool={tool}
              aria-label={label}
              aria-pressed={current === tool}
              title={`${label} (${shortcut})`}
              onClick={() => setTool(tool)}
            >
              <Icon size={16} />
              {digit && <span className="tool-key">{digit}</span>}
            </button>
          ))}
          <button className="tool-btn" aria-label="Inserir imagem" title="Inserir imagem (I ou 9)" onClick={pickImage}>
            <Image size={16} />
            <span className="tool-key">9</span>
          </button>
          <button
            className="tool-btn"
            data-tool="eraser"
            aria-label="Borracha"
            aria-pressed={current === 'eraser'}
            title="Borracha (E ou 0)"
            onClick={() => setTool('eraser')}
          >
            <Eraser size={16} />
            <span className="tool-key">0</span>
          </button>
        </nav>
        {hint && <p className="tool-hint">{hint}</p>}
      </div>
    </>
  );
}
