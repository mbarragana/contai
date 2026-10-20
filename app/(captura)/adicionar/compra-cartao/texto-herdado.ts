/**
 * O TEXTO que viaja de `/adicionar/compra-cartao` para a rota irmã
 * `/adicionar/compra-cartao/parcelas` — e **nada além de texto** (CONTAI-089).
 *
 * ⚠️ **Por que o transporte deste módulo é texto, e só texto** (CONTAI-089,
 * critério 7): o que entra num campo pré-preenchido é dígito que o Mateus
 * digitaria olhando a mesma nota — não é vínculo, e não deve poder virar um por
 * descuido de refator.
 *
 * ⚠️ **REESCRITO pelo CONTAI-100, e o contrato deste módulo NÃO mudou.** Até
 * aquele ticket, a frase acima terminava afirmando que *"a rota do lote nunca
 * recebe id de nota nenhuma, então não existe id para vazar até
 * `compra_cartao_gravar_lote`"* — garantia estrutural que o CONTAI-100 derrubou
 * de propósito: o lote passou a receber `?documento=<id>` para PRÉ-vincular as
 * N parcelas (ADENDO 6 §J.1 — intenção, nunca custo). O que continua valendo:
 *
 *   * **o id viaja por FORA deste módulo**, numa chave própria
 *     (`PARAM_DOCUMENTO`, declarada nas duas telas) que `montarQueryTextoHerdado`
 *     não escreve e `lerTextoHerdado` não lê. As três chaves abaixo continuam
 *     sendo as únicas deste contrato, e o retorno continua sendo string pura;
 *   * **`documento_origem_id` continua proibido no lote** (ADENDO 9 §M): a RPC
 *     nunca aceitou o parâmetro e continua não aceitando. O que ela ganhou se
 *     chama `p_documento_previsto_id` — `previsto`, nunca `origem`.
 *
 * Quem acrescentar id a ESTE módulo está misturando as duas coisas de novo:
 * texto pré-preenche campo e é congelado na montagem; o id decide um vínculo e
 * tem de ser lido a cada render (critério 5 do CONTAI-100).
 *
 * ⚠️ **Este módulo não tem par em `lib/`, de propósito** (critério 8): ele é
 * mecanismo de duas telas, e `lib/` é onde moram as regras fiscais. Quem o
 * importar de `lib/` está transformando "pré-preencher campo" em dependência de
 * regra, que é o primeiro passo para a confusão que o ticket inteiro recusa.
 *
 * Os três são **texto cru, do jeito que a tela de origem mostra**: nome como
 * está no campo, documento FORMATADO (`formatarDocumento`, não só dígitos — a
 * máscara é o que o Mateus lê e confere) e valor em texto decimal pt-BR
 * (`centavosParaInput`), que volta por `parseValorInput` sem perda.
 */

/** As três chaves DESTE contrato. Nenhuma delas é id de nada. */
export const PARAM_NOME = "favorecidoNome";
export const PARAM_DOCUMENTO = "favorecidoDocumento";
export const PARAM_VALOR = "valorTotal";

export interface TextoHerdado {
  nome: string;
  documento: string;
  /** Texto decimal pt-BR. **É o SALDO da nota**, nunca o valor de face. */
  valor: string;
}

/**
 * O que entra na URL de destino. **Chave de valor vazio não entra** — nota sem
 * emitente não manda `favorecidoNome=`, e nota sem saldo sugerível
 * (`sugerirValorDaNota` → `null`) não manda `valorTotal=`: o campo chega vazio
 * PERGUNTANDO, que é o comportamento certo, e não "preenchido com nada".
 *
 * Chamado **só** em `compra-cartao/page.tsx` (critério 8).
 */
export function montarQueryTextoHerdado({
  nome,
  documento,
  valor,
}: TextoHerdado): Record<string, string> {
  const query: Record<string, string> = {};
  const incluir = (chave: string, texto: string) => {
    const limpo = texto.trim();
    if (limpo !== "") query[chave] = limpo;
  };
  incluir(PARAM_NOME, nome);
  incluir(PARAM_DOCUMENTO, documento);
  incluir(PARAM_VALOR, valor);
  return query;
}

/**
 * A leitura de TEXTO da query string de `/adicionar/compra-cartao/parcelas`, e o
 * retorno é string pura — consumido exclusivamente como valor inicial de
 * `useState` (CONTAI-089, critério 8). Ausente vira `""`: o campo nasce vazio,
 * igual ao acesso direto de hoje.
 *
 * ⚠️ Era "a ÚNICA leitura de query string" daquela rota até o CONTAI-100, que
 * acrescentou a leitura **reativa** do `?documento=` — fora deste módulo, e com
 * disciplina oposta (a cada render, nunca congelada).
 */
export function lerTextoHerdado(params: URLSearchParams): TextoHerdado {
  return {
    nome: params.get(PARAM_NOME) ?? "",
    documento: params.get(PARAM_DOCUMENTO) ?? "",
    valor: params.get(PARAM_VALOR) ?? "",
  };
}
