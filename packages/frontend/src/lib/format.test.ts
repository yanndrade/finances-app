import { describe, expect, it } from "vitest";

import {
  formatPercentBR,
  parseCurrencyBRL,
  parseCurrencyBRLToCents,
} from "./format";

describe("format utilities", () => {
  it("formats null ratios as Sem base", () => {
    expect(formatPercentBR(null)).toBe("Sem base");
  });

  it("parses currency inputs in common Brazilian formats", () => {
    expect(parseCurrencyBRL("9195,22")).toBeCloseTo(9195.22);
    expect(parseCurrencyBRL("9.195,22")).toBeCloseTo(9195.22);
    expect(parseCurrencyBRL("R$ 9.195,22")).toBeCloseTo(9195.22);
    expect(parseCurrencyBRLToCents("R$ 40,43")).toBe(4043);
  });
});
