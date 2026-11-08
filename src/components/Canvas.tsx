import { useEffect, useRef } from 'react';
import type { DragEvent } from 'react';
import { InteractionController } from '../interaction/controller';
import { bindKeyboard } from '../interaction/keyboard';
import { loadSceneFile } from '../io/file';
import type { Point } from '../model/types';
import { renderOverlay } from '../render/renderOverlay';
import { renderScene } from '../render/renderScene';
import { insertImage } from '../store/commands';
import type { Store } from '../store/store';
import { useStore } from '../store/store';

export function Canvas() {
  const sceneRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const cursor = useStore((s) => s.cursor);
  const tool = useStore((s) => s.tool);

  useEffect(() => {
    const scene = sceneRef.current as HTMLCanvasElement;
    const overlay = overlayRef.current as HTMLCanvasElement;
    const controller = new InteractionController(overlay);
    let size = { width: 0, height: 0, dpr: 1 };
    let frame = 0;
    let last: Store | null = null;
    let sizeChanged = true;

    const draw = () => {
      frame = 0;
      const s = useStore.getState();
      const sceneDirty =
        sizeChanged ||
        !last ||
        s.elements !== last.elements ||
        s.viewport !== last.viewport ||
        s.grid !== last.grid ||
        s.theme !== last.theme ||
        s.editing !== last.editing ||
        s.erasing !== last.erasing ||
        s.renderNonce !== last.renderNonce;
      if (sceneDirty) {
        renderScene(scene, {
          elements: s.elements,
          files: s.files,
          viewport: s.viewport,
          width: size.width,
          height: size.height,
          dpr: size.dpr,
          grid: s.grid,
          dark: s.theme === 'dark',
          hideTextOf: s.editing?.id ?? null,
          erasing: s.erasing,
        });
      }
      renderOverlay(overlay, {
        elements: s.elements,
        selectedIds: s.selectedIds,
        viewport: s.viewport,
        dpr: size.dpr,
        marquee: s.marquee,
        bindTargetId: s.bindTargetId,
        showHandles: s.editing === null && s.tool === 'select',
      });
      sizeChanged = false;
      last = s;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    const resize = () => {
      const rect = overlay.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size = { width: rect.width, height: rect.height, dpr };
      for (const canvas of [scene, overlay]) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }
      sizeChanged = true;
      schedule();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(overlay);
    resize();
    const unsubscribe = useStore.subscribe(schedule);
    const unbindKeyboard = bindKeyboard(controller);

    overlay.addEventListener('pointerdown', controller.onPointerDown);
    overlay.addEventListener('pointermove', controller.onPointerMove);
    overlay.addEventListener('pointerup', controller.onPointerUp);
    overlay.addEventListener('pointercancel', controller.onPointerCancel);
    overlay.addEventListener('dblclick', controller.onDoubleClick);
    overlay.addEventListener('contextmenu', controller.onContextMenu);
    overlay.addEventListener('wheel', controller.onWheel, { passive: false });

    return () => {
      observer.disconnect();
      unsubscribe();
      unbindKeyboard();
      if (frame) cancelAnimationFrame(frame);
      overlay.removeEventListener('pointerdown', controller.onPointerDown);
      overlay.removeEventListener('pointermove', controller.onPointerMove);
      overlay.removeEventListener('pointerup', controller.onPointerUp);
      overlay.removeEventListener('pointercancel', controller.onPointerCancel);
      overlay.removeEventListener('dblclick', controller.onDoubleClick);
      overlay.removeEventListener('contextmenu', controller.onContextMenu);
      overlay.removeEventListener('wheel', controller.onWheel);
    };
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const { viewport: v } = useStore.getState();
      const at: Point = [e.clientX / v.zoom - v.scrollX, e.clientY / v.zoom - v.scrollY];
      void insertImage(file, at);
    } else {
      void loadSceneFile(file);
    }
  };

  const crosshair = tool !== 'select' && tool !== 'hand' && cursor === 'default';
  return (
    <div className="stage" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <canvas ref={sceneRef} className="scene" aria-hidden="true" />
      <canvas
        ref={overlayRef}
        className="overlay"
        style={{ cursor: crosshair ? 'crosshair' : cursor }}
        role="application"
        aria-label="Área de desenho"
      />
    </div>
  );
}
