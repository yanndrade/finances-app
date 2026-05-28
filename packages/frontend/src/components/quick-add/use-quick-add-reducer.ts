export type EntryType = "expense" | "income" | "transfer" | "investment" | "recurring";
export type ExpensePaymentMode = "PIX" | "CASH" | "OTHER" | "CARD";
export type RecurringPaymentMode = "PIX" | "CASH" | "OTHER" | "CARD";
export type TransferMode = "internal" | "invoice_payment";
export type InvestmentMode =
  | "contribution"
  | "purchase"
  | "dividend"
  | "reinvestment"
  | "withdrawal"
  | "sale";
export type InvestmentOriginMode = "auto" | "manual";
export type QuickAddValidationErrors = Partial<
  Record<
    | "amount"
    | "date"
    | "accountId"
    | "toAccountId"
    | "invoiceId"
    | "cardId"
    | "installments"
    | "dueDay"
    | "investmentOrigins",
    string
  >
>;

export type QuickAddState = {
  entryType: EntryType;
  expensePaymentMode: ExpensePaymentMode;
  recurringPaymentMode: RecurringPaymentMode;
  transferMode: TransferMode;
  investmentMode: InvestmentMode;
  date: string;
  dueDay: string;
  accountId: string;
  keepOpen: boolean;
  toAccountId: string;
  installments: string;
  invoiceId: string;
  investmentOriginMode: InvestmentOriginMode;
  newMoneyAmount: string;
  dividendAmount: string;
  reinvestedDividendAmount: string;
  investedReductionAmount: string;
  validationErrors: QuickAddValidationErrors;
};

export type QuickAddAction =
  | { type: "entryTypeChanged"; entryType: EntryType }
  | { type: "expensePaymentModeChanged"; mode: ExpensePaymentMode }
  | { type: "recurringPaymentModeChanged"; mode: RecurringPaymentMode }
  | { type: "transferModeChanged"; mode: TransferMode }
  | { type: "investmentModeChanged"; mode: InvestmentMode }
  | { type: "investmentOriginModeChanged"; mode: InvestmentOriginMode }
  | { type: "dateChanged"; date: string }
  | { type: "dueDayChanged"; dueDay: string }
  | { type: "accountChanged"; accountId: string }
  | { type: "keepOpenChanged"; keepOpen: boolean }
  | { type: "toAccountChanged"; accountId: string }
  | { type: "invoiceChanged"; invoiceId: string }
  | { type: "installmentsChanged"; installments: string }
  | { type: "newMoneyAmountChanged"; amount: string }
  | { type: "dividendAmountChanged"; amount: string }
  | { type: "reinvestedDividendAmountChanged"; amount: string }
  | { type: "investedReductionAmountChanged"; amount: string }
  | { type: "validationErrorsSet"; errors: QuickAddValidationErrors }
  | { type: "validationErrorsPatched"; errors: QuickAddValidationErrors }
  | { type: "reset"; defaultAccountId: string; today: string };

export function createInitialQuickAddState(options: {
  defaultAccountId: string;
  today: string;
}): QuickAddState {
  return {
    entryType: "expense",
    expensePaymentMode: "PIX",
    recurringPaymentMode: "PIX",
    transferMode: "internal",
    investmentMode: "contribution",
    date: options.today,
    dueDay: "1",
    accountId: options.defaultAccountId,
    keepOpen: false,
    toAccountId: "",
    installments: "1",
    invoiceId: "",
    investmentOriginMode: "auto",
    newMoneyAmount: "",
    dividendAmount: "",
    reinvestedDividendAmount: "",
    investedReductionAmount: "",
    validationErrors: {},
  };
}

export function quickAddReducer(state: QuickAddState, action: QuickAddAction): QuickAddState {
  switch (action.type) {
    case "entryTypeChanged": {
      const nextState: QuickAddState = {
        ...state,
        entryType: action.entryType,
        validationErrors: {},
      };

      if (action.entryType !== "transfer") {
        nextState.transferMode = "internal";
        nextState.toAccountId = "";
        nextState.invoiceId = "";
      }

      if (action.entryType !== "expense") {
        nextState.expensePaymentMode = "PIX";
        nextState.installments = "1";
        nextState.keepOpen = false;
      }

      if (action.entryType !== "investment") {
        nextState.investmentMode = "contribution";
        nextState.investmentOriginMode = "auto";
        nextState.newMoneyAmount = "";
        nextState.dividendAmount = "";
        nextState.reinvestedDividendAmount = "";
        nextState.investedReductionAmount = "";
      }

      if (action.entryType !== "recurring") {
        nextState.recurringPaymentMode = "PIX";
        nextState.dueDay = "1";
      }

      return nextState;
    }
    case "expensePaymentModeChanged":
      if (action.mode !== "CARD") {
        return {
          ...state,
          expensePaymentMode: action.mode,
          installments: "1",
          validationErrors: {
            ...state.validationErrors,
            cardId: undefined,
            installments: undefined,
          },
        };
      }

      return {
        ...state,
        expensePaymentMode: action.mode,
      };
    case "recurringPaymentModeChanged":
      if (action.mode !== "CARD") {
        return {
          ...state,
          recurringPaymentMode: action.mode,
          validationErrors: {
            ...state.validationErrors,
            cardId: undefined,
          },
        };
      }

      return {
        ...state,
        recurringPaymentMode: action.mode,
      };
    case "transferModeChanged":
      return {
        ...state,
        transferMode: action.mode,
      };
    case "investmentModeChanged":
      return {
        ...state,
        investmentMode: action.mode,
        investmentOriginMode: "auto",
        newMoneyAmount: "",
        dividendAmount: "",
        reinvestedDividendAmount: "",
        investedReductionAmount: "",
        validationErrors: {
          ...state.validationErrors,
          investmentOrigins: undefined,
        },
      };
    case "investmentOriginModeChanged":
      return {
        ...state,
        investmentOriginMode: action.mode,
        newMoneyAmount: "",
        reinvestedDividendAmount: "",
        validationErrors: {
          ...state.validationErrors,
          investmentOrigins: undefined,
        },
      };
    case "dateChanged":
      return {
        ...state,
        date: action.date,
      };
    case "dueDayChanged":
      return {
        ...state,
        dueDay: action.dueDay,
      };
    case "accountChanged":
      return {
        ...state,
        accountId: action.accountId,
      };
    case "keepOpenChanged":
      return {
        ...state,
        keepOpen: action.keepOpen,
      };
    case "toAccountChanged":
      return {
        ...state,
        toAccountId: action.accountId,
      };
    case "invoiceChanged":
      return {
        ...state,
        invoiceId: action.invoiceId,
      };
    case "installmentsChanged":
      return {
        ...state,
        installments: action.installments,
      };
    case "newMoneyAmountChanged":
      return {
        ...state,
        newMoneyAmount: action.amount,
      };
    case "dividendAmountChanged":
      return {
        ...state,
        dividendAmount: action.amount,
      };
    case "reinvestedDividendAmountChanged":
      return {
        ...state,
        reinvestedDividendAmount: action.amount,
      };
    case "investedReductionAmountChanged":
      return {
        ...state,
        investedReductionAmount: action.amount,
      };
    case "validationErrorsSet":
      return {
        ...state,
        validationErrors: action.errors,
      };
    case "validationErrorsPatched":
      return {
        ...state,
        validationErrors: {
          ...state.validationErrors,
          ...action.errors,
        },
      };
    case "reset":
      return createInitialQuickAddState({
        defaultAccountId: action.defaultAccountId,
        today: action.today,
      });
    default:
      return state;
  }
}
