import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { TransactionFilters } from "../../lib/api";
import { ReportsView } from "./reports-view";

describe("ReportsView", () => {
  it("renders totals, category breakdown, weekly trend and future commitments", () => {
    const onOpenLedgerFiltered = vi.fn();
    render(
      <ReportsView
        accounts={[]}
        categories={[{ value: "food", label: "Alimentacao" }]}
        filters={{
          period: "month",
          reference: "2026-04-15",
          from: "",
          to: "",
          category: "",
          account: "",
          card: "",
          method: "",
          person: "",
          text: "",
        }}
        loading={false}
        onApplyFilters={vi.fn(async () => undefined)}
        onOpenLedgerFiltered={onOpenLedgerFiltered}
        summary={{
          period: {
            type: "month",
            from: "2026-04-01T00:00:00Z",
            to: "2026-04-30T23:59:59Z",
          },
          totals: {
            income_total: 100_00,
            expense_total: 80_00,
            net_total: 20_00,
          },
          expense_mix: {
            fixed_total: 20_00,
            variable_total: 20_00,
            installment_total: 40_00,
          },
          card_breakdown: [
            {
              card_id: "card-1",
              total: 40_00,
            },
          ],
          expense_evolution: [
            {
              month: "2026-03",
              expense_total: 70_00,
            },
            {
              month: "2026-04",
              expense_total: 80_00,
            },
          ],
          month_projection: {
            current_balance: 300_00,
            projected_end_balance: 180_00,
            pending_fixed_total: 40_00,
            invoice_due_total: 80_00,
            planned_income_total: 0,
            installment_impact_total: 40_00,
          },
          category_breakdown: [
            {
              category_id: "food",
              total: 25_00,
            },
          ],
          weekly_trend: [
            {
              week: "2026-W14",
              income_total: 100_00,
              expense_total: 40_00,
              net_total: 60_00,
            },
          ],
          future_commitments: {
            period_installment_impact_total: 40_00,
            future_installment_total: 80_00,
            future_installment_months: [
              { month: "2026-05", total: 40_00 },
              { month: "2026-06", total: 40_00 },
            ],
          },
        }}
        uiDensity="compact"
      />,
    );

    expect(screen.getByText("Consumo por categoria")).toBeInTheDocument();
    expect(screen.getByText("Tendencia por semana")).toBeInTheDocument();
    expect(screen.getAllByText("Parcelas futuras").length).toBeGreaterThan(0);
    expect(screen.getByText("2026-W14")).toBeInTheDocument();
    expect(screen.getByText("2026-05")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 40,00").length).toBeGreaterThan(1);
    expect(screen.getByText(/fluxo e projecao simples/i)).toBeInTheDocument();
    expect(screen.getByText(/fixos x variaveis x parcelas/i)).toBeInTheDocument();
    expect(screen.getByText(/gastos por cartao/i)).toBeInTheDocument();
    expect(screen.getByText(/evolucao mensal de gastos/i)).toBeInTheDocument();
    expect(screen.getByText(/projecao ate o fim do mes/i)).toBeInTheDocument();
  });

  it("submits custom period filters", async () => {
    const onApplyFilters = vi.fn<(filters: TransactionFilters) => Promise<void>>(async () => undefined);
    const onOpenLedgerFiltered = vi.fn();
    render(
      <ReportsView
        accounts={[]}
        categories={[{ value: "food", label: "Alimentacao" }]}
        filters={{
          period: "month",
          reference: "2026-04-15",
          from: "",
          to: "",
          category: "",
          account: "",
          card: "",
          method: "",
          person: "",
          text: "",
        }}
        loading={false}
        onApplyFilters={onApplyFilters}
        onOpenLedgerFiltered={onOpenLedgerFiltered}
        summary={null}
        uiDensity="compact"
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText(/periodo/i), "custom");
    await userEvent.type(screen.getByLabelText(/^de$/i), "2026-04-01");
    await userEvent.type(screen.getByLabelText(/^ate$/i), "2026-04-30");
    await userEvent.click(screen.getByRole("button", { name: /aplicar filtros/i }));

    expect(onApplyFilters).toHaveBeenCalledTimes(1);
    expect(onApplyFilters.mock.calls[0]?.[0]).toMatchObject({
      period: "custom",
      from: "2026-04-01",
      to: "2026-04-30",
    });
  });


  it("opens the ledger range drill-down as a custom period", async () => {
    const onOpenLedgerFiltered = vi.fn();
    render(
      <ReportsView
        accounts={[]}
        categories={[{ value: "food", label: "Alimentacao" }]}
        filters={{
          period: "month",
          reference: "2026-04-15",
          from: "",
          to: "",
          category: "",
          account: "",
          card: "",
          method: "",
          person: "",
          text: "",
        }}
        loading={false}
        onApplyFilters={vi.fn(async () => undefined)}
        onOpenLedgerFiltered={onOpenLedgerFiltered}
        summary={{
          period: {
            type: "week",
            from: "2026-04-07T00:00:00Z",
            to: "2026-04-13T23:59:59Z",
          },
          totals: {
            income_total: 100_00,
            expense_total: 80_00,
            net_total: 20_00,
          },
          expense_mix: {
            fixed_total: 0,
            variable_total: 80_00,
            installment_total: 0,
          },
          card_breakdown: [],
          expense_evolution: [],
          month_projection: {
            current_balance: 100_00,
            projected_end_balance: 100_00,
            pending_fixed_total: 0,
            invoice_due_total: 0,
            planned_income_total: 0,
            installment_impact_total: 0,
          },
          category_breakdown: [],
          weekly_trend: [],
          future_commitments: {
            period_installment_impact_total: 0,
            future_installment_total: 0,
            future_installment_months: [],
          },
        }}
        uiDensity="compact"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /ver recorte do periodo/i }));

    expect(onOpenLedgerFiltered).toHaveBeenCalledWith(
      expect.objectContaining({
        period: "custom",
        from: "2026-04-07",
        to: "2026-04-13",
      }),
      "2026-04",
    );
  });  it("opens the ledger with category drill-down shortcuts", async () => {
    const onOpenLedgerFiltered = vi.fn();
    render(
      <ReportsView
        accounts={[]}
        categories={[{ value: "food", label: "Alimentacao" }]}
        filters={{
          period: "month",
          reference: "2026-04-15",
          from: "",
          to: "",
          category: "",
          account: "",
          card: "",
          method: "",
          person: "",
          text: "",
        }}
        loading={false}
        onApplyFilters={vi.fn(async () => undefined)}
        onOpenLedgerFiltered={onOpenLedgerFiltered}
        summary={{
          period: {
            type: "month",
            from: "2026-04-01T00:00:00Z",
            to: "2026-04-30T23:59:59Z",
          },
          totals: {
            income_total: 100_00,
            expense_total: 80_00,
            net_total: 20_00,
          },
          expense_mix: {
            fixed_total: 0,
            variable_total: 80_00,
            installment_total: 0,
          },
          card_breakdown: [],
          expense_evolution: [],
          month_projection: {
            current_balance: 100_00,
            projected_end_balance: 100_00,
            pending_fixed_total: 0,
            invoice_due_total: 0,
            planned_income_total: 0,
            installment_impact_total: 0,
          },
          category_breakdown: [
            {
              category_id: "food",
              total: 25_00,
            },
          ],
          weekly_trend: [],
          future_commitments: {
            period_installment_impact_total: 0,
            future_installment_total: 0,
            future_installment_months: [],
          },
        }}
        uiDensity="compact"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /abrir alimenta.*historico/i }));

    expect(onOpenLedgerFiltered).toHaveBeenCalledTimes(1);
    const [filters, month] = onOpenLedgerFiltered.mock.calls[0] ?? [];
    expect(filters).toMatchObject({
      period: "month",
      category: "food",
    });
    expect(filters?.text).toMatch(/alimenta/i);
    expect(month).toBe("2026-04");
  });
});
