import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as api from "../../../lib/api";
import type { CardSummary } from "../../../lib/api";
import { ConvertCardDialog } from "./convert-card-dialog";

function buildCard(overrides: Partial<CardSummary> = {}): CardSummary {
  return {
    card_id: "card-titular",
    name: "Bradesco Visa Infinite",
    limit: 600_000,
    closing_day: 24,
    due_day: 5,
    payment_account_id: "acc-1",
    is_active: true,
    future_installment_total: 0,
    ...overrides,
  };
}

const additional = buildCard({
  card_id: "card-duda",
  name: "Bradesco Visa Infinite - Duda",
  limit: 360_000,
});
const cards = [buildCard(), additional];

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

describe("ConvertCardDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installDialogEnvironment();
  });

  it("pre-fills the holder name from the card name suffix", () => {
    render(
      <ConvertCardDialog
        card={additional}
        cards={cards}
        open
        onOpenChange={vi.fn()}
        onConverted={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/nome do portador/i)).toHaveValue("Duda");
  });

  it("shows what the conversion would move once a titular is picked", async () => {
    vi.spyOn(api, "previewCardConversion").mockResolvedValue({
      card_id: "card-duda",
      card_name: "Bradesco Visa Infinite - Duda",
      target_card_id: "card-titular",
      target_card_name: "Bradesco Visa Infinite",
      purchase_count: 47,
      purchase_total: 413_755,
      payment_count: 5,
      payment_total: 313_770,
      cycle_matches: true,
    });

    render(
      <ConvertCardDialog
        card={additional}
        cards={cards}
        open
        onOpenChange={vi.fn()}
        onConverted={vi.fn()}
        onError={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(
      await screen.findByRole("option", { name: "Bradesco Visa Infinite" }),
    );

    expect(
      await screen.findByText(/47 compra\(s\) · R\$ 4\.137,55/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/5 pagamento\(s\) de fatura · R\$ 3\.137,70/),
    ).toBeInTheDocument();
  });

  it("blocks the conversion when the cycles differ", async () => {
    vi.spyOn(api, "previewCardConversion").mockResolvedValue({
      card_id: "card-duda",
      card_name: "Bradesco Visa Infinite - Duda",
      target_card_id: "card-titular",
      target_card_name: "Bradesco Visa Infinite",
      purchase_count: 1,
      purchase_total: 1000,
      payment_count: 0,
      payment_total: 0,
      cycle_matches: false,
    });

    render(
      <ConvertCardDialog
        card={additional}
        cards={cards}
        open
        onOpenChange={vi.fn()}
        onConverted={vi.fn()}
        onError={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(
      await screen.findByRole("option", { name: "Bradesco Visa Infinite" }),
    );

    expect(await screen.findByText(/ciclos diferentes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /converter/i })).toBeDisabled();
  });

  it("reports how much moved, including payments left behind", async () => {
    vi.spyOn(api, "previewCardConversion").mockResolvedValue({
      card_id: "card-duda",
      card_name: "Bradesco Visa Infinite - Duda",
      target_card_id: "card-titular",
      target_card_name: "Bradesco Visa Infinite",
      purchase_count: 2,
      purchase_total: 1000,
      payment_count: 2,
      payment_total: 1000,
      cycle_matches: true,
    });
    const convert = vi.spyOn(api, "convertCardToHolder").mockResolvedValue({
      card_id: "card-duda",
      target_card_id: "card-titular",
      holder_id: "holder-1",
      purchases_moved: 2,
      payments_reassigned: 1,
      payments_orphaned: ["payment-9"],
    });
    const onConverted = vi.fn();

    render(
      <ConvertCardDialog
        card={additional}
        cards={cards}
        open
        onOpenChange={vi.fn()}
        onConverted={onConverted}
        onError={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(
      await screen.findByRole("option", { name: "Bradesco Visa Infinite" }),
    );
    await userEvent.type(screen.getByLabelText(/4 últimos dígitos/i), "4321");
    await userEvent.click(screen.getByRole("button", { name: /converter/i }));

    await waitFor(() => expect(convert).toHaveBeenCalledTimes(1));
    expect(convert.mock.calls[0][0]).toBe("card-duda");
    expect(convert.mock.calls[0][1]).toMatchObject({
      targetCardId: "card-titular",
      holderName: "Duda",
      lastFour: "4321",
    });
    expect(onConverted).toHaveBeenCalledWith(
      expect.stringContaining("1 pagamento(s) ficaram no cartão antigo"),
    );
  });
});
