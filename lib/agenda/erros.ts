/**
 * **CONTAI-092 — as três famílias de falha da integração com o Google**, e a
 * separação entre elas é o critério 10 inteiro.
 *
 * ⚠️ Nenhuma delas é erro FISCAL. Nada aqui vira `pendencia`, nada aqui aparece
 * em relatório anual ou dossiê de venda (critério 9): são estados de integração
 * operacional. A mensagem que chega ao Mateus nunca diz nem sugere que o
 * compromisso está irregular (Gate Fiscal 7b).
 */

/**
 * Transitório: rede, timeout, 429 ou 5xx — já com as repetições esgotadas.
 * Carimba `ultimo_erro` em `compromisso_agenda` e nada mais; a próxima
 * reconciliação tenta de novo.
 */
export class AgendaIndisponivelError extends Error {
  constructor(
    mensagem: string,
    readonly tentativas: number,
  ) {
    super(mensagem);
    this.name = "AgendaIndisponivelError";
  }
}

/**
 * A credencial morreu: 401 da API, ou `invalid_grant` na troca do refresh token
 * (revogação pelo painel do Google, expiração por inatividade). É a ÚNICA falha
 * que marca `integracao_google.revogado_em` e para de chamar o Google até nova
 * autorização — critério 6, pre-mortem 1 do ticket ("falha de token é silenciosa
 * por natureza").
 *
 * Nunca tem retry: repetir com credencial morta devolve o mesmo 401 e esconde do
 * Mateus que os lembretes pararam.
 */
export class AutorizacaoRevogadaError extends Error {
  constructor(readonly motivo: string) {
    super(`Autorização do Google Agenda inválida: ${motivo}`);
    this.name = "AutorizacaoRevogadaError";
  }
}

/**
 * 4xx de configuração/pedido (400, 403, 404 onde 404 não é "já removido"…) com
 * token ainda válido. **Sem retry** (critério 10): repetir devolve o mesmo erro
 * e só queima cota. Fica em `ultimo_erro` para aparecer no detalhe do
 * compromisso com a ação "tentar de novo", que é o único caminho em que uma nova
 * tentativa faz sentido — depois de alguém arrumar a configuração.
 */
export class AgendaRecusouError extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
  ) {
    super(mensagem);
    this.name = "AgendaRecusouError";
  }
}
