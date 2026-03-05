# Relatorio Unificado UX/UI (Desktop + Web) - Design

## Contexto

Data: 2026-03-05
Escopo: consolidar o relatorio unificado em um design tecnico executavel, sem retrabalho, com inicio imediato de implementacao.

Objetivos de produto que guiam o design:
- uso diario com entrada em 5-10s
- historico unico como fonte da verdade
- ergonomia real de desktop (densidade, atalhos, menos scroll cansativo)
- confianca visual e semantica (estados claros, consistencia, prevencao de erro)

## Abordagens Avaliadas

### 1) Big-bang (reconstrucao ampla em um unico release)

Descricao:
- trocar navegacao, dashboard, historico, cartoes, investimentos e sistema visual de uma vez

Vantagens:
- reduz estados intermediarios
- entrega visao final rapidamente se tudo der certo

Desvantagens:
- alto risco de regressao
- grande superficie de testes quebrados
- feedback tardio do usuario

### 2) Fatias verticais incrementais (recomendado)

Descricao:
- priorizar P0/P1 com compatibilidade do backend atual
- evoluir para ledger completo em camadas

Vantagens:
- entrega valor cedo
- risco controlado
- cada etapa e mensuravel

Desvantagens:
- convivio temporario entre UX antiga e nova em alguns pontos
- exige disciplina de contrato e migracao

### 3) Backend-first (novo endpoint ledger unificado antes da UX)

Descricao:
- construir agregador server-side primeiro e depois refatorar telas

Vantagens:
- modelo de dados mais limpo desde o inicio
- frontend mais simples no medio prazo

Desvantagens:
- demora para perceber ganho visual
- pouco impacto imediato em experiencia

## Decisao

Seguiremos a abordagem 2 (incremental por fatias verticais), com este recorte:
- Fase imediata: P0 (entrypoint unico, shell sem coluna contextual fixa, taxonomia)
- Fase seguinte: P1 (historico unificado com filtros, KPIs e drawer)
- Depois: P2/P3 (orcamentos no lugar certo + polimento desktop/Fluent)

## Design Alvo

### 1) Arquitetura de informacao

Navegacao desktop:
- Visao Geral
- Historico Unificado
- Cartoes de Credito
- Patrimonio & Investimentos
- Analises & Relatorios
- Contas & Saldos
- Configuracoes

Regra:
- sidebar exibe destinos, nunca formularios de acao

### 2) Entrada de dados unificada

Padrao unico:
- botao global `+ Lancar`
- atalhos `Ctrl+N` e `Ctrl+K`
- um modal universal (despesa, receita, transferencia, investimento)

Regra:
- atalhos/contextos so abrem presets do mesmo modal
- formularios embutidos em Cartoes e Investimentos sao removidos

### 3) Ledger / Historico Unificado

Modelo de linha (UI):
- data
- descricao/contraparte
- categoria
- conta/cartao
- tipo
- metodo/origem
- pessoa/reembolso
- valor
- status

Capacidades:
- busca global e filtros compostos
- ordenacao por coluna
- densidade (conforto/compacto/denso)
- edicao rapida onde fizer sentido
- detalhe em drawer lateral

### 4) Dashboard acionavel

Estrutura em 3 faixas:
- Topo: saldo, entradas, saidas, resultado
- Meio: pendencias, proximos eventos, correcoes rapidas
- Base: categorias top + variacao mensal

Regra:
- focar em "o que fazer agora"
- scroll interno por bloco para evitar scroll tax da pagina inteira

### 5) Cartoes e Investimentos como dashboards especializados

Cartoes:
- foco em fatura, limite, fechamento/vencimento, pagar fatura, ver gastos
- sem formulario de lancamento no rodape

Investimentos:
- foco em composicao, evolucao, capital x rendimento, movimentos
- aporte/resgate via modal global com preset

### 6) Layout e sistema visual desktop

Diretrizes:
- grade horizontal (12 colunas)
- remover coluna contextual fixa
- drawer colapsavel para contexto secundario
- tipografia e tokens coerentes com Windows desktop
- reduzir ruido visual em telas densas

## Modelo de dados de transicao

Sem bloquear o inicio da UX, manteremos compatibilidade com o contrato atual e evoluiremos para um `LedgerItem` canonico.

`LedgerItem` (shape alvo):
- id
- occurred_at
- source_type (`cash_transaction | card_purchase_installment | invoice_payment | transfer | investment_movement | reimbursement_receipt | pending`)
- source_id
- account_or_card_id
- type (`income | expense | transfer | investment`)
- method
- category_id
- description
- person_id
- status
- amount
- metadata (parcela, invoice_id, due_date, etc.)

## Erros e estados

Regras obrigatorias:
- estados vazios com CTA claro
- cor nunca como unico sinal (icone + label + cor)
- mensagens de erro acionaveis
- confirmacoes fortes para operacoes destrutivas

## Estrategia de testes

Cobertura principal:
- AppShell: sem painel fixo por padrao
- QuickAdd: presets abrindo contexto correto
- Investments/Cards: acoes acionam modal global ao inves de formulario local
- Transactions/Ledger: filtros, ordenacao, edicao rapida
- Regressao: atalhos `Ctrl+N` e `Ctrl+K`

## Fases de execucao

### P0 (inicio imediato)
- remover painel contextual fixo do shell
- consolidar entrypoint unico em todas as telas
- iniciar renomeacao de taxonomia para Historico Unificado

### P1
- historico unificado como tela nucleo (filtros + tabela + drawer)
- drill-down a partir de dashboard/cartoes/relatorios/investimentos

### P2
- orcamentos e categorias centrados em configuracoes/planejamento
- dashboard so mostra status e alertas

### P3
- densidade, refinamento de scroll, polish visual desktop

## Criterio de sucesso

- registrar gasto sem troca de pagina em <= 10s
- nenhuma tela especializada com formulario redundante de lancamento
- historico com filtros consistentes e leitura rapida
- dashboard orientado a acao, nao a configuracao
