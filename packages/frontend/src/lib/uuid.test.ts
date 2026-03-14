import { createClientId } from "./uuid";

describe("createClientId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses crypto.randomUUID when available", () => {
    const randomUuid = vi.fn().mockReturnValue("uuid-from-randomUUID");
    const getRandomValues = vi.fn();

    vi.stubGlobal("crypto", {
      randomUUID: randomUuid,
      getRandomValues,
    });

    expect(createClientId()).toBe("uuid-from-randomUUID");
    expect(randomUuid).toHaveBeenCalledTimes(1);
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it("builds a uuid from crypto.getRandomValues when randomUUID is unavailable", () => {
    const getRandomValues = vi.fn((buffer: Uint8Array) => {
      buffer.set([
        0x00,
        0x11,
        0x22,
        0x33,
        0x44,
        0x55,
        0x66,
        0x77,
        0x88,
        0x99,
        0xaa,
        0xbb,
        0xcc,
        0xdd,
        0xee,
        0xff,
      ]);
      return buffer;
    });

    vi.stubGlobal("crypto", {
      getRandomValues,
    });

    expect(createClientId()).toBe("00112233-4455-4677-8899-aabbccddeeff");
    expect(getRandomValues).toHaveBeenCalledTimes(1);
  });

  it("falls back to Math.random when Web Crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    const randomSpy = vi.spyOn(Math, "random");
    randomSpy
      .mockReturnValueOnce(0 / 256)
      .mockReturnValueOnce(17 / 256)
      .mockReturnValueOnce(34 / 256)
      .mockReturnValueOnce(51 / 256)
      .mockReturnValueOnce(68 / 256)
      .mockReturnValueOnce(85 / 256)
      .mockReturnValueOnce(102 / 256)
      .mockReturnValueOnce(119 / 256)
      .mockReturnValueOnce(136 / 256)
      .mockReturnValueOnce(153 / 256)
      .mockReturnValueOnce(170 / 256)
      .mockReturnValueOnce(187 / 256)
      .mockReturnValueOnce(204 / 256)
      .mockReturnValueOnce(221 / 256)
      .mockReturnValueOnce(238 / 256)
      .mockReturnValueOnce(255 / 256);

    expect(createClientId()).toBe("00112233-4455-4677-8899-aabbccddeeff");
  });
});
