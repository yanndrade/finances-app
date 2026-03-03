import { useEffect, useState, type FormEvent } from "react";

import type { AccountSummary, CashTransactionPayload, TransferPayload } from "../../lib/api";

type MovementFormValues = {
  type: "income" | "expense";
  description: string;
  amount: string;
  accountId: string;
  paymentMethod: "PIX" | "CASH" | "OTHER";
  categoryId: string;
};

type TransferFormValues = {
  description: string;
  amount: string;
  fromAccountId: string;
  toAccountId: string;
};

type MovementsPanelProps = {
  accounts: AccountSummary[];
  isSubmitting: boolean;
  onSubmitTransaction: (payload: CashTransactionPayload) => Promise<void>;
  onSubmitTransfer: (payload: TransferPayload) => Promise<void>;
  errorMessage: string | null;
};

const EMPTY_MOVEMENT: MovementFormValues = {
  type: "expense",
  description: "",
  amount: "",
  accountId: "",
  paymentMethod: "CASH",
  categoryId: "",
};

const EMPTY_TRANSFER: TransferFormValues = {
  description: "",
  amount: "",
  fromAccountId: "",
  toAccountId: "",
};

export function MovementsPanel({
  accounts,
  isSubmitting,
  onSubmitTransaction,
  onSubmitTransfer,
  errorMessage,
}: MovementsPanelProps) {
  const [movementForm, setMovementForm] = useState<MovementFormValues>({
    ...EMPTY_MOVEMENT,
    accountId: resolveAccountId("", accounts),
  });
  const [transferForm, setTransferForm] = useState<TransferFormValues>({
    ...EMPTY_TRANSFER,
    fromAccountId: resolveAccountId("", accounts),
    toAccountId: resolveTransferTarget("", accounts, accounts[0]?.account_id ?? ""),
  });

  useEffect(() => {
    setMovementForm((current) => {
      const accountId = resolveAccountId(current.accountId, accounts);

      if (accountId == current.accountId) {
        return current;
      }

      return {
        ...current,
        accountId,
      };
    });

    setTransferForm((current) => {
      const fromAccountId = resolveAccountId(current.fromAccountId, accounts);
      const toAccountId = resolveTransferTarget(current.toAccountId, accounts, fromAccountId);

      if (
        fromAccountId == current.fromAccountId &&
        toAccountId == current.toAccountId
      ) {
        return current;
      }

      return {
        ...current,
        fromAccountId,
        toAccountId,
      };
    });
  }, [accounts]);

  async function handleTransactionSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    await onSubmitTransaction({
      type: movementForm.type,
      description: movementForm.description,
      amountInCents: toCents(movementForm.amount),
      accountId: movementForm.accountId,
      paymentMethod: movementForm.paymentMethod,
      categoryId: movementForm.categoryId,
    });

    setMovementForm({
      ...EMPTY_MOVEMENT,
      accountId: movementForm.accountId,
    });
  }

  async function handleTransferSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    await onSubmitTransfer({
      description: transferForm.description,
      amountInCents: toCents(transferForm.amount),
      fromAccountId: transferForm.fromAccountId,
      toAccountId: transferForm.toAccountId,
    });

    setTransferForm({
      ...EMPTY_TRANSFER,
      fromAccountId: transferForm.fromAccountId,
      toAccountId: transferForm.toAccountId,
    });
  }

  return (
    <section className="panel-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Movimentar</p>
          <h2>Registrar caixa e transferencias</h2>
        </div>
      </div>
      {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
      <div className="forms-grid">
        <form className="form-card" onSubmit={handleTransactionSubmit}>
          <h3>Entrada ou saida</h3>
          <label>
            Tipo
            <select
              aria-label="Tipo"
              value={movementForm.type}
              onChange={(event) =>
                setMovementForm((current) => ({
                  ...current,
                  type: event.target.value as MovementFormValues["type"],
                }))
              }
            >
              <option value="expense">Saida</option>
              <option value="income">Entrada</option>
            </select>
          </label>
          <label>
            Conta
            <select
              aria-label="Conta"
              value={movementForm.accountId}
              onChange={(event) =>
                setMovementForm((current) => ({
                  ...current,
                  accountId: event.target.value,
                }))
              }
            >
              {accounts.map((account) => (
                <option key={account.account_id} value={account.account_id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Metodo
            <select
              aria-label="Metodo"
              value={movementForm.paymentMethod}
              onChange={(event) =>
                setMovementForm((current) => ({
                  ...current,
                  paymentMethod: event.target.value as MovementFormValues["paymentMethod"],
                }))
              }
            >
              <option value="CASH">CASH</option>
              <option value="PIX">PIX</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>
          <label>
            Descricao
            <input
              aria-label="Descricao"
              required
              value={movementForm.description}
              onChange={(event) =>
                setMovementForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Valor
            <input
              aria-label="Valor"
              inputMode="decimal"
              min="0.01"
              required
              step="0.01"
              value={movementForm.amount}
              onChange={(event) =>
                setMovementForm((current) => ({
                  ...current,
                  amount: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Categoria
            <input
              aria-label="Categoria"
              required
              value={movementForm.categoryId}
              onChange={(event) =>
                setMovementForm((current) => ({
                  ...current,
                  categoryId: event.target.value,
                }))
              }
            />
          </label>
          <button className="primary-button" disabled={isSubmitting} type="submit">
            Salvar transacao
          </button>
        </form>

        <form className="form-card" onSubmit={handleTransferSubmit}>
          <h3>Transferencia interna</h3>
          <label>
            Conta de origem
            <select
              aria-label="Conta de origem"
              value={transferForm.fromAccountId}
              onChange={(event) =>
                setTransferForm((current) => ({
                  ...current,
                  fromAccountId: event.target.value,
                }))
              }
            >
              {accounts.map((account) => (
                <option key={account.account_id} value={account.account_id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Conta de destino
            <select
              aria-label="Conta de destino"
              value={transferForm.toAccountId}
              onChange={(event) =>
                setTransferForm((current) => ({
                  ...current,
                  toAccountId: event.target.value,
                }))
              }
            >
              {accounts.map((account) => (
                <option key={account.account_id} value={account.account_id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Descricao da transferencia
            <input
              aria-label="Descricao da transferencia"
              required
              value={transferForm.description}
              onChange={(event) =>
                setTransferForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Valor da transferencia
            <input
              aria-label="Valor da transferencia"
              inputMode="decimal"
              min="0.01"
              required
              step="0.01"
              value={transferForm.amount}
              onChange={(event) =>
                setTransferForm((current) => ({
                  ...current,
                  amount: event.target.value,
                }))
              }
            />
          </label>
          <button className="secondary-button" disabled={isSubmitting} type="submit">
            Salvar transferencia
          </button>
        </form>
      </div>
    </section>
  );
}

function toCents(rawAmount: string): number {
  return Math.round(Number(rawAmount.replace(",", ".")) * 100);
}

function resolveAccountId(currentAccountId: string, accounts: AccountSummary[]): string {
  if (accounts.length === 0) {
    return "";
  }

  const hasCurrentAccount = accounts.some((account) => account.account_id === currentAccountId);

  if (hasCurrentAccount) {
    return currentAccountId;
  }

  return accounts[0].account_id;
}

function resolveTransferTarget(
  currentAccountId: string,
  accounts: AccountSummary[],
  fromAccountId: string,
): string {
  if (accounts.length === 0) {
    return "";
  }

  const hasCurrentAccount = accounts.some((account) => account.account_id === currentAccountId);

  if (hasCurrentAccount) {
    return currentAccountId;
  }

  const alternateAccount = accounts.find((account) => account.account_id !== fromAccountId);

  return alternateAccount?.account_id ?? accounts[0].account_id;
}
