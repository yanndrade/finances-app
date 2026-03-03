import { normalizeTimestampForApi } from "./api";


describe("api timestamp normalization", () => {
  it("converts local purchase datetimes into the correct UTC instant", () => {
    expect(
      normalizeTimestampForApi("2026-03-11T00:30", {
        localOffsetMinutes: 180,
      }),
    ).toBe("2026-03-11T03:30:00Z");
  });
});
