/**
 * CPF/CNPJ do favorecido. Não é regra fiscal — é validação de entrada: um
 * CNPJ digitado errado no canteiro só aparece como problema no relatório
 * anual (e um CPF errado inviabiliza a ficha Pagamentos Efetuados).
 */

import type { TipoFavorecido } from "@/lib/types";

export function soDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

function digitosIguais(digitos: string): boolean {
  return /^(\d)\1+$/.test(digitos);
}

export function validarCpf(entrada: string): boolean {
  const d = soDigitos(entrada);
  if (d.length !== 11 || digitosIguais(d)) return false;

  for (const [tamanho, posicao] of [
    [9, 10],
    [10, 11],
  ] as const) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (posicao - i);
    const resto = (soma * 10) % 11;
    const dv = resto === 10 || resto === 11 ? 0 : resto;
    if (dv !== Number(d[tamanho])) return false;
  }
  return true;
}

export function validarCnpj(entrada: string): boolean {
  const d = soDigitos(entrada);
  if (d.length !== 14 || digitosIguais(d)) return false;

  const pesos12 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos13 = [6, ...pesos12];

  for (const pesos of [pesos12, pesos13]) {
    let soma = 0;
    for (let i = 0; i < pesos.length; i++) soma += Number(d[i]) * pesos[i];
    const resto = soma % 11;
    const dv = resto < 2 ? 0 : 11 - resto;
    if (dv !== Number(d[pesos.length])) return false;
  }
  return true;
}

/** 11 dígitos válidos = PF; 14 dígitos válidos = PJ; qualquer outra coisa = null. */
export function tipoPorDocumento(entrada: string): TipoFavorecido | null {
  const d = soDigitos(entrada);
  if (d.length === 11) return validarCpf(d) ? "pf" : null;
  if (d.length === 14) return validarCnpj(d) ? "pj" : null;
  return null;
}

export function formatarDocumento(entrada: string): string {
  const d = soDigitos(entrada);
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return entrada;
}
