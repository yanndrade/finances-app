function installAppFetchMock(initialState?: {
  accounts?: AccountSummary[];
  cards?: CardSummary[];
  cardPurchases?: CardPurchaseSummary[];
  transactions?: TransactionSummary[];
  recurringRules?: RecurringRuleSummary[];
  pendingExpenses?: PendingExpenseSummary[];
  dashboard?: DashboardSummary;
  investmentOverview?: InvestmentOverview;
  investmentMovements?: InvestmentMovementSummary[];
  reportSummary?: ReportSummary;
  invoices?: InvoiceSummary[];
  invoiceItemsByInvoiceId?: Record<string, InvoiceItemSummary[]>;
}) {
  const state = {
    accounts: initialState?.accounts ?? [buildAccount()],
    cards: initialState?.cards ?? [buildCard()],
    cardPurchases: initialState?.cardPurchases ?? [],
    transactions: initialState?.transactions ?? [buildTransaction()],
    recurringRules: initialState?.recurringRules ?? [],
    pendingExpenses: initialState?.pendingExpenses ?? [],
    investmentOverview: initialState?.investmentOverview ?? buildInvestmentOverview(),
    investmentMovements: initialState?.investmentMovements ?? [],
    reportSummary: initialState?.reportSummary ?? buildReportSummary(),
    invoices: initialState?.invoices ?? [],
    invoiceItemsByInvoiceId: initialState?.invoiceItemsByInvoiceId ?? {},
    dashboard:
      initialState?.dashboard ??
      buildDashboard({
        recent_transactions: initialState?.transactions ?? [buildTransaction()],
      }),
  };

  const originalFetch = globalThis.fetch;
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (!url.includes("/api/")) {
      return originalFetch(input, init);
    }

    if (url.includes("/api/dashboard") && method === "GET") {
      return new Response(JSON.stringify(state.dashboard));
    }

    if (url.includes("/api/backups/export") && method === "GET") {
      return new Response(
        JSON.stringify({
          accounts: state.accounts,
          cards: state.cards,
          invoices: state.invoices,
          transactions: state.transactions,
          investment_movements: state.investmentMovements,
          report_summary: state.reportSummary,
        }),
      );
    }

    if (url.includes("/api/investments/overview") && method === "GET") {
      return new Response(JSON.stringify(state.investmentOverview));
    }

    if (url.includes("/api/investments/movements") && method === "GET") {
      return new Response(JSON.stringify(state.investmentMovements));
    }

    if (url.includes("/api/accounts") && method === "GET") {
      return new Response(JSON.stringify(state.accounts));
    }

    if (url.includes("/api/cards") && method === "GET") {
      return new Response(JSON.stringify(state.cards));
    }

    if (url.includes("/api/recurring-rules") && method === "GET") {
      return new Response(JSON.stringify(state.recurringRules));
    }

    if (url.includes("/api/pendings") && method === "GET") {
      return new Response(JSON.stringify(state.pendingExpenses));
    }

    if (url.includes("/api/invoices/") && url.endsWith("/items") && method === "GET") {
      const invoiceId = decodeURIComponent(
        url.split("/api/invoices/")[1]?.replace("/items", "") ?? "",
      );

      return new Response(
        JSON.stringify(state.invoiceItemsByInvoiceId[invoiceId] ?? []),
      );
    }

    if (url.includes("/api/invoices") && method === "GET") {
      const currentUrl = new URL(url);
      const cardId = currentUrl.searchParams.get("card");

      return new Response(
        JSON.stringify(
          cardId === null
            ? state.invoices
            : state.invoices.filter((invoice) => invoice.card_id === cardId),
        ),
      );
    }

    if (url.includes("/api/transactions") && method === "GET") {
      return new Response(JSON.stringify(state.transactions));
    }

    if (url.includes("/api/card-purchases") && method === "GET") {
      const currentUrl = new URL(url);
      const cardId = currentUrl.searchParams.get("card");

      return new Response(
        JSON.stringify(
          cardId === null
            ? state.cardPurchases
            : state.cardPurchases.filter((purchase) => purchase.card_id === cardId),
        ),
      );
    }

    if (url.includes("/api/reports/summary") && method === "GET") {
      return new Response(JSON.stringify(state.reportSummary));
    }

    if (url.endsWith("/api/recurring-rules") && method === "POST") {
      const payload = JSON.parse(String(init?.body)) as {
        id: string;
        name: string;
        amount: number;
        due_day: number;
        account_id?: string;
        card_id?: string;
        payment_method: "PIX" | "CASH" | "OTHER" | "CARD";
        category_id: string;
        description?: string;
      };

      const createdRule = buildRecurringRule({
        rule_id: payload.id,
        name: payload.name,
        amount: payload.amount,
        due_day: payload.due_day,
        account_id: payload.account_id ?? null,
        card_id: payload.card_id ?? null,
        payment_method: payload.payment_method,
        category_id: payload.category_id,
        description: payload.description ?? null,
      });
      state.recurringRules = [createdRule, ...state.recurringRules];
      state.pendingExpenses = [
        buildPendingExpense({
          pending_id: `${createdRule.rule_id}:${state.dashboard.month}`,
          rule_id: createdRule.rule_id,
          month: state.dashboard.month,
          name: createdRule.name,
          amount: createdRule.amount,
          due_date: `${state.dashboard.month}-${String(createdRule.due_day).padStart(2, "0")}`,
          account_id: createdRule.account_id,
          card_id: createdRule.card_id,
          payment_method: createdRule.payment_method,
          category_id: createdRule.category_id,
          description: createdRule.description,
        }),
        ...state.pendingExpenses,
      ];

      return new Response(JSON.stringify(createdRule), { status: 201 });
    }

    if (url.includes("/api/recurring-rules/") && method === "PATCH") {
      const ruleId = decodeURIComponent(url.split("/api/recurring-rules/")[1] ?? "");
      const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const existingRule = state.recurringRules.find((rule) => rule.rule_id === ruleId);
      if (!existingRule) {
        return new Response("Rule not found", { status: 404 });
      }

      const updatedRule: RecurringRuleSummary = {
        ...existingRule,
        ...(payload.name !== undefined ? { name: String(payload.name) } : {}),
        ...(payload.amount !== undefined ? { amount: Number(payload.amount) } : {}),
        ...(payload.due_day !== undefined ? { due_day: Number(payload.due_day) } : {}),
        ...(payload.payment_method !== undefined
          ? { payment_method: payload.payment_method as RecurringRuleSummary["payment_method"] }
          : {}),
        ...(payload.category_id !== undefined ? { category_id: String(payload.category_id) } : {}),
        ...(payload.description !== undefined
          ? { description: payload.description === null ? null : String(payload.description) }
          : {}),
        ...(payload.is_active !== undefined ? { is_active: Boolean(payload.is_active) } : {}),
        ...(payload.account_id !== undefined
          ? { account_id: payload.account_id === null ? null : String(payload.account_id) }
          : {}),
        ...(payload.card_id !== undefined
          ? { card_id: payload.card_id === null ? null : String(payload.card_id) }
          : {}),
      };
      state.recurringRules = state.recurringRules.map((rule) =>
        rule.rule_id === ruleId ? updatedRule : rule,
      );
      state.pendingExpenses = state.pendingExpenses.map((pending) =>
        pending.rule_id === ruleId
          ? {
              ...pending,
              name: updatedRule.name,
              amount: updatedRule.amount,
              due_date: `${pending.month}-${String(updatedRule.due_day).padStart(2, "0")}`,
              account_id: updatedRule.account_id,
              card_id: updatedRule.card_id,
              payment_method: updatedRule.payment_method,
              category_id: updatedRule.category_id,
              description: updatedRule.description,
            }
          : pending,
      );
      return new Response(JSON.stringify(updatedRule));
    }

    if (url.includes("/api/pendings/") && url.endsWith("/confirm") && method === "POST") {
      const pendingId = decodeURIComponent(url.split("/api/pendings/")[1]?.replace("/confirm", "") ?? "");
      const pending = state.pendingExpenses.find((item) => item.pending_id === pendingId);
      if (!pending) {
        return new Response("Pending not found", { status: 404 });
      }

      const confirmedPending: PendingExpenseSummary = {
        ...pending,
        status: "confirmed",
        transaction_id:
          pending.payment_method === "CARD" ? `${pending.pending_id}:purchase` : `${pending.pending_id}:expense`,
      };
      state.pendingExpenses = state.pendingExpenses.map((item) =>
        item.pending_id === pendingId ? confirmedPending : item,
      );
      state.dashboard.monthly_fixed_expenses = state.pendingExpenses.map((item) => ({
        pending_id: item.pending_id,
        rule_id: item.rule_id,
        title: item.name,
        category_id: item.category_id,
        amount: item.amount,
        due_date: item.due_date,
        status: item.status,
        account_id: item.account_id ?? "",
        card_id: item.card_id,
        payment_method: item.payment_method,
        transaction_id: item.transaction_id,
      }));

      return new Response(JSON.stringify(confirmedPending), { status: 201 });
    }

    if (
      url.includes("/api/reimbursements/") &&
      url.endsWith("/mark-received") &&
      method === "POST"
    ) {
      const reimbursementId = decodeURIComponent(
        url.split("/api/reimbursements/")[1]?.replace("/mark-received", "") ?? "",
      );
      const payload = JSON.parse(String(init?.body)) as {
        received_at: string;
        account_id?: string;
      };
      const pendingReimbursements = state.dashboard.pending_reimbursements ?? [];
      const reimbursement = pendingReimbursements.find(
        (item) => item.transaction_id === reimbursementId,
      );

      if (!reimbursement) {
        return new Response("Reimbursement not found", { status: 404 });
      }

      const accountId = payload.account_id ?? reimbursement.account_id;
      const receiptTransactionId = `${reimbursementId}:reimbursement-receipt`;
      const received = {
        ...reimbursement,
        status: "received",
        account_id: accountId,
        received_at: payload.received_at,
        receipt_transaction_id: receiptTransactionId,
      };
      state.dashboard.pending_reimbursements = pendingReimbursements.filter(
        (item) => item.transaction_id !== reimbursementId,
      );
      state.dashboard.pending_reimbursements_total = (
        state.dashboard.pending_reimbursements ?? []
      ).reduce((sum, item) => sum + item.amount, 0);
      state.dashboard.total_income += reimbursement.amount;
      state.dashboard.net_flow += reimbursement.amount;
      state.dashboard.current_balance += reimbursement.amount;

      state.accounts = state.accounts.map((account) => {
        if (account.account_id !== accountId) {
          return account;
        }

        return {
          ...account,
          current_balance: account.current_balance + reimbursement.amount,
        };
      });

      const receiptTransaction: TransactionSummary = {
        transaction_id: receiptTransactionId,
        occurred_at: payload.received_at,
        type: "income",
        amount: reimbursement.amount,
        account_id: accountId,
        payment_method: "PIX",
        category_id: "reimbursement",
        description: `Reembolso recebido de ${reimbursement.person_id}`,
        person_id: reimbursement.person_id,
        status: "active",
      };
      state.transactions = [receiptTransaction, ...state.transactions];
      state.dashboard.recent_transactions = [receiptTransaction, ...state.dashboard.recent_transactions];

      return new Response(JSON.stringify(received), { status: 201 });
    }

    if (url.endsWith("/api/dev/reset") && method === "POST") {
      state.accounts = [];
      state.cards = [];
      state.transactions = [];
      state.recurringRules = [];
      state.pendingExpenses = [];
      state.investmentMovements = [];
      state.investmentOverview = buildInvestmentOverview({
        totals: {
          contribution_total: 0,
          dividend_total: 0,
          withdrawal_total: 0,
          invested_balance: 0,
          cash_balance: 0,
          wealth: 0,
          dividends_accumulated: 0,
        },
        goal: {
          target: 0,
          realized: 0,
          remaining: 0,
          progress_percent: 100,
        },
        series: {
          wealth_evolution: [],
          contribution_dividend_trend: [],
        },
      });
      state.dashboard = buildDashboard({
        total_income: 0,
        total_expense: 0,
        net_flow: 0,
        current_balance: 0,
        pending_reimbursements_total: 0,
        pending_reimbursements: [],
        recent_transactions: [],
        spending_by_category: [],
        category_budgets: [],
        budget_alerts: [],
        previous_month: { total_income: 0, total_expense: 0, net_flow: 0 },
        daily_balance_series: [],
        review_queue: [],
      });

      return new Response(
        JSON.stringify({ status: "ok", message: "Application data reset." }),
      );
    }

    if (url.endsWith("/api/investments/movements") && method === "POST") {
      const payload = JSON.parse(String(init?.body)) as {
        id: string;
        occurred_at: string;
        type: "contribution" | "withdrawal";
        account_id: string;
        description?: string;
        contribution_amount?: number;
        dividend_amount?: number;
        cash_amount?: number;
        invested_amount?: number;
      };
      const movement: InvestmentMovementSummary = {
        movement_id: payload.id,
        occurred_at: payload.occurred_at,
        type: payload.type,
        account_id: payload.account_id,
        description: payload.description ?? null,
        contribution_amount: payload.contribution_amount ?? 0,
        dividend_amount: payload.dividend_amount ?? 0,
        cash_amount: payload.cash_amount ?? 0,
        invested_amount: payload.invested_amount ?? 0,
        cash_delta:
          payload.type === "contribution"
            ? -(payload.cash_amount ?? payload.contribution_amount ?? 0)
            : payload.cash_amount ?? 0,
        invested_delta:
          payload.type === "contribution"
            ? payload.invested_amount ?? (payload.contribution_amount ?? 0) + (payload.dividend_amount ?? 0)
            : -(payload.invested_amount ?? 0),
      };
      state.investmentMovements = [movement, ...state.investmentMovements];
      return new Response(JSON.stringify(movement), { status: 201 });
    }

    if (url.endsWith("/api/accounts") && method === "POST") {
      const payload = JSON.parse(String(init?.body)) as {
        id: string;
        name: string;
        type: string;
        initial_balance: number;
      };
      const nextAccount = buildAccount({
        account_id: payload.id,
        name: payload.name,
        type: payload.type,
        initial_balance: payload.initial_balance,
        current_balance: payload.initial_balance,
      });
      state.accounts = [...state.accounts, nextAccount];

      return new Response(JSON.stringify(nextAccount), { status: 201 });
    }

    if (url.includes("/api/accounts/") && method === "PATCH") {
      const accountId = url.split("/api/accounts/")[1];
      const payload = JSON.parse(String(init?.body)) as {
        name?: string;
        type?: string;
        initial_balance?: number;
        is_active?: boolean;
      };

      state.accounts = state.accounts.map((account) => {
        if (account.account_id !== accountId) {
          return account;
        }

        return {
          ...account,
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.type !== undefined ? { type: payload.type } : {}),
          ...(payload.initial_balance !== undefined
            ? {
                initial_balance: payload.initial_balance,
                current_balance: payload.initial_balance,
              }
            : {}),
          ...(payload.is_active !== undefined ? { is_active: payload.is_active } : {}),
        };
      });

      return new Response(
        JSON.stringify(state.accounts.find((account) => account.account_id === accountId)),
      );
    }

    if (url.endsWith("/api/budgets") && method === "POST") {
      const payload = JSON.parse(String(init?.body)) as {
        category_id: string;
        month: string;
        limit: number;
      };
      const existingBudgets = state.dashboard.category_budgets ?? [];
      const spendingByCategory = state.dashboard.spending_by_category.find(
        (item) => item.category_id === payload.category_id,
      )?.total ?? 0;
      const spent = existingBudgets.find(
        (budget) =>
          budget.category_id === payload.category_id &&
          budget.month === payload.month,
      )?.spent ?? spendingByCategory;
      const usagePercent = payload.limit > 0
        ? Math.round((spent * 100) / payload.limit)
        : 0;
      const status = spent > payload.limit
        ? "exceeded"
        : usagePercent >= 80
          ? "warning"
          : "ok";
      const budgetSummary = {
        category_id: payload.category_id,
        month: payload.month,
        limit: payload.limit,
        spent,
        usage_percent: usagePercent,
        status,
      };
      const hasExisting = existingBudgets.some(
        (budget) =>
          budget.category_id === payload.category_id &&
          budget.month === payload.month,
      );
      state.dashboard.category_budgets = hasExisting
        ? existingBudgets.map((budget) =>
            budget.category_id === payload.category_id && budget.month === payload.month
              ? budgetSummary
              : budget,
          )
        : [...existingBudgets, budgetSummary];
      state.dashboard.budget_alerts = (state.dashboard.category_budgets ?? []).filter(
        (budget) => budget.status !== "ok",
      );

      return new Response(JSON.stringify(budgetSummary), { status: hasExisting ? 200 : 201 });
    }

    if (url.endsWith("/api/cards") && method === "POST") {
      const payload = JSON.parse(String(init?.body)) as {
        id: string;
        name: string;
        limit: number;
        closing_day: number;
        due_day: number;
        payment_account_id?: string;
      };
      const nextCard = buildCard({
        card_id: payload.id,
        name: payload.name,
        limit: payload.limit,
        closing_day: payload.closing_day,
        due_day: payload.due_day,
        payment_account_id: payload.payment_account_id ?? "",
      });
      state.cards = [...state.cards, nextCard];

      return new Response(JSON.stringify(nextCard), { status: 201 });
    }

    if (url.endsWith("/api/card-purchases") && method === "POST") {
      const payload = JSON.parse(String(init?.body)) as {
        purchase_date: string;
        amount: number;
        card_id: string;
        installments_count?: number;
      };
      const card = state.cards.find((item) => item.card_id === payload.card_id);
      if (!card) {
        return new Response("Card not found", { status: 404 });
      }

      const nextInvoices = allocateMockInvoices({
        amount: payload.amount,
        card,
        installmentsCount: payload.installments_count ?? 1,
        purchaseDate: payload.purchase_date,
      });
      for (const nextInvoice of nextInvoices) {
        const existingInvoice = state.invoices.find(
          (invoice) => invoice.invoice_id === nextInvoice.invoice_id,
        );

        if (existingInvoice) {
          existingInvoice.total_amount += nextInvoice.total_amount;
          existingInvoice.remaining_amount += nextInvoice.remaining_amount;
          existingInvoice.purchase_count += nextInvoice.purchase_count;
        } else {
          state.invoices = [nextInvoice, ...state.invoices];
        }
      }

      return new Response(
        JSON.stringify({
          purchase_id: "purchase-ui-1",
          purchase_date: payload.purchase_date,
          amount: payload.amount,
          category_id: "transport",
          card_id: payload.card_id,
          description: "Taxi",
          installments_count: payload.installments_count ?? 1,
          invoice_id: nextInvoices[0].invoice_id,
          reference_month: nextInvoices[0].reference_month,
          closing_date: nextInvoices[0].closing_date,
          due_date: nextInvoices[0].due_date,
        }),
        { status: 201 },
      );
    }

    if (url.includes("/api/cards/") && method === "PATCH") {
      const cardId = url.split("/api/cards/")[1];
      const payload = JSON.parse(String(init?.body)) as {
        name?: string;
        limit?: number;
        closing_day?: number;
        due_day?: number;
        payment_account_id?: string;
        is_active?: boolean;
      };

      state.cards = state.cards.map((card) => {
        if (card.card_id !== cardId) {
          return card;
        }

        return {
          ...card,
          ...payload,
        };
      });

      return new Response(
        JSON.stringify(state.cards.find((card) => card.card_id === cardId)),
      );
    }

    if (url.includes("/api/invoices/") && url.endsWith("/payments") && method === "POST") {
      const invoiceId = decodeURIComponent(
        url.split("/api/invoices/")[1]?.replace("/payments", "") ?? "",
      );
      const payload = JSON.parse(String(init?.body)) as {
        id: string;
        amount: number;
        account_id: string;
        paid_at: string;
      };
      const invoice = state.invoices.find((item) => item.invoice_id === invoiceId);
      if (!invoice) {
        return new Response("Invoice not found", { status: 404 });
      }

      const appliedAmount = Math.min(payload.amount, invoice.remaining_amount);
      invoice.paid_amount += appliedAmount;
      invoice.remaining_amount -= appliedAmount;
      invoice.status = invoice.remaining_amount === 0 ? "paid" : "partial";

      state.accounts = state.accounts.map((account) => {
        if (account.account_id !== payload.account_id) {
          return account;
        }

        return {
          ...account,
          current_balance: account.current_balance - appliedAmount,
        };
      });

      const paymentTransaction: TransactionSummary = {
        transaction_id: `${payload.id}:invoice-payment`,
        occurred_at: payload.paid_at,
        type: "expense",
        amount: appliedAmount,
        account_id: payload.account_id,
        payment_method: "OTHER",
        category_id: "invoice_payment",
        description: `Pagamento de fatura ${invoiceId}`,
        person_id: null,
        status: "active",
      };
      state.transactions = [paymentTransaction, ...state.transactions];

      return new Response(JSON.stringify(invoice), { status: 201 });
    }

    if (url.includes("/api/transactions/") && method === "PATCH") {
      const transactionId = url.split("/api/transactions/")[1];
      const payload = JSON.parse(String(init?.body)) as {
        occurred_at?: string;
        type?: string;
        amount?: number;
        account_id?: string;
        payment_method?: string;
        category_id?: string;
        description?: string | null;
        person_id?: string | null;
      };

      state.transactions = state.transactions.map((transaction) => {
        if (transaction.transaction_id !== transactionId) {
          return transaction;
        }

        return {
          ...transaction,
          ...payload,
        };
      });
      state.dashboard = {
        ...state.dashboard,
        recent_transactions: state.transactions,
      };

      return new Response(
        JSON.stringify(
          state.transactions.find((transaction) => transaction.transaction_id === transactionId),
        ),
      );
    }

    if (url.includes("/api/transactions/") && url.endsWith("/void") && method === "POST") {
      const transactionId = url.split("/api/transactions/")[1].replace("/void", "");
      state.transactions = state.transactions.map((transaction) => {
        if (transaction.transaction_id !== transactionId) {
          return transaction;
        }

        return {
          ...transaction,
          status: "voided",
        };
      });
      state.dashboard = {
        ...state.dashboard,
        recent_transactions: state.transactions,
      };

      return new Response(
        JSON.stringify(
          state.transactions.find((transaction) => transaction.transaction_id === transactionId),
        ),
      );
    }

    return new Response(JSON.stringify([]));
  });

  return fetchMock;
}