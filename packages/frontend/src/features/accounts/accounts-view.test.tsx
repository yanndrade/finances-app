import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { AccountSummary } from "../../lib/api";
import { AccountsView } from "./accounts-view";

const defaultAccounts: AccountSummary[] = [
  {
    account_id: "acc-1",
    name: "Conta principal",
    type: "checking",
    initial_balance: 100_000,
    is_active: true,
    current_balance: 132_500,
  },
  {
    account_id: "acc-2",
    name: "Carteira reserva",
    type: "wallet",
    initial_balance: 50_00,
    is_active: false,
    current_balance: 50_00,
  },
];

function renderAccountsView(
  overrides: Partial<ComponentProps<typeof AccountsView>> = {},
) {
  const onCreateAccount = overrides.onCreateAccount ?? vi.fn(() => Promise.resolve());
  const onSetAccountActive =
    overrides.onSetAccountActive ?? vi.fn(() => Promise.resolve());
  const onUpdateAccount = overrides.onUpdateAccount ?? vi.fn(() => Promise.resolve());

  render(
    <AccountsView
      accounts={overrides.accounts ?? defaultAccounts}
      isSubmitting={overrides.isSubmitting ?? false}
      onCreateAccount={onCreateAccount}
      onOpenSettings={overrides.onOpenSettings ?? vi.fn()}
      onSetAccountActive={onSetAccountActive}
      onUpdateAccount={onUpdateAccount}
    />,
  );

  return {
    onSetAccountActive,
  };
}

describe("AccountsView", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lets the user remove an active account from operation", async () => {
    const user = userEvent.setup();
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);
    const { onSetAccountActive } = renderAccountsView();

    await user.click(screen.getByRole("button", { name: /excluir/i }));

    expect(confirmMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(onSetAccountActive).toHaveBeenCalledWith(defaultAccounts[0], false);
    });
  });

  it("lets the user reactivate an inactive account without confirmation", async () => {
    const user = userEvent.setup();
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);
    const { onSetAccountActive } = renderAccountsView();

    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    expect(confirmMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(onSetAccountActive).toHaveBeenCalledWith(defaultAccounts[1], true);
    });
  });
});
