# PRD — App de Finanças Pessoais (Windows Desktop + Mobile via LAN) — v1.0

## 1. Visão geral

Aplicação pessoal para controle de finanças com foco em:
- **Registro completo de eventos** (compras, PIX, entradas, pagamentos de fatura, ajustes, confirmações etc.)
- **Cartões** (limite, fechamento, vencimento, faturas, parcelamentos)
- **Gastos via PIX/dinheiro**
- **Gastos fixos** (recorrentes) via **pendências** para confirmação
- **Reembolsos/terceiros** (compras no seu cartão que outra pessoa irá pagar)
- **Orçamentos por categoria**
- **Investimentos** (aportes/resgates) para controle básico
- **Visões**: geral + por mês/semana/dia
- **Desktop Windows**: inicia com Windows, fica no tray, leve
- **Mobile**: acesso via navegador **apenas na mesma rede Wi-Fi (modo LAN)**, com UI responsiva e escopo reduzido (essencial)

### Decisão de stack (reduz retrabalho)
- **UI única** em React (desktop e mobile)
- **Desktop shell**: **Tauri** (leve; usa WebView2 do Windows)
- **Backend local**: **FastAPI (Python)** + **SQLite**
- **Clean Architecture/Hexagonal** para facilitar futuro (Telegram/IA) sem duplicar regras

---

## 2. Objetivos

### 2.1 Objetivos de produto
1. Registrar transações em poucos segundos (fricção mínima).
2. Manter rastreabilidade total ("log de eventos").
3. Separar claramente:
   - **Caixa (saldo atual)**: entradas/saídas reais (PIX/dinheiro, pagamento de fatura, reembolsos recebidos)
   - **Cartão (compromissos)**: compras/parcelas alocadas em faturas por ciclo
4. Visualizar rapidamente:
   - gastos por categoria, por período
   - fatura atual e próximas
   - valores "a receber" de terceiros
   - alertas de orçamento estourado
5. Rodar leve no Windows e ficar disponível em segundo plano para integrações futuras.

### 2.2 Não objetivos (v1)
- Multiusuário real / colaboração
- Integração automática com banco/open finance
- Estornos/refunds avançados no cartão (fica para roadmap)
- Investimentos com cotação automática/rentabilidade real-time

---

## 3. Usuário e contexto

- Usuário único: você.
- Uso principal:
  - lançar gasto rapidamente (desktop ou celular)
  - conferir dashboard mensal
  - acompanhar faturas e comprometimento
  - confirmar pendências (fixos)
  - marcar reembolsos como recebidos

---

## 4. Conceitos e regras de negócio

### 4.1 Contas, Caixa vs Cartão e Transferências

#### 4.1.1 Contas (Accounts)
- O sistema suporta múltiplas **contas** (ex: Nubank, Itaú, Carteira Física, Corretora).
- Cada conta possui saldo próprio.
- Na v1 é obrigatório ao menos 1 conta; o usuário pode cadastrar quantas quiser.
- Tabela `accounts`: `id`, `name`, `type` (`checking | savings | wallet | investment | other`), `initial_balance`, `is_active`.

#### 4.1.2 Caixa vs Cartão
- **Caixa (contas)** altera saldo quando acontece:
  - entrada (salário, PIX recebido, reembolso recebido)
  - saída (PIX pago, dinheiro, pagamento de fatura)
- **Cartão** registra consumo (compromisso):
  - compra no cartão entra na fatura do ciclo correspondente
  - parcelamento distribui parcelas nas faturas futuras
- **Pagamento de fatura**:
  - cria uma saída na **conta de origem** (normalmente PIX)
  - marca fatura como paga (total/parcial)
  - reduz comprometimento futuro

#### 4.1.3 Transferências internas
- Movimentação entre contas (ex: Nubank → XP, saque para carteira) é uma **transferência**, não receita nem despesa.
- Transferência **não afeta** orçamento nem relatórios de receita/despesa.
- Campos: `from_account_id`, `to_account_id`, `amount`, `occurred_at`, `description`.
- Gera dois lançamentos internos (débito na origem, crédito no destino) vinculados pelo mesmo `transfer_id`.

### 4.2 Orçamento por categoria
- Orçamento é avaliado por **data do consumo**:
  - PIX/dinheiro: data do gasto
  - cartão: data da compra (não a data do pagamento da fatura)
- Exibir status: `gasto_atual` vs `limite_mensal`.
- Alertas visuais quando exceder.

#### Decisão: parcelamentos e orçamento
- **Orçamento mensal considera o valor da parcela do mês**, não o valor total da compra.
  - Exemplo: iPhone R$ 6.000 em 12x → R$ 500/mês impacta o orçamento de cada mês.
- **Compromisso total assumido** (valor integral de todas as parcelas futuras) é exibido em view separada nos relatórios (seção 5.8), mas **não** estoura o orçamento mensal.

### 4.3 Gastos fixos (recorrentes)
- Fixos geram **pendências** (não lançam automaticamente como transação).
- Você confirma a pendência para virar transação real.
- Regra de data:
  - data "contábil" da transação = **data de vencimento** do fixo
  - confirmação só muda status (evita distorcer orçamento por atraso de clique)

### 4.4 Reembolso / "Terceiro paga"
- Uma transação (tipicamente cartão) pode ser marcada como:
  - `responsavel = pessoa`
  - `status_reembolso = pendente`
- Ao marcar "Recebido":
  - gera **entrada automática via PIX**
  - vincula a entrada à transação original
  - **somente então** afeta o saldo do caixa

### 4.5 Saldo inicial / ajustes
- O app mantém um "estado de saldo" **por conta** para inicialização e correções.
- Ajustes devem ser feitos via **evento de ajuste** (auditável), não "editando" saldo sem rastreio.

### 4.6 Timezone e locale
- Todos os timestamps são armazenados em **UTC ISO 8601** (ex: `2026-03-15T18:30:00Z`).
- Exibição na UI usa o **timezone do sistema operacional**.
- Eventos gerados em viagem registram o UTC real; o dashboard "mensal" é calculado no timezone local configurado.

---

## 5. Escopo funcional (features)

### 5.1 Categorias/Labels (CRUD)
**Requisitos**
- Criar, editar, arquivar (não apagar se houver transações vinculadas)
- Atributos: nome, opcional cor/ícone
- Categoria obrigatória em transações

**Critérios de aceitação**
- Não permitir remover categoria usada; deve arquivar.
- Autocomplete na seleção.

---

### 5.2 Transações (Entrada/Saída) — PIX/Dinheiro/Outros
**Campos mínimos**
- `id`
- `occurred_at` (data/hora, UTC ISO 8601)
- `type`: `income | expense | transfer`
- `amount`
- `account_id` (conta de origem/destino)
- `payment_method`: `PIX | CASH | OTHER` (+ `CARD:<id>` para cartão)
- `category_id`
- `description` (opcional)
- `person_id` (opcional; para reembolso)
- `status`: `active | voided` (soft-delete/estorno simples)
- `transfer_id` (opcional; vincula débito/crédito de transferência)

> **Nota sobre tags:** Tags (labels livres) ficam no **roadmap** (v2). Na v1, categorias + descrição são suficientes para filtro e organização. Evita criar CRUD, filtro e indexação extras sem necessidade imediata.

**Ações**
- Criar, editar, "estornar" (void) mantendo histórico
- Listagem com filtros por período, categoria, método, pessoa, conta

**Critérios de aceitação**
- Criar transação em <10s via tela rápida.
- Edição atualiza projeções (dash/relatórios).
- Transferências entre contas não aparecem como receita/despesa nos relatórios.

---

### 5.3 Cartões
**Cadastro**
- `name`
- `limit`
- `closing_day` (dia do mês, 1–28; ver regra abaixo)
- `due_day` (dia do mês, 1–28; ver regra abaixo)
- `payment_account_id` (conta padrão para pagamento da fatura)

**Compra no cartão**
- Campos:
  - `purchase_date`
  - `amount`
  - `category_id`
  - `card_id`
  - `description`
  - opcional `installments_count`
- Regra: alocar em fatura correta com base em `closing_day`.

**Regras de ciclo e datas de cartão (decisão travada)**
- `closing_day` e `due_day` aceitam valores de **1 a 28** (evita ambiguidade com meses de 29/30/31 dias).
- O ciclo de uma fatura vai de `closing_day` do mês anterior (exclusive) até `closing_day` do mês atual (inclusive).
- **Compra no dia do fechamento** → entra na fatura **atual** (intervalo inclui o dia do fechamento).
- **Exemplo prático:**
  - Cartão com `closing_day = 10`, `due_day = 20`.
  - Compra em 15/mar → fatura abr (ciclo 11/mar–10/abr), vence 20/abr.
  - Compra em 10/mar → fatura mar (ciclo 11/fev–10/mar), vence 20/mar.
  - Compra em 11/mar → fatura abr (ciclo 11/mar–10/abr), vence 20/abr.
- **Fatura com valor zero** → não é gerada (skip silencioso).

**Parcelamentos**
- Parcelas iguais no v1 (valor total / número de parcelas, arredondado; diferença de centavos vai na última parcela).
- Gera parcelas e vincula cada parcela a uma fatura futura.

**Faturas**
- Ciclo: (fechamento anterior, fechamento atual]
- Status: `open | closed | paid | partial`
- Exibir: total, itens, pagamentos
- Pagamento parcial na v1: **permitido**, mas sem rotativo/juros. O saldo restante permanece como `partial` até pagamento complementar.

**Pagamento de fatura**
- Criar evento de pagamento:
  - saída na **conta de origem** (padrão: `payment_account_id` do cartão)
  - valor pago (total/parcial)
  - data do pagamento

**Critérios de aceitação**
- Compra aparece na fatura correta do cartão (conforme regras de ciclo acima).
- Parcelado distribui automaticamente.
- Pagar fatura reduz saldo da conta e marca status corretamente.
- Compra no dia do fechamento entra na fatura atual.

---

### 5.4 Reembolsos (A Receber)
**Tela "A receber"**
- Lista por pessoa:
  - total pendente
  - itens pendentes
- Ação: "Marcar recebido"
  - gera entrada PIX automática vinculada

**Critérios de aceitação**
- Reembolso pendente não entra no saldo.
- Ao marcar recebido, entrada aparece nas transações e altera saldo.

---

### 5.5 Gastos Fixos (Recorrentes)
**Cadastro de fixo**
- `name`, `amount`, `frequency` (mensal no MVP), `due_day`
- `payment_method`
- `category_id`
- `account_id` (conta de pagamento)

**Pendências**
- Gera pendências do mês automaticamente (scheduler local)
- Você confirma para virar transação

**Critérios de aceitação**
- Pendência não impacta saldo até confirmar.
- Ao confirmar, cria transação com data de vencimento.

---

### 5.6 Orçamentos por categoria
- Criar limite mensal por categoria (ex: Lazer = 800)
- Dashboard e tela dedicada:
  - consumo do mês
  - percentual
  - alertas

**Critérios de aceitação**
- Alertar ao exceder.
- Considerar compras no cartão pela data da compra.

---

### 5.7 Investimentos (MVP)
- Registro:
  - `investment_income` (resgate)
  - `investment_expense` (aporte)
- Campos: data, valor, descrição (ativo/corretora)

**Visões**
- Total aportado no mês / acumulado
- Total resgatado no mês / acumulado

**Critérios de aceitação**
- Lançamentos aparecem em relatórios e não quebram orçamento (via categoria específica).

---

### 5.8 Relatórios e Visões
**Filtros globais**
- período (dia/semana/mês/custom)
- categoria
- conta (account)
- método (PIX, dinheiro, cartão X)
- pessoa (reembolso)
- texto (descrição)

**Visualizações**
- Dashboard do mês
- Tendência semanal (barras)
- Gastos por categoria (top N)
- Cartões: fatura atual e futuras (comprometimento)
- **Compromisso total futuro** (soma de todas as parcelas pendentes de parcelamentos ativos)

---

## 6. UX / UI

### 6.1 Desktop (completo)
- Dashboard
- Transações (lista + filtros + edição)
- Contas (saldo por conta, transferências)
- Cartões (faturas, parcelamentos, pagar fatura)
- Fixos (cadastro + pendências)
- Reembolsos (A receber)
- Orçamentos
- Investimentos
- Configurações (senha, LAN, categorias, contas, backup)

### 6.2 Mobile (responsivo — essencial)
**Must-have**
- Adicionar transação rápida (home)
- Dashboard resumido
- Transações (lista + filtro básico)
- Cartões (fatura atual + pagar fatura)
- Pendências (fixos) + confirmar
- Reembolsos (a receber) + marcar recebido

**Desktop-only (v1)**
- CRUD avançado de categorias
- Gestão de contas (accounts)
- Relatórios "pesados"
- Configurações críticas (LAN/pareamento/backup)

---

## 7. Desktop behavior (Windows)

### 7.1 Tray / segundo plano
- Fechar no X → minimiza para tray (não encerra).
- Menu tray:
  - Abrir
  - Adicionar gasto rápido
  - Bloquear (lock)
  - Sair (encerra)

### 7.2 Auto start
- App inicia com Windows.
- Backend local sobe junto (ou no primeiro uso).

### 7.3 Metas de performance
- Idle CPU ~0% (sem loops ativos)
- RAM alvo (média): 150–300MB (Tauri + backend Python depende do footprint)
- Inicialização: < 3s para UI pronta (alvo)

---

## 8. Modo LAN (acesso pelo celular na mesma Wi-Fi)

### 8.1 Requisitos
- Por padrão: apenas `localhost`.
- "Habilitar LAN" (toggle) permite acesso por IP local do PC.
- **Somente** na mesma rede: requests fora da sub-rede do PC devem ser bloqueados.
- Pareamento obrigatório via QR Code + token expirável.

### 8.2 Fluxo de pareamento
1. Desktop habilita LAN
2. Desktop exibe QR Code com `pair_token` (expira 2–5 min)
3. Celular acessa URL local e envia `pair_token`
4. API retorna `device_token` persistente
5. Requests subsequentes devem enviar `device_token`

### 8.3 Segurança LAN
- Bloquear IPs fora de faixa privada e fora da sub-rede atual do PC.
- Lista de dispositivos autorizados, com revogação.
- Sessão mobile pode exigir senha na primeira vez (configurável).

### 8.4 HTTPS local (decisão travada)
- O backend gera um **certificado autoassinado** na primeira execução (armazenado em `finances-data/certs/`).
- A URL no QR Code já usa `https://192.168.x.x:<porta>`.
- O usuário aceita o certificado autoassinado no navegador do celular uma única vez.
- Isso é necessário para:
  - Trafegar `device_token` e dados financeiros de forma segura dentro da rede local.
  - Permitir que o navegador mobile use PWA/Service Workers e APIs modernas (que exigem HTTPS fora de `localhost`).
- Em desenvolvimento, HTTPS pode ser desabilitado via flag `--dev-http` para conveniência.

---

## 9. Segurança

### 9.1 Senha do app
- Tela de lock ao abrir (e opcional após inatividade).
- Senha armazenada com hash forte (ex: Argon2/bcrypt + salt).
- Nunca armazenar senha em texto.

### 9.2 Tokens
- `pair_token` curto (expira)
- `device_token` longo (revogável)
- Preferir armazenar `device_token` de forma segura no PC e no browser (com cuidado em XSS; UI local, mas manter boas práticas).

### 9.3 Proteção CSRF/Origin no modo LAN
- Todos os endpoints validam o header `Origin` contra lista de origens permitidas (`https://localhost:<porta>`, `https://192.168.x.x:<porta>`).
- Requests de navegadores devem incluir header custom `X-Finance-Token` com o `device_token`. Esse header não pode ser enviado por formulários cross-origin (proteção contra CSRF).
- Requests sem `Origin` válido ou sem `X-Finance-Token` são rejeitados com `403 Forbidden`.

---

## 10. Arquitetura (Clean Architecture / modular)

### 10.1 Camadas
- **Domain**: entidades e regras (sem framework)
- **Application**: casos de uso (use cases), comandos/DTOs, validações
- **Infrastructure**: SQLite repos, event store, scheduler, segurança, rede
- **Interfaces**: FastAPI (rotas), Tauri (desktop), React UI

### 10.2 Use Cases (exemplos)
- `CreateExpense`
- `CreateIncome`
- `CreateTransfer`
- `CreateCardPurchase`
- `PayInvoice`
- `MarkReimbursementReceived`
- `CreateRecurringRule`
- `GenerateMonthlyPendings`
- `ConfirmPending`
- `AdjustBalance`
- `CreateOrUpdateBudget`
- `CreateInvestmentMovement`
- `VoidTransaction`
- `UpdateTransaction`

> Importante: Rotas chamam use cases. Não existe regra de negócio dentro de endpoint.

### 10.3 Contratos de fronteira (estado atual)
- **Interfaces HTTP (backend)**:
  - `finance_app/interfaces/http/app.py` atua como módulo fino de criação de app e inclusão de routers.
  - `finance_app/interfaces/http/bootstrap.py` é o composition root (wiring de serviços e adapters).
  - Routers foram separados por contexto (`accounts`, `cards`, `transactions`, `reports`, `recurring`, `budgets`, `investments`, `health`, `dev`).
- **Application (backend)**:
  - Casos de uso executam coordenação explícita entre `EventStore` e `Projector`.
  - Fluxos multi-evento usam append transacional em lote (`append_batch`).
- **Domain (backend)**:
  - Regras puras de negócio (ex.: políticas de orçamento, meta de investimento, itens para revisão) ficam fora de adapters.
- **Infrastructure (backend)**:
  - `Projector` concentra projeções/read models, sem leitura com efeito colateral implícito.
  - Materialização de pendências mensais é comando explícito, separado da consulta.
- **Frontend**:
  - `App.tsx` delega orquestração de dados para hook dedicado com proteção contra resposta stale/race.
  - `lib/api.ts` separa contrato HTTP e parsing robusto (`204`, erros estruturados, payload patch parcial).
  - Componentes pesados delegam estado específico para hooks/reducer (`use-invoice-items`, `use-quick-entry-defaults`, `use-quick-add-reducer`).

---

## 11. Event Store (fonte da verdade) + SQLite (projeção)

### 11.1 Fonte da verdade — SQLite Event Store
- Tabela `events` em um **banco SQLite dedicado** (`events.db`), append-only.
- Cada linha = um evento com:
  - `event_id` (INTEGER PRIMARY KEY AUTOINCREMENT)
  - `type` (TEXT NOT NULL)
  - `timestamp` (TEXT NOT NULL — UTC ISO 8601)
  - `payload` (TEXT NOT NULL — JSON)
  - `version` (INTEGER NOT NULL — versão do schema do evento)
- **Por que SQLite em vez de `.jsonl`:**
  - Transações ACID: escrita atômica mesmo em crash/queda de energia.
  - WAL mode para leitura concorrente sem bloqueio.
  - `event_id` auto-incrementado garante sequenciamento sem conflito.
  - Sem risco de corrupção por linha JSON incompleta.
  - Backup via `.backup` API nativo do SQLite (cópia consistente).

### 11.2 Catálogo de eventos (Event Catalog)

| Evento | Payload (campos principais) | Projeção afetada |
|---|---|---|
| `ExpenseCreated` | `id, amount, category_id, account_id, method, occurred_at` | `transactions`, `balance_state` |
| `IncomeCreated` | `id, amount, category_id, account_id, occurred_at` | `transactions`, `balance_state` |
| `TransferCreated` | `id, from_account_id, to_account_id, amount, occurred_at` | `transactions`, `balance_state` |
| `CardPurchaseCreated` | `id, card_id, amount, category_id, installments, purchase_date` | `invoice_items`, `installments` |
| `InvoicePaid` | `invoice_id, amount, account_id, paid_at` | `invoices`, `transactions`, `balance_state` |
| `TransactionUpdated` | `transaction_id, changes: {...}` | `transactions`, `balance_state` |
| `TransactionVoided` | `transaction_id, reason` | `transactions`, `balance_state` |
| `CardPurchaseVoided` | `purchase_id, reason` | `invoice_items`, `installments` |
| `ReimbursementReceived` | `transaction_id, amount, received_at` | `receivables`, `transactions`, `balance_state` |
| `PendingConfirmed` | `pending_id, transaction_id` | `pendings`, `transactions` |
| `BalanceAdjusted` | `account_id, new_balance, reason` | `balance_state` |
| `RecurringRuleCreated` | `id, name, amount, frequency, due_day, ...` | `recurring_rules` |
| `BudgetUpdated` | `category_id, month, limit` | `budgets` |
| `AccountCreated` | `id, name, type, initial_balance` | `accounts`, `balance_state` |
| `InvestmentMovement` | `id, type, amount, description, occurred_at` | `transactions` |

> **Versionamento de eventos (upcasting):** Se na v2 um evento ganhar campos novos, o Projector deve saber lidar com eventos v1 (sem o campo) usando defaults. O campo `version` em cada evento permite essa distinção.

### 11.3 Concurrency e lock do Event Store
- O SQLite Event Store (`events.db`) usa **WAL mode** com escritas serializadas via lock exclusivo de escrita do SQLite.
- `event_id` auto-incrementado elimina conflitos de sequenciamento.
- Múltiplos leitores (UI, Projector) podem ler sem bloquear escritas.
- Se no futuro houver múltiplas interfaces escrevendo simultaneamente (Telegram Bot, IA), o SQLite serializa naturalmente via seu mecanismo de lock interno — suficiente para o throughput esperado (< 100 eventos/dia).

### 11.4 Projeções
- Um **Projector** aplica eventos ao SQLite de projeções (`app.db`) para:
  - consultas rápidas
  - relatórios e filtros
- `app.db` pode ser reconstruído a partir do event store se necessário.
- Tabela `event_cursor` em `app.db` rastreia o último `event_id` processado.

### 11.5 Por que isso importa
- Auditoria completa
- Facilita backup/sync sem commitar `.db`
- No futuro: Telegram/IA chamam os mesmos use cases que geram eventos

---

## 12. Persistência (SQLite) — visão de alto nível

### 12.1 Bancos de dados
- **`events.db`** — Event Store (fonte da verdade, append-only)
- **`app.db`** — Projeções (derivado dos eventos, pode ser reconstruído)

### 12.2 Tabelas principais em `app.db` (materializadas)
- `accounts`
- `transactions`
- `cards`
- `invoices`
- `invoice_items` (compras/parcelas)
- `installment_plans`, `installments`
- `persons` (reembolsos)
- `receivables` (pendente/recebido)
- `recurring_rules`
- `pendings`
- `budgets`
- `balance_state` (1 linha por conta)
- `event_cursor` (último evento projetado)

> Índices: por data, categoria, método, card_id, person_id, account_id.

---

## 13. APIs (alto nível)

### 13.1 Autenticação
- Desktop local: sessão local + senha
- Mobile LAN: `device_token` + (opcional) senha por sessão

### 13.2 Endpoints (exemplos)
- `POST /api/accounts`
- `GET  /api/accounts`
- `POST /api/transfers`
- `POST /api/expenses`
- `POST /api/incomes`
- `GET  /api/transactions?from=&to=&category=&method=&person=&account=`
- `POST /api/cards`
- `POST /api/cards/{id}/purchases`
- `GET  /api/cards/{id}/invoices/current`
- `POST /api/invoices/{id}/payments`
- `POST /api/reimbursements/{tx_id}/mark-received`
- `POST /api/recurring-rules`
- `GET  /api/pendings?month=`
- `POST /api/pendings/{id}/confirm`
- `POST /api/budgets`
- `GET  /api/dashboard?month=YYYY-MM`
- `POST /api/security/pair` (pareamento LAN)
- `GET  /api/security/devices` / `DELETE /api/security/devices/{id}`

---

## 14. Requisitos não funcionais

### 14.1 Performance
- Sem tarefas em loop; jobs por agendamento (ex: gerar pendências 1x/dia ou ao abrir)
- Consultas rápidas com índices e projeções

### 14.2 Confiabilidade
- Event Store em SQLite com transações ACID e WAL mode
- Recuperação: replay dos eventos para reconstruir `app.db`

### 14.3 Backup e Restore

**Backup:**
- Export CSV (transações, faturas, etc.)
- Backup do `events.db` via SQLite `.backup` API (cópia atômica e consistente)
- Snapshots mensais comprimidos (`events_2026-03.db.gz`) — **obrigatório**, gerado automaticamente no 1o dia do mês

**Restore (passo a passo):**
1. Copiar `events.db` do backup (ou snapshot) para o diretório de dados.
2. Deletar `app.db` existente.
3. Executar o Projector: ele lê todos os eventos de `events.db` e reconstrói `app.db` do zero.
4. **Meta de tempo:** Restore de 1 ano de eventos (estimativa: ~30.000 eventos) deve completar em < 30 segundos.

**Critério de aceitação:**
- Teste de restore automatizado no CI: criar `events.db` com fixtures, deletar `app.db`, executar Projector, validar que projeções estão corretas.

---

## 15. Roadmap e milestones (recomendado)

### Milestone 0 — Fundação
- Estrutura do repo (clean architecture)
- SQLite Event Store + Projector + SQLite de projeções
- Autenticação/senha
- Infra do tray/autostart (Tauri)
- CRUD de contas (accounts)

### Milestone 1 — MVP financeiro básico
- Categorias
- Transações PIX/dinheiro (create/list/filter)
- Transferências entre contas
- Dashboard mensal básico
- Ajuste de saldo (evento)

### Milestone 2 — Cartões
- Cadastro cartão
- Compras no cartão
- Faturas por ciclo (com regras de datas travadas)
- Pagamento de fatura (saída na conta)
- Parcelamento (igual)

### Milestone 3 — Reembolsos + Fixos + Orçamentos
- Pessoas + A receber
- Marcar reembolso recebido (entrada PIX automática)
- Fixos: regras + pendências + confirmar
- Orçamento por categoria + alertas

### Milestone 4 — Mobile LAN
- UI responsiva (escopo essencial)
- Certificado autoassinado + HTTPS local
- LAN toggle + pareamento QR + restrição por sub-rede
- Gestão básica de dispositivos autorizados
- Proteção CSRF/Origin

### Milestone 5 — Polimento
- Atalho global "Adicionar gasto"
- Templates de transação
- Export CSV e snapshots automatizados
- Teste de restore automatizado

---

## 16. Futuro (fora do escopo v1, mas previsto na arquitetura)

### 16.1 Telegram Bot
- Bot chama os mesmos endpoints/use cases (sem duplicar lógica).
- Opções:
  - Bot rodando no PC
  - Bot externo acessando via túnel seguro (Tailscale/Cloudflare Tunnel)

### 16.2 Agente de IA
- Ferramentas do agente chamam casos de uso:
  - adicionar gasto
  - listar gastos por período/categoria
  - gerar insights determinísticos + sumarização por LLM
- O LLM não é fonte da verdade; apenas interpreta e resume.

### 16.3 Roadmap futuro (v2+)
- Tags (labels livres) em transações + CRUD + filtro
- Estornos/refunds avançados no cartão (reembolso de fatura)
- Investimentos com cotação automática

---

## 17. Critérios de aceitação (v1)
1. Criar gasto PIX em <10s (desktop e mobile LAN).
2. Compra no cartão aparece na fatura correta; parcelado distribui parcelas.
3. Pagar fatura cria saída na conta e altera status da fatura.
4. Reembolso pendente não altera saldo; ao marcar recebido cria entrada PIX vinculada.
5. Fixos geram pendências; confirmar cria transação com data do vencimento.
6. Orçamentos alertam quando excedidos.
7. App inicia com Windows, fecha no X e permanece no tray.
8. LAN só funciona na mesma sub-rede + pareamento obrigatório + HTTPS.
9. Todos os eventos ficam registrados (auditabilidade).
10. Transferências entre contas não poluem relatórios de receita/despesa.
11. Restore do event store reconstrói `app.db` corretamente em < 30s para 1 ano de dados.

---

## 18. Definições finais (decisões travadas)
- UI: React responsiva (desktop completo, mobile essencial)
- Desktop: Tauri
- Backend: FastAPI (Python), empacotado via **PyInstaller** como sidecar do Tauri
- Packaging do sidecar: PyInstaller gera `.exe` único; Tauri gerencia o ciclo de vida (start/stop). Tamanho estimado do bundle ~50-80MB. Plano para Windows Defender: assinatura de código na release ou instrução de exclusão para dev.
- Dados: **SQLite Event Store** (`events.db`, fonte da verdade, append-only) + SQLite de projeções (`app.db`)
- Contas: suporte a múltiplas contas (accounts) com transferências internas
- Reembolso: método padrão PIX, só entra no saldo quando confirmado
- Fixos: pendências para confirmar
- Orçamento: por consumo (data do gasto/compra); parcelados impactam o valor da parcela mensal
- LAN: apenas mesma rede Wi-Fi (restrição por sub-rede) + pareamento por token/QR + HTTPS autoassinado
- Timestamps: UTC ISO 8601; exibição no timezone do sistema
- Datas de cartão: `closing_day` e `due_day` de 1 a 28; compra no dia do fechamento entra na fatura atual
- Tags: removidas da v1, previstas para v2

---

## 19. Estrutura de pastas e estrutura de Git

### 19.1 Estratégia de repositórios (evitar retrabalho + proteger dados)
**Recomendado (2 repos):**
1. **`finances-app`** (código, monorepo)
   - Backend (FastAPI), Frontend (React) e Desktop (Tauri)
   - CI, testes, build, documentação
2. **`finances-data`** (dados pessoais, privado)
   - `events.db` (fonte da verdade) + snapshots + exports + certs
   - Evita misturar histórico pessoal com PRs/CI e reduz risco de vazamento acidental

> Evitar versionar `app.db` no Git. O SQLite de projeções é derivado do event store.

### 19.2 Monorepo (`finances-app`) — estrutura de pastas
```text
finances-app/
  README.md
  LICENSE
  .gitignore
  .gitattributes
  .editorconfig

  docs/
    prd.md
    architecture.md
    adr/

  scripts/
    dev.ps1
    dev.sh
    build.ps1
    build.sh

  infra/
    installers/
    icons/

  packages/
    shared/
      README.md
      schemas/
      types/
      version.txt

    backend/
      pyproject.toml
      src/
        finance_app/
          domain/
          application/
          infrastructure/
          interfaces/
      tests/
      .env.example

    frontend/
      package.json
      src/
        pages/
        components/
        features/
        lib/
      public/

    desktop/
      src-tauri/
        tauri.conf.json
        src/
          main.rs
      icons/
````

### 19.3 Repo de dados (`finances-data`) — estrutura sugerida

```text
finances-data/
  README.md
  .gitignore
  events/
    events.db               # fonte da verdade (SQLite event store)
  snapshots/
    events_2026-03.db.gz
    events_2026-04.db.gz
  exports/
    transactions_2026-03.csv
    invoices_2026-03.csv
  certs/
    server.key
    server.crt
```

### 19.4 Branching e fluxo de commits

* Branch principal: `main`
* Branches de trabalho:

  * `feature/<nome>`
  * `fix/<nome>`
* Padrão de commits (Conventional Commits):

  * `feat: ...`
  * `fix: ...`
  * `refactor: ...`
  * `chore: ...`
  * `docs: ...`

### 19.5 Regras de versionamento

* **Versão do app**: SemVer (`vMAJOR.MINOR.PATCH`) com tags no Git.
* **Versão do contrato** (UI/API): `packages/shared/version.txt`

  * Mudanças em payload/endpoint incrementam versão do contrato e UI/API devem estar compatíveis.

### 19.6 Itens que não entram no Git (repo de código)

* `.env`
* `*.sqlite`, `*.db`
* `events.db`, snapshots e exports
* builds: `dist/`, `target/`, caches e logs
