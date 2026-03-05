# Relatorio Unificado UX/UI - Matriz de Cobertura

Data: 2026-03-05
Escopo: consolidar cobertura do relatorio unificado no frontend atual.

## Status por bloco

### 1) Arquitetura de informacao e navegacao
- [x] Sidebar com destinos principais.
- [x] Taxonomia atualizada (Visao Geral, Historico unificado, Cartoes, Patrimonio & investimentos, Analises & relatorios, Contas, Configuracoes).
- [x] Dashboard orientado a leitura/acao.

### 2) Ledger / Historico unificado
- [x] Header com filtros e busca.
- [x] KPIs de recorte (Entradas, Saidas, Resultado).
- [x] Tabela com ordenacao e densidade (conforto/compacto/denso).
- [x] Drill-down em drawer lateral.
- [x] Split transaction e regras de auto-categorizacao no proprio ledger.
- [x] Modelagem double-entry explicita no contrato da API (`ledger_event_type`, `ledger_source`, `ledger_destination` + parametro `ledger` documentados no OpenAPI).
- [x] Cobertura completa de eventos no mesmo stream do ledger (compras de cartao e movimentos de investimento agregados no `/api/transactions?ledger=true`).

### 3) Entrada de dados unificada
- [x] + Lancar como ponto global.
- [x] Ctrl+N para abertura rapida.
- [x] Ctrl+K com command palette.
- [x] Presets de contexto abrindo o mesmo composer.

### 4) Dashboard acionavel
- [x] Blocos de pendencias (reembolsos), proximos eventos e correcoes.
- [x] Atalhos com drill-down para ledger filtrado.
- [x] Orcamentos no dashboard em modo status/alerta.
- [x] Parametrizacao de orcamento movida para Configuracoes.

### 5) Layout desktop e densidade
- [x] Sem coluna contextual fixa por padrao.
- [x] Componentizacao com cards e tabelas mais densas.
- [x] Densidade ajustavel no ledger.

### 6) Refatoracao por area
- [x] Cartoes como workspace de faturas/ciclos com acao de pagar e ver gastos no ledger.
- [x] Investimentos com acoes no topo via modal global e atalho para ledger.
- [x] Relatorios com templates + drill-down para ledger.
- [x] Configuracoes como hub de parametrizacao (incluindo orcamento, regras, atalhos e backup/export).
- [x] Contas estritamente leitura (criacao/edicao estruturais redirecionadas para Configuracoes).

### 7) Visual system
- [x] Baseline Fluent aplicado (tokens menos saturados, tipografia Segoe UI Variable, smoke/acrylico em drawer/modal lateral).
- [ ] Polimento completo Fluent (Mica/Acrylic/Smoke) e tipografia final dedicada em todas as superficies legadas.
- [x] Ajustes finais de contraste para telas mais densas (fundo denso dedicado + bordas/hover de tabela menos saturados).

### 8) Produtividade e confianca
- [x] Atalhos Ctrl+N/Ctrl+K.
- [x] Formatos monetarios consistentes no app.
- [x] Estado vazio e feedback toast nas principais jornadas.

## Proxima rodada recomendada (P2/P3)
1. Fechar polish desktop/Fluent nas superfices legadas (cards, formularios e controles).
2. Reduzir warnings de dimensao dos graficos (Recharts) nos testes para suite sem ruido.
3. Avaliar preferencia global de densidade para propagar modo compacto/denso alem do ledger.
