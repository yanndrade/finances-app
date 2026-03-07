import "./styles.css";

import { Suspense, lazy, useEffect, useState } from "react";

import { AppShell } from "./components/app-shell";
import { CommandPalette } from "./components/command-palette";
import type { QuickAddPreset } from "./components/quick-add-composer";
import type { AppView } from "./components/sidebar";
import { ToastViewport, type AppToast } from "./components/toast-viewport";
import { useAppDataOrchestrator } from "./features/app/use-app-data-orchestrator";
import {
  createCategoryOption,
  readStoredCategoryOptions,
  storeCategoryOptions,
  type CategoryOption,
} from "./lib/categories";
import {
  createAccount,
  createCard,
  createCardPurchase,
  createCashTransaction,
  createInvestmentMovement,
  createTransfer,
  fetchBackupSnapshot,
  markReimbursementReceived,
  payInvoice,
  resetApplicationData,
  updateAccount,
  updateCard,
  updateTransaction,
  voidTransaction,
  type AccountSummary,
  type AccountPayload,
  type AccountUpdatePayload,
  type CardSummary,
  type CardPayload,
  type CardPurchasePayload,
  type CardUpdatePayload,
  type CashTransactionPayload,
  type InvoicePaymentPayload,
  type InvestmentMovementPayload,
  type InvestmentView,
  type InvoiceSummary,
  type TransactionPatchPayload,
  type TransactionFilters,
  type TransferPayload,
} from "./lib/api";
import {
  currentDate,
  currentMonth,
  monthFirstDay,
  monthLastDay,
} from "./lib/date-filters";
import type { UiDensity } from "./lib/ui-density";

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

const ReportsView = lazy(async () => {
  const module = await import("./features/reports/reports-view");
  return { default: module.ReportsView };
});

const SettingsView = lazy(async () => {
  const module = await import("./features/settings/settings-view");
  return { default: module.SettingsView };
});

const InvestmentsView = lazy(async () => {
  const module = await import("./features/investments/investments-view");
  return { default: module.InvestmentsView };
});

const TransactionsView = lazy(async () => {
  const module = await import("./features/transactions/transactions-view");
  return { default: module.TransactionsView };
});

const EMPTY_TRANSACTION_FILTERS: TransactionFilters = {
  period: "month",
  reference: currentDate(),
  from: "",
  to: "",
  type: undefined,
  category: "",
  account: "",
  card: "",
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
    title: "Visão geral",
    description: "Resumo mensal e pontos de atenção.",
  },
  reports: {
    title: "Planejamento",
    description: "Orçamento, compromissos e relatórios prontos do mês.",
  },
  investments: {
    title: "Patrimônio & investimentos",
    description: "Composição patrimonial, aportes e rendimento.",
  },
  transactions: {
    title: "Histórico",
    description: "Filtro, ajuste e linha do tempo financeira.",
  },
  accounts: {
    title: "Contas",
    description: "Saldos e estrutura da carteira.",
  },
  cards: {
    title: "Cartões",
    description: "Faturas, ciclos e compras.",
  },
  settings: {
    title: "Configurações",
    description: "Ferramentas e preferências.",
  },
};

const TOAST_DURATION_MS = {
  success: 3200,
  error: 5200,
} as const;
const DEFAULT_UI_DENSITY: UiDensity = "compact";

export function App() {
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>(() =>
    readStoredCategoryOptions(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [quickAddPreset, setQuickAddPreset] = useState<QuickAddPreset | undefined>(undefined);
  const [quickAddInvoiceId, setQuickAddInvoiceId] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<AppToast>(null);

  const {
    dashboard,
    accounts,
    cards,
    invoices,
    transactions,
    reportSummary,
    investmentOverview,
    investmentMovements,
    investmentView,
    investmentFromDate,
    investmentToDate,
    transactionFilters,
    loading: isDataLoading,
    refreshData,
  } = useAppDataOrchestrator({
    activeView,
    selectedMonth,
    initialTransactionFilters: EMPTY_TRANSACTION_FILTERS,
    initialInvestmentView: "monthly",
    initialInvestmentFromDate: monthFirstDay(currentMonth()),
    initialInvestmentToDate: monthLastDay(currentMonth()),
    onError: (error) => {
      showToast("error", getErrorMessage(error));
    },
  });

  useEffect(() => {
    void refreshData({ month: selectedMonth });
  }, [selectedMonth]);

  useEffect(() => {
    if (activeView !== "reports") {
      return;
    }

    void refreshData({ includeReport: true });
  }, [activeView]);

  useEffect(() => {
    storeCategoryOptions(categoryOptions);
  }, [categoryOptions]);

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

  function openQuickAdd(
    preset?: QuickAddPreset,
    options?: { invoiceId?: string },
  ) {
    setIsCommandPaletteOpen(false);
    setQuickAddPreset(preset);
    setQuickAddInvoiceId(options?.invoiceId);
    setIsQuickAddOpen(true);
  }

  function openCommandPalette() {
    setIsCommandPaletteOpen(true);
  }

  function openLedgerWithFilters(
    filters: Partial<TransactionFilters>,
    monthOverride?: string,
  ) {
    const targetMonth = monthOverride ?? selectedMonth;
    const hasExplicitRange =
      typeof filters.from === "string" &&
      filters.from.length > 0 &&
      typeof filters.to === "string" &&
      filters.to.length > 0;
    const nextFilters: TransactionFilters = {
      ...EMPTY_TRANSACTION_FILTERS,
      reference: `${targetMonth}-01`,
      ...filters,
      period: hasExplicitRange ? "custom" : (filters.period ?? "month"),
    };

    setActiveView("transactions");
    void refreshData({
      month: targetMonth,
      filters: nextFilters,
      includeReport: false,
    });
  }

  async function runMutation(
    action: () => Promise<unknown>,
    successMessage: string,
    options?: {
      filters?: TransactionFilters;
      includeReport?: boolean;
    },
  ): Promise<boolean> {
    setIsSubmitting(true);
    setToast(null);

    try {
      await action();
      await refreshData({
        filters: options?.filters,
        includeReport: options?.includeReport,
      });
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
      "Transação registrada com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel registrar a transacao.");
    }
  }

  async function handleTransferSubmit(payload: TransferPayload): Promise<void> {
    if (payload.fromAccountId === payload.toAccountId) {
      showToast("error", "Selecione contas diferentes para a transferência.");
      throw new Error("Selecione contas diferentes para a transferencia.");
    }

    const wasSuccessful = await runMutation(
      () => createTransfer(payload),
      "Transferência registrada com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel registrar a transferencia.");
    }
  }

  async function handleCreateAccount(payload: AccountPayload): Promise<void> {
    const wasSuccessful = await runMutation(
      () => createAccount(payload),
      "Conta criada com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel criar a conta.");
    }
  }

  async function handleUpdateAccount(
    accountId: string,
    payload: AccountUpdatePayload,
  ): Promise<void> {
    const wasSuccessful = await runMutation(
      () => updateAccount(accountId, payload),
      "Conta atualizada com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel atualizar a conta.");
    }
  }

  async function handleSetAccountActive(
    account: AccountSummary,
    isActive: boolean,
  ): Promise<void> {
    if (!isActive && account.is_active && accounts.filter((item) => item.is_active).length === 1) {
      showToast("error", "Mantenha ao menos uma conta ativa.");
      return;
    }

    const wasSuccessful = await runMutation(
      () =>
        updateAccount(account.account_id, {
          name: account.name,
          type: account.type as AccountPayload["type"],
          initialBalanceInCents: account.initial_balance,
          isActive,
        }),
      isActive ? "Conta reativada com sucesso." : "Conta removida da operação ativa.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel atualizar a conta.");
    }
  }

  async function handleCreateCard(payload: CardPayload): Promise<void> {
    const wasSuccessful = await runMutation(
      () => createCard(payload),
      "Cartão criado com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel criar o cartao.");
    }
  }

  async function handleUpdateCard(cardId: string, payload: CardUpdatePayload): Promise<void> {
    const wasSuccessful = await runMutation(
      () => updateCard(cardId, payload),
      "Cartão atualizado com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel atualizar o cartao.");
    }
  }

  async function handleSetCardActive(card: CardSummary, isActive: boolean): Promise<void> {
    const wasSuccessful = await runMutation(
      () =>
        updateCard(card.card_id, {
          name: card.name,
          limitInCents: card.limit,
          closingDay: card.closing_day,
          dueDay: card.due_day,
          paymentAccountId: card.payment_account_id,
          isActive,
        }),
      isActive ? "Cartão reativado com sucesso." : "Cartão removido da operação ativa.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel atualizar o cartao.");
    }
  }

  async function handleCreateCardPurchase(payload: CardPurchasePayload): Promise<void> {
    const wasSuccessful = await runMutation(
      () => createCardPurchase(payload),
      "Compra no cartão registrada com sucesso.",
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
    await refreshData({ filters, includeReport: false });
  }

  async function handleApplyReportFilters(filters: TransactionFilters): Promise<void> {
    await refreshData({ filters, includeReport: true });
  }

  async function handleUpdateTransaction(
    transactionId: string,
    payload: TransactionPatchPayload,
  ): Promise<void> {
    await runMutation(
      () => updateTransaction(transactionId, payload),
      "Transação atualizada com sucesso.",
    );
  }

  async function handleVoidTransaction(transactionId: string): Promise<void> {
    await runMutation(
      () => voidTransaction(transactionId),
      "Transação estornada com sucesso.",
    );
  }

  async function handleMarkReimbursementReceived(
    transactionId: string,
  ): Promise<void> {
    await runMutation(
      () =>
        markReimbursementReceived(transactionId, {
          receivedAt: new Date().toISOString(),
        }),
      "Reembolso confirmado com sucesso.",
    );
  }

  async function handleCreateInvestmentMovement(
    payload: InvestmentMovementPayload,
  ): Promise<void> {
    const wasSuccessful = await runMutation(
      () => createInvestmentMovement(payload),
      "Movimento de investimento registrado com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel registrar movimento de investimento.");
    }
  }

  async function handleInvestmentViewChange(nextView: InvestmentView): Promise<void> {
    await refreshData({
      investmentView: nextView,
    });
  }

  async function handleInvestmentRangeChange(
    nextFromDate: string,
    nextToDate: string,
  ): Promise<void> {
    await refreshData({
      investmentFromDate: nextFromDate,
      investmentToDate: nextToDate,
    });
  }

  async function handleResetAllData(): Promise<void> {
    if (
      !globalThis.confirm(
        "Isso vai limpar compras, transferencias e contas da aplicacao. Deseja continuar?",
      )
    ) {
      return;
    }

    const wasSuccessful = await runMutation(
      () => resetApplicationData(),
      "Aplicação zerada com sucesso.",
    );

    if (wasSuccessful) {
      setActiveView("dashboard");
    }
  }

  async function handleExportBackup(): Promise<void> {
    if (typeof URL.createObjectURL !== "function") {
      showToast("error", "Não foi possível exportar backup neste ambiente.");
      return;
    }

    try {
      const snapshot = {
        exported_at: new Date().toISOString(),
        selected_month: selectedMonth,
        ...(await fetchBackupSnapshot()),
      };
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: "application/json",
      });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `finances-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      showToast("success", "Backup exportado com sucesso.");
    } catch {
      showToast("error", "Não foi possível exportar um backup completo.");
    }
  }

  function handleCreateCategory(label: string): boolean {
    const nextCategory = createCategoryOption(label, categoryOptions);
    if (nextCategory === null) {
      return false;
    }

    const alreadyExists = categoryOptions.some(
      (option) =>
        option.value === nextCategory.value ||
        option.label.toLowerCase() === nextCategory.label.toLowerCase(),
    );
    if (alreadyExists) {
      return false;
    }

    setCategoryOptions([...categoryOptions, nextCategory]);
    return true;
  }

  function handleRemoveCategory(categoryId: string): void {
    setCategoryOptions(categoryOptions.filter((option) => option.value !== categoryId));
  }

  const activeMeta = VIEW_META[activeView];
  return (
    <AppShell
      activeView={activeView}
      description={activeMeta.description}
      onNavigate={setActiveView}
      onOpenCommandPalette={openCommandPalette}
      onOpenQuickAdd={() => openQuickAdd()}
      title={activeMeta.title}
      uiDensity={DEFAULT_UI_DENSITY}
    >
      <Suspense fallback={<ViewFallback activeView={activeView} />}>
        {activeView === "dashboard" ? (
          <DashboardView
            accounts={accounts}
            cards={cards}
            dashboard={dashboard}
            invoices={invoices}
            investmentOverview={investmentOverview}
            isSubmitting={isSubmitting}
            loading={isDataLoading}
            month={selectedMonth}
            onMarkReimbursementReceived={handleMarkReimbursementReceived}
            onMonthChange={setSelectedMonth}
            onNavigate={setActiveView}
            onOpenLedgerFiltered={openLedgerWithFilters}
            onOpenQuickAdd={() => openQuickAdd()}
            transactions={transactions}
            uiDensity={DEFAULT_UI_DENSITY}
          />
        ) : null}

        {activeView === "reports" ? (
          <ReportsView
            accounts={accounts}
            categories={categoryOptions}
            filters={transactionFilters}
            loading={isDataLoading}
            onApplyFilters={handleApplyReportFilters}
            onOpenLedgerFiltered={openLedgerWithFilters}
            summary={reportSummary}
            uiDensity={DEFAULT_UI_DENSITY}
          />
        ) : null}

        {activeView === "investments" ? (
          <InvestmentsView
            accounts={accounts}
            loading={isDataLoading}
            isSubmitting={isSubmitting}
            overview={investmentOverview}
            movements={investmentMovements}
            view={investmentView}
            fromDate={investmentFromDate}
            toDate={investmentToDate}
            onViewChange={(nextView) => {
              void handleInvestmentViewChange(nextView);
            }}
            onRangeChange={(nextFromDate, nextToDate) => {
              void handleInvestmentRangeChange(nextFromDate, nextToDate);
            }}
            onOpenLedgerFiltered={openLedgerWithFilters}
            onOpenQuickAdd={(preset) => openQuickAdd(preset)}
            uiDensity={DEFAULT_UI_DENSITY}
          />
        ) : null}

        {activeView === "transactions" ? (
          <TransactionsView
            accounts={accounts}
            cards={cards}
            filters={transactionFilters}
            isSubmitting={isSubmitting}
            onApplyFilters={handleApplyTransactionFilters}
            onUpdateTransaction={handleUpdateTransaction}
            onVoidTransaction={handleVoidTransaction}
            transactions={transactions}
            uiDensity={DEFAULT_UI_DENSITY}
          />
        ) : null}

        {activeView === "accounts" ? (
          <AccountsView
            accounts={accounts}
            isSubmitting={isSubmitting}
            onCreateAccount={handleCreateAccount}
            onOpenSettings={() => setActiveView("settings")}
            onSetAccountActive={handleSetAccountActive}
            onUpdateAccount={handleUpdateAccount}
          />
        ) : null}

        {activeView === "cards" ? (
          <CardsView
            accounts={accounts}
            cards={cards}
            invoices={invoices}
            isSubmitting={isSubmitting}
            onOpenLedgerFiltered={openLedgerWithFilters}
            onOpenQuickAdd={(preset, options) => openQuickAdd(preset, options)}
            onOpenSettings={() => setActiveView("settings")}
            onCreateCard={handleCreateCard}
            onCreateCardPurchase={handleCreateCardPurchase}
            onSetCardActive={handleSetCardActive}
            onUpdateCard={handleUpdateCard}
            uiDensity={DEFAULT_UI_DENSITY}
          />
        ) : null}

        {activeView === "settings" ? (
          <SettingsView
            accountsCount={accounts.length}
            cardsCount={cards.length}
            categories={categoryOptions}
            isSubmitting={isSubmitting}
            onCreateCategory={handleCreateCategory}
            onOpenAccounts={() => setActiveView("accounts")}
            onOpenCards={() => setActiveView("cards")}
            onExportBackup={() => {
              void handleExportBackup();
            }}
            onRemoveCategory={handleRemoveCategory}
            onResetApplicationData={handleResetAllData}
          />
        ) : null}
      </Suspense>

      <ToastViewport
        onDismiss={() => setToast(null)}
        toast={toast}
      />

      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        onNavigate={setActiveView}
        onOpenQuickAdd={(preset) => {
          openQuickAdd(preset);
        }}
      />

      {isQuickAddOpen ? (
        <Suspense fallback={null}>
          <QuickAddComposer
            isOpen={isQuickAddOpen}
            onClose={() => {
              setIsQuickAddOpen(false);
              setQuickAddPreset(undefined);
              setQuickAddInvoiceId(undefined);
            }}
            preset={quickAddPreset}
            presetInvoiceId={quickAddInvoiceId}
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
            onSubmitInvestmentMovement={async (payload) => {
              await handleCreateInvestmentMovement(payload);
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
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
            Carregando informações...
          </p>
          <div className="h-32 rounded-[2rem] bg-slate-200 animate-pulse" />
          <div className="h-32 rounded-[2rem] bg-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (activeView === "accounts") {
    return (
      <section aria-label="Contas e saldos" className="panel-card">
        <div className="h-5 w-48 rounded-full bg-slate-200 animate-pulse" aria-hidden="true" />
      </section>
    );
  }

  if (activeView === "transactions") {
    return (
      <section aria-label="Historico e filtros" className="panel-card">
        <div className="h-5 w-56 rounded-full bg-slate-200 animate-pulse" aria-hidden="true" />
      </section>
    );
  }

  return (
    <div className="rounded-[2rem] bg-white p-8 shadow-sm" aria-hidden="true">
      <div className="h-5 w-40 rounded-full bg-slate-200 animate-pulse" />
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Nao foi possivel concluir a operacao.";
}








