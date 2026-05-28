import { ChevronRight, PlusCircle } from "lucide-react";

import type { QuickAddPreset } from "../../components/quick-add-composer";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { MoneyValue } from "../../components/ui/money-value";
import { chartClassNames } from "../../lib/chart-theme";
import { formatDate } from "../../lib/format";
import type { AccountSummary, InvestmentMovementSummary, TransactionFilters } from "../../lib/api";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";

type MovementsPanelProps = {
  movements: InvestmentMovementSummary[];
  accounts: AccountSummary[];
  isSubmitting: boolean;
  hasMovementAccounts: boolean;
  uiDensity: UiDensity;
  onOpenQuickAdd: (preset: QuickAddPreset) => void;
  onOpenLedgerFiltered: (filters: Partial<TransactionFilters>, month?: string) => void;
};

export function MovementsPanel({
  movements,
  accounts,
  isSubmitting,
  hasMovementAccounts,
  uiDensity,
  onOpenQuickAdd,
  onOpenLedgerFiltered,
}: MovementsPanelProps) {
  const accountNameById = new Map(accounts.map((account) => [account.account_id, account.name]));
  const latestMonth = movements[0]?.occurred_at.slice(0, 7);

  function openInvestmentLedger() {
    if (!latestMonth) return;
    onOpenLedgerFiltered(
      {
        period: "custom",
        from: `${latestMonth}-01`,
        to: `${latestMonth}-31`,
        type: "investment",
      },
      latestMonth,
    );
  }

  return (
    <Card
      className={cn(
        "finance-card",
        chartClassNames.surface,
        uiDensity === "dense" ? "rounded-[1.6rem]" : "rounded-2xl",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 p-5 pb-3 md:p-6 md:pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Movimentos</h3>
          <p className="text-xs text-slate-400">Histórico operacional da carteira</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenQuickAdd("investment_contribution")}
            disabled={isSubmitting || !hasMovementAccounts}
            className="h-8 rounded-xl text-xs font-bold"
          >
            Novo aporte
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenQuickAdd("investment_purchase")}
            disabled={isSubmitting || !hasMovementAccounts}
            className="h-8 rounded-xl text-xs font-bold"
          >
            Nova compra
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenQuickAdd("investment_withdrawal")}
            disabled={isSubmitting || !hasMovementAccounts}
            className="h-8 rounded-xl text-xs font-bold"
          >
            Novo resgate
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-[12px] font-bold text-primary hover:bg-primary/5"
            onClick={openInvestmentLedger}
          >
            Ver no histórico <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      {!hasMovementAccounts && (
        <div className="px-5 pb-2 md:px-6">
          <p className="text-xs text-muted-foreground">
            Cadastre uma conta de caixa para registrar aportes e resgates.
          </p>
        </div>
      )}
      <CardContent className="p-0">
        {movements.length === 0 ? (
          <div className="px-6 pb-6 pt-2">
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <PlusCircle className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Nenhum movimento registrado neste período.
              </p>
            </div>
          </div>
        ) : (
          <div className={`table-shell table-shell--${uiDensity}`}>
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-50 hover:bg-transparent">
                  <TableHead className="px-6">Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Capital</TableHead>
                  <TableHead className="text-right">Proventos</TableHead>
                  <TableHead className="text-right">Reinvestido</TableHead>
                  <TableHead className="pr-6 text-right">Caixa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.movement_id} className="border-slate-50">
                    <TableCell className="px-6 font-medium text-slate-500">
                      {formatDate(movement.occurred_at)}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-lg bg-primary/8 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider text-primary">
                        {movementLabel(movement.type)}
                      </span>
                    </TableCell>
                    <TableCell
                      className="max-w-[200px] truncate font-medium text-slate-700"
                      title={movement.description ?? "Sem descrição"}
                    >
                      {movement.description ?? "Sem descrição"}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {accountNameById.get(movement.account_id) ?? movement.account_id}
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyValue value={movement.contribution_amount} neutral className="text-sm font-bold" />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyValue value={movement.dividend_amount} className="text-sm font-bold" />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyValue
                        value={movement.reinvested_dividend_amount ?? 0}
                        neutral
                        className="text-sm font-bold"
                      />
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <MoneyValue value={movement.cash_delta} className="text-sm font-bold" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function movementLabel(type: InvestmentMovementSummary["type"]): string {
  const labels: Record<InvestmentMovementSummary["type"], string> = {
    contribution: "Aporte",
    withdrawal: "Resgate",
    aporte: "Aporte",
    resgate: "Resgate",
    compra: "Compra",
    venda: "Venda",
    provento: "Provento",
    reinvestimento: "Reinvestimento",
    rendimento: "Rendimento",
    taxa: "Taxa",
    ajuste: "Ajuste",
    transferencia: "Transferência",
  };
  return labels[type];
}
