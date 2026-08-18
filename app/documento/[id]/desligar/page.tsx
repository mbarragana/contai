"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { useSessao } from "@/app/_components/sessao";
import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Consequencia,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
  Rodape,
} from "@/app/_components/ui";
import {
  apagarVinculo,
  carregarDocumento,
  carregarPainel,
  classificarErro,
  mensagemDeErro,
  type ErroDeTela,
} from "@/lib/data";
import { formatarDataBR } from "@/lib/fiscal/obra";
import {
  alocarCusto,
  alocarSimulando,
  custoComprovadoAteOAno,
  custoComprovadoDoAno,
  ehDocumentoHabil,
} from "@/lib/fiscal/vinculo";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import type { Documento, Pagamento } from "@/lib/types";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      documento: Documento;
      pagamento: Pagamento;
      ano: number;
      custoAntesCentavos: number;
      custoDepoisCentavos: number;
      /**
       * O acumulado da ficha Bens e Direitos. Sem ele, desligar um pagamento
       * de ANO ANTERIOR mostrava "R$ X → R$ X" — efeito zero aparente — e o
       * Mateus confirmaria achando que nada muda, quando o acumulado do imóvel
       * cai.
       */
      acumuladoAntesCentavos: number;
      acumuladoDepoisCentavos: number;
      /** Sobra documento hábil ligado a este pagamento depois de desligar? */
      seguemHabeis: boolean;
    };

/**
 * Desfazer o vínculo (critério 15, mock s9).
 *
 * Existe pela mesma razão que o GRANT de DELETE existe na migration 0006:
 * vínculo errado INFLA O CUSTO DE AQUISIÇÃO que vai para a declaração — o
 * único erro que o parecer §4 classifica como gerador de passivo tributário —
 * e correção que exige SQL é a dor D9 de volta.
 *
 * A confirmação diz o efeito no custo ANTES do toque. Sem isso, desligar é uma
 * aposta: o número muda depois, sozinho, e ninguém liga uma coisa à outra.
 */
function DesligarPagamento() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { pedirReautenticacao } = useSessao();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  // Ver a nota em `app/documento/[id]/page.tsx`: em navegação client-side o
  // `window.location` do primeiro render ainda não tem a query.
  const pagamentoId = useSearchParams().get("pagamento");

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        if (!pagamentoId) throw new Error("Pagamento não informado.");
        const documento = await carregarDocumento(id);
        const painel = await carregarPainel(documento.obraId);
        if (cancelado) return;

        const pagamento = painel.pagamentos.find((p) => p.id === pagamentoId);
        if (!pagamento) throw new Error("Pagamento não encontrado nesta obra.");

        const ano = Number(hojeIso().slice(0, 4));
        const antes = alocarCusto(painel);
        // O "depois" é calculado sobre a MESMA função que produz o número da
        // home: o valor prometido na confirmação é o valor que vai aparecer.
        const depois = alocarSimulando(painel, {
          remover: [{ pagamentoId, documentoId: id }],
        });

        const restantes = pagamento.documentoIds
          .filter((x) => x !== id)
          .map((x) => painel.documentos.find((doc) => doc.id === x))
          .filter((doc): doc is Documento => doc !== undefined);

        setEstado({
          fase: "pronto",
          documento,
          pagamento,
          ano,
          custoAntesCentavos: custoComprovadoDoAno(antes, ano),
          custoDepoisCentavos: custoComprovadoDoAno(depois, ano),
          acumuladoAntesCentavos: custoComprovadoAteOAno(antes, ano),
          acumuladoDepoisCentavos: custoComprovadoAteOAno(depois, ano),
          seguemHabeis: restantes.some(ehDocumentoHabil),
        });
      } catch (erro) {
        if (!cancelado) setEstado({ fase: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id, pagamentoId, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ fase: "carregando" });
    setErroSalvar(null);
    setTentativa((t) => t + 1);
  }, []);

  const pronto = estado.fase === "pronto" ? estado : null;
  const erroCarregar = estado.fase === "erro" ? estado.erro : null;

  async function desligar() {
    if (!pronto) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      await apagarVinculo(pronto.pagamento.id, id, pronto.seguemHabeis);
      router.push(`/documento/${id}`);
    } catch (erro) {
      setSalvando(false);
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroSalvar(mensagemDeErro(erro));
    }
  }

  if (!pronto) {
    return (
      <>
        <AppBar titulo="Desligar pagamento" />
        <Corpo>
          {erroCarregar ? (
            <EstadoErro erro={erroCarregar} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando o vínculo" />
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href={`/documento/${id}`}>Voltar ao documento</BotaoLink>
        </Rodape>
      </>
    );
  }

  const p = pronto.pagamento;

  return (
    <>
      <AppBar
        titulo="Desligar pagamento"
        sub={`${p.favorecidoNome ?? "favorecido não informado"} · ${formatarBRL(p.valorCentavos)} · ${formatarDataBR(p.dataPagamento)}`}
      />
      <Corpo>
        {erroSalvar ? (
          <Banner cor="red" role="alert">
            <strong>Não deu para desligar.</strong> {erroSalvar} O vínculo
            continua como estava.
          </Banner>
        ) : null}

        <Banner cor="red" role="alert">
          <strong>Antes de desligar, o que muda:</strong>
        </Banner>

        <Card>
          <Linha rotulo={`Custo confirmado ${pronto.ano}`}>
            <span className="mono">
              {formatarBRL(pronto.custoAntesCentavos)} →{" "}
              <span className="font-semibold text-red">
                {formatarBRL(pronto.custoDepoisCentavos)}
              </span>
            </span>
          </Linha>
          {/* Pagamento de ano anterior não move o número do ano corrente, mas
              move o acumulado do imóvel — sem esta linha o efeito pareceria
              zero e a confirmação viraria uma aposta. */}
          <Linha rotulo={`Acumulado até ${pronto.ano}`}>
            <span className="mono">
              {formatarBRL(pronto.acumuladoAntesCentavos)} →{" "}
              <span className="font-semibold text-red">
                {formatarBRL(pronto.acumuladoDepoisCentavos)}
              </span>
            </span>
          </Linha>
          <Linha rotulo="A nota">volta a ficar sem este pagamento ligado</Linha>
          <Linha rotulo="O pagamento">volta para &quot;pago sem nota&quot;</Linha>
        </Card>

        <Dica>
          Nada é apagado: a nota e o pagamento continuam registrados, com os
          arquivos no acervo. Só o vínculo entre os dois deixa de existir.
        </Dica>

        <Consequencia cor="red">
          Vínculo errado <strong>infla o custo de aquisição</strong>, que vai
          para a declaração — por isso desligar existe aqui, e não em SQL.
        </Consequencia>
      </Corpo>

      <Rodape>
        <Botao variante="primary" onClick={desligar} disabled={salvando}>
          {salvando
            ? "Desligando…"
            : `Desligar — o custo cai para ${formatarBRL(pronto.custoDepoisCentavos)}`}
        </Botao>
        <BotaoLink href={`/documento/${id}`}>Cancelar</BotaoLink>
      </Rodape>
    </>
  );
}

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando rotulo="Carregando o vínculo" />}>
      <DesligarPagamento />
    </Suspense>
  );
}
