"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useSessao } from "@/app/_components/sessao";
import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Chip,
  Consequencia,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
  Passo,
  Rodape,
} from "@/app/_components/ui";
import {
  carregarDocumento,
  carregarPaineis,
  classificarErro,
  mensagemDeErro,
  moverDocumentoDeObra,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import { formatarDataBR, podeCorrigirObra } from "@/lib/fiscal/obra";
import {
  anosAfetados,
  anosDaAlocacao,
  AVISO_ANO_ANTERIOR,
  DESFECHO_FICA_NA_ORIGEM,
  DESFECHO_VAI_JUNTO,
  MOVE_NAO_PERGUNTA_MOTIVO,
  PAGAMENTO_LIGADO_A_OUTRA_NOTA,
  pagamentosImpedidosDeIrJunto,
  pagamentosVinculados,
  resumoDesfechoMisto,
  semNotaDoAno,
  SEM_TERCEIRA_SAIDA,
  simularMoveDeObra,
  SO_SEI_QUE_E_ANO_ANTERIOR,
  type DesfechoDoPagamento,
  type EscolhaDePagamento,
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
  | { fase: "pronto"; documento: Documento; paineis: PainelDados[] }
  | {
      fase: "movido";
      documento: Documento;
      origem: Obra;
      destino: Obra;
      anos: AnoAfetado[];
      comPendencia: boolean;
    };

/**
 * Tela 8 do mock v2 — **corrigir a obra deste registro**, e o critério 13 do
 * CONTAI-021.
 *
 * ⚠️ Ela deixou de reusar `app/_components/corrigir-obra.tsx` de propósito, e a
 * separação é decisão de forma, não conveniência: aquele componente é o
 * caminho do PAGAMENTO (`/pagamento/[id]/obra`), que o `CONTAI-008` reabre e
 * que este ticket **não pode alterar**. Parametrizar um componente para fazer
 * duas coisas com regimes de consequência diferentes — um lado pergunta o
 * desfecho de cada pagamento vinculado, o outro não pergunta nada — devolveria
 * ao caminho do pagamento metade do fluxo novo, que é exatamente o que o `po`
 * proibiu em 19/08.
 *
 * O que esta tela faz e a anterior não fazia (adendo §5.1 — retratação):
 * mover um documento com pagamento vinculado **não é transferência**, é
 * evaporação. O custo cai na origem, "pago sem nota" sobe pelo mesmo valor,
 * nada sobe no destino e sobra vínculo cruzando duas obras. Por isso cada
 * pagamento é resolvido **um a um, em ato explícito** (§4.4 — cascata
 * silenciosa é proibida), e o ato **não conclui com pagamento indeciso**.
 */
export default function CorrigirObraDoDocumento() {
  const { id } = useParams<{ id: string }>();
  const { pedirReautenticacao } = useSessao();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, DesfechoDoPagamento>>(
    {},
  );
  const [gravando, setGravando] = useState(false);
  const [erroGravar, setErroGravar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const documento = await carregarDocumento(id);
        // Os painéis das DUAS obras: o "depois" da origem e o "depois" do
        // destino saem da mesma `alocarCusto` que produz o número da home.
        const paineis = await carregarPaineis();
        if (cancelado) return;
        setEstado({ fase: "pronto", documento, paineis });
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
    const doc = pronto.documento;
    const origem = pronto.paineis.find((p) => p.obra.id === doc.obraId);
    if (!origem) return null;
    const destino = pronto.paineis.find((p) => p.obra.id === destinoId) ?? null;

    const vinculados = pagamentosVinculados(doc, origem.pagamentos);
    const impedidos = pagamentosImpedidosDeIrJunto(doc, origem.pagamentos);
    const respondidos = vinculados.filter((p) => escolhas[p.id]);
    const completo = destino !== null && respondidos.length === vinculados.length;

    if (!destino || !completo) {
      return { origem, destino, vinculados, impedidos, completo: false as const };
    }

    const lista: EscolhaDePagamento[] = vinculados.map((p) => ({
      pagamentoId: p.id,
      desfecho: escolhas[p.id],
    }));

    const simulado = simularMoveDeObra({
      documento: doc,
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
    // origem e destino —, nunca `documento.obra_id` (adendo §5.4). O filtro
    // "afetada é a candidata cujo custo mudou" está dentro de `anosAfetados`.
    const anos = anosAfetados(
      [
        { obraId: origem.obra.id, antes: origemAntes, depois: origemDepois },
        { obraId: destino.obra.id, antes: destinoAntes, depois: destinoDepois },
      ],
      ano,
    );

    const vaoJunto = vinculados.filter((p) => escolhas[p.id] === "vai_junto");
    const ficam = vinculados.filter((p) => escolhas[p.id] === "fica_na_origem");
    const soma = (ps: Pagamento[]) =>
      ps.reduce((s, p) => s + p.valorCentavos, 0);

    // ⚠️ Os dois números do resumo do desfecho misto vêm DA ALOCAÇÃO, nunca da
    // soma dos pagamentos escolhidos (bloqueante 1 do Gate 2, redigido pelo
    // `contador`): a partição dos pagamentos e a queda do custo só coincidem
    // quando Σ pagamentos ≤ valor da nota, e fora disso a versão anterior
    // superestimava a queda — inflando o alarme sobre o número da meta 1.
    const semNotaSobe = anosDaAlocacao(origemAntes, origemDepois).reduce(
      (acc, a) =>
        acc + semNotaDoAno(origemDepois, a) - semNotaDoAno(origemAntes, a),
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

  const decisao =
    conta?.destino && pronto
      ? podeCorrigirObra({
          tipo: pronto.documento.tipo,
          // O CNO impresso na nota ainda não é capturado (CONTAI-007,
          // critério 2). Até lá a revalidação AVISA em vez de barrar — barrar
          // por desconhecimento fecharia a única saída do erro.
          cnoReferenciado: null,
          cnoDestino: conta.destino.obra.cno,
        })
      : null;

  const impedeAlgum =
    conta?.impedidos.some((p) => escolhas[p.id] === "vai_junto") ?? false;

  const podeGravar =
    conta?.completo === true && decisao?.permitido === true && !impedeAlgum;

  async function gravar() {
    if (!pronto || !conta || conta.completo !== true || !conta.destino) return;
    setGravando(true);
    setErroGravar(null);
    try {
      await moverDocumentoDeObra(
        pronto.documento.id,
        conta.destino.obra.id,
        conta.lista,
        conta.anos,
      );
      setEstado({
        fase: "movido",
        documento: pronto.documento,
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
      setErroGravar(mensagemDeErro(erro));
    }
  }

  // ── Carregando / erro ──────────────────────────────────────────────────
  if (estado.fase === "carregando" || estado.fase === "erro") {
    return (
      <>
        <AppBar titulo="Corrigir a obra deste registro" />
        <Corpo>
          {estado.fase === "erro" ? (
            <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando o documento e as obras" />
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href={`/documento/${id}`}>Voltar ao documento</BotaoLink>
        </Rodape>
      </>
    );
  }

  // ── Gravado (tela 8c) ──────────────────────────────────────────────────
  if (estado.fase === "movido") {
    return (
      <>
        <AppBar titulo="Obra corrigida ✓" sub={estado.destino.nome} />
        <Corpo>
          <Banner cor="grn" role="status">
            Este registro agora está em <strong>{estado.destino.nome}</strong>.
            A correção ficou registrada, com a data, no histórico do documento.
          </Banner>

          {estado.anos.length === 0 ? (
            <Card>
              <Dica>
                Nenhum número mudou: sem pagamento ligado, mover de obra não
                muda o custo nem na origem nem no destino. Documento sozinho não
                comprova custo — o que comprova é o par.
              </Dica>
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

          {estado.comPendencia ? (
            <Card className="border-amb">
              <Chip cor="amb">Correção mexeu em ano anterior</Chip>
              <Consequencia cor="amb">{AVISO_ANO_ANTERIOR}</Consequencia>
              <Dica>{SO_SEI_QUE_E_ANO_ANTERIOR}</Dica>
              <div className="mt-2.5">
                <BotaoLink href="/pendencias">
                  Ver a pendência na lista
                </BotaoLink>
              </div>
            </Card>
          ) : null}
        </Corpo>
        <Rodape>
          <BotaoLink href={`/documento/${estado.documento.id}`} variante="primary">
            Voltar ao documento
          </BotaoLink>
          <BotaoLink href="/">Voltar ao início</BotaoLink>
        </Rodape>
      </>
    );
  }

  // ── Formulário ─────────────────────────────────────────────────────────
  const doc = estado.documento;
  const outras = estado.paineis
    .map((p) => p.obra)
    .filter((o) => o.id !== doc.obraId);
  const nomeOrigem = conta?.origem.obra.nome ?? "—";
  const rotuloBotao = !conta?.destino
    ? "Escolha a obra de destino"
    : conta.completo !== true
      ? `Responda ${conta.vinculados.length - conta.vinculados.filter((p) => escolhas[p.id]).length} ${
          conta.vinculados.length -
            conta.vinculados.filter((p) => escolhas[p.id]).length ===
          1
            ? "pagamento"
            : "pagamentos"
        } para continuar`
      : impedeAlgum
        ? "Há pagamento que não pode ir junto"
        : decisao?.permitido === false
          ? "A revalidação do CNO barrou esta correção"
          : "Mover o registro para a obra escolhida";

  return (
    <>
      <AppBar
        titulo="Corrigir a obra deste registro"
        sub={`${NOME_TIPO[doc.tipo]}${doc.favorecidoNome ? ` · ${doc.favorecidoNome}` : ""}${
          doc.valorCentavos !== null ? ` · ${formatarBRL(doc.valorCentavos)}` : ""
        }`}
      />
      <Corpo>
        {erroGravar ? (
          <Banner cor="red" role="alert">
            <strong>Não deu para gravar.</strong> {erroGravar}{" "}
            <strong>Nada foi alterado</strong> — o registro continua em{" "}
            {nomeOrigem}, os pagamentos continuam como estavam e nenhum registro
            de correção foi criado.
          </Banner>
        ) : null}

        <Card>
          <Linha rotulo="Obra hoje">{nomeOrigem}</Linha>
          <Linha rotulo="Pagamentos ligados">
            {conta?.vinculados.length === 0
              ? "nenhum"
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
                 * ⚠️ Trocar o destino ZERA as escolhas (bloqueante 5 do Gate
                 * 2). Sem isto, *"este pagamento também é da obra X"* continua
                 * marcado depois que o destino vira outra obra — a afirmação
                 * fica selecionada com o SIGNIFICADO TROCADO por baixo. Com
                 * duas obras é inócuo; com três é dado errado gravado a partir
                 * de um toque que respondeu outra pergunta.
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

        {doc.tipo === "nf_servico" ? (
          <Consequencia cor="amb">
            Esta é uma <strong>NF de serviço</strong>: mover para outra obra
            revalida o CNO da nota contra o CNO da obra de destino. Se a nota
            referenciar um CNO diferente, a correção é barrada — senão a nota
            entraria numa obra cujo CNO ela não menciona.
          </Consequencia>
        ) : null}
        {decisao && !decisao.permitido ? (
          <Banner cor="red" role="alert">
            {decisao.motivo}
          </Banner>
        ) : null}
        {decisao && decisao.permitido && decisao.aviso ? (
          <Banner cor="amb" role="status">
            {decisao.aviso}
          </Banner>
        ) : null}

        {/* ── Os pagamentos, um a um (critério 13) ─────────────────────── */}
        {conta && conta.vinculados.length > 0 ? (
          <>
            <Passo>
              Os {conta.vinculados.length}{" "}
              {conta.vinculados.length === 1 ? "pagamento ligado" : "pagamentos ligados"}{" "}
              a esta nota
            </Passo>
            <Dica>
              Um pagamento e o documento dele não podem ficar em obras
              diferentes. Então um dos dois está errado, e só você sabe qual —{" "}
              <strong>a resposta é por pagamento, um a um</strong>.
            </Dica>

            {conta.vinculados.map((p, i) => {
              const impedido = conta.impedidos.some((x) => x.id === p.id);
              const escolhido = escolhas[p.id];
              return (
                <Card key={p.id} data-pagamento={p.id}>
                  <div className="font-semibold">
                    Pagamento {i + 1} · {formatarDataBR(p.dataPagamento)} ·{" "}
                    <span className="mono">{formatarBRL(p.valorCentavos)}</span>
                  </div>
                  <Dica>{p.favorecidoNome ?? "favorecido não informado"}</Dica>

                  <div className="mt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={impedido}
                      onClick={() =>
                        setEscolhas((e) => ({ ...e, [p.id]: "vai_junto" }))
                      }
                      aria-pressed={escolhido === "vai_junto"}
                      className={`min-h-[44px] rounded-[10px] border px-[14px] py-3 text-left disabled:opacity-50 ${
                        escolhido === "vai_junto"
                          ? "border-ink bg-ink text-paper"
                          : "border-line bg-white"
                      }`}
                    >
                      <div className="font-semibold">
                        Este pagamento também é da{" "}
                        {conta.destino?.obra.nome ?? "obra de destino"}
                      </div>
                    </button>
                    {escolhido === "vai_junto" ? (
                      <Dica>{DESFECHO_VAI_JUNTO}</Dica>
                    ) : null}

                    <button
                      type="button"
                      onClick={() =>
                        setEscolhas((e) => ({ ...e, [p.id]: "fica_na_origem" }))
                      }
                      aria-pressed={escolhido === "fica_na_origem"}
                      className={`min-h-[44px] rounded-[10px] border px-[14px] py-3 text-left ${
                        escolhido === "fica_na_origem"
                          ? "border-ink bg-ink text-paper"
                          : "border-line bg-white"
                      }`}
                    >
                      <div className="font-semibold">
                        Este pagamento é mesmo da {nomeOrigem}
                      </div>
                    </button>
                    {escolhido === "fica_na_origem" ? (
                      <Dica>{DESFECHO_FICA_NA_ORIGEM}</Dica>
                    ) : null}
                  </div>

                  {impedido ? (
                    <Consequencia cor="red">
                      {PAGAMENTO_LIGADO_A_OUTRA_NOTA}
                    </Consequencia>
                  ) : null}
                </Card>
              );
            })}

            <Dica>{SEM_TERCEIRA_SAIDA}</Dica>
          </>
        ) : null}

        {/* ── O que isso muda no custo (critério 13 + 14 de /obras) ────── */}
        <Passo>O que isso muda no seu custo</Passo>
        {conta?.completo !== true ? (
          <Dica>
            Responda a obra de destino
            {conta && conta.vinculados.length > 0
              ? ` e os ${conta.vinculados.length} pagamentos`
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
                <strong>Nada muda, e por isso não abre pendência.</strong> Fica o
                registro e o aviso, e acabou — pendência persistente só nasce
                quando a correção muda um número declarado.
              </Consequencia>
            ) : null}

            {conta.misto ? (
              <Consequencia cor="amb">
                {resumoDesfechoMisto({
                  totalCentavos: conta.totalCentavos,
                  juntoCentavos: conta.juntoCentavos,
                  ficaCentavos: conta.ficaCentavos,
                  semNotaSobeCentavos: conta.semNotaSobeCentavos,
                  quedaCentavos: conta.quedaCentavos,
                  obraOrigemNome: nomeOrigem,
                  formatar: formatarBRL,
                })}
              </Consequencia>
            ) : null}

            {conta.anos.some((a) => a.pendencia) ? (
              <>
                <Consequencia cor="amb">{AVISO_ANO_ANTERIOR}</Consequencia>
                <Dica>{SO_SEI_QUE_E_ANO_ANTERIOR}</Dica>
              </>
            ) : null}

            {/* ── O que fica registrado ─────────────────────────────────── */}
            <Passo>O que fica registrado</Passo>
            <Card>
              <Linha rotulo="obra · do documento">
                {nomeOrigem} → {conta.destino?.obra.nome}
              </Linha>
              <Linha rotulo="motivo">arquivamento_corrigido</Linha>
              <Linha rotulo="anos afetados">
                {conta.anos.length === 0
                  ? "nenhum — o custo não mudou em obra nenhuma"
                  : [...new Set(conta.anos.map((a) => a.ano))].join(", ")}
              </Linha>
              {conta.vinculados.map((p) => (
                <Linha
                  key={p.id}
                  rotulo={`obra · pagamento de ${formatarDataBR(p.dataPagamento)}`}
                >
                  {escolhas[p.id] === "vai_junto"
                    ? "vai junto com a nota"
                    : "fica na origem — o vínculo se desfaz"}
                </Linha>
              ))}
            </Card>
            <Dica>
              As linhas têm o <strong>mesmo identificador de ato</strong>: no
              banco elas são granulares, na tela são uma correção só. E gravam
              juntas — documento, pagamentos e registro numa transação só.
            </Dica>
          </>
        )}
      </Corpo>

      <Rodape>
        <Botao
          variante="primary"
          onClick={gravar}
          disabled={gravando || !podeGravar}
        >
          {gravando ? "Gravando…" : rotuloBotao}
        </Botao>
        <BotaoLink href={`/documento/${doc.id}`}>Cancelar</BotaoLink>
      </Rodape>
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
