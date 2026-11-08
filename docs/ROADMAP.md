# Roadmap

Justificativas e alternativas em [STACK.md](STACK.md).

## Fase 0: frontend estático (este PR)

- [x] Ferramentas de desenho, texto e imagem
- [x] Seleção, transformações, grupos, camadas, alinhamento
- [x] Setas conectadas a formas
- [x] Desfazer e refazer
- [x] Zoom, navegação, grade, temas, layout de celular
- [x] Salvamento automático, arquivo próprio, exportação PNG e SVG
- [x] Testes unitários das regras de cena

## Fase 1: acabamento do editor

- [ ] CI no GitHub Actions: typecheck, testes e build
- [ ] ESLint e Prettier
- [ ] Testes de ponta a ponta com Playwright
- [ ] Testar em Safari, Firefox e aparelhos touch reais
- [ ] Deploy estático com preview por PR
- [ ] Inverter seleção na horizontal e na vertical
- [ ] Rótulo em setas
- [ ] Encaixe em guias de alinhamento entre elementos
- [ ] Biblioteca de formas reutilizáveis
- [ ] Laser pointer para apresentações
- [ ] Salvar a cena dentro do PNG exportado, para reabrir depois
- [ ] Internacionalização (extrair textos da interface)
- [ ] Teste de desempenho com milhares de elementos

## Fase 2: contas e quadros na nuvem

- [ ] Decidir: criptografia de ponta a ponta ou não (ver STACK.md)
- [ ] Projeto Supabase e migrações versionadas no repositório
- [ ] Tabelas `profiles`, `boards`, `board_members` com RLS
- [ ] Login com Google, GitHub e link mágico
- [ ] Rotas: `/`, `/b/:id`, entrar
- [ ] Tela “Meus quadros”: criar, renomear, excluir, miniatura
- [ ] Importar para a conta o quadro salvo no navegador
- [ ] Modo anônimo continua funcionando sem conta
- [ ] Imagens no Storage, com id por hash do conteúdo
- [ ] Limites de tamanho e tipo de arquivo no servidor
- [ ] Exclusão de conta e exportação de dados (LGPD)

## Fase 3: colaboração ao vivo

Preparar o modelo:

- [ ] Trocar a ordem por posição no array por `index` fracionário
- [ ] Migração de formato com `SCHEMA_VERSION` 2

Infraestrutura:

- [ ] Worker com um Durable Object por quadro (`y-partyserver`)
- [ ] Persistência do `Y.Doc` no SQLite do objeto
- [ ] Hibernação de WebSocket confirmada em teste
- [ ] Ticket de conexão de curta duração e checagem de permissão
- [ ] Limite de tamanho de mensagem e de conexões por sala

Cliente:

- [ ] Ligação entre `Y.Map` e a store, nos dois sentidos
- [ ] `Y.UndoManager` no lugar do histórico atual
- [ ] Limite de frequência de envio durante gestos
- [ ] Modo offline com IndexedDB (`y-indexeddb`) e reconexão
- [ ] Indicador de conexão

Presença:

- [ ] Cursores com nome e cor
- [ ] Seleção dos outros participantes
- [ ] Lista de quem está no quadro
- [ ] Seguir a tela de outra pessoa

Compartilhamento:

- [ ] Link com permissão de edição ou leitura, com expiração e revogação
- [ ] Convite por e-mail
- [ ] Papéis: dono, editor, leitor
- [ ] Modo somente leitura no editor

Validação:

- [ ] Teste de convergência com dois clientes em edição simultânea
- [ ] Teste de carga por sala e estimativa de custo real

## Fase 4: produto

- [ ] Comentários ancorados em elementos
- [ ] Histórico de versões com restauração
- [ ] Equipes e pastas
- [ ] Modelos de quadros
- [ ] Modo apresentação
- [ ] Planos pagos e cobrança
- [ ] Métricas de uso e monitoramento de erros
