"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CabecalhoDaTela,
  ColunaDeDetalhe,
  RodapeDeAcao,
  TopoFixo,
} from "@/app/_components/detalhe";
import { useSessao } from "@/app/_components/sessao";
import {
  Banner,
  Botao,
  BotaoLink,
  BotaoSalvar,
  Card,
  Carregando,
  Chip,
  Consequencia,
  Dica,
  ErroDeGravacao,
  EstadoErro,
  Passo,
} from "@/app/_components/ui";
import {
  carregarCompromissos,
  carregarPagamento,
  carregarPainel,
  classificarErro,
  criarVinculos,
  mensagemDeErroDeGravacao,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import {
  CHIP_LIGADO_AO_CONFIRMAR,
  CHIP_PRE_VINCULO,
  documentosResolvidosNaConfirmacao,
  LIGADO_AO_CONFIRMAR_PORQUE,
} from "@/lib/fiscal/compromisso";
import { formatarDataBR } from "@/lib/fiscal/obra";
import {
  alocarCusto,
  alocarSimulando,
  avisoDocumentoJaLigado,
  CANDIDATO_OCULTO_DOCUMENTO,
  custoComprovadoAteOAno,
  custoComprovadoDoAno,
  documentosCandidatos,
  DOCUMENTO_SEM_VALOR,
  ehDocumentoHabil,
  listarEmTexto,
  VINCULO_BOLETO_NAO_GERA_CUSTO,
  VINCULO_QUARENTENA_NAO_GERA_CUSTO,
  VINCULO_SO_MUDA_A_PROVA,
  type Candidato,
} from "@/lib/fiscal/vinculo";
import { filtrarCandidatos } from "@/lib/gestao/busca-candidatos";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import type { Documento, Pagamento } from "@/lib/types";

/** CONTAI-078 — ver o gêmeo em `documento/[id]/ligar`. */
const CAMPO_BUSCA =
  "min-h-[44px] w-full rounded-[9px] border border-line bg-white px-2.5 text-[16px] lg:min-h-[36px] lg:text-[13px]";

/** CONTAI-078 — total de candidatos a partir do qual o campo aparece. */
const MINIMO_PARA_BUSCAR = 5;

const NOME_TIPO: Record<Documento["tipo"], string> = {
  nf_material: "NF de material",
  nf_servico: "NF de serviço",
  boleto: "Boleto",
};

/**
 * Como o pagamento já vinculado é citado na marca e no aviso — data +
 * favorecido, o mesmo formato de "Pagamentos desta nota" no detalhe do
 * documento.
 */
function identificarPagamento(p: Pagamento): string {
  return `${formatarDataBR(p.dataPagamento)} · ${p.favorecidoNome ?? "favorecido não informado"} — ${formatarBRL(p.valorCentavos)}`;
}

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      pagamento: Pagamento;
      painel: PainelDados;
      /** UMA lista, com as já cobertas dentro dela (CONTAI-074). */
      candidatos: Candidato<Documento, Pagamento>[];
      jaLigados: Documento[];
      /**
       * **CONTAI-080** — os ids da UNIÃO deduplicada (pré-vínculos ∪ nota de
       * origem) dos agendamentos que este pagamento quitou. É este conjunto que
       * decide as duas coisas novas desta tela: quais candidatos nascem MARCADOS
       * (critério 13) e quais já-ligados ganham a explicação de automação
       * (critério 14).
       */
      preVinculoIds: Set<string>;
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
  /** CONTAI-074 — ver o comentário gêmeo em `documento/[id]/ligar`. */
  const [revelarCobertos, setRevelarCobertos] = useState(false);
  /** CONTAI-078 — idem: texto livre, não é campo fiscal, não persiste. */
  const [termoBusca, setTermoBusca] = useState("");

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const pagamento = await carregarPagamento(id);
        const painel = await carregarPainel(pagamento.obraId);
        /**
         * **CONTAI-080** — a agenda entra nesta tela, e por carregador PRÓPRIO
         * (`carregarCompromissos`), nunca pelo painel: o compromisso e os números
         * da declaração não chegam juntos na mesma variável (parecer §2). O que
         * sai daqui é um CONJUNTO DE IDS — nenhum valor previsto atravessa.
         *
         * Sem query param, de propósito (design §5): a tela deriva tudo do estado
         * gravado e funciona igual se o Mateus chegar aqui direto, não só pelo
         * botão "Revisar antes de confirmar".
         */
        const compromissos = await carregarCompromissos(pagamento.obraId);
        if (cancelado) return;
        const alocacao = alocarCusto(painel);
        // `filter`, e não `find`: `compromisso_pagamento` é N:M, e um pagamento
        // que quitou dois agendamentos tem a união dos dois. Com um só, é
        // idêntico ao `find`.
        const preVinculoIds = new Set(
          compromissos
            .filter((c) => c.pagamentoIds.includes(pagamento.id))
            .flatMap((c) => documentosResolvidosNaConfirmacao(c, painel.documentos))
            .map((d) => d.id),
        );
        setEstado({
          fase: "pronto",
          pagamento,
          painel,
          candidatos: documentosCandidatos(pagamento, painel.documentos, alocacao),
          jaLigados: painel.documentos.filter((d) =>
            pagamento.documentoIds.includes(d.id),
          ),
          preVinculoIds,
          ano: Number(hojeIso().slice(0, 4)),
        });
        /**
         * ⚠️ **A ÚNICA EXCEÇÃO À DOUTRINA "NADA NASCE MARCADO", e ela é nomeada**
         * (critério 13; ADENDO 7 §K.2 / §K.3): o que nasce marcado aqui é
         * **declaração do próprio Mateus**, feita com o dedo antes do pagamento —
         * a mesma classe de `documento_origem_id`, que desde o CONTAI-065 converte
         * sozinho. Não é heurística do app, que é o que o §5.5 de 17/08 proíbe.
         *
         * O que a exceção NÃO afrouxa: o checkbox continua destravado (revalidar,
         * não confirmar), a marca é sempre visível e nominal por linha, e nada
         * nasce marcado por SEMELHANÇA — `sugestao` continua sendo só ordenação.
         *
         * Só os que ainda NÃO estão ligados de verdade: quem já está em
         * `pagamento.documentoIds` não é candidato (e aparece no card do critério
         * 14).
         */
        setMarcados(
          [...preVinculoIds].filter(
            (documentoId) => !pagamento.documentoIds.includes(documentoId),
          ),
        );
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
    // CONTAI-080: as marcas voltam a sair do estado GRAVADO, e não do que
    // sobrou de antes da falha.
    setMarcados([]);
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

  /** Partição só de RENDERIZAÇÃO — a ordenação continua sendo a do módulo puro. */
  const visiveisBase = (pronto?.candidatos ?? []).filter(
    (c) => !c.cobertoPorInteiro,
  );
  const cobertosBase = (pronto?.candidatos ?? []).filter(
    (c) => c.cobertoPorInteiro,
  );

  /** CONTAI-078 — a busca, espelhada. Ver `documento/[id]/ligar` para o porquê
   *  de cada corte; aqui o índice ganha o `numero` da nota, que o candidato
   *  `Documento` tem e o `Pagamento` não. */
  const buscaDisponivel =
    (pronto?.candidatos.length ?? 0) > MINIMO_PARA_BUSCAR;
  const termo = termoBusca.trim();
  const buscaAtiva = buscaDisponivel && termo !== "";
  const visiveis = buscaAtiva
    ? filtrarCandidatos(visiveisBase, termo)
    : visiveisBase;
  const cobertos = buscaAtiva
    ? filtrarCandidatos(cobertosBase, termo)
    : cobertosBase;

  /** SEM filtro: é ela que decide o vazio-de-verdade (critério 10). */
  const listaBase = revelarCobertos
    ? [...visiveisBase, ...cobertosBase]
    : visiveisBase;
  const listaVisivel = revelarCobertos ? [...visiveis, ...cobertos] : visiveis;

  const algumComVinculoPrevio = marcadosDeVerdade.some(
    (c) => c.jaLigadoA.length > 0,
  );
  /** Soma das notas marcadas — o `${valor}` do rótulo de confirmação. */
  const somaMarcados = marcadosDeVerdade.reduce(
    (s, c) => s + (c.item.valorCentavos ?? 0),
    0,
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
      setErroSalvar(mensagemDeErroDeGravacao(erro, "no detalhe do pagamento, se as notas já aparecem ligadas"));
    }
  }

  if (!pronto) {
    return (
      <>
        <CabecalhoDaTela titulo="Ligar este pagamento a uma nota" />
        <ColunaDeDetalhe>
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
        </ColunaDeDetalhe>
      </>
    );
  }

  const p = pronto.pagamento;

  return (
    <>
      <CabecalhoDaTela
        titulo="Ligar este pagamento a uma nota"
        sub={`${formatarBRL(p.valorCentavos)} · ${p.favorecidoNome ?? "sem favorecido"} · ${pronto.painel.obra.nome}`}
      />
      <ColunaDeDetalhe>
        {erroSalvar ? (
          <ErroDeGravacao
            mensagem={erroSalvar}
            antes={
              <>
                <strong>Não deu para ligar.</strong>{" "}
              </>
            }
            depois={
              <>
                {" "}
                <strong>Nada foi ligado</strong> — o pagamento continua como
                estava.
              </>
            }
          />
        ) : null}

        {/* ⚠️ **CONTAI-079 — `TopoFixo` e não `sticky top-0` no próprio
            fluxo**, pela mesma razão da tela irmã: sticky dentro do `<main>`
            rolável cobre a lista que rola por baixo. Nenhuma palavra do card
            mudou. */}
        <TopoFixo>
          <Card className="bg-soft">
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
        </TopoFixo>

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
            {/* ⚠️ **CONTAI-080** — a frase muda quando existe pré-vínculo, e tem
                de mudar: "nada vem marcado" ficaria FALSO na tela em que algo
                vem marcado, e texto de tela que mente sobre o que a tela fez é o
                pre-mortem 4 do ticket com outro rosto. A autorização da exceção
                é o ADENDO 7 §K.2, e a frase nomeia de onde a marca vem. */}
            {pronto.preVinculoIds.size > 0 ? (
              <>
                <strong>Sugestão é ordenação, não vínculo.</strong> O que já vem
                marcado aqui é o <strong>pré-vínculo que você declarou</strong> no
                agendamento, antes de pagar — nada foi marcado por semelhança, e
                você pode desmarcar. Só aparecem documentos da obra{" "}
                <strong>{pronto.painel.obra.nome}</strong>.
              </>
            ) : (
              <>
                <strong>Sugestão é ordenação, não vínculo.</strong> Nada vem
                marcado, e nenhum vínculo nasce sem você tocar. Só aparecem
                documentos da obra <strong>{pronto.painel.obra.nome}</strong>.
              </>
            )}
          </div>
        </Card>

        {/* ⚠️ **CONTAI-080, critério 14 — "JÁ LIGADOS A ESTE PAGAMENTO".**
            `jaLigados` já era carregado nesta tela e NUNCA era renderizado. Sem
            este card, a nota que a automação de N=1 (ADENDO 7 §K.2) acabou de
            ligar simplesmente SOME da lista — `documentosCandidatos` filtra o
            que já está ligado —, e o Mateus não teria como saber que ela não
            sumiu por engano. É a mesma regra "nunca sumiço mudo" do ADENDO de
            2026-09-28 do parecer de 17/08.

            Os que NÃO pertencem à união aparecem no mesmo card sem o chip e sem
            a explicação: o fato ("já ligado") vale para eles, a automação não. */}
        {pronto.jaLigados.length > 0 ? (
          <Card data-ja-ligados="pagamento">
            <Passo>Já ligados a este pagamento</Passo>
            {pronto.jaLigados.map((d) => {
              const daUniao = pronto.preVinculoIds.has(d.id);
              return (
                <div key={d.id} className="mt-2 border-t border-line pt-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13.5px] font-semibold break-words">
                      {d.favorecidoNome ?? "Emitente não informado"}
                    </span>
                    <span className="mono flex-none text-[13.5px]">
                      {formatarBRL(d.valorCentavos ?? 0)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-mut">
                    {NOME_TIPO[d.tipo]}
                    {d.numero ? ` · nº ${d.numero}` : ""}
                  </div>
                  {daUniao ? (
                    <div className="mt-1">
                      {/* ⚠️ ÂMBAR VAZADO, não verde (não-bloqueante 1 do Gate
                          2): verde é a cor de "Custo comprovado", e o que está
                          ligado aqui pode ser boleto ou quarentena. O chip fala
                          da PROCEDÊNCIA do vínculo, nunca do efeito fiscal
                          dele. E não diz "automaticamente": com N=1 ele nasceu
                          sozinho, com N≥2 nasceu do clique em "Sim", e esta
                          tela não distingue os dois — o que é verdade nos dois
                          casos é "ligado ao confirmar o agendamento". */}
                      <Chip cor="amb" peso="vazado">
                        {CHIP_LIGADO_AO_CONFIRMAR}
                      </Chip>
                      <Dica>{LIGADO_AO_CONFIRMAR_PORQUE}</Dica>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </Card>
        ) : null}

        {/* CONTAI-078: o placeholder anuncia o índice desta direção — aqui o
            número da nota entra, na outra tela não existe. */}
        {buscaDisponivel ? (
          <input
            type="text"
            aria-label="Buscar notas"
            placeholder="Buscar por favorecido, valor ou número da nota…"
            className={CAMPO_BUSCA}
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
          />
        ) : null}

        {listaBase.length === 0 ? (
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
        ) : listaVisivel.length === 0 ? (
          /* CONTAI-078 — vazio POR FILTRO: estado novo, e sem o texto de
             consequência do card acima. A nota existe; a busca é que não a
             achou. */
          <Card>
            <div className="text-center text-[34px] leading-none">🔎</div>
            <div className="mt-2 text-center font-semibold">
              {cobertos.length > 0
                ? `Nada encontrado para "${termo}" nas notas livres`
                : `Nada encontrado para "${termo}"`}
            </div>
            <Dica>
              {cobertos.length === 0
                ? "Nenhuma nota desta obra combina com esse texto. Confira a grafia ou tente um valor diferente."
                : cobertos.length === 1
                  ? // Ver o gêmeo em `documento/[id]/ligar`: o spec traz o
                    // plural, e "entre as 1 já ligadas" não se escreve.
                    'Pode estar na que já está ligada a outro pagamento — abra "Mostrar 1…" logo abaixo para conferir.'
                  : `Pode estar entre as ${cobertos.length} já ligadas a outro pagamento — abra "Mostrar ${cobertos.length}…" logo abaixo para conferir.`}
            </Dica>
            <div className="mt-2.5">
              <Botao variante="ghost" onClick={() => setTermoBusca("")}>
                Limpar busca
              </Botao>
            </div>
          </Card>
        ) : (
          <>
            <Passo>Documentos desta obra</Passo>
            {listaVisivel.map((c) => {
              const marcado = marcados.includes(c.item.id);
              const habil = ehDocumentoHabil(c.item);
              const jaLigada = listarEmTexto(
                c.jaLigadoA.map(identificarPagamento),
              );
              return (
                <div key={c.item.id}>
                  <label
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
                      {/* ⚠️ **CONTAI-080** — a marca da exceção, ÂMBAR VAZADA
                          (§J.2: nunca vermelho, nunca verde). Ela vem ANTES da
                          sugestão de propósito: é a razão de a linha estar
                          marcada, e ler "Sugestão — mesmo favorecido" primeiro
                          faria parecer que foi a heurística que marcou. */}
                      {pronto.preVinculoIds.has(c.item.id) ? (
                        <span className="mt-1 block">
                          <Chip cor="amb" peso="vazado">
                            {CHIP_PRE_VINCULO}
                          </Chip>
                        </span>
                      ) : null}
                      {c.sugestao ? (
                        <span className="mt-1 block text-[11.5px] font-semibold text-mut">
                          {c.sugestao}
                        </span>
                      ) : null}
                      {c.jaLigadoA.length > 0 ? (
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-amb">
                          <Chip cor="amb" peso="vazado">
                            {c.cobertoPorInteiro
                              ? "Coberta por inteiro"
                              : "Vínculo parcial"}
                          </Chip>
                          <span>já ligada a: {jaLigada}</span>
                        </span>
                      ) : null}
                    </span>
                  </label>
                  {/* ⚠️ A garantia citada aqui é a da NOTA, não a do pagamento —
                      correção do `contador` no fechamento do CONTAI-074: nesta
                      direção são dois pagamentos distintos e reais provando a
                      mesma nota. Ver `avisoDocumentoJaLigado`. */}
                  {marcado && c.jaLigadoA.length > 0 ? (
                    <Consequencia cor="amb">
                      {avisoDocumentoJaLigado(jaLigada)}
                    </Consequencia>
                  ) : null}
                </div>
              );
            })}
          </>
        )}
        {/* CONTAI-078, critérios 7 e 8: o N vem do subconjunto FILTRADO; a
            visibilidade não reage à busca, só ao clique. */}
        {!revelarCobertos && cobertos.length > 0 ? (
          <Card>
            <Dica>{CANDIDATO_OCULTO_DOCUMENTO}</Dica>
            <div className="mt-2.5">
              <Botao variante="ghost" onClick={() => setRevelarCobertos(true)}>
                {`Mostrar ${cobertos.length} ${cobertos.length === 1 ? "nota já coberta" : "notas já cobertas"}`}
              </Botao>
            </div>
          </Card>
        ) : null}
      </ColunaDeDetalhe>

      <RodapeDeAcao>
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
          {/* Critério 8, espelhado: R$ 0,00 por cobertura total não é o R$ 0,00
              da nota não hábil. */}
          {!soNaoHabeis &&
          algumComVinculoPrevio &&
          (efeito?.acrescimo ?? 0) === 0 ? (
            <>
              <br />
              {VINCULO_SO_MUDA_A_PROVA}
            </>
          ) : null}
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
        <BotaoSalvar
          ocupado={salvando}
          variante="primary"
          onClick={ligar}
          disabled={marcadosDeVerdade.length === 0 || salvando}
        >
          {/* Mesma fricção deliberada do outro seletor: "este pagamento" é o
              pagamento DA TELA, o alvo — por isso o rótulo não pluraliza com a
              contagem de notas marcadas. */}
          {salvando
            ? "Ligando…"
            : marcadosDeVerdade.length === 0
              ? "Marque ao menos um documento"
              : algumComVinculoPrevio
                ? `Confirmar ligação também a este pagamento — ${formatarBRL(somaMarcados)}`
                : `Ligar ${marcadosDeVerdade.length} ${marcadosDeVerdade.length === 1 ? "documento" : "documentos"}`}
        </BotaoSalvar>
        <BotaoLink href={`/pagamento/${p.id}`}>Cancelar</BotaoLink>
      </RodapeDeAcao>
    </>
  );
}
