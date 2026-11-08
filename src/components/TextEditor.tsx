import { useEffect, useRef } from 'react';
import { isShape } from '../model/types';
import { FONT_STACKS, labelWidth, LINE_HEIGHT, wrapLines } from '../render/text';
import { finishEditing, updateEditingText } from '../store/commands';
import { useStore } from '../store/store';

/** Textarea sobreposto ao canvas, alinhado ao elemento em edição. */
export function TextEditor() {
  const editing = useStore((s) => s.editing);
  const element = useStore((s) =>
    s.editing ? s.elements.find((el) => el.id === s.editing?.id) : undefined,
  );
  const viewport = useStore((s) => s.viewport);
  const theme = useStore((s) => s.theme);
  const ref = useRef<HTMLTextAreaElement>(null);
  const editingId = editing?.id;

  useEffect(() => {
    if (!editingId) return;
    // Aguarda o mousedown do canvas terminar, senão o foco volta para ele.
    const frame = requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [editingId]);

  if (!editing || !element || (element.type !== 'text' && !isShape(element))) return null;

  const { zoom, scrollX, scrollY } = viewport;
  const value = element.type === 'text' ? element.text : element.label;
  const lh = element.fontSize * LINE_HEIGHT;
  let x = element.x;
  let y = element.y;
  let width = element.width + element.fontSize;
  let height = element.height;
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;

  if (isShape(element)) {
    width = labelWidth(element);
    const lines = wrapLines(value || ' ', element.fontSize, element.fontFamily, width).length;
    height = lines * lh;
    x = cx - width / 2;
    y = cy - height / 2;
  } else if (element.textAlign === 'center') {
    x -= element.fontSize / 2;
  } else if (element.textAlign === 'right') {
    x -= element.fontSize;
  }

  const color =
    theme === 'dark' ? `color-mix(in srgb, ${element.strokeColor}, white 75%)` : element.strokeColor;

  return (
    <textarea
      ref={ref}
      className="text-editor"
      aria-label="Editar texto"
      value={value}
      spellCheck={false}
      wrap={isShape(element) ? 'soft' : 'off'}
      onChange={(e) => updateEditingText(e.target.value)}
      onBlur={finishEditing}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          finishEditing();
        }
      }}
      style={{
        left: (x + scrollX) * zoom,
        top: (y + scrollY) * zoom,
        width: width * zoom,
        height: height * zoom,
        fontSize: element.fontSize * zoom,
        lineHeight: LINE_HEIGHT,
        fontFamily: FONT_STACKS[element.fontFamily],
        textAlign: element.textAlign,
        color,
        opacity: element.opacity / 100,
        transform: element.angle ? `rotate(${element.angle}rad)` : undefined,
        transformOrigin: `${(cx - x) * zoom}px ${(cy - y) * zoom}px`,
      }}
    />
  );
}
