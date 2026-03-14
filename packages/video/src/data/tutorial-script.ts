export const TRANSITION_DURATION = 18;

export const TUTORIAL_SCENES = [
  {
    id: "intro",
    kicker: "Primeiro uso",
    title: "Meu Cofri sem atrito",
    caption:
      "Privacidade, velocidade e rastreabilidade para controlar caixa, cartao e compromissos do mes.",
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
    title: "Lancamento em segundos",
    caption:
      "PIX, debito ou dinheiro entram rapido. O saldo muda na hora, sem fluxo pesado.",
    durationInFrames: 240,
  },
  {
    id: "cards",
    kicker: "Diferencial",
    title: "Caixa e cartao nao se misturam",
    caption:
      "Compras no credito abastecem a fatura futura, mas nao reduzem o saldo bancario ate o pagamento.",
    durationInFrames: 330,
  },
  {
    id: "recurring",
    kicker: "Automacao",
    title: "Fixos viram pendencias",
    caption:
      "Assinaturas e contas mensais aparecem automaticamente para voce so confirmar quando pagar.",
    durationInFrames: 270,
  },
  {
    id: "reimbursements",
    kicker: "Cobrancas",
    title: "Reembolsos nao passam batido",
    caption:
      "Compras para terceiros ficam em A Receber e, quando o valor volta, o app registra a entrada no caixa.",
    durationInFrames: 270,
  },
  {
    id: "budgets",
    kicker: "Disciplina",
    title: "Orcamentos por categoria",
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
      "Dashboard, faturas, pendencias e patrimonio ficam alinhados em uma visao simples de operar.",
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
