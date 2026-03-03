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
      id: "payment-1772539200000",
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
});
