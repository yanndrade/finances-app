import "./styles.css";

import { useEffect, useState } from "react";

import { AppShell } from "./components/app-shell";
import type { AppView } from "./components/sidebar";
import { ToastViewport, type AppToast } from "./components/toast-viewport";
import { AccountsView } from "./features/accounts/accounts-view";
import { DashboardView } from "./features/dashboard/dashboard-view";
import { MovementsPanel } from "./features/movements/movements-panel";
import { SettingsView } from "./features/settings/settings-view";
import { TransactionsView } from "./features/transactions/transactions-view";
import {
  createAccount,
  createCashTransaction,
  createTransfer,
  fetchAccounts,
  fetchDashboardSummary,
  fetchTransactions,
  resetApplicationData,
  updateAccount,
  updateTransaction,
  voidTransaction,
  type AccountPayload,
  type AccountSummary,
  type AccountUpdatePayload,
  type CashTransactionPayload,
  type DashboardSummary,
  type TransactionFilters,
  type TransactionSummary,
  type TransactionUpdatePayload,
  type TransferPayload,
} from "./lib/api";

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
    title: "Visao geral do caixa",
    description:
      "Saude financeira, controle de gastos e acoes pendentes \u2014 tudo em um lugar.",
  },
  transactions: {
    title: "Transacoes e historico",
    description:
      "Filtre o fluxo, ajuste dados pontuais e estorne lancamentos sem perder rastreabilidade.",
  },
  accounts: {
    title: "Contas e saldos",
    description:
      "Mantenha o mapa das suas contas atualizado com saldos iniciais e status ativos.",
  },
  movements: {
    title: "Entrada r\u00e1pida de caixa",
    description:
      "Registre entradas, sa\u00eddas e transfer\u00eancias internas com o m\u00ednimo de fric\u00e7\u00e3o.",
  },
  settings: {
    title: "Configura\u00e7\u00f5es",
    description:
      "Ferramentas de desenvolvimento e espa\u00e7o reservado para prefer\u00eancias futuras.",
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
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>(
    EMPTY_TRANSACTION_FILTERS,
  );
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      const [nextDashboard, nextAccounts, nextTransactions] = await Promise.all([
        fetchDashboardSummary(month),
        fetchAccounts(),
        fetchTransactions(filters),
      ]);

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

  async function handleUpdateAccount(
    accountId: string,
    payload: AccountUpdatePayload,
  ): Promise<void> {
    await runMutation(
      () => updateAccount(accountId, payload),
      "Conta atualizada com sucesso.",
    );
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
      title={activeMeta.title}
    >
      {activeView === "dashboard" ? (
        <DashboardView
          accounts={accounts}
          dashboard={dashboard}
          loading={loading}
          month={selectedMonth}
          onMonthChange={setSelectedMonth}
          onNavigate={setActiveView}
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

      {activeView === "movements" ? (
        <MovementsPanel
          accounts={accounts}
          isSubmitting={isSubmitting}
          onSubmitTransaction={handleTransactionSubmit}
          onSubmitTransfer={handleTransferSubmit}
        />
      ) : null}

      {activeView === "settings" ? (
        <SettingsView
          isSubmitting={isSubmitting}
          onResetApplicationData={handleResetAllData}
        />
      ) : null}

      <ToastViewport
        onDismiss={() => setToast(null)}
        toast={toast}
      />
    </AppShell>
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
