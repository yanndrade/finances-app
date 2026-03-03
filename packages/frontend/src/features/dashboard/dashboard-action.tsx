import { useState } from "react";

import type { AccountSummary, TransactionSummary } from "../../lib/api";
import {
  formatCurrency,
  formatDateTime,
  formatTransactionType,
} from "../../lib/format";

type DashboardActionProps = {
  reviewQueue: TransactionSummary[];
  recentTransactions: TransactionSummary[];
  accounts: AccountSummary[];
  onNavigate: (view: "movements" | "transactions") => void;
  onUpdateTransaction: (
    transactionId: string,
    updates: { categoryId?: string; description?: string },
  ) => void;
};

type QuickFilter = "all" | "income" | "expense" | "transfer";

export function DashboardAction({
  reviewQueue,
  recentTransactions,
  accounts,
  onNavigate,
  onUpdateTransaction,
}: DashboardActionProps) {
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const filteredTransactions =
    quickFilter === "all"
      ? recentTransactions.slice(0, 8)
      : recentTransactions.filter((t) => t.type === quickFilter).slice(0, 8);

  return (
    <section aria-label="Acoes pendentes" className="dashboard-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Acao</p>
          <h2 className="section-title">O que precisa de atencao</h2>
        </div>
      </div>

      <div className="action-grid">
        <article className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Para revisar</p>
              <h3 className="section-title">
                {reviewQueue.length > 0
                  ? `${reviewQueue.length} transac${reviewQueue.length === 1 ? "ao" : "oes"}`
                  : "Tudo em dia"}
              </h3>
            </div>
          </div>

          {reviewQueue.length === 0 ? (
            <div className="empty-state empty-state--guided">
              <p>Nenhuma transacao precisa de revisao.</p>
              <p className="empty-state__hint">
                Transacoes sem descricao ou categoria aparecerao aqui.
              </p>
            </div>
          ) : (
            <div className="review-list">
              {reviewQueue.slice(0, 5).map((transaction) => (
                <ReviewItem
                  accounts={accounts}
                  key={transaction.transaction_id}
                  onUpdate={onUpdateTransaction}
                  transaction={transaction}
                />
              ))}
              {reviewQueue.length > 5 ? (
                <button
                  className="ghost-button"
                  onClick={() => onNavigate("transactions")}
                  type="button"
                >
                  Ver todas ({reviewQueue.length})
                </button>
              ) : null}
            </div>
          )}
        </article>

        <article className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Transacoes</p>
              <h3 className="section-title">Ultimas movimentacoes</h3>
            </div>
          </div>

          <div className="quick-filters">
            {(
              [
                { key: "all", label: "Todas" },
                { key: "income", label: "Entradas" },
                { key: "expense", label: "Saidas" },
                { key: "transfer", label: "Transferencias" },
              ] as const
            ).map((filter) => (
              <button
                className={`filter-chip${quickFilter === filter.key ? " filter-chip--active" : ""}`}
                key={filter.key}
                onClick={() => setQuickFilter(filter.key)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="empty-state empty-state--guided">
              <p>Nenhuma transacao encontrada.</p>
              <p className="empty-state__hint">
                Comece adicionando suas primeiras transacoes.
              </p>
              <button
                className="secondary-button"
                onClick={() => onNavigate("movements")}
                type="button"
              >
                Adicionar transacao
              </button>
            </div>
          ) : (
            <div className="dashboard-list">
              {filteredTransactions.map((transaction) => (
                <div
                  className="dashboard-list__item"
                  key={transaction.transaction_id}
                >
                  <div>
                    <strong>
                      {transaction.description ?? transaction.category_id}
                    </strong>
                    <p>
                      {formatTransactionType(transaction.type)} •{" "}
                      {resolveAccountName(transaction.account_id, accounts)}
                    </p>
                  </div>
                  <div className="dashboard-list__meta">
                    <strong
                      className={
                        transaction.type === "income"
                          ? "text-positive"
                          : transaction.type === "expense"
                            ? "text-negative"
                            : ""
                      }
                    >
                      {transaction.type === "income" ? "+" : transaction.type === "expense" ? "-" : ""}
                      {formatCurrency(transaction.amount)}
                    </strong>
                    <span>{formatDateTime(transaction.occurred_at)}</span>
                  </div>
                </div>
              ))}
              <button
                className="ghost-button"
                onClick={() => onNavigate("transactions")}
                type="button"
              >
                Ver historico completo
              </button>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function ReviewItem({
  transaction,
  accounts,
  onUpdate,
}: {
  transaction: TransactionSummary;
  accounts: AccountSummary[];
  onUpdate: (
    id: string,
    updates: { categoryId?: string; description?: string },
  ) => void;
}) {
  const [description, setDescription] = useState(transaction.description ?? "");
  const [isDirty, setIsDirty] = useState(false);

  function handleSave() {
    if (description.trim()) {
      onUpdate(transaction.transaction_id, { description: description.trim() });
      setIsDirty(false);
    }
  }

  return (
    <div className="review-item">
      <div className="review-item__info">
        <div className="review-item__top">
          <strong>
            {formatTransactionType(transaction.type)} •{" "}
            {formatCurrency(transaction.amount)}
          </strong>
          <span className="review-item__date">
            {formatDateTime(transaction.occurred_at)}
          </span>
        </div>
        <p className="review-item__account">
          {resolveAccountName(transaction.account_id, accounts)} •{" "}
          {transaction.category_id}
        </p>
      </div>
      <div className="review-item__actions">
        <input
          aria-label="Descricao da transacao"
          className="review-item__input"
          onChange={(e) => {
            setDescription(e.target.value);
            setIsDirty(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          placeholder="Adicionar descricao..."
          type="text"
          value={description}
        />
        {isDirty ? (
          <button
            className="secondary-button review-item__save"
            onClick={handleSave}
            type="button"
          >
            Salvar
          </button>
        ) : null}
      </div>
    </div>
  );
}

function resolveAccountName(
  accountId: string,
  accounts: AccountSummary[],
): string {
  return (
    accounts.find((account) => account.account_id === accountId)?.name ??
    accountId
  );
}
