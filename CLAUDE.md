# Excalidrawell

Whiteboard estilo Excalidraw. Hoje é só frontend (React 19 + TypeScript + Vite). Backend planejado em `docs/STACK.md`, fases em `docs/ROADMAP.md`.

## Comandos

```bash
npm run dev         # servidor local
npm test            # Vitest (testes em src/**/*.test.ts, ambiente node)
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + build de produção
```

Antes de concluir uma mudança: `npm test && npm run build`. Mudança de interação ou desenho também exige testar no navegador (agente `browser-qa`); testes unitários não cobrem canvas.

## Mapa do código

| Pasta | Responsabilidade |
| --- | --- |
| `src/model` | Tipos de elementos e fábricas. `types.ts` é a referência do formato |
| `src/math` | Geometria e hit test, funções puras |
| `src/scene` | Regras puras sobre elementos: transformar, ligar setas, alinhar, camadas, seleção |
| `src/store` | `store.ts` (Zustand e histórico), `commands.ts` (ações do usuário) |
| `src/interaction` | `controller.ts` (máquina de estados do ponteiro), `keyboard.ts` (atalhos, clipboard) |
| `src/render` | Desenho em canvas: `renderScene` (elementos), `renderOverlay` (seleção) |
| `src/io` | Arquivo, exportação, IndexedDB, validação de dados externos |
| `src/components` | UI em React |

Fluxo: evento → `controller` → `setElements` durante o gesto → `commit` ao soltar. O `Canvas` assina a store e redesenha em `requestAnimationFrame`, sem passar pelo React.

## Invariantes

Quebrar qualquer um destes causa bugs difíceis de ver:

- **Elementos são imutáveis.** Sempre crie um objeto novo. Render, histórico e a futura sincronização comparam por referência.
- **`commit()` define um passo de desfazer.** Chame uma vez por ação do usuário, nunca a cada `pointermove`. Gesto cancelado usa `revert()`.
- **Linhas e setas têm `angle === 0` e `points[0] === [0, 0]`.** Rotação é gravada nos pontos. Use `withAbsolutePoints` para alterar pontos.
- **Traço livre fica normalizado na caixa** (`withFreedrawPoints`).
- **Após mover ou alterar uma forma, chame `updateBindings`** com os ids alterados, para as setas ligadas acompanharem.
- **`seed` não muda em edições**, senão o traço “treme”. Só clones recebem semente nova.
- **Dados externos passam por `src/io/scene.ts`** (arquivo, IndexedDB). Só aceita imagens PNG, JPEG, WebP e GIF; SVG é recusado de propósito.
- **Ao adicionar campo num elemento**, atualize `restoreElement` e, se afetar o traço, `signature` em `render/shapes.ts`. Mudança incompatível do formato aumenta `SCHEMA_VERSION`.
- **Estado local por usuário** (seleção, ferramenta, viewport) nunca entra no elemento: é o que permitirá colaboração.

## Convenções

- Interface, mensagens e documentação em português do Brasil; identificadores em inglês.
- Texto de interface em sentence case, nome da ação igual ao longo do fluxo.
- A interface segue o editor do Excalidraw (código aberto, MIT): cores, medidas e fontes em `styles.css` vêm dele. Cores só via variáveis CSS; estado ativo usa `--primary-container`.
- Fontes: Assistant (interface), Excalifont, Nunito e Comic Shanns (canvas). O nome Excalidrawell é mantido e o logotipo do Excalidraw não é usado.
- Atalho novo deve entrar em `keyboard.ts` e na lista de `components/Dialogs.tsx`.
- Regra nova em `scene/` ou `math/` vem com teste em `scene.test.ts`.
