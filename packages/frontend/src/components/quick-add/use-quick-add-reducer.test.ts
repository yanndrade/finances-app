import { createInitialQuickAddState, quickAddReducer } from "./use-quick-add-reducer";

describe("quickAddReducer", () => {
  it("resets transfer fields when entry type changes away from transfer", () => {
    const state = {
      ...createInitialQuickAddState({
        defaultAccountId: "acc-1",
        today: "2026-03-05",
      }),
      entryType: "transfer" as const,
      transferMode: "invoice_payment" as const,
      toAccountId: "acc-2",
      invoiceId: "inv-1",
    };

    const nextState = quickAddReducer(state, {
      type: "entryTypeChanged",
      entryType: "expense",
    });

    expect(nextState.transferMode).toBe("internal");
    expect(nextState.toAccountId).toBe("");
    expect(nextState.invoiceId).toBe("");
  });

  it("resets non-expense context when switching to transfer", () => {
    const state = {
      ...createInitialQuickAddState({
        defaultAccountId: "acc-1",
        today: "2026-03-05",
      }),
      entryType: "expense" as const,
      expensePaymentMode: "CARD" as const,
      installments: "6",
      keepOpen: true,
      investmentMode: "withdrawal" as const,
      dividendAmount: "5,00",
      investedReductionAmount: "10,00",
    };

    const nextState = quickAddReducer(state, {
      type: "entryTypeChanged",
      entryType: "transfer",
    });

    expect(nextState.expensePaymentMode).toBe("PIX");
    expect(nextState.installments).toBe("1");
    expect(nextState.keepOpen).toBe(false);
    expect(nextState.investmentMode).toBe("contribution");
    expect(nextState.dividendAmount).toBe("");
    expect(nextState.investedReductionAmount).toBe("");
  });
});
