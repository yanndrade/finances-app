import "./styles.css";

import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "./components/app-shell";
import { CommandPalette } from "./components/command-palette";
import { ErrorBoundary } from "./components/error-boundary";
import type {
  QuickAddDraft,
  QuickAddPreset,
} from "./components/quick-add-composer";
import type { AppView } from "./components/sidebar";
import { ToastViewport, type AppToast } from "./components/toast-viewport";
import { useAppDataOrchestrator } from "./features/app/use-app-data-orchestrator";
import {
  createCategoryOption,
  getCategoryOptions,
  readStoredCategoryOptions,
  storeCategoryOptions,
  type CategoryOption,
} from "./lib/categories";
import {
  API_BASE_URL,
  ApiError,
  confirmPendingExpense,
  createAccount,
  createCard,
  createCardPurchase,
  fetchCardHolders,
  createCashTransaction,
  createInvestmentMovement,
  createPluggyConnectToken,
  createRecurringRule,
  createTransfer,
  fetchAuthorizedLanDevices,
  fetchBackupSnapshot,
  fetchLanSecurityState,
  fetchPluggyInbox,
  fetchPluggyStatus,
  fetchSecurityState,
  issueLanPairToken,
  lockApplication,
  markReimbursementReceived,
  pairLanDevice,
  payInvoice,
  resetApplicationData,
  linkPluggyItem,
  recoverPluggyItems,
  acceptPluggyEntry,
  registerPluggyItem,
  revokeAuthorizedLanDevice,
  setLanSecurityEnabled,
  setSecurityPassword,
  syncPluggyItem,
  type SecurityState,
  type AuthorizedLanDevice,
  type LanPairTokenSession,
  type LanSecurityState,
  type PluggyInboxEntry,
  type PluggyItemPayload,
  type PluggyStatus,
  unlockApplication,
  updateAccount,
  updateCard,
  updateCardPurchase,
  updateInvoicePayment,
  updateInvestmentMovement,
  updateRecurringRule,
  updateTransaction,
  voidCardPurchase,
  voidTransaction,
  type AccountSummary,
  type AccountPayload,
  type AccountUpdatePayload,
  type CardHolderSummary,
  type CardSummary,
  type CardPayload,
  type CardPurchasePayload,
  type CardPurchaseUpdatePayload,
  type CardUpdatePayload,
  type CashTransactionPayload,
  type InvoicePaymentPayload,
  type InvoicePaymentUpdatePayload,
  type InvestmentMovementPayload,
  type InvestmentMovementUpdatePayload,
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
  INVESTMENT_GOAL_PERCENT_STORAGE_KEY,
  readStoredInvestmentGoalPercent,
} from "./lib/investment-goal-settings";
import {
  APP_THEME_STORAGE_KEY,
  APP_DARK_MODE_STORAGE_KEY,
  applyDarkMode,
  readStoredThemeColor,
  readStoredDarkMode,
} from "./lib/theme";
import {
  checkForAppUpdate,
  clearPluggyCredentials,
  getAutostartEnabled,
  getPluggyCredentialsConfigured,
  installAppUpdate,
  isTauriEnvironment,
  listenDesktopEvent,
  setAutostartEnabled,
  setPluggyCredentials,
  type DesktopUpdateInfo,
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

const ImportView = lazy(async () => {
  const module = await import("./features/import/import-view");
  return { default: module.ImportView };
});

const OpenFinanceView = lazy(async () => {
  const module = await import("./features/open-finance/open-finance-view");
  return { default: module.OpenFinanceView };
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

function proposalText(
  entry: PluggyInboxEntry,
  key: string,
): string | undefined {
  const value = entry.proposal.payload[key];
  return typeof value === "string" && value ? value : undefined;
}

/**
 * The composer's shape for the kind of entry being reviewed.
 *
 * A proposal already knows what it is — income, a bill payment, a sale of an
 * asset — so opening every one of them as an expense makes the reviewer undo
 * the guess before they can confirm anything.
 */
function presetForInboxEntry(entry: PluggyInboxEntry): QuickAddPreset {
  const rememberedKind = proposalText(entry, "_target_kind");
  const kind = rememberedKind ?? entry.kind;
  switch (kind) {
    case "card_purchase":
      return "expense_card";
    case "transfer":
      return "transfer_internal";
    case "invoice_payment":
      return "transfer_invoice_payment";
    case "investment_movement":
      return proposalText(entry, "movement_type") === "venda"
        ? "investment_sale"
        : "investment_purchase";
    default:
      return proposalText(entry, "transaction_type") === "income"
        ? "income"
        : "expense";
  }
}

/** Turns a proposal into the composer's starting values. */
function draftFromInboxEntry(entry: PluggyInboxEntry): QuickAddDraft {
  const text = (key: string) => proposalText(entry, key);
  const count = entry.proposal.payload.installments_count;

  return {
    // The composer takes the amount as typed, in reais.
    amount: (entry.amount / 100).toFixed(2),
    description: entry.title ?? text("description") ?? "",
    categoryId: text("category_id") ?? "",
    personId: text("person_id") ?? "",
    cardId: text("card_id"),
    holderId: text("holder_id") ?? "",
    // A transfer names its side of the move; every other kind has one account.
    accountId: text("from_account_id") ?? text("account_id"),
    toAccountId: text("to_account_id"),
    date: (
      text("purchase_date") ??
      text("paid_at") ??
      text("occurred_at") ??
      entry.occurred_at
    ).slice(0, 10),
    installments: typeof count === "number" && count > 1 ? String(count) : undefined,
    recurringRuleId: text("recurring_rule_id") ?? "",
  };
}

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
  import: {
    title: "Importar",
    description: "Lançamentos da Pluggy aguardando revisão.",
  },
  openFinance: {
    title: "Open Finance",
    description: "Conexões e para onde cada conta, cartão e investimento entra.",
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
const DIAGNOSTIC_TOAST_DURATION_MS = 20_000;
const MOBILE_QUERY = "(max-width: 900px)";
// MeuCofri is single-user by design, so the Pluggy end-user identifier is a
// constant. A per-device identifier would make the same person look like a new
// user on every browser and orphan the connection when site data is cleared.
const PLUGGY_CLIENT_USER_ID = "meucofri-owner";

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
  // Who carries each card. An additional card is a holder on the titular's
  // card rather than a card of its own, so without this the composer has no
  // way to say — or to show — whose plastic a purchase came from.
  const [holdersByCard, setHoldersByCard] = useState<
    Record<string, CardHolderSummary[]>
  >({});
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
  const [investmentGoalPercent, setInvestmentGoalPercent] = useState(() =>
    readStoredInvestmentGoalPercent(),
  );
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
  const [pluggyCredentialsConfigured, setPluggyCredentialsConfigured] =
    useState(false);
  const [pluggyCredentialsLoading, setPluggyCredentialsLoading] = useState(
    isTauriEnvironment(),
  );
  const [pluggyStatus, setPluggyStatus] = useState<PluggyStatus | null>(null);
  const [pluggySyncing, setPluggySyncing] = useState(false);
  // Bumped after a sync or a pairing so the links panel refetches.
  const [pluggyAccountsRefreshToken, setPluggyAccountsRefreshToken] =
    useState(0);
  const [pluggyInboxPending, setPluggyInboxPending] = useState(0);
  const [pluggyInboxRefreshToken, setPluggyInboxRefreshToken] = useState(0);
  // Set while the composer is being used to review an imported entry: the
  // submit then accepts that entry instead of creating a fresh one, so the
  // backend keeps resolving the holder and settling a fixed expense.
  const [reviewingEntry, setReviewingEntry] = useState<{
    entryId: string;
    kind: PluggyInboxEntry["kind"];
    remember?: boolean;
  } | null>(null);
  const [quickAddDraft, setQuickAddDraft] = useState<QuickAddDraft | null>(null);
  const pluggyAutoSyncStartedRef = useRef(false);
  const [desktopUpdateInfo, setDesktopUpdateInfo] =
    useState<DesktopUpdateInfo | null>(null);
  const [desktopUpdateSupported, setDesktopUpdateSupported] =
    useState(isTauriEnvironment());
  const [desktopUpdateChecking, setDesktopUpdateChecking] = useState(false);
  const [desktopUpdateInstallState, setDesktopUpdateInstallState] = useState<
    "idle" | "downloading" | "installing"
  >("idle");
  const [desktopUpdateProgressPercent, setDesktopUpdateProgressPercent] =
    useState<number | null>(null);
  const [isMobileLanWarningVisible, setIsMobileLanWarningVisible] = useState(false);
  const [isRetryingMobileLanConnection, setIsRetryingMobileLanConnection] =
    useState(false);

  const {
    dashboard,
    dashboardInvestmentOverview,
    accounts,
    cards,
    invoices,
    transactions,
    recurringRules,
    pendingExpenses,
    investmentHistory,
    investmentCurrent,
    investmentSnapshots,
    investmentMovements,
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
    investmentGoalPercent,
    onError: (error) => {
      showErrorToast(error);
      if (surface === "mobile" && isLikelyLanConnectionError(error)) {
        setIsMobileLanWarningVisible(true);
      }
    },
    onRefreshSuccess: () => {
      setIsMobileLanWarningVisible(false);
    },
  });

  const refreshDataRef = useRef(refreshData);
  refreshDataRef.current = refreshData;

  useEffect(() => {
    void refreshData({ month: selectedMonth });
  }, [investmentGoalPercent, selectedMonth]);

  useEffect(() => {
    let lastCalendarDate = new Date().toDateString();

    const refreshOnReturn = () => {
      lastCalendarDate = new Date().toDateString();
      void refreshDataRef.current({ month: selectedMonth });
    };

    const refreshWhenCalendarDayChanges = () => {
      const nextCalendarDate = new Date().toDateString();
      if (nextCalendarDate === lastCalendarDate) return;
      lastCalendarDate = nextCalendarDate;
      void refreshDataRef.current({ month: selectedMonth });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshOnReturn();
    };

    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const intervalId = window.setInterval(refreshWhenCalendarDayChanges, 60_000);

    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
    };
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
    try {
      window.localStorage.setItem(
        INVESTMENT_GOAL_PERCENT_STORAGE_KEY,
        String(investmentGoalPercent),
      );
    } catch {
      // ignore preference persistence failures
    }
  }, [investmentGoalPercent]);

  useEffect(() => {
    if (toast === null) {
      return;
    }

    const timeout = globalThis.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, toast.durationMs ?? TOAST_DURATION_MS[toast.tone]);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [toast]);

  function showToast(
    tone: "success" | "error",
    message: string,
    options?: {
      diagnostic?: string | null;
      durationMs?: number;
    },
  ) {
    setToast({
      id: Date.now(),
      tone,
      message,
      diagnostic: options?.diagnostic ?? undefined,
      durationMs: options?.durationMs,
    });
  }

  function showErrorToast(error: unknown) {
    const diagnostic = buildErrorDiagnostic(error);
    if (diagnostic) {
      console.error("finance_frontend_diagnostic", diagnostic);
    }
    showToast("error", getErrorMessage(error), {
      diagnostic,
      durationMs: diagnostic ? DIAGNOSTIC_TOAST_DURATION_MS : undefined,
    });
  }

  async function refreshSecurityState(): Promise<void> {
    try {
      const state = await fetchSecurityState();
      setSecurityState(state);
      setIsLockOverlayVisible(state.is_locked);
    } catch (error) {
      showErrorToast(error);
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
      showErrorToast(error);
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
      showErrorToast(error);
    } finally {
      setDesktopAutostartLoading(false);
    }
  }

  async function refreshPluggyCredentialsState(): Promise<void> {
    if (!isTauriEnvironment()) {
      setPluggyCredentialsConfigured(false);
      setPluggyCredentialsLoading(false);
      return;
    }

    setPluggyCredentialsLoading(true);
    try {
      setPluggyCredentialsConfigured(await getPluggyCredentialsConfigured());
    } catch (error) {
      showErrorToast(error);
    } finally {
      setPluggyCredentialsLoading(false);
    }
  }

  async function refreshPluggyInboxCount(): Promise<void> {
    try {
      const page = await fetchPluggyInbox();
      setPluggyInboxPending(page.pending_total);
    } catch {
      // The inbox is desktop-only and optional; a failure here must not break
      // the rest of the app.
      setPluggyInboxPending(0);
    }
  }

  async function refreshPluggyStatusState(): Promise<PluggyStatus> {
    const status = await fetchPluggyStatus();
    setPluggyStatus(status);
    return status;
  }

  async function refreshDesktopUpdateState(options?: {
    showUpToDateToast?: boolean;
    showAvailableToast?: boolean;
  }): Promise<void> {
    if (!isTauriEnvironment()) {
      setDesktopUpdateSupported(false);
      setDesktopUpdateInfo(null);
      return;
    }

    setDesktopUpdateChecking(true);
    try {
      const result = await checkForAppUpdate();
      setDesktopUpdateSupported(result.supported);
      setDesktopUpdateInfo(result.update);

      if (result.isAvailable && options?.showAvailableToast) {
        showToast(
          "success",
          `Atualização ${result.update.availableVersion ?? ""} disponível.`,
        );
      } else if (!result.isAvailable && options?.showUpToDateToast) {
        showToast("success", "Você já está na versão mais recente.");
      }
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setDesktopUpdateChecking(false);
    }
  }

  useEffect(() => {
    void refreshSecurityState();
    void refreshLanSecurityState();
    void refreshDesktopAutostartState();
    void refreshPluggyCredentialsState();
    void refreshPluggyStatusState().catch(() => undefined);
    void refreshDesktopUpdateState();
  }, []);

  useEffect(() => {
    if (
      pluggyCredentialsLoading ||
      !pluggyCredentialsConfigured ||
      pluggyAutoSyncStartedRef.current
    ) {
      return;
    }
    pluggyAutoSyncStartedRef.current = true;
    void refreshPluggyInboxCount();
    void refreshPluggyStatusState()
      .then((status) => {
        if (status.connected) {
          // Silent and non-blocking: the badge is what tells the user there is
          // something to review.
          return handleSyncPluggy({ silent: true });
        }
      })
      .catch(() => undefined);
  }, [pluggyCredentialsConfigured, pluggyCredentialsLoading]);

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
        showErrorToast(error);
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
      showErrorToast(error);
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
      throw new Error("Selecione contas diferentes para a transferência.");
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

  useEffect(() => {
    if (cards.length === 0) {
      setHoldersByCard({});
      return;
    }

    // A card whose holders fail to load simply has none to offer, which is the
    // same shape as a card with no additionals: the composer falls back to the
    // titular rather than blocking the launch.
    let isCurrent = true;
    void (async () => {
      const loaded = await Promise.all(
        cards.map(async (card) => {
          try {
            return [card.card_id, await fetchCardHolders(card.card_id)] as const;
          } catch {
            return [card.card_id, [] as CardHolderSummary[]] as const;
          }
        }),
      );
      if (isCurrent) setHoldersByCard(Object.fromEntries(loaded));
    })();

    return () => {
      isCurrent = false;
    };
  }, [cards, refreshKey]);

  // The import queue only carries ids; a transfer or a bill payment is only
  // readable once they are names.
  const importNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const account of accounts) names[account.account_id] = account.name;
    for (const card of cards) names[card.card_id] = card.name;
    return names;
  }, [accounts, cards]);

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
      "Compra no cartão atualizada com sucesso.",
    );
  }

  async function handleVoidCardPurchase(purchaseId: string): Promise<void> {
    await runMutation(
      () => voidCardPurchase(purchaseId),
      "Compra no cartão estornada com sucesso.",
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

  async function handleUpdateInvoicePayment(
    paymentId: string,
    payload: InvoicePaymentUpdatePayload,
  ): Promise<void> {
    const wasSuccessful = await runMutation(
      () => updateInvoicePayment(paymentId, payload),
      "Conta do pagamento atualizada com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("NÃ£o foi possÃ­vel atualizar a conta do pagamento.");
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

  async function handleUpdateInvestmentMovement(
    movementId: string,
    payload: InvestmentMovementUpdatePayload,
  ): Promise<void> {
    const wasSuccessful = await runMutation(
      () => updateInvestmentMovement(movementId, payload),
      "Movimento de investimento atualizado com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("NÃ£o foi possÃ­vel atualizar movimento de investimento.");
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

  async function handleCreatePluggyConnectToken(itemId?: string): Promise<string> {
    try {
      const response = await createPluggyConnectToken(
        PLUGGY_CLIENT_USER_ID,
        itemId,
      );
      return response.accessToken;
    } catch (error) {
      showErrorToast(error);
      throw error;
    }
  }

  /**
   * Confirms an imported entry with whatever the user edited in the composer.
   * The backend still writes it, so the holder lookup and the settling of a
   * fixed expense keep working exactly as they do for an untouched proposal.
   */
  async function acceptReviewedEntry(
    overrides: Record<string, unknown>,
    targetKind: PluggyInboxEntry["kind"],
  ): Promise<void> {
    if (!reviewingEntry) return;
    await acceptPluggyEntry(
      reviewingEntry.entryId,
      overrides,
      reviewingEntry.remember,
      targetKind,
    );
    setReviewingEntry(null);
    setQuickAddDraft(null);
    void refreshPluggyInboxCount();
    setPluggyInboxRefreshToken((value) => value + 1);
    void refreshDataRef.current({ month: selectedMonth });
    setRefreshKey((value) => value + 1);
  }

  async function handleSyncPluggy(options?: {
    itemId?: string;
    silent?: boolean;
  }): Promise<void> {
    setPluggySyncing(true);
    try {
      const result = await syncPluggyItem(options?.itemId);
      const results = result.items ?? [result];
      const successful = results.filter((item) => item.status === "success");
      const failed = results.filter((item) => item.status === "error");
      await Promise.all([
        refreshPluggyStatusState(),
        refreshDataRef.current({ month: selectedMonth }),
      ]);
      setRefreshKey((value) => value + 1);
      setPluggyAccountsRefreshToken((value) => value + 1);
      setPluggyInboxRefreshToken((value) => value + 1);
      await refreshPluggyInboxCount();
      if (failed.length > 0 && successful.length === 0) {
        throw new Error(
          failed[0].detail ?? "Não foi possível sincronizar os dados da Pluggy.",
        );
      }
      if (!options?.silent) {
        const discovered = successful.reduce(
          (total, item) => total + (item.accounts_discovered ?? 0),
          0,
        );
        const pending = successful.reduce(
          (total, item) => total + (item.accounts_pending ?? 0),
          0,
        );
        const staged = successful.reduce(
          (total, item) => total + (item.entries_pending ?? 0),
          0,
        );
        // A card whose invoice has not closed yet imports nothing, which on
        // screen is indistinguishable from the card being broken.
        const openInvoice = successful.reduce(
          (total, item) => total + (item.entries_skipped?.open_invoice ?? 0),
          0,
        );
        const openInvoiceNote =
          openInvoice > 0
            ? ` ${openInvoice} compra(s) de cartão ainda estão na fatura aberta e entram quando ela fechar.`
            : "";
        showToast(
          "success",
          pending > 0
            ? `Pluggy sincronizada: ${discovered} conta(s), ${pending} aguardando vínculo.${openInvoiceNote}`
            : staged > 0
              ? `${staged} lançamento(s) aguardando revisão em Importar.${openInvoiceNote}`
              : `Pluggy sincronizada: ${discovered} conta(s) vinculada(s).${openInvoiceNote}`,
        );
      }
    } catch (error) {
      if (!options?.silent) {
        showErrorToast(error);
      }
      throw error;
    } finally {
      setPluggySyncing(false);
    }
  }

  async function handlePluggyConnected(item: PluggyItemPayload): Promise<void> {
    try {
      await registerPluggyItem(item, PLUGGY_CLIENT_USER_ID);
      await refreshPluggyStatusState();
    } catch (error) {
      showErrorToast(error);
      throw error;
    }
    await handleSyncPluggy({ itemId: item.id });
  }

  async function handleLinkPluggyItem(itemId: string): Promise<void> {
    try {
      await linkPluggyItem(itemId.trim(), PLUGGY_CLIENT_USER_ID);
      await refreshPluggyStatusState();
    } catch (error) {
      showErrorToast(error);
      throw error;
    }
    await handleSyncPluggy({ itemId: itemId.trim() });
  }

  async function handlePluggyItemDetected(item: PluggyItemPayload): Promise<void> {
    // Pluggy creates the item before the flow finishes. Persisting the id as
    // soon as it exists keeps the connection recoverable even if the user
    // closes the widget or the run fails afterwards.
    try {
      await registerPluggyItem(item, PLUGGY_CLIENT_USER_ID);
      await refreshPluggyStatusState();
    } catch {
      // Best effort: the success and error handlers register the item as well.
    }
  }

  type PluggyRecoveryOutcome =
    | "recovered"
    | "listing-disabled"
    | "nothing-found"
    | "failed";

  async function handleRecoverExistingPluggyConnection(): Promise<PluggyRecoveryOutcome> {
    let recovery;
    try {
      recovery = await recoverPluggyItems(PLUGGY_CLIENT_USER_ID);
    } catch {
      return "failed";
    }
    if (!recovery.available) {
      return "listing-disabled";
    }
    if (recovery.items.length === 0) {
      return "nothing-found";
    }
    await refreshPluggyStatusState();
    try {
      await handleSyncPluggy({ silent: true });
    } catch {
      // The connection is registered; a failed first sync can be retried.
    }
    showToast(
      "success",
      `${recovery.items.length} conexão(ões) encontrada(s) na Pluggy e sincronizada(s).`,
    );
    return "recovered";
  }

  async function handleDiscoverPluggyItems(): Promise<void> {
    const outcome = await handleRecoverExistingPluggyConnection();
    if (outcome === "recovered") {
      return;
    }
    showToast(
      "error",
      {
        "listing-disabled":
          "Sua conta Pluggy não permite listar as conexões desta aplicação, então não dá para encontrá-las sozinho. Peça ao suporte da Pluggy para habilitar a listagem de items, ou vincule pelo Item ID nas opções avançadas.",
        "nothing-found":
          "Nenhuma conexão encontrada nesta aplicação da Pluggy. Autorize uma conexão antes de procurar.",
        failed: "Não foi possível consultar as conexões na Pluggy agora.",
      }[outcome],
    );
  }

  async function handlePluggyError(
    message: string,
    item?: PluggyItemPayload,
  ): Promise<void> {
    let knownItemId: string | null = null;
    if (item) {
      try {
        await registerPluggyItem(item, PLUGGY_CLIENT_USER_ID, message);
        await refreshPluggyStatusState();
        knownItemId = item.id;
      } catch (error) {
        showErrorToast(error);
        return;
      }
    }
    if (/ITEM_USER_ALREADY_EXISTS/i.test(message)) {
      if (knownItemId ?? pluggyStatus?.items?.[0]?.item_id) {
        showToast(
          "success",
          "Essa conta já estava conectada na Pluggy. Sincronizando os dados existentes.",
        );
        await handleSyncPluggy({ silent: true }).catch(() => undefined);
        return;
      }
      const outcome = await handleRecoverExistingPluggyConnection();
      if (outcome === "recovered") {
        return;
      }
      showToast(
        "error",
        {
          "listing-disabled":
            "Já existe uma conexão na Pluggy para essas credenciais, mas sua conta Pluggy não permite listar as conexões da aplicação, então não dá para reaproveitá-la sozinho. Peça ao suporte da Pluggy para habilitar a listagem de items, ou apague a conexão antiga no painel da Pluggy.",
          "nothing-found":
            "A Pluggy recusou a conexão por já existir uma com essas credenciais, mas nenhuma conexão aparece nesta aplicação. Confira se a conexão antiga foi apagada no painel da aplicação certa.",
          failed:
            "Já existe uma conexão na Pluggy e a busca automática falhou. Tente de novo em instantes.",
        }[outcome],
      );
      return;
    }
    showToast(
      "error",
      message || "Não foi possível concluir a conexão com o Meu Pluggy.",
    );
  }

  async function handleSavePluggyCredentials(
    clientId: string,
    clientSecret: string,
  ): Promise<void> {
    try {
      await setPluggyCredentials(clientId, clientSecret);
      setPluggyCredentialsConfigured(true);
      showToast(
        "success",
        "Chaves da Pluggy protegidas neste computador. Você já pode conectar.",
      );
    } catch (error) {
      showErrorToast(error);
      throw error;
    }
  }

  async function handleClearPluggyCredentials(): Promise<void> {
    try {
      await clearPluggyCredentials();
      setPluggyCredentialsConfigured(false);
      showToast("success", "Chaves da Pluggy removidas deste computador.");
    } catch (error) {
      showErrorToast(error);
      throw error;
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
      showErrorToast(error);
      throw error;
    }
  }

  async function handleCheckDesktopUpdate(): Promise<void> {
    await refreshDesktopUpdateState({
      showUpToDateToast: true,
      showAvailableToast: true,
    });
  }

  async function handleInstallDesktopUpdate(): Promise<void> {
    if (!isTauriEnvironment()) {
      return;
    }

    if (!desktopUpdateInfo?.availableVersion) {
      await refreshDesktopUpdateState({
        showUpToDateToast: true,
        showAvailableToast: true,
      });
      return;
    }

    setDesktopUpdateInstallState("downloading");
    setDesktopUpdateProgressPercent(0);

    try {
      await installAppUpdate((progress) => {
        setDesktopUpdateInstallState(
          progress.stage === "installing" ? "installing" : "downloading",
        );
        setDesktopUpdateProgressPercent(progress.percent);
      });
      showToast(
        "success",
        "Atualização instalada. O aplicativo pode fechar para concluir a instalação.",
      );
    } catch (error) {
      showErrorToast(error);
      throw error;
    } finally {
      setDesktopUpdateInstallState("idle");
      setDesktopUpdateProgressPercent(null);
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
      showErrorToast(error);
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
      showErrorToast(error);
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
      showErrorToast(error);
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
      showErrorToast(error);
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
      showErrorToast(error);
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
      showErrorToast(error);
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

    const availableCategoryOptions = getCategoryOptions(undefined, categoryOptions);
    const alreadyExists = availableCategoryOptions.some(
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

  async function handleRetryMobileLanConnection(): Promise<void> {
    setIsRetryingMobileLanConnection(true);
    setToast(null);
    await refreshData({ month: selectedMonth });
    setIsRetryingMobileLanConnection(false);
  }

  if (surface === "mobile" && isMobileLanWarningVisible) {
    return (
      <MobileLanWarningScreen
        isRetrying={isRetryingMobileLanConnection || isDataLoading}
        onRetry={() => {
          void handleRetryMobileLanConnection();
        }}
      />
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
      importPendingCount={pluggyInboxPending}
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
            investmentOverview={dashboardInvestmentOverview}
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
            history={investmentHistory}
            current={investmentCurrent}
            snapshots={investmentSnapshots}
            movements={investmentMovements}
            onOpenLedgerFiltered={openLedgerWithFilters}
            onOpenQuickAdd={(preset) => openQuickAdd(preset)}
            onUpdateMovement={handleUpdateInvestmentMovement}
            onRefreshData={() => {
              void refreshData({ month: selectedMonth });
            }}
            onError={(message) => showToast("error", message)}
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
            initialFilters={transactionFilters}
            isSubmitting={isSubmitting}
            onConfirmPending={handleConfirmPendingExpense}
            onError={(error) => showErrorToast(error)}
            onUpdateCardPurchase={handleUpdateCardPurchase}
            onUpdateTransaction={handleUpdateTransaction}
            onVoidCardPurchase={handleVoidCardPurchase}
            onVoidTransaction={handleVoidTransaction}
          />
        ) : null}

        {activeView === "reimbursements" ? (
          <ReimbursementsView
            surface={surface}
            accounts={accounts}
            cards={cards}
            month={selectedMonth}
            refreshKey={refreshKey}
            onError={(error) => showErrorToast(error)}
            onExported={(result) => {
              showToast(
                "success",
                result.reusedExisting
                  ? `PDF já existia e foi aberto: ${result.fileName}`
                  : `PDF exportado: ${result.fileName}`,
              );
            }}
            onOpenLedgerFiltered={openLedgerWithFilters}
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
            onUndoPendingPayment={handleVoidTransaction}
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
            onUpdateInvoicePayment={handleUpdateInvoicePayment}
            onError={(message) => showToast("error", message)}
            onCardConverted={async (message: string) => {
              await refreshData();
              setRefreshKey((k) => k + 1);
              showToast("success", message);
            }}
            uiDensity={uiDensity}
          />
        ) : null}

        {activeView === "import" ? (
          <ImportView
            isSyncing={pluggySyncing}
            onSync={() => handleSyncPluggy()}
            onError={(message) => showToast("error", message)}
            onChanged={() => {
              void refreshPluggyInboxCount();
              void refreshDataRef.current({ month: selectedMonth });
              setRefreshKey((value) => value + 1);
            }}
            refreshToken={pluggyInboxRefreshToken}
            names={importNames}
            onReview={(entry, remember) => {
              setReviewingEntry({
                entryId: entry.entry_id,
                kind: entry.kind,
                remember,
              });
              setQuickAddDraft(draftFromInboxEntry(entry));
              setQuickAddPreset(presetForInboxEntry(entry));
              // The bill the payment was matched to, so the composer opens on
              // it instead of on whichever invoice happens to be first.
              setQuickAddInvoiceId(
                entry.kind === "invoice_payment"
                  ? proposalText(entry, "invoice_id")
                  : undefined,
              );
              setIsQuickAddOpen(true);
            }}
          />
        ) : null}

        {activeView === "openFinance" ? (
          <OpenFinanceView
            onError={(message) => showToast("error", message)}
            onChanged={() => {
              void refreshPluggyInboxCount();
              setPluggyAccountsRefreshToken((value) => value + 1);
            }}
            onSync={() => handleSyncPluggy()}
            isSyncing={pluggySyncing}
            refreshToken={pluggyAccountsRefreshToken}
          />
        ) : null}

        {activeView === "settings" ? (
          <SettingsView
            isSubmitting={isSubmitting}
            themeColor={themeColor}
            darkMode={darkMode}
            investmentGoalPercent={investmentGoalPercent}
            onExportBackup={() => {
              void handleExportBackup();
            }}
            onCreatePluggyConnectToken={handleCreatePluggyConnectToken}
            onPluggyConnected={handlePluggyConnected}
            onPluggyItemDetected={handlePluggyItemDetected}
            onPluggyError={handlePluggyError}
            pluggyConnected={pluggyStatus?.connected ?? false}
            pluggyItems={pluggyStatus?.items ?? []}
            pluggyConnectorIds={pluggyStatus?.connector_ids ?? []}
            onLinkPluggyItem={handleLinkPluggyItem}
            onDiscoverPluggyItems={handleDiscoverPluggyItems}
            pluggyLastSyncedAt={pluggyStatus?.last_synced_at ?? null}
            pluggySyncing={pluggySyncing}
            onSyncPluggy={() => handleSyncPluggy()}
            pluggyCredentialsSupported={isTauriEnvironment()}
            pluggyCredentialsConfigured={pluggyCredentialsConfigured}
            pluggyCredentialsLoading={pluggyCredentialsLoading}
            onSavePluggyCredentials={handleSavePluggyCredentials}
            onClearPluggyCredentials={handleClearPluggyCredentials}
            onResetApplicationData={handleResetAllData}
            onThemeColorChange={setThemeColor}
            onDarkModeChange={setDarkMode}
            onInvestmentGoalPercentChange={setInvestmentGoalPercent}
            securityState={securityState}
            desktopAutostartEnabled={desktopAutostartEnabled}
            desktopAutostartLoading={desktopAutostartLoading}
            desktopUpdateSupported={desktopUpdateSupported}
            desktopUpdateChecking={desktopUpdateChecking}
            desktopUpdateVersion={desktopUpdateInfo?.currentVersion ?? null}
            desktopUpdateAvailableVersion={
              desktopUpdateInfo?.availableVersion ?? null
            }
            desktopUpdatePublishedAt={desktopUpdateInfo?.publishedAt ?? null}
            desktopUpdateNotes={desktopUpdateInfo?.notes ?? null}
            desktopUpdateInstallState={desktopUpdateInstallState}
            desktopUpdateProgressPercent={desktopUpdateProgressPercent}
            onSetDesktopAutostart={handleSetDesktopAutostart}
            onCheckDesktopUpdate={handleCheckDesktopUpdate}
            onInstallDesktopUpdate={handleInstallDesktopUpdate}
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
              setReviewingEntry(null);
              setQuickAddDraft(null);
            }}
            preset={quickAddPreset}
            presetInvoiceId={quickAddInvoiceId}
            presetDraft={quickAddDraft}
            accounts={accounts}
            cards={cards}
            holdersByCard={holdersByCard}
            invoices={invoices}
            recurringRules={recurringRules.filter((rule) => rule.is_active)}
            isReviewingImport={reviewingEntry !== null}
            categories={categoryOptions}
            onCreateCategory={handleCreateCategory}
            onRemoveCategory={handleRemoveCategory}
            onSubmitTransaction={async (payload) => {
              if (reviewingEntry) {
                await acceptReviewedEntry({
                  transaction_type: payload.type,
                  category_id: payload.categoryId,
                  person_id: payload.personId || null,
                  account_id: payload.accountId,
                  payment_method: payload.paymentMethod,
                  amount: payload.amountInCents,
                  description: payload.description,
                  recurring_rule_id: payload.recurringRuleId || null,
                  ...(payload.occurredAt
                    ? { occurred_at: payload.occurredAt }
                    : {}),
                }, "bank_transaction");
                return;
              }
              await handleTransactionSubmit(payload);
            }}
            onSubmitTransfer={async (payload) => {
              if (reviewingEntry) {
                await acceptReviewedEntry({
                  from_account_id: payload.fromAccountId,
                  to_account_id: payload.toAccountId,
                  amount: payload.amountInCents,
                  description: payload.description,
                  ...(payload.occurredAt
                    ? { occurred_at: payload.occurredAt }
                    : {}),
                }, "transfer");
                return;
              }
              await handleTransferSubmit(payload);
            }}
            onSubmitCardPurchase={async (payload) => {
              if (reviewingEntry) {
                await acceptReviewedEntry({
                  category_id: payload.categoryId,
                  person_id: payload.personId || null,
                  card_id: payload.cardId,
                  // Sent even when empty: the composer seeds it with whatever
                  // the backend resolved from the card's last four digits, so
                  // an empty value here is the reviewer moving the purchase to
                  // the titular, not the field going unanswered.
                  holder_id: payload.holderId || null,
                  purchase_date: payload.purchaseDate,
                  amount: payload.amountInCents,
                  installments_count: payload.installmentsCount,
                  description: payload.description,
                  recurring_rule_id: payload.recurringRuleId || null,
                }, "card_purchase");
                return;
              }
              await handleCreateCardPurchase(payload);
            }}
            onSubmitRecurringRule={async (payload) => {
              await handleCreateRecurringRule(payload);
            }}
            onSubmitInvoicePayment={async (payload) => {
              if (reviewingEntry) {
                await acceptReviewedEntry({
                  invoice_id: payload.invoiceId,
                  account_id: payload.accountId,
                  amount: payload.amountInCents,
                  paid_at: payload.paidAt,
                }, "invoice_payment");
                return;
              }
              await handlePayInvoice(payload);
            }}
            onSubmitInvestmentMovement={async (payload) => {
              if (reviewingEntry) {
                await acceptReviewedEntry({
                  movement_type: payload.type,
                  account_id: payload.accountId,
                  occurred_at: payload.occurredAt,
                  // What the movement is worth, which for a buy or a sell —
                  // the only two Pluggy proposes — is both of the figures
                  // below. Absent on a kind the review retyped into something
                  // that has neither, where the staged amount still stands.
                  amount: payload.investedAmountInCents ?? payload.cashAmountInCents,
                  description: payload.description,
                  // Left out on purpose: the composer has no ticker field, so
                  // sending it would erase the asset the proposal came with.
                  cash_amount: payload.cashAmountInCents,
                  invested_amount: payload.investedAmountInCents,
                  contribution_amount: payload.contributionAmountInCents,
                  dividend_amount: payload.dividendAmountInCents,
                  reinvested_dividend_amount:
                    payload.reinvestedDividendAmountInCents,
                }, "investment_movement");
                return;
              }
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

function buildErrorDiagnostic(error: unknown): string | null {
  if (error instanceof ApiError && error.diagnostic) {
    return error.diagnostic;
  }

  if (!(error instanceof Error)) {
    return null;
  }

  const location = globalThis.location;
  const navigator = globalThis.navigator;
  const payload = {
    diagnostic_type: "frontend_error",
    captured_at: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: truncateDiagnosticValue(error.stack ?? "", 3000),
    },
    runtime: {
      api_base_url: API_BASE_URL,
      page_href: location?.href ?? null,
      page_origin: location?.origin ?? null,
      page_protocol: location?.protocol ?? null,
      user_agent: navigator?.userAgent ?? null,
      language: navigator?.language ?? null,
    },
  };
  return JSON.stringify(payload, null, 2);
}

function truncateDiagnosticValue(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  const hiddenCount = value.length - maxLength;
  return `${value.slice(0, maxLength)}...[truncated:${hiddenCount}]`;
}

function isLikelyLanConnectionError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return false;
  }

  if (error instanceof TypeError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const normalized = error.message.trim().toLowerCase();
  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("network request failed") ||
    normalized.includes("networkerror") ||
    normalized.includes("load failed")
  );
}

function MobileLanWarningScreen({
  isRetrying,
  onRetry,
}: {
  isRetrying: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="relative min-h-screen overflow-hidden bg-background px-5 py-8 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 12% 16%, hsl(var(--warning) / 0.2), transparent 42%), radial-gradient(circle at 92% 4%, hsl(var(--primary) / 0.18), transparent 38%)",
        }}
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="rounded-[2rem] border border-warning/40 bg-surface/95 p-7 shadow-xl backdrop-blur">
          <span className="inline-flex items-center rounded-full border border-warning/60 bg-warning/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-warning">
            Conexao local
          </span>

          <h1 className="mt-4 text-2xl font-black leading-tight text-foreground">
            Celular fora da rede do desktop
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Não conseguimos acessar os dados desta sessão. Conecte o celular na
            mesma rede Wi-Fi do computador para continuar.
          </p>

          <div className="mt-5 rounded-2xl border border-border bg-accent/35 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Checklist rapido
            </p>
            <ul className="mt-2 space-y-2 text-sm text-foreground">
              <li>1. Confirmar que desktop e celular estao na mesma rede.</li>
              <li>2. Desativar VPN ou rede movel temporariamente.</li>
              <li>3. Atualizar esta tela apos reconectar.</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="mt-6 h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRetrying ? "Tentando reconectar..." : "Tentar novamente"}
          </button>
        </div>
      </div>
    </section>
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
