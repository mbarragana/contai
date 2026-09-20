import { describe, expect, it } from "vitest";

import { paraCentavos } from "@/lib/extracao/schema";

describe("paraCentavos", () => {
  it("converte reais em centavos, arredondando", () => {
    expect(paraCentavos(1234.56)).toBe(123_456);
    expect(paraCentavos(0.1)).toBe(10);
  });

  it("null vira null — nunca zero (zero é afirmação de valor)", () => {
    expect(paraCentavos(null)).toBeNull();
  });

  it("não-finito (NaN/Infinity) vira null — proteção contra resposta esquisita do provedor", () => {
    expect(paraCentavos(Number.NaN)).toBeNull();
    expect(paraCentavos(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
