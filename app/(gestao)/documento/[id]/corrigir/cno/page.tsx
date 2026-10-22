"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import {
  ListaDeAnexos,
  papelOriginal,
  SEM_PAPEL_NO_ACERVO,
} from "@/app/_components/anexo";
import { CampoArquivo } from "@/app/_components/campos";
import {
  ANEXO_DO_PACOTE_NAO_ESTA_AQUI,
  ANEXO_VEIO_DO_PACOTE,
  ARQUIVO_SERA_REAPROVEITADO,
  ChipsDeAnexoExistente,
  HistoricoDeCorrecoes,
  PapelEscolhidoAntesDeGravar,
  TITULO_CHIPS_NA_CORRECAO,
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
  Consequencia,
  Dica,
  ErroDeGravacao,
  EstadoErro,
  Linha,
  Passo,
} from "@/app/_components/ui";
import {
  carregarAnexosDoDocumento,
  carregarCorrecoesDoDocumento,
  carregarDocumento,
  carregarObra,
  carregarObras,
  classificarErro,
  corrigirCnoDoDocumento,
  mensagemDeErroDeGravacao,
  subirParaAcervo,
  type AnexoDoDocumento,
  type ErroDeTela,
} from "@/lib/data";
import { recusaDaCorrecaoDeCno } from "@/lib/fiscal/documento";
import { CNO_NAO_ALCANCA_O_CUSTO, cnoNormalizado } from "@/lib/fiscal/obra";
import {
  lerAnexoDoPacote,
  lerPacote,
  proximaDoPacote,
  textoContinuar,
  textoPular,
} from "@/lib/gestao/pacote-correcao";
import type { Documento, Obra, Revisao } from "@/lib/types";

type Fase =
  | { nome: "campo" }
  | {
      nome: "gravado";
      /** O CNO que o SERVIDOR gravou — é `obra.cno`, lido lá dentro. */
      cno: string;
      /** O path que ESTE ato usou — é ele que segue para a próxima do pacote. */
      anexoUsado: string;
    };

/**
 * ⚠️ **TEXTO DE CONSEQUÊNCIA FISCAL, COPIADO VERBATIM DO FECHO DO ADENDO
 * 2026-10-22** (`docs/pareceres/2026-08-18-correcao-de-documento-registrado.md`,
 * linha **CRC**) — não reescrever, não encurtar.
 *
 * É ele, e **não** `CNO_NAO_ALCANCA_O_CUSTO`, a consequência desta correção
 * (ressalva do Gate 2). `CNO_NAO_ALCANCA_O_CUSTO` vem do Gate Fiscal do
 * CONTAI-007 e descreve nota que referencia OUTRA obra: nesta tela, onde o CNO
 * gravado é exatamente o desta obra, ela seria proveniência errada E frase
 * falsa. Também não se confunde com `CONSEQUENCIA_CNO_DA_NOTA`, que descreve o
 * estado ANTES da correção e mora na pendência do painel.
 *
 * Mora aqui, e não em `lib/fiscal/obra.ts`, pelo mesmo motivo de
 * `ArquivoNaoMuda` em `corrigir/numero`: é texto de UM ato, e aquele módulo está
 * fora do escopo deste ticket.
 */
const CONSEQUENCIA_DESTA_CORRECAO =
  "Este campo não alimenta a Declaração de Ajuste Anual (custo de aquisição " +
  "não muda) nem é ele próprio objeto de retificadora — o que ele alimenta é " +
  "a posição da aferição do INSS, que não é apuração da DAA.";

/**
 * **CONTAI-101 — registrar que a nota PASSOU A TRAZER o CNO desta obra.**
 *
 * Dor de origem (`docs/backlog/114-2026-10-22-corrigir-cno-ausente-apos-reemissao.md`),
 * palavras do Mateus: *"a nota fiscal que recebi não constava CNO da obra,
 * solicitei e eles me enviaram, mas não consigo adicionar uma nova nota com a
 * razão adição de CNO."* O documento ficava com `notaTrazCno = false` para
 * sempre, a pendência âmbar "nota sem CNO" nunca fechava, e a nota continuava em
 * `foraDaBase` da posição de aferição, com motivo `nota_sem_cno`
 * (`lib/fiscal/afericao.ts`), embora o papel já referencie o CNO desta obra.
 *
 * ⚠️ **"Sair de `foraDaBase`" não é "abater a aferição"** (D57, e o invariante do
 * `CLAUDE.md`): a base NÃO é reduzida pelo valor da nota, pelo valor retido nem
 * por percentual nenhum — quem a reduz é a mão de obra que a prestadora declara
 * e vincula ao CNO (eSocial + EFD-Reinf), campo que o produto não tem. O que esta
 * correção muda é a POSIÇÃO: a nota deixa de aparecer como pendência dentro da
 * aferição desta obra — e passa a compor o `baseCentavos`, que é PROXY declarado
 * (D57, `lib/fiscal/afericao.ts`), maior do que a base que o fisco aceitaria
 * provada. Quem assina a aferição continua sendo o CRC.
 *
 * Ratificado no ADENDO 2026-10-22 do parecer
 * `2026-08-18-correcao-de-documento-registrado.md`: `nao_traz → desta_obra` é
 * corrigível. **`outra_obra` não ganha caminho** — aquele estado bloqueia o
 * registro no ato (critério 2 do CONTAI-007) e nunca persiste, então não existe
 * linha para corrigir.
 *
 * ⚠️ **QUATRO coisas que esta tela NÃO tem, e cada ausência é decisão escrita**
 * (critério 4) — cortadas, nunca escondidas:
 *
 * 1. **Sem `PassoMotivo`.** O ADENDO ratificou UMA causa (o dado estava
 *    ausente, o prestador reemitiu com o CNO impresso), e o motivo é gravado
 *    pela máquina. Com motivo escolhível existiria um caminho ("eu digitei
 *    errado") que gravaria `notaTrazCno = true` **sem papel nenhum mostrando o
 *    CNO** — a divergência app↔papel que o §3 do parecer proíbe.
 * 2. **Sem campo de CNO digitável.** O valor gravado é SEMPRE `obra.cno`, lido
 *    no servidor dentro da RPC. O que esta tela mostra é confirmação de um fato
 *    já cadastrado, não pergunta — por isso não viola "campo vazio pergunta,
 *    campo preenchido afirma": não há pergunta aqui, só o anexo afirma algo.
 * 3. **Sem bloco "custo confirmado por ano".** §0(a) do parecer é literal em que
 *    o único campo de `documento` que move custo entre anos-calendário é
 *    `valor`. CNO nunca entrou na conta `C = min(Σ pagamentos, Σ documentos)`.
 * 4. **Sem estado "Nada a corrigir".** As três recusas de pré-condição já cobrem
 *    os únicos casos sem o que fazer, e cobrem ANTES de montar campo nenhum.
 */
export default function CorrigirCno() {
  return (
    // `useSearchParams` exige fronteira de Suspense — o `?pacote`/`?anexo` do
    // CONTAI-088 chega por query. Mesmo padrão das três telas irmãs.
    <Suspense
      fallback={
        <>
          <CabecalhoDaTela titulo="Corrigir o CNO da nota" />
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

function Tela() {
  const { id } = useParams<{ id: string }>();
  const { pedirReautenticacao } = useSessao();
  /** CONTAI-088 — `null` é "não há pacote": a rota foi aberta direto. */
  const busca = useSearchParams();
  const pacote = lerPacote(busca);
  const anexoDoPacote = lerAnexoDoPacote(busca);

  const [documento, setDocumento] = useState<Documento | null>(null);
  /**
   * ⚠️ A OBRA é carregada junto, e não é enfeite: é dela que sai o CNO exibido
   * no "depois". A tela não o deriva de mais lugar nenhum — e o que ela mostra é
   * o mesmo campo que a RPC vai reler no servidor no ato da gravação.
   */
  const [obra, setObra] = useState<Obra | null>(null);
  const [anexos, setAnexos] = useState<AnexoDoDocumento[]>([]);
  const [erroCarregar, setErroCarregar] = useState<ErroDeTela | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [fase, setFase] = useState<Fase>({ nome: "campo" });
  const [anexo, setAnexo] = useState<File | null>(null);
  /** O papel já no acervo, escolhido por chip (CONTAI-088, critério 1). */
  const [chip, setChip] = useState<string | null>(null);
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
        const [lista, o] = await Promise.all([
          carregarAnexosDoDocumento(d.id),
          carregarObra(d.obraId),
        ]);
        if (cancelado) return;
        setDocumento(d);
        setObra(o);
        setAnexos(lista);
        // ⚠️ **CONTAI-088, critério 11 — `?anexo` só pré-seleciona o que está
        // NESTE documento.** O path vem da querystring, que é digitável à mão e
        // chega de link velho: aceitá-lo sem conferir mandaria à RPC um papel
        // que a tela nunca viu na lista do próprio documento.
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
    setObra(null);
    setErroGravar(null);
    setTentativa((t) => t + 1);
  }, []);

  async function gravar(cnoDaObra: string) {
    if (!documento) return;
    setGravando(true);
    setErroGravar(null);
    try {
      // O upload vem ANTES da gravação, e é o único jeito: o `arquivo_path`
      // precisa existir no acervo para a função Postgres o registrar no mesmo
      // ato. Falha no upload = nada foi gravado, e a tela diz isso.
      //
      // ⚠️ O CHIP manda o path de um anexo que JÁ existe — e a RPC insere uma
      // LINHA NOVA em `documento_anexo` apontando para ele, com o `revisao_id`
      // deste ato. Um objeto no bucket, N atos apontando.
      //
      // ⚠️ **E aqui não há `exigeAnexoNovo`**: o anexo é INCONDICIONAL
      // (critério 7), porque não há motivo a escolher. O `??` nunca cai no vazio
      // — `podeGravar` já exige um dos dois —, e a string vazia só existiria se
      // ele caísse: a RPC a recusa.
      const anexoPath = anexo
        ? await subirParaAcervo(anexo, "documento")
        : (chip ?? "");
      await corrigirCnoDoDocumento({
        documentoId: documento.id,
        anexoPath,
      });
      setFase({
        nome: "gravado",
        // ⚠️ O que a tela ANUNCIA é o `obra.cno` que ela leu; o que o banco
        // GRAVOU é o `obra.cno` relido no servidor. Os dois divergiriam só se a
        // obra tivesse o CNO corrigido entre o carregamento e o clique — caso em
        // que o acervo fica certo e esta frase, velha. `tentarDeNovo` no
        // histórico abaixo mostra o gravado.
        cno: cnoDaObra,
        anexoUsado: anexoPath,
      });

      // O histórico do spec. Falha aqui NÃO desfaz nem desmente a gravação: o
      // sucesso acima já aconteceu, e o fallback manda ver no detalhe da nota.
      try {
        const [rastro, listaDeObras] = await Promise.all([
          carregarCorrecoesDoDocumento(documento.id, documento.favorecidoId),
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
          "no detalhe da nota, se o CNO já aparece registrado",
        ),
      );
    }
  }

  const documentoHref = `/documento/${id}`;
  const titulo = "Corrigir o CNO da nota";

  // ── Carregando / erro ──────────────────────────────────────────────────
  if (!documento || !obra) {
    return (
      <>
        <CabecalhoDaTela titulo={titulo} />
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

  // ── Gravado ────────────────────────────────────────────────────────────
  if (fase.nome === "gravado") {
    /** CONTAI-088, critério 12 — a próxima do pacote, com o papel deste ato. */
    const proxima = proximaDoPacote(id, pacote, fase.anexoUsado);
    return (
      <>
        <CabecalhoDaTela titulo="CNO corrigido ✓" sub={sub} />
        <ColunaDeDetalhe>
          <Banner cor="grn" role="status">
            {/* ⚠️ **O QUE FECHA É A PENDÊNCIA DO PAINEL, não a lista de
                cobrança** — ressalva do Gate 2, e a distinção é fiscal, não de
                redação. São duas superfícies com recortes diferentes:

                · a pendência `sem-cno:` do painel (`lib/fiscal/resumo.ts`, chip
                  "Nota sem CNO") olha a nota **sem janela nenhuma** — basta
                  `notaTrazCno === false` numa obra com CNO;
                · a lista `/obras/[id]/notas-sem-cno` (`notasEmitidasSemCno`,
                  `lib/fiscal/obra.ts`) só considera notas emitidas entre
                  `dataInicioObra` e `cnoRegistradoEm`.

                No caso do relato 114 a nota foi emitida DEPOIS de o CNO sair,
                então ela nunca esteve naquela lista — prometer que ela "deixa de
                constar" ali seria falso exatamente no caso que originou o
                ticket. Texto fechado pelo `contador` no Gate 2.

                ⚠️ E é por NOTA, nunca por prestador: as outras notas do mesmo
                prestador continuam pendentes. */}
            <strong>Corrigido.</strong> Esta nota agora traz o CNO{" "}
            <strong className="mono">{fase.cno}</strong>, e a correção ficou
            registrada no histórico do documento. A pendência &ldquo;Nota sem
            CNO&rdquo; desta nota deixa de aparecer no painel.
          </Banner>
          {/* Sem card de "anos afetados": CNO não move custo entre exercícios
              (parecer §0(a)). Não é bloco oculto — ele não existe nesta tela. */}
          {correcoes === null ? (
            <Card>
              <Dica>
                O histórico completo deste registro fica no detalhe da nota.
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

  /**
   * ⚠️ **AS TRÊS PORTAS QUE ESTA TELA NÃO É, e a recusa vem ANTES de montar
   * campo nenhum** — critério 6, mesmo padrão de "recusar cedo" de
   * `corrigir/retencao`. Chega-se a qualquer uma delas por URL digitada à mão,
   * link velho, ou pelo estado mudando em outra aba.
   *
   * A decisão de QUAL recusa se aplica é de `recusaDaCorrecaoDeCno`
   * (`lib/fiscal/documento.ts`, com teste próprio): ela é pré-condição fiscal,
   * ratificada no ADENDO, e não layout. Aqui mora só o texto de cada uma.
   *
   * ⚠️ **Nenhuma delas grava nada**, e as duas últimas são repetidas pela RPC —
   * a promessa é do ato, não da tela. Mas recusar TARDE é pedir trabalho fiscal
   * que vai para o lixo e ensina que o erro é do app (achado do Gate 2 do
   * CONTAI-086).
   */
  const recusa = recusaDaCorrecaoDeCno(d.tipo, d.notaTrazCno, obra.cno);

  if (recusa !== null) {
    const texto: React.ReactNode =
      recusa === "nao_e_nf_servico" ? (
        <>
          Este documento não é uma <strong>NF de serviço</strong> — o CNO
          impresso só se aplica a notas de serviço. Nada foi alterado.
        </>
      ) : recusa === "nunca_perguntado" ? (
        <>
          Esta nota <strong>nunca foi perguntada</strong> sobre o CNO impresso —
          não é o caso de &ldquo;nota sem CNO&rdquo; que esta correção resolve.
          Nada foi alterado.
        </>
      ) : recusa === "ja_traz_cno" ? (
        <>
          Esta nota já traz CNO impresso (
          <strong className="mono">{d.cnoReferenciado}</strong>) — não há
          &ldquo;nota sem CNO&rdquo; aqui para corrigir. Nada foi alterado.
        </>
      ) : (
        <>
          Esta obra ainda não tem CNO cadastrado. Sem ele, não há o que gravar
          aqui — primeiro registre o CNO da obra, depois volte para confirmar que
          esta nota o traz. Nada foi alterado.
        </>
      );

    return (
      <>
        <CabecalhoDaTela titulo={titulo} sub={sub} />
        <ColunaDeDetalhe>
          <Card className="border-amb">
            <Banner cor="amb" role="status">
              {texto}
            </Banner>
            {/* ⚠️ **CONDICIONADO A O CNO IMPRESSO SER DE OUTRA OBRA, e a
                condição é uma ressalva do Gate 2.** `CNO_NAO_ALCANCA_O_CUSTO`
                vem do Gate Fiscal do **CONTAI-007** (`lib/fiscal/obra.ts`,
                verbatim — não reescrever), e **não** do ADENDO 2026-10-22. A
                frase termina em *"de uma obra que ela não referencia"*: dita
                para uma nota cujo CNO impresso é justamente o desta obra, ela é
                FALSA. Sai quando os dois coincidem; fica quando divergem, que é
                o estado que `posicaoDeAfericao` chama de `cno_divergente`.
                `cnoNormalizado` é a MESMA função que a aferição usa — a tela não
                escreve uma segunda regra de comparação de CNO. */}
            {recusa === "ja_traz_cno" &&
            cnoNormalizado(d.cnoReferenciado) !== cnoNormalizado(obra.cno) ? (
              <Dica>{CNO_NAO_ALCANCA_O_CUSTO}</Dica>
            ) : null}
          </Card>
          {/* ⚠️ A ÚNICA recusa cuja saída não é só voltar: sem CNO na obra não
              há valor a gravar, e o conserto é no cadastro da obra — não nesta
              nota. Sem redirecionamento automático de volta para cá depois
              (Out of Scope / Pergunta Aberta 2): não se presume fluxo sem
              requisito fechado. */}
          {recusa === "obra_sem_cno" ? (
            <BotaoLink href={`/obras/${d.obraId}`} variante="primary">
              Cadastrar o CNO da obra
            </BotaoLink>
          ) : null}
          <BotaoLink
            href={documentoHref}
            variante={recusa === "obra_sem_cno" ? undefined : "primary"}
          >
            Voltar ao documento
          </BotaoLink>
        </ColunaDeDetalhe>
      </>
    );
  }

  /**
   * Depois da recusa `obra_sem_cno`, `obra.cno` é necessariamente uma string
   * preenchida — mas o tipo continua `string | null`, e o `??` existe para o
   * typecheck, não para um caso de runtime.
   */
  const cnoDaObra = obra.cno ?? "";

  // ── O passo único: o anexo ─────────────────────────────────────────────
  //
  // ⚠️ **ANEXO SEMPRE OBRIGATÓRIO, INCONDICIONAL** (critério 7). Não há
  // `exigeAnexoNovo` aqui porque não há motivo de que ele dependesse: o único
  // ato que esta tela descreve é "o prestador mandou o papel com o CNO
  // impresso", e sem o papel o ato não aconteceu.
  //
  /** Upload e chip são a MESMA pergunta, com UMA resposta (CONTAI-088). */
  const anexoEscolhido = anexo !== null || chip !== null;
  const podeGravar = anexoEscolhido && !gravando;

  /** Critério 11 do CONTAI-088 — `?anexo` fora deste documento é dito em tela. */
  const anexoDoPacoteNaoEstaAqui =
    anexoDoPacote !== null &&
    !anexos.some((a) => a.arquivoPath === anexoDoPacote);

  /** CONTAI-088, critério 12 — "Pular esta" propaga o papel que chegou. */
  const proxima = proximaDoPacote(id, pacote, anexoDoPacote);

  const rotuloBotao = gravando
    ? "Gravando…"
    : !anexoEscolhido
      ? // O rótulo acompanha o que a tela de fato oferece: sem anexo adicional
        // no documento, não há chip a escolher.
        anexos.length > 0
        ? "Anexe ou escolha o papel com o CNO para gravar"
        : "Anexe a nota reemitida para gravar"
      : "Gravar a correção";

  return (
    <>
      <CabecalhoDaTela titulo={titulo} sub={sub} />
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
                <strong>Nada foi alterado</strong> — a nota continua sem CNO e
                nenhum registro de correção foi criado.
              </>
            }
          />
        ) : null}

        {/* ── O fato: hoje → depois, read-only ─────────────────────────────
            Reusa o rótulo "CNO na nota" do detalhe do documento, com dois
            valores em vez de um. Sem `Passo` numerado: é campo único, não
            wizard. */}
        <Card>
          <Linha rotulo="CNO na nota — hoje">
            <span className="font-semibold text-amb">não traz CNO</span>
          </Linha>
          <Linha rotulo="depois">
            <span className="mono">{cnoDaObra}</span>
          </Linha>
          <Dica>o CNO cadastrado nesta obra</Dica>
        </Card>
        <Dica>
          Isto não é pergunta — é o que vai ser gravado, lido do cadastro da
          obra. CNO da obra errado?{" "}
          <a className="font-semibold underline" href={`/obras/${d.obraId}`}>
            Corrija em &ldquo;Dados da obra&rdquo;
          </a>{" "}
          primeiro.
        </Dica>

        {/* ── A prova documental: o único campo de fato ────────────────────── */}
        <Card>
          <ListaDeAnexos
            titulo="Papel anexado — confira antes de salvar"
            itens={papelOriginal(d.arquivoPath)}
            vazio={SEM_PAPEL_NO_ACERVO}
          />
          <Dica>
            O anexo <strong>não se substitui</strong>; o papel com o CNO entra
            como adicional, e o dossiê lista os dois.
          </Dica>
        </Card>

        <Passo>O papel em que o CNO aparece impresso</Passo>
        <CampoArquivo
          campo="anexo"
          rotulo="Nota reemitida, carta de correção ou documento complementar"
          /* ⚠️ A UI **não distingue o tipo de instrumento** (Out of Scope, e o
             Gate Fiscal é literal): o produto só exige que o papel mostre o CNO
             impresso e legível, não qual norma municipal o emitiu. */
          ajuda={
            proxima !== null
              ? `PDF, XML ou foto — qualquer papel em que o CNO apareça impresso e legível. Sem ele, esta correção não grava. ${ARQUIVO_SERA_REAPROVEITADO}`
              : "PDF, XML ou foto — qualquer papel em que o CNO apareça impresso e legível. Sem ele, esta correção não grava."
          }
          accept="application/pdf,image/*,text/xml,application/xml"
          arquivo={anexo}
          onChange={(f) => {
            setAnexo(f);
            // Upload e chip são a MESMA pergunta ("qual papel prova isto?"), e
            // ela tem uma resposta só.
            if (f !== null) setChip(null);
          }}
          erro={
            !anexoEscolhido
              ? "O papel com o CNO impresso é obrigatório."
              : undefined
          }
        />
        {/* Só os anexos ADICIONAIS, nunca o `arquivo_path` original: o papel que
            prova esta correção é o que CHEGOU DEPOIS. Oferecer a nota original
            como prova de que ela passou a trazer CNO seria oferecer o papel
            errado com um rótulo convincente. */}
        <ChipsDeAnexoExistente
          anexos={anexos}
          titulo={TITULO_CHIPS_NA_CORRECAO}
          escolhido={chip === null ? null : { tipo: "existente", path: chip }}
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
          <Consequencia cor="amb">{ANEXO_DO_PACOTE_NAO_ESTA_AQUI}</Consequencia>
        ) : null}
        {/* O papel escolhido, visível ANTES de gravar (CONTAI-088, critério
            13). */}
        {pacote !== null ? (
          <PapelEscolhidoAntesDeGravar arquivo={anexo} chip={chip} />
        ) : null}

        {/* ── A consequência ──────────────────────────────────────────────── */}
        {/* ⚠️ **Trocado no Gate 2: aqui vai o Fecho/CRC do ADENDO 2026-10-22, e
            NÃO `CNO_NAO_ALCANCA_O_CUSTO`.** Aquela constante vem do Gate Fiscal
            do CONTAI-007 e fala de nota que referencia OUTRA obra — citá-la como
            consequência desta correção seria proveniência errada e, pior, uma
            frase falsa na tela em que o CNO gravado é justamente o desta obra.
            Ver `CONSEQUENCIA_DESTA_CORRECAO`, abaixo do componente. */}
        <Consequencia cor="amb">{CONSEQUENCIA_DESTA_CORRECAO}</Consequencia>

        <Passo>O que fica registrado</Passo>
        <Card>
          {/* UMA linha, não duas (critério 10): `cno_referenciado` e
              `nota_traz_cno` são o mesmo fato, amarrado pelo check
              `documento_cno_coerente` (0015). Duas linhas mostrariam duas
              correções onde houve uma. */}
          <Linha rotulo="campo CNO impresso na nota">
            <span className="mono">(em branco) → {cnoDaObra}</span>
          </Linha>
          <Linha rotulo="motivo">
            o prestador enviou a nota com o CNO desta obra
          </Linha>
          <Linha rotulo="quando, e por quem">no ato da gravação</Linha>
          {/* ⚠️ "anos afetados" NÃO APARECE AQUI, e a ausência é o Gate Fiscal:
              §0(a) — o único campo de `documento` que move custo entre
              anos-calendário é `valor`. */}
        </Card>
        <Dica>
          Correção registrada <strong>não se apaga e não se edita</strong> — nem
          por você. A correção e o registro dela vão juntos, numa operação só:
          ou as duas coisas acontecem, ou nenhuma acontece.
        </Dica>

        {/* ⚠️ **O "Só o Mateus" do ADENDO 2026-10-22, dito em tela** (recomendação
            do `contador` no Gate 2): *"afirmar que o CNO do anexo reemitido é o
            impresso nele"*.

            ⚠️ **É uma LINHA, não um checkbox** — e a diferença é deliberada. Em
            `corrigir/retencao` a afirmação é uma caixa que TRAVA o botão, porque
            lá o Mateus digita um valor que o papel precisa confirmar. Aqui não
            há nada a digitar: o Gate Fiscal do ticket é literal em que a
            afirmação é *"ação implícita no clique de 'Gravar a correção' com o
            anexo visível na tela"*, e o critério 7 manda o botão habilitar com o
            anexo — e só com ele. Um segundo gate seria requisito novo. */}
        <Card className="border-amb">
          <div className="text-[13px]">
            Ao gravar, você afirma que o CNO{" "}
            <strong className="mono">{cnoDaObra}</strong> está impresso e legível
            no papel anexado.
          </div>
        </Card>
      </ColunaDeDetalhe>

      <RodapeDeAcao>
        <BotaoSalvar
          ocupado={gravando}
          variante="primary"
          onClick={() => void gravar(cnoDaObra)}
          disabled={!podeGravar}
        >
          {rotuloBotao}
        </BotaoSalvar>
        {/* Em modo pacote, "Cancelar" vira "Pular esta" — e pular NÃO grava nada
            nem pede confirmação, porque nada foi gravado neste passo ainda. */}
        {proxima !== null ? (
          <BotaoLink href={proxima.href}>{textoPular(proxima)}</BotaoLink>
        ) : (
          <BotaoLink href={documentoHref}>Cancelar</BotaoLink>
        )}
      </RodapeDeAcao>
    </>
  );
}
