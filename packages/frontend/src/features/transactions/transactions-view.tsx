import { useEffect, useState, type FormEvent } from "react";

import type {
  AccountSummary,
  TransactionFilters,
  TransactionSummary,
  TransactionUpdatePayload,
} from "../../lib/api";
import { getCategoryOptions } from "../../lib/categories";
import {
  formatCategoryName,
  formatCurrency,
  formatDateTime,
  formatPaymentMethod,
  formatTransactionStatus,
  formatTransactionType,
  toDateTimeInputValue,
  toIsoDateTime,
} from "../../lib/format";

type TransactionsViewProps = {
  accounts: AccountSummary[];
  transactions: TransactionSummary[];
  filters: TransactionFilters;
  isSubmitting: boolean;
  onApplyFilters: (filters: TransactionFilters) => Promise<void>;
  onUpdateTransaction: (
    transactionId: string,
    payload: TransactionUpdatePayload,
  ) => Promise<void>;
  onVoidTransaction: (transactionId: string) => Promise<void>;
};

type TransactionEditForm = {
  occurredAt: string;
  type: "income" | "expense";
  amount: string;
  accountId: string;
  paymentMethod: "PIX" | "CASH" | "OTHER";
  categoryId: string;
  description: string;
  personId: string;
};

export function TransactionsView({
  accounts,
  transactions,
  filters,
  isSubmitting,
  onApplyFilters,
  onUpdateTransaction,
  onVoidTransaction,
}: TransactionsViewProps) {
  const [filterForm, setFilterForm] = useState<TransactionFilters>(filters);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TransactionEditForm | null>(null);

  useEffect(() => {
    setFilterForm(filters);
  }, [filters]);

  async function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onApplyFilters(filterForm);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (editingTransactionId === null || editForm === null) {
      return;
    }

    await onUpdateTransaction(editingTransactionId, {
      occurredAt: toIsoDateTime(editForm.occurredAt),
      type: editForm.type,
      amountInCents: toCents(editForm.amount),
      accountId: editForm.accountId,
      paymentMethod: editForm.paymentMethod,
      categoryId: editForm.categoryId,
      description: editForm.description,
      personId: editForm.personId || undefined,
    });

    setEditingTransactionId(null);
    setEditForm(null);
  }

  const editCategoryOptions = getCategoryOptions(editForm?.categoryId);

  return (
    <section aria-label="Historico e filtros" className="panel-card">
      <form className="filters-grid" onSubmit={handleFilterSubmit}>
        <label>
          Buscar
          <input
            onChange={(event) =>
              setFilterForm((current) => ({
                ...current,
                text: event.target.value,
              }))
            }
            value={filterForm.text}
          />
        </label>
        <label>
          De
          <input
            onChange={(event) =>
              setFilterForm((current) => ({
                ...current,
                from: event.target.value,
              }))
            }
            type="date"
            value={filterForm.from}
          />
        </label>
        <label>
          {"At\u00E9"}
          <input
            onChange={(event) =>
              setFilterForm((current) => ({
                ...current,
                to: event.target.value,
              }))
            }
            type="date"
            value={filterForm.to}
          />
        </label>
        <label>
          Conta do filtro
          <select
            onChange={(event) =>
              setFilterForm((current) => ({
                ...current,
                account: event.target.value,
              }))
            }
            value={filterForm.account}
          >
            <option value="">Todas</option>
            {accounts.map((account) => (
              <option key={account.account_id} value={account.account_id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {"M\u00E9todo do filtro"}
          <select
            onChange={(event) =>
              setFilterForm((current) => ({
                ...current,
                method: event.target.value as TransactionFilters["method"],
              }))
            }
            value={filterForm.method}
          >
            <option value="">Todos</option>
            <option value="PIX">PIX</option>
            <option value="CASH">Dinheiro</option>
            <option value="OTHER">Outro</option>
          </select>
        </label>
        <label>
          Categoria do filtro
          <input
            onChange={(event) =>
              setFilterForm((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
            value={filterForm.category}
          />
        </label>
        <label>
          Pessoa do filtro
          <input
            onChange={(event) =>
              setFilterForm((current) => ({
                ...current,
                person: event.target.value,
              }))
            }
            value={filterForm.person}
          />
        </label>
        <div className="inline-actions">
          <button className="primary-button" disabled={isSubmitting} type="submit">
            Aplicar filtros
          </button>
        </div>
      </form>

      {editingTransactionId !== null && editForm !== null ? (
        <form className="panel-card panel-card--nested" onSubmit={handleEditSubmit}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Edicao</p>
              <h3 className="section-title">Editar transacao</h3>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Data da transacao
              <input
                aria-label="Data da transacao"
                onChange={(event) =>
                  setEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          occurredAt: event.target.value,
                        },
                  )
                }
                required
                type="datetime-local"
                value={editForm.occurredAt}
              />
            </label>
            <label>
              Tipo da transacao
              <select
                aria-label="Tipo da transacao"
                onChange={(event) =>
                  setEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          type: event.target.value as TransactionEditForm["type"],
                        },
                  )
                }
                value={editForm.type}
              >
                <option value="expense">Saida</option>
                <option value="income">Entrada</option>
              </select>
            </label>
            <label>
              Conta da transacao
              <select
                aria-label="Conta da transacao"
                onChange={(event) =>
                  setEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          accountId: event.target.value,
                        },
                  )
                }
                value={editForm.accountId}
              >
                {accounts.map((account) => (
                  <option key={account.account_id} value={account.account_id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Metodo da transacao
              <select
                aria-label={"M\u00E9todo da transa\u00E7\u00E3o"}
                onChange={(event) =>
                  setEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          paymentMethod: event.target.value as TransactionEditForm["paymentMethod"],
                        },
                  )
                }
                value={editForm.paymentMethod}
              >
                <option value="PIX">PIX</option>
                <option value="CASH">Dinheiro</option>
                <option value="OTHER">Outro</option>
              </select>
            </label>
            <label>
              Descricao da transacao
              <input
                aria-label="Descricao da transacao"
                onChange={(event) =>
                  setEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          description: event.target.value,
                        },
                  )
                }
                required
                value={editForm.description}
              />
            </label>
            <label>
              Valor da transacao
              <input
                aria-label="Valor da transacao"
                inputMode="decimal"
                min="0.01"
                onChange={(event) =>
                  setEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          amount: event.target.value,
                        },
                  )
                }
                required
                step="0.01"
                value={editForm.amount}
              />
            </label>
            <label>
              Categoria da transacao
              <select
                aria-label="Categoria da transacao"
                onChange={(event) =>
                  setEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          categoryId: event.target.value,
                        },
                  )
                }
                required
                value={editForm.categoryId}
              >
                {editCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pessoa da transacao
              <input
                aria-label="Pessoa da transacao"
                onChange={(event) =>
                  setEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          personId: event.target.value,
                        },
                  )
                }
                value={editForm.personId}
              />
            </label>
          </div>
          <div className="inline-actions">
            <button className="primary-button" disabled={isSubmitting} type="submit">
              Salvar alteracoes
            </button>
            <button
              className="ghost-button"
              onClick={() => {
                setEditingTransactionId(null);
                setEditForm(null);
              }}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {transactions.length === 0 ? (
        <div className="empty-state">Nenhuma transacao registrada.</div>
      ) : (
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>{"Descri\u00E7\u00E3o"}</th>
                <th>Categoria</th>
                <th>Conta</th>
                <th>{"M\u00E9todo"}</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Valor</th>
                <th>{"A\u00E7\u00F5es"}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.transaction_id}>
                  <td>{formatDateTime(transaction.occurred_at)}</td>
                  <td>{transaction.description ?? transaction.category_id}</td>
                  <td>{formatCategoryName(transaction.category_id)}</td>
                  <td>{resolveAccountName(transaction.account_id, accounts)}</td>
                  <td>{formatPaymentMethod(transaction.payment_method)}</td>
                  <td>{formatTransactionType(transaction.type)}</td>
                  <td>
                    <span
                      className={`status-badge status-badge--${transaction.status}`}
                    >
                      {formatTransactionStatus(transaction.status)}
                    </span>
                  </td>
                  <td>{formatCurrency(transaction.amount)}</td>
                  <td>
                    <div className="inline-actions">
                      <button
                        className="ghost-button"
                        disabled={transaction.status !== "active"}
                        onClick={() => {
                          setEditingTransactionId(transaction.transaction_id);
                          setEditForm({
                            occurredAt: toDateTimeInputValue(transaction.occurred_at),
                            type: transaction.type as TransactionEditForm["type"],
                            amount: String(transaction.amount / 100),
                            accountId: transaction.account_id,
                            paymentMethod:
                              transaction.payment_method as TransactionEditForm["paymentMethod"],
                            categoryId: transaction.category_id,
                            description:
                              transaction.description ?? transaction.category_id,
                            personId: transaction.person_id ?? "",
                          });
                        }}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className="ghost-button ghost-button--danger"
                        disabled={transaction.status !== "active"}
                        onClick={() => void onVoidTransaction(transaction.transaction_id)}
                        type="button"
                      >
                        Estornar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function resolveAccountName(accountId: string, accounts: AccountSummary[]): string {
  return accounts.find((account) => account.account_id === accountId)?.name ?? accountId;
}

function toCents(rawValue: string): number {
  return Math.round(Number(rawValue.replace(",", ".")) * 100);
}
