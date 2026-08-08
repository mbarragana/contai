/**
 * Dinheiro em centavos (inteiro). Valor fiscal não pode acumular erro de
 * ponto flutuante: a soma do ano vai para a declaração.
 */

const FORMATADOR = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** numeric(14,2) do PostgREST ("4850.00") → centavos. */
export function numericParaCentavos(valor: string | null): number | null {
  if (valor === null || valor.trim() === "") return null;
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** centavos → string aceita por numeric(14,2) ("4850.00"). */
export function centavosParaNumeric(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

export function formatarBRL(centavos: number): string {
  return FORMATADOR.format(centavos / 100);
}

/**
 * Entrada digitada no celular ("4850", "4.850,00", "4850.00") → centavos.
 * `null` = não dá para interpretar; o formulário trata como erro, nunca
 * assume zero.
 */
export function parseValorInput(texto: string): number | null {
  const limpo = texto.trim().replace(/\s|R\$/g, "");
  if (limpo === "") return null;

  let normalizado: string;
  if (limpo.includes(",")) {
    // pt-BR: vírgula é decimal, ponto é separador de milhar.
    if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+,\d{1,2}$/.test(limpo)) return null;
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
    // "4.850" — grupos de 3 dígitos: ponto é milhar, não decimal.
    normalizado = limpo.replace(/\./g, "");
  } else if (/^\d+(\.\d{1,2})?$/.test(limpo)) {
    normalizado = limpo;
  } else {
    return null;
  }

  const n = Number(normalizado);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
