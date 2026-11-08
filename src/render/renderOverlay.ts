import { absolutePoints } from '../model/elements';
import type { Point, SceneElement, Viewport } from '../model/types';
import { isLinear } from '../model/types';
import { getCenter, getElementBounds } from '../math/geometry';
import { getHandles, getSelected, getSelectionFrame, midpoints } from '../scene/selection';

const ACCENT = '#2b50e8';
const HILITE = '#f2b800';

export interface OverlayParams {
  elements: readonly SceneElement[];
  selectedIds: ReadonlySet<string>;
  viewport: Viewport;
  dpr: number;
  marquee: { x: number; y: number; width: number; height: number } | null;
  bindTargetId: string | null;
  showHandles: boolean;
}

function dot(ctx: CanvasRenderingContext2D, [x, y]: Point, r: number, fill: string, lw: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = ACCENT;
  ctx.stroke();
}

function outlineElement(ctx: CanvasRenderingContext2D, el: SceneElement, pad: number) {
  ctx.save();
  const [cx, cy] = getCenter(el);
  ctx.translate(cx, cy);
  ctx.rotate(el.angle);
  const b = isLinear(el) ? getElementBounds(el) : null;
  const w = (b ? b.maxX - b.minX : el.width) + pad * 2;
  const h = (b ? b.maxY - b.minY : el.height) + pad * 2;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

export function renderOverlay(canvas: HTMLCanvasElement, p: OverlayParams): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { zoom, scrollX, scrollY } = p.viewport;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = p.dpr * zoom;
  ctx.setTransform(scale, 0, 0, scale, scale * scrollX, scale * scrollY);
  const px = 1 / zoom;
  const pad = 6 * px;

  if (p.bindTargetId) {
    const target = p.elements.find((el) => el.id === p.bindTargetId);
    if (target) {
      ctx.strokeStyle = HILITE;
      ctx.lineWidth = 3 * px;
      outlineElement(ctx, target, pad);
    }
  }

  const selected = getSelected(p.elements, p.selectedIds);
  if (selected.length > 0) {
    const anyLocked = selected.some((el) => el.locked);
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1.25 * px;
    ctx.setLineDash(anyLocked ? [6 * px, 5 * px] : selected.length > 1 ? [4 * px, 3 * px] : []);
    if (selected.length > 1) for (const el of selected) outlineElement(ctx, el, 2 * px);
    ctx.setLineDash(anyLocked ? [6 * px, 5 * px] : []);

    const frame = getSelectionFrame(selected);
    if (frame) {
      ctx.save();
      ctx.translate(frame.x + frame.width / 2, frame.y + frame.height / 2);
      ctx.rotate(frame.angle);
      ctx.strokeRect(
        -frame.width / 2 - pad,
        -frame.height / 2 - pad,
        frame.width + pad * 2,
        frame.height + pad * 2,
      );
      ctx.restore();
    }
    ctx.setLineDash([]);

    if (p.showHandles && !anyLocked) {
      if (frame) {
        for (const handle of getHandles(frame, zoom, selected)) {
          dot(ctx, handle.point, handle.name === 'rotate' ? 5 * px : 4.5 * px, '#fff', 1.5 * px);
        }
      } else {
        const el = selected[0];
        if (isLinear(el)) {
          const abs = absolutePoints(el);
          for (const point of midpoints(abs)) dot(ctx, point, 3.5 * px, '#dfe5ff', 1 * px);
          for (const point of abs) dot(ctx, point, 5 * px, '#fff', 1.5 * px);
        }
      }
    }
  }

  if (p.marquee) {
    const m = p.marquee;
    ctx.fillStyle = 'rgba(43,80,232,.08)';
    ctx.fillRect(m.x, m.y, m.width, m.height);
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1 * px;
    ctx.strokeRect(m.x, m.y, m.width, m.height);
  }
}
