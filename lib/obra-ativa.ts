"use client";

/**
 * Onde dorme a preferência de "qual obra está aberta" — e só isso.
 *
 * A preferência NÃO é fonte do `obra_id` gravado: no instante do salvar, o que
 * vale é a obra afirmada na tela (critério 7). Aqui é conveniência de
 * navegação, para não cobrar pedágio de lista a cada abertura do app.
 *
 * Por isso o aparelho basta: se a preferência sumir (celular novo, storage
 * limpo, PWA reinstalado), o app cai na lista e não escolhe nada por conta
 * própria (critério 6). Uma preferência errada persistida no servidor erraria
 * com a mesma elegância — o que protege é o requisito, não a caixa.
 */

export const CHAVE_OBRA_ATIVA = "contai-obra-ativa";

function armazenamento(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Safari em navegação privada e afins: sem preferência o app abre a lista,
    // que é o comportamento seguro.
    return null;
  }
}

export function lerObraPreferida(): string | null {
  const id = armazenamento()?.getItem(CHAVE_OBRA_ATIVA);
  return id && id.trim() !== "" ? id : null;
}

export function gravarObraPreferida(id: string): void {
  armazenamento()?.setItem(CHAVE_OBRA_ATIVA, id);
}

export function limparObraPreferida(): void {
  armazenamento()?.removeItem(CHAVE_OBRA_ATIVA);
}
