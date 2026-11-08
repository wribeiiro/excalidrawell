import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store/store';

export function Dialog({
  title,
  children,
  wide,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const set = useStore((s) => s.set);
  const close = () => set({ dialog: 'none' });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div className="backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className={wide ? 'dialog wide' : 'dialog'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onKeyDown={(e) => e.key === 'Escape' && close()}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Fechar" onClick={close}>
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

const SHORTCUTS: [string, [string, string][]][] = [
  [
    'Ferramentas',
    [
      ['Selecionar', 'V ou 1'],
      ['Retângulo', 'R ou 2'],
      ['Losango', 'D ou 3'],
      ['Elipse', 'O ou 4'],
      ['Seta', 'A ou 5'],
      ['Linha', 'L ou 6'],
      ['Desenho livre', 'P ou 7'],
      ['Texto', 'T ou 8'],
      ['Imagem', 'I ou 9'],
      ['Borracha', 'E ou 0'],
      ['Mover o quadro', 'H ou espaço'],
      ['Manter ferramenta ativa', 'Q'],
    ],
  ],
  [
    'Edição',
    [
      ['Desfazer', 'Ctrl Z'],
      ['Refazer', 'Ctrl Shift Z'],
      ['Copiar, recortar, colar', 'Ctrl C, X, V'],
      ['Duplicar', 'Ctrl D ou Alt + arrastar'],
      ['Selecionar tudo', 'Ctrl A'],
      ['Agrupar', 'Ctrl G'],
      ['Desagrupar', 'Ctrl Shift G'],
      ['Travar', 'Ctrl Shift L'],
      ['Trazer para frente', 'Ctrl ]'],
      ['Enviar para trás', 'Ctrl ['],
      ['Mover 1 px, 10 px', 'Setas, Shift + setas'],
      ['Editar texto', 'Enter ou clique duplo'],
    ],
  ],
  [
    'Visualização',
    [
      ['Aproximar, afastar', 'Ctrl + rolagem'],
      ['Voltar para 100%', 'Ctrl 0'],
      ['Enquadrar tudo', 'Shift 1'],
      ['Enquadrar seleção', 'Shift 2'],
      ['Grade', "Ctrl '"],
      ['Tema escuro', 'Alt Shift D'],
    ],
  ],
  [
    'Enquanto desenha',
    [
      ['Proporção ou ângulo de 15°', 'Shift'],
      ['Desenhar a partir do centro', 'Alt'],
      ['Linha com vários pontos', 'clique a clique'],
      ['Terminar linha', 'Enter ou Esc'],
      ['Remover ponto da linha', 'clique duplo no ponto'],
    ],
  ],
];

export function HelpDialog() {
  return (
    <Dialog title="Atalhos" wide>
      <div className="shortcuts">
        {SHORTCUTS.map(([section, rows]) => (
          <section key={section}>
            <h3>{section}</h3>
            <dl>
              {rows.map(([action, key]) => (
                <div key={action}>
                  <dt>{action}</dt>
                  <dd>{key}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

export function ConfirmReset() {
  const set = useStore((s) => s.set);
  const count = useStore((s) => s.elements.length);
  const confirm = () => {
    const s = useStore.getState();
    s.setElements([]);
    s.select([]);
    s.commit();
    set({ dialog: 'none' });
  };
  return (
    <Dialog title="Limpar quadro">
      <p className="dialog-text">
        {count === 0
          ? 'O quadro já está vazio.'
          : `Remove ${count === 1 ? '1 elemento' : `${count} elementos`} do quadro. Você pode desfazer com Ctrl Z.`}
      </p>
      <footer>
        <button className="btn" onClick={() => set({ dialog: 'none' })}>
          Cancelar
        </button>
        <button className="btn danger" disabled={count === 0} onClick={confirm}>
          Limpar quadro
        </button>
      </footer>
    </Dialog>
  );
}
