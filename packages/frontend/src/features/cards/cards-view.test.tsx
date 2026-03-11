import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as api from "../../lib/api";
import { CardsView } from "./cards-view";

function installDialogEnvironment() {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })),
  );
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: vi.fn(() => false),
  });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
}

const defaultAccounts: api.AccountSummary[] = [
  {
    account_id: "acc-1",
    name: "Conta principal",
    type: "checking",
    initial_balance: 0,
    is_active: true,
    current_balance: 0,
  },
];

const defaultCards: api.CardSummary[] = [
  {
    card_id: "card-1",
    name: "Cartao Azul",
    limit: 100_000,
    closing_day: 10,
    due_day: 20,
    payment_account_id: "acc-1",
    is_active: true,
    future_installment_total: 0,
  },
];

const defaultInvoices: api.InvoiceSummary[] = [
  {
    invoice_id: "card-1:2026-03",
    card_id: "card-1",
    reference_month: "2026-03",
    closing_date: "2026-03-10",
    due_date: "2026-03-20",
    total_amount: 90_00,
    paid_amount: 20_00,
    remaining_amount: 70_00,
    purchase_count: 3,
    status: "open",
  },
];

function renderCardsView(
  overrides: Partial<ComponentProps<typeof CardsView>> = {},
) {
  const onCreateCard = overrides.onCreateCard ?? vi.fn(() => Promise.resolve());
  const onOpenLedgerFiltered = overrides.onOpenLedgerFiltered ?? vi.fn();
  const onOpenQuickAdd = overrides.onOpenQuickAdd ?? vi.fn();
  const onOpenSettings = overrides.onOpenSettings ?? vi.fn();
  const onSetCardActive = overrides.onSetCardActive ?? vi.fn(() => Promise.resolve());
  const onUpdateCard = overrides.onUpdateCard ?? vi.fn(() => Promise.resolve());

  render(
    <CardsView
      accounts={overrides.accounts ?? defaultAccounts}
      cards={overrides.cards ?? defaultCards}
      invoices={overrides.invoices ?? defaultInvoices}
      selectedMonth={overrides.selectedMonth ?? "2026-03"}
      isSubmitting={overrides.isSubmitting ?? false}
      onCreateCard={onCreateCard}
      onOpenLedgerFiltered={onOpenLedgerFiltered}
      onOpenQuickAdd={onOpenQuickAdd}
      onOpenSettings={onOpenSettings}
      onSetCardActive={onSetCardActive}
      onUpdateCard={onUpdateCard}
      uiDensity={overrides.uiDensity ?? "compact"}
    />,
  );

  return {
    onCreateCard,
    onOpenLedgerFiltered,
    onOpenQuickAdd,
    onSetCardActive,
    onUpdateCard,
  };
}

describe("CardsView", () => {
  beforeEach(() => {
    installDialogEnvironment();
    vi.spyOn(api, "fetchCardInstallments").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("visão principal (aggregate)", () => {
    it("exibe o resumo do mês com as 3 métricas", () => {
      renderCardsView();

      expect(screen.getByText(/total do mês/i)).toBeInTheDocument();
      expect(screen.getByText(/já pago/i)).toBeInTheDocument();
      expect(screen.getByText(/a pagar/i)).toBeInTheDocument();
    });

    it("exibe a lista de cartões com nome, fatura e limite", () => {
      renderCardsView();

      // O nome do cartão aparece na lista
      expect(screen.getAllByText("Cartao Azul").length).toBeGreaterThanOrEqual(1);
      // Labels do card-list
      expect(screen.getByText(/^fatura$/i)).toBeInTheDocument();
      expect(screen.getByText(/^limite$/i)).toBeInTheDocument();
    });

    it("exibe mensagem vazia quando não há cartões ativos", () => {
      renderCardsView({ cards: [] });

      expect(screen.getByText(/nenhum cartão ativo encontrado/i)).toBeInTheDocument();
    });

    it("abre o detalhe do cartão ao clicar em Detalhes", async () => {
      const user = userEvent.setup();
      renderCardsView();

      await user.click(screen.getByRole("button", { name: /detalhes/i }));

      // No CardDetail: mostra nome do cartão (h2) e botão de pagar fatura
      expect(screen.getByRole("heading", { name: "Cartao Azul" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /pagar fatura/i })).toBeInTheDocument();
    });

    it("chama onOpenLedgerFiltered ao clicar em Histórico no card", async () => {
      const user = userEvent.setup();
      const { onOpenLedgerFiltered } = renderCardsView();

      await user.click(screen.getByRole("button", { name: /histórico/i }));

      expect(onOpenLedgerFiltered).toHaveBeenCalledWith(
        expect.objectContaining({ card: "card-1" }),
        "2026-03",
      );
    });
  });

  describe("detalhe do cartão (card scope)", () => {
    // Helper: navegar para o detalhe clicando em "Detalhes"
    async function goToDetail(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole("button", { name: /detalhes/i }));
      // Aguarda o CardDetail renderizar
      await screen.findByRole("button", { name: /pagar fatura/i });
    }

    it("abre o pagamento de fatura com o invoice id correto", async () => {
      const user = userEvent.setup();
      const { onOpenQuickAdd } = renderCardsView();

      await goToDetail(user);
      await user.click(screen.getByRole("button", { name: /pagar fatura/i }));

      expect(onOpenQuickAdd).toHaveBeenCalledWith("transfer_invoice_payment", {
        invoiceId: "card-1:2026-03",
      });
    });

    it("volta para visão geral ao clicar no botão de voltar", async () => {
      const user = userEvent.setup();
      renderCardsView();

      await goToDetail(user);

      await user.click(screen.getByRole("button", { name: /voltar para visão geral/i }));

      expect(screen.getByText(/total do mês/i)).toBeInTheDocument();
    });

    it("abre o histórico filtrado ao clicar em Ver no histórico no detalhe", async () => {
      const user = userEvent.setup();
      const { onOpenLedgerFiltered } = renderCardsView();

      await goToDetail(user);
      await user.click(screen.getByRole("button", { name: /ver no histórico/i }));

      expect(onOpenLedgerFiltered).toHaveBeenCalledWith(
        expect.objectContaining({ card: "card-1", period: "month" }),
        "2026-03",
      );
    });

    it("exibe parcelas futuras no detalhe do cartão", async () => {
      const user = userEvent.setup();
      vi.spyOn(api, "fetchCardInstallments").mockResolvedValue([
        {
          installment_id: "purchase-1:2",
          purchase_id: "purchase-1",
          card_id: "card-1",
          purchase_date: "2026-03-01T12:00:00Z",
          due_date: "2026-04-20",
          reference_month: "2026-04",
          category_id: "electronics",
          description: "Notebook",
          installment_number: 2,
          installments_count: 3,
          amount: 33_33,
          invoice_id: "card-1:2026-04",
        },
      ]);

      renderCardsView();

      await goToDetail(user);

      // Aguarda o carregamento das parcelas
      expect(await screen.findByText(/parcelas futuras/i)).toBeInTheDocument();
      // O mês aparece como cabeçalho do grupo
      expect(screen.getByText("2026-04")).toBeInTheDocument();
    });

    it("exibe erros de carregamento dos itens da fatura", async () => {
      const user = userEvent.setup();
      vi.spyOn(api, "fetchInvoiceItems").mockRejectedValue(new Error("network"));

      renderCardsView();

      await goToDetail(user);
      await user.click(screen.getByRole("button", { name: /itens da fatura/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/nao foi possivel carregar os itens da fatura/i),
        ).toBeInTheDocument();
      });
    });

    it("carrega os itens da fatura ao clicar no botão", async () => {
      const user = userEvent.setup();
      const fetchInvoiceItems = vi.spyOn(api, "fetchInvoiceItems").mockResolvedValue([
        {
          invoice_item_id: "purchase-1:1",
          invoice_id: "card-1:2026-03",
          purchase_id: "purchase-1",
          card_id: "card-1",
          purchase_date: "2026-03-01T12:00:00Z",
          category_id: "food",
          description: "Mercado",
          installment_number: 1,
          installments_count: 1,
          amount: 90_00,
        },
      ]);

      renderCardsView();

      await goToDetail(user);
      await user.click(screen.getByRole("button", { name: /itens da fatura/i }));

      await waitFor(() => {
        expect(fetchInvoiceItems).toHaveBeenCalledWith("card-1:2026-03");
      });
    });
  });

  describe("gerenciar cartões (drawer)", () => {
    it("abre o drawer de gerenciamento ao clicar em Gerenciar", async () => {
      const user = userEvent.setup();
      renderCardsView();

      // Clicar no botão pelo title para evitar ambiguidade com o título do drawer
      await user.click(screen.getByTitle(/gerenciar cartões/i));

      expect(screen.getAllByText(/gerenciar cartões/i).length).toBeGreaterThanOrEqual(1);
    });

    it("permite criar um cartão via drawer de gerenciamento", async () => {
      const user = userEvent.setup();
      const { onCreateCard } = renderCardsView();

      await user.click(screen.getByTitle(/gerenciar cartões/i));
      await user.click(screen.getByRole("button", { name: /^novo$/i }));
      expect((screen.getByLabelText(/limite total/i) as HTMLInputElement).value).toMatch(/R\$\s*0,00/);
      expect(screen.getByText(/pode ficar em branco/i)).toBeInTheDocument();
      await user.type(screen.getByLabelText(/nome do cart.o/i), "Cartao Verde");
      await user.clear(screen.getByLabelText(/limite total/i));
      await user.type(screen.getByLabelText(/limite total/i), "250000");
      await user.clear(screen.getByLabelText(/dia de fechamento/i));
      await user.type(screen.getByLabelText(/dia de fechamento/i), "15");
      await user.clear(screen.getByLabelText(/dia de vencimento/i));
      await user.type(screen.getByLabelText(/dia de vencimento/i), "25");
      await user.click(screen.getByRole("button", { name: /criar cartão/i }));

      await waitFor(() => {
        expect(onCreateCard).toHaveBeenCalledWith({
          name: "Cartao Verde",
          limitInCents: 250000,
          closingDay: 15,
          dueDay: 25,
          paymentAccountId: undefined,
        });
      });
    });

    it("permite editar um cartão via drawer de gerenciamento", async () => {
      const user = userEvent.setup();
      const onUpdateCard = vi.fn(() => Promise.resolve());

      renderCardsView({ onUpdateCard });

      await user.click(screen.getByTitle(/gerenciar cartões/i));
      await user.click(screen.getByRole("button", { name: /editar/i }));
      await user.clear(screen.getByLabelText(/limite total/i));
      await user.type(screen.getByLabelText(/limite total/i), "150000");
      await user.click(screen.getByRole("button", { name: /salvar cartão/i }));

      await waitFor(() => {
        expect(onUpdateCard).toHaveBeenCalledWith("card-1", {
          name: "Cartao Azul",
          limitInCents: 150000,
          closingDay: 10,
          dueDay: 20,
          paymentAccountId: "acc-1",
          isActive: true,
        });
      });
    });

    it("permite desativar um cartão via drawer de gerenciamento", async () => {
      const user = userEvent.setup();
      const confirmMock = vi.fn(() => true);
      vi.stubGlobal("confirm", confirmMock);
      const { onSetCardActive } = renderCardsView();

      await user.click(screen.getByTitle(/gerenciar cartões/i));
      await user.click(screen.getByRole("button", { name: /desativar/i }));

      expect(confirmMock).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(onSetCardActive).toHaveBeenCalledWith(defaultCards[0], false);
      });
    });
  });
});
