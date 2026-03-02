# finances-app

Monorepo base do projeto de financas pessoais descrito no PRD.

## Estrutura

- `docs/`: documentacao de produto, arquitetura e decisoes
- `scripts/`: automacoes locais de desenvolvimento e verificacao
- `infra/`: ativos compartilhados de infraestrutura, instaladores e icones
- `packages/`: codigo da aplicacao separado por fronteiras explicitas

## Pacotes

- `packages/shared`: contratos compartilhados, tipos e schemas
- `packages/backend`: backend e regras de negocio
- `packages/frontend`: interface React compartilhada entre desktop e acesso mobile LAN
- `packages/desktop`: shell desktop baseado em Tauri

Os arquivos `docs/prd.md` e `docs/frontend-guidelines.md` permanecem como fonte inicial de referencia.
