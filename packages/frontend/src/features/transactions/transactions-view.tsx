import { DataTable } from "../../components/data-table";
import type { TransactionSummary } from "../../lib/api";
import { formatCurrency } from "../../lib/format";

type TransactionsViewProps = {
  transactions: TransactionSummary[];
};

export function TransactionsView({ transactions }: TransactionsViewProps) {
  return (
    <section className="panel-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Transacoes</p>
          <h2>Movimentacoes recentes</h2>
        </div>
      </div>
      <DataTable
        columns={[
          {
            key: "description",
            header: "Descricao",
            render: (row) => row.description ?? row.category_id,
          },
          {
            key: "type",
            header: "Tipo",
            render: (row) => row.type,
          },
          {
            key: "account",
            header: "Conta",
            render: (row) => row.account_id,
          },
          {
            key: "amount",
            header: "Valor",
            render: (row) => formatCurrency(row.amount),
          },
        ]}
        emptyLabel="Nenhuma transacao registrada."
        rows={transactions}
      />
    </section>
  );
}
