import "./styles.css";

import { Suspense, lazy, useEffect, useRef, useState } from "react";

import { AppShell } from "./components/app-shell";
import { CommandPalette } from "./components/command-palette";
import { ErrorBoundary } from "./components/error-boundary";
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
  confirmPendingExpense,
  createAccount,
  createCard,
  createCardPurchase,
  createCashTransaction,
  createInvestmentMovement,
  createRecurringRule,
  createTransfer,
  fetchAuthorizedLanDevices,
  fetchBackupSnapshot,
  fetchLanSecurityState,
  fetchSecurityState,
  issueLanPairToken,
  lockApplication,
  markReimbursementReceived,
  pairLanDevice,
  payInvoice,
  resetApplicationData,
  revokeAuthorizedLanDevice,
  setLanSecurityEnabled,
  setSecurityPassword,
  type SecurityState,
  type AuthorizedLanDevice,
  type LanPairTokenSession,
  type LanSecurityState,
  unlockApplication,
  updateAccount,
  updateCard,
  updateCardPurchase,
  updateRecurringRule,
  updateTransaction,
  voidTransaction,
  type AccountSummary,
  type AccountPayload,
  type AccountUpdatePayload,
  type CardSummary,
  type CardPayload,
  type CardPurchasePayload,
  type CardPurchaseUpdatePayload,
  type CardUpdatePayload,
  type CashTransactionPayload,
  type InvoicePaymentPayload,
  type InvestmentMovementPayload,
  type InvestmentView,
  type InvoiceSummary,
  type RecurringRulePayload,
  type RecurringRuleUpdatePayload,
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
import {
  readStoredUiDensity,
  UI_DENSITY_STORAGE_KEY,
  type UiDensity,
} from "./lib/ui-density";
import {
  APP_THEME_STORAGE_KEY,
  APP_DARK_MODE_STORAGE_KEY,
  applyDarkMode,
  readStoredThemeColor,
  readStoredDarkMode,
} from "./lib/theme";
import {
  getAutostartEnabled,
  isTauriEnvironment,
  listenDesktopEvent,
  setAutostartEnabled,
} from "./lib/desktop";
import { useMediaQuery } from "./lib/use-media-query";
import { getErrorMessage } from "./lib/utils";

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


const FixedExpensesView = lazy(async () => {
  const module = await import("./features/recurring/fixed-expenses-view");
  return { default: module.FixedExpensesView };
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

const ReimbursementsView = lazy(async () => {
  const module = await import("./features/reimbursements/reimbursements-view");
  return { default: module.ReimbursementsView };
});

const HistoryPage = lazy(async () => {
  const module = await import("./features/history/history-page");
  return { default: module.HistoryPage };
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
  investments: {
    title: "Patrimônio & investimentos",
    description: "Composição patrimonial, aportes e rendimento.",
  },
  transactions: {
    title: "Histórico",
    description: "Filtro, ajuste e linha do tempo financeira.",
  },
  reimbursements: {
    title: "Reembolsos",
    description: "Pendências, cobranças e recebimentos.",
  },
  accounts: {
    title: "Contas",
    description: "Saldos e estrutura da carteira.",
  },
  cards: {
    title: "Cartões",
    description: "Faturas, ciclos e compras.",
  },
  fixedExpenses: {
    title: "Gastos fixos",
    description: "Cadastro, revisão e confirmação das recorrências.",
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
const MOBILE_QUERY = "(max-width: 900px)";

export function App() {
  const isMobileViewport = useMediaQuery(MOBILE_QUERY);
  const surface = isMobileViewport ? "mobile" : "desktop";
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>(() =>
    readStoredCategoryOptions(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [quickAddPreset, setQuickAddPreset] = useState<
    QuickAddPreset | undefined
  >(undefined);
  const [quickAddInvoiceId, setQuickAddInvoiceId] = useState<
    string | undefined
  >(undefined);
  const [toast, setToast] = useState<AppToast>(null);
  const [uiDensity, setUiDensity] = useState<UiDensity>(() =>
    readStoredUiDensity(),
  );
  const [themeColor, setThemeColor] = useState(() => readStoredThemeColor());
  const [darkMode, setDarkMode] = useState(() => readStoredDarkMode());
  const [securityState, setSecurityState] = useState<SecurityState | null>(null);
  const [lanSecurityState, setLanSecurityState] =
    useState<LanSecurityState | null>(null);
  const [authorizedLanDevices, setAuthorizedLanDevices] = useState<
    AuthorizedLanDevice[]
  >([]);
  const [lanPairingSession, setLanPairingSession] =
    useState<LanPairTokenSession | null>(null);
  const [isLockOverlayVisible, setIsLockOverlayVisible] = useState(false);
  const [lockPassword, setLockPassword] = useState("");
  const [desktopAutostartEnabled, setDesktopAutostartEnabled] = useState(false);
  const [desktopAutostartLoading, setDesktopAutostartLoading] = useState(true);

  const {
    dashboard,
    accounts,
    cards,
    invoices,
    transactions,
    recurringRules,
    pendingExpenses,
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

  const refreshDataRef = useRef(refreshData);
  refreshDataRef.current = refreshData;

  useEffect(() => {
    void refreshData({ month: selectedMonth });
  }, [selectedMonth]);

  useEffect(() => {
    storeCategoryOptions(categoryOptions);
  }, [categoryOptions]);

  useEffect(() => {
    applyDarkMode(darkMode, themeColor);
    try {
      window.localStorage.setItem(APP_THEME_STORAGE_KEY, themeColor);
      window.localStorage.setItem(APP_DARK_MODE_STORAGE_KEY, String(darkMode));
    } catch {
      // ignore preference persistence failures
    }
  }, [themeColor, darkMode]);

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

  async function refreshSecurityState(): Promise<void> {
    try {
      const state = await fetchSecurityState();
      setSecurityState(state);
      setIsLockOverlayVisible(state.is_locked);
    } catch (error) {
      showToast("error", getErrorMessage(error));
    }
  }

  async function refreshLanSecurityState(): Promise<void> {
    if (!isTauriEnvironment()) {
      return;
    }
    try {
      const [state, devices] = await Promise.all([
        fetchLanSecurityState(),
        fetchAuthorizedLanDevices(),
      ]);
      setLanSecurityState(state);
      setAuthorizedLanDevices(devices);
    } catch (error) {
      showToast("error", getErrorMessage(error));
    }
  }

  async function refreshDesktopAutostartState(): Promise<void> {
    if (!isTauriEnvironment()) {
      return;
    }
    setDesktopAutostartLoading(true);
    try {
      const enabled = await getAutostartEnabled();
      setDesktopAutostartEnabled(enabled);
    } catch (error) {
      showToast("error", getErrorMessage(error));
    } finally {
      setDesktopAutostartLoading(false);
    }
  }

  useEffect(() => {
    void refreshSecurityState();
    void refreshLanSecurityState();
    void refreshDesktopAutostartState();
  }, []);

  useEffect(() => {
    const currentUrl = new URL(globalThis.location.href);
    const pairToken = currentUrl.searchParams.get("pair_token");
    if (!pairToken) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await pairLanDevice({
          pairToken,
          deviceName: globalThis.navigator.userAgent.slice(0, 80),
        });
        if (cancelled) {
          return;
        }
        await refreshLanSecurityState();
        setLanPairingSession(null);
        currentUrl.searchParams.delete("pair_token");
        globalThis.history.replaceState({}, "", currentUrl.toString());
        void refreshDataRef.current();
        showToast("success", "Dispositivo pareado com sucesso.");
      } catch (error) {
        if (cancelled) {
          return;
        }
        showToast("error", getErrorMessage(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let removeQuickAddListener: (() => void) | undefined;
    let removeLockListener: (() => void) | undefined;
    let isDisposed = false;

    void (async () => {
      removeQuickAddListener = await listenDesktopEvent(
        "desktop://quick-add",
        () => {
          openQuickAdd();
        },
      );
      removeLockListener = await listenDesktopEvent("desktop://lock", () => {
        void handleLockFromDesktop();
      });

      if (isDisposed) {
        removeQuickAddListener?.();
        removeLockListener?.();
      }
    })();

    return () => {
      isDisposed = true;
      removeQuickAddListener?.();
      removeLockListener?.();
    };
  }, []);

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
    });
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
      await refreshData({
        filters: options?.filters,
      });
      setRefreshKey((k) => k + 1);
      showToast("success", successMessage);
      return true;
    } catch (error) {
      showToast("error", getErrorMessage(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTransactionSubmit(
    payload: CashTransactionPayload,
  ): Promise<void> {
    const wasSuccessful = await runMutation(
      () => createCashTransaction(payload),
      "Transação registrada com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Não foi possível registrar a transação.");
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
      throw new Error("Não foi possível registrar a transferência.");
    }
  }

  async function handleCreateAccount(payload: AccountPayload): Promise<void> {
    const wasSuccessful = await runMutation(
      () => createAccount(payload),
      "Conta criada com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Não foi possível criar a conta.");
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
      throw new Error("Não foi possível atualizar a conta.");
    }
  }

  async function handleSetAccountActive(
    account: AccountSummary,
    isActive: boolean,
  ): Promise<void> {
    if (
      !isActive &&
      account.is_active &&
      accounts.filter((item) => item.is_active).length === 1
    ) {
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
      isActive
        ? "Conta reativada com sucesso."
        : "Conta removida da operação ativa.",
    );

    if (!wasSuccessful) {
      throw new Error("Não foi possível atualizar a conta.");
    }
  }

  async function handleCreateCard(payload: CardPayload): Promise<void> {
    const wasSuccessful = await runMutation(
      () => createCard(payload),
      "Cartão criado com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Não foi possível criar o cartão.");
    }
  }

  async function handleUpdateCard(
    cardId: string,
    payload: CardUpdatePayload,
  ): Promise<void> {
    const wasSuccessful = await runMutation(
      () => updateCard(cardId, payload),
      "Cartão atualizado com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Não foi possível atualizar o cartão.");
    }
  }

  async function handleSetCardActive(
    card: CardSummary,
    isActive: boolean,
  ): Promise<void> {
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
      isActive
        ? "Cartão reativado com sucesso."
        : "Cartão removido da operação ativa.",
    );

    if (!wasSuccessful) {
      throw new Error("Não foi possível atualizar o cartão.");
    }
  }

  async function handleCreateCardPurchase(
    payload: CardPurchasePayload,
  ): Promise<void> {
    const wasSuccessful = await runMutation(
      () => createCardPurchase(payload),
      "Compra no cartão registrada com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Não foi possível registrar a compra no cartão.");
    }
  }

  async function handleUpdateCardPurchase(
    purchaseId: string,
    payload: CardPurchaseUpdatePayload,
  ): Promise<void> {
    await runMutation(
      () => updateCardPurchase(purchaseId, payload),
      "Cartão da compra atualizado com sucesso.",
    );
  }

  async function handlePayInvoice(
    payload: InvoicePaymentPayload,
  ): Promise<void> {
    const wasSuccessful = await runMutation(
      () => payInvoice(payload),
      "Pagamento de fatura registrado com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Não foi possível registrar o pagamento da fatura.");
    }
  }

  async function handleCreateRecurringRule(
    payload: RecurringRulePayload,
  ): Promise<void> {
    const wasSuccessful = await runMutation(
      () => createRecurringRule(payload),
      "Gasto fixo criado com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Não foi possível criar o gasto fixo.");
    }
  }

  async function handleUpdateRecurringRule(
    ruleId: string,
    payload: RecurringRuleUpdatePayload,
  ): Promise<void> {
    const wasSuccessful = await runMutation(
      () => updateRecurringRule(ruleId, payload),
      "Gasto fixo atualizado com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Não foi possível atualizar o gasto fixo.");
    }
  }

  async function handleConfirmPendingExpense(pendingId: string): Promise<void> {
    const wasSuccessful = await runMutation(
      () => confirmPendingExpense(pendingId),
      "Pendência confirmada com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Não foi possível confirmar a pendência.");
    }
  }

  async function handleApplyTransactionFilters(
    filters: TransactionFilters,
  ): Promise<void> {
    await refreshData({ filters });
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
      throw new Error("Não foi possível registrar movimento de investimento.");
    }
  }

  async function handleInvestmentViewChange(
    nextView: InvestmentView,
  ): Promise<void> {
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
        "Isso vai limpar compras, transferências e contas da aplicação. Deseja continuar?",
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

  async function handleSetDesktopAutostart(enabled: boolean): Promise<void> {
    try {
      await setAutostartEnabled(enabled);
      setDesktopAutostartEnabled(enabled);
      showToast(
        "success",
        enabled
          ? "Inicialização automática ativada."
          : "Inicialização automática desativada.",
      );
    } catch (error) {
      showToast("error", getErrorMessage(error));
      throw error;
    }
  }

  async function handleSetLanEnabled(enabled: boolean): Promise<void> {
    setIsSubmitting(true);
    setToast(null);
    try {
      await setLanSecurityEnabled(enabled);
      await refreshLanSecurityState();
      if (!enabled) {
        setLanPairingSession(null);
      }
      showToast(
        "success",
        enabled ? "Acesso LAN ativado." : "Acesso LAN desativado.",
      );
    } catch (error) {
      showToast("error", getErrorMessage(error));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGenerateLanPairToken(): Promise<void> {
    setIsSubmitting(true);
    setToast(null);
    try {
      const session = await issueLanPairToken();
      setLanPairingSession(session);
      await refreshLanSecurityState();
      showToast("success", "QR de pareamento gerado.");
    } catch (error) {
      showToast("error", getErrorMessage(error));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevokeLanDevice(deviceId: string): Promise<void> {
    setIsSubmitting(true);
    setToast(null);
    try {
      await revokeAuthorizedLanDevice(deviceId);
      await refreshLanSecurityState();
      showToast("success", "Dispositivo revogado.");
    } catch (error) {
      showToast("error", getErrorMessage(error));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSetSecurityPassword(password: string): Promise<void> {
    setIsSubmitting(true);
    setToast(null);
    try {
      await setSecurityPassword({ password });
      await refreshSecurityState();
      setIsLockOverlayVisible(true);
      showToast("success", "Senha definida com sucesso.");
    } catch (error) {
      showToast("error", getErrorMessage(error));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLockFromDesktop(): Promise<void> {
    try {
      await lockApplication();
      await refreshSecurityState();
      showToast("success", "Aplicação bloqueada.");
    } catch (error) {
      showToast("error", getErrorMessage(error));
    }
  }

  async function handleUnlock(password: string): Promise<void> {
    setIsSubmitting(true);
    setToast(null);
    try {
      await unlockApplication(password);
      await refreshSecurityState();
      setIsLockOverlayVisible(false);
      setLockPassword("");
      showToast("success", "Aplicação desbloqueada.");
    } catch (error) {
      showToast("error", getErrorMessage(error));
      throw error;
    } finally {
      setIsSubmitting(false);
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
    setCategoryOptions(
      categoryOptions.filter((option) => option.value !== categoryId),
    );
  }

  const activeMeta = VIEW_META[activeView];
  return (
    <AppShell
      surface={surface}
      activeView={activeView}
      description={activeMeta.description}
      onNavigate={setActiveView}
      onOpenCommandPalette={openCommandPalette}
      onOpenQuickAdd={() => openQuickAdd()}
      title={activeMeta.title}
      uiDensity={uiDensity}
      month={selectedMonth}
      onMonthChange={setSelectedMonth}
    >
      <ErrorBoundary>
        <Suspense fallback={<ViewFallback activeView={activeView} />}>
          {activeView === "dashboard" ? (
          <DashboardView
            surface={surface}
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
            onRetry={() => void refreshData({ month: selectedMonth })}
            transactions={transactions}
            uiDensity={uiDensity}
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
            uiDensity={uiDensity}
          />
        ) : null}

        {activeView === "transactions" ? (
          <HistoryPage
            surface={surface}
            accounts={accounts}
            cards={cards}
            month={selectedMonth}
            refreshKey={refreshKey}
            onError={(message) => showToast("error", message)}
          />
        ) : null}

        {activeView === "reimbursements" ? (
          <ReimbursementsView
            surface={surface}
            accounts={accounts}
            month={selectedMonth}
            refreshKey={refreshKey}
            onError={(message) => showToast("error", message)}
            onOpenQuickAdd={() => openQuickAdd("expense")}
          />
        ) : null}

        {activeView === "fixedExpenses" ? (
          <FixedExpensesView
            surface={surface}
            accounts={accounts}
            cards={cards}
            categories={categoryOptions}
            isSubmitting={isSubmitting}
            month={selectedMonth}
            pendingExpenses={pendingExpenses}
            recurringRules={recurringRules}
            onConfirmPending={handleConfirmPendingExpense}
            onCreateRule={handleCreateRecurringRule}
            onMonthChange={setSelectedMonth}
            onOpenLedgerFiltered={openLedgerWithFilters}
            onUpdateRule={handleUpdateRecurringRule}
            uiDensity={uiDensity}
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
            surface={surface}
            accounts={accounts}
            cards={cards}
            invoices={invoices}
            selectedMonth={selectedMonth}
            isSubmitting={isSubmitting}
            onOpenLedgerFiltered={openLedgerWithFilters}
            onOpenQuickAdd={(preset, options) => openQuickAdd(preset, options)}
            onOpenSettings={() => setActiveView("settings")}
            onCreateCard={handleCreateCard}
            onSetCardActive={handleSetCardActive}
            onUpdateCard={handleUpdateCard}
            uiDensity={uiDensity}
          />
        ) : null}

        {activeView === "settings" ? (
          <SettingsView
            isSubmitting={isSubmitting}
            themeColor={themeColor}
            darkMode={darkMode}
            onExportBackup={() => {
              void handleExportBackup();
            }}
            onResetApplicationData={handleResetAllData}
            onThemeColorChange={setThemeColor}
            onDarkModeChange={setDarkMode}
            securityState={securityState}
            desktopAutostartEnabled={desktopAutostartEnabled}
            desktopAutostartLoading={desktopAutostartLoading}
            onSetDesktopAutostart={handleSetDesktopAutostart}
            onSetSecurityPassword={handleSetSecurityPassword}
            onUnlock={handleUnlock}
            onLock={handleLockFromDesktop}
            lanSecurityState={lanSecurityState}
            lanPairingSession={lanPairingSession}
            authorizedLanDevices={authorizedLanDevices}
            onSetLanEnabled={handleSetLanEnabled}
            onGenerateLanPairToken={handleGenerateLanPairToken}
            onRevokeLanDevice={handleRevokeLanDevice}
          />
        ) : null}
        </Suspense>
      </ErrorBoundary>

      <ToastViewport onDismiss={() => setToast(null)} toast={toast} />

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
            categories={categoryOptions}
            onCreateCategory={handleCreateCategory}
            onRemoveCategory={handleRemoveCategory}
            onSubmitTransaction={async (payload) => {
              await handleTransactionSubmit(payload);
            }}
            onSubmitTransfer={async (payload) => {
              await handleTransferSubmit(payload);
            }}
            onSubmitCardPurchase={async (payload) => {
              await handleCreateCardPurchase(payload);
            }}
            onSubmitRecurringRule={async (payload) => {
              await handleCreateRecurringRule(payload);
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

      {isLockOverlayVisible ? (
        <LockOverlay
          password={lockPassword}
          onPasswordChange={setLockPassword}
          onSubmit={() => {
            void handleUnlock(lockPassword);
          }}
          isSubmitting={isSubmitting}
        />
      ) : null}
    </AppShell>
  );
}

function LockOverlay({
  password,
  onPasswordChange,
  onSubmit,
  isSubmitting,
}: {
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-overlay-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h2 id="lock-overlay-title" className="text-lg font-bold text-slate-900">Aplicação bloqueada</h2>
        <p className="mt-1 text-sm text-slate-600">
          Digite sua senha para continuar.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <input
            aria-label="Senha de desbloqueio"
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            className="flex h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="Senha"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <button
            type="submit"
            className="h-10 w-full rounded-md bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
            disabled={isSubmitting || !password.trim()}
          >
            Desbloquear
          </button>
        </form>
      </div>
    </div>
  );
}

function ViewFallback({ activeView }: { activeView: AppView }) {
  if (activeView === "dashboard") {
    return (
      <div className="space-y-8">
        <span role="status" aria-live="polite" className="sr-only">
          Carregando informações...
        </span>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3" aria-hidden="true">
          <div className="h-32 rounded-[2rem] bg-muted animate-pulse" />
          <div className="h-32 rounded-[2rem] bg-muted animate-pulse" />
          <div className="h-32 rounded-[2rem] bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (activeView === "accounts") {
    return (
      <section aria-label="Contas e saldos" className="panel-card">
        <span role="status" aria-live="polite" className="sr-only">
          Carregando...
        </span>
        <div
          className="h-5 w-48 rounded-full bg-muted animate-pulse"
          aria-hidden="true"
        />
      </section>
    );
  }

  if (activeView === "transactions") {
    return (
      <section aria-label="Histórico e filtros" className="panel-card">
        <span role="status" aria-live="polite" className="sr-only">
          Carregando...
        </span>
        <div
          className="h-5 w-56 rounded-full bg-muted animate-pulse"
          aria-hidden="true"
        />
      </section>
    );
  }

  return (
    <div className="rounded-[2rem] bg-surface p-8 shadow-sm">
      <span role="status" aria-live="polite" className="sr-only">
        Carregando...
      </span>
      <div className="h-5 w-40 rounded-full bg-muted animate-pulse" aria-hidden="true" />
    </div>
  );
}

