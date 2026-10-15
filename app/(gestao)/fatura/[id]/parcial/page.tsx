"use client";

/**
 * FATURA PAGA · PARCIAL — o rotativo (CONTAI-022, mock s6, critério 9).
 *
 * ⚠️ **O valor pago é gravado SEMPRE** — fato consumado, nunca recusado
 * (ADENDO §B). O que muda é que nenhuma compra é confirmada sozinha: a
 * próxima tela (alocação manual) é onde o Mateus escolhe quais.
 *
 * ⚠️ **CONTAI-097 — o comprovante OPCIONAL deste desembolso (D56-b, ponta A).**
 * Um desembolso parcial do rotativo gera N `pagamento`s a favorecidos
 * diferentes, e o PIX/transferência que o cobriu é UM arquivo só. Quem o anexa
 * aqui o anexa uma vez: as RPCs `fatura_desembolso_gravar` e `fatura_alocar`
 * (0024) COPIAM o `comprovante_path` do desembolso para cada `pagamento` que
 * geram — a mesma denormalização deliberada já em produção no caminho
 * "fatura paga integral", não bug (path nunca muda, storage append-only).
 * O campo é opcional e NUNCA entra no `podeSalvar`: sem arquivo, o payload é o
 * de antes deste ticket (`comprovantePath: null`), e cada `pagamento` segue
 * elegível ao comprovante tardio de `/pagamento/[id]/comprovante` (CONTAI-061).
 */

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CampoArquivo, CampoTexto } from "@/app/_components/campos";
import {
  CabecalhoDaTela,
  ColunaDeDetalhe,
  RodapeDeAcao,
} from "@/app/_components/detalhe";
import {
  Banner,
  BotaoLink,
  BotaoSalvar,
  Card,
  Carregando,
  EstadoErro,
} from "@/app/_components/ui";
import {
  carregarCompromissos,
  carregarFatura,
  classificarErro,
  mensagemDeErroDeGravacao,
  registrarDesembolsoDeFatura,
  subirParaAcervo,
  type ErroDeTela,
} from "@/lib/data";
import { compromissosAbertosDaFatura } from "@/lib/fiscal/fatura";
import { ehDataValida } from "@/lib/fiscal/pagamento";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { formatarBRL, parseValorInput } from "@/lib/money";
import type { Compromisso, Fatura } from "@/lib/types";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | { fase: "pronto"; fatura: Fatura; abertas: Compromisso[] }
  | { fase: "salvando"; fatura: Fatura; abertas: Compromisso[] };

export default function RegistrarValorPagoParcial() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [data, setData] = useState("");
  const [valor, setValor] = useState("");
  /**
   * CONTAI-097 — fora do `Estado` de propósito: a volta de `"salvando"` para
   * `"pronto"` numa falha de gravação não pode perder o arquivo escolhido
   * (critério 6). Arquivo que a tela esquece é arquivo que o Mateus procura de
   * novo no celular.
   */
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const fatura = await carregarFatura(id);
        const todos = await carregarCompromissos(fatura.obraId);
        if (cancelado) return;
        setEstado({
          fase: "pronto",
          fatura,
          abertas: compromissosAbertosDaFatura(fatura, todos),
        });
      } catch (e) {
        if (!cancelado) setEstado({ fase: "erro", erro: classificarErro(e) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id]);

  if (estado.fase === "carregando" || estado.fase === "erro") {
    return (
      <>
        <CabecalhoDaTela titulo="Fatura paga · parcial" />
        <ColunaDeDetalhe>
          {estado.fase === "carregando" ? (
            <Carregando rotulo="Carregando a fatura" />
          ) : (
            <EstadoErro erro={estado.erro} />
          )}
        </ColunaDeDetalhe>
      </>
    );
  }

  const { fatura, abertas } = estado;
  const totalPrevisto = abertas.reduce((s, c) => s + c.valorPrevistoCentavos, 0);
  const valorCentavos = parseValorInput(valor);
  const podeSalvar =
    data !== "" && ehDataValida(data) && valorCentavos !== null && valorCentavos > 0;

  async function salvar() {
    if (!podeSalvar || valorCentavos === null || estado.fase !== "pronto") return;
    setErro(null);
    setEstado({ fase: "salvando", fatura, abertas });
    try {
      /**
       * ⚠️ **CONTAI-097, critério 3 — a subida vem ANTES da RPC, e a gravação é
       * UMA.** Falha ao subir não grava desembolso nenhum: ou os dois
       * aconteceram, ou nenhum (pre-mortem 3). O inverso deixaria o desembolso
       * gravado sem o anexo, e o arquivo já saiu da tela.
       */
      const comprovantePath = comprovante
        ? await subirParaAcervo(comprovante, "comprovante")
        : null;
      // Sem alocação neste ato (crit. 9) — array vazio. A tela seguinte
      // pergunta quais compras este valor cobriu.
      const desembolsoId = await registrarDesembolsoDeFatura({
        faturaId: fatura.id,
        valorCentavos,
        dataPagamento: data,
        // CONTAI-097 — `null` quando não há arquivo: o payload de antes deste
        // ticket, byte a byte (critério 5). Quando há, a RPC o copia para cada
        // `pagamento` que esta alocação gerar.
        comprovantePath,
        compromissoIds: [],
        // ⚠️ **CONTAI-081, critério 8 — vazio, e não "omitido"**: esta tela não
        // quita compra nenhuma (`compromissoIds: []`), então não há origem a
        // propagar e não há N a contar. O parâmetro é obrigatório no TypeScript de
        // propósito (critério 5): quem grava desembolso tem de DIZER o que
        // autoriza, ainda que a resposta seja "nada". A decisão do que propagar é
        // tomada em `/fatura/[id]/alocar`, onde as compras são escolhidas.
        propagarOrigemIds: [],
      });
      router.push(`/fatura/${fatura.id}/alocar?desembolso=${desembolsoId}`);
    } catch (e) {
      setEstado({ fase: "pronto", fatura, abertas });
      setErro(mensagemDeErroDeGravacao(e, "na fatura, se o pagamento parcial já aparece lançado"));
    }
  }

  return (
    <>
      <CabecalhoDaTela
        titulo="Fatura paga · parcial"
        sub={`vence ${formatarDataBR(fatura.dataVencimento)} · rotativo`}
      />
      <ColunaDeDetalhe>
        {erro ? (
          <Banner cor="red" role="alert">
            {erro}
          </Banner>
        ) : null}

        <Banner cor="amb" role="status">
          <strong>O valor pago é gravado sempre</strong> — é fato consumado,
          nunca recusado. O que muda é que <strong>nenhuma compra é
          confirmada sozinha</strong>: na próxima tela você escolhe quais.
        </Banner>

        <Card>
          <div className="text-[11px] uppercase tracking-wide text-mut">
            Compras em aberto desta fatura
          </div>
          {abertas.map((c) => (
            <div
              key={c.id}
              className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2 first:mt-0 first:border-t-0 first:pt-0"
            >
              <span className="text-[13px]">{c.favorecidoNome ?? "favorecido não informado"}</span>
              <span className="mono">{formatarBRL(c.valorPrevistoCentavos)}</span>
            </div>
          ))}
          <div className="mt-2.5 flex justify-between border-t border-line pt-2 font-semibold">
            <span className="text-[12px] text-mut">Total previsto</span>
            <span className="mono">{formatarBRL(totalPrevisto)}</span>
          </div>
        </Card>

        <Card>
          <CampoTexto
            rotulo="Data em que você pagou"
            tipo="date"
            valor={data}
            onChange={setData}
          />
          <CampoTexto
            rotulo="Valor pago"
            valor={valor}
            onChange={setValor}
            inputMode="decimal"
            placeholder="0,00"
            ajuda={
              valorCentavos !== null && valorCentavos > 0 && valorCentavos < totalPrevisto
                ? `Pagou menos que o previsto de ${formatarBRL(totalPrevisto)} — é rotativo, não integral.`
                : undefined
            }
          />
          {/*
            CONTAI-097 — o TERCEIRO campo do mesmo formulário, dentro da Card de
            data/valor e depois do valor (spec `design/mocks/CONTAI-097.md`):
            não é um bloco temático próprio como os dois documentos de
            `/confirmar`, é o anexo do desembolso que acabou de ser descrito
            acima.

            ⚠️ Nenhuma pergunta fiscal aqui (critério 7): comprovante de
            pagamento não pergunta "nota no CPF?" nem retenção — mesmo
            tratamento de `/pagamento/[id]/comprovante` (CONTAI-061). Por ser
            documento probatório opcional, sua ausência não abre pendência nem
            viola "campo vazio pergunta, preenchido afirma": este campo não
            afirma fato fiscal nenhum.

            ⚠️ "Pode anexar depois, no detalhe do pagamento" é afirmação
            verdadeira hoje, não promessa: `/pagamento/[id]/comprovante` já
            cobre o comprovante tardio de qualquer pagamento, incluindo os que
            nascerem deste desembolso.
          */}
          <CampoArquivo
            rotulo="Comprovante deste pagamento (opcional)"
            ajuda="PDF, foto ou print — se você tiver à mão agora. Pode anexar depois, no detalhe do pagamento."
            accept=".pdf,image/*"
            arquivo={comprovante}
            onChange={setComprovante}
          />
        </Card>
      </ColunaDeDetalhe>
      <RodapeDeAcao>
        <BotaoSalvar
          ocupado={estado.fase === "salvando"}
          variante="primary"
          onClick={salvar}
          disabled={!podeSalvar || estado.fase === "salvando"}
        >
          {estado.fase === "salvando"
            ? "Salvando…"
            : valorCentavos !== null && valorCentavos > 0
              ? `Salvar pagamento — ${formatarBRL(valorCentavos)} registrado`
              : "Informe a data e o valor pago"}
        </BotaoSalvar>
        <BotaoLink href={`/fatura/${fatura.id}`}>Voltar sem salvar</BotaoLink>
      </RodapeDeAcao>
    </>
  );
}
