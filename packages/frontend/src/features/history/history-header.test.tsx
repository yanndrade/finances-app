import { render, screen } from "@testing-library/react";

import { HistoryHeader } from "./history-header";

describe("HistoryHeader", () => {
  it("renders month navigation and search without duplicating title or launch action", () => {
    render(
      <HistoryHeader
        competenceMonth="2026-03"
        searchText=""
        onCompetenceChange={() => {}}
        onSearchChange={() => {}}
      />,
    );

    expect(screen.getByLabelText(/selecionar compet.ncia/i)).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: /hist.rico/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /lan.ar/i }),
    ).not.toBeInTheDocument();
  });
});
