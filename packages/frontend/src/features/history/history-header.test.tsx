import { render, screen } from "@testing-library/react";

import { HistoryHeader } from "./history-header";

describe("HistoryHeader", () => {
  it("renders search without duplicating title or launch action", () => {
    render(
      <HistoryHeader
        searchText=""
        onSearchChange={() => {}}
      />,
    );

    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: /hist.rico/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /lan.ar/i }),
    ).not.toBeInTheDocument();
  });
});
