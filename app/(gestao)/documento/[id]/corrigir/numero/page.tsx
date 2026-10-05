"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  ListaDeAnexos,
  papelOriginal,
  SEM_PAPEL_NO_ACERVO,
} from "@/app/_components/anexo";
import { CampoArquivo, CampoTexto } from "@/app/_components/campos";
import { CamposCurtos } from "@/app/_components/captura";
import {
  ErroEstaNaNota,
  MotivoEscolhidoResumo,
  PassoMotivo,
  ROTULO_MOTIVO_NO_RASTRO,
  type MotivoEscolhido,
  type RespostaPasso1,
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
  buscarNotasComNumero,
  carregarDocumento,
  classificarErro,
  corrigirNumeroDoDocumento,
  mensagemDeErroDeGravacao,
  subirParaAcervo,
  type ErroDeTela,
} from "@/lib/data";
import {
  duplicataDe,
  numeroParaBanco,
  serieParaBanco,
  type DocumentoRegistrado,
} from "@/lib/fiscal/documento";
import { formatarDataBR } from "@/lib/fiscal/obra";
import type { Documento } from "@/lib/types";

type Fase =
  | { nome: "passo1" }
  | { nome: "erro_do_papel" }
  | { nome: "campo"; motivo: MotivoEscolhido; motivoTexto: string | null }
  | { nome: "gravado"; numero: string; serie: string | null; serieMudou: boolean };

/**
 * ⚠️ **TEXTO DE CONSEQUÊNCIA FISCAL, FECHADO NO GATE FISCAL do CONTAI-085** —
 * copiado verbatim, não reescrito. Raiz normativa:
 * `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md` §1, linha
 * `arquivo_path` ("NÃO CORRIGÍVEL… anexa-se adicional").
 */
function ArquivoNaoMuda() {
  // Palavra por palavra do Gate Fiscal. O único desvio é de MARCAÇÃO: as crases
  // em volta do identificador viram `<code>`, porque crase renderizada como
  // crase é markdown vazado na tela — não é reescrita do texto.
  return (
    <>
      <code className="mono">documento.arquivo_path</code> não muda. A nota nova
      entra como anexo adicional do documento — o arquivo original continua lá.
      O dossiê lista os dois arquivos.
    </>
  );
}

/**
 * **CONTAI-085 — corrigir o NÚMERO/SÉRIE de um documento já registrado**
 * (dívida D89). Caso real: a NFS-e nº 261, já registrada, foi CANCELADA pela
 * prestadora e substituída pela nº 263 — mesmo valor, número diferente. Sem esta
 * tela o acervo continuava apontando para um papel cancelado como se fosse o
 * vigente, que é dano direto à meta 3 (acervo correto no prazo de decadência).
 *
 * O campo já estava pré-aprovado pelo parecer §1 ("CORRIGÍVEL COM CONDIÇÃO…
 * como transcrição, texto literal, zeros à esquerda preservados"); o que não
 * existia era caminho — `numero`/`serie` só nasceram no CONTAI-004, semanas
 * depois de o CONTAI-021 construir as três telas irmãs.
 *
 * ⚠️ **NÃO EXISTE AQUI o bloco "O que isso muda no seu custo"** das telas de
 * `valor`, e a ausência é regra, não economia de código: §0(a) do parecer é
 * literal em que o ÚNICO campo de `documento` que move custo entre
 * anos-calendário é `valor`. Número nunca entrou na conta
 * `C = min(Σ pagamentos, Σ documentos)`. Por isso `anosAfetadosDeUmaObra`,
 * `alocarCusto` e `carregarPainel` não são importados — o bloco foi CORTADO, não
 * escondido (pre-mortem 3 do ticket: dead code copiado de `corrigir/valor`).
 */
export default function CorrigirNumero() {
  const { id } = useParams<{ id: string }>();
  const { pedirReautenticacao } = useSessao();
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [erroCarregar, setErroCarregar] = useState<ErroDeTela | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [fase, setFase] = useState<Fase>({ nome: "passo1" });
  const [numero, setNumero] = useState("");
  const [serie, setSerie] = useState("");
  const [anexo, setAnexo] = useState<File | null>(null);
  const [gravando, setGravando] = useState(false);
  const [erroGravar, setErroGravar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const d = await carregarDocumento(id);
        if (!cancelado) setDocumento(d);
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
    setDocumento(null);
    setErroGravar(null);
    setTentativa((t) => t + 1);
  }, []);

  /**
   * ⚠️ Os dois saem de `numeroParaBanco`/`serieParaBanco`, as MESMAS funções da
   * captura, e elas só tiram o espaço em volta (R2/R6 do CONTAI-004). Nada de
   * `Number()`, `parseInt`, corte de zero à esquerda ou `toUpperCase`: `"0263"`
   * e `"263"` são notas DIFERENTES, e normalizar destrói a identificação —
   * parecer §1 e pre-mortem 1 deste ticket.
   */
  const numeroLimpo = numeroParaBanco(numero);
  const serieLimpa = serieParaBanco(serie);

  const obraId = documento?.obraId ?? null;
  const emitente = documento?.favorecidoDocumento ?? null;

  /**
   * Duplicidade (critério 5 / Gate Fiscal §7) — **aviso, nunca bloqueio**. Só o
   * Mateus decide qual duplicata é a boa.
   *
   * ⚠️ A resposta viaja COM a pergunta que a produziu, como na captura: mudou o
   * número ou a série, o aviso some no mesmo render. Aviso apontando para o
   * número anterior seria pior do que aviso nenhum.
   */
  const chaveDaBusca = `${obraId ?? ""}|${numeroLimpo ?? ""}|${serieLimpa ?? ""}`;
  const [achado, setAchado] = useState<{
    chave: string;
    documento: DocumentoRegistrado | null;
  } | null>(null);
  const duplicata = achado?.chave === chaveDaBusca ? achado.documento : null;

  useEffect(() => {
    if (!obraId || !numeroLimpo || !emitente) return;
    let cancelado = false;
    const chave = `${obraId}|${numeroLimpo}|${serieLimpa ?? ""}`;
    // Meio segundo depois da última tecla, igual à captura: o número da nota é
    // digitado dígito a dígito, e uma consulta por dígito é ruído.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const registradas = await buscarNotasComNumero(obraId, numeroLimpo);
          if (cancelado) return;
          setAchado({
            chave,
            documento: duplicataDe(
              { numero: numeroLimpo, serie, emitenteDocumento: emitente },
              // ⚠️ **O PRÓPRIO DOCUMENTO SAI DA LISTA** — pre-mortem 2 do
              // ticket. Sem este filtro, corrigir a série (mantendo o número)
              // acusaria o registro em edição como duplicata de si mesmo, e
              // todo "gravar" nasceria com um falso-positivo.
              registradas.filter((r) => r.id !== id),
            ),
          });
        } catch {
          // Sem aviso é o estado seguro: a correção segue. Duplicidade nunca
          // bloqueia, então falha de rede aqui não pode travar a gravação.
        }
      })();
    }, 500);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [obraId, emitente, numeroLimpo, serieLimpa, serie, id]);

  async function gravar() {
    if (!documento || fase.nome !== "campo" || numeroLimpo === null) return;
    setGravando(true);
    setErroGravar(null);
    try {
      // O upload vem ANTES da gravação, e é o único jeito: o `arquivo_path`
      // precisa existir no acervo para a função Postgres o registrar no mesmo
      // ato. Falha no upload = nada foi gravado, e a tela diz isso.
      const anexoPath = anexo ? await subirParaAcervo(anexo, "documento") : null;
      await corrigirNumeroDoDocumento({
        documentoId: documento.id,
        numero: numeroLimpo,
        serie: serieLimpa,
        motivo: fase.motivo,
        motivoTexto: fase.motivoTexto,
        anexoPath,
      });
      setFase({
        nome: "gravado",
        numero: numeroLimpo,
        serie: serieLimpa,
        serieMudou: serieLimpa !== documento.serie,
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
          "no detalhe da nota, se o número já aparece corrigido",
        ),
      );
    }
  }

  const documentoHref = `/documento/${id}`;

  // ── Carregando / erro ──────────────────────────────────────────────────
  if (!documento) {
    return (
      <>
        <CabecalhoDaTela titulo="Corrigir o número/série" />
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
  /**
   * ⚠️ `null` em `numero` é estado REAL (registro anterior ao CONTAI-004, e
   * boleto, que nunca é perguntado) e sai como "(em branco)" — nunca como zero
   * nem como string vazia. A série aparece só quando existe: "sem série" é o
   * comum da NFS-e municipal, e escrever "série —" sugeriria um dado faltando.
   */
  const numeroHoje = d.numero ?? "(em branco)";
  const identificacaoHoje = `Nº ${numeroHoje}${d.serie ? ` · série ${d.serie}` : ""}`;

  // ── Gravado ────────────────────────────────────────────────────────────
  if (fase.nome === "gravado") {
    return (
      <>
        <CabecalhoDaTela titulo="Número corrigido ✓" sub={sub} />
        <ColunaDeDetalhe>
          <Banner cor="grn" role="status">
            <strong>Corrigido.</strong> O número desta nota agora é{" "}
            <strong>{fase.numero}</strong>
            {fase.serieMudou
              ? fase.serie === null
                ? ", sem série"
                : `, série ${fase.serie}`
              : null}
            , e a correção ficou registrada no histórico do documento.
          </Banner>
          {/* Sem cards de "custo confirmado por ano": número não move custo
              (parecer §0(a)). Não é bloco oculto — ele não existe nesta tela. */}
          <Card>
            <Dica>
              <ArquivoNaoMuda />
            </Dica>
          </Card>
          <BotaoLink href={documentoHref}>Ver o documento</BotaoLink>
        </ColunaDeDetalhe>
      </>
    );
  }

  // ── Passo 1 e a saída "o erro é do papel" ──────────────────────────────
  if (fase.nome === "passo1" || fase.nome === "erro_do_papel") {
    return (
      <>
        <CabecalhoDaTela
          titulo="Corrigir o número/série"
          sub={fase.nome === "passo1" ? `${sub} · passo 1 de 2` : sub}
        />
        <ColunaDeDetalhe>
          <Card>
            <Linha rotulo="Número gravado hoje">
              <span className="mono">{identificacaoHoje}</span>
            </Linha>
          </Card>
          <Card>
            <ListaDeAnexos
              titulo="Papel anexado"
              itens={papelOriginal(d.arquivoPath)}
              vazio={SEM_PAPEL_NO_ACERVO}
            />
          </Card>
          {fase.nome === "passo1" ? (
            <PassoMotivo
              documentoHref={documentoHref}
              /* DOIS passos, e não três: o passo 3 de `corrigir/valor` ("o que
                 isso muda no seu custo") foi cortado — número não move custo. */
              de={2}
              onEscolher={(resposta: RespostaPasso1, motivoTexto) =>
                setFase(
                  resposta === "erro_do_papel"
                    ? { nome: "erro_do_papel" }
                    : { nome: "campo", motivo: resposta, motivoTexto },
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

  // ── Passo 2: o campo ───────────────────────────────────────────────────
  //
  // ⚠️ Comparação TEXTUAL LITERAL contra o gravado, nos dois campos (critérios
  // 3 e 4). `"0263"` digitado contra `"263"` gravado é uma correção REAL, e é
  // isso que estas duas igualdades de string dizem.
  const igual = numeroLimpo === d.numero && serieLimpa === d.serie;
  const faltaAnexo = fase.motivo === "emitente_corrigiu_a_nota" && anexo === null;
  const podeGravar = numeroLimpo !== null && !igual && !faltaAnexo && !gravando;

  const rotuloBotao = gravando
    ? "Gravando…"
    : numeroLimpo === null
      ? "Digite o número da nota para continuar"
      : igual
        ? "Nada a corrigir"
        : faltaAnexo
          ? "Anexe o documento novo para gravar"
          : "Gravar a correção";

  /**
   * ⚠️ **Cada linha do "o que fica registrado" só aparece se o campo DE FATO
   * mudou** — ressalva não-bloqueante do Gate 2. A versão anterior mostrava
   * sempre a linha do número, de modo que corrigir só a série anunciava
   * *"campo numero: 261 → 261"*: a tela prometia uma linha de rastro que o banco
   * (corretamente) não grava, porque `revisao_antes_difere_depois` recusa e
   * porque a RPC só insere o campo com `is distinct from`. Tela que anuncia
   * registro inexistente é o mesmo defeito de divergência app↔acervo que estas
   * telas existem para consertar, com outro sinal.
   */
  const numeroMudou = numeroLimpo !== d.numero;
  const serieMudou = serieLimpa !== d.serie;

  return (
    <>
      <CabecalhoDaTela
        titulo="Corrigir o número/série"
        sub={`${sub} · passo 2 de 2`}
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
                <strong>Nada foi alterado</strong> — o número continua{" "}
                {numeroHoje} e nenhum registro de correção foi criado.
              </>
            }
          />
        ) : null}

        <MotivoEscolhidoResumo
          motivo={fase.motivo}
          texto={fase.motivoTexto}
          onTrocar={() => setFase({ nome: "passo1" })}
        />

        <Card>
          <ListaDeAnexos
            titulo="Papel anexado — confira antes de digitar"
            itens={papelOriginal(d.arquivoPath)}
            vazio={SEM_PAPEL_NO_ACERVO}
          />
          <Dica>
            O anexo <strong>não se substitui</strong>; se precisar, anexa-se um
            adicional.
          </Dica>
        </Card>

        {fase.motivo === "emitente_corrigiu_a_nota" ? (
          <>
            <Passo>Documento novo do emitente</Passo>
            <CampoArquivo
              campo="anexo"
              rotulo="Carta de correção ou nota substitutiva"
              ajuda="PDF, XML ou foto. Sem ele, esta correção não grava."
              accept="application/pdf,image/*,text/xml,application/xml"
              arquivo={anexo}
              onChange={setAnexo}
              erro={faltaAnexo ? "O documento novo é obrigatório." : undefined}
            />
            {/* Verbatim do Gate Fiscal deste ticket — não reescrever. */}
            <Consequencia cor="amb">
              <ArquivoNaoMuda />
            </Consequencia>
          </>
        ) : null}

        <Card>
          <Linha rotulo="Número gravado hoje">
            <span className="mono">{identificacaoHoje}</span>
          </Linha>
        </Card>

        <CamposCurtos>
          <CampoTexto
            campo="numero"
            rotulo="Número que está no papel"
            valor={numero}
            onChange={setNumero}
            placeholder="263"
            erro={
              igual
                ? "Igual ao que já está gravado — não há o que corrigir. Gravar assim criaria um registro de uma correção que não aconteceu."
                : undefined
            }
          />
          <CampoTexto
            campo="serie"
            rotulo="Série (deixe em branco se a nota não tem)"
            valor={serie}
            onChange={setSerie}
            ajuda="Campo próprio, nunca junto do número. NFS-e municipal costuma não ter série."
          />
        </CamposCurtos>

        {/* ── Duplicidade: aviso, NUNCA bloqueio (Gate Fiscal §7) ──────────
            Texto literal do que já está em produção na captura
            (`app/(captura)/adicionar/documento/page.tsx`), reuso e não nova
            redação. O botão continua habilitado: só o Mateus decide qual
            duplicata é a boa. */}
        {duplicata ? (
          <Banner cor="amb" role="status">
            Essa nota já foi registrada em{" "}
            {formatarDataBR(duplicata.registradoEm)}. Confira antes de salvar — a
            mesma nota registrada duas vezes conta o custo em dobro na
            declaração.{" "}
            <a
              className="font-semibold underline"
              href={`/documento/${duplicata.id}`}
            >
              Ver registro existente
            </a>
          </Banner>
        ) : null}

        <Passo>O que fica registrado</Passo>
        <Card>
          {/* Uma linha por campo QUE MUDOU, nos dois sentidos. "numero: 261 →
              261" ou "serie: 1 → 1" seria o registro de uma correção que não
              aconteceu — e o banco a recusa
              (`revisao_antes_difere_depois`, migration 0009). */}
          {numeroMudou ? (
            <Linha rotulo="campo numero">
              <span className="mono">
                {d.numero ?? "(em branco)"} → {numeroLimpo ?? "—"}
              </span>
            </Linha>
          ) : null}
          {serieMudou ? (
            <Linha rotulo="campo serie">
              <span className="mono">
                {d.serie ?? "(em branco)"} → {serieLimpa ?? "(em branco)"}
              </span>
            </Linha>
          ) : null}
          <Linha rotulo="motivo">
            {fase.motivoTexto ?? ROTULO_MOTIVO_NO_RASTRO[fase.motivo]}
          </Linha>
          <Linha rotulo="quando, e por quem">no ato da gravação</Linha>
          {/* ⚠️ "anos afetados" NÃO APARECE AQUI, e a ausência é o Gate Fiscal:
              §0(a) — o único campo de `documento` que move custo entre
              anos-calendário é `valor`. Escrever "nenhum" convidaria a pergunta
              "em que caso seria algum?", que não existe. */}
        </Card>
        <Dica>
          Correção registrada <strong>não se apaga e não se edita</strong> — nem
          por você. A correção e o registro dela vão juntos, numa operação só:
          ou as duas coisas acontecem, ou nenhuma acontece.
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
        <BotaoLink href={documentoHref}>Cancelar</BotaoLink>
      </RodapeDeAcao>
    </>
  );
}
