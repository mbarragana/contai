/**
 * Erro comum a todos os caminhos de extração (CONTAI-052). Saiu de `gemini.ts`
 * para módulo neutro quando a Groq entrou: dois provedores em dois estágios
 * diferentes (texto e visão) lançam o mesmo erro, e nenhum deles deve importar
 * o outro só para pegar a classe.
 */

export class ExtracaoIndisponivelError extends Error {
  /**
   * Quantas chamadas ao provedor foram feitas até desistir. Existe para a rota
   * logar isso na Vercel — 1 tentativa e 3 tentativas com o mesmo 503 contam
   * histórias diferentes (blip vs. indisponibilidade de verdade).
   */
  readonly tentativas: number;

  constructor(mensagem: string, tentativas = 1) {
    super(mensagem);
    this.tentativas = tentativas;
  }
}
