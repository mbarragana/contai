"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useSessao } from "@/app/_components/sessao";
import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Corpo,
  Dica,
  EstadoErro,
  Passo,
  Rodape,
} from "@/app/_components/ui";
import {
  carregarPagamento,
  carregarPainel,
  classificarErro,
  criarVinculos,
  mensagemDeErro,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import {
  alocarCusto,
  alocarSimulando,
  CANDIDATO_OCULTO_DOCUMENTO,
  custoComprovadoAteOAno,
  custoComprovadoDoAno,
  documentosCandidatos,
  documentosOcultosPorCobertura,
  DOCUMENTO_SEM_VALOR,
  ehDocumentoHabil,
  VINCULO_BOLETO_NAO_GERA_CUSTO,
  VINCULO_QUARENTENA_NAO_GERA_CUSTO,
  type Candidato,
} from "@/lib/fiscal/vinculo";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import type { Documento, Pagamento } from "@/lib/types";

const NOME_TIPO: Record<Documento["tipo"], string> = {
  nf_material: "NF de material",
  nf_servico: "NF de serviço",
  boleto: "Boleto",
};

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      pagamento: Pagamento;
      painel: PainelDados;
      candidatos: Candidato<Documento>[];
      jaLigados: Documento[];
      /** C4: quantos sumiram da lista por já estarem cobertos por inteiro. */
      ocultosPorCobertura: number;
      ano: number;
    };

/**
 * O seletor no sentido inverso (critério 3): a partir do PIX, escolher a nota.
 *
 * Mesmas duas regras do seletor do documento, e pelo mesmo motivo (parecer
 * §5.5): nada vem marcado, e não existe ação em lote. Aqui o documento em
 * quarentena e o boleto CONTINUAM na lista — vincular os dois é permitido
 * (critérios 8 e 9) e é o que evita contar a mesma despesa duas vezes —, e a
 * tela diz na hora que eles não geram custo confirmado.
 */
export default function LigarDocumentos() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { pedirReautenticacao } = useSessao();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const pagamento = await carregarPagamento(id);
        const painel = await carregarPainel(pagamento.obraId);
        if (cancelado) return;
        const alocacao = alocarCusto(painel);
        setEstado({
          fase: "pronto",
          pagamento,
          painel,
          candidatos: documentosCandidatos(pagamento, painel.documentos, alocacao),
          jaLigados: painel.documentos.filter((d) =>
            pagamento.documentoIds.includes(d.id),
          ),
          ocultosPorCobertura: documentosOcultosPorCobertura(
            pagamento,
            painel.documentos,
            alocacao,
          ).length,
          ano: Number(hojeIso().slice(0, 4)),
        });
      } catch (erro) {
        if (!cancelado) setEstado({ fase: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ fase: "carregando" });
    setErroSalvar(null);
    setTentativa((t) => t + 1);
  }, []);

  const alternar = useCallback((documentoId: string) => {
    setMarcados((atual) =>
      atual.includes(documentoId)
        ? atual.filter((x) => x !== documentoId)
        : [...atual, documentoId],
    );
  }, []);

  const pronto = estado.fase === "pronto" ? estado : null;
  const erroCarregar = estado.fase === "erro" ? estado.erro : null;

  const marcadosDeVerdade = useMemo(
    () => (pronto?.candidatos ?? []).filter((c) => marcados.includes(c.item.id)),
    [pronto, marcados],
  );

  /**
   * O efeito no custo ANTES do toque (critério 15), pela MESMA `alocarCusto`
   * da home, rodada com e sem os vínculos marcados sobre o painel real.
   *
   * A previsão isolada que existia aqui somava os valores INTEGRAIS das notas
   * marcadas, ignorando que uma delas pode já estar parcialmente coberta por
   * outro pagamento: um PIX de R$ 3.000 marcado numa NF de R$ 3.000 já coberta
   * em R$ 2.000 fazia a tela prometer R$ 3.000 de custo comprovado quando o
   * certo é R$ 1.000 — três vezes o real, na direção que o parecer §4 chama de
   * perigosa.
   */
  const efeito = useMemo(() => {
    if (!pronto) return null;
    const antes = alocarCusto(pronto.painel);
    const depois = alocarSimulando(pronto.painel, {
      adicionar: marcadosDeVerdade.map((c) => ({
        pagamentoId: pronto.pagamento.id,
        documentoId: c.item.id,
      })),
    });
    const deDepois = depois.porPagamento.get(pronto.pagamento.id);
    const acumuladoAntes = custoComprovadoAteOAno(antes, pronto.ano);
    const acumuladoDepois = custoComprovadoAteOAno(depois, pronto.ano);
    return {
      anoAntes: custoComprovadoDoAno(antes, pronto.ano),
      anoDepois: custoComprovadoDoAno(depois, pronto.ano),
      acumuladoAntes,
      acumuladoDepois,
      /** A fatia DESTE pagamento comprovada depois de ligar — só do cartão. */
      comprovadoDepois: deDepois?.comprovadoCentavos ?? 0,
      /**
       * O número do rodapé, o MESMO da tela do documento: a variação do
       * **custo de aquisição do imóvel**, que é um único total acumulado.
       *
       * ⚠️ Aqui estava a variação do comprovado DESTE pagamento, e as duas
       * grandezas não são a mesma sob a repartição cronológica (adendo de
       * 2026-08-18 do parecer): marcar um pagamento MAIS ANTIGO faz ele TOMAR
       * a alocação de um posterior já coberto. NF de 3.000 já coberta por um
       * PIX de 2.000 de 12/08; ligar nela um PIX de 3.000 de 01/07 move o
       * total de 2.000 para 3.000 — acréscimo REAL de 1.000 —, mas a fatia
       * deste pagamento vai de 0 a 3.000. A tela anunciava os 3.000,
       * contradizendo o "acumulado 2.000 → 3.000" da linha de baixo e errando
       * para cima (§4 do parecer: a direção perigosa).
       */
      acrescimo: acumuladoDepois - acumuladoAntes,
      faltaCobrirDepois:
        deDepois?.semNotaCentavos ?? pronto.pagamento.valorCentavos,
    };
  }, [pronto, marcadosDeVerdade]);

  /** Variante s3c do mock: marcou só nota não hábil, o efeito é zero e diz por quê. */
  const soNaoHabeis =
    marcadosDeVerdade.length > 0 &&
    marcadosDeVerdade.every((c) => !ehDocumentoHabil(c.item));

  /** C5: nota hábil sem valor informado comprova ZERO — e não em silêncio. */
  const marcouSemValor = marcadosDeVerdade.some(
    (c) => ehDocumentoHabil(c.item) && c.item.valorCentavos === null,
  );

  // Critérios 8 e 9: o aviso é do TIPO que está marcado, não um texto só.
  const marcouQuarentena = marcadosDeVerdade.some(
    (c) => c.item.status === "quarentena",
  );
  const marcouBoleto = marcadosDeVerdade.some((c) => c.item.tipo === "boleto");

  async function ligar() {
    if (!pronto || marcadosDeVerdade.length === 0) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      await criarVinculos(
        marcadosDeVerdade.map((c) => ({
          pagamentoId: pronto.pagamento.id,
          documentoId: c.item.id,
          obraDoPagamentoId: pronto.pagamento.obraId,
          obraDoDocumentoId: c.item.obraId,
          documentoHabil: ehDocumentoHabil(c.item),
        })),
      );
      router.push(`/pagamento/${pronto.pagamento.id}`);
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
        <AppBar titulo="Ligar este pagamento a uma nota" />
        <Corpo>
          {erroCarregar ? (
            <>
              <Banner cor="red" role="alert">
                <strong>Não deu para carregar os documentos.</strong>{" "}
                <strong>Nada foi ligado</strong> — o pagamento continua como
                estava.
              </Banner>
              <EstadoErro erro={erroCarregar} onTentarDeNovo={tentarDeNovo} />
            </>
          ) : (
            <>
              <Dica>Procurando notas desta obra…</Dica>
              <Carregando rotulo="Carregando os candidatos" />
            </>
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href={`/pagamento/${id}`}>Voltar ao pagamento</BotaoLink>
        </Rodape>
      </>
    );
  }

  const p = pronto.pagamento;

  return (
    <>
      <AppBar
        titulo="Ligar este pagamento a uma nota"
        sub={`${formatarBRL(p.valorCentavos)} · ${p.favorecidoNome ?? "sem favorecido"} · ${pronto.painel.obra.nome}`}
      />
      <Corpo>
        {erroSalvar ? (
          <Banner cor="red" role="alert">
            <strong>Não deu para ligar.</strong> {erroSalvar}{" "}
            <strong>Nada foi ligado</strong> — o pagamento continua como estava.
          </Banner>
        ) : null}

        <Card className="sticky top-0 z-10 bg-soft">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11.5px] text-mut">
              Falta cobrir deste pagamento
            </span>
            <span className="mono text-[22px] font-bold tracking-tight">
              {formatarBRL(efeito?.faltaCobrirDepois ?? p.valorCentavos)}
            </span>
          </div>
          {/* O cartão fala só DESTE pagamento; o efeito na obra é o do rodapé.
              Misturar as duas grandezas na mesma frase foi o defeito do Gate 2:
              a fatia de um pagamento pode subir 3.000 enquanto o custo da obra
              sobe 1.000. */}
          <Dica>
            {marcadosDeVerdade.length === 0
              ? "Nada marcado ainda — o pagamento continua sem nota."
              : `Com o que está marcado, ${formatarBRL(efeito?.comprovadoDepois ?? 0)} deste pagamento ficam cobertos por documento hábil. Essa é a fatia dele — o efeito no custo da obra é o do rodapé.`}
          </Dica>
        </Card>

        {marcouSemValor ? (
          <Banner cor="red" role="alert">
            {DOCUMENTO_SEM_VALOR}
          </Banner>
        ) : null}

        {marcouQuarentena ? (
          <Banner cor="red" role="status">
            {VINCULO_QUARENTENA_NAO_GERA_CUSTO}
          </Banner>
        ) : null}
        {marcouBoleto ? (
          <Banner cor="red" role="status">
            {VINCULO_BOLETO_NAO_GERA_CUSTO}
          </Banner>
        ) : null}

        <Card>
          <div className="text-[12.5px]">
            <strong>Sugestão é ordenação, não vínculo.</strong> Nada vem
            marcado, e nenhum vínculo nasce sem você tocar. Só aparecem
            documentos da obra <strong>{pronto.painel.obra.nome}</strong>.
          </div>
        </Card>

        {pronto.candidatos.length === 0 ? (
          <Card>
            <div className="text-center text-[34px] leading-none">📄</div>
            <div className="mt-2 text-center font-semibold">
              Nenhum documento para ligar
            </div>
            <Dica>
              Não há, nesta obra, documento registrado que ainda precise deste
              pagamento. Se a nota já chegou, ela ainda não foi registrada.
            </Dica>
            <div className="mt-2.5">
              <BotaoLink href="/adicionar/documento">
                Registrar o documento agora
              </BotaoLink>
            </div>
          </Card>
        ) : (
          <>
            <Passo>Documentos desta obra</Passo>
            {pronto.candidatos.map((c) => {
              const marcado = marcados.includes(c.item.id);
              const habil = ehDocumentoHabil(c.item);
              return (
                <label
                  key={c.item.id}
                  className={`flex min-h-[44px] cursor-pointer gap-3 rounded-[10px] border px-3 py-2.5 ${
                    marcado ? "border-ink bg-soft" : "border-line bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => alternar(c.item.id)}
                    className="mt-1 h-5 w-5 flex-none"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[14px] font-semibold break-words">
                        {c.item.favorecidoNome ?? "Emitente não informado"}
                      </span>
                      <span className="mono flex-none text-[15px] font-bold">
                        {formatarBRL(c.item.valorCentavos ?? 0)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[12px] text-mut">
                      {NOME_TIPO[c.item.tipo]}
                      {habil ? "" : " · não gera custo confirmado"}
                    </span>
                    {c.sugestao ? (
                      <span className="mt-1 block text-[11.5px] font-semibold text-mut">
                        {c.sugestao}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </>
        )}
        {pronto.ocultosPorCobertura > 0 ? (
          <Dica>{CANDIDATO_OCULTO_DOCUMENTO}</Dica>
        ) : null}
      </Corpo>

      <Rodape>
        {/* Mesmo rodapé do mock do outro seletor, e agora com a MESMA
            grandeza dele: "Custo confirmado se ligar agora" nomeia o custo de
            aquisição do imóvel — um único total acumulado —, então o número é
            sempre `acumuladoDepois - acumuladoAntes`, nunca a fatia deste
            pagamento. O "antes → depois" acompanha nos dois números. */}
        <Dica>
          Custo confirmado se ligar agora:{" "}
          <span
            className={`mono font-semibold ${soNaoHabeis ? "text-red" : ""}`}
          >
            {formatarBRL(efeito?.acrescimo ?? 0)}
          </span>
          {soNaoHabeis ? " — a nota não é hábil" : null}
          <br />
          {pronto.ano}:{" "}
          <span className="mono">
            {formatarBRL(efeito?.anoAntes ?? 0)} →{" "}
            {formatarBRL(efeito?.anoDepois ?? 0)}
          </span>
          {" · "}acumulado:{" "}
          <span className="mono">
            {formatarBRL(efeito?.acumuladoAntes ?? 0)} →{" "}
            {formatarBRL(efeito?.acumuladoDepois ?? 0)}
          </span>
        </Dica>
        <Botao
          variante="primary"
          onClick={ligar}
          disabled={marcadosDeVerdade.length === 0 || salvando}
        >
          {salvando
            ? "Ligando…"
            : marcadosDeVerdade.length === 0
              ? "Marque ao menos um documento"
              : `Ligar ${marcadosDeVerdade.length} ${marcadosDeVerdade.length === 1 ? "documento" : "documentos"}`}
        </Botao>
        <BotaoLink href={`/pagamento/${p.id}`}>Cancelar</BotaoLink>
      </Rodape>
    </>
  );
}
