"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import {
  ListaDeAnexos,
  papelOriginal,
  SEM_PAPEL_NO_ACERVO,
} from "@/app/_components/anexo";
import {
  AppBar,
  Banner,
  BarraAdicionar,
  BotaoLink,
  Card,
  Carregando,
  Chip,
  Consequencia,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
} from "@/app/_components/ui";
import { HistoricoDeCorrecoes } from "@/app/_components/corrigir";
import { BlocoRetencao } from "@/app/_components/retencao";
import { useSessao } from "@/app/_components/sessao";
import {
  carregarAnexosDoDocumento,
  carregarCorrecoesDoDocumento,
  carregarDocumento,
  carregarObras,
  carregarPainel,
  classificarErro,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import { formatarDocumento } from "@/lib/fiscal/identificacao";
import {
  CHIP_NOTA_SEM_ARQUIVO,
  exigeCnoReferenciado,
  exigeIdentificacaoDaNota,
  faltaOArquivo,
  GUARDA_ABATE_INSS_ROTULO,
  GUARDA_RESPOSTA_NAO,
  GUARDA_SUSTENTA_CUSTO_ROTULO,
  NOTA_SEM_ARQUIVO_ALAVANCA,
  NOTA_SEM_ARQUIVO_EFEITO,
  PENDENCIA_IDENTIFICACAO_EFEITO,
  PENDENCIA_IDENTIFICACAO_TITULO,
} from "@/lib/fiscal/documento";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { RETENCAO_NAO_ABATE_SERO } from "@/lib/fiscal/retencao";
import {
  alocarCusto,
  notaCoberta,
  VINCULO_BOLETO_NAO_GERA_CUSTO,
  VINCULO_QUARENTENA_NAO_GERA_CUSTO,
  VINCULO_SEM_ARQUIVO_NAO_GERA_CUSTO,
  type DocumentoAlocado,
} from "@/lib/fiscal/vinculo";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import type {
  Classificacao,
  Documento,
  Revisao,
  TipoDocumento,
} from "@/lib/types";

const NOME_TIPO: Record<TipoDocumento, string> = {
  nf_material: "NF de material",
  nf_servico: "NF de serviço",
  boleto: "Boleto",
};

const NOME_CLASSIFICACAO: Record<Classificacao | "indefinida", string> = {
  material: "Material",
  mao_obra: "Mão de obra",
  indefinida: "—",
};

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      documento: Documento;
      painel: PainelDados;
      /** Critério 16 — o rastro é EXIBIDO já na rodada 1. */
      correcoes: Revisao[];
      /**
       * CONTAI-027, critério 2 — "a lista inteira". Os anexos ADICIONAIS da
       * `documento_anexo` (0009) andam junto com o `arquivo_path`: a carta de
       * correção que chegou depois é acervo deste documento, e antes deste
       * ticket ela não aparecia em tela nenhuma.
       */
      anexos: string[];
      /** Nome de cada obra: o rastro grava id, e id não se lê em 2034. */
      obras: Map<string, string>;
    };

/**
 * O bloco que este ticket acrescenta (mock s1, s6, s7, s8) — caminho B do
 * critério 2. Aparece em TODO ramo de render, inclusive quarentena e boleto:
 * vincular é permitido nos dois (critérios 8 e 9), e é o vínculo que permite a
 * dedup da despesa. O que muda entre eles é o que a tela diz sobre o custo.
 */
function PagamentosDesteDocumento({
  documento,
  alocado,
  ano,
  ligado,
}: {
  documento: Documento;
  alocado: DocumentoAlocado | undefined;
  ano: number;
  ligado: boolean;
}) {
  const pagamentos = alocado?.pagamentos ?? [];
  const habil = alocado?.habil ?? true;
  const valor = documento.valorCentavos ?? 0;
  /**
   * ⚠️ CONTAI-033 — achado no teste manual no browser: `ehDocumentoHabil`
   * agora tem TRÊS motivos para devolver `false` (boleto, quarentena, sem
   * arquivo), e este bloco só sabia distinguir dois — uma nota `registrado`
   * sem arquivo caía no `else` e mostrava o texto de QUARENTENA. Precedência:
   * boleto nunca é hábil por tipo; senão, quarentena é a razão mais grave
   * quando as duas coexistem (a nota também está fora do CPF do dono); só
   * então "sem arquivo".
   */
  const motivoNaoGeraCusto =
    documento.tipo === "boleto"
      ? VINCULO_BOLETO_NAO_GERA_CUSTO
      : documento.status === "quarentena"
        ? VINCULO_QUARENTENA_NAO_GERA_CUSTO
        : VINCULO_SEM_ARQUIVO_NAO_GERA_CUSTO;

  const acoes = (
    <>
      <div className="mt-2.5">
        <BotaoLink href={`/documento/${documento.id}/ligar`} variante="primary">
          Ligar a um pagamento
        </BotaoLink>
      </div>
      <div className="mt-2">
        <BotaoLink href={`/adicionar/pagamento?documento=${documento.id}`}>
          Registrar o pagamento desta nota
        </BotaoLink>
      </div>
    </>
  );

  if (pagamentos.length === 0) {
    return (
      <Card className="border-amb">
        <Chip cor="amb">Sem pagamento ligado</Chip>
        <div className="mt-1.5 font-semibold">Pagamentos desta nota</div>
        <Dica>Nenhum pagamento ligado a este documento.</Dica>
        {habil ? (
          <Consequencia cor="amb">
            O custo <strong>existe</strong> — o app é que ainda não consegue
            demonstrar. Sem um pagamento ligado, estes {formatarBRL(valor)} não
            entram no <strong>Custo confirmado de {ano}</strong>.
          </Consequencia>
        ) : (
          <Consequencia cor="red">{motivoNaoGeraCusto}</Consequencia>
        )}
        {acoes}
      </Card>
    );
  }

  // Excedente do lado do pagamento: o que foi pago além do que esta nota
  // documenta continua como "pago sem nota" (parecer §3).
  const excedentePagamento = pagamentos.length > 0 ? valorSemNota(alocado) : 0;

  return (
    <>
      {ligado ? (
        <Banner cor="grn" role="status">
          <strong>Ligado.</strong> A nota e o pagamento agora são{" "}
          <strong>uma despesa só</strong>.
        </Banner>
      ) : null}

      <Card className={habil ? "border-grn" : "border-red"}>
        <Chip cor={habil ? "grn" : "red"}>
          {habil ? "Custo comprovado" : "Não gera custo confirmado"}
        </Chip>
        <div className="mono mt-1.5 text-[26px] font-bold tracking-tight">
          {formatarBRL(alocado?.cobertoCentavos ?? 0)}
        </div>
        {habil ? (
          <Dica>
            entra no custo de aquisição pela <strong>data do pagamento</strong>{" "}
            — regime de caixa
          </Dica>
        ) : (
          <Consequencia cor="red">{motivoNaoGeraCusto}</Consequencia>
        )}
        {alocado && alocado.excedenteNotaCentavos > 0 ? (
          <>
            <Linha rotulo="Excedente da nota">
              <span className="mono font-semibold text-amb">
                {formatarBRL(alocado.excedenteNotaCentavos)} — nota ainda não
                paga
              </span>
            </Linha>
            <Consequencia cor="amb">
              Este pedaço da nota <strong>não vira custo</strong>: regime de
              caixa — sem desembolso não há dispêndio. Ele passa a contar
              quando o pagamento existir e for ligado aqui.
            </Consequencia>
          </>
        ) : null}
        {excedentePagamento > 0 ? (
          <>
            <Linha rotulo="Excedente do pagamento">
              <span className="mono font-semibold text-amb">
                {formatarBRL(excedentePagamento)} — pago sem nota
              </span>
            </Linha>
            <Consequencia cor="amb">
              Você pagou além do que esta nota documenta. Esse valor continua
              como <strong>pago sem nota</strong> até chegar uma nota que o
              cubra.
            </Consequencia>
          </>
        ) : null}
      </Card>

      <Card>
        <div className="font-semibold">Pagamentos desta nota</div>
        {pagamentos.map((p) => (
          <div key={p.id} className="mt-2 border-t border-line pt-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px]">
                {formatarDataBR(p.dataPagamento)} ·{" "}
                {p.favorecidoNome ?? "favorecido não informado"}
              </span>
              <span className="mono flex-none text-[13.5px]">
                {formatarBRL(p.valorCentavos)}
              </span>
            </div>
            {/* CONTAI-037 — a porta que faltava: navegação (neutra) antes da
                ação de estado, mesma ordem da tela irmã `/pagamento/[id]`, que
                já linka na direção inversa ("Ver o documento"). */}
            <div className="mt-2 flex flex-col gap-2">
              <BotaoLink href={`/pagamento/${p.id}`}>Ver o pagamento</BotaoLink>
              <BotaoLink
                href={`/documento/${documento.id}/desligar?pagamento=${p.id}`}
              >
                Desligar este pagamento
              </BotaoLink>
            </div>
          </div>
        ))}
        {acoes}
      </Card>
    </>
  );
}

/** Soma do que os pagamentos DESTA nota têm de excedente sobre ela. */
function valorSemNota(alocado: DocumentoAlocado | undefined): number {
  if (!alocado) return 0;
  const pagos = alocado.pagamentos.reduce((s, p) => s + p.valorCentavos, 0);
  const documentado = alocado.habil ? (alocado.documento.valorCentavos ?? 0) : 0;
  return Math.max(0, pagos - documentado);
}

function DetalheDocumento() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { pedirReautenticacao } = useSessao();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  // `useSearchParams`, e NÃO `window.location` lido no primeiro render: em
  // navegação do lado do cliente (`router.push` do seletor) o `location` ainda
  // não tinha a query no render de montagem, e a confirmação simplesmente não
  // aparecia. É o que a fronteira de Suspense abaixo paga.
  const ligado = useSearchParams().get("ligado") === "1";

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const documento = await carregarDocumento(id);
        // O painel da obra inteira: é dele que saem os pagamentos ligados e o
        // cálculo do custo comprovado deste conjunto.
        const painel = await carregarPainel(documento.obraId);
        const [correcoes, obras, anexos] = await Promise.all([
          carregarCorrecoesDoDocumento(documento.id, documento.favorecidoId),
          carregarObras(),
          carregarAnexosDoDocumento(documento.id),
        ]);
        if (cancelado) return;
        setEstado({
          fase: "pronto",
          documento,
          painel,
          correcoes,
          obras: new Map(obras.map((o) => [o.id, o.nome])),
          anexos,
        });
      } catch (erro) {
        if (!cancelado) {
          setEstado({ fase: "erro", erro: classificarErro(erro) });
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ fase: "carregando" });
    setTentativa((t) => t + 1);
  }, []);

  if (estado.fase !== "pronto") {
    return (
      <>
        <AppBar titulo="Documento" />
        <Corpo>
          {estado.fase === "carregando" ? (
            <Carregando rotulo="Carregando o documento" />
          ) : (
            <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
          )}
        </Corpo>
        <BarraAdicionar
          voltar={<BotaoLink href="/">Voltar ao início</BotaoLink>}
        />
      </>
    );
  }

  const d = estado.documento;
  const obra = estado.painel.obra;
  const alocacao = alocarCusto(estado.painel);
  const alocado = alocacao.porDocumento.get(d.id);
  const ano = Number(hojeIso().slice(0, 4));
  const sub = `${NOME_TIPO[d.tipo]}${d.favorecidoNome ? ` · ${d.favorecidoNome}` : ""}`;
  const valor = d.valorCentavos === null ? "—" : formatarBRL(d.valorCentavos);

  const blocoPagamentos = (
    <PagamentosDesteDocumento
      documento={d}
      alocado={alocado}
      ano={ano}
      ligado={ligado}
    />
  );

  /**
   * ⚠️ CONTAI-027, critério 2 — este detalhe não mostrava NEM o nome do
   * arquivo. Agora mostra a lista inteira: o original e os anexos que vieram
   * depois, cada um com Abrir.
   *
   * O original vem primeiro e sempre: `arquivo_path` é a nota que originou o
   * registro. Os adicionais vêm na ordem em que chegaram — é a ordem em que
   * quem abrir o dossiê em 2034 vai querer lê-los.
   */
  const blocoAnexos = (
    <Card>
      {/* ⚠️ O original pode NÃO EXISTIR desde o CONTAI-033 (`arquivo_path` é
          nullable). `papelOriginal` devolve lista vazia em vez de um item que
          não abre nada — e o `vazio` diz o fato, porque "sem papel" tem
          consequência fiscal e lista vazia muda não diz nada. */}
      <ListaDeAnexos
        titulo="Papéis deste documento"
        itens={[
          ...papelOriginal(d.arquivoPath),
          ...estado.anexos.map((path) => ({ path })),
        ]}
        vazio={SEM_PAPEL_NO_ACERVO}
      />
    </Card>
  );

  /**
   * ⚠️ **CONTAI-033 — a pendência "Nota sem arquivo", e ela é ADITIVA.**
   *
   * Confirmação do `contador` em 2026-09-19: as guardas não são mutuamente
   * exclusivas. Um documento pode estar em quarentena (CPF divergente) **e** sem
   * arquivo ao mesmo tempo, e tem de aparecer nas DUAS — mostrar só uma reabre
   * o buraco D47 que a guarda existe para fechar. Por isso este bloco **não é
   * um quarto `return`**: ele é inserido nos três que já existem.
   *
   * Textos LITERAIS do §A.7.2, lidos das constantes. As duas linhas de guarda
   * são as do `contador` de 2026-09-19 ("Sustenta custo de aquisição: não" /
   * "Abate no INSS: não") — o rótulo original do mock colidia com
   * `custoConfirmadoAnoCentavos` e se lia como "a obra não tem custo".
   *
   * VERMELHO pela régua do ADENDO 2 §A.4: sem apoio hábil nenhum — o arquivo
   * que falta É o documento hábil.
   */
  const blocoSemArquivo = faltaOArquivo(d) ? (
      <Card className="border-red" data-pendencia="documento-sem-arquivo">
        <Chip cor="red">{CHIP_NOTA_SEM_ARQUIVO}</Chip>
        <Consequencia cor="red">
          <strong>{CHIP_NOTA_SEM_ARQUIVO}.</strong> {NOTA_SEM_ARQUIVO_EFEITO}{" "}
          {NOTA_SEM_ARQUIVO_ALAVANCA}
        </Consequencia>
        {/* As guardas 1 e 2, visíveis em tela e não só no banco. */}
        <Linha rotulo={GUARDA_SUSTENTA_CUSTO_ROTULO}>
          <span className="font-semibold text-red">{GUARDA_RESPOSTA_NAO}</span>
        </Linha>
        <Linha rotulo={GUARDA_ABATE_INSS_ROTULO}>
          <span className="font-semibold text-red">{GUARDA_RESPOSTA_NAO}</span>
        </Linha>
        {/* Decisão de design 4 do mock: frase NEUTRA, sem inventar um selo de
            "respondido de memória" — qualquer redação mais forte seria
            consequência fiscal nova, fora do texto adjudicado. */}
        <Linha rotulo="CPF / retenção">
          respondidas — sem o papel para conferir
        </Linha>
        <div className="mt-2.5">
          <BotaoLink href={`/documento/${d.id}/anexar`} variante="primary">
            Anexar o arquivo agora
          </BotaoLink>
        </div>
      </Card>
    ) : null;

  /**
   * CONTAI-004, critério 9 — a identificação da nota, em TODAS as telas deste
   * detalhe. "Dado que entra e não se confere é dado que não entrou": o número
   * é o que identifica a nota na discriminação anual e numa intimação, e é por
   * ele que se acha o papel no meio de 400-600 arquivos daqui a oito anos.
   *
   * ⚠️ O rótulo da data repete aqui o que o formulário diz: ela NÃO decide o
   * ano do custo. Quem decide é a data do pagamento (regime de caixa) — e é
   * exatamente nesta tela, com as duas datas por perto, que a troca
   * aconteceria.
   *
   * Boleto não tem bloco: os campos não são perguntados nele (R5).
   */
  const faltaIdentificacao =
    exigeIdentificacaoDaNota(d.tipo) && (!d.numero || !d.dataEmissao);

  const blocoIdentificacao = exigeIdentificacaoDaNota(d.tipo) ? (
    <>
      <Card>
        {/* Literal, como foi digitado: zeros à esquerda e letras contam. E a
            série aparece SEPARADA do número (R6) — juntá-las numa string só é
            a mesma confusão que a coluna própria evita.

            Sem série, o rótulo nem menciona série e o "/ —" some: a maioria
            das NFS-e municipais não tem série, e um traço fixo no caso comum
            é ruído que se lê como dado faltando. */}
        <Linha rotulo={d.serie ? "Nº / série" : "Nº da nota"}>
          <span className="mono">
            {d.serie ? `${d.numero ?? "—"} / ${d.serie}` : (d.numero ?? "—")}
          </span>
        </Linha>
        <Linha rotulo="Emissão">
          <span className="mono">
            {d.dataEmissao ? formatarDataBR(d.dataEmissao) : "—"}
          </span>
        </Linha>
        {/* CONTAI-007 — o CNO impresso, no bloco ASCII do mock do CONTAI-004.
            Só em NF de serviço: é o único tipo em que a pergunta existe.

            ⚠️ Mostra o NÚMERO, e não "desta obra ✓", quando a nota traz CNO:
            é o número que está no papel, e é comparando-o com o CNO da obra
            que uma divergência posterior (obra corrigida, nota movida) fica
            visível em vez de sumir atrás de um carimbo. */}
        {exigeCnoReferenciado(d.tipo) ? (
          <Linha rotulo="CNO na nota">
            {d.notaTrazCno === true ? (
              <span className="mono">{d.cnoReferenciado}</span>
            ) : d.notaTrazCno === false ? (
              <span className="font-semibold text-amb">não traz CNO</span>
            ) : (
              <span className="text-mut">não perguntado</span>
            )}
          </Linha>
        ) : null}
        {/* ══ CONTAI-038 — o gate, e o invariante do SERO ══════════════════
            As duas linhas ficam aqui, no card de identificação, e não num
            card próprio: no caso comum ("nenhuma destacada") um card inteiro
            seria ruído — é um fato da nota, como o número e o CNO.

            ⚠️ "Abate no INSS (SERO): não" vale para TODA NF de serviço,
            qualquer que seja o gate, e é o §2 do parecer de 2026-09-18 dito
            em tela: nenhum percentual de retenção abate a aferição. Quem
            abate é a declaração vinculada ao CNO, que é outro ato. */}
        {d.tipo === "nf_servico" ? (
          <>
            <Linha rotulo="Retenção">
              {d.retencaoNaNota === "nenhuma" ? (
                "nenhuma destacada nesta nota"
              ) : d.retencaoNaNota === "destacada" ? (
                <span className="font-semibold">destacada na nota</span>
              ) : (
                <span className="text-mut">não perguntado</span>
              )}
            </Linha>
            <Linha rotulo="Abate no INSS (SERO)">
              <span className="font-semibold text-red">não</span>
            </Linha>
          </>
        ) : null}
        <Dica>
          A emissão identifica a nota e a janela do CNO. O ano do custo é o do
          pagamento.
        </Dica>
        {d.tipo === "nf_servico" ? <Dica>{RETENCAO_NAO_ABATE_SERO}</Dica> : null}
      </Card>
      {faltaIdentificacao ? (
        // Critério 13 / parecer §4: ÂMBAR, nunca vermelha, e sem "custo em
        // risco" — seria falso. O documento hábil está no acervo e continua
        // valendo; o que se perde é a identificação na discriminação e a
        // presença na lista de cobrança do CNO.
        <Card className="border-amb">
          <Chip cor="amb">{PENDENCIA_IDENTIFICACAO_TITULO}</Chip>
          <p className="mt-2.5 text-[13.5px]">
            {PENDENCIA_IDENTIFICACAO_EFEITO}
          </p>
        </Card>
      ) : null}
    </>
  ) : null;

  /**
   * ⚠️ **CONTAI-038 — o bloco "Retenção", e ele é ADITIVO como
   * `blocoSemArquivo`.** Entra em TODAS as ramificações de render (quarentena
   * e normal), nunca como um `return` antecipado: a tela dedicada "NF de
   * serviço sem retenção" (a Tela 7 do mock do CONTAI-004) **foi removida por
   * inteiro**, porque ela existia para anunciar uma consequência que o parecer
   * de 2026-09-18 derrubou — "sem retenção → não abate o INSS" nunca foi a
   * regra (§2). Nota de material e boleto nunca mostram este bloco.
   *
   * `notaCoberta` é a MESMA função que a home usa (`lib/fiscal/vinculo.ts`) —
   * a tela não escreve uma segunda soma de "quanto desta nota já foi pago", e
   * não repete o predicado: repetido, ele divergiria no dia em que só um dos
   * dois lados fosse ajustado (Gate 2 do CONTAI-038).
   */
  const blocoRetencao = (
    <BlocoRetencao
      documento={d}
      notaCoberta={notaCoberta(d, alocacao)}
      onMudou={tentarDeNovo}
      onSessaoExpirada={pedirReautenticacao}
    />
  );

  /**
   * A obra deste registro, sempre visível e sempre corrigível: o erro de obra é
   * silencioso, descoberto tarde, e sem conserto pela interface voltaria a
   * exigir SQL (dor D9).
   */
  const blocoObra = (
    <Card>
      <Linha rotulo="Obra">{obra.nome}</Linha>
      <div className="mt-2">
        <BotaoLink href={`/documento/${d.id}/obra`}>
          Corrigir a obra deste registro
        </BotaoLink>
      </div>
    </Card>
  );

  /**
   * CONTAI-021 — as entradas das TRÊS AÇÕES NOMEADAS, e as duas saídas sem
   * campo. Não é um "editar documento" com N campos: os campos têm regimes de
   * consequência diferentes, e o campo proibido sentado ao lado dos editáveis
   * é o convite a inventar dado no campo que sobrou (decisão do `cto-obra`).
   */
  const blocoCorrigir = (
    <Card>
      <div className="font-semibold">Corrigir este registro</div>
      <Dica>
        Cada correção é uma ação separada, porque cada uma muda uma coisa
        diferente na sua declaração. Todas ficam registradas.
      </Dica>
      <div className="mt-2 flex flex-col gap-2">
        <BotaoLink href={`/documento/${d.id}/corrigir/valor`}>
          Corrigir o valor — hoje: {valor}
        </BotaoLink>
        <BotaoLink href={`/documento/${d.id}/corrigir/classificacao`}>
          Corrigir a classificação — hoje:{" "}
          {NOME_CLASSIFICACAO[d.classificacao ?? "indefinida"].toLowerCase()}
        </BotaoLink>
        <BotaoLink href={`/documento/${d.id}/corrigir/emitente`}>
          Corrigir o nome do emitente — vale para todos os registros dele
        </BotaoLink>
        <BotaoLink href={`/documento/${d.id}/cnpj-errado`}>
          O CNPJ/CPF do emitente está errado — e agora?
        </BotaoLink>
        <BotaoLink href={`/documento/${d.id}/outro-dado`}>
          Está errado outro dado, que não está nesta lista
        </BotaoLink>
      </div>
    </Card>
  );

  const blocoHistorico = (
    <HistoricoDeCorrecoes
      correcoes={estado.correcoes}
      obras={estado.obras}
      /* CONTAI-008, critério 14: a linha de `vinculo` guarda o id do documento.
         Esta tela conhece UM documento — o dela —, e é justamente ele que
         aparece quando o vínculo se desfez aqui. */
      documentos={
        new Map([
          [
            d.id,
            `${NOME_TIPO[d.tipo]}${d.numero ? ` nº ${d.numero}` : ""}`,
          ],
        ])
      }
      cnpj={
        d.favorecidoDocumento ? formatarDocumento(d.favorecidoDocumento) : null
      }
    />
  );

  // Tela 6 do mock — documento fora do CPF do dono.
  if (d.status === "quarentena") {
    return (
      <>
        <AppBar titulo="Quarentena" sub={sub} />
        <Corpo>
          <Banner cor="red" role="alert">
            <strong>Este documento não está no seu CPF.</strong>{" "}
            {d.motivoQuarentena}
          </Banner>
          <Card>
            <Linha rotulo="Valor do documento">
              <span className="mono">{valor}</span>
            </Linha>
            <Linha rotulo="Se não corrigir">
              <span className="font-semibold text-red">
                fora do custo de aquisição
              </span>
            </Linha>
          </Card>
          <Dica>
            Peça ao fornecedor a nota corrigida com você como destinatário — é a
            saída que preserva o custo. Enquanto isso o documento fica no
            acervo, mas fora do IR.
          </Dica>
          {blocoIdentificacao}
          {blocoRetencao}
          {blocoSemArquivo}
          {blocoAnexos}
          {/* Critério 8: vincular quarentena é permitido — é o que evita
              contar a mesma despesa duas vezes — e não gera custo. */}
          {blocoPagamentos}
          {blocoObra}
          {blocoCorrigir}
          {blocoHistorico}
        </Corpo>
        <BarraAdicionar
          voltar={
            <BotaoLink href="/" variante="primary">
              Voltar ao início
            </BotaoLink>
          }
        />
      </>
    );
  }

  // ⚠️ **A "Tela 7" MORREU AQUI** (CONTAI-038): o `return` antecipado de "NF de
  // serviço sem retenção" existia para anunciar *"não abate na aferição do
  // INSS"* a partir do booleano de 11% — a premissa que o §2 do parecer
  // de 2026-09-18 chama de "o achado mais grave". Uma NF de serviço no CPF
  // dele, paga e com o papel no acervo é custo CONFIRMADO, e dar a ela uma tela
  // própria de alerta afirmava o oposto da verdade fiscal do documento.
  //
  // O que sobrou dela e continua valendo está no render normal: o gate e a
  // linha "Abate no INSS (SERO): não" no bloco de identificação, e o repeater
  // em `blocoRetencao`.

  return (
    <>
      <AppBar titulo={NOME_TIPO[d.tipo]} sub={d.favorecidoNome ?? undefined} />
      <Corpo>
        <Card>
          <Linha rotulo="Valor">
            <span className="mono">{valor}</span>
          </Linha>
          {d.vencimento ? (
            <Linha rotulo="Vencimento">
              <span className="mono">{d.vencimento}</span>
            </Linha>
          ) : null}
          <Linha rotulo="Destinatário">
            <span className="font-semibold text-grn">Seu CPF ✓</span>
          </Linha>
          <Linha rotulo="Classificação">
            {/* Sem classificação gravada não se inventa uma: "—" é honesto. */}
            {NOME_CLASSIFICACAO[d.classificacao ?? "indefinida"]}
          </Linha>
        </Card>
        {d.status === "aguardando_pagamento" ? (
          <Banner cor="amb" role="status">
            Boleto não é documento hábil sozinho. O custo só se sustenta com a
            NF e a prova de pagamento.
          </Banner>
        ) : null}
        {blocoIdentificacao}
        {blocoRetencao}
        {blocoSemArquivo}
        {blocoAnexos}
        {blocoPagamentos}
        {blocoObra}
        {blocoCorrigir}
        {blocoHistorico}
      </Corpo>
      <BarraAdicionar
        voltar={
          <BotaoLink href="/" variante="primary">
            Voltar ao início
          </BotaoLink>
        }
      />
    </>
  );
}

/**
 * A fronteira que `useSearchParams` exige (Next 16): sem ela o build reclama
 * de "URL data in a Client Component outside of Suspense".
 */
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando rotulo="Carregando o documento" />}>
      <DetalheDocumento />
    </Suspense>
  );
}
