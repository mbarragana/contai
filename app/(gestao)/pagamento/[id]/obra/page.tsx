"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CabecalhoDaTela,
  ColunaDeDetalhe,
  RodapeDeAcao,
} from "@/app/_components/detalhe";
import { useSessao } from "@/app/_components/sessao";
import {
  Banner,
  BotaoLink,
  BotaoSalvar,
  Card,
  Carregando,
  Chip,
  Consequencia,
  Dica,
  ErroDeGravacao,
  EstadoErro,
  Linha,
  Passo,
} from "@/app/_components/ui";
import {
  carregarPagamento,
  carregarPaineis,
  classificarErro,
  mensagemDeErroDeGravacao,
  moverPagamentoDeObra,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import { bordaDaGravidade } from "@/lib/fiscal/gravidade";
import { formatarDataBR, podeCorrigirObra } from "@/lib/fiscal/obra";
import {
  anosAfetados,
  anosComPendencia,
  anosDaAlocacao,
  AVISO_ANO_ANTERIOR,
  DESFECHO_NOTA_VAI_JUNTO,
  desfechoNotaFicaNaOrigem,
  documentosImpedidosDeIrJunto,
  documentosVinculados,
  DOCUMENTO_LIGADO_A_OUTRO_PAGAMENTO,
  GRAVIDADE_CORRECAO_ANO_ANTERIOR,
  MOVE_DE_PAGAMENTO_SEM_VINCULO,
  MOVE_NAO_PERGUNTA_MOTIVO,
  resumoDesfechoMistoDoPagamento,
  semNotaDoAno,
  SEM_TERCEIRA_SAIDA,
  simularMovePagamentoDeObra,
  SO_SEI_QUE_E_ANO_ANTERIOR,
  type DesfechoDoDocumento,
  type EscolhaDeDocumento,
} from "@/lib/fiscal/revisao";
import { alocarCusto, custoComprovadoDoAno } from "@/lib/fiscal/vinculo";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import type { AnoAfetado, Documento, Obra, Pagamento } from "@/lib/types";

const NOME_TIPO = {
  nf_material: "NF de material",
  nf_servico: "NF de serviço",
  boleto: "Boleto",
} as const;

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | { fase: "pronto"; pagamento: Pagamento; paineis: PainelDados[] }
  | {
      fase: "movido";
      pagamento: Pagamento;
      origem: Obra;
      destino: Obra;
      anos: AnoAfetado[];
      comPendencia: boolean;
    };

/**
 * **CONTAI-008 — corrigir a obra deste PAGAMENTO.** O espelho da tela 8 do
 * CONTAI-021: lá é documento → N pagamentos, aqui é pagamento → N documentos.
 *
 * ⚠️ `app/_components/corrigir-obra.tsx` **foi apagado neste ticket**
 * (critério 15), e o apagamento é a decisão: aquele componente era o último
 * caminho que gravava `obra_id` com um `UPDATE` seco, e depois do 021 ele tinha
 * ficado **sem dono** — "componente compartilhado que sobrou de uma bifurcação
 * é o próximo a receber 'só mais um parâmetro'". As duas telas perguntam coisas
 * diferentes porque os dois lados têm regimes de consequência diferentes; uma
 * parametrização as uniria de novo.
 *
 * O que esta tela faz e a anterior não fazia (adendo §5.1, direção espelhada):
 * mover um pagamento com nota vinculada **não é transferência, é evaporação** —
 * o custo cai na origem, nada sobe no destino, "pago sem nota" sobe NO DESTINO
 * por um fato que não aconteceu, e sobra vínculo cruzando duas obras. Por isso
 * cada documento é resolvido **um a um, em ato explícito** (§4.4 — cascata
 * silenciosa é proibida), e o ato **não conclui com documento indeciso**.
 *
 * ⚠️ **O CNO NÃO BLOQUEIA NADA AQUI** (parecer
 * `docs/pareceres/2026-09-20-cno-nao-bloqueia-correcao-de-obra.md`, que
 * substituiu a resposta de 24/08 à pergunta 1 do Gate Fiscal e riscou o
 * critério 16): os dois desfechos ficam **sempre** disponíveis para toda nota,
 * e a divergência de CNO aparece como AVISO na linha daquela nota. O mock
 * (`design/mocks/CONTAI-008.html`, tela p3) desenha a opção (i) desabilitada em
 * vermelho — **divergência declarada, não silenciada**: o mock é de 24/08 e a
 * regra mudou em 20/09. O parecer vence o mock.
 */
export default function CorrigirObraDoPagamento() {
  const { id } = useParams<{ id: string }>();
  const { pedirReautenticacao } = useSessao();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, DesfechoDoDocumento>>(
    {},
  );
  const [gravando, setGravando] = useState(false);
  const [erroGravar, setErroGravar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const pagamento = await carregarPagamento(id);
        // Os painéis das DUAS obras: o "depois" da origem e o "depois" do
        // destino saem da mesma `alocarCusto` que produz o número da home.
        const paineis = await carregarPaineis();
        if (cancelado) return;
        setEstado({ fase: "pronto", pagamento, paineis });
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
    setErroGravar(null);
    setTentativa((t) => t + 1);
  }, []);

  const pronto = estado.fase === "pronto" ? estado : null;
  const ano = Number(hojeIso().slice(0, 4));

  const conta = useMemo(() => {
    if (!pronto) return null;
    const pag = pronto.pagamento;
    const origem = pronto.paineis.find((p) => p.obra.id === pag.obraId);
    if (!origem) return null;
    const destino = pronto.paineis.find((p) => p.obra.id === destinoId) ?? null;

    const vinculados = documentosVinculados(pag, origem.documentos);
    const impedidos = documentosImpedidosDeIrJunto(
      pag,
      origem.documentos,
      origem.pagamentos,
    );
    const respondidos = vinculados.filter((d) => escolhas[d.id]);
    const completo = destino !== null && respondidos.length === vinculados.length;

    if (!destino || !completo) {
      return { origem, destino, vinculados, impedidos, completo: false as const };
    }

    const lista: EscolhaDeDocumento[] = vinculados.map((d) => ({
      documentoId: d.id,
      desfecho: escolhas[d.id],
    }));

    const simulado = simularMovePagamentoDeObra({
      pagamento: pag,
      origem: {
        obraId: origem.obra.id,
        documentos: origem.documentos,
        pagamentos: origem.pagamentos,
      },
      destino: {
        obraId: destino.obra.id,
        documentos: destino.documentos,
        pagamentos: destino.pagamentos,
      },
      escolhas: lista,
    });

    const origemAntes = alocarCusto(simulado.origemAntes);
    const origemDepois = alocarCusto(simulado.origemDepois);
    const destinoAntes = alocarCusto(simulado.destinoAntes);
    const destinoDepois = alocarCusto(simulado.destinoDepois);

    // ⚠️ As obras CANDIDATAS são `antes ∪ depois` do campo `obra` do ato —
    // origem e destino —, nunca `pagamento.obra_id` (adendo §5.4). O filtro
    // "afetada é a candidata cujo custo mudou" está dentro de `anosAfetados`.
    const anos = anosAfetados(
      [
        { obraId: origem.obra.id, antes: origemAntes, depois: origemDepois },
        { obraId: destino.obra.id, antes: destinoAntes, depois: destinoDepois },
      ],
      ano,
    );

    const vaoJunto = vinculados.filter((d) => escolhas[d.id] === "vai_junto");
    const ficam = vinculados.filter((d) => escolhas[d.id] === "fica_na_origem");
    const soma = (ds: Documento[]) =>
      ds.reduce((s, d) => s + (d.valorCentavos ?? 0), 0);

    // ⚠️ Os dois números do resumo do desfecho misto vêm DA ALOCAÇÃO, nunca da
    // soma das notas escolhidas (bloqueante 1 do Gate 2 do 021, redigido pelo
    // `contador`): partição e queda só coincidem quando Σ notas ≤ Σ pagamentos,
    // e fora disso a soma superestima — inflando o alarme sobre o número da
    // meta 1. Aqui o "pago sem nota" sobe no DESTINO, que é para onde o
    // pagamento vai.
    const semNotaSobe = anosDaAlocacao(destinoAntes, destinoDepois).reduce(
      (acc, a) =>
        acc + semNotaDoAno(destinoDepois, a) - semNotaDoAno(destinoAntes, a),
      0,
    );
    const queda = anos.reduce(
      (acc, a) => acc + (a.antesCentavos - a.depoisCentavos),
      0,
    );

    return {
      origem,
      destino,
      vinculados,
      impedidos,
      completo: true as const,
      lista,
      anos,
      origemAntes,
      origemDepois,
      destinoAntes,
      destinoDepois,
      misto: vaoJunto.length > 0 && ficam.length > 0,
      totalCentavos: soma(vinculados),
      juntoCentavos: soma(vaoJunto),
      ficaCentavos: soma(ficam),
      semNotaSobeCentavos: semNotaSobe,
      quedaCentavos: queda,
    };
  }, [pronto, destinoId, escolhas, ano]);

  /**
   * ⚠️ **A revalidação de CNO é POR DOCUMENTO** (critério 3), e roda só quando
   * há destino escolhido — sem destino não há CNO contra o que comparar.
   *
   * Ela **não decide nada**: `podeCorrigirObra` devolve `permitido: true`
   * sempre, e o que ela produz é o `aviso`. Não existe o ramo "opção
   * indisponível" que o critério 16 descrevia antes de 20/09; o próprio
   * critério diz, hoje, que fica riscado.
   */
  const avisoDeCno = useCallback(
    (d: Documento): string | null => {
      if (!conta?.destino) return null;
      return podeCorrigirObra({
        tipo: d.tipo,
        cnoReferenciado: d.cnoReferenciado,
        cnoDestino: conta.destino.obra.cno,
      }).aviso;
    },
    [conta],
  );

  const impedeAlgum =
    conta?.impedidos.some((d) => escolhas[d.id] === "vai_junto") ?? false;

  const podeGravar = conta?.completo === true && !impedeAlgum;

  async function gravar() {
    if (!pronto || !conta || conta.completo !== true || !conta.destino) return;
    setGravando(true);
    setErroGravar(null);
    try {
      await moverPagamentoDeObra(
        pronto.pagamento.id,
        conta.destino.obra.id,
        conta.lista,
        conta.anos,
      );
      setEstado({
        fase: "movido",
        pagamento: pronto.pagamento,
        origem: conta.origem.obra,
        destino: conta.destino.obra,
        anos: conta.anos,
        comPendencia: conta.anos.some((a) => a.pendencia),
      });
    } catch (erro) {
      setGravando(false);
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroGravar(mensagemDeErroDeGravacao(erro, "no detalhe do pagamento, para ver em qual obra ele está"));
    }
  }

  // ── Carregando / erro ──────────────────────────────────────────────────
  if (estado.fase === "carregando" || estado.fase === "erro") {
    return (
      <>
        <CabecalhoDaTela titulo="Corrigir a obra deste pagamento" />
        <ColunaDeDetalhe>
          {estado.fase === "erro" ? (
            <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando o pagamento e as obras" />
          )}
        </ColunaDeDetalhe>
      </>
    );
  }

  // ── Gravado ────────────────────────────────────────────────────────────
  if (estado.fase === "movido") {
    return (
      <>
        <CabecalhoDaTela titulo="Obra corrigida ✓" sub={estado.destino.nome} />
        <ColunaDeDetalhe>
          <Banner cor="grn" role="status">
            Este pagamento agora está em <strong>{estado.destino.nome}</strong>.
            A correção ficou registrada, com a data, no histórico.
          </Banner>

          {estado.anos.length === 0 ? (
            <Card>
              <Dica>{MOVE_DE_PAGAMENTO_SEM_VINCULO}</Dica>
            </Card>
          ) : (
            <Card>
              <div className="font-semibold">O que mudou, obra por obra</div>
              {/* ⚠️ Uma linha por obra, NUNCA somadas: dinheiro de duas obras
                  na mesma linha é a soma que não existe em declaração nenhuma
                  (critério 14 de /obras). */}
              {estado.anos.map((a) => (
                <Linha
                  key={`${a.obraId}-${a.ano}`}
                  rotulo={`${a.obraId === estado.origem.id ? estado.origem.nome : estado.destino.nome} · ${a.ano}`}
                >
                  <span className="mono">
                    {formatarBRL(a.antesCentavos)} →{" "}
                    <span className="font-semibold">
                      {formatarBRL(a.depoisCentavos)}
                    </span>
                  </span>
                </Linha>
              ))}
            </Card>
          )}

          {/* ⚠️ CONTAI-035, item C. Estes DOIS sites não estão na lista de
              sete do critério 4: a tela de mover PAGAMENTO de obra nasceu no
              CONTAI-008, depois do inventário de 23/08, como gêmea de
              `documento/[id]/obra`. É a mesma pendência, com o mesmo texto —
              deixá-la âmbar reintroduziria a dor de origem dentro do ticket
              que a fecha (pre-mortem 1). */}
          {estado.comPendencia ? (
            <Card className={bordaDaGravidade(GRAVIDADE_CORRECAO_ANO_ANTERIOR)}>
              <Chip cor={GRAVIDADE_CORRECAO_ANO_ANTERIOR}>
                Correção mexeu em ano anterior
              </Chip>
              <Consequencia cor={GRAVIDADE_CORRECAO_ANO_ANTERIOR}>
                {AVISO_ANO_ANTERIOR}
              </Consequencia>
              <Dica>{SO_SEI_QUE_E_ANO_ANTERIOR}</Dica>
              <div className="mt-2.5">
                <BotaoLink href="/pendencias">
                  Ver a pendência na lista
                </BotaoLink>
              </div>
            </Card>
          ) : null}
        </ColunaDeDetalhe>
      </>
    );
  }

  // ── Formulário ─────────────────────────────────────────────────────────
  const pag = estado.pagamento;
  const outras = estado.paineis
    .map((p) => p.obra)
    .filter((o) => o.id !== pag.obraId);
  const nomeOrigem = conta?.origem.obra.nome ?? "—";
  const nomeDestino = conta?.destino?.obra.nome ?? "a obra de destino";
  const respondidas =
    conta?.vinculados.filter((d) => escolhas[d.id]).length ?? 0;
  const faltam =
    (conta?.destino ? 0 : 1) + ((conta?.vinculados.length ?? 0) - respondidas);
  const anosDePendencia = conta?.completo === true ? anosComPendencia(conta.anos) : [];

  const rotuloBotao = impedeAlgum
    ? "Há nota que não pode ir junto"
    : conta?.completo !== true
      ? !conta?.destino && (conta?.vinculados.length ?? 0) === 0
        ? "Escolha a obra de destino"
        : `${faltam === 1 ? "Falta 1 resposta" : `Faltam ${faltam} respostas`} para ver a conta`
      : anosDePendencia.length > 0
        ? `Gravar — e abrir a pendência de ${anosDePendencia.join(", ")}`
        : "Mover o pagamento para a obra escolhida";

  return (
    <>
      <CabecalhoDaTela
        titulo="Corrigir a obra deste pagamento"
        sub={`${pag.favorecidoNome ?? "favorecido não informado"} · ${formatarBRL(
          pag.valorCentavos,
        )} · ${formatarDataBR(pag.dataPagamento)}`}
      />
      <ColunaDeDetalhe>
        {erroGravar ? (
          <ErroDeGravacao
            mensagem={erroGravar}
            antes={
              <>
                <strong>Não deu para gravar.</strong>{" "}
              </>
            }
            depois={
              <>
                {" "}
                <strong>Nada foi alterado</strong> — o pagamento continua em{" "}
                {nomeOrigem}, as notas continuam como estavam e nenhum registro
                de correção foi criado.
              </>
            }
          />
        ) : null}

        <Card>
          <Linha rotulo="Obra hoje">{nomeOrigem}</Linha>
          <Linha rotulo="Notas ligadas">
            {conta?.vinculados.length === 0
              ? "nenhuma"
              : `${conta?.vinculados.length}`}
          </Linha>
        </Card>

        <Dica>{MOVE_NAO_PERGUNTA_MOTIVO}</Dica>

        {outras.length === 0 ? (
          <Banner cor="amb" role="status">
            Só existe uma obra cadastrada — não há para onde mover.
          </Banner>
        ) : (
          <>
            <Passo>Mover para</Passo>
            {outras.map((o) => (
              <button
                key={o.id}
                type="button"
                /**
                 * ⚠️ Trocar o destino ZERA as escolhas (bloqueante 5 do Gate 2
                 * do 021). Sem isto, *"esta nota também é da obra X"* continua
                 * marcado depois que o destino vira outra obra — a afirmação
                 * fica selecionada com o SIGNIFICADO TROCADO por baixo. E aqui
                 * ela zera também o aviso de CNO, que é por destino.
                 */
                onClick={() => {
                  setDestinoId(o.id);
                  setEscolhas({});
                }}
                aria-pressed={destinoId === o.id}
                className={`min-h-[44px] rounded-[10px] border px-[14px] py-3 text-left ${
                  destinoId === o.id
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-white"
                }`}
              >
                <div className="font-semibold">{o.nome}</div>
                <div className="mono text-[12px] opacity-80">
                  {o.cno ? `CNO ${o.cno}` : "sem CNO"} · iniciada em{" "}
                  {formatarDataBR(o.dataInicioObra)}
                </div>
              </button>
            ))}
            <Dica>Nada nasce marcado.</Dica>
          </>
        )}

        {/* ── As notas, uma a uma (critério 2) ──────────────────────────── */}
        {conta && conta.vinculados.length > 0 ? (
          <>
            <Passo>
              {conta.vinculados.length === 1
                ? "A nota ligada a este pagamento"
                : `As ${conta.vinculados.length} notas ligadas a este pagamento`}
            </Passo>
            <Dica>
              Um pagamento e o documento dele não podem ficar em obras
              diferentes. Então um dos dois está errado, e só você sabe qual —{" "}
              <strong>a resposta é por nota, uma a uma</strong>.
            </Dica>

            {conta.vinculados.map((d, i) => {
              const impedido = conta.impedidos.some((x) => x.id === d.id);
              const escolhido = escolhas[d.id];
              const aviso = avisoDeCno(d);
              return (
                <Card key={d.id} data-documento={d.id}>
                  <div className="font-semibold">
                    Nota {i + 1} · {NOME_TIPO[d.tipo]}
                    {d.numero ? ` nº ${d.numero}` : ""} ·{" "}
                    <span className="mono">
                      {d.valorCentavos === null
                        ? "sem valor"
                        : formatarBRL(d.valorCentavos)}
                    </span>
                  </div>
                  <Dica>{d.favorecidoNome ?? "emitente não informado"}</Dica>

                  <div className="mt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={impedido}
                      onClick={() =>
                        setEscolhas((e) => ({ ...e, [d.id]: "vai_junto" }))
                      }
                      aria-pressed={escolhido === "vai_junto"}
                      className={`min-h-[44px] rounded-[10px] border px-[14px] py-3 text-left disabled:opacity-50 ${
                        escolhido === "vai_junto"
                          ? "border-ink bg-ink text-paper"
                          : "border-line bg-white"
                      }`}
                    >
                      <div className="font-semibold">
                        Esta nota também é da {nomeDestino}
                      </div>
                    </button>
                    {escolhido === "vai_junto" ? (
                      <Dica>{DESFECHO_NOTA_VAI_JUNTO}</Dica>
                    ) : null}

                    <button
                      type="button"
                      onClick={() =>
                        setEscolhas((e) => ({ ...e, [d.id]: "fica_na_origem" }))
                      }
                      aria-pressed={escolhido === "fica_na_origem"}
                      className={`min-h-[44px] rounded-[10px] border px-[14px] py-3 text-left ${
                        escolhido === "fica_na_origem"
                          ? "border-ink bg-ink text-paper"
                          : "border-line bg-white"
                      }`}
                    >
                      <div className="font-semibold">
                        Esta nota é mesmo da {nomeOrigem}
                      </div>
                    </button>
                    {escolhido === "fica_na_origem" ? (
                      <Dica>{desfechoNotaFicaNaOrigem(nomeDestino)}</Dica>
                    ) : null}
                  </div>

                  {/* ⚠️ O aviso de CNO fica na LINHA DAQUELA NOTA e não
                      desabilita opção nenhuma (critério 16, versão vigente de
                      20/09): os dois desfechos continuam clicáveis, e o que a
                      divergência muda é a AFERIÇÃO — que `posicaoDeAfericao`
                      segrega pelo CNO impresso, não pelo `obra_id`. */}
                  {aviso ? (
                    <Consequencia cor="amb">{aviso}</Consequencia>
                  ) : null}

                  {impedido ? (
                    <Consequencia cor="red">
                      {DOCUMENTO_LIGADO_A_OUTRO_PAGAMENTO}
                    </Consequencia>
                  ) : null}
                </Card>
              );
            })}

            <Dica>{SEM_TERCEIRA_SAIDA}</Dica>
          </>
        ) : null}

        {/* ── O que isso muda no custo ──────────────────────────────────── */}
        <Passo>O que isso muda no seu custo</Passo>
        {conta?.completo !== true ? (
          <Dica>
            Responda a obra de destino
            {conta && conta.vinculados.length > 0
              ? conta.vinculados.length === 1
                ? " e a nota ligada"
                : ` e as ${conta.vinculados.length} notas`
              : ""}{" "}
            para ver a conta.
          </Dica>
        ) : (
          <>
            <TabelaDeObra
              titulo={`${nomeOrigem} — de onde sai`}
              anos={anosDaAlocacao(conta.origemAntes, conta.origemDepois)}
              anoCorrente={ano}
              custo={(a) => [
                custoComprovadoDoAno(conta.origemAntes, a),
                custoComprovadoDoAno(conta.origemDepois, a),
              ]}
              semNota={(a) => [
                semNotaDoAno(conta.origemAntes, a),
                semNotaDoAno(conta.origemDepois, a),
              ]}
            />
            <TabelaDeObra
              titulo={`${conta.destino?.obra.nome} — para onde vai`}
              anos={anosDaAlocacao(conta.destinoAntes, conta.destinoDepois)}
              anoCorrente={ano}
              custo={(a) => [
                custoComprovadoDoAno(conta.destinoAntes, a),
                custoComprovadoDoAno(conta.destinoDepois, a),
              ]}
              semNota={(a) => [
                semNotaDoAno(conta.destinoAntes, a),
                semNotaDoAno(conta.destinoDepois, a),
              ]}
            />

            {conta.anos.length === 0 ? (
              <Consequencia cor="amb">
                {MOVE_DE_PAGAMENTO_SEM_VINCULO}
              </Consequencia>
            ) : null}

            {conta.misto ? (
              <Consequencia cor="amb">
                {resumoDesfechoMistoDoPagamento({
                  totalCentavos: conta.totalCentavos,
                  juntoCentavos: conta.juntoCentavos,
                  ficaCentavos: conta.ficaCentavos,
                  semNotaSobeCentavos: conta.semNotaSobeCentavos,
                  quedaCentavos: conta.quedaCentavos,
                  obraOrigemNome: nomeOrigem,
                  obraDestinoNome: nomeDestino,
                  formatar: formatarBRL,
                })}
              </Consequencia>
            ) : null}

            {conta.anos.some((a) => a.pendencia) ? (
              <>
                <Consequencia cor={GRAVIDADE_CORRECAO_ANO_ANTERIOR}>
                  {AVISO_ANO_ANTERIOR}
                </Consequencia>
                <Dica>{SO_SEI_QUE_E_ANO_ANTERIOR}</Dica>
              </>
            ) : null}

            {/* ── O que fica registrado ─────────────────────────────────── */}
            <Passo>O que fica registrado</Passo>
            <Card>
              <Linha rotulo="obra · do pagamento">
                {nomeOrigem} → {conta.destino?.obra.nome}
              </Linha>
              <Linha rotulo="motivo">arquivamento_corrigido</Linha>
              <Linha rotulo="anos afetados">
                {conta.anos.length === 0
                  ? "nenhum — o custo não mudou em obra nenhuma"
                  : [...new Set(conta.anos.map((a) => a.ano))].join(", ")}
              </Linha>
              {conta.vinculados.map((d) => (
                <Linha
                  key={d.id}
                  rotulo={`${NOME_TIPO[d.tipo]}${d.numero ? ` nº ${d.numero}` : ""}`}
                >
                  {escolhas[d.id] === "vai_junto"
                    ? "vai junto com o pagamento"
                    : "fica na origem — o vínculo se desfaz"}
                </Linha>
              ))}
            </Card>
            <Dica>
              As linhas têm o <strong>mesmo identificador de ato</strong>: no
              banco elas são granulares, na tela são uma correção só. E gravam
              juntas — pagamento, notas e registro numa transação só.
            </Dica>
          </>
        )}
      </ColunaDeDetalhe>

      <RodapeDeAcao>
        <BotaoSalvar
          ocupado={gravando}
          variante="primary"
          onClick={gravar}
          disabled={gravando || !podeGravar}
        >
          {gravando ? "Gravando…" : rotuloBotao}
        </BotaoSalvar>
        <BotaoLink href={`/pagamento/${pag.id}`}>Cancelar</BotaoLink>
      </RodapeDeAcao>
    </>
  );
}

/**
 * A tabela de UMA obra. ⚠️ Duas tabelas separadas, e nunca uma coluna com as
 * duas: dinheiro de duas obras lado a lado na mesma linha é a soma que não
 * existe em declaração nenhuma (critério 14 de `/obras`).
 *
 * `overflow-x-auto` porque 375px é PISO: a tabela rola dentro do próprio
 * contêiner em vez de empurrar a página.
 */
function TabelaDeObra({
  titulo,
  anos,
  anoCorrente,
  custo,
  semNota,
}: {
  titulo: string;
  anos: number[];
  anoCorrente: number;
  custo: (ano: number) => [number, number];
  semNota: (ano: number) => [number, number];
}) {
  return (
    <Card>
      <div className="font-semibold">{titulo}</div>
      {anos.length === 0 ? (
        <Dica>Nenhum pagamento nesta obra — não há ano a comparar.</Dica>
      ) : (
        <div className="overflow-x-auto">
          <table className="mt-1.5 w-full text-[12.5px]">
            <thead>
              <tr className="text-mut">
                <th className="py-1 text-left font-normal">Ano</th>
                <th className="py-1 text-right font-normal">hoje</th>
                <th className="py-1 text-right font-normal">depois</th>
              </tr>
            </thead>
            <tbody>
              {anos.map((a) => {
                const [antes, depois] = custo(a);
                const [semAntes, semDepois] = semNota(a);
                return (
                  <tr key={a} className="border-t border-line">
                    <td className="py-1.5">
                      {a}
                      {a < anoCorrente ? " ⚠" : ""}
                      <div className="text-[11px] text-mut">pago sem nota</div>
                    </td>
                    <td className="mono py-1.5 text-right">
                      {formatarBRL(antes)}
                      <div className="text-[11px] text-mut">
                        {formatarBRL(semAntes)}
                      </div>
                    </td>
                    <td className="mono py-1.5 text-right font-semibold">
                      {formatarBRL(depois)}
                      <div className="text-[11px] font-normal text-mut">
                        {formatarBRL(semDepois)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
