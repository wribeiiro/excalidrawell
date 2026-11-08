import { useEffect, useMemo, useState } from 'react';
import { canvasToBlob, exportToCanvas, exportToSvg } from '../io/export';
import { downloadBlob } from '../io/file';
import { showToast, useStore } from '../store/store';
import { getSelected } from '../scene/selection';
import { Dialog } from './Dialogs';

export function ExportDialog() {
  const allElements = useStore((s) => s.elements);
  const files = useStore((s) => s.files);
  const selectedIds = useStore((s) => s.selectedIds);
  const hasSelection = selectedIds.size > 0;
  const [onlySelected, setOnlySelected] = useState(hasSelection);
  const [background, setBackground] = useState(true);
  const [scale, setScale] = useState(2);
  const [preview, setPreview] = useState<string | null>(null);

  const elements = useMemo(
    () => (onlySelected && hasSelection ? getSelected(allElements, selectedIds) : allElements),
    [onlySelected, hasSelection, allElements, selectedIds],
  );
  const options = { background, scale };

  useEffect(() => {
    let live = true;
    void exportToCanvas(elements, files, { background, scale: 1 }).then((canvas) => {
      if (live) setPreview(elements.length ? canvas.toDataURL('image/png') : null);
    });
    return () => {
      live = false;
    };
  }, [elements, files, background]);

  const png = async () => {
    const canvas = await exportToCanvas(elements, files, options);
    downloadBlob(await canvasToBlob(canvas), 'quadro.png');
  };
  const svg = async () => {
    const text = await exportToSvg(elements, files, options);
    downloadBlob(new Blob([text], { type: 'image/svg+xml' }), 'quadro.svg');
  };
  const copy = async () => {
    try {
      const canvas = await exportToCanvas(elements, files, options);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasToBlob(canvas) })]);
      showToast('Imagem copiada.');
    } catch {
      showToast('O navegador bloqueou a cópia. Baixe o PNG.');
    }
  };

  const empty = elements.length === 0;
  return (
    <Dialog title="Exportar imagem" wide>
      <div className="export">
        <div className={background ? 'preview' : 'preview checker'}>
          {preview ? <img src={preview} alt="Prévia da exportação" /> : <p>Desenhe algo para exportar.</p>}
        </div>
        <div className="export-options">
          {hasSelection && (
            <label>
              <input type="checkbox" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} />
              Somente a seleção
            </label>
          )}
          <label>
            <input type="checkbox" checked={background} onChange={(e) => setBackground(e.target.checked)} />
            Fundo branco
          </label>
          <fieldset>
            <legend>Escala do PNG</legend>
            {[1, 2, 3].map((value) => (
              <label key={value}>
                <input type="radio" name="scale" checked={scale === value} onChange={() => setScale(value)} />
                {value}x
              </label>
            ))}
          </fieldset>
          <div className="export-actions">
            <button className="btn primary" disabled={empty} onClick={png}>
              Baixar PNG
            </button>
            <button className="btn" disabled={empty} onClick={svg}>
              Baixar SVG
            </button>
            <button className="btn" disabled={empty} onClick={copy}>
              Copiar PNG
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
