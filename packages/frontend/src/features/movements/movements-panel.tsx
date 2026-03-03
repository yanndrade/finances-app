import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import type {
  AccountSummary,
  CashTransactionPayload,
  TransferPayload,
} from "../../lib/api";
import { formatCurrency } from "../../lib/format";

type PaymentMethod = "PIX" | "CASH" | "OTHER";
type QuickEntryMode = "income" | "expense" | "transfer";

type TransactionFormValues = {
  date: string;
  description: string;
  amount: string;
  accountId: string;
  paymentMethod: PaymentMethod;
  categoryId: string;
  personId: string;
  keepContext: boolean;
};

type TransferFormValues = {
  date: string;
  description: string;
  amount: string;
  fromAccountId: string;
  toAccountId: string;
};

type PersistedDefaults = {
  accountId?: string;
  paymentMethod?: PaymentMethod;
  keepContext?: boolean;
  recentCategories?: string[];
};

type MovementsPanelProps = {
  accounts: AccountSummary[];
  isSubmitting: boolean;
  onSubmitTransaction: (payload: CashTransactionPayload) => Promise<void>;
  onSubmitTransfer: (payload: TransferPayload) => Promise<void>;
};

const STORAGE_KEY = "quick-entry-defaults";
const PAYMENT_METHOD_OPTIONS: Array<{ label: string; value: PaymentMethod }> = [
  { label: "Dinheiro", value: "CASH" },
  { label: "PIX", value: "PIX" },
  { label: "Outro", value: "OTHER" },
];

export function MovementsPanel({
  accounts,
  isSubmitting,
  onSubmitTransaction,
  onSubmitTransfer,
}: MovementsPanelProps) {
  const persistedDefaults = readPersistedDefaults();
  const categoryListId = useId();
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<QuickEntryMode>("expense");
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [recentCategories, setRecentCategories] = useState<string[]>(
    persistedDefaults.recentCategories ?? [],
  );
  const [transactionForm, setTransactionForm] = useState<TransactionFormValues>(() =>
    createTransactionForm(accounts, persistedDefaults),
  );
  const [transferForm, setTransferForm] = useState<TransferFormValues>(() =>
    createTransferForm(accounts, persistedDefaults.accountId),
  );

  useEffect(() => {
    setTransactionForm((current) =>
      reconcileTransactionForm(current, accounts, persistedDefaults),
    );
    setTransferForm((current) =>
      reconcileTransferForm(current, accounts, persistedDefaults.accountId),
    );
  }, [accounts, persistedDefaults.accountId, persistedDefaults.keepContext, persistedDefaults.paymentMethod]);

  useEffect(() => {
    amountInputRef.current?.focus();
  }, [mode]);

  const canSubmitTransaction =
    accounts.length > 0 && toCents(transactionForm.amount) > 0 && !isSubmitting;
  const transferHasConflict =
    transferForm.fromAccountId.length > 0 &&
    transferForm.fromAccountId === transferForm.toAccountId;
  const canSubmitTransfer =
    accounts.length > 1 &&
    toCents(transferForm.amount) > 0 &&
    !transferHasConflict &&
    !isSubmitting;

  async function submitTransaction(options?: { forceKeepContext?: boolean }) {
    if (!canSubmitTransaction) {
      return;
    }

    const categoryId = transactionForm.categoryId.trim() || "other";
    const keepContext = options?.forceKeepContext ?? transactionForm.keepContext;
    const payload: CashTransactionPayload = {
      type: mode === "income" ? "income" : "expense",
      description: transactionForm.description.trim(),
      amountInCents: toCents(transactionForm.amount),
      accountId: transactionForm.accountId,
      paymentMethod: transactionForm.paymentMethod,
      categoryId,
      occurredAt: toIsoFromLocalDate(transactionForm.date),
    };

    if (transactionForm.personId.trim()) {
      payload.personId = transactionForm.personId.trim();
    }

    try {
      await onSubmitTransaction(payload);
    } catch {
      return;
    }

    persistDefaults({
      accountId: transactionForm.accountId,
      paymentMethod: transactionForm.paymentMethod,
      keepContext: transactionForm.keepContext,
      recentCategories: mergeRecentCategories(recentCategories, transactionForm.categoryId),
    });
    setRecentCategories((current) => mergeRecentCategories(current, transactionForm.categoryId));
    resetTransactionForm(keepContext);
  }

  async function submitTransfer() {
    if (!canSubmitTransfer) {
      return;
    }

    const payload: TransferPayload = {
      description: transferForm.description.trim(),
      amountInCents: toCents(transferForm.amount),
      fromAccountId: transferForm.fromAccountId,
      toAccountId: transferForm.toAccountId,
      occurredAt: toIsoFromLocalDate(transferForm.date),
    };

    try {
      await onSubmitTransfer(payload);
    } catch {
      return;
    }

    persistDefaults({
      accountId: transferForm.fromAccountId,
      paymentMethod: transactionForm.paymentMethod,
      keepContext: transactionForm.keepContext,
      recentCategories,
    });
    resetTransferForm();
  }

  function resetTransactionForm(keepContextOverride?: boolean) {
    const keepContext = keepContextOverride ?? transactionForm.keepContext;
    const nextDefaults = readPersistedDefaults();
    const stickyAccountId = resolveAccountId(
      transactionForm.accountId || nextDefaults.accountId || "",
      accounts,
    );
    const stickyPaymentMethod = resolvePaymentMethod(
      transactionForm.paymentMethod ?? nextDefaults.paymentMethod,
    );
    const stickyDate = keepContext ? transactionForm.date : todayDate();

    setTransactionForm({
      date: stickyDate,
      description: "",
      amount: "",
      accountId: stickyAccountId,
      paymentMethod: stickyPaymentMethod,
      categoryId: "",
      personId: "",
      keepContext: transactionForm.keepContext,
    });
  }

  function resetTransferForm() {
    setTransferForm((current) => ({
      date: current.date,
      description: "",
      amount: "",
      fromAccountId: resolveAccountId(current.fromAccountId, accounts),
      toAccountId: resolveTransferTarget(current.toAccountId, accounts, current.fromAccountId),
    }));
  }

  function handleTransactionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitTransaction();
  }

  function handleTransferSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitTransfer();
  }

  function handleTransactionKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      resetTransactionForm(true);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      const target = event.target as HTMLElement;
      if (target.tagName === "BUTTON") {
        return;
      }

      event.preventDefault();
      void submitTransaction({
        forceKeepContext: event.ctrlKey ? true : undefined,
      });
    }
  }

  function handleTransferKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      resetTransferForm();
      return;
    }

    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "x") {
      event.preventDefault();
      invertTransferAccounts();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      const target = event.target as HTMLElement;
      if (target.tagName === "BUTTON") {
        return;
      }

      event.preventDefault();
      void submitTransfer();
    }
  }

  function invertTransferAccounts() {
    setTransferForm((current) => {
      if (current.fromAccountId === current.toAccountId) {
        return {
          ...current,
          toAccountId: resolveTransferTarget("", accounts, current.fromAccountId),
        };
      }

      return {
        ...current,
        fromAccountId: current.toAccountId,
        toAccountId: current.fromAccountId,
      };
    });
  }

  function renderTransactionForm() {
    const buttonLabel = mode === "income" ? "Salvar entrada" : "Salvar saída";

    return (
      <form className="quick-entry-form" onKeyDown={handleTransactionKeyDown} onSubmit={handleTransactionSubmit}>
        <div className="quick-entry-form__header">
          <div>
            <h3 className="quick-entry-form__title">
              {mode === "income" ? "Nova entrada" : "Nova saída"}
            </h3>
            <p className="quick-entry-form__copy">
              Preencha o essencial e use o teclado para registrar mais rápido.
            </p>
          </div>
          <button
            aria-expanded={isDetailsOpen}
            className="ghost-button quick-entry-toggle"
            onClick={() => setIsDetailsOpen((current) => !current)}
            type="button"
          >
            Detalhes (opcional)
          </button>
        </div>

        <label className="quick-entry-field quick-entry-field--value">
          Valor
          <span className="quick-entry-currency">
            <span className="quick-entry-currency__prefix">R$</span>
            <input
              ref={amountInputRef}
              aria-label="Valor"
              autoComplete="off"
              inputMode="decimal"
              placeholder="0,00"
              required
              value={transactionForm.amount}
              onBlur={(event) =>
                setTransactionForm((current) => ({
                  ...current,
                  amount: formatCurrencyInput(event.target.value),
                }))
              }
              onChange={(event) =>
                setTransactionForm((current) => ({
                  ...current,
                  amount: sanitizeCurrencyInput(event.target.value),
                }))
              }
            />
          </span>
        </label>

        <label className="quick-entry-field">
          Descrição
          <input
            aria-label="Descrição"
            autoComplete="off"
            placeholder="Ex.: almoço, freela, saque"
            value={transactionForm.description}
            onChange={(event) =>
              setTransactionForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
        </label>

        <label className="quick-entry-field">
          Categoria
          <input
            aria-label="Categoria"
            autoComplete="off"
            list={categoryListId}
            placeholder="Digite para usar ou criar"
            value={transactionForm.categoryId}
            onChange={(event) =>
              setTransactionForm((current) => ({
                ...current,
                categoryId: event.target.value,
              }))
            }
          />
          <span className="field-hint">Opcional. Se ficar vazio, usamos “other”.</span>
        </label>

        <datalist id={categoryListId}>
          {recentCategories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>

        <div className="quick-entry-grid">
          <label className="quick-entry-field">
            Conta
            <select
              aria-label="Conta"
              value={transactionForm.accountId}
              onChange={(event) =>
                setTransactionForm((current) => ({
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

          <label className="quick-entry-field">
            Data
            <input
              aria-label="Data"
              type="date"
              value={transactionForm.date}
              onChange={(event) =>
                setTransactionForm((current) => ({
                  ...current,
                  date: event.target.value,
                }))
              }
            />
          </label>
        </div>

        {isDetailsOpen ? (
          <div className="quick-entry-details">
            <div className="quick-entry-grid">
              <label className="quick-entry-field">
                Método
                <select
                  aria-label="Método"
                  value={transactionForm.paymentMethod}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
                      ...current,
                      paymentMethod: event.target.value as PaymentMethod,
                    }))
                  }
                >
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="quick-entry-field">
                Pessoa relacionada
                <input
                  aria-label="Pessoa relacionada"
                  autoComplete="off"
                  placeholder="Opcional"
                  value={transactionForm.personId}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
                      ...current,
                      personId: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </div>
        ) : null}

        <label className="checkbox-field quick-entry-checkbox">
          <input
            aria-label="Salvar e adicionar outra"
            checked={transactionForm.keepContext}
            type="checkbox"
            onChange={(event) => {
              const keepContext = event.target.checked;

              setTransactionForm((current) => ({
                ...current,
                keepContext,
              }));
              persistDefaults({
                accountId: transactionForm.accountId,
                paymentMethod: transactionForm.paymentMethod,
                keepContext,
                recentCategories,
              });
            }}
          />
          <span>Salvar e adicionar outra</span>
        </label>

        <p className="quick-entry-shortcuts">
          Enter salva. Ctrl+Enter salva e continua. Esc limpa o formulário.
        </p>

        <button className="primary-button quick-entry-submit" disabled={!canSubmitTransaction} type="submit">
          {buttonLabel}
        </button>
      </form>
    );
  }

  function renderTransferForm() {
    const amountInCents = toCents(transferForm.amount);
    const fromAccount = accounts.find((account) => account.account_id === transferForm.fromAccountId);
    const toAccount = accounts.find((account) => account.account_id === transferForm.toAccountId);

    return (
      <form className="quick-entry-form" onKeyDown={handleTransferKeyDown} onSubmit={handleTransferSubmit}>
        <div className="quick-entry-form__header">
          <div>
            <h3 className="quick-entry-form__title">Transferência interna</h3>
            <p className="quick-entry-form__copy">
              Mova saldo entre contas sem lançar receita ou despesa.
            </p>
          </div>
          <button
            className="ghost-button quick-entry-toggle"
            onClick={invertTransferAccounts}
            type="button"
          >
            Inverter contas
          </button>
        </div>

        <label className="quick-entry-field quick-entry-field--value">
          Valor
          <span className="quick-entry-currency">
            <span className="quick-entry-currency__prefix">R$</span>
            <input
              ref={amountInputRef}
              aria-label="Valor"
              autoComplete="off"
              inputMode="decimal"
              placeholder="0,00"
              required
              value={transferForm.amount}
              onBlur={(event) =>
                setTransferForm((current) => ({
                  ...current,
                  amount: formatCurrencyInput(event.target.value),
                }))
              }
              onChange={(event) =>
                setTransferForm((current) => ({
                  ...current,
                  amount: sanitizeCurrencyInput(event.target.value),
                }))
              }
            />
          </span>
        </label>

        <div className="quick-entry-grid">
          <label className="quick-entry-field">
            Data
            <input
              aria-label="Data"
              type="date"
              value={transferForm.date}
              onChange={(event) =>
                setTransferForm((current) => ({
                  ...current,
                  date: event.target.value,
                }))
              }
            />
          </label>

          <label className="quick-entry-field">
            Conta de origem
            <select
              aria-label="Conta de origem"
              value={transferForm.fromAccountId}
              onChange={(event) =>
                setTransferForm((current) => {
                  const fromAccountId = event.target.value;

                  return {
                    ...current,
                    fromAccountId,
                    toAccountId: resolveTransferTarget(current.toAccountId, accounts, fromAccountId),
                  };
                })
              }
            >
              {accounts.map((account) => (
                <option key={account.account_id} value={account.account_id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="quick-entry-field">
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

        {transferHasConflict ? (
          <p className="field-error">
            A conta de origem e a conta de destino devem ser diferentes.
          </p>
        ) : null}

        <label className="quick-entry-field">
          Descrição
          <input
            aria-label="Descrição"
            autoComplete="off"
            placeholder="Opcional"
            value={transferForm.description}
            onChange={(event) =>
              setTransferForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
        </label>

        <p className="quick-entry-impact">
          {fromAccount?.name ?? "Origem"} ↓ {amountInCents > 0 ? formatCurrency(amountInCents) : "R$ 0,00"} |{" "}
          {toAccount?.name ?? "Destino"} ↑ {amountInCents > 0 ? formatCurrency(amountInCents) : "R$ 0,00"}
        </p>

        <p className="quick-entry-shortcuts">
          Enter salva. Ctrl+Shift+X inverte as contas. Esc limpa o formulário.
        </p>

        <button className="secondary-button quick-entry-submit" disabled={!canSubmitTransfer} type="submit">
          Salvar transferência
        </button>
      </form>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="screen-stack">
        <section className="panel-card quick-entry-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Movimentar</p>
              <h2 className="section-title">Entrada rápida de caixa</h2>
              <p className="section-copy">
                Preparando suas contas para uma entrada mais rápida.
              </p>
            </div>
          </div>
          <div className="loading-panel">Carregando contas...</div>
          <div className="skeleton-grid">
            <div className="skeleton skeleton--lg" />
            <div className="skeleton skeleton--md" />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="screen-stack">
      <section className="panel-card quick-entry-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Movimentar</p>
            <h2 className="section-title">Entrada rápida de caixa</h2>
            <p className="section-copy">
              Registre entradas, saídas e transferências internas com o mínimo de fricção.
            </p>
          </div>
        </div>

        <div aria-label="Modo de lançamento" className="quick-entry-modes" role="tablist">
          <button
            aria-pressed={mode === "income"}
            className={`quick-entry-mode ${mode === "income" ? "is-active" : ""}`}
            onClick={() => setMode("income")}
            type="button"
          >
            Entrada
          </button>
          <button
            aria-pressed={mode === "expense"}
            className={`quick-entry-mode ${mode === "expense" ? "is-active" : ""}`}
            onClick={() => setMode("expense")}
            type="button"
          >
            Saída
          </button>
          <button
            aria-pressed={mode === "transfer"}
            className={`quick-entry-mode ${mode === "transfer" ? "is-active" : ""}`}
            onClick={() => setMode("transfer")}
            type="button"
          >
            Transferência
          </button>
        </div>

        {mode === "transfer" ? renderTransferForm() : renderTransactionForm()}
      </section>
    </div>
  );
}

function createTransactionForm(
  accounts: AccountSummary[],
  persistedDefaults: PersistedDefaults,
): TransactionFormValues {
  return {
    date: todayDate(),
    description: "",
    amount: "",
    accountId: resolveAccountId(persistedDefaults.accountId ?? "", accounts),
    paymentMethod: resolvePaymentMethod(persistedDefaults.paymentMethod),
    categoryId: "",
    personId: "",
    keepContext: persistedDefaults.keepContext ?? false,
  };
}

function reconcileTransactionForm(
  current: TransactionFormValues,
  accounts: AccountSummary[],
  persistedDefaults: PersistedDefaults,
): TransactionFormValues {
  const nextAccountId = resolveAccountId(
    current.accountId || persistedDefaults.accountId || "",
    accounts,
  );
  const nextPaymentMethod = resolvePaymentMethod(current.paymentMethod ?? persistedDefaults.paymentMethod);

  if (nextAccountId === current.accountId && nextPaymentMethod === current.paymentMethod) {
    return current;
  }

  return {
    ...current,
    accountId: nextAccountId,
    paymentMethod: nextPaymentMethod,
  };
}

function createTransferForm(
  accounts: AccountSummary[],
  preferredAccountId?: string,
): TransferFormValues {
  const fromAccountId = resolveAccountId(preferredAccountId ?? "", accounts);

  return {
    date: todayDate(),
    description: "",
    amount: "",
    fromAccountId,
    toAccountId: resolveTransferTarget("", accounts, fromAccountId),
  };
}

function reconcileTransferForm(
  current: TransferFormValues,
  accounts: AccountSummary[],
  preferredAccountId?: string,
): TransferFormValues {
  const fromAccountId = resolveAccountId(current.fromAccountId || preferredAccountId || "", accounts);
  const toAccountId = resolveTransferTarget(current.toAccountId, accounts, fromAccountId);

  if (fromAccountId === current.fromAccountId && toAccountId === current.toAccountId) {
    return current;
  }

  return {
    ...current,
    fromAccountId,
    toAccountId,
  };
}

function readPersistedDefaults(): PersistedDefaults {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    return JSON.parse(rawValue) as PersistedDefaults;
  } catch {
    return {};
  }
}

function persistDefaults(nextDefaults: PersistedDefaults) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDefaults));
}

function mergeRecentCategories(current: string[], nextCategory: string): string[] {
  const trimmedCategory = nextCategory.trim();

  if (!trimmedCategory) {
    return current;
  }

  return [trimmedCategory, ...current.filter((category) => category !== trimmedCategory)].slice(0, 8);
}

function toCents(rawAmount: string): number {
  const trimmedAmount = rawAmount.trim();

  if (!trimmedAmount) {
    return 0;
  }

  const normalizedAmount = trimmedAmount
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const value = Number(normalizedAmount);

  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.round(value * 100);
}

function sanitizeCurrencyInput(rawAmount: string): string {
  const sanitized = rawAmount.replace(/[^\d,.-]/g, "");
  const negativePrefix = sanitized.startsWith("-") ? "-" : "";
  const unsignedValue = sanitized.replace(/-/g, "");
  const commaIndex = unsignedValue.indexOf(",");
  const dotIndex = unsignedValue.indexOf(".");
  const separatorIndex =
    commaIndex >= 0 ? commaIndex : dotIndex >= 0 ? dotIndex : -1;

  if (separatorIndex === -1) {
    return `${negativePrefix}${unsignedValue}`;
  }

  const integerPart = unsignedValue.slice(0, separatorIndex).replace(/[,.]/g, "");
  const decimalPart = unsignedValue.slice(separatorIndex + 1).replace(/[,.]/g, "");

  return `${negativePrefix}${integerPart},${decimalPart}`;
}

function formatCurrencyInput(rawAmount: string): string {
  const amountInCents = toCents(rawAmount);

  if (amountInCents <= 0) {
    return rawAmount.trim();
  }

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountInCents / 100);
}

function resolvePaymentMethod(currentMethod?: PaymentMethod): PaymentMethod {
  return currentMethod ?? "CASH";
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

  const hasCurrentAccount =
    currentAccountId.length > 0 &&
    accounts.some((account) => account.account_id === currentAccountId) &&
    currentAccountId !== fromAccountId;

  if (hasCurrentAccount) {
    return currentAccountId;
  }

  const alternateAccount = accounts.find((account) => account.account_id !== fromAccountId);

  return alternateAccount?.account_id ?? accounts[0].account_id;
}

function todayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toIsoFromLocalDate(dateValue: string): string {
  return new Date(`${dateValue}T12:00:00`).toISOString().replace(".000", "");
}
