# Excalidrawell

Quadro branco com traço feito à mão, direto no navegador, inspirado no [Excalidraw](https://excalidraw.com/). Nesta versão inicial o app é 100% estático: sem backend, sem conta, e o quadro fica salvo no próprio navegador.

## Como rodar

Requer Node 22 ou superior.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Testes unitários (Vitest) |
| `npm run typecheck` | Checagem de tipos |
| `npm run build` | Checa tipos e gera `dist/`, pronto para qualquer hospedagem estática |
| `npm run preview` | Serve o build localmente |

## O que já funciona

**Desenho**
- [x] Retângulo, losango, elipse, seta, linha, desenho livre, texto e imagem
- [x] Linhas e setas de vários pontos, com edição de pontos e curvas
- [x] Setas que se conectam às formas e as acompanham
- [x] Texto dentro de formas, com quebra automática
- [x] Borracha

**Edição**
- [x] Seleção por clique, Shift e área
- [x] Mover, redimensionar e girar, inclusive vários elementos
- [x] Copiar, recortar, colar, duplicar (e Alt + arrastar)
- [x] Agrupar, travar, camadas, alinhar e distribuir
- [x] Desfazer e refazer

**Estilo**
- [x] Cor de traço e fundo, hachura, cruzado ou sólido
- [x] Espessura, linha contínua, tracejada ou pontilhada
- [x] Traçado reto, à mão ou solto; cantos retos ou curvos
- [x] Pontas de seta, opacidade, fonte, tamanho e alinhamento

**Quadro**
- [x] Zoom, navegação e enquadramento, com suporte a pinça no toque
- [x] Grade com encaixe, tema claro e escuro
- [x] Salvamento automático no navegador (IndexedDB)
- [x] Abrir e salvar arquivo `.excalidrawell`
- [x] Exportar PNG e SVG (com fontes embutidas), copiar PNG
- [x] Colar imagens e arrastar arquivos para o quadro
- [x] Layout para celular; atalhos de teclado (aperte `?` no app)

## Próximos passos

- [docs/ROADMAP.md](docs/ROADMAP.md): checklist por fase, de login a colaboração ao vivo
- [docs/STACK.md](docs/STACK.md): stack recomendada para o backend, com alternativas e custos

## Tecnologia

A interface segue o design do editor [Excalidraw](https://github.com/excalidraw/excalidraw) (MIT). As fontes Excalifont e Comic Shanns em `src/fonts` vêm do pacote `@excalidraw/excalidraw`; licenças em [src/fonts/README.md](src/fonts/README.md). Este projeto não é afiliado ao Excalidraw.

React 19, TypeScript e Vite; estado em [Zustand](https://github.com/pmndrs/zustand); traço por [Rough.js](https://roughjs.com/) e [perfect-freehand](https://github.com/steveruizok/perfect-freehand). A arquitetura está descrita em [CLAUDE.md](CLAUDE.md).
