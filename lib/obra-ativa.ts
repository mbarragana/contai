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

/**
 * ⚠️ **CONTAI-040, critério 2 — trocar de obra troca o CONTEXTO INTEIRO.**
 *
 * O shell de gestão (`app/(gestao)/layout.tsx`) carrega obra, resumo, agenda e
 * a fila de pendências **uma vez**, e o layout de um route group NÃO é
 * remontado ao navegar entre as telas do grupo. Sem este aviso, escolher outra
 * obra em `/obras` — que é uma tela do próprio grupo — deixaria a sidebar, o
 * badge e os KPIs mostrando a obra ANTERIOR até um recarregamento manual.
 * Número fiscal atribuído à obra errada é o defeito mais caro do produto.
 *
 * `Event` do `window` e não estado do React: quem grava a preferência é uma
 * função pura chamada de telas diferentes, e o provedor é quem escuta.
 */
export const EVENTO_OBRA_ATIVA = "contai:obra-ativa";

function avisar(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENTO_OBRA_ATIVA));
  }
}

export function gravarObraPreferida(id: string): void {
  armazenamento()?.setItem(CHAVE_OBRA_ATIVA, id);
  avisar();
}

export function limparObraPreferida(): void {
  armazenamento()?.removeItem(CHAVE_OBRA_ATIVA);
  avisar();
}

/** Assina a troca de obra. Devolve a função que cancela a assinatura. */
export function observarObraPreferida(aoTrocar: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENTO_OBRA_ATIVA, aoTrocar);
  return () => window.removeEventListener(EVENTO_OBRA_ATIVA, aoTrocar);
}
