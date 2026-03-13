import * as api from "./api";


describe("api timestamp normalization", () => {
  it("converts local purchase datetimes into the correct UTC instant", () => {
    expect(
      api.normalizeTimestampForApi("2026-03-11T00:30", {
        localOffsetMinutes: 180,
      }),
    ).toBe("2026-03-11T03:30:00Z");
  });

  it("sends installments_count when creating a card purchase", async () => {
    const fetchMock = vi.fn<(typeof fetch)>().mockResolvedValue(
      new Response(
        JSON.stringify({
          purchase_id: "purchase-ui-1",
          purchase_date: "2026-03-11T03:30:00Z",
          amount: 50_00,
          category_id: "transport",
          card_id: "card-1",
          description: "Taxi",
          installments_count: 3,
          invoice_id: "card-1:2026-04",
          reference_month: "2026-04",
          closing_date: "2026-04-10",
          due_date: "2026-04-20",
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.createCardPurchase({
      cardId: "card-1",
      purchaseDate: "2026-03-11T00:30",
      amountInCents: 50_00,
      installmentsCount: 3,
      categoryId: "transport",
      description: "Taxi",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      installments_count: 3,
    });
  });

  it("omits payment_account_id when creating a card without conta padrao", async () => {
    const fetchMock = vi.fn<(typeof fetch)>().mockResolvedValue(
      new Response(
        JSON.stringify({
          card_id: "card-ui-1",
          name: "Cartao livre",
          limit: 150_000,
          closing_day: 10,
          due_day: 20,
          payment_account_id: "",
          is_active: true,
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.createCard({
      name: "Cartao livre",
      limitInCents: 150_000,
      closingDay: 10,
      dueDay: 20,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      id: expect.any(String),
      name: "Cartao livre",
      limit: 150_000,
      closing_day: 10,
      due_day: 20,
    });
  });

  it("converts payment datetime-local values and sends invoice payment payload", async () => {
    const fetchMock = vi.fn<(typeof fetch)>().mockResolvedValue(
      new Response(
        JSON.stringify({
          invoice_id: "card-1:2026-04",
          card_id: "card-1",
          reference_month: "2026-04",
          closing_date: "2026-04-10",
          due_date: "2026-04-20",
          total_amount: 90_00,
          paid_amount: 30_00,
          remaining_amount: 60_00,
          purchase_count: 1,
          status: "partial",
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-03T12:00:00Z"));
    const timezoneSpy = vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(180);

    await api.payInvoice({
      invoiceId: "card-1:2026-04",
      amountInCents: 30_00,
      accountId: "acc-2",
      paidAt: "2026-03-20T09:00",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/invoices/card-1%3A2026-04/payments");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
      amount: 30_00,
      account_id: "acc-2",
      paid_at: "2026-03-20T12:00:00Z",
    });

    timezoneSpy.mockRestore();
    vi.useRealTimers();
  });

  it("requests invoice items for a specific invoice id", async () => {
    const fetchMock = vi.fn<(typeof fetch)>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            invoice_item_id: "purchase-1:1",
            invoice_id: "card-1:2026-04",
            purchase_id: "purchase-1",
            card_id: "card-1",
            purchase_date: "2026-03-15T12:00:00Z",
            category_id: "electronics",
            description: "Headphones",
            installment_number: 1,
            installments_count: 3,
            amount: 33_33,
          },
        ]),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const fetchInvoiceItems = (
      api as unknown as {
        fetchInvoiceItems?: (invoiceId: string) => Promise<unknown>;
      }
    ).fetchInvoiceItems;

    await fetchInvoiceItems?.("card-1:2026-04");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/invoices/card-1%3A2026-04/items",
    );
  });

  it("requests card purchases for a specific card id", async () => {
    const fetchMock = vi.fn<(typeof fetch)>().mockResolvedValue(
      new Response(JSON.stringify([])),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.fetchCardPurchases("card-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/card-purchases?card=card-1");
  });

  it("sends card_id when reassigning a card purchase", async () => {
    const fetchMock = vi.fn<(typeof fetch)>().mockResolvedValue(
      new Response(
        JSON.stringify({
          purchase_id: "purchase-1",
          purchase_date: "2026-03-11T03:30:00Z",
          amount: 50_00,
          category_id: "transport",
          card_id: "card-2",
          description: "Taxi",
          installments_count: 3,
          invoice_id: "card-2:2026-03",
          reference_month: "2026-03",
          closing_date: "2026-03-15",
          due_date: "2026-03-25",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.updateCardPurchase("purchase-1", {
      cardId: "card-2",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PATCH");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/card-purchases/purchase-1");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      card_id: "card-2",
    });
  });

  it("requests future card installments for a specific card and month", async () => {
    const fetchMock = vi.fn<(typeof fetch)>().mockResolvedValue(
      new Response(JSON.stringify([])),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.fetchCardInstallments({
      cardId: "card-1",
      fromMonth: "2026-03",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/card-installments?card=card-1&from_month=2026-03",
    );
  });

  it("sends contribution and optional dividend values for investment movements", async () => {
    const fetchMock = vi.fn<(typeof fetch)>().mockResolvedValue(
      new Response(
        JSON.stringify({
          movement_id: "inv-1",
          occurred_at: "2026-03-10T12:00:00Z",
          type: "contribution",
          account_id: "acc-1",
          description: "Aporte mensal",
          contribution_amount: 30_00,
          dividend_amount: 5_00,
          cash_amount: 30_00,
          invested_amount: 35_00,
          cash_delta: -30_00,
          invested_delta: 35_00,
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const createInvestmentMovement = (
      api as unknown as {
        createInvestmentMovement?: (payload: {
          type: "contribution";
          accountId: string;
          occurredAt: string;
          contributionAmountInCents: number;
          dividendAmountInCents?: number;
          description?: string;
        }) => Promise<unknown>;
      }
    ).createInvestmentMovement;

    await createInvestmentMovement?.({
      type: "contribution",
      accountId: "acc-1",
      occurredAt: "2026-03-10T12:00:00Z",
      contributionAmountInCents: 30_00,
      dividendAmountInCents: 5_00,
      description: "Aporte mensal",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/investments/movements");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      type: "contribution",
      account_id: "acc-1",
      contribution_amount: 30_00,
      dividend_amount: 5_00,
    });
  });

  it("requests investment overview with view and date range", async () => {
    const fetchMock = vi.fn<(typeof fetch)>().mockResolvedValue(
      new Response(
        JSON.stringify({
          view: "monthly",
          from: "2026-03-01T00:00:00Z",
          to: "2026-03-31T23:59:59Z",
          totals: {
            contribution_total: 30_00,
            dividend_total: 5_00,
            withdrawal_total: 18_00,
            invested_balance: 15_00,
            cash_balance: 68_00,
            wealth: 83_00,
            dividends_accumulated: 5_00,
          },
          goal: {
            target: 0,
            realized: 35_00,
            remaining: 0,
            progress_percent: 100,
          },
          series: {
            wealth_evolution: [],
            contribution_dividend_trend: [],
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const fetchInvestmentOverview = (
      api as unknown as {
        fetchInvestmentOverview?: (params: {
          view: "monthly";
          from: string;
          to: string;
        }) => Promise<unknown>;
      }
    ).fetchInvestmentOverview;

    await fetchInvestmentOverview?.({
      view: "monthly",
      from: "2026-03-01T00:00:00Z",
      to: "2026-03-31T23:59:59Z",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/investments/overview?view=monthly&from=2026-03-01T00%3A00%3A00Z&to=2026-03-31T23%3A59%3A59Z",
    );
  });

  it("requests the dedicated backup snapshot endpoint", async () => {
    const fetchMock = vi.fn<(typeof fetch)>().mockResolvedValue(
      new Response(
        JSON.stringify({
          accounts: [],
          cards: [],
          invoices: [],
          transactions: [],
          investment_movements: [],
          report_summary: null,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.fetchBackupSnapshot();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/backups/export");
  });

  it("requests report summary with period and shared filters", async () => {
    const fetchMock = vi.fn<(typeof fetch)>().mockResolvedValue(
      new Response(
        JSON.stringify({
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
          category_breakdown: [{ category_id: "food", total: 25_00 }],
          weekly_trend: [],
          future_commitments: {
            period_installment_impact_total: 40_00,
            future_installment_total: 80_00,
            future_installment_months: [],
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.fetchReportSummary({
      period: "month",
      reference: "2026-04-15",
      from: "2026-04-01T00:00:00Z",
      to: "2026-04-30T23:59:59Z",
      category: "food",
      account: "acc-1",
      card: "",
      method: "CASH",
      person: "alice",
      text: "Dinner",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/reports/summary?period=month&reference=2026-04-15&from=2026-04-01T00%3A00%3A00Z&to=2026-04-30T23%3A59%3A59Z&category=food&account=acc-1&method=CASH&person=alice&text=Dinner",
    );
  });

  it("sends only changed fields in updateTransaction patch payload", async () => {
    const fetchMock = vi.fn<(typeof fetch)>().mockResolvedValue(
      new Response(
        JSON.stringify({
          transaction_id: "tx-1",
          occurred_at: "2026-04-20T10:00:00Z",
          type: "expense",
          amount: 50_00,
          account_id: "acc-1",
          payment_method: "CASH",
          category_id: "food",
          description: "Mercado mensal",
          person_id: null,
          status: "active",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.updateTransaction("tx-1", {
      description: "Mercado mensal",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      description: "Mercado mensal",
    });
  });

  it("fetches security state from dedicated endpoint", async () => {
    const fetchMock = vi.fn<(typeof fetch)>().mockResolvedValue(
      new Response(
        JSON.stringify({
          password_configured: true,
          is_locked: true,
          requires_lock_on_startup: true,
          inactivity_lock_seconds: 300,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.fetchSecurityState();

    expect(result).toEqual({
      password_configured: true,
      is_locked: true,
      requires_lock_on_startup: true,
      inactivity_lock_seconds: 300,
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/security/state");
  });

  it("posts security commands for password, lock and unlock", async () => {
    const fetchMock = vi
      .fn<(typeof fetch)>()
      .mockResolvedValue(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await api.setSecurityPassword({
      password: "secret-123",
      inactivityLockSeconds: 300,
    });
    await api.lockApplication();
    await api.unlockApplication("secret-123");

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/security/password");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      password: "secret-123",
      inactivity_lock_seconds: 300,
    });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/api/security/lock");
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("/api/security/unlock");
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({
      password: "secret-123",
    });
  });

  it("returns undefined for 204 responses", async () => {
    const fetchMock = vi
      .fn<(typeof fetch)>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.requestJson("/api/health")).resolves.toBeUndefined();
  });
});
