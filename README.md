# 💰 Finanças App

Aplicação de controle de finanças pessoais para Windows Desktop com acesso mobile via LAN (mesma rede Wi-Fi).

## 📱 Visão Geral

Finanças App é uma aplicação desktop leve para controle pessoal de finanças que:
- Roda no Windows, inicia com o sistema e fica na bandeja (tray)
- Possui interface mobile responsiva acessível apenas na mesma rede Wi-Fi (modo LAN)
- Utiliza arquitetura limpa com Event Store para auditoria completa
- Focado em registro rápido de transações (<10 segundos) e visualização clara

## 🏗️ Arquitetura

### Stack Tecnológico

- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: FastAPI (Python) + SQLAlchemy + Alembic
- **Desktop Shell**: Tauri (usa WebView2 do Windows)
- **Banco de Dados**: SQLite (dual database pattern)
  - `events.db`: Event Store append-only (fonte da verdade)
  - `app.db`: Projeções materializadas para consultas rápidas
- **Empacotamento**: PyInstaller para o backend (sidecar do Tauri)

### Padrões Arquiteturais

- **Clean Architecture/Hexagonal**: Separação clara entre domínio, aplicação, infraestrutura e interfaces
- **Event Sourcing**: Todas as mudanças de estado são capturadas como eventos imutáveis
- **CQRS**: Comandos modificam estado via eventos, consultas leem das projeções
- **Versionamento de Contrato**: `packages/shared/version.txt` controla compatibilidade UI/API

## 📦 Estrutura do Monorepo

```
finances-app/
├── docs/                     # Documentação de produto, arquitetura e decisões
├── scripts/                  # Automações locais de desenvolvimento
├── infra/                    # Ativos compartilhados (instaladores, ícones)
├── packages/                 # Código da aplicação
│   ├── shared/               # Contratos compartilhados, tipos e schemas
│   │   ├── schemas/          # Definições de payload e validação
│   │   ├── types/            # Tipos TypeScript e Python compartilhados
│   │   ├── contracts/        # DTOs e artefatos de validação
│   │   └── version.txt       # Fonte da verdade para versionamento de contrato
│   │
│   ├── backend/              # API FastAPI e regras de negócio
│   │   ├── src/finance_app/
│   │   │   ├── domain/       # Entidades e regras de negócio puras
│   │   │   ├── application/  # Casos de uso (use cases)
│   │   │   ├── infrastructure/ # Repositorios, projetor, segurança
│   │   │   └── interfaces/   # Endpoints FastAPI, CLI
│   │   ├── tests/            # Testes unitários e de integração
│   │   ├── pyproject.toml    # Dependências e scripts do backend
│   │   └── alembic.ini       # Configuração de migrações
│   │
│   ├── frontend/             # Interface React (desktop e mobile LAN)
│   │   ├── src/              # Componentes, páginas, features
│   │   ├── public/           # Assets estáticos
│   │   ├── package.json      # Dependências e scripts do frontend
│   │   └── vite.config.ts    # Configuração do Vite
│   │
│   └── desktop/              # Shell desktop baseado em Tauri
│       ├── src-tauri/        # Código Rust do Tauri
│       │   ├── src/          # Lógica principal (main.rs)
│       │   └── tauri.conf.json # Configuração do Tauri
│       ├── package.json      # Dependências do Tauri
│       └── src/              # Assets específicos do desktop
```

## 🚀 Pacotes e Responsabilidades

### `@finances/shared`
- Contratos de dados compartilhados entre frontend e backend
- Schemas de validação (Zod para frontend, Pydantic para backend)
- Tipos TypeScript e Python sincronizados
- Versionamento explícito via `version.txt`

### `@finances/backend`
- API RESTful com FastAPI
- Implementação dos casos de uso (application layer)
- Acesso ao Event Store e projeções SQLite
- Lógica de negócio pura (camada de domínio)
- Sistema de autenticação e autorização
- Geração de certificados autoassinados para modo LAN
- Scheduler local para geração de pendências

### `@finances/frontend`
- Interface única React consumida tanto pelo desktop quanto pelo mobile
- Responsividade adaptativa (sidebar desktop, bottom nav mobile)
- Estado de UI com Zustand
- Formulários com React Hook Form + Zod
- Visualização de dados com Recharts
- Componentes acessíveis do shadcn/ui
- Temas claro/escuro com paleta de cores financeira

### `@finances/desktop`
- Empacotamento Tauri da aplicação
- Gerenciamento do ciclo de vida do backend (inicialização/parada)
- Integração com bandeja do Windows (tray)
- Auto-inicialização com Windows
- Comunicação IPC entre frontend e backend
- Notificações do sistema

## 🔧 Como Desenvolver

### Pré-requisitos

- Node.js (v18+)
- Python (v3.13+)
- Rust e Cargo (para Tauri)
- UV (instalador de pacotes Python moderno)

### Configuração Inicial

```bash
# Clonar o repositório
git clone https://github.com/seu-usuario/finances-app.git
cd finances-app

# Instalar dependências do frontend
cd packages/frontend
npm install

# Instalar dependências do backend
cd ../backend
uv sync

# Instalar dependências do desktop
cd ../desktop
npm install
```

### Comandos de Desenvolvimento

#### Desenvolvimento Completo (Recomendado)
```bash
# Inicia o desktop (que gerencia frontend + backend)
./scripts/dev.ps1  # PowerShell
# ou
./scripts/dev.sh   # Bash/Linux
```

#### Desenvolvimento Isolado

```bash
# Apenas frontend (Vite dev server)
cd packages/frontend
npm run dev

# Apenas backend (FastAPI com reload)
cd packages/backend
uv run finace  # ou uvicorn finance_app.main:app --reload

# Apenas desktop (Tauri dev)
cd packages/desktop
npm run tauri dev
```

#### Testes

```bash
# Testes frontend (Vitest)
cd packages/frontend
npm run test

# Testes backend (Pytest)
cd packages/backend
uv run pytest
```

#### Build para Produção

```bash
# Build do frontend
cd packages/frontend
npm run build

# Build do desktop (inclui backend empacotado)
cd packages/desktop
npm run tauri build
```

## 🗄️ Persistência de Dados

### Dual Database Pattern

Finanças App utiliza duas bases SQLite separadas:

1. **Event Store (`events.db`)** - Fonte da verdade
   - Append-only, nunca atualiza ou deleta registros
   - Tabela `events` com: `event_id`, `type`, `timestamp`, `payload` (JSON), `version`
   - Garante auditoria completa e capacidade de rebuild
   - Utiliza WAL mode para melhor concorrência

2. **Projeções (`app.db`)** - Visualização otimizada
   - Materializado a partir dos eventos via Projector
   - Pode ser reconstruído a qualquer momento a partir do event store
   - Contém tabelas otimizadas para consultas: `accounts`, `transactions`, `cards`, `invoices`, etc.
   - Tabela `event_cursor` rastreia o último evento processado

### Benefícios dessa abordagem

- **Auditabilidade Completa**: Todo cambio é registrado como evento imutável
- **Recuperação Fácil**: Reconstruir o estado aplicando todos os eventos
- **Backup Seguro**: Apenas fazer backup do `events.db` é suficiente
- **Evolução Segura**: Mudanças de schema podem ser tratadas via upcasting de eventos
- **Performance**: Consultas rápidas nas projeções materializadas

## 🔐 Segurança

### Autenticação

- **Desktop**: Senha local com hash Argon2
- **Mobile LAN**: 
  - `pair_token` temporário (expira em 2-5 min) para pareamento inicial
  - `device_token` persistente para sessões subsequentes
  - Opcional: senha por sessão no mobile

### Proteções LAN

- Acesso restrito à mesma sub-rede Wi-Fi
- Bloqueio de IPs fora de faixas privadas (RFC 1918)
- Validação de header `Origin` contra lista de permissões
- Header custom `X-Finance-Token` obrigatório para requests (proteção CSRF)
- Certificado autoassinado para HTTPS local (necessário para PWA/service workers)

### Outros

- Nenhum dado sensível armazenado em texto plano
- Tokens armazenados de forma segura (Keyring do SO, HttpOnly cookies quando aplicável)
- Logs sensíveis são filtrados ou evitados

## 📱 Funcionalidades Principais

### ✅ Implementadas (v1)

- **Registro Rápido**: Lançar gastos em <10 segundos
- **Contas Múltiplas**: Suporte a várias contas (corrente, poupança, carteira, etc.)
- **Transferências Internas**: Movimentação entre contas sem afetar orçamento
- **Cartões de Crédito**:
  - Compra à vista e parcelada
  - Rules fixas de fechamento/vencimento (1-28 para evitar ambiguidade)
  - Faturas por ciclo com status (open, closed, paid, partial)
  - Pagamento de fatura (total ou parcial)
- **Reembolsos**: Marcar transações como "a receber" e gerar entrada PIX automática ao confirmar
- **Gastos Fixos**: Pendências mensais que só afetam o saldo ao serem confirmadas
- **Orçamento por Categoria**: Limites mensais com alertas de estouro
- **Investimentos**: Registro simples de aportes e resgates
- **Relatórios**:
  - Dashboard mensal
  - Tendência semanal
  - Gastos por categoria
  - Compromisso total futuro (parcelamentos pendentes)
- **Modo LAN**: Acesso mobile via mesma rede Wi-Fi com pareamento QR Code
- **Desktop Tray**: Inicia com Windows, fecha para tray, menu com ações rápidas

### 🚧 Planejado (Roadmap)

- Tags/livres em transações (v2)
- Estornos avançados de cartão (v2)
- Cotação automática de investimentos (v2+)
- Integración com Telegram Bot (futuro)
- Agente de IA para insights (futuro)

## 📄 Documentação Adicional

- [PRD.md](PRD.md) - Product Requirements Detalhado
- [FRONTEND-GUIDELINES.md](FRONTEND-GUIDELINES.md) - Diretrizes de UI/UX e implementação frontend
- [docs/architecture.md](docs/architecture.md) - Detalhes técnicos da arquitetura
- [docs/BIGREFACT.md](docs/BIGREFACT.md) - Histórico de grandes refatorações
- [docs/LEDGER-DOMAIN.md](docs/LEDGER-DOMAIN.md) - Modelo de domínio detalhado
- [packages/shared/README.md](packages/shared/README.md) - Detalhes sobre versionamento de contrato
- [packages/backend/README.md](packages/backend/README.md) - Documentação específica do backend
- [packages/frontend/README.md](packages/frontend/README.md) - Documentação específica do frontend
- [packages/desktop/README.md](packages/desktop/README.md) - Documentação específica do desktop

## 🤝 Contribuindo

1. Faça um fork do repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nome-da-feature`)
3. Faça suas mudanças e commit conforme Conventional Commits
4. Push para a branch (`git push origin feature/nome-da-feature`)
5. Abra um Pull Request

### Padrões de Commit

Seguimos a especificação [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - Nova funcionalidade
- `fix:` - Correção de bug
- `docs:` - Alterações na documentação
- `style:` - Formatação, ponto e vírgula, etc. (não afeta o código)
- `refactor:` - Refatoração de código que não corrige bug nem adiciona feature
- `test:` - Adição ou correção de testes
- `chore:` - Alterações no build ou ferramentas auxiliares

Exemplos:
- `feat: adicionar suporte a cartões com bandeira`
- `fix: correção no cálculo de juros parcelados`
- `docs: atualizar README com instruções de desenvolvimento`
- `refactor: simplificar lógica de cálculo de orçamento`

## 📝 Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🙏 Agradecimentos

- Comunidade open source pelas bibliotecas utilizadas
- Tauri pela excelente experiência de desktop leve
- FastAPI pela produtividade no desenvolvimento de APIs Python
- React e ecossistema pela facilidade de criação de interfaces modernas

---

*Finanças App - Controle seus gastos com simplicidade e poder*