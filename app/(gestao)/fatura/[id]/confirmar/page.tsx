"use client";

/**
 * CONFIRMAR FATURA PAGA — INTEGRAL (CONTAI-022, mock s4/s5, critérios 6-8,
 * 10, 13).
 *
 * ⚠️ "Um anexo por pagamento" não fecha aqui: a compra no cartão não tem
 * comprovante e nunca terá — quem tem é a fatura. `comprovantePath` é
 * COPIADO para os N pagamentos gerados (ADENDO 2 §5) — denormalização
 * deliberada, não bug (path nunca muda, storage append-only).
 *
 * Cada compra vira UM pagamento, na mesma data (a da fatura), com o
 * favorecido/valor/classificação DELA — nunca um pagamento único pela
 * fatura (ADENDO §B(b), literal).
 *
 * ⚠️ **CONTAI-067 — DOIS arquivos aqui, com funções diferentes.** O
 * *comprovante* prova a **saída de caixa**; o *extrato* da administradora prova a
 * **composição** (quais compras estavam dentro da fatura), que é o elo que decide
 * o ano-calendário do gasto e que nenhum documento capturado até o 067 sustentava
 * (parecer de 2026-09-26, ADENDO). Os dois são opcionais e **nenhum dos dois
 * bloqueia "Confirmar pagamento"** — o valor pago é fato consumado, nunca
 * recusado; a ausência do extrato vira pendência VERMELHA, nunca um silêncio.
 */

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ListaDeAnexos } from "@/app/_components/anexo";
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
  Dica,
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
import {
  compromissosAbertosDaFatura,
  EXTRATO_DA_FATURA_AJUDA,
  EXTRATO_DA_FATURA_ROTULO,
} from "@/lib/fiscal/fatura";
import { ROTULO_DO_PAPEL } from "@/lib/fiscal/terreno";
import { ehDataValida } from "@/lib/fiscal/pagamento";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { formatarBRL } from "@/lib/money";
import type { Compromisso, Fatura } from "@/lib/types";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | { fase: "pronto"; fatura: Fatura; abertas: Compromisso[] }
  | { fase: "salvando"; fatura: Fatura; abertas: Compromisso[] }
  | {
      fase: "salvo";
      abertas: Compromisso[];
      dataPagamento: string;
      /**
       * Qual dos dois papéis foi anexado — só para a frase extra da `Dica` final,
       * nunca um fato fiscal novo.
       *
       * ⚠️ **Os DOIS, separados, e não um `comAlgumAnexo` booleano** (Gate 2,
       * `cto-obra`, 2026-09-26): os dois documentos **não têm o mesmo grão**, e
       * uma frase só para os dois igualava o que a RPC faz com cada um. Só o
       * comprovante é COPIADO para cada um dos N `pagamento` gerados (0013 §3); o
       * extrato fica em `fatura` e cobre o CICLO, sem ser replicado por pagamento.
       */
      anexados: { comprovante: boolean; extrato: boolean };
    };

export default function ConfirmarFaturaIntegral() {
  const { id } = useParams<{ id: string }>();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [dataPagamento, setDataPagamento] = useState("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  /**
   * CONTAI-067 — estado local PRÓPRIO, sem relação de dependência com o
   * comprovante: pode-se anexar só um, os dois ou nenhum.
   */
  const [extrato, setExtrato] = useState<File | null>(null);
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
        <CabecalhoDaTela titulo="Fatura paga · integral" />
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

  if (estado.fase === "salvo") {
    return (
      <>
        <CabecalhoDaTela
          titulo={`${estado.abertas.length} ${estado.abertas.length === 1 ? "pagamento gerado" : "pagamentos gerados"}`}
          sub={`fatura paga em ${formatarDataBR(estado.dataPagamento)}`}
        />
        <ColunaDeDetalhe>
          <Banner cor="grn" role="status">
            <strong>Salvo.</strong> As {estado.abertas.length}{" "}
            {estado.abertas.length === 1 ? "compra virou" : "compras viraram"}{" "}
            pagamento, cada uma na data em que a fatura foi paga.
          </Banner>
          <Card>
            {estado.abertas.map((c) => (
              <div
                key={c.id}
                className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2 first:mt-0 first:border-t-0 first:pt-0"
              >
                <span className="text-[13px]">
                  <strong>{c.favorecidoNome ?? "favorecido não informado"}</strong>
                  <br />
                  <span className="text-mut">
                    pago em {formatarDataBR(estado.dataPagamento)}
                  </span>
                </span>
                <span className="mono">{formatarBRL(c.valorPrevistoCentavos)}</span>
              </div>
            ))}
          </Card>
          <Dica>
            Juros de rotativo, juros de parcelamento, IOF, anuidade e multa
            ficam fora do custo — a mesma separação principal × encargos de
            sempre.
            {/*
              CONTAI-067 — uma frase a mais, e só sobre o que foi de fato anexado.

              ⚠️ **Uma cláusula por documento, porque o GRÃO é diferente** (Gate 2,
              `cto-obra`): o comprovante é copiado para cada um dos N `pagamento`
              gerados (é o `comprovante_path` que a RPC replica), e o extrato fica
              em `fatura`, cobrindo o ciclo inteiro — não é replicado por
              pagamento. Uma frase só para os dois dizia que fazem a mesma coisa.
            */}
            {estado.anexados.comprovante ? (
              <>
                {" "}
                O comprovante vale para{" "}
                {estado.abertas.length === 1
                  ? "o pagamento gerado"
                  : `os ${estado.abertas.length} pagamentos gerados`}
                .
              </>
            ) : null}
            {estado.anexados.extrato ? (
              <> O extrato fica na fatura e cobre o ciclo inteiro.</>
            ) : null}
          </Dica>
        </ColunaDeDetalhe>
      </>
    );
  }

  const { fatura, abertas } = estado;
  const total = abertas.reduce((s, c) => s + c.valorPrevistoCentavos, 0);
  const podeSalvar = dataPagamento !== "" && ehDataValida(dataPagamento);

  async function salvar() {
    if (!podeSalvar || estado.fase !== "pronto") return;
    setErro(null);
    setEstado({ fase: "salvando", fatura, abertas });
    try {
      /**
       * ⚠️ **CONTAI-067, critério 3 — os dois sobem ANTES da RPC, e a gravação é
       * UMA.** Falha em qualquer subida não grava nada: nem o desembolso, nem o
       * comprovante, nem o extrato. Dois passos separados deixariam, numa falha
       * parcial, o desembolso gravado com o arquivo perdido — e o arquivo já saiu
       * da tela, não há como pedi-lo de novo.
       */
      const comprovantePath = comprovante
        ? await subirParaAcervo(comprovante, "comprovante")
        : null;
      const extratoPath = extrato
        ? await subirParaAcervo(extrato, "extrato")
        : null;
      await registrarDesembolsoDeFatura({
        faturaId: fatura.id,
        valorCentavos: total,
        dataPagamento,
        comprovantePath,
        compromissoIds: abertas.map((c) => c.id),
        extratoPath,
      });
      setEstado({
        fase: "salvo",
        abertas,
        dataPagamento,
        anexados: {
          comprovante: comprovantePath !== null,
          extrato: extratoPath !== null,
        },
      });
    } catch (e) {
      setEstado({ fase: "pronto", fatura, abertas });
      setErro(mensagemDeErroDeGravacao(e, "na fatura, se o pagamento já aparece lançado"));
    }
  }

  return (
    <>
      <CabecalhoDaTela
        titulo="Fatura paga · integral"
        sub={`${abertas.length} ${abertas.length === 1 ? "compra" : "compras"} · um comprovante para todas`}
      />
      <ColunaDeDetalhe>
        {erro ? (
          <Banner cor="red" role="alert">
            {erro}
          </Banner>
        ) : null}

        <Banner cor="amb" role="status">
          <strong>Aqui &quot;um anexo por pagamento&quot; não fecha</strong> —
          a compra no cartão não tem comprovante e nunca terá; quem tem é a
          fatura.
        </Banner>

        <Card>
          <CampoTexto
            rotulo="Data em que a fatura foi paga"
            tipo="date"
            valor={dataPagamento}
            onChange={setDataPagamento}
            ajuda={`Vira a data de cada um dos ${abertas.length} pagamentos abaixo.`}
          />
          <CampoArquivo
            rotulo="Comprovante da fatura"
            ajuda="Compartilhado pelos pagamentos gerados — um documento para N."
            accept=".pdf,image/*"
            arquivo={comprovante}
            onChange={setComprovante}
          />
          {/*
            CONTAI-067 — o SEGUNDO arquivo, empilhado abaixo do comprovante (a
            ordem é do critério 2, e o comprovante não se reordena).

            ⚠️ O parêntese **"(emitido pelo cartão)"** no rótulo é a guarda do
            pre-mortem 1 do ticket: ele diz de quem é o documento, e é isso que
            impede o Mateus de anexar o comprovante no campo do extrato. Nunca
            "Anexo 1"/"Anexo 2".

            ⚠️ Quando o extrato JÁ existe (fatura em rotativo cujo extrato foi
            anexado em `/fatura/[id]` antes desta confirmação), o campo **não
            aparece**: no lugar dele, a linha de leitura com link ao acervo. Não é
            um banner de bloqueio como o guard de `/pagamento/[id]/comprovante` —
            ali a tela inteira é sobre um documento, aqui é um dos dois campos, e
            o resto da confirmação segue normal.
          */}
          {fatura.extratoPath === null ? (
            <CampoArquivo
              rotulo={EXTRATO_DA_FATURA_ROTULO}
              ajuda={EXTRATO_DA_FATURA_AJUDA}
              accept=".pdf,image/*"
              arquivo={extrato}
              onChange={setExtrato}
            />
          ) : (
            <ListaDeAnexos
              titulo={EXTRATO_DA_FATURA_ROTULO}
              itens={[
                { path: fatura.extratoPath, papel: ROTULO_DO_PAPEL.extrato },
              ]}
            />
          )}
        </Card>

        <Card>
          <div className="text-[11px] uppercase tracking-wide text-mut">
            Vai criar {abertas.length}{" "}
            {abertas.length === 1 ? "pagamento" : "pagamentos"} — um por
            compra, nunca um pela fatura
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
          <Dica>
            Cada um com seu favorecido, sua nota e sua classificação material
            × serviço.
          </Dica>
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
            : `Confirmar pagamento — ${abertas.length} ${abertas.length === 1 ? "pagamento" : "pagamentos"}`}
        </BotaoSalvar>
        <BotaoLink href={`/fatura/${fatura.id}`}>Voltar sem salvar</BotaoLink>
      </RodapeDeAcao>
    </>
  );
}
