# Plano de Ação Completo — Refatoração do App de Finanças Pessoais

## Objetivo

Transformar a aplicação atual em um **app financeiro desktop-first para Windows**, com foco em **uso diário rápido**, **consistência de dados**, **baixa fricção operacional**, **alta densidade informacional** e **visão mensal clara**.

Este plano foi escrito para ser usado como **guia de execução por um modelo de IA ou por um time de produto/design/engenharia**. Por isso, os itens estão estruturados com:

- objetivo claro
- problema atual
- ação esperada
- critério de aceite
- checklist executável
- dependências quando necessário

---

# 1. Resultado esperado da refatoração

Ao final da refatoração, o app deve permitir que o usuário:

- entenda o mês atual em poucos segundos
- registre um lançamento em poucos cliques
- veja claramente **quanto gastou**, **quanto ainda vai gastar**, **quanto é fixo**, **quanto é parcela**, **quanto ainda vence**, **quanto sobra para gastar**
- enxergue o detalhe de cada cartão, conta e compromisso futuro
- tenha um **histórico unificado confiável**, que seja a principal fonte de verdade da aplicação
- use o app em janelas desktop sem depender de muito scroll vertical
- consiga operar com facilidade usando layout mais horizontal, maior densidade e ações contextuais

---

# 2. Princípios obrigatórios do produto

## 2.1 Fonte única de verdade

Toda movimentação financeira deve nascer ou derivar de um **ledger central**.

**Regra obrigatória:** nenhuma tela pode mostrar um número que não possa ser explicado por registros do ledger ou por agregações determinísticas dele.

### Checklist

- [x] Definir o ledger como fonte única de verdade do produto
- [x] Garantir que Dashboard, Cartões, Relatórios, Patrimônio e Contas derivem do mesmo conjunto de eventos
- [ ] Eliminar qualquer lógica paralela que gere inconsistência entre telas
- [x] Garantir que toda compra no cartão apareça também na visão detalhada daquele cartão
- [x] Garantir que o total exibido em agregados bata com a lista subjacente

### Critério de aceite

- Ao clicar em qualquer KPI ou total, o usuário consegue chegar ao conjunto de registros que compõe aquele valor
- Não existe situação em que haja compra lançada e a aba de compras esteja vazia

---

## 2.2 Home orientada a decisão, não a estrutura interna

A tela inicial deve responder perguntas reais do dia a dia, e não refletir apenas módulos do sistema.

### Perguntas que a Home obrigatoriamente precisa responder

- [x] Quanto entrou no mês?
- [x] Quanto saiu no mês?
- [x] Quanto dos gastos do mês é fixo?
- [x] Quanto do mês é parcela?
- [x] Quanto ainda vai vencer neste mês?
- [x] Quanto ainda sobra para gastar neste mês?
- [x] Quais categorias mais consumiram o orçamento?
- [x] Quais compromissos vencem em breve?
- [x] Há algo pendente, inconsistente ou para revisar?

### Critério de aceite

- Um usuário deve conseguir abrir o app e responder essas perguntas sem navegar por várias telas

---

## 2.3 Desktop-first de verdade

Como o produto será usado principalmente em Windows desktop, a interface precisa priorizar:

- densidade adequada
- menos altura desperdiçada
- mais informação acima da dobra
- organização horizontal por colunas
- uso de tabela/list-details nas áreas operacionais
- scroll vertical apenas quando realmente necessário

### Checklist

- [x] Revisar todas as telas para reduzir altura excessiva de cards
- [x] Reorganizar áreas de resumo em grades horizontais
- [x] Substituir blocos muito altos por cards compactos ou tabelas
- [x] Garantir que a primeira dobra entregue informação suficiente sem exigir scroll
- [x] Adotar padrão de layout desktop consistente entre telas

### Critério de aceite

- Em uma janela desktop padrão, a parte mais importante de cada tela fica visível sem depender de scroll longo

---

## 2.4 Separação clara entre operação, análise e configuração

Hoje existem misturas indevidas entre áreas operacionais e áreas administrativas.

### Regra

- **Operação**: registrar, visualizar, revisar, pagar, filtrar, classificar
- **Planejamento**: orçamento, metas, recorrências, parcelas, projeções
- **Configuração**: contas, cartões, categorias, regras, preferências, backup

### Checklist

- [x] Remover elementos administrativos de telas operacionais quando fizer sentido
- [x] Mover cadastros estruturais para Configurações ou Estrutura
- [x] Criar uma área explícita de Planejamento, se necessário
- [x] Evitar que Configurações concentre fluxos vivos do dia a dia

### Critério de aceite

- O usuário não precisa entrar em Configurações para executar tarefas financeiras rotineiras do mês

---

# 3. Problemas centrais a corrigir primeiro

## 3.1 Inconsistência entre cartões, compras e histórico

### Problema atual

Existem compras lançadas que não aparecem de forma consistente nas visões de cartão/compras. Isso quebra a confiança no produto.

### Ações

- [ ] Revisar o modelo de dados de cartões, faturas, compras e parcelas
- [x] Definir formalmente o que é: compra, parcela, fatura, pagamento de fatura, limite comprometido, limite disponível
- [ ] Garantir que compras individuais alimentem a visão da fatura e do cartão
- [x] Garantir que o pagamento da fatura não seja contabilizado como novo gasto do mês
- [ ] Garantir que uma compra parcelada gere parcelas futuras com rastreabilidade clara

### Critério de aceite

- O usuário consegue abrir um cartão e ver exatamente quais compras compõem o total da fatura
- O total da fatura, o limite comprometido e as compras detalhadas batem entre si

---

## 3.2 Excesso de telas com cara de cadastro e pouca visão de operação

### Problema atual

Algumas telas parecem mais CRUD do que produto financeiro de uso diário.

### Ações

- [ ] Repriorizar a experiência para que o histórico unificado e a visão mensal sejam o centro do app
- [ ] Reduzir protagonismo visual de telas administrativas
- [ ] Levar detalhes operacionais para listas, tabelas e painéis contextuais

### Critério de aceite

- A aplicação parece um sistema de acompanhamento financeiro e não apenas um painel de cadastro de contas/cartões

---

## 3.3 Densidade ruim para desktop

### Problema atual

A interface está bonita, porém espaçosa demais, gerando scroll desnecessário.

### Ações

- [ ] Diminuir altura de cards de resumo
- [ ] Unificar cabeçalhos e toolbars
- [ ] Reorganizar informações em 2 ou 3 colunas quando fizer sentido
- [ ] Usar mais componentes de tabela/lista em vez de cards empilhados

### Critério de aceite

- A experiência parece de app desktop e não de landing page/web app verticalizado

---

# 4. Arquitetura de informação alvo

## 4.1 Estrutura sugerida de navegação

### Navegação principal recomendada

- [ ] Visão geral
- [ ] Histórico
- [ ] Cartões
- [ ] Planejamento
- [ ] Patrimônio
- [ ] Configurações

## 4.2 Ajustes de nomenclatura e escopo

### Mudanças sugeridas

- [x] Renomear "Histórico unificado" para "Histórico" ou "Transações"
- [x] Renomear "Análises & relatórios" para "Planejamento" ou "Relatórios", dependendo do escopo final
- [ ] Evitar nomes longos demais na navegação lateral
- [ ] Padronizar todos os rótulos em português
- [ ] Corrigir inconsistências de locale como "March 2026"

### Critério de aceite

- Os nomes das áreas refletem com clareza sua função principal

---

# 5. Modelo conceitual obrigatório do domínio

## 5.1 Entidades centrais

### O sistema deve modelar explicitamente

- [ ] Transação
- [ ] Conta
- [ ] Cartão
- [ ] Fatura
- [ ] Parcela
- [ ] Recorrência
- [ ] Categoria
- [ ] Pessoa relacionada
- [ ] Reembolso
- [ ] Transferência
- [ ] Movimento de investimento
- [ ] Orçamento mensal
- [ ] Meta
- [ ] Regra de categorização

## 5.2 Tipos de evento financeiro que devem existir no ledger

- [ ] Receita
- [ ] Despesa à vista
- [x] Compra no cartão
- [ ] Parcela futura
- [ ] Transferência entre contas
- [x] Pagamento de fatura
- [ ] Aporte em investimento
- [ ] Resgate de investimento
- [ ] Reembolso esperado
- [ ] Reembolso recebido
- [ ] Ajuste manual

## 5.3 Regras de modelagem obrigatórias

- [x] Pagamento de fatura não entra como novo gasto do mês
- [x] Compra no cartão entra como evento econômico rastreável
- [ ] Parcela deve ter vínculo com compra-mãe
- [ ] Recorrência deve gerar eventos previstos ou confirmáveis
- [ ] Transferência não deve distorcer entradas/saídas do mês
- [ ] Reembolso precisa ter status e pessoa associada

### Critério de aceite

- Cada total financeiro do sistema pode ser explicado a partir dessas entidades e regras

---

# 6. Plano de refatoração por fases

## Fase 0 — Alinhamento estrutural antes de mexer em UI

### Objetivo

Garantir que a base conceitual e os dados estão corretos antes de redesenhar as telas.

### Checklist

- [ ] Mapear todas as entidades atuais e seus relacionamentos
- [ ] Documentar fluxos de criação de lançamento, compra no cartão, parcela, pagamento de fatura, aporte, resgate e reembolso
- [ ] Identificar duplicidades ou lacunas no domínio
- [x] Definir eventos do ledger e suas regras de agregação
- [ ] Revisar se existem campos hoje que são derivados e não deveriam ser persistidos separadamente
- [ ] Definir contratos de dados para dashboard, histórico, cartões e planejamento
- [x] Criar uma matriz: origem do dado -> tela que consome -> regra de cálculo

### Entregável

- [x] Documento técnico do domínio e dos cálculos financeiros

---

## Fase 1 — Transformar o histórico no centro operacional

### Objetivo

Fazer do Histórico a principal superfície de trabalho da aplicação.

### Checklist funcional

- [ ] Tornar o histórico uma lista/tabela densa e confiável
- [x] Garantir busca por texto relevante
- [x] Criar filtros rápidos e filtros avançados
- [ ] Criar presets de filtros salvos
- [x] Adicionar drill-down a partir de KPIs e cards
- [x] Permitir edição da transação
- [x] Permitir estorno/ajuste de forma clara
- [ ] Adicionar sinalização de status: revisado, pendente, recorrente, parcela, reembolso, previsão
- [ ] Suportar no futuro edição em lote

### Presets obrigatórios

- [x] Tudo do mês
- [x] Gastos fixos
- [x] Parcelas do mês
- [x] Cartão de crédito
- [x] Transferências
- [x] Investimentos
- [x] Não categorizados
- [x] Pendentes de revisão
- [x] Reembolsos pendentes

### Colunas recomendadas da tabela

- [ ] Data
- [ ] Descrição
- [ ] Categoria
- [ ] Conta ou cartão
- [ ] Tipo
- [ ] Método
- [ ] Pessoa relacionada
- [ ] Status
- [ ] Valor
- [ ] Ações

### Melhorias de UX

- [x] Mover filtros avançados para drawer lateral ou área recolhível
- [x] Manter poucos filtros no topo por padrão
- [ ] Destacar a tabela mais do que o formulário de filtros
- [ ] Reduzir ruído visual de ações repetidas em cada linha
- [ ] Usar ações destrutivas em menu de contexto quando necessário

### Critério de aceite

- O usuário consegue encontrar, entender e editar rapidamente qualquer lançamento do mês sem se perder em excesso de filtros

---

## Fase 2 — Refazer a Visão Geral para o mês atual

### Objetivo

Transformar a Home em uma central de decisão financeira mensal.

## 6.2.1 KPIs obrigatórios no topo

- [x] Entradas do mês
- [x] Saídas do mês
- [x] Resultado do mês
- [x] Livre para gastar no mês
- [x] Gastos fixos do mês
- [x] Parcelas do mês
- [x] Faturas a vencer no mês
- [x] Reembolsos pendentes

## 6.2.2 Blocos obrigatórios da Home

### Bloco A — Compromissos do mês

Lista curta com itens dos próximos dias.

Cada linha deve mostrar:

- [x] descrição
- [x] categoria
- [x] valor
- [x] tipo do compromisso
- [x] forma de pagamento
- [x] status pago/não pago
- [x] data de vencimento
- [x] origem: recorrente, parcela, fatura, reembolso esperado, entrada prevista

### Bloco B — Gastos fixos do mês

Lista específica com:

- [x] descrição
- [x] categoria
- [x] valor
- [x] conta/cartão
- [x] status pago/não pago
- [x] data

### Bloco C — Parcelas do mês

Lista específica com:

- [x] descrição da compra mãe
- [x] categoria
- [x] valor da parcela atual
- [x] número da parcela atual
- [x] total de parcelas
- [x] quantas faltam
- [x] cartão vinculado
- [x] vencimento

### Bloco D — Últimas saídas do mês

Lista curta com:

- [x] descrição
- [x] categoria
- [x] valor
- [x] método
- [x] data

### Bloco E — Gasto por categoria no mês

- [x] gráfico compacto
- [x] ranking de categorias
- [x] comparação com orçamento
- [x] alerta visual para categorias próximas do limite

### Bloco F — Alertas e atenção

- [x] categorias estouradas
- [x] lançamentos não categorizados
- [x] transações pendentes de revisão
- [x] reembolsos atrasados
- [x] faturas próximas do vencimento

### Melhorias de layout

- [x] Reduzir altura dos cards de KPI
- [x] Organizar os blocos principais em 2 ou 3 colunas
- [x] Priorizar conteúdo acionável acima da dobra
- [x] Evitar cards vazios e áreas excessivamente altas

### Critério de aceite

- Ao abrir a aplicação, o usuário entende imediatamente a situação do mês atual e o que exige atenção

---

## Fase 3 — Reestruturar a área de Cartões

### Objetivo

Separar melhor visão operacional de cartão/fatura da administração de cartões.

## 6.3.1 Escopo correto da área de Cartões

A área de Cartões deve focar em:

- [x] faturas abertas
- [x] compras por cartão
- [x] limite comprometido
- [x] limite livre
- [x] compras parceladas futuras
- [x] próximos vencimentos
- [x] detalhe por cartão

## 6.3.2 O que deve sair ou perder protagonismo

- [x] Cadastro estrutural pesado de cartão não deve dominar a área operacional
- [x] Exclusão de cartão não deve aparecer com destaque excessivo em massa
- [x] Ajustes estruturais profundos devem migrar para Configurações

## 6.3.3 Nova estrutura sugerida

### Aba 1 — Faturas

- [x] lista de faturas abertas por cartão
- [x] total aberto
- [x] valor pago no período
- [x] próximo vencimento
- [x] status da fatura

### Aba 2 — Compras

- [x] tabela/lista de compras do cartão selecionado
- [x] visão por ciclo/fatura
- [x] detalhes de parcelas quando houver
- [x] filtros por cartão, ciclo e status

### Aba 3 — Carteira de cartões

- [x] resumo de cartões ativos
- [x] limite total
- [x] limite comprometido total
- [x] limite disponível total
- [x] atalho para editar cartões

## 6.3.4 Visão detalhada obrigatória por cartão

Ao selecionar um cartão, mostrar:

- [x] nome do cartão
- [x] limite total
- [x] limite comprometido
- [x] limite disponível
- [x] data de fechamento
- [x] data de vencimento
- [x] compras do ciclo atual
- [x] parcelas futuras já comprometidas
- [x] histórico filtrado daquele cartão

### Critério de aceite

- O usuário consegue entender claramente o estado de cada cartão e o que compõe a fatura

---

## Fase 4 — Substituir “Análises & relatórios” por algo mais útil

### Objetivo

Parar de oferecer uma tela genérica de filtros vazios e passar a oferecer relatórios prontos e visão de planejamento real.

## 6.4.1 Mudança de conceito

Trocar a lógica de “construtor de análise” por “relatórios prontos + ajustes opcionais”.

## 6.4.2 Relatórios prontos obrigatórios

- [x] Gasto por categoria no mês
- [x] Evolução mensal de gastos
- [x] Fixos x variáveis x parcelas
- [x] Entradas x saídas
- [x] Gastos por cartão
- [x] Projeção até o fim do mês
- [x] Compromissos futuros
- [x] Orçamento por categoria

## 6.4.3 Comportamentos desejados

- [x] Cada relatório deve abrir já com dados úteis
- [x] Filtros avançados devem ser opcionais
- [ ] Cada bloco deve permitir drill-down para o Histórico filtrado
- [x] A tela deve explicar o mês, não pedir que o usuário monte tudo do zero

### Critério de aceite

- O usuário entra em Relatórios e recebe respostas prontas, sem precisar preencher muitos filtros para começar

---

## Fase 5 — Reenquadrar Patrimônio & Investimentos

### Objetivo

Simplificar a área para o estágio atual do produto e conectá-la melhor ao fluxo financeiro geral.

### Problemas atuais

- muitos cards zerados
- gráficos com pouco valor acionável
- uso exagerado de espaço para pouca informação útil

### Estrutura recomendada

- [x] patrimônio total
- [x] caixa livre
- [x] capital aportado
- [x] rendimento acumulado
- [x] resgates do período
- [x] aportes do período
- [x] composição patrimonial
- [x] lista de movimentos de investimento

### Melhorias de UX

- [x] Reduzir quantidade de gráficos se não houver profundidade analítica real
- [x] Evitar donuts e charts grandes quando os dados ainda forem simples
- [x] Priorizar listas e evolução temporal útil
- [x] Manter ação rápida para aporte e resgate

### Critério de aceite

- A área de patrimônio deixa de parecer inflada artificialmente e passa a mostrar informações realmente úteis

---

## Fase 6 — Reduzir o protagonismo operacional da tela de Contas

### Objetivo

Transformar Contas em uma tela mais compacta e administrativa, com melhor densidade.

### Problemas atuais

- cards muito grandes
- pouca densidade informacional
- muito espaço para uma tarefa pouco frequente

### Ações

- [x] Avaliar trocar grade de cards por tabela compacta ou list/details
- [x] Manter saldo atual, tipo de conta, status e ações essenciais
- [x] Tirar excesso de altura dos cards
- [x] Destacar apenas o que ajuda na gestão estrutural
- [x] Evitar competir com Histórico e Dashboard como área principal do app

### Critério de aceite

- A tela de Contas cumpre seu papel sem parecer superdimensionada

---

## Fase 7 — Limpar e reorganizar Configurações

### Objetivo

Fazer Configurações voltar a ser área de estrutura e preferências, não de operação mensal.

## 6.7.1 Configurações devem conter

- [x] contas e cartões estruturais
- [x] categorias
- [x] regras de auto-categorização
- [x] preferências de interface
- [x] backup/exportação
- [x] densidade da interface
- [x] preferências gerais

## 6.7.2 O que deve sair de Configurações

- [x] orçamento mensal como fluxo principal
- [x] elementos de planejamento que exigem consulta frequente no mês
- [x] qualquer visão que o usuário precise acessar diariamente

## 6.7.3 Melhorias específicas

- [x] separar visualmente seções de estrutura, automação, aparência e backup
- [x] reduzir comprimento vertical excessivo
- [x] mover "zona de perigo" para fim com menos ruído visual
- [x] melhorar hierarquia informacional dos blocos

### Critério de aceite

- Configurações fica mais leve, mais lógica e menos misturada com fluxos operacionais

---

# 7. Redesign completo do fluxo “Lançar”

## 7.1 Problema atual

O modal mistura a ideia de lançamento rápido com um formulário já relativamente cheio. Ele ainda não assume se é quick add ou lançamento completo.

## 7.2 Diretriz

Criar dois níveis de entrada:

### Modo rápido

Deve permitir registrar em poucos segundos.

Campos obrigatórios mínimos:

- [x] valor
- [x] tipo
- [x] descrição
- [x] data
- [x] conta ou cartão
- [x] categoria

### Modo avançado

Campos adicionais:

- [x] pessoa relacionada
- [x] método
- [x] recorrência
- [x] parcelamento
- [x] reembolso
- [ ] observação
- [ ] tags
- [ ] anexos

## 7.3 Inteligência contextual obrigatória

- [x] Se abrir a partir de Cartões, pré-selecionar compra no cartão e cartão atual
- [x] Se abrir a partir de Patrimônio, pré-selecionar aporte/resgate
- [x] Se abrir a partir do Histórico, abrir neutro
- [x] Se o tipo for recorrente, mostrar campos relevantes
- [x] Se o tipo for parcelado, mostrar campos de parcelas
- [x] Se houver pessoa relacionada, permitir marcar como reembolso esperado

## 7.4 Melhorias de UX

- [x] Reduzir número de decisões iniciais no modal
- [x] Usar disclosure progressivo
- [x] Garantir foco no campo de valor ao abrir
- [x] Permitir submit com Enter
- [x] Garantir navegação por teclado consistente
- [x] Diferenciar visualmente ação rápida de ação avançada

### Critério de aceite

- O usuário consegue registrar um gasto comum em poucos segundos e só vê complexidade extra quando realmente precisa

---

# 8. Centro de recorrências, parcelas e compromissos

## Objetivo

Criar uma estrutura explícita para o que hoje está espalhado ou implícito demais.

## 8.1 O sistema precisa ter visões dedicadas para

- [ ] recorrências ativas
- [ ] parcelas futuras
- [ ] compromissos do mês
- [ ] vencimentos próximos
- [ ] pagamentos feitos
- [ ] pagamentos pendentes

## 8.2 Para recorrências

Cada item deve mostrar:

- [ ] descrição
- [ ] categoria
- [ ] valor esperado
- [ ] método de pagamento
- [ ] conta/cartão
- [ ] periodicidade
- [ ] próximo vencimento
- [ ] status
- [ ] última ocorrência

## 8.3 Para parcelas

Cada item deve mostrar:

- [ ] compra original
- [ ] categoria
- [ ] cartão
- [ ] parcela atual
- [ ] total de parcelas
- [ ] quantas faltam
- [ ] valor por parcela
- [ ] valor total da compra
- [ ] vencimento da próxima parcela

## 8.4 Para compromissos do mês

Cada item deve mostrar:

- [ ] tipo do compromisso
- [ ] descrição
- [ ] valor
- [ ] data
- [ ] conta/cartão
- [ ] status
- [ ] origem do compromisso

### Critério de aceite

- O usuário consegue ver com clareza tudo o que já consumiu o mês e tudo o que ainda vai consumir o mês

---

# 9. Reembolsos e despesas compartilhadas

## Objetivo

Modelar corretamente um caso real muito comum em finanças pessoais.

### Funcionalidades obrigatórias

- [ ] Associar pessoa relacionada a um lançamento
- [ ] Marcar se o valor é reembolsável
- [ ] Definir valor esperado de reembolso
- [ ] Registrar status: aguardando, parcial, recebido, cancelado
- [x] Mostrar reembolsos pendentes na Home
- [ ] Permitir filtro de reembolsos no Histórico

### Critério de aceite

- O usuário consegue distinguir dinheiro realmente gasto de valores ainda a receber de terceiros

---

# 10. Orçamento, metas e planejamento do mês

## Objetivo

Adicionar uma camada real de planejamento financeiro, sem esconder isso dentro de Configurações.

## 10.1 Orçamento mensal

- [x] Definir orçamento por categoria
- [x] Mostrar valor gasto vs limite
- [ ] Mostrar percentual consumido
- [x] Sinalizar categorias próximas do limite
- [x] Sinalizar categorias estouradas
- [x] Permitir drill-down para transações daquela categoria

## 10.2 Metas

- [ ] Meta de aporte mensal
- [ ] Meta de economia do mês
- [ ] Meta de patrimônio
- [ ] Meta customizada futura

## 10.3 Projeção do mês

- [x] saldo projetado até fim do mês
- [x] impacto de fixos pendentes
- [ ] impacto de parcelas futuras
- [x] impacto de faturas a vencer
- [ ] impacto de receitas previstas

### Critério de aceite

- O usuário deixa de ver apenas o passado e passa a enxergar o restante do mês com clareza

---

# 11. Layout desktop e sistema visual

## 11.1 Diretrizes de layout

- [ ] Adotar grid consistente para desktop
- [ ] Priorizar organização em múltiplas colunas
- [ ] Reduzir áreas vazias excessivas
- [ ] Criar hierarquia visual forte entre resumo e operação
- [ ] Manter sidebar fixa estável
- [ ] Padronizar cabeçalhos internos das páginas

## 11.2 Hierarquia visual

- [ ] KPIs compactos no topo
- [ ] conteúdo operacional principal logo abaixo
- [ ] cards apenas onde ajudam a resumir
- [ ] listas e tabelas nas áreas que exigem leitura comparativa

## 11.3 Densidade

Criar pelo menos 3 modos de densidade:

- [ ] confortável
- [ ] equilibrado
- [ ] denso

Cada modo deve ajustar:

- [ ] altura de linhas
- [ ] padding de cards
- [ ] altura de inputs
- [ ] densidade de tabelas

### Critério de aceite

- O usuário pode operar a aplicação em desktop com conforto visual ou com alta densidade, conforme preferência

---

# 12. Padrões de UX transversais

## 12.1 Drill-down obrigatório

Todo número importante deve levar a uma lista explicativa.

### Checklist

- [x] KPI de gastos leva ao Histórico filtrado
- [x] gasto por categoria leva à lista daquela categoria
- [x] valor da fatura leva às compras que a compõem
- [x] reembolso pendente leva à lista de reembolsos
- [x] parcela do mês leva à lista de parcelas relevantes

## 12.2 Consistência de ação

- [x] Botão global "Lançar" deve coexistir com ações locais sem redundância
- [x] Ações locais devem ser contextuais, não duplicadas desnecessariamente
- [x] Evitar ter vários botões que fazem essencialmente a mesma coisa

## 12.3 Tratamento de estado vazio

- [x] Toda área vazia deve explicar por que está vazia
- [x] Oferecer CTA contextual quando fizer sentido
- [x] Nunca exibir uma área aparentemente quebrada sem explicação

## 12.4 Feedback do sistema

- [x] Confirmar criação, edição e exclusão com feedback claro
- [x] Indicar loading sem travar mentalmente o usuário
- [x] Mostrar erro de forma útil e acionável

---

# 13. Consistência textual e semântica

## Checklist de UX writing

- [ ] Padronizar idioma para português em toda a interface
- [ ] Padronizar nomenclatura de valores, datas, status e tipos
- [ ] Diferenciar claramente “compra”, “fatura”, “pagamento de fatura”, “parcela”, “recorrência” e “transferência”
- [ ] Reduzir rótulos ambíguos como “ajustes” quando o sentido exato não estiver claro
- [ ] Escrever microtextos explicativos curtos, mas úteis

### Critério de aceite

- O usuário entende o significado de cada tela e cada dado sem depender de interpretação subjetiva

---

# 14. Acessibilidade e usabilidade técnica

## Itens obrigatórios

- [x] Navegação por teclado consistente
- [x] Foco visível em elementos interativos
- [x] Labels claros em inputs
- [x] Contraste suficiente nos estados e badges
- [x] Alvos de clique adequados
- [x] Feedback não dependente apenas de cor
- [x] Ordem lógica de tabulação

### Critério de aceite

- A aplicação é utilizável com teclado e apresenta boa legibilidade em ambiente desktop prolongado

---

# 15. Performance e percepção de velocidade

## Checklist

- [x] Carregar rápido a Home com dados do mês atual
- [x] Evitar renderizações pesadas desnecessárias em tabelas longas
- [x] Priorizar dados críticos acima da dobra
- [x] Adiar gráficos secundários se necessário
- [x] Garantir resposta rápida no modal de lançamento

### Critério de aceite

- O app parece ágil no uso diário e não transmite lentidão ao abrir telas principais

---

# 16. Ordem exata recomendada de execução

## Prioridade máxima

- [x] Corrigir modelo conceitual de ledger, cartões, faturas, parcelas e pagamentos
- [ ] Corrigir inconsistências entre compras e visão de cartões
- [x] Transformar Histórico em fonte operacional central

## Prioridade alta

- [x] Refazer Visão Geral para foco no mês
- [x] Criar blocos de fixos, parcelas, compromissos e últimas saídas
- [x] Implementar drill-down consistente
- [x] Redesenhar modal Lançar com modo rápido e avançado

## Prioridade média

- [x] Reestruturar área de Cartões
- [x] Simplificar Patrimônio
- [x] Reduzir protagonismo da tela de Contas
- [x] Mover elementos administrativos inadequados para Configurações

## Prioridade contínua

- [x] Melhorar densidade desktop
- [x] Ajustar microcopy
- [ ] Revisar acessibilidade
- [x] Refinar estados vazios, alertas e feedbacks

---

# 17. Critérios de sucesso do produto após refatoração

## Métricas qualitativas

- [x] A Home responde o mês atual com clareza
- [x] O Histórico explica qualquer número do sistema
- [ ] O usuário consegue entender cada cartão sem inconsistência
- [x] O app parece desktop-first e menos vertical
- [x] O lançamento rápido é realmente rápido
- [x] Há separação clara entre operação, planejamento e configuração

## Métricas de UX desejadas

- [x] Menos navegação desnecessária para responder perguntas do mês
- [x] Menos scroll para acessar informação relevante
- [x] Menos confusão entre gasto real, parcela e pagamento de fatura
- [x] Mais confiança na consistência dos números

---

# 18. Prompt operacional para um modelo de IA executar esta refatoração

## Instruções de execução

Use este plano como especificação obrigatória. Não trate os itens abaixo como sugestão superficial. Execute a refatoração respeitando integralmente os princípios, prioridades e critérios de aceite.

### Regras obrigatórias para a IA

- [x] Não alterar apenas estética; corrigir primeiro estrutura, modelo mental e consistência de dados
- [x] Considerar o ledger como fonte central de verdade
- [x] Garantir que toda agregação tenha rastreabilidade até uma lista de registros
- [x] Priorizar experiência desktop-first Windows
- [x] Reduzir scroll vertical e aumentar densidade útil
- [x] Usar cards para resumo e listas/tabelas para operação
- [x] Eliminar redundâncias entre telas e ações
- [x] Separar claramente operação, planejamento e configuração
- [x] Garantir consistência entre compras, cartões, faturas, parcelas e histórico
- [x] Padronizar toda interface em português

### Entregáveis esperados da IA

- [x] Proposta de nova arquitetura de informação
- [x] Revisão do modelo de dados e regras de negócio
- [x] Proposta de novas telas ou reorganização das telas atuais
- [x] Ajustes no fluxo de lançamento rápido
- [x] Reestruturação da Home
- [x] Reestruturação do Histórico
- [x] Reestruturação da área de Cartões
- [x] Simplificação de Relatórios/Planejamento
- [x] Simplificação de Patrimônio
- [x] Limpeza de Configurações
- [x] Melhoria da densidade e do layout desktop

### Requisito de saída da IA

A IA deve responder com:

- [x] diagnóstico do estado atual
- [x] decisões arquiteturais propostas
- [x] backlog priorizado
- [x] mudanças por tela
- [x] critérios de aceite por feature
- [x] riscos e trade-offs
- [x] proposta de implementação incremental

---

# 19. Backlog mestre resumido em checklist

## Estrutura e dados

## Estrutura e dados

- [x] Definir ledger como fonte única de verdade
- [x] Corrigir modelo de compra, fatura, parcela e pagamento de fatura
- [x] Garantir consistência entre agregados e listas detalhadas
- [x] Modelar recorrências, reembolsos e compromissos futuros corretamente

## Visão geral

- [x] Adicionar KPI de gastos fixos do mês
- [x] Adicionar KPI de parcelas do mês
- [x] Adicionar KPI de faturas a vencer
- [x] Adicionar KPI de livre para gastar
- [x] Criar lista de gastos fixos
- [x] Criar lista de parcelas do mês
- [x] Criar lista de últimas saídas do mês
- [x] Melhorar bloco de categorias com comparação a orçamento
- [x] Criar bloco de alertas e pendências

## Histórico

- [x] Tornar Histórico a tela operacional principal
- [x] Reduzir excesso de filtros visíveis
- [x] Criar presets úteis
- [x] Melhorar tabela e colunas
- [x] Adicionar status e revisão
- [ ] Preparar edição em lote futura

## Cartões

- [x] Corrigir consistência da aba de compras
- [x] Criar detalhe completo por cartão
- [x] Separar visão de faturas, compras e carteira
- [x] Reduzir destaque excessivo de ações destrutivas
- [x] Mover configurações estruturais pesadas para área adequada

## Planejamento/Relatórios

- [x] Trocar tela vazia de filtros por relatórios prontos
- [x] Adicionar relatórios mensais realmente úteis
- [x] Incluir projeção até o fim do mês
- [x] Permitir drill-down para o Histórico

## Patrimônio

- [x] Reduzir inflação visual da tela
- [x] Priorizar indicadores úteis
- [x] Manter aportes, resgates e movimentos com clareza

## Contas

- [x] Aumentar densidade da tela
- [x] Avaliar tabela ou list/details
- [x] Reduzir protagonismo operacional

## Configurações

- [x] Limpar escopo da tela
- [x] Manter apenas estrutura e preferências
- [x] Mover orçamento para fluxo de planejamento

## Lançamento rápido

- [x] Criar modo rápido
- [x] Criar modo avançado
- [x] Adicionar inteligência contextual
- [x] Melhorar navegação por teclado

## Sistema visual

- [x] Melhorar densidade desktop
- [x] Reduzir scroll vertical
- [x] Padronizar cabeçalhos e toolbars
- [x] Manter cards para resumo e tabelas para operação
- [x] Padronizar idioma em português

---

# 20. Definição final de pronto

A refatoração só deve ser considerada concluída quando os itens abaixo forem verdadeiros:

- [x] A Home explica claramente o mês atual
- [x] O Histórico é confiável e central
- [x] Compras de cartão aparecem corretamente onde devem aparecer
- [x] Fatura e pagamento de fatura não se confundem
- [x] O usuário consegue ver gastos fixos, parcelas e compromissos futuros com clareza
- [x] O app ficou mais horizontal e mais adequado para desktop
- [x] Configurações deixou de concentrar fluxos vivos do dia a dia
- [x] O fluxo de lançamento rápido ficou realmente rápido
- [x] Todos os números relevantes possuem drill-down para listas explicativas
- [x] A interface está consistente, mais densa e menos redundante
