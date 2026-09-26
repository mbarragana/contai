"use client";

/**
 * A NOTA DE ORIGEM de um desembolso — os dois blocos que aparecem em TODA tela
 * de captura que nasce a partir de uma nota já registrada.
 *
 * Extraído em CONTAI-064, critério 8: até aqui os dois blocos viviam dentro de
 * `app/(captura)/adicionar/pagamento/page.tsx`, e a compra no cartão (que
 * passou a herdar favorecido/CNPJ/valor da nota) precisaria da SEGUNDA CÓPIA —
 * a mesma classe de defeito que produziu D40/D55 (código repetido diverge, e
 * quem diverge primeiro é o texto de consequência fiscal).
 *
 * Nada aqui é regra nova: é o mesmo JSX, com os mesmos textos, e o `voltarPara`
 * como único parâmetro novo de interface.
 */

import { ErroCampo, Rotulo } from "@/app/_components/campos";
import { Botao, BotaoLink, Card } from "@/app/_components/ui";
import { carregarPainel } from "@/lib/data";
import { NOME_TIPO_CURTO } from "@/lib/fiscal/resumo";
import { alocarCusto, saldoDescobertoDaNota } from "@/lib/fiscal/vinculo";
import { centavosParaInput, formatarBRL } from "@/lib/money";
import type { Documento } from "@/lib/types";

/**
 * De onde saiu o número do campo Valor. Rótulo curto e literal — o campo
 * preenchido pelo app sem dizer a origem lê como algo já conferido, e não foi.
 */
const ROTULO_VALOR_DA_NOTA = "valor da nota";
const ROTULO_FALTA_DA_NOTA = "falta desta nota";

/**
 * O valor que veio da nota, guardado para a tela poder DIZER de onde ele saiu.
 */
export interface SugestaoValor {
  texto: string;
  rotulo: string;
}

/**
 * O VALOR também vem da nota, e vem como SALDO — o que ainda falta pagar dela,
 * nunca o valor cheio de novo (decisão do Mateus, 2026-08-18: a empreiteira
 * emite nota por medição, e o pagamento costuma bater com ela).
 *
 * Quem calcula é `saldoDescobertoDaNota`, LEITURA da mesma alocação que produz
 * o número da home — não existe segunda conta de "quanto falta nesta nota".
 * Repetir o valor cheio na segunda parcela dobraria o custo, que é a única
 * direção de erro que gera passivo tributário (parecer §4).
 *
 * `null` = não sugere nada, e o campo continua vazio perguntando: nota sem
 * valor, não hábil, já coberta por inteiro, ou painel que não carregou — o
 * valor é digitável, e o registro do dispêndio não pode depender dele.
 */
export async function sugerirValorDaNota(
  nota: Documento,
): Promise<SugestaoValor | null> {
  try {
    // O painel é o da obra DA NOTA: o saldo dela sai dos pagamentos já ligados
    // a ela, e nada soma entre obras.
    const painel = await carregarPainel(nota.obraId);
    const saldo = saldoDescobertoDaNota(nota, alocarCusto(painel));
    if (saldo === null) return null;
    return {
      texto: centavosParaInput(saldo),
      rotulo:
        saldo === nota.valorCentavos
          ? ROTULO_VALOR_DA_NOTA
          : ROTULO_FALTA_DA_NOTA,
    };
  } catch {
    return null;
  }
}

/**
 * A ajuda só aparece enquanto o campo continua com o número da nota: no
 * instante em que o Mateus digita outro, o texto some — rótulo que sobrevive à
 * edição vira mentira sobre a origem do número.
 */
export function ajudaDoValorDaNota(
  sugestao: SugestaoValor | null,
  valor: string,
): string | undefined {
  return sugestao && valor === sugestao.texto
    ? `Vem da nota — ${sugestao.rotulo}. Dá para trocar.`
    : undefined;
}

/**
 * Para onde o "Corrigir na nota" devolve o Mateus depois de corrigir o nome do
 * emitente. Era `"pagamento"` fixo no código até o CONTAI-064; quem lê este
 * valor é `app/(gestao)/documento/[id]/corrigir/emitente/page.tsx` (`?voltar=`).
 *
 * ⚠️ Toda opção nova aqui precisa de par LÁ, no mesmo diff: sem isso o botão
 * final da correção devolve o Mateus para a tela errada, em silêncio — o que
 * aconteceu de verdade com a compra no cartão, que caía em
 * `/adicionar/pagamento` vazio e trocava o meio de pagamento sem avisar.
 */
export type VoltarPara = "pagamento" | "compra-cartao";

/**
 * "Ligado a: [favorecido] · [valor]" + o desfazer.
 *
 * Mock s3b — o vínculo é afirmado na tela e desfazível ANTES de salvar: ninguém
 * liga por engano o desembolso à nota errada.
 */
export function LigadoANota({
  nota,
  onDesfazer,
}: {
  nota: Documento;
  onDesfazer: () => void;
}) {
  return (
    <Card>
      <div className="text-[13px]">
        <strong>Ligado a:</strong>{" "}
        {nota.favorecidoNome ?? "documento sem emitente"} ·{" "}
        <span className="mono">{formatarBRL(nota.valorCentavos ?? 0)}</span>
      </div>
      <div className="mt-2">
        <Botao variante="ghost" onClick={onDesfazer}>
          Desfazer o vínculo antes de salvar
        </Botao>
      </div>
    </Card>
  );
}

/**
 * Favorecido e CNPJ/CPF do desembolso que NASCE LIGADO a uma nota: herdados,
 * sem campo de edição.
 *
 * Adendo de 2026-08-18 do parecer
 * `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md`, §1 e §4:
 *
 *   Fiscalmente, o par que sustenta custo é `documento hábil ↔ desembolso
 *   correspondente`. Quem recebe o dinheiro não é um terceiro grau de
 *   liberdade: é atributo do documento. [...] O produto não deve oferecer o
 *   campo.
 *
 * O campo editável não era só o caminho do bug (typo criando favorecido
 * duplicado, ou renomeando o antigo): é um campo que fiscalmente não existe.
 * O VALOR continua editável — é o único dos três que diverge legitimamente,
 * porque a nota se paga em parcelas.
 *
 * ⚠️ Impasse com saída, nunca bloqueio total (§4, item 4: "impasse sem saída
 * ensina o usuário a inventar dado no campo que sobrou"). São duas: corrigir
 * na nota, e o "Desfazer o vínculo antes de salvar" do `LigadoANota` logo
 * acima — sem vínculo, o desembolso é avulso e os campos voltam a ser
 * digitáveis.
 *
 * Os erros de validação aparecem AQUI: nota sem emitente identificado
 * reprovaria no "Salvar" com a mensagem sem lugar para aparecer, que é a
 * falha muda que este produto não aceita.
 */
export function FavorecidoHerdado({
  nota,
  nome,
  documento,
  erroNome,
  erroDocumento,
  voltarPara,
  temAlgoDigitado,
  onSairParaCorrigir,
}: {
  nota: Documento;
  nome: string;
  documento: string;
  erroNome?: string;
  erroDocumento?: string;
  voltarPara: VoltarPara;
  /**
   * Critério 17 do CONTAI-021: com o formulário pela metade, o link avisa antes
   * de sair.
   *
   * ⚠️ OS DOIS SÃO OPCIONAIS (CONTAI-064, §4 ponto 2). A tela de compra no
   * cartão **não replica** a confirmação de saída (`confirmandoSaida`) — está
   * no Fora de Escopo do ticket —, e sem `onSairParaCorrigir` o componente
   * renderiza sempre o `BotaoLink` direto, nunca um botão que abriria uma
   * confirmação que não existe.
   */
  temAlgoDigitado?: boolean;
  onSairParaCorrigir?: () => void;
}) {
  const daNota = `da ${NOME_TIPO_CURTO[nota.tipo]} de ${formatarBRL(nota.valorCentavos ?? 0)}`;
  return (
    // `group` com nome: dá ao bloco herdado uma identidade acessível — e é por
    // ela que o E2E distingue o que está AQUI do mesmo nome repetido no cartão
    // "Ligado a:" logo acima.
    <div
      role="group"
      aria-label="Favorecido da nota"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <Rotulo>Favorecido — {daNota}</Rotulo>
        <div className="text-[15px] font-semibold">
          {nome || "esta nota está sem emitente identificado"}
        </div>
        <ErroCampo mensagem={erroNome} />
      </div>
      <div className="flex flex-col gap-1">
        <Rotulo>CNPJ / CPF do favorecido — {daNota}</Rotulo>
        <div className="mono text-[15px]">
          {documento || "esta nota está sem CNPJ/CPF"}
        </div>
        <ErroCampo mensagem={erroDocumento} />
      </div>
      <p className="text-[12px] text-mut">
        Quem recebe o dinheiro é atributo da nota, não do pagamento. CNPJ/CPF
        errado não se edita: é outro favorecido — corrige-se o documento e
        refaz-se o vínculo.
      </p>
      <div>
        {/**
         * Critério 2 do CONTAI-021 — o link sai da CAIXA DO FAVORECIDO, então o
         * destino natural é a correção do NOME DO EMITENTE, não uma tela
         * genérica. De lá, quem descobre que o erro é outro tem saída para as
         * outras duas ações e para o texto do CNPJ.
         *
         * ⚠️ Até 19/08 ele levava a `/documento/[id]`, onde não existia
         * correção nenhuma: "o usuário clica em Corrigir na nota e chega numa
         * tela que não corrige" — a disciplina do critério 19 do CONTAI-018
         * (nenhuma tela promete comportamento que não existe) violada por um
         * botão. O `voltarPara` é a mesma disciplina do outro lado da viagem.
         */}
        {temAlgoDigitado && onSairParaCorrigir ? (
          <Botao variante="ghost" onClick={onSairParaCorrigir}>
            Corrigir na nota
          </Botao>
        ) : (
          <BotaoLink
            href={`/documento/${nota.id}/corrigir/emitente?voltar=${voltarPara}`}
          >
            Corrigir na nota
          </BotaoLink>
        )}
      </div>
    </div>
  );
}
