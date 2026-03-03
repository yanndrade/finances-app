import "./styles.css";

import { useEffect, useState } from "react";

import { AppShell } from "./components/app-shell";
import { AccountsView } from "./features/accounts/accounts-view";
import { DashboardView } from "./features/dashboard/dashboard-view";
import { MovementsPanel } from "./features/movements/movements-panel";
import { TransactionsView } from "./features/transactions/transactions-view";
import {
  createCashTransaction,
  createTransfer,
  fetchAccounts,
  fetchDashboardSummary,
  fetchTransactions,
  type AccountSummary,
  type CashTransactionPayload,
  type DashboardSummary,
  type TransactionSummary,
  type TransferPayload,
} from "./lib/api";

export function App() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void refreshData();
  }, []);

  async function refreshData() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [nextDashboard, nextAccounts, nextTransactions] = await Promise.all([
        fetchDashboardSummary(currentMonth()),
        fetchAccounts(),
        fetchTransactions(),
      ]);

      setDashboard(nextDashboard);
      setAccounts(nextAccounts);
      setTransactions(nextTransactions);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleTransactionSubmit(
    payload: CashTransactionPayload,
  ): Promise<void> {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createCashTransaction(payload);
      await refreshData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTransferSubmit(payload: TransferPayload): Promise<void> {
    if (payload.fromAccountId === payload.toAccountId) {
      setErrorMessage("Selecione contas diferentes para a transferencia.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createTransfer(payload);
      await refreshData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="panel-stack">
        <DashboardView dashboard={dashboard} loading={loading} />
        <MovementsPanel
          accounts={accounts}
          errorMessage={errorMessage}
          isSubmitting={isSubmitting}
          onSubmitTransaction={handleTransactionSubmit}
          onSubmitTransfer={handleTransferSubmit}
        />
        <AccountsView accounts={accounts} />
        <TransactionsView
          transactions={
            transactions.length > 0 ? transactions : dashboard?.recent_transactions ?? []
          }
        />
      </div>
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
