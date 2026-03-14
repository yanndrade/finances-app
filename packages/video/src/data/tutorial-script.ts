export const TRANSITION_DURATION = 18;

export const TUTORIAL_SCENES = [
  {
    id: "intro",
    kicker: "Primeiro uso",
    title: "Meu Cofri sem atrito",
    caption:
      "Privacidade, velocidade e rastreabilidade para controlar caixa, cartão e compromissos do mes.",
    durationInFrames: 180,
  },
  {
    id: "accounts",
    kicker: "Passo 1",
    title: "Comece pelas contas",
    caption:
      "Cadastre banco, carteira ou corretora com o saldo inicial. Esse valor forma o seu caixa real.",
    durationInFrames: 270,
  },
  {
    id: "quick-entry",
    kicker: "Passo 2",
    title: "Lançamento em segundos",
    caption:
      "PIX, débito ou dinheiro entram rápido. O saldo muda na hora, sem fluxo pesado.",
    durationInFrames: 240,
  },
  {
    id: "cards",
    kicker: "Diferencial",
    title: "Caixa e cartão não se misturam",
    caption:
      "Compras no crédito abastecem a fatura futura, mas não reduzem o saldo bancário até o pagamento.",
    durationInFrames: 330,
  },
  {
    id: "recurring",
    kicker: "Automação",
    title: "Fixos viram pendencias",
    caption:
      "Assinaturas e contas mensais aparecem automaticamente para voce so confirmar quando pagar.",
    durationInFrames: 270,
  },
  {
    id: "reimbursements",
    kicker: "Cobranças",
    title: "Reembolsos nao passam batido",
    caption:
      "Compras para terceiros ficam em A Receber e, quando o valor volta, o app registra a entrada no caixa.",
    durationInFrames: 270,
  },
  {
    id: "budgets",
    kicker: "Disciplina",
    title: "Orçamentos por categoria",
    caption:
      "O consumo do mes, inclusive do cartao, conversa com os limites e destaca excessos com clareza.",
    durationInFrames: 240,
  },
  {
    id: "lan",
    kicker: "Mobilidade",
    title: "Use no celular pela sua rede",
    caption:
      "Ative o modo LAN, leia o QR Code e lance gastos pelo navegador do telefone sem depender de nuvem.",
    durationInFrames: 270,
  },
  {
    id: "outro",
    kicker: "Resumo",
    title: "Seus dados, seu controle",
    caption:
      "Dashboard, faturas, pendências e patrimônio ficam alinhados em uma visão simples de operar.",
    durationInFrames: 180,
  },
] as const;

export type TutorialScene = (typeof TUTORIAL_SCENES)[number];

export const TUTORIAL_TOTAL_DURATION = TUTORIAL_SCENES.reduce(
  (total, scene, index) =>
    total +
    scene.durationInFrames -
    (index === 0 ? 0 : TRANSITION_DURATION),
  0,
);
