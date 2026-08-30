import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as api from "../../lib/api";
import type { PluggyDiscoveredAccount } from "../../lib/api";
import { OpenFinanceView } from "./open-finance-view";

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

function buildAccount(
  overrides: Partial<PluggyDiscoveredAccount> = {},
): PluggyDiscoveredAccount {
  return {
    pluggy_account_id: "pluggy-1",
    item_id: "item-1",
    kind: "bank",
    display_name: "Banco Bradesco",
    number: "00028549-8",
    brand: null,
    holder_type: null,
    subtype: "CHECKING_ACCOUNT",
    balance: 1_234_56,
    credit_limit: null,
    local_account_id: null,
    local_card_id: null,
    local_holder_id: null,
    ignored: false,
    import_since: null,
    is_linked: false,
    suggestion: null,
    ...overrides,
  };
}

function renderView(
  accounts: PluggyDiscoveredAccount[],
  options: {
    holders?: api.CardHolderSummary[];
    cardNumbers?: api.PluggyCardNumber[];
  } = {},
) {
  vi.spyOn(api, "fetchCardHolders").mockResolvedValue(options.holders ?? []);
  vi.spyOn(api, "fetchPluggyCardNumbers").mockResolvedValue({
    card_numbers: options.cardNumbers ?? [],
    local_card_id: "card-bradesco",
  });
  vi.spyOn(api, "fetchPluggyAccounts").mockResolvedValue(accounts);
  vi.spyOn(api, "fetchPluggyStatus").mockResolvedValue({
    connected: true,
    items: [
      {
        item_id: "item-1",
        client_user_id: "meucofri-owner",
        connector_name: "MeuPluggy",
        status: "UPDATED",
        execution_status: "SUCCESS",
        error_code: null,
        error_message: null,
        provider_message: null,
        created_at: "2026-08-29T00:00:00Z",
        updated_at: "2026-08-29T00:00:00Z",
        last_synced_at: "2026-08-29T00:00:00Z",
      },
    ],
    last_synced_at: "2026-08-29T00:00:00Z",
  });
  vi.spyOn(api, "fetchAccounts").mockResolvedValue([
    {
      account_id: "acc-nubank",
      name: "Nubank",
      type: "checking",
      initial_balance: 0,
      is_active: true,
    } as never,
  ]);
  vi.spyOn(api, "fetchCards").mockResolvedValue([
    {
      card_id: "card-bradesco",
      name: "Bradesco Visa Infinite",
      limit: 600_000,
      closing_day: 24,
      due_day: 5,
      payment_account_id: "acc-nubank",
      is_active: true,
      future_installment_total: 0,
    } as never,
  ]);

  const onError = vi.fn();
  const onChanged = vi.fn();
  render(
    <OpenFinanceView
      onError={onError}
      onChanged={onChanged}
      onSync={vi.fn(() => Promise.resolve())}
      isSyncing={false}
      refreshToken={0}
    />,
  );
  return { onError, onChanged };
}

describe("OpenFinanceView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installDialogEnvironment();
  });

  it("separates accounts, cards and investments instead of one flat list", async () => {
    renderView([
      buildAccount(),
      buildAccount({
        pluggy_account_id: "pluggy-2",
        kind: "credit",
        display_name: "VISA INFINITE",
        number: "8715",
        subtype: null,
        balance: null,
      }),
      buildAccount({
        pluggy_account_id: "pluggy-3",
        kind: "investment",
        display_name: "HGLG11",
        number: "HGLG11",
        subtype: null,
        balance: null,
      }),
    ]);

    expect(await screen.findByRole("list", { name: "Contas" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Cartões" })).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Investimentos" }),
    ).toBeInTheDocument();
  });

  it("collapses repeated investment positions into one decision", async () => {
    const link = vi
      .spyOn(api, "linkPluggyAccount")
      .mockResolvedValue(buildAccount({ is_linked: true }));
    renderView(
      Array.from({ length: 3 }, (_, index) =>
        buildAccount({
          pluggy_account_id: `cdb-${index}`,
          kind: "investment",
          display_name: "CDB - NU FINANCEIRA S.A.",
          // The broker exposes no code for a CDB, which is what makes the
          // positions indistinguishable in the list.
          number: null,
          brand: "FIXED_INCOME",
          subtype: null,
          balance: null,
        }),
      ),
    );

    const investments = await screen.findByRole("list", {
      name: "Investimentos",
    });
    expect(within(investments).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("3 posições")).toBeInTheDocument();

    await userEvent.click(
      within(investments).getByRole("combobox", {
        name: /Destino de CDB/i,
      }),
    );
    await userEvent.click(await screen.findByRole("option", { name: "Nubank" }));

    // One decision, but it has to reach every position behind it.
    await waitFor(() => expect(link).toHaveBeenCalledTimes(3));
    expect(link.mock.calls.map((call) => call[0]).sort()).toEqual([
      "cdb-0",
      "cdb-1",
      "cdb-2",
    ]);
  });

  it("warns when the bank reports two accounts with the same number", async () => {
    renderView([
      buildAccount({ pluggy_account_id: "pluggy-1", subtype: "CHECKING_ACCOUNT" }),
      buildAccount({ pluggy_account_id: "pluggy-2", subtype: "SAVINGS_ACCOUNT" }),
    ]);

    expect(
      await screen.findAllByText(/mais de uma conta com este número/i),
    ).toHaveLength(2);
  });

  it("shows the subtype and balance that tell look-alike accounts apart", async () => {
    renderView([
      buildAccount({ subtype: "SAVINGS_ACCOUNT", balance: 789 }),
    ]);

    expect(await screen.findByText("Poupança")).toBeInTheDocument();
    expect(screen.getByText("Saldo R$ 7,89")).toBeInTheDocument();
  });

  it("counts what still has no destination", async () => {
    renderView([
      buildAccount(),
      buildAccount({
        pluggy_account_id: "pluggy-2",
        number: "999",
        is_linked: true,
        local_account_id: "acc-nubank",
      }),
    ]);

    expect(await screen.findByText(/1 sem destino\./i)).toBeInTheDocument();
  });

  it("accepts every suggestion in a section at once", async () => {
    const link = vi
      .spyOn(api, "linkPluggyAccount")
      .mockResolvedValue(buildAccount({ is_linked: true }));
    renderView([
      buildAccount({
        suggestion: {
          kind: "account",
          id: "acc-nubank",
          label: "Nubank",
          reason: "name",
        },
      }),
    ]);

    await userEvent.click(
      await screen.findByRole("button", { name: /aceitar sugestões/i }),
    );

    await waitFor(() => expect(link).toHaveBeenCalledTimes(1));
    expect(link).toHaveBeenCalledWith(
      "pluggy-1",
      expect.objectContaining({ localAccountId: "acc-nubank" }),
    );
  });

  it("reports the refusal when a destination is already taken", async () => {
    vi.spyOn(api, "linkPluggyAccount").mockRejectedValue(
      new Error("'Banco Bradesco' já usa esta conta."),
    );
    const { onError } = renderView([buildAccount()]);

    const combobox = await screen.findByRole("combobox", {
      name: /Destino de Banco Bradesco/i,
    });
    await userEvent.click(combobox);
    await userEvent.click(await screen.findByRole("option", { name: "Nubank" }));

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining("já usa esta conta"),
      ),
    );
  });

  it("shows nothing instead of an empty amount before the first sync", async () => {
    renderView([buildAccount({ balance: null, subtype: null })]);

    expect(
      await screen.findByText(/sincronize para ver saldo e limite/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("labels the money by what the account is", async () => {
    renderView([
      buildAccount({
        kind: "credit",
        display_name: "VISA INFINITE",
        number: "8715",
        subtype: null,
        balance: 28_550,
        credit_limit: 600_000,
      }),
    ]);

    expect(await screen.findByText("Fatura R$ 285,50")).toBeInTheDocument();
    expect(screen.getByText("Limite R$ 6.000,00")).toBeInTheDocument();
  });

  it("lists the plastics that spent on a linked card and who owns each", async () => {
    renderView(
      [
        buildAccount({
          kind: "credit",
          display_name: "VISA INFINITE",
          number: "8715",
          subtype: null,
          balance: null,
          is_linked: true,
          local_card_id: "card-bradesco",
        }),
      ],
      {
        holders: [
          {
            holder_id: "holder-duda",
            card_id: "card-bradesco",
            name: "Duda",
            last_four: "1234",
            is_primary: false,
            sub_limit: null,
            reimbursable_person_id: null,
            is_active: true,
          } as never,
        ],
        cardNumbers: [
          {
            last_four: "1234",
            purchase_count: 2,
            total_amount: 7_500,
            last_seen_at: "2026-08-20T12:00:00Z",
            sample_description: "Farmácia",
            holder_id: "holder-duda",
            holder_name: "Duda",
          },
          {
            last_four: "8715",
            purchase_count: 1,
            total_amount: 10_000,
            last_seen_at: "2026-08-21T12:00:00Z",
            sample_description: "Mercado",
            holder_id: null,
            holder_name: null,
          },
        ],
      },
    );

    const plastics = await screen.findByRole("list", {
      name: "Cartões que gastaram",
    });
    expect(within(plastics).getByText("····1234")).toBeInTheDocument();
    // The titular's own plastic shares the number shown on the account row.
    expect(within(plastics).getByText("····8715")).toBeInTheDocument();
    expect(within(plastics).getAllByText("Duda").length).toBeGreaterThan(0);
    // A plastic with no holder is the titular's own, not something missing.
    expect(within(plastics).getByText("Titular")).toBeInTheDocument();
  });

  it("assigns a plastic to a holder by saving its last four", async () => {
    const upsert = vi.spyOn(api, "upsertCardHolder").mockResolvedValue({
      holder_id: "holder-duda",
      card_id: "card-bradesco",
      name: "Duda",
      last_four: "8715",
      is_primary: false,
      sub_limit: null,
      reimbursable_person_id: null,
      is_active: true,
    } as never);
    renderView(
      [
        buildAccount({
          kind: "credit",
          display_name: "VISA INFINITE",
          number: "8715",
          subtype: null,
          balance: null,
          is_linked: true,
          local_card_id: "card-bradesco",
        }),
      ],
      {
        holders: [
          {
            holder_id: "holder-duda",
            card_id: "card-bradesco",
            name: "Duda",
            last_four: null,
            is_primary: false,
            sub_limit: null,
            reimbursable_person_id: null,
            is_active: true,
          } as never,
        ],
        cardNumbers: [
          {
            last_four: "8715",
            purchase_count: 1,
            total_amount: 10_000,
            last_seen_at: "2026-08-21T12:00:00Z",
            sample_description: "Mercado",
            holder_id: null,
            holder_name: null,
          },
        ],
      },
    );

    await userEvent.click(
      await screen.findByRole("combobox", { name: /Portador de ····8715/i }),
    );
    await userEvent.click(await screen.findByRole("option", { name: "Duda" }));

    await waitFor(() =>
      expect(upsert).toHaveBeenCalledWith(
        "card-bradesco",
        expect.objectContaining({ holderId: "holder-duda", lastFour: "8715" }),
      ),
    );
  });
});

