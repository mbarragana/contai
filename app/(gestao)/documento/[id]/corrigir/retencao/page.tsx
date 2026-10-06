"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import {
  ListaDeAnexos,
  papelOriginal,
  SEM_PAPEL_NO_ACERVO,
} from "@/app/_components/anexo";
import { CampoArquivo, Escolha } from "@/app/_components/campos";
import {
  ANEXO_DO_PACOTE_NAO_ESTA_AQUI,
  ANEXO_VEIO_DO_PACOTE,
  ARQUIVO_SERA_REAPROVEITADO,
  ChipsDeAnexoExistente,
  ErroEstaNaNota,
  exigeAnexoNovo,
  HistoricoDeCorrecoes,
  MotivoEscolhidoResumo,
  PapelEscolhidoAntesDeGravar,
  PassoMotivo,
  ROTULO_MOTIVO_NO_RASTRO,
  TITULO_CHIPS_NA_CORRECAO,
  type MotivoEscolhido,
  type RespostaPasso1,
} from "@/app/_components/corrigir";
import {
  CabecalhoDaTela,
  ColunaDeDetalhe,
  RodapeDeAcao,
} from "@/app/_components/detalhe";
import { FormularioDeLinha, LinhaPendente } from "@/app/_components/retencao";
import { useSessao } from "@/app/_components/sessao";
import {
  Banner,
  BotaoLink,
  BotaoSalvar,
  Card,
  Carregando,
  Consequencia,
  Dica,
  ErroDeGravacao,
  EstadoErro,
  Linha,
  Passo,
} from "@/app/_components/ui";
import {
  adicionarLinhaRetencaoRegistrada,
  carregarAnexosDoDocumento,
  carregarCorrecoesDoDocumento,
  carregarDocumento,
  carregarObras,
  classificarErro,
  corrigirGateRetencao,
  mensagemDeErroDeGravacao,
  subirParaAcervo,
  type AnexoDoDocumento,
  type ErroDeTela,
} from "@/lib/data";
import {
  lerAnexoDoPacote,
  lerPacote,
  proximaDoPacote,
  textoContinuar,
  textoPular,
} from "@/lib/gestao/pacote-correcao";
import {
  avisoDeRemocaoDasLinhas,
  confirmacaoDeRemocaoDasLinhas,
  exigeGateDeRetencao,
  OPCOES_GATE,
  PERGUNTA_GATE,
  RETENCAO_NAO_ABATE_SERO,
  type EntradaLinhaRetencao,
} from "@/lib/fiscal/retencao";
import type { Documento, RespostaRetencaoNaNota, Revisao } from "@/lib/types";

/**
 * **CONTAI-086 (reabrir o gate) + CONTAI-087 (provar a linha tardia)** — a MESMA
 * tela, por decisão do `cto-obra`: os passos 3 e 4 servem às duas user stories, e
 * o spec é um só (`design/mocks/CONTAI-086.md`).
 *
 * Dor real (dívida D90): com `documento.retencao_na_nota = 'nenhuma'`,
 * `BlocoRetencao` devolvia `null` e não existia caminho nenhum de volta. A NFS-e
 * 261 respondeu "nenhuma" no registro; a substitutiva 263 revelou ISS retido, e
 * os R$ 1.797,03 a recolher (prazo de trabalho até 10/11/2026, parecer
 * `2026-10-02-iss-retido-floripa-perfuratec-nfse263.md` §3) não apareciam em
 * lugar nenhum do sistema.
 *
 * ⚠️ **ROTA E COMPONENTE NOVOS, e não `ConfirmarGateLegado` com uma prop de
 * modo** (pre-mortem 1 do ticket, decisão do `cto-obra`): reusar o componente da
 * pergunta original deixaria a correção visualmente idêntica à primeira resposta
 * — sem motivo, sem anexo, sem rastro visíveis. É o risco que o parecer nomeia
 * para um "dropdown de status", por analogia.
 *
 * ⚠️ **NÃO EXISTE AQUI o bloco "o que isso muda no seu custo"**, e a ausência é
 * Gate Fiscal, não economia de código: nenhuma retenção desta nota move custo de
 * aquisição nem base de aferição do SERO (parecer de 2026-09-18, §2 e ADENDO
 * A.2). Por isso `alocarCusto`/`carregarPainel` não são importados e a palavra
 * "anos afetados" não aparece em tela nenhuma deste fluxo (spec, §textos).
 *
 * ⚠️ **Um ato só, no passo 4.** Nada grava linha por linha no passo 3: gate +
 * linhas novas (ou snapshot + DELETE) + anexo entram juntos, pela RPC. Gravar
 * antes deixaria o documento num estado intermediário visível em outra tela —
 * exatamente o que o critério 6 proíbe.
 */
export default function CorrigirRetencao() {
  return (
    // `useSearchParams` exige fronteira de Suspense (o `?modo=linha` do
    // CONTAI-087 chega por query): mesmo padrão de `/documento/[id]`.
    <Suspense
      fallback={
        <>
          <CabecalhoDaTela titulo="Corrigir a retenção" />
          <ColunaDeDetalhe>
            <Carregando rotulo="Carregando o documento" />
          </ColunaDeDetalhe>
        </>
      }
    >
      <Tela />
    </Suspense>
  );
}

type Fase =
  | { nome: "passo1" }
  | { nome: "erro_do_papel" }
  | { nome: "corrigir"; motivo: MotivoEscolhido; motivoTexto: string | null }
  | {
      nome: "gravado";
      gateAntes: RespostaRetencaoNaNota;
      gateDepois: RespostaRetencaoNaNota;
      criadas: number;
      removidas: number;
      /** O path que ESTE ato usou — é ele que segue para a próxima do pacote. */
      anexoUsado: string | null;
    };

function Tela() {
  const { id } = useParams<{ id: string }>();
  /**
   * **CONTAI-087, critério 6 — o modo "só linha".** Quem chega por aqui veio do
   * `Repeater` de uma nota que JÁ tem linha: o gate não está em questão (ele já
   * é "destacada" e continua), e o que falta é a linha nova com prova. O gate
   * aparece afirmado, sem opção de mudar.
   */
  const busca = useSearchParams();
  const soLinha = busca.get("modo") === "linha";
  /**
   * **CONTAI-088 — o modo pacote.** `null` é "não há pacote": sem `?pacote` a
   * tela se comporta exatamente como antes daquele ticket (critério 11).
   *
   * ⚠️ **A retenção entra no pacote SEM `?modo=linha`** (critério 13 do
   * CONTAI-086): o modo padrão já cobre tanto o flip do gate quanto a linha nova
   * numa nota que já destaca retenção. Entrar por `?modo=linha` recusaria a nota
   * cujo gate diz "nenhuma", que é justamente o caso do documento substituto.
   */
  const pacote = lerPacote(busca);
  const anexoDoPacote = lerAnexoDoPacote(busca);
  const { pedirReautenticacao } = useSessao();

  const [documento, setDocumento] = useState<Documento | null>(null);
  const [anexos, setAnexos] = useState<AnexoDoDocumento[]>([]);
  const [erroCarregar, setErroCarregar] = useState<ErroDeTela | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [fase, setFase] = useState<Fase>({ nome: "passo1" });

  const [gateNovo, setGateNovo] = useState<RespostaRetencaoNaNota | null>(null);
  const [linhasNovas, setLinhasNovas] = useState<EntradaLinhaRetencao[]>([]);
  const [abrindoLinha, setAbrindoLinha] = useState(false);
  const [confirmaRemocao, setConfirmaRemocao] = useState(false);
  const [anexo, setAnexo] = useState<File | null>(null);
  const [chip, setChip] = useState<string | null>(null);
  const [reconferi, setReconferi] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erroGravar, setErroGravar] = useState<string | null>(null);
  /** Só do passo de sucesso (spec: `HistoricoDeCorrecoes` embaixo). */
  const [correcoes, setCorrecoes] = useState<Revisao[] | null>(null);
  const [obras, setObras] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const d = await carregarDocumento(id);
        // Os anexos já existentes alimentam os CHIPS do passo 4 (critério 10) —
        // e vêm com a ORIGEM de cada papel, pelo embed com `revisao`.
        const lista = await carregarAnexosDoDocumento(d.id);
        if (cancelado) return;
        setDocumento(d);
        setAnexos(lista);
        // ⚠️ **CONTAI-088, critério 11 — `?anexo` só pré-seleciona o que está
        // NESTE documento.** A querystring é digitável à mão e chega de link
        // velho: aceitá-la sem conferir mandaria à RPC um papel que a tela nunca
        // viu na lista do próprio documento.
        setChip(
          anexoDoPacote !== null &&
            lista.some((a) => a.arquivoPath === anexoDoPacote)
            ? anexoDoPacote
            : null,
        );
      } catch (erro) {
        if (!cancelado) setErroCarregar(classificarErro(erro));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id, tentativa, anexoDoPacote]);

  const tentarDeNovo = useCallback(() => {
    setErroCarregar(null);
    setDocumento(null);
    setErroGravar(null);
    setTentativa((t) => t + 1);
  }, []);

  const documentoHref = `/documento/${id}`;

  // ── Carregando / erro ──────────────────────────────────────────────────
  if (!documento) {
    return (
      <>
        <CabecalhoDaTela titulo="Corrigir a retenção" />
        <ColunaDeDetalhe>
          {erroCarregar ? (
            <EstadoErro erro={erroCarregar} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando o documento" />
          )}
        </ColunaDeDetalhe>
      </>
    );
  }

  const d = documento;
  const sub = d.favorecidoNome ?? "emitente não identificado";
  const gateAtual = d.retencaoNaNota;
  const linhasExistentes = d.retencoes.length;

  /**
   * ⚠️ **TRÊS portas que esta tela NÃO é, e a recusa vem ANTES de deixar
   * preencher qualquer coisa** — não depois, no "Gravar":
   *
   * - **tipo diferente de `nf_servico`**: o gate só existe em NF de serviço
   *   (`exigeGateDeRetencao`). Não há pergunta a reabrir;
   * - **gate `null`** é o LEGADO (documento gravado antes da migration 0017).
   *   A primeira resposta dele é afirmação original, não correção: ela mora no
   *   `ConfirmarGateLegado` do detalhe, sem motivo e sem anexo. Tratá-la como
   *   correção gravaria um `antes` que ninguém nunca afirmou;
   * - **`?modo=linha` com o gate que NÃO é "destacada"** (achado do Gate 2):
   *   chega-se aqui por URL digitada à mão, link velho, ou pelo gate mudando em
   *   outra aba. Antes desta guarda a tela afirmava *"este caminho não muda a
   *   resposta"* ao lado de *"Hoje: Nenhuma"* — duas frases que juntas são
   *   falsas — e deixava montar motivo, linha e anexo para falhar só no
   *   servidor. A RPC continua recusando (a promessa é do ato), mas recusar
   *   TARDE é pedir trabalho fiscal que vai para o lixo, e ensina que o erro é
   *   do app.
   *
   * As três recusam pelo mesmo desenho: banner no topo, nenhum campo montado, e
   * o caminho certo oferecido como link.
   */
  const recusa: React.ReactNode =
    !exigeGateDeRetencao(d) ? (
      <>
        A pergunta sobre retenção só existe em{" "}
        <strong>nota fiscal de serviço</strong> — este registro é de outro tipo, e
        não há resposta a reabrir.
      </>
    ) : gateAtual === null ? (
      <>
        Esta nota <strong>nunca respondeu</strong> se destaca alguma retenção. A
        primeira resposta não é uma correção: ela é dada no detalhe da nota,
        olhando o papel — e lá não se pergunta motivo, porque não há resposta
        anterior a corrigir.
      </>
    ) : soLinha && gateAtual !== "destacada" ? (
      <>
        A resposta gravada desta nota é <strong>{OPCOES_GATE.find((o) => o.valor === gateAtual)?.texto}</strong>, e por
        isso não há linha de retenção a acrescentar aqui: uma linha nova
        afirmaria a retenção que o gate nega. O caminho é{" "}
        <strong>corrigir a resposta sobre retenção</strong> — lá a linha entra no
        mesmo ato da correção do gate.
      </>
    ) : null;

  if (recusa !== null) {
    return (
      <>
        <CabecalhoDaTela titulo="Corrigir a retenção" sub={sub} />
        <ColunaDeDetalhe>
          <Banner cor="amb" role="status">
            {recusa}
          </Banner>
          {/* O caminho certo, quando ele existe nesta tela: a correção do gate
              (sem `?modo=linha`) é o que admite a linha nova. */}
          {soLinha && gateAtual !== null && exigeGateDeRetencao(d) ? (
            <BotaoLink
              href={`/documento/${id}/corrigir/retencao`}
              variante="primary"
            >
              Corrigir a resposta sobre retenção
            </BotaoLink>
          ) : null}
          <BotaoLink
            href={documentoHref}
            variante={soLinha && gateAtual !== null ? undefined : "primary"}
          >
            Voltar ao documento
          </BotaoLink>
        </ColunaDeDetalhe>
      </>
    );
  }

  const gateHoje =
    OPCOES_GATE.find((o) => o.valor === gateAtual)?.texto ?? gateAtual;

  // ── Gravado ────────────────────────────────────────────────────────────
  if (fase.nome === "gravado") {
    const gateMudou = fase.gateAntes !== fase.gateDepois;
    /** CONTAI-088, critério 12 — a próxima do pacote, com o papel deste ato. */
    const proxima = proximaDoPacote(
      id,
      pacote,
      fase.anexoUsado ?? anexoDoPacote,
    );
    return (
      <>
        <CabecalhoDaTela titulo="Retenção corrigida ✓" sub={sub} />
        <ColunaDeDetalhe>
          <Banner cor="grn" role="status">
            <strong>Retenção corrigida.</strong>{" "}
            {gateMudou ? (
              <>
                Gate:{" "}
                {OPCOES_GATE.find((o) => o.valor === fase.gateAntes)?.texto} →{" "}
                <strong>
                  {OPCOES_GATE.find((o) => o.valor === fase.gateDepois)?.texto}
                </strong>
                .{" "}
              </>
            ) : (
              <>
                A resposta sobre retenção continua{" "}
                <strong>
                  {OPCOES_GATE.find((o) => o.valor === fase.gateDepois)?.texto}
                </strong>
                .{" "}
              </>
            )}
            {fase.criadas > 0
              ? `${fase.criadas} ${fase.criadas === 1 ? "linha" : "linhas"} de retenção registrada${fase.criadas === 1 ? "" : "s"}.`
              : null}
            {fase.removidas > 0
              ? `${fase.removidas} ${fase.removidas === 1 ? "linha removida" : "linhas removidas"} — snapshot no histórico.`
              : null}
          </Banner>
          {/* O invariante do §2, dito em tela: nenhuma retenção desta nota abate
              o INSS. Nunca "anos afetados" — retenção não move custo. */}
          <Card>
            <Dica>{RETENCAO_NAO_ABATE_SERO}</Dica>
          </Card>
          {correcoes === null ? (
            <Card>
              <Dica>
                O histórico completo deste registro — com o snapshot de tudo que
                saiu — fica no detalhe da nota.
              </Dica>
            </Card>
          ) : (
            <HistoricoDeCorrecoes
              correcoes={correcoes}
              obras={obras}
              cnpj={d.favorecidoDocumento}
            />
          )}
          {/* Em modo pacote o avanço é PRIMÁRIO e o botão de hoje vira
              secundário (CONTAI-088, critério 12). Fora do pacote, nada muda. */}
          {proxima !== null ? (
            <>
              <BotaoLink href={proxima.href} variante="primary">
                {textoContinuar(proxima)}
              </BotaoLink>
              <BotaoLink href={documentoHref}>Ver o documento</BotaoLink>
            </>
          ) : (
            <BotaoLink href={documentoHref} variante="primary">
              Ver o documento
            </BotaoLink>
          )}
        </ColunaDeDetalhe>
      </>
    );
  }

  // ── Passo 1 e a saída "o erro é do papel" ──────────────────────────────
  if (fase.nome === "passo1" || fase.nome === "erro_do_papel") {
    return (
      <>
        <CabecalhoDaTela
          titulo={soLinha ? "Adicionar linha de retenção" : "Corrigir a retenção"}
          sub={fase.nome === "passo1" ? `${sub} · passo 1 de 4` : sub}
        />
        <ColunaDeDetalhe>
          <Card>
            <Linha rotulo={PERGUNTA_GATE}>
              <strong>{gateHoje}</strong>
            </Linha>
            <Linha rotulo="Linhas de retenção registradas">
              {linhasExistentes}
            </Linha>
          </Card>
          <Card>
            <ListaDeAnexos
              titulo="Papel anexado"
              itens={[
                ...papelOriginal(d.arquivoPath),
                ...anexos.map((a) => ({ path: a.arquivoPath })),
              ]}
              vazio={SEM_PAPEL_NO_ACERVO}
            />
          </Card>
          {fase.nome === "passo1" ? (
            <PassoMotivo
              documentoHref={documentoHref}
              de={4}
              onEscolher={(resposta: RespostaPasso1, motivoTexto) =>
                setFase(
                  resposta === "erro_do_papel"
                    ? { nome: "erro_do_papel" }
                    : { nome: "corrigir", motivo: resposta, motivoTexto },
                )
              }
            />
          ) : (
            <ErroEstaNaNota
              documentoHref={documentoHref}
              onVoltarAoPasso1={() => setFase({ nome: "passo1" })}
            />
          )}
        </ColunaDeDetalhe>
      </>
    );
  }

  // ── Passos 2 a 4 ───────────────────────────────────────────────────────
  //
  // Uma rolagem, três passos que aparecem à medida que a resposta anterior
  // existe. É tela de GESTÃO (`CLAUDE.md`, tabela de cenários): em casa,
  // sentado, com a nota na mão — a régua de "uma mão, com pressa" não se aplica.
  const motivo = fase.motivo;
  // `soLinha` fixa o gate: aqui ele é AFIRMADO, não escolhido (critério 6 do 087).
  const gateEscolhido: RespostaRetencaoNaNota | null = soLinha
    ? "destacada"
    : gateNovo;

  const gateIgual = gateEscolhido === gateAtual;
  /** Ramo 3c do spec — e ele **não grava nada**, nem o motivo do passo 1. */
  const nadaACorrigir = gateIgual && gateEscolhido === "nenhuma";
  const precisaLinha = gateEscolhido === "destacada";
  const precisaConfirmarRemocao =
    gateEscolhido === "nenhuma" && !gateIgual && linhasExistentes > 0;
  const motivoExigeAnexo = exigeAnexoNovo(motivo);
  const anexoEscolhido = anexo !== null || chip !== null;
  const faltaAnexo = motivoExigeAnexo && !anexoEscolhido;
  const faltaReconferencia = !motivoExigeAnexo && !reconferi;
  /** O passo 4 só existe quando o 3 produziu algo a gravar (spec, §telas). */
  const temAlgoAGravar =
    !nadaACorrigir &&
    gateEscolhido !== null &&
    (!precisaLinha || linhasNovas.length > 0) &&
    (!precisaConfirmarRemocao || confirmaRemocao);

  const podeGravar =
    temAlgoAGravar && !faltaAnexo && !faltaReconferencia && !gravando;

  const rotuloBotao = gravando
    ? "Gravando…"
    : gateEscolhido === null
      ? "Escolha a resposta nova para continuar"
      : nadaACorrigir
        ? "Nada a corrigir"
        : precisaLinha && linhasNovas.length === 0
          ? "Adicione ao menos uma linha de retenção para continuar"
          : precisaConfirmarRemocao && !confirmaRemocao
            ? "Confirme a remoção para continuar"
            : faltaAnexo
              ? "Anexe ou escolha um documento já anexado para gravar"
              : faltaReconferencia
                ? "Confirme que reconferiu o papel para gravar"
                : "Gravar a correção";

  /** CONTAI-088, critério 11 — `?anexo` fora deste documento é dito em tela. */
  const anexoDoPacoteNaoEstaAqui =
    motivoExigeAnexo &&
    anexoDoPacote !== null &&
    !anexos.some((a) => a.arquivoPath === anexoDoPacote);

  /** Critério 12 — "Pular esta" propaga o MESMO papel que chegou, sem gravar. */
  const proxima = proximaDoPacote(id, pacote, anexoDoPacote);

  async function gravar() {
    // `gateAtual === null` já parou lá em cima (o legado não entra aqui); o teste
    // volta porque o compilador não carrega a estreitura para dentro do closure —
    // e o `antes` do rastro é justamente o valor que não pode ser nulo.
    if (gateEscolhido === null || gateAtual === null || fase.nome !== "corrigir") {
      return;
    }
    setGravando(true);
    setErroGravar(null);
    try {
      // O upload vem ANTES da gravação, e é o único jeito: o `arquivo_path`
      // precisa existir no acervo para a RPC o registrar no mesmo ato. Falha no
      // upload = nada foi gravado, e a tela diz isso.
      //
      // ⚠️ O CHIP manda o path de um anexo que JÁ existe — e a RPC insere uma
      // linha NOVA em `documento_anexo` apontando para ele, com o `revisao_id`
      // deste ato. Um objeto no bucket, N atos apontando: nenhum upload
      // duplicado, e cada ato com o seu próprio rastro.
      //
      // ⚠️ **CONTAI-088, critério 10 — nada é anexado quando o motivo não pede
      // anexo**: um chip pré-selecionado pelo `?anexo=` do pacote não pode virar
      // prova de uma correção cujo motivo é "eu digitei errado".
      const anexoPath = !motivoExigeAnexo
        ? null
        : anexo
          ? await subirParaAcervo(anexo, "documento")
          : chip;

      if (soLinha) {
        await adicionarLinhaRetencaoRegistrada({
          documentoId: d.id,
          linha: linhasNovas[0],
          motivo,
          motivoTexto: fase.motivoTexto,
          anexoPath,
        });
      } else {
        await corrigirGateRetencao({
          documentoId: d.id,
          gate: gateEscolhido,
          motivo,
          motivoTexto: fase.motivoTexto,
          linhas: linhasNovas,
          anexoPath,
        });
      }

      setFase({
        nome: "gravado",
        gateAntes: gateAtual,
        gateDepois: gateEscolhido,
        criadas: linhasNovas.length,
        removidas: gateEscolhido === "nenhuma" && !gateIgual ? linhasExistentes : 0,
        anexoUsado: anexoPath,
      });

      // O histórico do spec. Falha aqui NÃO desfaz nem desmente a gravação: o
      // sucesso acima já aconteceu, e o fallback manda ver no detalhe da nota.
      try {
        const [rastro, listaDeObras] = await Promise.all([
          carregarCorrecoesDoDocumento(d.id, d.favorecidoId),
          carregarObras(),
        ]);
        setCorrecoes(rastro);
        setObras(new Map(listaDeObras.map((o) => [o.id, o.nome])));
      } catch {
        setCorrecoes(null);
      }
    } catch (erro) {
      setGravando(false);
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroGravar(
        mensagemDeErroDeGravacao(
          erro,
          "no detalhe desta nota, se a retenção já aparece corrigida",
        ),
      );
    }
  }

  return (
    <>
      <CabecalhoDaTela
        titulo={soLinha ? "Adicionar linha de retenção" : "Corrigir a retenção"}
        sub={`${sub} · passo ${temAlgoAGravar ? 4 : precisaLinha ? 3 : 2} de 4`}
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
                <strong>Nada foi alterado</strong> — a resposta sobre retenção
                continua {gateHoje}, as linhas continuam como estavam e nenhum
                registro de correção foi criado.
              </>
            }
          />
        ) : null}

        <MotivoEscolhidoResumo
          motivo={motivo}
          texto={fase.motivoTexto}
          onTrocar={() => setFase({ nome: "passo1" })}
        />

        {/* ── Passo 2 — a resposta atual e a nova ────────────────────────── */}
        <Passo>Passo 2 de 4 — a resposta sobre retenção</Passo>
        <Card>
          <Linha rotulo={PERGUNTA_GATE}>
            Hoje: <strong>{gateHoje}</strong>
          </Linha>
          {soLinha ? (
            <Dica>
              Este caminho <strong>não muda</strong> a resposta sobre retenção —
              ele só acrescenta uma linha a uma nota que já destaca retenção. Para
              mudar a resposta, volte ao documento e escolha “Corrigir a resposta
              sobre retenção”.
            </Dica>
          ) : (
            <div className="mt-2.5">
              <Escolha
                destaque
                campo="gateNovo"
                rotulo="Qual é a resposta certa, olhando a nota?"
                opcoes={OPCOES_GATE}
                valor={gateNovo}
                onChange={(v: RespostaRetencaoNaNota) => {
                  setGateNovo(v);
                  // Trocar o gate zera o que o ramo anterior tinha coletado: uma
                  // linha digitada para "destacada" não pode sobreviver escondida
                  // numa reversão para "nenhuma", e a confirmação de remoção não
                  // pode sobreviver a um gate que deixou de removê-las.
                  setLinhasNovas([]);
                  setAbrindoLinha(false);
                  setConfirmaRemocao(false);
                }}
              />
            </div>
          )}
        </Card>

        {/* ── Passo 3 — o ramo ──────────────────────────────────────────── */}
        {gateEscolhido === null ? null : nadaACorrigir ? (
          <>
            <Passo>Passo 3 de 4</Passo>
            <Card>
              <Dica>
                Nada a corrigir: esta nota já não tinha nenhuma linha de retenção.
              </Dica>
              {/* ⚠️ E **nada é gravado aqui — nem o motivo do passo 1** (critério
                  5, ratificado pelo `contador`): registrar uma reafirmação seria
                  gravar um não-evento num acervo que existe para guardar fatos
                  com consequência. */}
              <Dica>
                Sair daqui não deixa registro, e isso é decisão: o acervo guarda
                fatos com consequência, não consultas.
              </Dica>
              <div className="mt-2.5">
                <BotaoLink href={documentoHref} variante="primary">
                  Voltar ao documento
                </BotaoLink>
              </div>
            </Card>
          </>
        ) : precisaLinha ? (
          <>
            <Passo>
              Passo 3 de 4 — {soLinha ? "a linha nova" : "as linhas desta nota"}
            </Passo>
            {/* ⚠️ As linhas JÁ GRAVADAS não aparecem aqui (spec, decisões): o
                lugar de editar e remover linha existente é o `Repeater` do
                detalhe. Dois lugares para a mesma ação é a primeira coisa que
                divergiria. Este passo coleta só o que é NOVO. */}
            {linhasNovas.map((linha, i) => (
              <Card key={`${i}-${linha.rotuloLiteral}`}>
                <LinhaPendente
                  linha={linha}
                  onRemover={() =>
                    setLinhasNovas((atuais) =>
                      atuais.filter((_, posicao) => posicao !== i),
                    )
                  }
                />
              </Card>
            ))}
            {linhasNovas.length === 0 || abrindoLinha ? (
              <Card>
                {/* Nasce ABERTO no estado vazio (padrão do
                    `BlocoRetencaoDaCaptura`): cobrar um clique para abrir o que
                    ele veio preencher é fricção sem ganho. **Sem `sugestao`**: não
                    há PDF novo a ler aqui. */}
                <FormularioDeLinha
                  onAdicionar={(entrada) => {
                    setLinhasNovas((atuais) => [...atuais, entrada]);
                    setAbrindoLinha(false);
                  }}
                  onCancelar={
                    linhasNovas.length === 0
                      ? undefined
                      : () => setAbrindoLinha(false)
                  }
                />
              </Card>
            ) : soLinha ? (
              // Modo "só linha" grava UMA linha por ato — é o que a RPC do
              // CONTAI-087 recebe (`p_linha`, singular), e cada linha tardia tem
              // o seu próprio motivo e a sua própria prova.
              <Card>
                <Dica>
                  Uma linha por correção: grave esta e, se houver outra, comece de
                  novo — cada linha tardia tem o seu motivo e a sua prova.
                </Dica>
              </Card>
            ) : (
              <Card>
                <button
                  type="button"
                  className="min-h-[44px] text-left font-semibold underline"
                  onClick={() => setAbrindoLinha(true)}
                >
                  + Adicionar outra linha
                </button>
                <Dica>Cada linha nova nasce em branco — nada é herdado.</Dica>
              </Card>
            )}
          </>
        ) : (
          <>
            <Passo>Passo 3 de 4 — o que sai do registro</Passo>
            {linhasExistentes === 0 ? (
              <Card>
                <Dica>
                  Esta nota não tem linha de retenção registrada — não há nada a
                  remover. A correção é só da resposta sobre retenção.
                </Dica>
              </Card>
            ) : (
              /* ⚠️ Vermelho, e com razão: aqui uma pendência fiscal REAL deixa de
                 aparecer. O texto é citação do Gate Fiscal — não se reescreve. */
              <Card className="border-red">
                <Consequencia cor="red">
                  {avisoDeRemocaoDasLinhas(linhasExistentes)}
                </Consequencia>
                <label className="mt-2 flex min-h-[44px] cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    data-campo="confirmaRemocao"
                    checked={confirmaRemocao}
                    onChange={(e) => setConfirmaRemocao(e.target.checked)}
                    className="mt-1 h-5 w-5 flex-none"
                  />
                  <span className="text-[13px]">
                    {confirmacaoDeRemocaoDasLinhas(linhasExistentes)}
                  </span>
                </label>
              </Card>
            )}
          </>
        )}

        {/* ── Passo 4 — o anexo, condicional pelo motivo ─────────────────── */}
        {temAlgoAGravar ? (
          <>
            <Passo>Passo 4 de 4 — a prova</Passo>
            {motivoExigeAnexo ? (
              <>
                <CampoArquivo
                  campo="anexo"
                  rotulo="Documento novo do emitente"
                  ajuda={
                    proxima !== null
                      ? `PDF, XML ou foto. Sem ele, esta correção não grava. ${ARQUIVO_SERA_REAPROVEITADO}`
                      : "PDF, XML ou foto. Sem ele, esta correção não grava."
                  }
                  accept="application/pdf,image/*,text/xml,application/xml"
                  arquivo={anexo}
                  onChange={(f) => {
                    setAnexo(f);
                    // Upload e chip são a MESMA pergunta ("qual papel prova
                    // isto?"), e ela tem uma resposta só.
                    if (f !== null) setChip(null);
                  }}
                  erro={faltaAnexo ? "O documento novo é obrigatório." : undefined}
                />
                {/* ── Os chips do critério 10 ──────────────────────────────
                    ⚠️ **O bloco saiu daqui para `ChipsDeAnexoExistente`
                    (CONTAI-088, critério 1), e o comportamento é o MESMO**: ele
                    nasceu nesta tela e `corrigir/numero`/`corrigir/valor`
                    passaram a precisar dele. Três cópias seriam três lugares
                    para a regra de qual papel aparece divergir — e ela é fiscal:
                    só os anexos ADICIONAIS, nunca o `arquivo_path` original,
                    porque com `motivo = emitente_corrigiu_a_nota` o papel que
                    prova a correção é o que CHEGOU DEPOIS.

                    O rótulo continua vindo do CAMPO corrigido (o QUÊ), não do
                    motivo (o POR QUÊ): "correção de número da nota" é o que
                    identifica o papel que o CONTAI-085 pode ter anexado segundos
                    antes. */}
                <ChipsDeAnexoExistente
                  anexos={anexos}
                  titulo={TITULO_CHIPS_NA_CORRECAO}
                  escolhido={
                    chip === null ? null : { tipo: "existente", path: chip }
                  }
                  onEscolher={(papel) => {
                    if (papel.tipo !== "existente") return;
                    setChip(papel.path);
                    setAnexo(null);
                  }}
                  dica={
                    chip !== null && chip === anexoDoPacote
                      ? ANEXO_VEIO_DO_PACOTE
                      : undefined
                  }
                />
                {anexoDoPacoteNaoEstaAqui ? (
                  <Consequencia cor="amb">
                    {ANEXO_DO_PACOTE_NAO_ESTA_AQUI}
                  </Consequencia>
                ) : null}
                {/* Critério 13 — o papel escolhido, visível ANTES de gravar. */}
                {pacote !== null ? (
                  <PapelEscolhidoAntesDeGravar arquivo={anexo} chip={chip} />
                ) : null}
                {/* Verbatim do Gate Fiscal do CONTAI-085, mesma regra aqui: o
                    anexo não se substitui, anexa-se adicional. */}
                <Consequencia cor="amb">
                  <code className="mono">documento.arquivo_path</code> não muda. O
                  papel novo entra como anexo adicional do documento — o arquivo
                  original continua lá. O dossiê lista os dois.
                </Consequencia>
              </>
            ) : (
              /* ⚠️ **Sem upload, mas NÃO sem conferência** (Gate Fiscal: extensão
                 por analogia do ADENDO §3 — alterar um fato fiscal já gravado sem
                 olhar o papel de novo é o mesmo "flip barato" que o §2 proíbe). */
              <>
                <Card>
                  <ListaDeAnexos
                    titulo="Papel anexado — confira antes de gravar"
                    itens={[
                      ...papelOriginal(d.arquivoPath),
                      ...anexos.map((a) => ({ path: a.arquivoPath })),
                    ]}
                    vazio={SEM_PAPEL_NO_ACERVO}
                  />
                </Card>
                <Card className={reconferi ? "border-grn" : "border-amb"}>
                  <label className="flex min-h-[44px] cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      data-campo="reconferiAfirmacao"
                      checked={reconferi}
                      onChange={(e) => setReconferi(e.target.checked)}
                      className="mt-1 h-5 w-5 flex-none"
                    />
                    <span className="text-[13px]">
                      Confirmo que reconferi o papel já anexado, e a retenção
                      desta nota é o que estou gravando aqui.
                    </span>
                  </label>
                </Card>
              </>
            )}

            <Passo>O que fica registrado</Passo>
            <Card>
              {gateIgual ? null : (
                <Linha rotulo="campo retencao_na_nota">
                  <span className="mono">
                    {gateHoje} →{" "}
                    {OPCOES_GATE.find((o) => o.valor === gateEscolhido)?.texto}
                  </span>
                </Linha>
              )}
              {linhasNovas.length > 0 ? (
                <Linha rotulo="linhas novas">
                  {linhasNovas.length}, no mesmo ato
                </Linha>
              ) : null}
              {precisaConfirmarRemocao ? (
                <Linha rotulo="linhas removidas">
                  {linhasExistentes}, com snapshot completo no histórico
                </Linha>
              ) : null}
              <Linha rotulo="motivo">
                {fase.motivoTexto ?? ROTULO_MOTIVO_NO_RASTRO[motivo]}
              </Linha>
              <Linha rotulo="quando, e por quem">no ato da gravação</Linha>
              {/* ⚠️ "anos afetados" NÃO APARECE AQUI, e a ausência é o Gate
                  Fiscal: nenhuma retenção desta nota move custo de aquisição nem
                  base de aferição (parecer de 2026-09-18, §2 e ADENDO A.2).
                  Escrever "nenhum" convidaria a pergunta "em que caso seria
                  algum?", que não existe. */}
            </Card>
            <Dica>
              Correção registrada <strong>não se apaga e não se edita</strong> —
              nem por você. A correção e o registro dela vão juntos, numa operação
              só: ou as duas coisas acontecem, ou nenhuma acontece.
            </Dica>
          </>
        ) : null}
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
        {/* Em modo pacote, "Cancelar" vira "Pular esta" — e pular NÃO grava nada
            nem pede confirmação (CONTAI-088, critério 12). */}
        {proxima !== null ? (
          <BotaoLink href={proxima.href}>{textoPular(proxima)}</BotaoLink>
        ) : (
          <BotaoLink href={documentoHref}>Cancelar</BotaoLink>
        )}
      </RodapeDeAcao>
    </>
  );
}
