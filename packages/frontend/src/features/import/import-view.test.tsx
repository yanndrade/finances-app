import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as api from "../../lib/api";
import type { PluggyInboxEntry } from "../../lib/api";
import type { CategoryOption } from "../../lib/categories";
import { ImportView } from "./import-view";

const categoryOptions: CategoryOption[] = [
  { value: "supermercado", label: "Supermercado" },
  { value: "vestuario", label: "Vestuário" },
];

function installDialogEnvironment() {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() })),
  );
  for (const method of [
    "hasPointerCapture",
    "setPointerCapture",
    "releasePointerCapture",
    "scrollIntoView",
  ]) {
    Object.defineProperty(HTMLElement.prototype, method, {
      configurable: true,
      value: vi.fn(() => false),
    });
  }
}

function buildEntry(overrides: Partial<PluggyInboxEntry> = {}): PluggyInboxEntry {
  return {
    entry_id: "entry-1",
    item_id: "item-1",
    pluggy_account_id: "pluggy-bank-1",
    external_id: "tx-1",
    kind: "bank_transaction",
    group_key: null,
    occurred_at: "2026-08-20T12:00:00Z",
    amount: 12_550,
    title: "Padaria",
    proposal: {
      payload: {
        transaction_type: "expense",
        account_id: "acc-nubank",
        category_id: "supermercado",
      },
      skip_reason: null,
    },
    match_kind: "new",
    matched_local_id: null,
    decision: "pending",
    decided_at: null,
    created_local_id: null,
    revised: false,
    account_label: "Conta corrente",
    ...overrides,
  };
}

function renderView(entries: PluggyInboxEntry[], props = {}) {
  vi.spyOn(api, "fetchPluggyInbox").mockResolvedValue({
    entries,
    pending_total: entries.length,
  });
  const onError = vi.fn();
  const onChanged = vi.fn();
  render(
    <ImportView
      isSyncing={false}
      onSync={vi.fn(() => Promise.resolve())}
      onError={onError}
      onChanged={onChanged}
      refreshToken={0}
      {...props}
    />,
  );
  return { onError, onChanged };
}

describe("ImportView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installDialogEnvironment();
  });

  it("groups entries by account and shows the amount", async () => {
    renderView([
      buildEntry(),
      buildEntry({
        entry_id: "entry-2",
        external_id: "card-1",
        kind: "card_purchase",
        account_label: "Cartão Bradesco",
        amount: 30_000,
        title: "Notebook",
        proposal: {
          payload: { card_id: "card-bradesco", installments_count: 3 },
          skip_reason: null,
        },
      }),
    ]);

    expect(await screen.findByText("Conta corrente")).toBeInTheDocument();
    expect(screen.getByText("Cartão Bradesco")).toBeInTheDocument();
    expect(screen.getByText("−R$ 125,50")).toBeInTheDocument();
    expect(screen.getByText("−R$ 300,00")).toBeInTheDocument();
    // An installment purchase says so, since it lands on several invoices.
    expect(screen.getByText("3x")).toBeInTheDocument();
  });

  it("opens the composer to review instead of accepting blind", async () => {
    const accept = vi.spyOn(api, "acceptPluggyEntry");
    const onReview = vi.fn();
    renderView([buildEntry()], { onReview });

    await userEvent.click(await screen.findByRole("button", { name: /aceitar$/i }));

    // Category and person are decided in the composer, not here.
    expect(onReview).toHaveBeenCalledWith(
      expect.objectContaining({ entry_id: "entry-1" }),
      false,
    );
    expect(accept).not.toHaveBeenCalled();
  });

  it("accepts a kind with nothing left to decide without opening anything", async () => {
    const accept = vi
      .spyOn(api, "acceptPluggyEntry")
      .mockResolvedValue(buildEntry({ decision: "accepted" }));
    const onReview = vi.fn();
    renderView(
      [
        buildEntry({
          kind: "transfer",
          proposal: {
            payload: {
              from_account_id: "acc-nubank",
              to_account_id: "acc-poupanca",
            },
            skip_reason: null,
          },
        }),
      ],
      { onReview },
    );

    await userEvent.click(await screen.findByRole("button", { name: /aceitar$/i }));

    await waitFor(() => expect(accept).toHaveBeenCalledWith("entry-1", {}, false));
    expect(onReview).not.toHaveBeenCalled();
  });

  it("no longer asks for a category in the row itself", async () => {
    renderView([buildEntry()]);

    await screen.findByText("Padaria");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("offers to link a suspected duplicate instead of creating it", async () => {
    const link = vi
      .spyOn(api, "linkPluggyEntry")
      .mockResolvedValue(buildEntry({ decision: "duplicate" }));
    renderView([
      buildEntry({
        match_kind: "duplicate_of_local",
        matched_local_id: "manual-1",
      }),
    ]);

    expect(await screen.findByText(/parece já existir no app/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /é a mesma/i }));

    await waitFor(() => expect(link).toHaveBeenCalledWith("entry-1", "manual-1"));
  });

  it("ignores an entry", async () => {
    const ignore = vi
      .spyOn(api, "ignorePluggyEntry")
      .mockResolvedValue(buildEntry({ decision: "ignored" }));
    renderView([buildEntry()]);

    await userEvent.click(await screen.findByRole("button", { name: /ignorar/i }));

    await waitFor(() => expect(ignore).toHaveBeenCalledWith("entry-1"));
    expect(screen.queryByText("Padaria")).not.toBeInTheDocument();
  });

  it("accepts and ignores from the keyboard", async () => {
    const accept = vi
      .spyOn(api, "acceptPluggyEntry")
      .mockResolvedValue(buildEntry({ decision: "accepted" }));
    renderView([buildEntry()]);

    const row = (await screen.findByText("Padaria")).closest(
      "[tabindex]",
    ) as HTMLElement;
    row.focus();
    await userEvent.keyboard("a");

    await waitFor(() => expect(accept).toHaveBeenCalledTimes(1));
  });

  it("filters down to the suspected duplicates", async () => {
    renderView([
      buildEntry(),
      buildEntry({
        entry_id: "entry-2",
        title: "Farmácia",
        match_kind: "duplicate_of_local",
        matched_local_id: "manual-2",
      }),
    ]);

    await userEvent.click(
      await screen.findByRole("button", { name: /possíveis duplicatas/i }),
    );

    expect(screen.getByText("Farmácia")).toBeInTheDocument();
    expect(screen.queryByText("Padaria")).not.toBeInTheDocument();
  });

  it("accepts an invoice payment without asking for a category", async () => {
    const accept = vi
      .spyOn(api, "acceptPluggyEntry")
      .mockResolvedValue(buildEntry({ decision: "accepted" }));
    renderView(
      [
        buildEntry({
          kind: "invoice_payment",
          title: "Pagamento recebido",
          proposal: {
            payload: {
              card_id: "card-bradesco",
              account_id: "acc-nubank",
              invoice_id: "card-bradesco:2026-08",
              amount: 50_000,
              paid_at: "2026-09-05T12:00:00Z",
            },
            skip_reason: null,
          },
        }),
      ],
      { names: { "card-bradesco": "Bradesco", "acc-nubank": "Nubank" } },
    );

    // Which bill it settles, and out of which account, is the whole decision.
    expect(
      await screen.findByText("Fatura Bradesco · 2026-08 — paga por Nubank"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /aceitar$/i }));

    await waitFor(() => expect(accept).toHaveBeenCalledWith("entry-1", {}, false));
  });

  it("shows a transfer as one entry naming both accounts", async () => {
    const accept = vi
      .spyOn(api, "acceptPluggyEntry")
      .mockResolvedValue(buildEntry({ decision: "accepted" }));
    renderView(
      [
        buildEntry({
          kind: "transfer",
          title: "Transferência enviada",
          proposal: {
            payload: {
              from_account_id: "acc-nubank",
              to_account_id: "acc-poupanca",
              amount: 30_000,
              occurred_at: "2026-08-20T12:00:00Z",
            },
            skip_reason: null,
          },
        }),
      ],
      { names: { "acc-nubank": "Nubank", "acc-poupanca": "Poupança" } },
    );

    expect(await screen.findByText("Nubank → Poupança")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /aceitar$/i }));

    await waitFor(() => expect(accept).toHaveBeenCalledWith("entry-1", {}, false));
  });

  it("shows an investment buy with its ticker and funding account", async () => {
    const accept = vi
      .spyOn(api, "acceptPluggyEntry")
      .mockResolvedValue(buildEntry({ decision: "accepted" }));
    renderView(
      [
        buildEntry({
          kind: "investment_movement",
          title: "Aplicação Tesouro Selic",
          proposal: {
            payload: {
              movement_type: "compra",
              asset_ticker: "SELIC2029",
              asset_class: null,
              account_id: "acc-nubank",
              amount: 50_000,
              occurred_at: "2026-08-14T00:00:00Z",
            },
            skip_reason: null,
          },
        }),
      ],
      { names: { "acc-nubank": "Nubank" } },
    );

    expect(
      await screen.findByText("Compra · SELIC2029 — via Nubank"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /aceitar$/i }));

    await waitFor(() => expect(accept).toHaveBeenCalledWith("entry-1", {}, false));
  });

  it("still refuses a kind the backend flagged as unsupported", async () => {
    renderView([
      buildEntry({
        kind: "invoice_payment",
        title: "Pagamento recebido",
        proposal: { payload: {}, skip_reason: "something_new" },
      }),
    ]);

    expect(
      await screen.findByText(/ainda não é importado automaticamente/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /aceitar$/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ignorar/i })).toBeInTheDocument();
  });

  it("accepts every ready entry of a group at once", async () => {
    const accept = vi
      .spyOn(api, "acceptPluggyEntry")
      .mockResolvedValue(buildEntry({ decision: "accepted" }));
    renderView([
      buildEntry(),
      buildEntry({ entry_id: "entry-2", external_id: "tx-2", title: "Mercado" }),
    ]);

    // Both entries share one account, so there is a single group button.
    await userEvent.click(
      await screen.findByRole("button", { name: /aceitar todos/i }),
    );

    await waitFor(() => expect(accept).toHaveBeenCalledTimes(2));
  });

  it("shows an empty state when there is nothing to review", async () => {
    renderView([]);

    expect(await screen.findByText(/nada para revisar/i)).toBeInTheDocument();
  });

  it("reports an error when the queue cannot be loaded", async () => {
    vi.spyOn(api, "fetchPluggyInbox").mockRejectedValue(new Error("boom"));
    const onError = vi.fn();

    render(
      <ImportView
          isSyncing={false}
        onSync={vi.fn(() => Promise.resolve())}
        onError={onError}
        onChanged={vi.fn()}
        refreshToken={0}
      />,
    );

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });

  it("marks a purchase that came from a bill still open", async () => {
    renderView([
      buildEntry({
        kind: "card_purchase",
        title: "Mercado",
        proposal: {
          payload: { card_id: "card-bradesco", category_id: "supermercado" },
          skip_reason: null,
          source_status: "PENDING",
        },
      }),
    ]);

    expect(await screen.findByText("Fatura aberta")).toBeInTheDocument();
  });

  it("says when accepting will confirm a fixed expense", async () => {
    renderView([
      buildEntry({
        kind: "card_purchase",
        title: "NETFLIX.COM",
        proposal: {
          payload: { card_id: "card-bradesco", category_id: "lazer-shopping" },
          skip_reason: null,
          settles_pending: "Netflix",
        },
      }),
    ]);

    expect(
      await screen.findByText(/confirma o gasto fixo netflix/i),
    ).toBeInTheDocument();
  });

  it("tells money coming in from money going out", async () => {
    renderView([
      buildEntry({ title: "Padaria" }),
      buildEntry({
        entry_id: "entry-2",
        external_id: "tx-2",
        title: "Salário",
        amount: 625_000,
        proposal: {
          payload: {
            transaction_type: "income",
            account_id: "acc-nubank",
            category_id: "supermercado",
          },
          skip_reason: null,
        },
      }),
    ]);

    const income = await screen.findByText("+R$ 6.250,00");
    expect(income).toHaveClass("text-finance-income");
    expect(screen.getByText("−R$ 125,50")).toHaveClass("text-finance-expense");
  });

  it("chips the additional whose card made the purchase", async () => {
    renderView([
      buildEntry({
        kind: "card_purchase",
        title: "Farmácia",
        proposal: {
          payload: { card_id: "card-bradesco", category_id: "farmacia-saude" },
          skip_reason: null,
          holder_name: "Duda",
        },
      }),
    ]);

    expect(await screen.findByText("Duda")).toBeInTheDocument();
  });

  it("rebuilt installments read as one purchase", async () => {
    renderView([
      buildEntry({
        kind: "card_purchase",
        title: "Vindi *Investidor10",
        amount: 238_80,
        proposal: {
          payload: {
            card_id: "card-bradesco",
            category_id: "lazer-shopping",
            installments_count: 12,
          },
          skip_reason: null,
        },
      }),
    ]);

    // The whole purchase and how many instalments, not one line per instalment.
    expect(await screen.findByText("−R$ 238,80")).toBeInTheDocument();
    expect(screen.getByText("12x")).toBeInTheDocument();
  });

  it("passes on the request to remember what this description means", async () => {
    const onReview = vi.fn();
    renderView([buildEntry()], { onReview });

    await userEvent.click(await screen.findByRole("checkbox", { name: /lembrar/i }));
    await userEvent.click(screen.getByRole("button", { name: /aceitar$/i }));

    // The rule is taught from what the composer confirms, so the flag has to
    // survive the trip.
    expect(onReview).toHaveBeenCalledWith(
      expect.objectContaining({ entry_id: "entry-1" }),
      true,
    );
  });

  it("does not offer to remember a kind that carries no category", async () => {
    renderView([
      buildEntry({
        kind: "transfer",
        proposal: {
          payload: {
            from_account_id: "acc-nubank",
            to_account_id: "acc-poupanca",
          },
          skip_reason: null,
        },
      }),
    ]);

    await screen.findByRole("button", { name: /aceitar$/i });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});

