import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { TransactionFilters } from "../../lib/api";
import { ReportsView } from "./reports-view";

describe("ReportsView", () => {
  it("renders totals, category breakdown, weekly trend and future commitments", () => {
    render(
      <ReportsView
        accounts={[]}
        filters={{
          period: "month",
          reference: "2026-04-15",
          from: "",
          to: "",
          category: "",
          account: "",
          method: "",
          person: "",
          text: "",
        }}
        isSubmitting={false}
        loading={false}
        onApplyFilters={vi.fn(async () => undefined)}
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
      />,
    );

    expect(screen.getByText("Consumo por categoria")).toBeInTheDocument();
    expect(screen.getByText("Tendência por semana")).toBeInTheDocument();
    expect(screen.getByText("Parcelas futuras")).toBeInTheDocument();
    expect(screen.getByText("2026-W14")).toBeInTheDocument();
    expect(screen.getByText("2026-05")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 40,00").length).toBeGreaterThan(1);
  });

  it("submits custom period filters", async () => {
    const onApplyFilters = vi.fn<(filters: TransactionFilters) => Promise<void>>(async () => undefined);
    render(
      <ReportsView
        accounts={[]}
        filters={{
          period: "month",
          reference: "2026-04-15",
          from: "",
          to: "",
          category: "",
          account: "",
          method: "",
          person: "",
          text: "",
        }}
        isSubmitting={false}
        loading={false}
        onApplyFilters={onApplyFilters}
        summary={null}
      />,
    );

    await userEvent.selectOptions(
      screen.getByLabelText(/periodo/i),
      "custom",
    );
    await userEvent.type(screen.getByLabelText(/^de$/i), "2026-04-01");
    await userEvent.type(screen.getByLabelText(/até/i), "2026-04-30");
    await userEvent.click(screen.getByRole("button", { name: /aplicar filtros/i }));

    expect(onApplyFilters).toHaveBeenCalledTimes(1);
    expect(onApplyFilters.mock.calls[0]?.[0]).toMatchObject({
      period: "custom",
      from: "2026-04-01",
      to: "2026-04-30",
    });
  });
});
