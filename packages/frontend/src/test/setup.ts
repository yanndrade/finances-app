import "@testing-library/jest-dom/vitest";
import { createElement } from "react";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");

  return {
    ...actual,
    ResponsiveContainer: ({
      children,
      width = "100%",
      height = "100%",
    }: {
      children: unknown;
      width?: number | string;
      height?: number | string;
    }) =>
      createElement(
        "div",
        {
          "data-testid": "recharts-responsive-container",
          style: {
            width,
            height,
            minWidth: 320,
            minHeight: 240,
          },
        },
        typeof children === "function"
          ? children({
              width: 640,
              height: 320,
            })
          : children,
      ),
  };
});

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
