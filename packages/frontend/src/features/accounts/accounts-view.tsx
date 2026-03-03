import type { AccountSummary } from "../../lib/api";
import { formatCurrency } from "../../lib/format";

type AccountsViewProps = {
  accounts: AccountSummary[];
};

export function AccountsView({ accounts }: AccountsViewProps) {
  return (
    <section className="panel-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Contas</p>
          <h2>Saldo por conta</h2>
        </div>
      </div>
      {accounts.length === 0 ? (
        <div className="empty-state">Nenhuma conta cadastrada.</div>
      ) : (
        <div className="account-grid">
          {accounts.map((account) => (
            <article key={account.account_id} className="account-card">
              <div className="account-card__header">
                <strong>{account.name}</strong>
                <span>{account.type}</span>
              </div>
              <p className="account-card__balance">
                {formatCurrency(account.current_balance)}
              </p>
              <p className="account-card__meta">
                Saldo inicial {formatCurrency(account.initial_balance)}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
