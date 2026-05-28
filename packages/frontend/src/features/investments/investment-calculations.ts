import type {
  AllocationTarget,
  InvestmentAsset,
  InvestmentMovementSummary,
  InvestmentSnapshot,
  MonthlyIncomeRecord,
} from "../../lib/api";

export type Ratio = number | null;

export const INVESTMENT_ALLOCATION_CLASSES = [
  "renda_fixa",
  "fii",
  "acao",
  "exterior",
  "etf",
  "cripto",
  "outros",
] as const;

export type AllocationRow = {
  assetClass: string;
  label: string;
  currentValue: number;
  currentPercent: Ratio;
  idealPercent: number;
  targetValue: number;
  difference: number;
  status: "below" | "inside" | "above";
};

export type KrakenSuggestion = AllocationRow & {
  positiveDeficit: number;
  suggestedContribution: number;
  contributionShare: Ratio;
};

export type ClosingMetrics = {
  capitalGain: number;
  capitalGainPercent: Ratio;
  performanceWithIncome: Ratio;
  monthlyYoC: Ratio;
  fiiMonthlyYield: Ratio;
  stockMonthlyYield: Ratio;
  reinvestmentRate: Ratio;
  contributionAutonomy: Ratio;
};

export function normalizeSnapshot(snapshot: InvestmentSnapshot | null): InvestmentSnapshot | null {
  if (!snapshot) return null;
  return {
    ...snapshot,
    fii_applied_value: snapshot.fii_applied_value ?? 0,
    fii_monthly_income: snapshot.fii_monthly_income ?? 0,
    stock_applied_value: snapshot.stock_applied_value ?? 0,
    stock_monthly_income: snapshot.stock_monthly_income ?? 0,
    total_monthly_income: snapshot.total_monthly_income ?? 0,
    reinvested_income: snapshot.reinvested_income ?? 0,
  };
}

export function safeRatio(numerator: number, denominator: number): Ratio {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  return numerator / denominator;
}

export function calculateCapitalGain(snapshot: InvestmentSnapshot | null): number {
  if (!snapshot) return 0;
  return snapshot.gross_balance - snapshot.applied_value;
}

export function calculateCapitalGainPercent(snapshot: InvestmentSnapshot | null): Ratio {
  if (!snapshot) return null;
  return safeRatio(calculateCapitalGain(snapshot), snapshot.applied_value);
}

export function calculateTotalPerformance(
  snapshot: InvestmentSnapshot | null,
  incomeInCents = snapshot?.accumulated_dividends ?? 0,
): Ratio {
  if (!snapshot) return null;
  return safeRatio(calculateCapitalGain(snapshot) + incomeInCents, snapshot.gross_balance);
}

export function calculateClosingMetrics(snapshot: InvestmentSnapshot | null): ClosingMetrics {
  const normalized = normalizeSnapshot(snapshot);
  const totalMonthlyIncome =
    normalized?.total_monthly_income && normalized.total_monthly_income > 0
      ? normalized.total_monthly_income
      : (normalized?.fii_monthly_income ?? 0) + (normalized?.stock_monthly_income ?? 0);

  return {
    capitalGain: calculateCapitalGain(normalized),
    capitalGainPercent: calculateCapitalGainPercent(normalized),
    performanceWithIncome: calculateTotalPerformance(normalized),
    monthlyYoC: safeRatio(totalMonthlyIncome, normalized?.applied_value ?? 0),
    fiiMonthlyYield: safeRatio(
      normalized?.fii_monthly_income ?? 0,
      normalized?.fii_applied_value ?? 0,
    ),
    stockMonthlyYield: safeRatio(
      normalized?.stock_monthly_income ?? 0,
      normalized?.stock_applied_value ?? 0,
    ),
    reinvestmentRate: safeRatio(
      normalized?.reinvested_income ?? 0,
      totalMonthlyIncome,
    ),
    contributionAutonomy: safeRatio(
      totalMonthlyIncome,
      normalized?.monthly_contribution_target ?? 0,
    ),
  };
}

export function calculatePassiveIncome(
  snapshot: InvestmentSnapshot | null,
  assets: InvestmentAsset[],
  incomeRecords: MonthlyIncomeRecord[],
  reinvestedIncomeInCents?: number,
) {
  const normalized = normalizeSnapshot(snapshot);
  const appliedTotal = normalized?.applied_value ?? sumBy(assets, (asset) => asset.invested_value);
  const latestMonth = normalized?.period ?? incomeRecords[0]?.month ?? "";
  const monthlyIncomeFromRecords = sumIncomeForMonth(incomeRecords, latestMonth);
  const monthlyIncome =
    normalized?.total_monthly_income && normalized.total_monthly_income > 0
      ? normalized.total_monthly_income
      : monthlyIncomeFromRecords > 0
        ? monthlyIncomeFromRecords
        : 0;
  const yearTotal = latestMonth
    ? incomeRecords
        .filter((record) => record.month.startsWith(`${latestMonth.slice(0, 4)}-`))
        .reduce((sum, record) => sum + record.amount, 0)
    : 0;
  const last12 = incomeRecords.slice(0, 12);
  const fiiApplied = normalized?.fii_applied_value && normalized.fii_applied_value > 0
    ? normalized.fii_applied_value
    : sumBy(
        assets.filter((asset) => asset.asset_class === "fii"),
        (asset) => asset.invested_value,
      );
  const stockApplied = normalized?.stock_applied_value && normalized.stock_applied_value > 0
    ? normalized.stock_applied_value
    : sumBy(
        assets.filter((asset) => asset.asset_class === "acao"),
        (asset) => asset.invested_value,
      );
  const fiiIncomeFromRecords = sumIncomeForMonth(incomeRecords, latestMonth, "fii");
  const stockIncomeFromRecords = sumIncomeForMonth(incomeRecords, latestMonth, "acao");
  const consolidatedIncomeAsFii =
    monthlyIncomeFromRecords > 0 && fiiIncomeFromRecords === 0 && stockIncomeFromRecords === 0
      ? monthlyIncomeFromRecords
      : 0;
  const fiiIncome =
    normalized?.fii_monthly_income && normalized.fii_monthly_income > 0
      ? normalized.fii_monthly_income
      : fiiIncomeFromRecords > 0
        ? fiiIncomeFromRecords
        : consolidatedIncomeAsFii > 0
          ? consolidatedIncomeAsFii
          : 0;
  const stockIncome =
    normalized?.stock_monthly_income && normalized.stock_monthly_income > 0
      ? normalized.stock_monthly_income
      : stockIncomeFromRecords > 0
        ? stockIncomeFromRecords
        : 0;

  return {
    latestMonth,
    monthlyIncome,
    last12Average:
      last12.length > 0
        ? Math.round(sumBy(last12, (record) => record.amount) / last12.length)
        : 0,
    yearTotal,
    consolidatedYoc: safeRatio(monthlyIncome, appliedTotal),
    annualizedYoc: multiplyRatio(safeRatio(monthlyIncome, appliedTotal), 12),
    fiiYoc: safeRatio(fiiIncome, fiiApplied),
    fiiAnnualizedYoc: multiplyRatio(safeRatio(fiiIncome, fiiApplied), 12),
    stockYoc: safeRatio(stockIncome, stockApplied),
    stockAnnualizedYoc: multiplyRatio(safeRatio(stockIncome, stockApplied), 12),
    reinvestmentRate: safeRatio(
      reinvestedIncomeInCents ?? normalized?.reinvested_income ?? 0,
      monthlyIncome,
    ),
    contributionAutonomy: safeRatio(monthlyIncome, normalized?.monthly_contribution_target ?? 0),
  };
}

export function buildIncomeRecordsFromMovements(
  movements: InvestmentMovementSummary[],
): MonthlyIncomeRecord[] {
  const byMonthAndClass = new Map<string, MonthlyIncomeRecord>();

  for (const movement of movements) {
    const isIncome =
      movement.affects_income || ["provento", "rendimento"].includes(movement.type);
    if (!isIncome) continue;

    const amount = movement.dividend_amount || Math.max(movement.cash_delta, 0);
    if (amount <= 0) continue;

    const month = movement.occurred_at.slice(0, 7);
    const assetClass = movement.asset_class ?? "consolidado";
    const key = `${month}:${assetClass}`;
    const current = byMonthAndClass.get(key);

    if (current) {
      byMonthAndClass.set(key, { ...current, amount: current.amount + amount });
      continue;
    }

    byMonthAndClass.set(key, {
      id: `movement-income-${key}`,
      month,
      asset_class: assetClass,
      asset_ticker: null,
      amount,
    });
  }

  return [...byMonthAndClass.values()].sort((left, right) => left.month.localeCompare(right.month));
}

export function mergeIncomeRecords(
  manualRecords: MonthlyIncomeRecord[],
  movementRecords: MonthlyIncomeRecord[],
): MonthlyIncomeRecord[] {
  const manualMonths = new Set(manualRecords.map((record) => record.month));
  return [
    ...manualRecords,
    ...movementRecords.filter((record) => !manualMonths.has(record.month)),
  ].sort((left, right) => left.month.localeCompare(right.month));
}

export function sumIncomeForMonth(
  records: MonthlyIncomeRecord[],
  month: string,
  assetClass?: string,
): number {
  return records
    .filter((record) => record.month === month && (!assetClass || record.asset_class === assetClass))
    .reduce((sum, record) => sum + record.amount, 0);
}

export function buildAllocationRows(
  assets: InvestmentAsset[],
  targets: AllocationTarget[],
  fallbackSnapshot: InvestmentSnapshot | null,
): AllocationRow[] {
  const currentByClass = new Map<string, number>();
  for (const asset of assets) {
    if (asset.asset_class === "caixa") continue;
    currentByClass.set(
      asset.asset_class,
      (currentByClass.get(asset.asset_class) ?? 0) + asset.current_value,
    );
  }
  for (const target of targets) {
    if (target.asset_class === "caixa") continue;
    if (target.current_value > 0) {
      currentByClass.set(target.asset_class, target.current_value);
    }
  }
  if (currentByClass.size === 0 && fallbackSnapshot) {
    currentByClass.set("renda_fixa", fallbackSnapshot.gross_balance);
    if (fallbackSnapshot.free_cash > 0) {
      currentByClass.set("outros", fallbackSnapshot.free_cash);
    }
  }

  const total = sumBy([...currentByClass.values()], (value) => value);
  const labels = new Map(targets.map((target) => [target.asset_class, target.label]));
  const ideal = new Map(targets.map((target) => [target.asset_class, target.ideal_percentage / 10000]));
  const classes = new Set([
    ...INVESTMENT_ALLOCATION_CLASSES,
    ...currentByClass.keys(),
    ...targets.map((target) => target.asset_class),
  ]);

  return [...classes]
    .filter((assetClass) => assetClass !== "caixa")
    .map((assetClass) => {
      const currentValue = currentByClass.get(assetClass) ?? 0;
      const idealPercent = ideal.get(assetClass) ?? 0;
      const targetValue = Math.round(total * idealPercent);
      const difference = currentValue - targetValue;
      const tolerance = Math.max(Math.round(total * 0.01), 1);
      const status: AllocationRow["status"] =
        difference < -tolerance ? "below" : difference > tolerance ? "above" : "inside";
      return {
        assetClass,
        label: labels.get(assetClass) ?? labelAssetClass(assetClass),
        currentValue,
        currentPercent: safeRatio(currentValue, total),
        idealPercent,
        targetValue,
        difference,
        status,
      };
    })
    .filter((row) => row.currentValue > 0 || row.idealPercent > 0)
    .sort((left, right) => right.currentValue - left.currentValue);
}

export function getInvestmentCashReserve(snapshot: InvestmentSnapshot | null): number {
  return snapshot?.free_cash ?? 0;
}

export function calculateKrakenSuggestions(
  rows: AllocationRow[],
  currentPatrimony: number,
  contribution: number,
): KrakenSuggestion[] {
  const investableRows = rows.filter((row) => row.assetClass !== "caixa");
  const projectedPatrimony = currentPatrimony + contribution;
  const withDeficit = investableRows.map((row) => {
    const targetValue = Math.round(projectedPatrimony * row.idealPercent);
    return {
      ...row,
      targetValue,
      difference: row.currentValue - targetValue,
      positiveDeficit: Math.max(targetValue - row.currentValue, 0),
    };
  });
  const deficitTotal = sumBy(withDeficit, (row) => row.positiveDeficit);

  return withDeficit.map((row) => {
    const contributionShare = safeRatio(row.positiveDeficit, deficitTotal);
    return {
      ...row,
      suggestedContribution:
        contributionShare === null ? 0 : Math.round(contribution * contributionShare),
      contributionShare,
    };
  });
}

export function buildIncomeGrowthRows(records: MonthlyIncomeRecord[]) {
  const byMonth = new Map<string, number>();
  for (const record of records) {
    byMonth.set(record.month, (byMonth.get(record.month) ?? 0) + record.amount);
  }
  const months = [...byMonth.keys()].sort();

  return months.map((month, index) => {
    const amount = byMonth.get(month) ?? 0;
    const previous = index > 0 ? byMonth.get(months[index - 1] ?? "") ?? 0 : 0;
    const year = month.slice(0, 4);
    const monthNumber = Number(month.slice(5, 7));
    const yearToDate = months
      .filter(
        (candidate) =>
          candidate.slice(0, 4) === year && Number(candidate.slice(5, 7)) <= monthNumber,
      )
      .reduce((sum, candidate) => sum + (byMonth.get(candidate) ?? 0), 0);
    const previousYear = String(Number(year) - 1);
    const previousYearToDate = months
      .filter(
        (candidate) =>
          candidate.slice(0, 4) === previousYear &&
          Number(candidate.slice(5, 7)) <= monthNumber,
      )
      .reduce((sum, candidate) => sum + (byMonth.get(candidate) ?? 0), 0);
    const yearMonths = months.filter((candidate) => candidate.slice(0, 4) === year);

    return {
      month,
      amount,
      monthlyDelta: amount - previous,
      monthlyDeltaPercent: previous > 0 ? safeRatio(amount - previous, previous) : null,
      annualAverage:
        yearMonths.length > 0
          ? Math.round(
              sumBy(yearMonths, (candidate) => byMonth.get(candidate) ?? 0) / yearMonths.length,
            )
          : 0,
      annualDelta: yearToDate - previousYearToDate,
      annualDeltaPercent: safeRatio(yearToDate - previousYearToDate, previousYearToDate),
    };
  });
}

export function buildAnnualIncomeMatrix(records: MonthlyIncomeRecord[], fallbackYear?: string) {
  const byYearMonth = new Map<string, number>();
  for (const record of records) {
    const key = `${record.month.slice(0, 4)}-${record.month.slice(5, 7)}`;
    byYearMonth.set(key, (byYearMonth.get(key) ?? 0) + record.amount);
  }

  const years = [...new Set(records.map((record) => record.month.slice(0, 4)))];
  if (fallbackYear && !years.includes(fallbackYear)) {
    years.push(fallbackYear);
  }
  years.sort();
  return years.map((year) => {
    const months = Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return {
        month,
        amount: byYearMonth.get(`${year}-${month}`) ?? 0,
      };
    });
    const total = months.reduce((sum, item) => sum + item.amount, 0);
    return { year, months, total };
  });
}

export function periodMovementTotals(movements: InvestmentMovementSummary[]) {
  return {
    contributions: sumBy(
      movements.filter((movement) => ["contribution", "aporte", "compra"].includes(movement.type)),
      (movement) => movement.contribution_amount,
    ),
    reinvestedDividends: sumBy(movements, (movement) => movement.reinvested_dividend_amount || 0),
    withdrawals: sumBy(
      movements.filter((movement) => ["withdrawal", "resgate", "venda"].includes(movement.type)),
      (movement) => movement.cash_amount || Math.max(-movement.invested_delta, 0),
    ),
    income: sumBy(
      movements.filter(
        (movement) =>
          ["provento", "rendimento"].includes(movement.type) || movement.affects_income,
      ),
      (movement) => movement.dividend_amount || Math.max(movement.cash_delta, 0),
    ),
  };
}

export function labelAssetClass(assetClass: string): string {
  const labels: Record<string, string> = {
    caixa: "Caixa de investimentos",
    renda_fixa: "Renda fixa",
    fii: "FIIs",
    acao: "Ações",
    exterior: "Exterior",
    etf: "ETFs",
    cripto: "Cripto",
    outros: "Outros",
  };
  return labels[assetClass] ?? assetClass;
}

function multiplyRatio(ratio: Ratio, multiplier: number): Ratio {
  return ratio === null ? null : ratio * multiplier;
}

function sumBy<T>(items: T[], getValue: (item: T) => number): number {
  return items.reduce((sum, item) => sum + getValue(item), 0);
}
