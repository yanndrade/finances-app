import { render, screen } from "@testing-library/react";

import { App } from "./App";

describe("App", () => {
  it("renders the desktop shell", () => {
    render(<App />);

    expect(screen.getByRole("navigation", { name: /main/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /dashboard mensal/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/carregando dados/i)).toBeInTheDocument();
  });
});
