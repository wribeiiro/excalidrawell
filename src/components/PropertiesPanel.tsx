import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  Copy,
  Group,
  Lock,
  LockOpen,
  Palette,
  Trash2,
  Ungroup,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { SceneElement, StyleDefaults, Tool } from '../model/types';
import { isLinear, isShape } from '../model/types';
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

const STROKES = ['#16243f', '#c8321f', '#1b8a4b', '#2b50e8', '#b45f06'];
const FILLS = ['transparent', '#ffc9c0', '#b6ecc5', '#c3d2ff', '#ffe58a'];

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
    text: has((el) => el.type === 'text' || isShape(el), ['text', ...shapes]),
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

function Choice<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="choice">
      {options.map((option) => (
        <button
          key={String(option.value)}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
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
          aria-pressed={value === color}
          onClick={() => onChange(color)}
        />
      ))}
      <input
        type="color"
        aria-label={`${name}: outra cor`}
        title="Outra cor"
        value={value === 'transparent' ? '#ffffff' : value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={commit}
      />
    </div>
  );
}

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

  const first = selected[0] as (SceneElement & Partial<StyleDefaults>) | undefined;
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
  const showBoth = caps.stroke || caps.text;

  return (
    <>
      <button className="panel-toggle" aria-expanded={open} aria-label="Estilo" onClick={onToggle}>
        <Palette size={20} />
      </button>
      <aside className={open ? 'panel open' : 'panel'} aria-label="Estilo">
        {showBoth && (
          <Field label="Traço">
            <Colors name="Traço" value={value('strokeColor')} colors={STROKES} onChange={(strokeColor) => change({ strokeColor })} />
          </Field>
        )}
        {caps.fill && (
          <Field label="Fundo">
            <Colors name="Fundo" value={value('backgroundColor')} colors={FILLS} onChange={(backgroundColor) => change({ backgroundColor })} />
          </Field>
        )}
        {caps.fill && value('backgroundColor') !== 'transparent' && (
          <Field label="Preenchimento">
            <Choice
              value={value('fillStyle')}
              onChange={(fillStyle) => change({ fillStyle })}
              options={[
                { value: 'hachure', label: 'Hachura' },
                { value: 'cross-hatch', label: 'Cruzado' },
                { value: 'solid', label: 'Sólido' },
              ]}
            />
          </Field>
        )}
        {caps.stroke && (
          <Field label="Espessura">
            <Choice
              value={value('strokeWidth')}
              onChange={(strokeWidth) => change({ strokeWidth })}
              options={[
                { value: 1, label: 'Fina' },
                { value: 2, label: 'Média' },
                { value: 4, label: 'Grossa' },
              ]}
            />
          </Field>
        )}
        {caps.dash && (
          <Field label="Estilo da linha">
            <Choice
              value={value('strokeStyle')}
              onChange={(strokeStyle) => change({ strokeStyle })}
              options={[
                { value: 'solid', label: 'Contínua' },
                { value: 'dashed', label: 'Tracejada' },
                { value: 'dotted', label: 'Pontilhada' },
              ]}
            />
          </Field>
        )}
        {caps.rough && (
          <Field label="Traçado">
            <Choice
              value={value('roughness')}
              onChange={(roughness) => change({ roughness })}
              options={[
                { value: 0, label: 'Reto' },
                { value: 1, label: 'À mão' },
                { value: 2.5, label: 'Solto' },
              ]}
            />
          </Field>
        )}
        {caps.corners && (
          <Field label="Cantos">
            <Choice
              value={value('roundness')}
              onChange={(roundness) => change({ roundness })}
              options={[
                { value: 'sharp', label: 'Retos' },
                { value: 'round', label: 'Curvos' },
              ]}
            />
          </Field>
        )}
        {caps.heads && (
          <>
            <Field label="Início da seta">
              <select aria-label="Início da seta" value={value('startArrowhead')} onChange={(e) => change({ startArrowhead: e.target.value as StyleDefaults['startArrowhead'] })}>
                <HeadOptions />
              </select>
            </Field>
            <Field label="Fim da seta">
              <select aria-label="Fim da seta" value={value('endArrowhead')} onChange={(e) => change({ endArrowhead: e.target.value as StyleDefaults['endArrowhead'] })}>
                <HeadOptions />
              </select>
            </Field>
          </>
        )}
        {caps.text && (
          <>
            <Field label="Fonte">
              <Choice
                value={value('fontFamily')}
                onChange={(fontFamily) => change({ fontFamily })}
                options={[
                  { value: 'hand', label: 'Manuscrita' },
                  { value: 'sans', label: 'Normal' },
                  { value: 'mono', label: 'Código' },
                ]}
              />
            </Field>
            <Field label="Tamanho">
              <Choice
                value={value('fontSize')}
                onChange={(fontSize) => change({ fontSize })}
                options={[
                  { value: 16, label: 'P' },
                  { value: 24, label: 'M' },
                  { value: 36, label: 'G' },
                  { value: 56, label: 'GG' },
                ]}
              />
            </Field>
            <Field label="Alinhamento">
              <Choice
                value={value('textAlign')}
                onChange={(textAlign) => change({ textAlign })}
                options={[
                  { value: 'left', label: 'Esquerda' },
                  { value: 'center', label: 'Centro' },
                  { value: 'right', label: 'Direita' },
                ]}
              />
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
            value={first?.opacity ?? style.opacity}
            onChange={(e) => applyStyle({ opacity: Number(e.target.value) })}
            onPointerUp={commit}
            onKeyUp={commit}
          />
        </Field>

        {selected.length > 0 && (
          <>
            <Field label="Camadas">
              <div className="icons">
                <IconBtn label="Enviar para trás" onClick={() => layerSelected('back')}><ArrowDownToLine size={16} /></IconBtn>
                <IconBtn label="Recuar" onClick={() => layerSelected('backward')}><ChevronDown size={16} /></IconBtn>
                <IconBtn label="Avançar" onClick={() => layerSelected('forward')}><ChevronUp size={16} /></IconBtn>
                <IconBtn label="Trazer para frente" onClick={() => layerSelected('front')}><ArrowUpToLine size={16} /></IconBtn>
              </div>
            </Field>
            {units >= 2 && (
              <Field label="Alinhar">
                <div className="icons">
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
              <div className="icons">
                <IconBtn label="Duplicar" onClick={duplicateSelected}><Copy size={16} /></IconBtn>
                {selected.length > 1 && !grouped && <IconBtn label="Agrupar" onClick={groupSelected}><Group size={16} /></IconBtn>}
                {grouped && <IconBtn label="Desagrupar" onClick={ungroupSelected}><Ungroup size={16} /></IconBtn>}
                <IconBtn label={locked ? 'Destravar' : 'Travar'} onClick={toggleLockSelected}>{locked ? <LockOpen size={16} /> : <Lock size={16} />}</IconBtn>
                <IconBtn label="Excluir" onClick={deleteSelected}><Trash2 size={16} /></IconBtn>
              </div>
            </Field>
          </>
        )}
      </aside>
    </>
  );
}

function HeadOptions() {
  return (
    <>
      <option value="none">Sem ponta</option>
      <option value="arrow">Seta</option>
      <option value="triangle">Triângulo</option>
      <option value="dot">Círculo</option>
      <option value="bar">Barra</option>
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
