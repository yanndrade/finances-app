import "./styles.css";

import { Suspense, lazy, useEffect, useState } from "react";

import { AppShell } from "./components/app-shell";
import type { AppView } from "./components/sidebar";
import { ToastViewport, type AppToast } from "./components/toast-viewport";
import {
  createAccount,
  createCard,
  createCardPurchase,
  createCashTransaction,
  createTransfer,
  fetchAccounts,
  fetchCards,
  fetchDashboardSummary,
  fetchInvoices,
  fetchTransactions,
  payInvoice,
  resetApplicationData,
  updateAccount,
  updateCard,
  updateTransaction,
  voidTransaction,
  type AccountPayload,
  type AccountSummary,
  type CardPayload,
  type CardPurchasePayload,
  type CardSummary,
  type CardUpdatePayload,
  type AccountUpdatePayload,
  type CashTransactionPayload,
  type DashboardSummary,
  type InvoicePaymentPayload,
  type InvoiceSummary,
  type TransactionFilters,
  type TransactionSummary,
  type TransactionUpdatePayload,
  type TransferPayload,
} from "./lib/api";

const QuickAddComposer = lazy(async () => {
  const module = await import("./components/quick-add-composer");
  return { default: module.QuickAddComposer };
});

const AccountsView = lazy(async () => {
  const module = await import("./features/accounts/accounts-view");
  return { default: module.AccountsView };
});

const CardsView = lazy(async () => {
  const module = await import("./features/cards/cards-view");
  return { default: module.CardsView };
});

const DashboardView = lazy(async () => {
  const module = await import("./features/dashboard/dashboard-view");
  return { default: module.DashboardView };
});

const SettingsView = lazy(async () => {
  const module = await import("./features/settings/settings-view");
  return { default: module.SettingsView };
});

const TransactionsView = lazy(async () => {
  const module = await import("./features/transactions/transactions-view");
  return { default: module.TransactionsView };
});

const EMPTY_TRANSACTION_FILTERS: TransactionFilters = {
  from: "",
  to: "",
  category: "",
  account: "",
  method: "",
  person: "",
  text: "",
};

const VIEW_META: Record<
  AppView,
  {
    title: string;
    description: string;
  }
> = {
  dashboard: {
    title: "Vis\u00E3o geral",
    description: "Resumo mensal e pontos de atencao.",
  },
  transactions: {
    title: "Transa\u00E7\u00F5es",
    description: "Filtro, ajuste e hist\u00F3rico.",
  },
  accounts: {
    title: "Contas",
    description: "Saldos e estrutura da carteira.",
  },
  cards: {
    title: "Cart\u00F5es",
    description: "Faturas, ciclos e compras.",
  },
  settings: {
    title: "Configura\u00E7\u00F5es",
    description: "Ferramentas e prefer\u00EAncias.",
  },
};

const TOAST_DURATION_MS = {
  success: 3200,
  error: 5200,
} as const;

export function App() {
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>(
    EMPTY_TRANSACTION_FILTERS,
  );
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [toast, setToast] = useState<AppToast>(null);

  useEffect(() => {
    void refreshData({ month: selectedMonth });
  }, [selectedMonth]);

  useEffect(() => {
    if (toast === null) {
      return;
    }

    const timeout = globalThis.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, TOAST_DURATION_MS[toast.tone]);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [toast]);

  function showToast(tone: "success" | "error", message: string) {
    setToast({
      id: Date.now(),
      tone,
      message,
    });
  }

  async function refreshData(options?: { month?: string; filters?: TransactionFilters }) {
    const month = options?.month ?? selectedMonth;
    const filters = options?.filters ?? transactionFilters;

    setLoading(true);

    try {
      const [nextCards, nextInvoices, nextDashboard, nextAccounts, nextTransactions] = await Promise.all([
        fetchCards(),
        fetchInvoices(),
        fetchDashboardSummary(month),
        fetchAccounts(),
        fetchTransactions(filters),
      ]);

      setCards(nextCards);
      setInvoices(nextInvoices);
      setDashboard(nextDashboard);
      setAccounts(nextAccounts);
      setTransactions(nextTransactions);
      setTransactionFilters(filters);
    } catch (error) {
      showToast("error", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function runMutation(
    action: () => Promise<unknown>,
    successMessage: string,
    options?: {
      filters?: TransactionFilters;
    },
  ): Promise<boolean> {
    setIsSubmitting(true);
    setToast(null);

    try {
      await action();
      await refreshData({ filters: options?.filters });
      showToast("success", successMessage);
      return true;
    } catch (error) {
      showToast("error", getErrorMessage(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTransactionSubmit(payload: CashTransactionPayload): Promise<void> {
    const wasSuccessful = await runMutation(
      () => createCashTransaction(payload),
      "Transa\u00e7\u00e3o registrada com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel registrar a transacao.");
    }
  }

  async function handleTransferSubmit(payload: TransferPayload): Promise<void> {
    if (payload.fromAccountId === payload.toAccountId) {
      showToast("error", "Selecione contas diferentes para a transfer\u00eancia.");
      throw new Error("Selecione contas diferentes para a transferencia.");
    }

    const wasSuccessful = await runMutation(
      () => createTransfer(payload),
      "Transfer\u00eancia registrada com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel registrar a transferencia.");
    }
  }

  async function handleCreateAccount(payload: AccountPayload): Promise<void> {
    await runMutation(() => createAccount(payload), "Conta criada com sucesso.");
  }

  async function handleCreateCard(payload: CardPayload): Promise<void> {
    const wasSuccessful = await runMutation(
      () => createCard(payload),
      "Cartao criado com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel criar o cartao.");
    }
  }

  async function handleUpdateAccount(
    accountId: string,
    payload: AccountUpdatePayload,
  ): Promise<void> {
    await runMutation(
      () => updateAccount(accountId, payload),
      "Conta atualizada com sucesso.",
    );
  }

  async function handleUpdateCard(cardId: string, payload: CardUpdatePayload): Promise<void> {
    const wasSuccessful = await runMutation(
      () => updateCard(cardId, payload),
      "Cartao atualizado com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel atualizar o cartao.");
    }
  }

  async function handleCreateCardPurchase(payload: CardPurchasePayload): Promise<void> {
    const wasSuccessful = await runMutation(
      () => createCardPurchase(payload),
      "Compra no cartao registrada com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel registrar a compra no cartao.");
    }
  }

  async function handlePayInvoice(payload: InvoicePaymentPayload): Promise<void> {
    const wasSuccessful = await runMutation(
      () => payInvoice(payload),
      "Pagamento de fatura registrado com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel registrar o pagamento da fatura.");
    }
  }

  async function handleApplyTransactionFilters(filters: TransactionFilters): Promise<void> {
    await refreshData({ filters });
  }

  async function handleUpdateTransaction(
    transactionId: string,
    payload: TransactionUpdatePayload,
  ): Promise<void> {
    await runMutation(
      () => updateTransaction(transactionId, payload),
      "Transacao atualizada com sucesso.",
    );
  }

  async function handleVoidTransaction(transactionId: string): Promise<void> {
    await runMutation(
      () => voidTransaction(transactionId),
      "Transacao estornada com sucesso.",
    );
  }

  async function handleResetAllData(): Promise<void> {
    if (!globalThis.confirm("Isso vai apagar todos os dados da aplicacao. Deseja continuar?")) {
      return;
    }

    const wasSuccessful = await runMutation(
      () => resetApplicationData(),
      "Aplicacao zerada com sucesso.",
    );

    if (wasSuccessful) {
      setActiveView("dashboard");
    }
  }

  const activeMeta = VIEW_META[activeView];

  return (
    <AppShell
      activeView={activeView}
      description={activeMeta.description}
      onNavigate={setActiveView}
      onOpenQuickAdd={() => setIsQuickAddOpen(true)}
      title={activeMeta.title}
    >
      <Suspense fallback={<ViewFallback activeView={activeView} />}>
        {activeView === "dashboard" ? (
          <DashboardView
            accounts={accounts}
            dashboard={dashboard}
            loading={loading}
            month={selectedMonth}
            onMonthChange={setSelectedMonth}
            onNavigate={setActiveView}
            onOpenQuickAdd={() => setIsQuickAddOpen(true)}
            onUpdateTransaction={(transactionId, updates) => {
              if (updates.description !== undefined) {
                void runMutation(
                  () =>
                    updateTransaction(transactionId, {
                      description: updates.description ?? "",
                    } as TransactionUpdatePayload),
                  "Descricao atualizada com sucesso.",
                );
              }
            }}
            transactions={transactions}
          />
        ) : null}

        {activeView === "transactions" ? (
          <TransactionsView
            accounts={accounts}
            filters={transactionFilters}
            isSubmitting={isSubmitting}
            onApplyFilters={handleApplyTransactionFilters}
            onUpdateTransaction={handleUpdateTransaction}
            onVoidTransaction={handleVoidTransaction}
            transactions={transactions}
          />
        ) : null}

        {activeView === "accounts" ? (
          <AccountsView
            accounts={accounts}
            isSubmitting={isSubmitting}
            onCreateAccount={handleCreateAccount}
            onUpdateAccount={handleUpdateAccount}
          />
        ) : null}

        {activeView === "cards" ? (
          <CardsView
            accounts={accounts}
            cards={cards}
            invoices={invoices}
            isSubmitting={isSubmitting}
            onCreateCard={handleCreateCard}
            onCreateCardPurchase={handleCreateCardPurchase}
            onPayInvoice={handlePayInvoice}
            onUpdateCard={handleUpdateCard}
          />
        ) : null}

        {activeView === "settings" ? (
          <SettingsView
            isSubmitting={isSubmitting}
            onResetApplicationData={handleResetAllData}
          />
        ) : null}
      </Suspense>

      <ToastViewport
        onDismiss={() => setToast(null)}
        toast={toast}
      />

      {isQuickAddOpen ? (
        <Suspense fallback={null}>
          <QuickAddComposer
            isOpen={isQuickAddOpen}
            onClose={() => setIsQuickAddOpen(false)}
            accounts={accounts}
            cards={cards}
            invoices={invoices}
            onSubmitTransaction={async (payload) => {
              await handleTransactionSubmit(payload);
            }}
            onSubmitTransfer={async (payload) => {
              await handleTransferSubmit(payload);
            }}
            onSubmitCardPurchase={async (payload) => {
              await handleCreateCardPurchase(payload);
            }}
            onSubmitInvoicePayment={async (payload) => {
              await handlePayInvoice(payload);
            }}
            isSubmitting={isSubmitting}
          />
        </Suspense>
      ) : null}
    </AppShell>
  );
}

function ViewFallback({ activeView }: { activeView: AppView }) {
  if (activeView === "dashboard") {
    return (
      <div className="space-y-8" aria-hidden="true">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="h-32 rounded-[2rem] bg-slate-200 animate-pulse" />
          <div className="h-32 rounded-[2rem] bg-slate-200 animate-pulse" />
          <div className="h-32 rounded-[2rem] bg-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] bg-white p-8 shadow-sm" aria-hidden="true">
      <div className="h-5 w-40 rounded-full bg-slate-200 animate-pulse" />
    </div>
  );
}

function currentMonth(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${now.getFullYear()}-${month}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Nao foi possivel concluir a operacao.";
}
