/**
 * O TEXTO que viaja de `/adicionar/compra-cartao` para a rota irmã
 * `/adicionar/compra-cartao/parcelas` — e **nada além de texto** (CONTAI-089).
 *
 * ⚠️ **Por que o transporte é texto, e não o id do documento** (critério 7): a
 * rota do lote nunca recebe id de nota nenhuma, então não existe id para vazar
 * até `compra_cartao_gravar_lote` por descuido de refator. "Herdar texto, não
 * vínculo" deixa de ser disciplina de quem chama e passa a ser fato do
 * transporte — a mitigação do Pre-mortem 1 (o padrão do incidente P0 do
 * CONTAI-083, que em lote escalaria para 24 parcelas numa ação só).
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

/** As três chaves da query string. Nenhuma delas é id de nada. */
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
 * A ÚNICA leitura de query string de `/adicionar/compra-cartao/parcelas`, e o
 * retorno é string pura — consumido exclusivamente como valor inicial de
 * `useState` (critério 8). Ausente vira `""`: o campo nasce vazio, igual ao
 * acesso direto de hoje.
 */
export function lerTextoHerdado(params: URLSearchParams): TextoHerdado {
  return {
    nome: params.get(PARAM_NOME) ?? "",
    documento: params.get(PARAM_DOCUMENTO) ?? "",
    valor: params.get(PARAM_VALOR) ?? "",
  };
}
