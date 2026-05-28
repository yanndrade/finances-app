import {
  buildAllocationRows,
  buildIncomeGrowthRows,
  calculateCapitalGainPercent,
  calculateKrakenSuggestions,
  calculateTotalPerformance,
  safeRatio,
} from "./investment-calculations";

describe("investment calculations", () => {
  it("returns null for ratios without a comparable base", () => {
    expect(safeRatio(10, 0)).toBeNull();
    expect(calculateCapitalGainPercent(null)).toBeNull();
  });

  it("directs Kraken contributions only to positive allocation deficits", () => {
    const rows = buildAllocationRows(
      [
        {
          id: "asset-1",
          ticker: "RF",
          name: null,
          asset_class: "renda_fixa",
          category: "Renda fixa",
          quantity: 1,
          average_price: 70_00,
          current_price: null,
          invested_value: 70_00,
          current_value: 70_00,
          monthly_income: null,
          notes: null,
        },
        {
          id: "asset-2",
          ticker: "FII",
          name: null,
          asset_class: "fii",
          category: "Papel CDI",
          quantity: 1,
          average_price: 30_00,
          current_price: null,
          invested_value: 30_00,
          current_value: 30_00,
          monthly_income: null,
          notes: null,
        },
      ],
      [
        {
          id: "target-1",
          asset_class: "renda_fixa",
          label: "Renda fixa",
          ideal_percentage: 2000,
          current_value: 70_00,
        },
        {
          id: "target-2",
          asset_class: "fii",
          label: "FIIs",
          ideal_percentage: 8000,
          current_value: 30_00,
        },
      ],
      null,
    );

    const suggestions = calculateKrakenSuggestions(rows, 100_00, 10_00);

    expect(suggestions.find((row) => row.assetClass === "renda_fixa")?.suggestedContribution).toBe(0);
    expect(suggestions.find((row) => row.assetClass === "fii")?.suggestedContribution).toBe(10_00);
    expect(suggestions.some((row) => row.assetClass === "caixa")).toBe(false);
  });

  it("matches the spreadsheet performance formula", () => {
    expect(
      calculateTotalPerformance(
        {
          id: "snap-1",
          date: "2026-05-31T23:59:59Z",
          period: "2026-05",
          total_patrimony: 8992_69,
          applied_value: 8883_54,
          gross_balance: 8992_69,
          free_cash: 0,
          accumulated_dividends: 4_56,
          monthly_contribution_target: 0,
          fii_applied_value: 487_30,
          fii_monthly_income: 4_56,
          stock_applied_value: 0,
          stock_monthly_income: 0,
          total_monthly_income: 4_56,
          reinvested_income: 0,
          notes: null,
        },
        4_56,
      ),
    ).toBeCloseTo(0.0126, 4);
  });

  it("does not calculate income growth percentages from zero", () => {
    const rows = buildIncomeGrowthRows([
      {
        id: "income-1",
        month: "2026-04",
        asset_class: "fii",
        asset_ticker: null,
        amount: 0,
      },
      {
        id: "income-2",
        month: "2026-05",
        asset_class: "fii",
        asset_ticker: null,
        amount: 10_00,
      },
    ]);

    expect(rows[1]?.monthlyDeltaPercent).toBeNull();
  });
});
