import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as api from "../../../lib/api";
import type { CardHolderSummary, CardSummary } from "../../../lib/api";
import { CardHoldersPanel } from "./card-holders-panel";

const card: CardSummary = {
  card_id: "card-1",
  name: "Bradesco Visa Infinite",
  limit: 600_000,
  closing_day: 24,
  due_day: 5,
  payment_account_id: "acc-1",
  is_active: true,
  future_installment_total: 0,
};

function buildHolder(overrides: Partial<CardHolderSummary> = {}): CardHolderSummary {
  return {
    holder_id: "holder-duda",
    card_id: "card-1",
    name: "Duda",
    last_four: "4321",
    is_primary: false,
    sub_limit: null,
    reimbursable_person_id: null,
    is_active: true,
    spent_open_invoice: 0,
    spent_future_installments: 0,
    ...overrides,
  };
}

describe("CardHoldersPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows each holder with its spend on the shared invoice", async () => {
    vi.spyOn(api, "fetchCardHolders").mockResolvedValue([
      buildHolder({
        holder_id: "holder-yann",
        name: "Yann",
        last_four: null,
        is_primary: true,
        spent_open_invoice: 30_000,
      }),
      buildHolder({ spent_open_invoice: 20_000, spent_future_installments: 15_000 }),
    ]);

    render(<CardHoldersPanel card={card} onError={vi.fn()} />);

    expect(await screen.findByText("Yann")).toBeInTheDocument();
    expect(screen.getByText("Titular")).toBeInTheDocument();
    expect(screen.getByText("Duda")).toBeInTheDocument();
    expect(screen.getByText("····4321")).toBeInTheDocument();
    expect(screen.getByText("R$ 300,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 200,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 150,00")).toBeInTheDocument();
  });

  it("flags a holder that went over the sub-limit", async () => {
    vi.spyOn(api, "fetchCardHolders").mockResolvedValue([
      buildHolder({
        sub_limit: 30_000,
        spent_open_invoice: 25_000,
        spent_future_installments: 10_000,
      }),
    ]);

    render(<CardHoldersPanel card={card} onError={vi.fn()} />);

    expect(
      await screen.findByText(/R\$ 350,00 de R\$ 300,00 · sub-limite estourado/),
    ).toBeInTheDocument();
  });

  it("marks the holder's spend as reimbursable when a person is set", async () => {
    vi.spyOn(api, "fetchCardHolders").mockResolvedValue([
      buildHolder({ reimbursable_person_id: "Duda" }),
    ]);

    render(<CardHoldersPanel card={card} onError={vi.fn()} />);

    expect(await screen.findByText("Reembolso · Duda")).toBeInTheDocument();
  });

  it("saves a new holder and reloads the list", async () => {
    const fetchHolders = vi
      .spyOn(api, "fetchCardHolders")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildHolder({ name: "Sérgio", last_four: "9876" })]);
    const upsert = vi
      .spyOn(api, "upsertCardHolder")
      .mockResolvedValue(buildHolder({ name: "Sérgio", last_four: "9876" }));

    render(<CardHoldersPanel card={card} onError={vi.fn()} />);

    await screen.findByText(/nenhum portador cadastrado/i);
    await userEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    await userEvent.type(screen.getByLabelText(/^nome$/i), "Sérgio");
    await userEvent.type(screen.getByLabelText(/4 últimos dígitos/i), "9876");
    await userEvent.click(screen.getByRole("button", { name: /^salvar$/i }));

    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
    expect(upsert.mock.calls[0][0]).toBe("card-1");
    expect(upsert.mock.calls[0][1]).toMatchObject({
      name: "Sérgio",
      lastFour: "9876",
      isPrimary: false,
      subLimitInCents: null,
      reimbursablePersonId: null,
    });
    expect(fetchHolders).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("Sérgio")).toBeInTheDocument();
  });

  it("reports an error when the holders cannot be loaded", async () => {
    vi.spyOn(api, "fetchCardHolders").mockRejectedValue(new Error("boom"));
    const onError = vi.fn();

    render(<CardHoldersPanel card={card} onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });
});
