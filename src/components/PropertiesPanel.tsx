import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  Group,
  Lock,
  LockOpen,
  Palette,
  Trash2,
  Ungroup,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { Arrowhead, SceneElement, StyleDefaults, Tool } from '../model/types';
import { isLinear, isShape } from '../model/types';
import { FONT_STACKS } from '../render/text';
import {
  alignSelected,
  deleteSelected,
  distributeSelected,
  duplicateSelected,
  groupSelected,
  layerSelected,
  toggleLockSelected,
  ungroupSelected,
} from '../store/commands';
import { useStore } from '../store/store';
import { unitCount } from '../scene/operations';
import { getSelected } from '../scene/selection';

const STROKES = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00'];
const FILLS = ['transparent', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99'];

interface Capabilities {
  fill: boolean;
  stroke: boolean;
  dash: boolean;
  rough: boolean;
  corners: boolean;
  text: boolean;
  heads: boolean;
}

function capabilities(tool: Tool, selected: readonly SceneElement[]): Capabilities {
  const has = (test: (el: SceneElement) => boolean, tools: Tool[]) =>
    selected.length > 0 ? selected.some(test) : tools.includes(tool);
  const shapes: Tool[] = ['rectangle', 'diamond', 'ellipse'];
  const linear: Tool[] = ['line', 'arrow'];
  const roughed = (el: SceneElement) => isShape(el) || isLinear(el);
  return {
    fill: has(isShape, shapes),
    stroke: has((el) => el.type !== 'text' && el.type !== 'image', [...shapes, ...linear, 'freedraw']),
    dash: has(roughed, [...shapes, ...linear]),
    rough: has(roughed, [...shapes, ...linear]),
    corners: has((el) => el.type === 'rectangle' || el.type === 'diamond' || isLinear(el), [
      'rectangle',
      'diamond',
      ...linear,
    ]),
    text: has((el) => el.type === 'text' || (isShape(el) && el.label !== ''), ['text']),
    heads: has((el) => el.type === 'arrow', ['arrow']),
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="field">
      <legend>{label}</legend>
      {children}
    </fieldset>
  );
}

/** Ícone desenhado na grade 20x20, herdando a cor do botão. */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function Choice<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="choice">
      {options.map((option) => (
        <button
          key={String(option.value)}
          aria-label={option.label}
          title={option.label}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}

function Colors({
  value,
  colors,
  onChange,
  name,
}: {
  value: string;
  colors: string[];
  onChange: (value: string) => void;
  name: string;
}) {
  const commit = useStore((s) => s.commit);
  return (
    <div className="colors">
      {colors.map((color) => (
        <button
          key={color}
          className={color === 'transparent' ? 'swatch none' : 'swatch'}
          style={{ background: color === 'transparent' ? undefined : color }}
          aria-label={color === 'transparent' ? `${name}: sem cor` : `${name}: ${color}`}
          title={color === 'transparent' ? 'Sem cor' : color}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
        />
      ))}
      <span className="colors-divider" />
      <label className={value === 'transparent' ? 'current-color none' : 'current-color'} style={{ background: value === 'transparent' ? undefined : value }} title="Outra cor">
        <input
          type="color"
          aria-label={`${name}: outra cor`}
          value={value === 'transparent' ? '#ffffff' : value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={commit}
        />
      </label>
    </div>
  );
}

const lineAt = (width: number, dash?: string) => (
  <Glyph>
    <line x1="4" y1="10" x2="16" y2="10" strokeWidth={width} strokeDasharray={dash} />
  </Glyph>
);

const WIDTHS = [
  { value: 1, label: 'Fino', icon: lineAt(1) },
  { value: 2, label: 'Médio', icon: lineAt(2) },
  { value: 4, label: 'Grosso', icon: lineAt(4) },
];

const DASHES = [
  { value: 'solid' as const, label: 'Contínuo', icon: lineAt(2) },
  { value: 'dashed' as const, label: 'Tracejado', icon: lineAt(2, '3 3.5') },
  { value: 'dotted' as const, label: 'Pontilhado', icon: lineAt(2, '0.5 3') },
];

const wave = 'M3 12c3-5 4-5 7-2s4 2 7-3';
const ROUGHNESS = [
  { value: 0, label: 'Arquiteto', icon: <Glyph><path d={wave} strokeWidth="1.5" /></Glyph> },
  { value: 1, label: 'Artista', icon: <Glyph><path d={wave} strokeWidth="1.5" /><path d="M3 13c3-6 5-4 7-2s4 1 7-3" strokeWidth="1" /></Glyph> },
  { value: 2, label: 'Cartunista', icon: <Glyph><path d={wave} strokeWidth="1.5" /><path d="M3 10c4-3 4-5 7-1s5 3 7-4M4 14c2-6 5-3 7-2s4 0 6-3" strokeWidth="1" /></Glyph> },
];

const CORNERS = [
  { value: 'sharp' as const, label: 'Retas', icon: <Glyph><path d="M4 16V4h12" strokeWidth="1.5" /></Glyph> },
  { value: 'round' as const, label: 'Arredondadas', icon: <Glyph><path d="M4 16V9a5 5 0 0 1 5-5h7" strokeWidth="1.5" /></Glyph> },
];

const box = <rect x="3.5" y="3.5" width="13" height="13" rx="2" strokeWidth="1.5" />;
const FILL_STYLES = [
  { value: 'hachure' as const, label: 'Hachura', icon: <Glyph>{box}<path d="M5 12l7-7M8 15l7-7" strokeWidth="1" /></Glyph> },
  { value: 'cross-hatch' as const, label: 'Hachura cruzada', icon: <Glyph>{box}<path d="M5 12l7-7M8 15l7-7M8 5l7 7M5 8l7 7" strokeWidth="1" /></Glyph> },
  { value: 'solid' as const, label: 'Sólido', icon: <Glyph><rect x="3.5" y="3.5" width="13" height="13" rx="2" strokeWidth="1.5" fill="currentColor" /></Glyph> },
];

const FONTS = [
  { value: 'hand' as const, label: 'Manuscrita' },
  { value: 'sans' as const, label: 'Normal' },
  { value: 'mono' as const, label: 'Código' },
].map((font) => ({
  ...font,
  icon: <span style={{ fontFamily: FONT_STACKS[font.value], fontSize: 15 }}>Aa</span>,
}));

const SIZES = [
  { value: 16, label: 'Pequeno', icon: 'P' },
  { value: 20, label: 'Médio', icon: 'M' },
  { value: 28, label: 'Grande', icon: 'G' },
  { value: 36, label: 'Muito grande', icon: 'GG' },
];

const ALIGNS = [
  { value: 'left' as const, label: 'À esquerda', icon: <AlignLeft size={16} /> },
  { value: 'center' as const, label: 'Ao centro', icon: <AlignCenter size={16} /> },
  { value: 'right' as const, label: 'À direita', icon: <AlignRight size={16} /> },
];

const shaft = <line x1="3" y1="10" x2="15" y2="10" strokeWidth="1.5" />;
const HEADS: { value: Arrowhead; label: string; icon: ReactNode }[] = [
  { value: 'none', label: 'Sem ponta', icon: <Glyph><line x1="3" y1="10" x2="17" y2="10" strokeWidth="1.5" /></Glyph> },
  { value: 'arrow', label: 'Seta', icon: <Glyph>{shaft}<path d="M11 6l5 4-5 4" strokeWidth="1.5" /></Glyph> },
  { value: 'triangle', label: 'Triângulo', icon: <Glyph>{shaft}<path d="M11 6l6 4-6 4z" fill="currentColor" strokeWidth="1.5" /></Glyph> },
  { value: 'dot', label: 'Círculo', icon: <Glyph>{shaft}<circle cx="14.5" cy="10" r="3" fill="currentColor" strokeWidth="1" /></Glyph> },
  { value: 'bar', label: 'Barra', icon: <Glyph>{shaft}<line x1="15.5" y1="5" x2="15.5" y2="15" strokeWidth="1.5" /></Glyph> },
];

export function PropertiesPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const tool = useStore((s) => s.tool);
  const style = useStore((s) => s.style);
  const elements = useStore((s) => s.elements);
  const selectedIds = useStore((s) => s.selectedIds);
  const applyStyle = useStore((s) => s.applyStyle);
  const commit = useStore((s) => s.commit);
  const selected = getSelected(elements, selectedIds);
  const caps = capabilities(tool, selected);
  const visible = selected.length > 0 || Object.values(caps).some(Boolean);
  if (!visible) return null;

  const first = selected[0];
  const value = <K extends keyof StyleDefaults>(key: K): StyleDefaults[K] => {
    const holder = selected.find((el) => key in el) as Partial<StyleDefaults> | undefined;
    return (holder?.[key] ?? style[key]) as StyleDefaults[K];
  };
  const change = (patch: Partial<StyleDefaults>) => {
    applyStyle(patch);
    commit();
  };
  const locked = selected.length > 0 && selected.every((el) => el.locked);
  const grouped = selected.some((el) => el.groupId);
  const units = unitCount(selected);
  const opacity = first?.opacity ?? style.opacity;

  return (
    <>
      <button className="square-btn panel-toggle" aria-expanded={open} aria-label="Estilo" onClick={onToggle}>
        <Palette size={16} />
      </button>
      <aside className={open ? 'panel island open' : 'panel island'} aria-label="Estilo">
        {(caps.stroke || caps.text) && (
          <Field label="Contorno">
            <Colors name="Contorno" value={value('strokeColor')} colors={STROKES} onChange={(strokeColor) => change({ strokeColor })} />
          </Field>
        )}
        {caps.fill && (
          <Field label="Fundo">
            <Colors name="Fundo" value={value('backgroundColor')} colors={FILLS} onChange={(backgroundColor) => change({ backgroundColor })} />
          </Field>
        )}
        {caps.fill && value('backgroundColor') !== 'transparent' && (
          <Field label="Preenchimento">
            <Choice value={value('fillStyle')} options={FILL_STYLES} onChange={(fillStyle) => change({ fillStyle })} />
          </Field>
        )}
        {caps.stroke && (
          <Field label="Espessura do traço">
            <Choice value={value('strokeWidth')} options={WIDTHS} onChange={(strokeWidth) => change({ strokeWidth })} />
          </Field>
        )}
        {caps.dash && (
          <Field label="Estilo de traço">
            <Choice value={value('strokeStyle')} options={DASHES} onChange={(strokeStyle) => change({ strokeStyle })} />
          </Field>
        )}
        {caps.rough && (
          <Field label="Precisão do traço">
            <Choice value={value('roughness')} options={ROUGHNESS} onChange={(roughness) => change({ roughness })} />
          </Field>
        )}
        {caps.corners && (
          <Field label="Arestas">
            <Choice value={value('roundness')} options={CORNERS} onChange={(roundness) => change({ roundness })} />
          </Field>
        )}
        {caps.heads && (
          <>
            <Field label="Início da seta">
              <Choice value={value('startArrowhead')} options={HEADS} onChange={(startArrowhead) => change({ startArrowhead })} />
            </Field>
            <Field label="Fim da seta">
              <Choice value={value('endArrowhead')} options={HEADS} onChange={(endArrowhead) => change({ endArrowhead })} />
            </Field>
          </>
        )}
        {caps.text && (
          <>
            <Field label="Fonte">
              <Choice value={value('fontFamily')} options={FONTS} onChange={(fontFamily) => change({ fontFamily })} />
            </Field>
            <Field label="Tamanho da fonte">
              <Choice value={value('fontSize')} options={SIZES} onChange={(fontSize) => change({ fontSize })} />
            </Field>
            <Field label="Alinhar texto">
              <Choice value={value('textAlign')} options={ALIGNS} onChange={(textAlign) => change({ textAlign })} />
            </Field>
          </>
        )}
        <Field label="Opacidade">
          <input
            type="range"
            aria-label="Opacidade"
            min={10}
            max={100}
            step={10}
            value={opacity}
            onChange={(e) => applyStyle({ opacity: Number(e.target.value) })}
            onPointerUp={commit}
            onKeyUp={commit}
          />
          <div className="range-labels">
            <span>10</span>
            <span>{opacity}</span>
          </div>
        </Field>

        {selected.length > 0 && (
          <>
            <Field label="Camadas">
              <div className="choice">
                <IconBtn label="Enviar para trás" onClick={() => layerSelected('back')}><ArrowDownToLine size={16} /></IconBtn>
                <IconBtn label="Recuar" onClick={() => layerSelected('backward')}><ArrowDown size={16} /></IconBtn>
                <IconBtn label="Avançar" onClick={() => layerSelected('forward')}><ArrowUp size={16} /></IconBtn>
                <IconBtn label="Trazer para frente" onClick={() => layerSelected('front')}><ArrowUpToLine size={16} /></IconBtn>
              </div>
            </Field>
            {units >= 2 && (
              <Field label="Alinhar">
                <div className="choice">
                  <IconBtn label="À esquerda" onClick={() => alignSelected('left')}><AlignStartVertical size={16} /></IconBtn>
                  <IconBtn label="Centro horizontal" onClick={() => alignSelected('hcenter')}><AlignCenterVertical size={16} /></IconBtn>
                  <IconBtn label="À direita" onClick={() => alignSelected('right')}><AlignEndVertical size={16} /></IconBtn>
                  <IconBtn label="Topo" onClick={() => alignSelected('top')}><AlignStartHorizontal size={16} /></IconBtn>
                  <IconBtn label="Centro vertical" onClick={() => alignSelected('vcenter')}><AlignCenterHorizontal size={16} /></IconBtn>
                  <IconBtn label="Base" onClick={() => alignSelected('bottom')}><AlignEndHorizontal size={16} /></IconBtn>
                  {units >= 3 && (
                    <>
                      <IconBtn label="Distribuir na horizontal" onClick={() => distributeSelected('x')}><AlignHorizontalSpaceAround size={16} /></IconBtn>
                      <IconBtn label="Distribuir na vertical" onClick={() => distributeSelected('y')}><AlignVerticalSpaceAround size={16} /></IconBtn>
                    </>
                  )}
                </div>
              </Field>
            )}
            <Field label="Ações">
              <div className="choice">
                <IconBtn label="Duplicar" onClick={duplicateSelected}><Copy size={16} /></IconBtn>
                <IconBtn label="Excluir" onClick={deleteSelected}><Trash2 size={16} /></IconBtn>
                {selected.length > 1 && !grouped && <IconBtn label="Agrupar" onClick={groupSelected}><Group size={16} /></IconBtn>}
                {grouped && <IconBtn label="Desagrupar" onClick={ungroupSelected}><Ungroup size={16} /></IconBtn>}
                <IconBtn label={locked ? 'Destravar' : 'Travar'} onClick={toggleLockSelected}>{locked ? <LockOpen size={16} /> : <Lock size={16} />}</IconBtn>
              </div>
            </Field>
          </>
        )}
      </aside>
    </>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}
