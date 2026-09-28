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
  carregarDocumento,
  carregarPainel,
  classificarErro,
  criarVinculos,
  mensagemDeErroDeGravacao,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { NOME_TIPO_CURTO } from "@/lib/fiscal/resumo";
import {
  alocarCusto,
  alocarSimulando,
  avisoPagamentoJaLigado,
  CANDIDATO_OCULTO_PAGAMENTO,
  custoComprovadoAteOAno,
  custoComprovadoDoAno,
  DOCUMENTO_SEM_VALOR,
  ehDocumentoHabil,
  listarEmTexto,
  pagamentosCandidatos,
  VINCULO_BOLETO_NAO_GERA_CUSTO,
  VINCULO_QUARENTENA_NAO_GERA_CUSTO,
  VINCULO_SO_MUDA_A_PROVA,
  type Candidato,
} from "@/lib/fiscal/vinculo";
import { filtrarCandidatos } from "@/lib/gestao/busca-candidatos";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import type { Documento, Pagamento } from "@/lib/types";

/**
 * CONTAI-078 — o campo de busca usa a mesma caixa dos filtros de `/despesas`
 * (nada de componente novo): 44px de alvo e 16px de fonte no celular, para o
 * iOS não dar zoom ao focar; mais compacto em tela larga.
 */
const CAMPO_BUSCA =
  "min-h-[44px] w-full rounded-[9px] border border-line bg-white px-2.5 text-[16px] lg:min-h-[36px] lg:text-[13px]";

/**
 * CONTAI-078 — abaixo de 6 candidatos a ordenação já resolve, e um campo de
 * busca sobre 4 linhas é ruído. Conta o TOTAL (visíveis + já cobertos), antes
 * de qualquer filtro: o total é que diz se a lista é longa.
 */
const MINIMO_PARA_BUSCAR = 5;

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      documento: Documento;
      painel: PainelDados;
      /**
       * UMA lista, com os já cobertos dentro dela (CONTAI-074). Não são duas
       * listas paralelas: cada candidato carrega o seu `cobertoPorInteiro` e o
       * seu `jaLigadoA`, e a tela decide o que mostrar por padrão.
       */
      candidatos: Candidato<Pagamento, Documento>[];
      /** Pagamentos já ligados: entram na conta do saldo, não na lista. */
      jaLigados: Pagamento[];
      ano: number;
    };

/**
 * Como a nota já vinculada é citada na marca e no aviso — `NOME_TIPO_CURTO` +
 * número, o mesmo formato do detalhe do documento e do seletor espelhado. Sem
 * número (boleto, registro antigo) fica só o tipo: inventar "nº ?" seria pior
 * que a ausência.
 */
function identificarNota(d: Documento): string {
  const nome = d.numero
    ? `${NOME_TIPO_CURTO[d.tipo]} nº ${d.numero}`
    : NOME_TIPO_CURTO[d.tipo];
  return `${nome} — ${formatarBRL(d.valorCentavos ?? 0)}`;
}

/**
 * O seletor de pagamentos candidatos (mock s2, s3, s3c, s3d, s3e) — a peça
 * mais difícil do produto até aqui, e a que o Gate 0 protegeu.
 *
 * Duas regras que a tela não pode quebrar, as duas do parecer §5.5:
 * - **nada vem marcado**, e nenhum vínculo nasce sem toque explícito;
 * - **não existe "ligar todos"**: cada candidato é conferido item a item.
 * "Sugestão" aqui é ORDENAÇÃO E RÓTULO. Vínculo inferido errado inflaciona
 * custo em silêncio e ainda mata o alerta — os dois erros de uma vez.
 */
export default function LigarPagamentos() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { pedirReautenticacao } = useSessao();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  /**
   * CONTAI-074 — o bloco dos já cobertos por inteiro começa colapsado e **não
   * volta a colapsar**: revelar é sempre seguro (só amplia a lista, nunca liga
   * nada), e esconder de novo não protege coisa nenhuma. Não persiste: recarregar
   * a tela volta ao padrão, que é a lista curta.
   */
  const [revelarCobertos, setRevelarCobertos] = useState(false);
  /**
   * CONTAI-078 — texto livre, **não é campo fiscal**: nasce `""` e não persiste
   * (recarregar zera, mesmo padrão de `revelarCobertos`). A disciplina de "sem
   * default" protege afirmação fiscal; busca não afirma nada, só filtra.
   */
  const [termoBusca, setTermoBusca] = useState("");

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const documento = await carregarDocumento(id);
        const painel = await carregarPainel(documento.obraId);
        if (cancelado) return;

        const alocacao = alocarCusto(painel);
        const alocado = alocacao.porDocumento.get(documento.id);

        setEstado({
          fase: "pronto",
          documento,
          painel,
          // Só pagamentos DESTA obra e ainda não ligados a ESTA nota; a
          // filtragem e a ordenação são do módulo puro.
          candidatos: pagamentosCandidatos(documento, painel.pagamentos, alocacao),
          jaLigados: alocado?.pagamentos ?? [],
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

  const alternar = useCallback((pagamentoId: string) => {
    setMarcados((atual) =>
      atual.includes(pagamentoId)
        ? atual.filter((x) => x !== pagamentoId)
        : [...atual, pagamentoId],
    );
  }, []);

  const pronto = estado.fase === "pronto" ? estado : null;
  const erroCarregar = estado.fase === "erro" ? estado.erro : null;

  const marcadosDeVerdade = useMemo(
    () => (pronto?.candidatos ?? []).filter((c) => marcados.includes(c.item.id)),
    [pronto, marcados],
  );

  const somaMarcados = marcadosDeVerdade.reduce(
    (s, c) => s + c.item.valorCentavos,
    0,
  );

  /**
   * A lista única partida em duas para a RENDERIZAÇÃO — e só para isso: a
   * ordenação é a do módulo puro, e os cobertos entram anexados ao fim em vez de
   * misturados, para a parte revelada se ler como parte revelada.
   */
  const visiveisBase = (pronto?.candidatos ?? []).filter(
    (c) => !c.cobertoPorInteiro,
  );
  const cobertosBase = (pronto?.candidatos ?? []).filter(
    (c) => c.cobertoPorInteiro,
  );

  /**
   * CONTAI-078 — a busca. Com 5 candidatos ou menos o campo não existe, e então
   * NENHUMA regra deste ticket entra em vigor: `buscaAtiva` é falso, os
   * subconjuntos filtrados são os de sempre e a tela se comporta como antes.
   */
  const buscaDisponivel =
    (pronto?.candidatos.length ?? 0) > MINIMO_PARA_BUSCAR;
  const termo = termoBusca.trim();
  const buscaAtiva = buscaDisponivel && termo !== "";
  const visiveis = buscaAtiva
    ? filtrarCandidatos(visiveisBase, termo)
    : visiveisBase;
  /** Os já cobertos também filtram — é daqui que sai o N do "Mostrar N…". */
  const cobertos = buscaAtiva
    ? filtrarCandidatos(cobertosBase, termo)
    : cobertosBase;

  /**
   * A lista SEM filtro — é ela, e só ela, que decide o card de vazio-de-verdade
   * (critério 10): "não há pagamento nesta obra para ligar" é verdade
   * estrutural, e a busca não pode fazer a tela afirmá-la. Mantém a condição de
   * hoje (`revelarCobertos` inclui os cobertos), para que revelar continue
   * tirando a tela do vazio como tira desde o CONTAI-074.
   */
  const listaBase = revelarCobertos
    ? [...visiveisBase, ...cobertosBase]
    : visiveisBase;
  const listaVisivel = revelarCobertos ? [...visiveis, ...cobertos] : visiveis;

  /** Critério 9: o rótulo do botão troca de verbo quando há vínculo prévio. */
  const algumComVinculoPrevio = marcadosDeVerdade.some(
    (c) => c.jaLigadoA.length > 0,
  );

  /**
   * O efeito no custo ANTES do toque (critério 15, Gate 0 estado 2).
   *
   * É a MESMA `alocarCusto` que produz o número da home, rodada DUAS VEZES
   * sobre o painel real — com e sem os vínculos marcados. A previsão isolada
   * que existia aqui simulava o documento e os pagamentos marcados fora do
   * grafo, com os valores integrais, e por isso anunciava custo MAIOR que o
   * real quando o candidato já estava parcialmente coberto por outro vínculo
   * (pagamento de R$ 3.000 já ligado a uma NF de R$ 1.000 anunciava R$ 3.000
   * de acréscimo, quando o real é R$ 2.000). Superestimar custo é a direção
   * perigosa do parecer §4.
   */
  const efeito = useMemo(() => {
    if (!pronto) return null;
    const antes = alocarCusto(pronto.painel);
    const depois = alocarSimulando(pronto.painel, {
      adicionar: marcadosDeVerdade.map((c) => ({
        pagamentoId: c.item.id,
        documentoId: pronto.documento.id,
      })),
    });

    const valor = pronto.documento.valorCentavos ?? 0;
    const habil = ehDocumentoHabil(pronto.documento);
    // Documento não hábil não tem "excedente" na alocação (contribui zero),
    // então o saldo dele é aritmética simples sobre os pagamentos ligados.
    const pagosDepois =
      pronto.jaLigados.reduce((t, x) => t + x.valorCentavos, 0) + somaMarcados;

    const acumuladoAntes = custoComprovadoAteOAno(antes, pronto.ano);
    const acumuladoDepois = custoComprovadoAteOAno(depois, pronto.ano);

    return {
      anoAntes: custoComprovadoDoAno(antes, pronto.ano),
      anoDepois: custoComprovadoDoAno(depois, pronto.ano),
      acumuladoAntes,
      acumuladoDepois,
      /**
       * O número do rodapé do mock ("custo confirmado se ligar agora"): o
       * ACRÉSCIMO real, e não o valor cheio do conjunto. Sai do acumulado
       * porque pagamento de ano anterior também confirma custo, só que em
       * outro ano — e data futura não existe (a validação do registro recusa).
       */
      acrescimo: acumuladoDepois - acumuladoAntes,
      // ⚠️ A FALTA GENUÍNA (CONTAI-056): a fatia já quitada por retenção
      // confirmada não é "falta pagar" — ela não volta a aparecer aqui como
      // saldo a cobrir depois de ligar.
      faltaDepois: habil
        ? (depois.porDocumento.get(pronto.documento.id)
            ?.faltaPagamentoCentavos ?? valor)
        : Math.max(0, valor - pagosDepois),
      // Quanto DESTES pagamentos continua sem nota depois de ligar — pela
      // alocação real, não pela subtração ingênua.
      excedenteMarcados: marcadosDeVerdade.reduce(
        (t, c) => t + (depois.porPagamento.get(c.item.id)?.semNotaCentavos ?? 0),
        0,
      ),
    };
  }, [pronto, marcadosDeVerdade, somaMarcados]);

  async function ligar() {
    if (!pronto || marcadosDeVerdade.length === 0) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      // UMA chamada, um `insert` com array: ou entram todas as linhas, ou
      // nenhuma. É o que sustenta a frase do estado de erro.
      await criarVinculos(
        marcadosDeVerdade.map((c) => ({
          pagamentoId: c.item.id,
          documentoId: pronto.documento.id,
          obraDoPagamentoId: c.item.obraId,
          obraDoDocumentoId: pronto.documento.obraId,
          documentoHabil: ehDocumentoHabil(pronto.documento),
        })),
      );
      router.push(`/documento/${pronto.documento.id}?ligado=1`);
    } catch (erro) {
      setSalvando(false);
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroSalvar(mensagemDeErroDeGravacao(erro, "no detalhe da nota, se os pagamentos já aparecem ligados"));
    }
  }

  if (!pronto) {
    return (
      <>
        <CabecalhoDaTela titulo="Ligar pagamentos a esta nota" />
        <ColunaDeDetalhe>
          {erroCarregar ? (
            <>
              {/* Mock s3e: o erro diz que NADA foi ligado. */}
              <Banner cor="red" role="alert">
                <strong>Não deu para carregar os pagamentos.</strong>{" "}
                <strong>Nada foi ligado</strong> — a nota continua como estava.
              </Banner>
              <EstadoErro erro={erroCarregar} onTentarDeNovo={tentarDeNovo} />
            </>
          ) : (
            <>
              <Dica>Procurando pagamentos sem nota nesta obra…</Dica>
              <Carregando rotulo="Carregando os candidatos" />
            </>
          )}
        </ColunaDeDetalhe>
      </>
    );
  }

  const d = pronto.documento;
  const habil = ehDocumentoHabil(d);

  return (
    <>
      <CabecalhoDaTela
        titulo="Ligar pagamentos a esta nota"
        sub={`${formatarBRL(d.valorCentavos ?? 0)} · ${d.favorecidoNome ?? "sem favorecido"} · ${pronto.painel.obra.nome}`}
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
                <strong>Nada foi ligado</strong> — a nota continua como estava.
              </>
            }
          />
        ) : null}

        {/* Saldo restante da nota, atualizando a cada marcação.

            ⚠️ **CONTAI-079 — `TopoFixo` e não `sticky top-0` no próprio
            fluxo.** Sticky dentro do `<main>` rolável cobria as primeiras
            linhas visíveis da lista durante todo o scroll intermediário, o
            mesmo defeito que o CONTAI-077 corrigiu no rodapé. O conteúdo do
            card não mudou nenhuma palavra. */}
        <TopoFixo>
          <Card className="bg-soft">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11.5px] text-mut">
                Falta ligar desta nota
              </span>
              <span className="mono text-[22px] font-bold tracking-tight">
                {formatarBRL(efeito?.faltaDepois ?? 0)}
              </span>
            </div>
            <Dica>
              {marcadosDeVerdade.length === 0
                ? "Nada marcado ainda — a nota continua sem cobertura."
                : efeito && efeito.faltaDepois === 0
                  ? efeito.excedenteMarcados > 0
                    ? `Nota coberta por inteiro. Excedente ${formatarBRL(efeito.excedenteMarcados)} destes pagamentos continua como pago sem nota.`
                    : "Nota coberta por inteiro."
                  : `Marcado ${formatarBRL(somaMarcados)} — ainda faltam ${formatarBRL(efeito?.faltaDepois ?? 0)} desta nota, que não viram custo enquanto não forem pagos.`}
            </Dica>
          </Card>
        </TopoFixo>

        {/* C5: nota hábil sem valor informado comprova ZERO, e em silêncio ela
            empurraria o pagamento inteiro para "pago sem nota". */}
        {habil && d.valorCentavos === null ? (
          <Banner cor="red" role="alert">
            {DOCUMENTO_SEM_VALOR}
          </Banner>
        ) : null}

        {habil ? null : (
          <Banner cor="red" role="status">
            {d.tipo === "boleto"
              ? VINCULO_BOLETO_NAO_GERA_CUSTO
              : VINCULO_QUARENTENA_NAO_GERA_CUSTO}
          </Banner>
        )}

        <Card>
          <div className="text-[12.5px]">
            <strong>Sugestão é ordenação, não vínculo.</strong> Nada vem
            marcado, e nenhum vínculo nasce sem você tocar. Só aparecem
            pagamentos da obra <strong>{pronto.painel.obra.nome}</strong>.
          </div>
        </Card>

        {/* CONTAI-078: só com lista longa, e logo acima da lista que ele filtra. */}
        {buscaDisponivel ? (
          <input
            type="text"
            aria-label="Buscar pagamentos"
            placeholder="Buscar por favorecido ou valor…"
            className={CAMPO_BUSCA}
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
          />
        ) : null}

        {listaBase.length === 0 ? (
          <>
            <Card>
              <div className="text-center text-[34px] leading-none">💸</div>
              <div className="mt-2 text-center font-semibold">
                Nenhum pagamento para ligar
              </div>
              <Dica>
                Não há, nesta obra, pagamento registrado sem nota. Se você já
                pagou esta nota, o pagamento ainda não foi registrado.
              </Dica>
            </Card>
            {habil ? (
              <Consequencia cor="amb">
                Enquanto não houver pagamento ligado, os{" "}
                {formatarBRL(d.valorCentavos ?? 0)} desta nota ficam fora do{" "}
                <strong>Custo confirmado</strong> — é gasto real que o app não
                consegue demonstrar.
              </Consequencia>
            ) : null}
          </>
        ) : listaVisivel.length === 0 ? (
          /* CONTAI-078 — vazio POR FILTRO, e ele é outro estado: **sem
             `Consequencia`**. O card de cima anuncia custo fora do Custo
             confirmado porque não existe pagamento nenhum a ligar; aqui existe,
             o filtro só não o achou — repetir a frase fiscal seria afirmar um
             risco que o texto digitado não criou. */
          <Card>
            <div className="text-center text-[34px] leading-none">🔎</div>
            <div className="mt-2 text-center font-semibold">
              {cobertos.length > 0
                ? `Nada encontrado para "${termo}" nos pagamentos livres`
                : `Nada encontrado para "${termo}"`}
            </div>
            <Dica>
              {cobertos.length === 0
                ? "Nenhum pagamento desta obra combina com esse texto. Confira a grafia ou tente um valor diferente."
                : cobertos.length === 1
                  ? // O texto do spec está no plural; no singular ele viraria
                    // "entre os 1 já ligados", e o rótulo citado tem de bater
                    // com o botão logo abaixo, que também singulariza.
                    'Pode estar no que já está ligado a outra nota — abra "Mostrar 1…" logo abaixo para conferir.'
                  : `Pode estar entre os ${cobertos.length} já ligados a outra nota — abra "Mostrar ${cobertos.length}…" logo abaixo para conferir.`}
            </Dica>
            <div className="mt-2.5">
              {/* Limpa só a busca: revelar os cobertos continua sendo decisão
                  do Mateus, e um botão de busca não a toma por ele. */}
              <Botao variante="ghost" onClick={() => setTermoBusca("")}>
                Limpar busca
              </Botao>
            </div>
          </Card>
        ) : (
          <>
            <Passo>Pagamentos desta obra</Passo>
            {listaVisivel.map((c) => {
              const marcado = marcados.includes(c.item.id);
              const jaLigado = listarEmTexto(c.jaLigadoA.map(identificarNota));
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
                          {c.item.favorecidoNome ?? "Favorecido não informado"}
                        </span>
                        <span className="mono flex-none text-[15px] font-bold">
                          {formatarBRL(c.item.valorCentavos)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[12px] text-mut">
                        {c.item.meio.toUpperCase()} · pago em{" "}
                        {formatarDataBR(c.item.dataPagamento)}
                        {c.item.comprovantePath ? " · comprovante ✓" : ""}
                      </span>
                      {c.sugestao ? (
                        <span className="mt-1 block text-[11.5px] font-semibold text-mut">
                          {c.sugestao}
                        </span>
                      ) : null}
                      {/* ADENDO de 2026-09-28, §2(b) MARCAR: vínculo prévio
                          aparece SEMPRE, revelado ou não, marcado ou não —
                          "nunca sumiço mudo". O chip distingue os dois casos com
                          uma palavra; o resto da explicação só aparece no aviso,
                          quando o dedo toca. */}
                      {c.jaLigadoA.length > 0 ? (
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-amb">
                          <Chip cor="amb" peso="vazado">
                            {c.cobertoPorInteiro
                              ? "Coberto por inteiro"
                              : "Vínculo parcial"}
                          </Chip>
                          <span>já ligado a: {jaLigado}</span>
                        </span>
                      ) : null}
                    </span>
                  </label>
                  {/* O aviso (b) COLADO no item: "este pagamento" só é
                      inequívoco embaixo do pagamento de que fala. Um por item
                      marcado, nunca um agregado no rodapé. */}
                  {marcado && c.jaLigadoA.length > 0 ? (
                    <Consequencia cor="amb">
                      {avisoPagamentoJaLigado(jaLigado)}
                    </Consequencia>
                  ) : null}
                </div>
              );
            })}
          </>
        )}

        {/* O bloco revelável do CONTAI-074. Fica onde vivia a `Dica` estática de
            hoje, e o texto é o mesmo `CANDIDATO_OCULTO_PAGAMENTO` — que deixou de
            presumir que cobertura prévia é engano a desfazer.
            ⚠️ CONTAI-078, critérios 7 e 8: `cobertos` aqui é o subconjunto
            FILTRADO, então o N do rótulo reage à busca e o bloco desaparece
            quando o filtro zera os cobertos. O que NÃO reage é a visibilidade:
            `revelarCobertos` só muda por clique, nunca por tecla digitada. */}
        {!revelarCobertos && cobertos.length > 0 ? (
          <Card>
            <Dica>{CANDIDATO_OCULTO_PAGAMENTO}</Dica>
            <div className="mt-2.5">
              <Botao variante="ghost" onClick={() => setRevelarCobertos(true)}>
                {`Mostrar ${cobertos.length} ${cobertos.length === 1 ? "pagamento já coberto" : "pagamentos já cobertos"}`}
              </Botao>
            </div>
          </Card>
        ) : null}

        <Dica>Não achou o pagamento? Ele pode ainda não estar registrado.</Dica>
        <BotaoLink href={`/adicionar/pagamento?documento=${d.id}`}>
          Registrar o pagamento agora
        </BotaoLink>
      </ColunaDeDetalhe>

      <RodapeDeAcao>
        {/* Critério 15: o efeito no custo dito ANTES do toque. O rótulo é o do
            mock aprovado (rodapé fixo do seletor, s2/s3c); o NÚMERO passou a
            ser o acréscimo REAL sobre o grafo inteiro — antes ele era o valor
            cheio do conjunto simulado, que superestimava o custo.
            O "antes → depois" completa o rótulo do mock em vez de substituí-lo,
            e vem nos DOIS números: ligar pagamento de ano anterior não mexe no
            ano corrente, mas mexe no acumulado da ficha Bens e Direitos. */}
        <Dica>
          Custo confirmado se ligar agora:{" "}
          <span className={`mono font-semibold ${habil ? "" : "text-red"}`}>
            {formatarBRL(efeito?.acrescimo ?? 0)}
          </span>
          {habil ? null : " — a nota não é hábil"}
          {/* Critério 8: R$ 0,00 por cobertura total NÃO é o R$ 0,00 da nota não
              hábil, e dizer a mesma coisa nos dois faria o Mateus ler "não
              serviu de nada" num vínculo que serviu. A frase só entra nesta
              combinação exata: vínculo prévio marcado, acréscimo zero, nota
              hábil. */}
          {habil && algumComVinculoPrevio && (efeito?.acrescimo ?? 0) === 0 ? (
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
          {/* Fricção deliberada (pre-mortem 2): com vínculo prévio marcado o
              verbo deixa de ser "Ligar N" e passa a pedir CONFIRMAÇÃO. O
              singular "esta nota" é a nota DA TELA — o alvo —, não os
              candidatos; por isso não pluraliza com a contagem. */}
          {salvando
            ? "Ligando…"
            : marcadosDeVerdade.length === 0
              ? "Marque ao menos um pagamento"
              : algumComVinculoPrevio
                ? `Confirmar ligação também a esta nota — ${formatarBRL(somaMarcados)}`
                : `Ligar ${marcadosDeVerdade.length} ${marcadosDeVerdade.length === 1 ? "pagamento" : "pagamentos"} — ${formatarBRL(somaMarcados)}`}
        </BotaoSalvar>
        <BotaoLink href={`/documento/${d.id}`}>Cancelar</BotaoLink>
      </RodapeDeAcao>
    </>
  );
}
