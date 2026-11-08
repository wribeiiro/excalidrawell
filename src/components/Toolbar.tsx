import {
  ArrowUpRight,
  Circle,
  Diamond,
  Eraser,
  Hand,
  ImagePlus,
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

const TOOLS: { tool: Tool; icon: LucideIcon; label: string; key: string }[] = [
  { tool: 'hand', icon: Hand, label: 'Mover o quadro', key: 'H' },
  { tool: 'select', icon: MousePointer2, label: 'Selecionar', key: 'V' },
  { tool: 'rectangle', icon: Square, label: 'Retângulo', key: 'R' },
  { tool: 'diamond', icon: Diamond, label: 'Losango', key: 'D' },
  { tool: 'ellipse', icon: Circle, label: 'Elipse', key: 'O' },
  { tool: 'arrow', icon: ArrowUpRight, label: 'Seta', key: 'A' },
  { tool: 'line', icon: Minus, label: 'Linha', key: 'L' },
  { tool: 'freedraw', icon: Pencil, label: 'Desenho livre', key: 'P' },
  { tool: 'text', icon: Type, label: 'Texto', key: 'T' },
  { tool: 'eraser', icon: Eraser, label: 'Borracha', key: 'E' },
];

export function Toolbar() {
  const current = useStore((s) => s.tool);
  const locked = useStore((s) => s.toolLocked);
  const setTool = useStore((s) => s.setTool);
  const set = useStore((s) => s.set);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav className="rail" aria-label="Ferramentas">
        <button
          className="rail-btn"
          aria-label="Menu"
          aria-expanded={menuOpen}
          title="Menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Menu size={20} />
        </button>
        <span className="rail-gap" />
        {TOOLS.map(({ tool, icon: Icon, label, key }) => (
          <button
            key={tool}
            className="rail-btn"
            aria-label={label}
            aria-pressed={current === tool}
            title={`${label} (${key})`}
            onClick={() => setTool(tool)}
          >
            <Icon size={20} />
          </button>
        ))}
        <button className="rail-btn" aria-label="Inserir imagem" title="Inserir imagem (I)" onClick={pickImage}>
          <ImagePlus size={20} />
        </button>
        <span className="rail-gap" />
        <button
          className="rail-btn"
          aria-label="Manter ferramenta ativa"
          aria-pressed={locked}
          title="Manter ferramenta ativa depois de desenhar (Q)"
          onClick={() => set({ toolLocked: !locked })}
        >
          {locked ? <Lock size={18} /> : <LockOpen size={18} />}
        </button>
      </nav>
      {menuOpen && <MainMenu onClose={() => setMenuOpen(false)} />}
    </>
  );
}
