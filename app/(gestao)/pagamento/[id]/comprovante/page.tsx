"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ListaDeAnexos } from "@/app/_components/anexo";
import { CampoArquivo } from "@/app/_components/campos";
import { ChipsDeComprovanteIrmao } from "@/app/_components/comprovante";
import {
  ROTULO_MOTIVO_NO_RASTRO,
  type PapelDoPacote,
} from "@/app/_components/corrigir";
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
  anexarComprovantePagamento,
  carregarIrmaosDeComprovante,
  carregarPagamento,
  carregarPainel,
  classificarErro,
  mensagemDeErroDeGravacao,
  reaproveitarComprovanteDeIrmao,
  subirParaAcervo,
  type ComprovanteIrmao,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import { bordaDaGravidade } from "@/lib/fiscal/gravidade";
import {
  abrePendencia,
  anosAfetadosDeUmaObra,
  AVISO_ANO_ANTERIOR,
  GRAVIDADE_CORRECAO_ANO_ANTERIOR,
  SO_SEI_QUE_E_ANO_ANTERIOR,
} from "@/lib/fiscal/revisao";
import { alocarCusto, custoComprovadoAteOAno } from "@/lib/fiscal/vinculo";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import type { AnoAfetado, Pagamento } from "@/lib/types";

/**
 * **CONTAI-061 — o comprovante chegou depois** (dívida D56).
 *
 * Fonte fiscal: `docs/pareceres/2026-09-26-anexo-tardio-de-comprovante-d56.md`
 * (§§1-3), somada ao parecer de 2026-08-18 (§5 rastro, §6 o detector de "ano já
 * declarado"), reaproveitados sem adaptação. Fluxo:
 * `design/mocks/CONTAI-061.md`.
 *
 * ⚠️ **NENHUMA PERGUNTA FISCAL AQUI**, e a diferença com `/documento/[id]/anexar`
 * é de papel, não de economia de tela: lá o anexo é uma NOTA, e *"a nota está no
 * seu CPF?"* / o gate de retenção são perguntas sobre o que está impresso nela.
 * Comprovante de pagamento não responde nenhuma das duas — não tem destinatário
 * fiscal e não destaca retenção. O próprio comprovante é o documento hábil, e
 * por isso o campo **não tem default** (regra dura do projeto).
 *
 * ⚠️ **O ANO DO CUSTO É O DO PAGAMENTO, NUNCA O DO ANEXO** (§3, regime de
 * caixa). Nada nesta tela lê "hoje" para decidir ano de custo: `hojeIso` entra
 * só como `anoCorrente` do detector — a fronteira do §5.3, que separa "ano
 * anterior" de "ano corrente". A data do anexo é rastro (`revisao.quando`, §2).
 *
 * ⚠️ **O delta sai da MESMA função que produz o número da home** — `alocarCusto`
 * rodada duas vezes, sobre uma cópia, exatamente como em
 * `/documento/[id]/corrigir/valor`. Nunca uma segunda conta de custo.
 */

/**
 * O `comprovantePath` da SIMULAÇÃO. Qualquer string não-nula serve: o que
 * `valorElegivelDoPagamento` (`lib/fiscal/vinculo.ts`) pergunta é
 * `comprovantePath === null`, e nada em `alocarCusto` lê o conteúdo do caminho.
 *
 * ⚠️ É um valor que NUNCA é gravado — quem grava é o path que volta de
 * `subirParaAcervo`, depois de o arquivo existir no acervo. O nome diz isso, em
 * vez de um `"x"` que alguém um dia passaria adiante por engano.
 */
const CAMINHO_SIMULADO = "(simulação — nada foi gravado)";

/**
 * **CONTAI-098** — no ramo SEM irmão com comprovante a tela é byte-a-byte a de
 * hoje (critério 6): o controle de chips não é renderizado, e a única resposta
 * possível é o upload. Constante de módulo (e não um literal por render) para o
 * `useMemo` do delta não recalcular a cada renderização.
 *
 * ⚠️ Isto **não é um default em campo fiscal**: no ramo COM irmãos, `escolhido`
 * nasce `null` e continua `null` até o clique (critério 5).
 */
const SO_UPLOAD: PapelDoPacote = { tipo: "novo" };

type Fase =
  | { nome: "escolhendo" }
  | {
      nome: "gravado";
      anos: AnoAfetado[];
      comprovantePath: string;
      /** Ramo "existente": muda o banner e o motivo do rastro, nada mais. */
      reaproveitado: boolean;
    };

export default function AnexarComprovanteDoPagamento() {
  const { id } = useParams<{ id: string }>();
  const { pedirReautenticacao } = useSessao();

  const [carregado, setCarregado] = useState<{
    pagamento: Pagamento;
    painel: PainelDados;
    /**
     * CONTAI-098 — `null` é "não pertence a fatura nenhuma" (PIX avulso); `[]` é
     * "pertence, e nenhum irmão tem comprovante ainda". Para a TELA os dois
     * renderizam igual; a distinção vive na camada de dados.
     */
    irmaos: ComprovanteIrmao[] | null;
  } | null>(null);
  const [erroCarregar, setErroCarregar] = useState<ErroDeTela | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const [arquivo, setArquivo] = useState<File | null>(null);
  /**
   * **CONTAI-098, critério 5** — nasce `null` em QUALQUER contagem de irmãos (1
   * ou N): nenhum chip vem pré-marcado, nunca pré-seleção automática. Com um
   * candidato só não há escolha entre arquivos, mas o CLIQUE continua humano
   * (Gate Fiscal item 6).
   */
  const [escolhido, setEscolhido] = useState<PapelDoPacote | null>(null);
  const [fase, setFase] = useState<Fase>({ nome: "escolhendo" });
  const [gravando, setGravando] = useState(false);
  const [erroGravar, setErroGravar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const pagamento = await carregarPagamento(id);
        // A guarda de reentrada (pagamento que JÁ tem comprovante) decide a tela
        // mais abaixo, e aqui ela já evita a travessia da fatura: não há escolha
        // a oferecer para um pagamento cujo path o banco não aceita reescrever.
        const [painel, irmaos] = await Promise.all([
          carregarPainel(pagamento.obraId),
          pagamento.comprovantePath === null
            ? carregarIrmaosDeComprovante(pagamento.id)
            : Promise.resolve(null),
        ]);
        if (!cancelado) setCarregado({ pagamento, painel, irmaos });
      } catch (erro) {
        if (!cancelado) setErroCarregar(classificarErro(erro));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setErroCarregar(null);
    setCarregado(null);
    setErroGravar(null);
    setTentativa((t) => t + 1);
  }, []);

  const irmaos = carregado?.irmaos ?? null;
  const temIrmaos = irmaos !== null && irmaos.length > 0;
  /** No ramo sem irmãos a pergunta tem uma resposta só, e ela já está na tela. */
  const papel = temIrmaos ? escolhido : SO_UPLOAD;

  /**
   * Trocar de chip descarta o `File` em memória, se havia (spec, §decisões):
   * upload e chip são a MESMA pergunta, e nada foi gravado ainda neste ponto.
   */
  const escolher = useCallback((novo: PapelDoPacote) => {
    setEscolhido(novo);
    if (novo.tipo === "existente") setArquivo(null);
  }, []);

  /** O grupo do arquivo escolhido — de onde sai a ORIGEM que a RPC recebe. */
  const grupoEscolhido =
    papel?.tipo === "existente"
      ? ((irmaos ?? []).find((g) => g.comprovantePath === papel.path) ?? null)
      : null;

  const ano = Number(hojeIso().slice(0, 4));

  /**
   * O "antes → depois" do custo confirmado, calculado ANTES de subir o arquivo
   * (critério 3): o Mateus vê o efeito e só então decide.
   *
   * O único campo que muda na cópia é `comprovantePath` deste pagamento —
   * `documentos` fica idêntico, porque anexar comprovante não cria nem altera
   * documento hábil nenhum.
   *
   * ⚠️ **CONTAI-098, critério 10 — UM mecanismo para os DOIS caminhos.** No ramo
   * "novo" o path é o sentinel `CAMINHO_SIMULADO` (nenhum upload ainda); no ramo
   * "existente" é o `comprovantePath` REAL da origem escolhida, que já está no
   * acervo e não precisa de sentinel. É a única diferença mecânica entre eles: a
   * chamada a `anosAfetadosDeUmaObra`/`alocarCusto` é idêntica, e não existe uma
   * segunda função de cálculo de custo.
   */
  const conta = useMemo(() => {
    if (!carregado) return null;
    const { pagamento, painel } = carregado;
    if (pagamento.comprovantePath !== null) return null;

    const caminho = papel?.tipo === "existente" ? papel.path : CAMINHO_SIMULADO;
    const depois = {
      documentos: painel.documentos,
      pagamentos: painel.pagamentos.map((p) =>
        p.id === pagamento.id ? { ...p, comprovantePath: caminho } : p,
      ),
    };

    return {
      anos: anosAfetadosDeUmaObra(pagamento.obraId, painel, depois, ano),
      acumuladoAntes: custoComprovadoAteOAno(alocarCusto(painel), ano),
      acumuladoDepois: custoComprovadoAteOAno(alocarCusto(depois), ano),
    };
  }, [carregado, ano, papel]);

  async function gravar() {
    if (!carregado || papel === null) return;
    if (papel.tipo === "existente" && grupoEscolhido === null) return;
    if (papel.tipo !== "existente" && arquivo === null) return;
    setGravando(true);
    setErroGravar(null);
    try {
      if (papel.tipo === "existente") {
        // ⚠️ **NENHUM `subirParaAcervo` neste ramo** (critério 7): o objeto já
        // está no acervo, e o reaproveitamento não cria um segundo. Quem lê o
        // `comprovante_path` é o BANCO, a partir da origem — o app nunca passa
        // um path aqui, e é isso que torna a proveniência verificável.
        //
        // Qualquer uma das origens serve: elas compartilham EXATAMENTE o mesmo
        // arquivo (é o critério do agrupamento), e a guarda de proveniência da
        // RPC vale igual para todas.
        if (grupoEscolhido === null) return;
        await reaproveitarComprovanteDeIrmao(
          carregado.pagamento.id,
          grupoEscolhido.origens[0].pagamentoId,
          conta?.anos ?? [],
        );
        setFase({
          nome: "gravado",
          anos: conta?.anos ?? [],
          comprovantePath: papel.path,
          reaproveitado: true,
        });
        return;
      }

      if (arquivo === null) return;
      // ⚠️ O upload vem ANTES da gravação, e é o único jeito: o caminho precisa
      // existir no acervo para a função Postgres o registrar no mesmo ato.
      // Falha no upload = nada foi gravado, e a tela diz isso.
      const comprovantePath = await subirParaAcervo(arquivo, "comprovante");
      await anexarComprovantePagamento(
        carregado.pagamento.id,
        comprovantePath,
        conta?.anos ?? [],
      );
      setFase({
        nome: "gravado",
        anos: conta?.anos ?? [],
        comprovantePath,
        reaproveitado: false,
      });
    } catch (erro) {
      setGravando(false);
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroGravar(
        mensagemDeErroDeGravacao(
          erro,
          "no detalhe do pagamento, se o comprovante já aparece anexado",
        ),
      );
    }
  }

  const pagamentoHref = `/pagamento/${id}`;

  // ── Carregando / erro ──────────────────────────────────────────────────
  if (!carregado) {
    return (
      <>
        <CabecalhoDaTela titulo="Anexar o comprovante" />
        <ColunaDeDetalhe>
          {erroCarregar ? (
            <EstadoErro erro={erroCarregar} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando o pagamento" />
          )}
        </ColunaDeDetalhe>
      </>
    );
  }

  const p = carregado.pagamento;
  const sub = `${p.favorecidoNome ?? "favorecido não informado"} · ${formatarBRL(
    p.valorCentavos,
  )}`;

  // ── Sucesso ────────────────────────────────────────────────────────────
  if (fase.nome === "gravado") {
    return (
      <>
        {/* CONTAI-098 — o banner é dinâmico (spec, `## Textos`): o texto nunca
            diz "anexado" quando nenhum arquivo novo subiu. Dali para baixo os
            dois ramos são idênticos — mesma `ListaDeAnexos`, mesma tabela de
            anos, mesmo tratamento de pendência. */}
        <CabecalhoDaTela
          titulo={
            fase.reaproveitado
              ? "Comprovante reaproveitado ✓"
              : "Comprovante anexado ✓"
          }
          sub={sub}
        />
        <ColunaDeDetalhe>
          <Banner cor="grn" role="status">
            {fase.reaproveitado ? (
              <>
                <strong>Reaproveitado.</strong> Este pagamento agora aponta para
                o mesmo comprovante de outro pagamento desta fatura, e o
                reaproveitamento ficou registrado no histórico com a data.
              </>
            ) : (
              <>
                <strong>Anexado.</strong> Este pagamento agora tem comprovante, e
                o anexo ficou registrado no histórico com a data.
              </>
            )}
          </Banner>
          <Card>
            <ListaDeAnexos
              titulo="Comprovante do pagamento"
              itens={[{ path: fase.comprovantePath }]}
            />
          </Card>
          {fase.anos.map((a) => (
            <Card key={a.ano}>
              <Linha rotulo={`Custo confirmado ${a.ano}`}>
                <span className="mono">
                  {formatarBRL(a.antesCentavos)} →{" "}
                  <span className="font-semibold">
                    {formatarBRL(a.depoisCentavos)}
                  </span>
                </span>
              </Linha>
            </Card>
          ))}
          {/* Sem `router.push` automático quando há pendência: o Mateus decide
              quando sair, como em `corrigir/valor`. */}
          {abrePendencia(fase.anos) ? (
            <Card className={bordaDaGravidade(GRAVIDADE_CORRECAO_ANO_ANTERIOR)}>
              <Chip cor={GRAVIDADE_CORRECAO_ANO_ANTERIOR}>
                Correção mexeu em ano anterior
              </Chip>
              <Consequencia cor={GRAVIDADE_CORRECAO_ANO_ANTERIOR}>
                {AVISO_ANO_ANTERIOR}
              </Consequencia>
              <Dica>{SO_SEI_QUE_E_ANO_ANTERIOR}</Dica>
              <div className="mt-2.5">
                <BotaoLink href="/pendencias">Ver a pendência na lista</BotaoLink>
              </div>
            </Card>
          ) : null}
          <div className="mt-1">
            <BotaoLink href={pagamentoHref}>Voltar ao pagamento</BotaoLink>
          </div>
        </ColunaDeDetalhe>
      </>
    );
  }

  /**
   * ⚠️ **Guarda de reentrada.** Chegada direta por URL num pagamento que **já
   * tem comprovante**: pelo fluxo normal não acontece (o botão só existe no card
   * de "pago sem comprovante"), mas a rota é endereçável e o banco recusaria a
   * gravação de qualquer jeito — a RPC aceita só `comprovante_path is null`, e o
   * trigger `pagamento_comprovante_path_imutavel` fecha o caminho direto pela
   * tabela. Aqui a tela diz isso ANTES de o Mateus escolher um arquivo para
   * nada.
   *
   * E não há "substituir": o comprovante é a prova do que saiu da conta, e
   * trocá-lo por cima de outro destruiria o lastro daquela afirmação sem deixar
   * rastro.
   *
   * ⚠️ **O banner NÃO afirma que o custo deste ano está confirmado** (Gate 2,
   * bloqueante do `contador`): isso seria afirmação fiscal nova e FALSA no caso
   * geral — pagamento com comprovante e sem nota hábil ligada tem custo
   * confirmado ZERO (`min(Σ pagamentos, Σ documentos hábeis) = 0`), que é
   * literalmente o critério de aceite 8 deste ticket. Quem limita o custo é a
   * nota; o comprovante só destrava o pagamento.
   */
  if (p.comprovantePath !== null) {
    return (
      <>
        <CabecalhoDaTela titulo="Anexar o comprovante" sub={sub} />
        <ColunaDeDetalhe>
          <Banner cor="amb" role="status">
            <strong>Este pagamento já tem comprovante.</strong> O comprovante não
            se substitui por aqui — ele é a prova do que saiu da conta.
          </Banner>
          <Card>
            <ListaDeAnexos
              titulo="Comprovante do pagamento"
              itens={[{ path: p.comprovantePath }]}
            />
          </Card>
          <div className="mt-1">
            <BotaoLink href={pagamentoHref}>Voltar ao pagamento</BotaoLink>
          </div>
        </ColunaDeDetalhe>
      </>
    );
  }

  const comPendencia = conta !== null && abrePendencia(conta.anos);
  const primeiroAno = conta?.anos[0];
  const reaproveitando = papel?.tipo === "existente";
  /**
   * CONTAI-098, critério 5: sem escolha explícita o botão fica desabilitado. No
   * ramo "novo" continua valendo a regra de hoje (sem arquivo, não grava).
   */
  const podeGravar =
    !gravando && (reaproveitando || (papel?.tipo === "novo" && arquivo !== null));

  /**
   * **O rótulo, dinâmico** (spec, `## Textos de produto`). O verbo troca com o
   * ramo e o texto **nunca diz "anexar" quando nenhum arquivo novo está
   * subindo** — a fórmula do delta é a mesma nos dois.
   */
  const deltaDoAno = primeiroAno
    ? `${primeiroAno.ano} passa a ${formatarBRL(primeiroAno.depoisCentavos)}`
    : "";
  const rotuloBotao = gravando
    ? reaproveitando
      ? "Reaproveitando…"
      : "Anexando…"
    : papel === null
      ? "Escolha um comprovante para continuar"
      : papel.tipo === "novo" && arquivo === null
        ? "Escolha o comprovante para continuar"
        : primeiroAno === undefined
          ? reaproveitando
            ? "Usar este comprovante"
            : "Anexar comprovante"
          : comPendencia
            ? reaproveitando
              ? `Usar mesmo assim — o custo de ${deltaDoAno}`
              : `Anexar mesmo assim — o custo de ${deltaDoAno}`
            : reaproveitando
              ? `Usar este comprovante — o custo confirmado de ${deltaDoAno}`
              : `Anexar comprovante — o custo confirmado de ${deltaDoAno}`;

  /**
   * O delta aparece quando a pergunta já tem resposta: um chip de
   * reaproveitamento marcado, ou um arquivo escolhido no ramo "novo".
   */
  const mostrarDelta = reaproveitando || arquivo !== null;

  return (
    <>
      <CabecalhoDaTela titulo="Anexar o comprovante" sub={sub} />
      <ColunaDeDetalhe>
        {erroGravar ? (
          <ErroDeGravacao
            mensagem={erroGravar}
            antes={
              <>
                <strong>Não deu para anexar.</strong>{" "}
              </>
            }
            depois={
              <>
                {" "}
                <strong>Nada foi alterado</strong> — o pagamento continua sem
                comprovante, e nenhuma pendência foi aberta.
              </>
            }
          />
        ) : null}

        <Card>
          <Linha rotulo="Valor">
            <span className="mono">{formatarBRL(p.valorCentavos)}</span>
          </Linha>
          <Linha rotulo="Data do pagamento">
            <span className="mono">{p.dataPagamento}</span>
          </Linha>
        </Card>

        {/* ── CONTAI-098 — os chips de reaproveitamento ────────────────────
            Só existem quando há pelo menos um arquivo distinto entre os irmãos;
            sem isso a tela é byte-a-byte a de hoje (critério 6). */}
        {temIrmaos ? (
          <ChipsDeComprovanteIrmao
            irmaos={irmaos}
            escolhido={escolhido}
            onEscolher={escolher}
          />
        ) : null}

        {/* `campo` é o id do spec (`design/mocks/CONTAI-061.md`, `## Campos`) —
            é por ele que `e2e/campos-fiscais.spec.ts` cruza SEM DEFAULT
            declarado contra o campo nascendo vazio.

            ⚠️ CONTAI-098: no ramo COM irmãos ele aparece **só** depois do clique
            em "Vou anexar um arquivo novo." — nunca lado a lado com os chips,
            que seriam duas perguntas simultâneas sobre o mesmo arquivo. No ramo
            SEM irmãos ele continua visível de cara, como sempre. */}
        {papel?.tipo === "novo" ? (
          <CampoArquivo
            campo="comprovante"
            rotulo="Comprovante do pagamento"
            ajuda="PDF, foto ou print — é ele que comprova este pagamento."
            accept="application/pdf,image/*"
            arquivo={arquivo}
            onChange={setArquivo}
          />
        ) : null}

        <Passo>O que isso muda no seu custo</Passo>
        {!mostrarDelta ? (
          <Dica>
            Escolha o arquivo para ver o efeito no custo confirmado do ano.
          </Dica>
        ) : (
          <>
            <Card>
              <Dica>
                Custo confirmado por ano-calendário — o que entra na declaração
                de cada ano.
              </Dica>
              {conta === null || conta.anos.length === 0 ? (
                /* Critério 8: pagamento sem nota hábil ligada não muda custo
                   nenhum — `min(Σ pagamentos, Σ documentos) = 0` dos dois lados.
                   É comportamento correto, não bug: o comprovante destrava o
                   pagamento, mas quem limita o custo continua sendo a nota. */
                <Dica>
                  Nenhum ano muda: sem nota hábil ligada a este pagamento, o
                  comprovante não põe custo confirmado em ano nenhum. Pagamento
                  sozinho não comprova custo — o que comprova é o par. Ele deixa
                  de bloquear o custo, e passa a contar quando houver nota no seu
                  CPF que o cubra.
                </Dica>
              ) : (
                conta.anos.map((a) => (
                  <Linha
                    key={a.ano}
                    rotulo={`${a.ano}${a.pendencia ? " ⚠ ano anterior" : ""}`}
                  >
                    <span className="mono">
                      {formatarBRL(a.antesCentavos)} →{" "}
                      <span className="font-semibold">
                        {formatarBRL(a.depoisCentavos)}
                      </span>
                    </span>
                  </Linha>
                ))
              )}
              {conta !== null ? (
                <Linha rotulo={`Acumulado até ${ano}`}>
                  <span className="mono">
                    {formatarBRL(conta.acumuladoAntes)} →{" "}
                    <span className="font-semibold">
                      {formatarBRL(conta.acumuladoDepois)}
                    </span>
                  </span>
                </Linha>
              ) : null}
            </Card>
            <Dica>
              O ano é o da <strong>data do pagamento</strong> — regime de caixa.
              A data em que o comprovante chegou fica registrada no histórico e
              não move custo de ano nenhum.
            </Dica>

            {/* ── Ramo B — com pendência de ano já declarado ──────────────── */}
            {comPendencia ? (
              <>
                <Consequencia cor={GRAVIDADE_CORRECAO_ANO_ANTERIOR}>
                  {AVISO_ANO_ANTERIOR}
                </Consequencia>
                <Dica>{SO_SEI_QUE_E_ANO_ANTERIOR}</Dica>
                {/* A mesma pendência, e por isso a mesma cor — o mesmo par de
                    frases de `corrigir/valor`, sem uma palavra nova. */}
                <Consequencia cor={GRAVIDADE_CORRECAO_ANO_ANTERIOR}>
                  <strong>Vai virar uma pendência na tela inicial.</strong> Este
                  aviso não some quando você fechar a tela: ele fica na lista de
                  pendências até você marcar que já tratou com o contador.
                </Consequencia>
              </>
            ) : null}
          </>
        )}

        <Passo>O que fica registrado</Passo>
        <Card>
          <Linha rotulo="campo comprovante">
            <span className="mono">
              {reaproveitando
                ? "sem comprovante → comprovante reaproveitado"
                : "sem comprovante → comprovante anexado"}
            </span>
          </Linha>
          {/* ⚠️ CONTAI-098 — o rótulo sai do MAPA do rastro
              (`ROTULO_MOTIVO_NO_RASTRO`), nunca redigido aqui: é a mesma frase
              que o histórico do pagamento vai mostrar em 2034, e os dois motivos
              são DISTINTOS por exigência fiscal (Gate Fiscal item 4). Duas
              redações do mesmo fato é como nasce a D46. */}
          <Linha rotulo="motivo">
            {
              ROTULO_MOTIVO_NO_RASTRO[
                reaproveitando
                  ? "comprovante_reaproveitado_de_irmao"
                  : "comprovante_chegou_depois"
              ]
            }
          </Linha>
          <Linha rotulo="quando, e por quem">no ato da gravação</Linha>
          <Linha rotulo="anos afetados">
            {conta && conta.anos.length > 0
              ? conta.anos.map((a) => a.ano).join(", ")
              : "nenhum"}
          </Linha>
        </Card>
        <Dica>
          O comprovante <strong>não se substitui</strong>: depois de anexado, ele
          é a prova do que saiu da conta. O anexo e o registro dele vão juntos,
          numa operação só — ou as duas coisas acontecem, ou nenhuma acontece.
        </Dica>
      </ColunaDeDetalhe>

      <RodapeDeAcao>
        <BotaoSalvar
          ocupado={gravando}
          variante="primary"
          onClick={gravar}
          disabled={!podeGravar}
        >
          {rotuloBotao}
        </BotaoSalvar>
        <BotaoLink href={pagamentoHref}>Cancelar</BotaoLink>
      </RodapeDeAcao>
    </>
  );
}
