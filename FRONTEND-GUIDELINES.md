# Frontend Guidelines — App de Finanças Pessoais v1.0

## 1. Princípios de Design e UX

- **Minimalismo e Foco nos Dados:** A interface deve "sair do caminho". Números e status (pago, pendente, atrasado) são os protagonistas. Menos bordas, mais uso de espaços em branco (whitespace) para separar elementos.
- **Entrada de Dados sem Fricção:** Como o objetivo é registrar gastos em menos de 10 segundos, os formulários devem ter auto-focus nos campos principais e suportar navegação por teclado (Enter para salvar, Tab para navegar).
- **Consistência Visual:** Uma única base de componentes (shadcn/ui) servindo tanto o Desktop completo (Tauri) quanto a visualização Mobile LAN.

## 2. Tech Stack de Frontend

- **Framework:** React (Vite).
- **Estilização:** Tailwind CSS (utilitário) + `shadcn/ui` (componentes acessíveis e customizáveis).
- **Ícones:** Lucide React (clean, peso de linha consistente, combina perfeitamente com shadcn).
- **Gráficos:** Recharts (fácil de estilizar com Tailwind e responsivo).
- **Animações/Motions:** Framer Motion (para transições de página fluidas e micro-interações).
- **Gerenciamento de Estado de UI:** Zustand (leve, dispensa boilerplate pesado).
- **Gerenciamento de Formulários:** React Hook Form + Zod (validação rápida e tipada).

## 3. Paleta de Cores (Tema: Deep Purple)

A identidade visual baseia-se nas cores que você escolheu, expandidas para criar contraste e hierarquia em modo Claro e Escuro.

| Papel (Tailwind)       | Hexadecimal | Uso sugerido                                                                   |
| ---------------------- | ----------- | ------------------------------------------------------------------------------ |
| **Primary (Brand)**    | `#3D0066`   | Botões principais, Header ativo, destaque forte no Light Mode.                 |
| **Primary Accent**     | `#8238B3`   | Hover de botões principais, linhas de gráficos, ícones em destaque.            |
| **Primary Light**      | `#DDBBFF`   | Backgrounds sutis para tags de categorias, seleção de itens ativos.            |
| **Background (Dark)**  | `#0B090F`   | Fundo principal da aplicação em Dark Mode (um preto com levíssimo toque roxo). |
| **Surface (Dark)**     | `#14111A`   | Fundo de Cards, Modais e Dropdowns no Dark Mode.                               |
| **Background (Light)** | `#FAFAFA`   | Fundo principal da aplicação em Light Mode.                                    |
| **Surface (Light)**    | `#FFFFFF`   | Fundo de Cards e Modais no Light Mode.                                         |

**Cores Semânticas (Feedback e Finanças):**

- **Sucesso (Entradas/Recebidos):** Emerald Green (`#10B981`) - Usado para PIX recebidos e saldos positivos.
- **Alerta/Aviso (Orçamento estourando):** Amber (`#F59E0B`) - Usado para faturas próximas do vencimento ou orçamento em **80%**.
- **Perigo/Saída (Gastos/Estourado):** Rose Red (`#E11D48`) - Usado para despesas ou alertas de orçamento excedido.
- **Neutro/Transferência:** Muted Purple/Gray (`#6B7280`) - Como transferências não afetam receitas/despesas, elas devem ter visual neutro e discreto.

## 4. Tipografia

Para um visual minimalista e numérico, fontes geométricas e legíveis são essenciais.

- **Fonte Principal (Sans-serif):** _Inter_ ou _Geist Sans_. Ambas têm excelente legibilidade para tabelas densas e dashboards.
- **Fonte Numérica (Monospaced opcional):** Para tabelas de transações e valores de saldo, usar `font-tabular-nums` do Tailwind para alinhar perfeitamente os numerais (ex: `R$ 1.250,00` e `R$   35,00` ficam alinhados).

## 5. Layout e Responsividade (Desktop vs Mobile)

Como definido no PRD, temos duas experiências derivando do mesmo código:

- **Desktop (Tauri):** \* **Sidebar Esquerda:** Navegação principal (Dashboard, Transações, Cartões, Fixos, Orçamentos).
- **Área Central:** Conteúdo com largura máxima contida (max-w-7xl) para não esticar excessivamente em monitores ultrawide.
- **Painel Lateral Direito (Opcional):** Para formulários de criação rápida sem sair da tela de contexto (Slide-over panel).

- **Mobile LAN (Navegador):** \* **Bottom Navigation Bar:** Apenas o essencial (Home, Transações, Cartões).
- **FAB (Floating Action Button):** Um grande botão central roxo (`#8238B3`) persistente para "Adicionar Gasto".
- **Cards empilhados:** Gráficos simplificados e listas de transações renderizadas como _Cards_ ou _List Items_ generosos para o toque do dedo, ocultando colunas secundárias da tabela.

## 6. Gráficos e Visualização de Dados (Recharts)

Os gráficos devem ser limpos, sem grid lines muito marcadas e sem bordas pesadas. - **Dashboard Mensal:** Usar um _AreaChart_ (gráfico de área) com gradiente suave começando no `#8238B3` sólido no topo e desvanecendo para transparente na base.

- **Tendência Semanal:** _BarChart_ com barras arredondadas (`radius={[4, 4, 0, 0]}`).
- **Orçamentos:** Progress Bars (Barras de progresso) da shadcn/ui. Se o consumo do mês estiver abaixo do limite, a barra é `#8238B3`; se exceder, vira `#E11D48`.
- **Tooltips:** Customizar o tooltip do Recharts para usar o card padrão do shadcn, mantendo a sombra suave e bordas arredondadas.

## 7. Animações e Micro-interações (Framer Motion)

O minimalismo se beneficia de movimentos sutis (motion) para indicar troca de estado, sem exagerar.

- **Transições de Rota:** Fade-in suave (`opacity: 0` para `1`) com um leve deslocamento vertical (`y: 10` para `0`) ao trocar de aba (duração: 0.2s).
- **Adição Rápida (Modal/Drawer):** O formulário de "Nova Transação" deve deslizar (slide) macio. No Mobile, desliza de baixo para cima (Drawer); no Desktop, abre um Modal centralizado com backdrop blur. - **Listas (Transações):** Ao confirmar uma pendência ou excluir um item, usar o `AnimatePresence` do Framer Motion para a linha desaparecer suavemente contraindo a altura (`height: 0`), em vez de sumir de forma brusca.
- **Feedback Háptico Visual:** Botões principais reduzem levemente de tamanho ao clicar (`whileTap={{ scale: 0.97 }}`).

## 8. Componentes shadcn/ui Essenciais

Para inicializar o projeto, estes são os componentes primordiais que você deve instalar:

- `Button`, `Input`, `Select`, `Popover` (para DatePicker).
- `Calendar` (para seleção de data das transações).
- `Table` (para desktop) e `Card` (para mobile).
- `Dialog` e `Sheet` (para formulários laterais/modais).
- `Tabs` (para alternar entre visões como "Caixa" e "Cartão").
