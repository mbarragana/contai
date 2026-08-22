"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { ListaDeAnexos } from "@/app/_components/anexo";
import { CampoArquivo, CampoTexto } from "@/app/_components/campos";
import {
  ErroEstaNaNota,
  MotivoEscolhidoResumo,
  PassoMotivo,
  type MotivoEscolhido,
  type RespostaPasso1,
} from "@/app/_components/corrigir";
import { useSessao } from "@/app/_components/sessao";
import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Consequencia,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
  Passo,
  Rodape,
} from "@/app/_components/ui";
import {
  carregarAlcanceDoFavorecido,
  carregarDocumento,
  classificarErro,
  corrigirNomeDoFavorecido,
  mensagemDeErro,
  subirParaAcervo,
  type ErroDeTela,
} from "@/lib/data";
import { formatarDocumento } from "@/lib/fiscal/identificacao";
import {
  AFIRMACAO_CNPJ_SEGUNDA_LINHA,
  afirmacaoDoCnpj,
  avisoNomeEmAnoAnterior,
  AVISO_NOME_FICA_NO_HISTORICO,
} from "@/lib/fiscal/revisao";
import { hojeIso } from "@/lib/hoje";
import type { Documento } from "@/lib/types";

type Alcance = {
  documentos: number;
  pagamentosPorAno: { ano: number; quantidade: number }[];
};

type Fase =
  | { nome: "passo1" }
  | { nome: "erro_do_papel" }
  | { nome: "campo"; motivo: MotivoEscolhido; motivoTexto: string | null }
  | { nome: "gravado"; nome_novo: string };

/**
 * Tela s5 do mock v2 — **corrigir o nome do emitente**, critério 6.
 *
 * É o **único lugar do app onde um nome de favorecido muda**. Desde o commit
 * `b807901` nenhum outro fluxo renomeia — nem registrar pagamento, nem
 * registrar nota (`garantirFavorecido` usa `ignoreDuplicates` de propósito).
 * Adendo de 2026-08-18, §3: "nome de favorecido muda por ato deliberado, com
 * rastro — nunca como efeito colateral".
 *
 * ⚠️ **O CNPJ/CPF não tem campo aqui**, e não é atrito inventado: a string de
 * um favorecido existente nunca é reescrita (parecer §1). O que é corrigível é
 * o PONTEIRO `documento.favorecido_id`, e ele é a rodada 2.
 *
 * ⚠️ **A afirmação do CNPJ é obrigatória** (adendo §3, que estende o §4.3):
 * renomear "WK" para o nome da empresa certa mantendo o CNPJ errado faz o
 * registro mentir duas vezes, com aparência de certo — e nenhuma tela teria
 * pedido nada. Esta afirmação é o único instante em que o CNPJ gravado é lido
 * lado a lado com o papel.
 */
function CorrigirEmitente() {
  const { id } = useParams<{ id: string }>();
  const { pedirReautenticacao } = useSessao();

  /**
   * Critério 2 / 17: quem chega por "Corrigir na nota" volta para o formulário
   * de pagamento com o nome novo. `useSearchParams` e não `window.location`:
   * em navegação client-side o `location` do primeiro render ainda não tem a
   * query.
   */
  const voltarPara = useSearchParams().get("voltar");

  const [documento, setDocumento] = useState<Documento | null>(null);
  const [alcance, setAlcance] = useState<Alcance | null>(null);
  const [erroCarregar, setErroCarregar] = useState<ErroDeTela | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [fase, setFase] = useState<Fase>({ nome: "passo1" });
  const [nome, setNome] = useState("");
  const [anexo, setAnexo] = useState<File | null>(null);
  const [afirmou, setAfirmou] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erroGravar, setErroGravar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const doc = await carregarDocumento(id);
        const onde = doc.favorecidoId
          ? await carregarAlcanceDoFavorecido(doc.favorecidoId)
          : { documentos: 0, pagamentosPorAno: [] };
        if (cancelado) return;
        setDocumento(doc);
        setAlcance(onde);
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

  async function gravar() {
    if (!documento?.favorecidoId || fase.nome !== "campo") return;
    setGravando(true);
    setErroGravar(null);
    try {
      // Mesma ordem das outras duas telas: o arquivo precisa existir no acervo
      // para a função Postgres o registrar no MESMO ato. Falha no upload =
      // nada gravado, e a tela diz isso.
      const anexoPath = anexo ? await subirParaAcervo(anexo, "documento") : null;
      await corrigirNomeDoFavorecido({
        favorecidoId: documento.favorecidoId,
        documentoId: documento.id,
        nome: nome.trim(),
        motivo: fase.motivo,
        motivoTexto: fase.motivoTexto,
        anexoPath,
      });
      setFase({ nome: "gravado", nome_novo: nome.trim() });
    } catch (erro) {
      setGravando(false);
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroGravar(mensagemDeErro(erro));
    }
  }

  const documentoHref = `/documento/${id}`;
  const voltaHref =
    voltarPara === "pagamento"
      ? `/adicionar/pagamento?documento=${id}`
      : documentoHref;

  if (!documento || !alcance) {
    return (
      <>
        <AppBar titulo="Corrigir o nome do emitente" />
        <Corpo>
          {erroCarregar ? (
            <EstadoErro erro={erroCarregar} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando o emitente" />
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href={documentoHref}>Voltar ao documento</BotaoLink>
        </Rodape>
      </>
    );
  }

  const cnpj = documento.favorecidoDocumento
    ? formatarDocumento(documento.favorecidoDocumento)
    : null;
  const sub = documento.favorecidoNome ?? "emitente não identificado";
  const anoCorrente = Number(hojeIso().slice(0, 4));
  const anoAnterior = alcance.pagamentosPorAno.find((p) => p.ano < anoCorrente);

  // ── Gravado ────────────────────────────────────────────────────────────
  if (fase.nome === "gravado") {
    return (
      <>
        <AppBar titulo="Nome corrigido ✓" sub={fase.nome_novo} />
        <Corpo>
          <Banner cor="grn" role="status">
            <strong>Corrigido.</strong> O emitente agora se chama{" "}
            <strong>{fase.nome_novo}</strong> — em todos os registros dele.
          </Banner>
          <Card>
            <Linha rotulo="Nenhum valor mudou">
              <span className="mono">—</span>
            </Linha>
            <Dica>
              Nome não é dinheiro: custo, anos e vínculos ficaram exatamente como
              estavam. O que muda é o que sai escrito na ficha Pagamentos
              Efetuados.
            </Dica>
          </Card>
        </Corpo>
        <Rodape>
          <BotaoLink href={voltaHref} variante="primary">
            {voltarPara === "pagamento"
              ? "Voltar ao pagamento — com o nome novo"
              : "Voltar ao documento"}
          </BotaoLink>
        </Rodape>
      </>
    );
  }

  // ── Emitente não identificado: não há nome a corrigir ──────────────────
  if (!documento.favorecidoId) {
    return (
      <>
        <AppBar titulo="Corrigir o nome do emitente" sub={sub} />
        <Corpo>
          <Banner cor="amb" role="status">
            <strong>Esta nota está sem emitente identificado.</strong> Não há
            nome a corrigir: o nome pertence ao favorecido, e este registro não
            aponta para nenhum.
          </Banner>
        </Corpo>
        <Rodape>
          <BotaoLink href={documentoHref} variante="primary">
            Voltar ao documento
          </BotaoLink>
        </Rodape>
      </>
    );
  }

  /**
   * Critério 2: "nome como está impresso na nota" só se confere com a nota
   * aberta. A tela pedia a transcrição e escondia o papel.
   */
  const blocoAnexo = (
    <Card>
      <ListaDeAnexos
        titulo="Papel anexado"
        itens={[{ path: documento.arquivoPath }]}
      />
    </Card>
  );

  // ── Passo 1 e a saída "o erro é do papel" ──────────────────────────────
  if (fase.nome === "passo1" || fase.nome === "erro_do_papel") {
    return (
      <>
        <AppBar
          titulo="Corrigir o nome do emitente"
          sub={fase.nome === "passo1" ? `${sub} · passo 1 de 3` : sub}
        />
        <Corpo>
          <Card>
            <Linha rotulo="Nome gravado hoje">{sub}</Linha>
            <Linha rotulo="CNPJ / CPF">
              <span className="mono">{cnpj ?? "—"}</span>
            </Linha>
          </Card>
          {blocoAnexo}
          {fase.nome === "passo1" ? (
            <PassoMotivo
              documentoHref={documentoHref}
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
        </Corpo>
      </>
    );
  }

  const igual = nome.trim() === (documento.favorecidoNome ?? "");
  const vazio = nome.trim() === "";
  /**
   * ⚠️ Bloqueante 2 do Gate 2: o passo 1 PROMETE *"no próximo passo o documento
   * novo é anexado — sem ele, esta correção não grava"*, e esta tela não pedia
   * nada. Promessa quebrada por um botão é o defeito que este ticket existe
   * para consertar. A guarda de verdade está na função Postgres; aqui ela
   * aparece antes, com o motivo no rótulo.
   */
  const faltaAnexo = fase.motivo === "emitente_corrigiu_a_nota" && anexo === null;
  const podeGravar = !vazio && !igual && afirmou && !faltaAnexo && !gravando;

  return (
    <>
      <AppBar titulo="Corrigir o nome do emitente" sub={`${sub} · passos 2 e 3 de 3`} />
      <Corpo>
        {erroGravar ? (
          <Banner cor="red" role="alert">
            <strong>Não deu para gravar.</strong> {erroGravar}{" "}
            <strong>Nada foi alterado</strong> — o nome continua {sub} e nenhum
            registro de correção foi criado.
          </Banner>
        ) : null}

        <MotivoEscolhidoResumo
          motivo={fase.motivo}
          texto={fase.motivoTexto}
          onTrocar={() => setFase({ nome: "passo1" })}
        />

        {fase.motivo === "emitente_corrigiu_a_nota" ? (
          <>
            <CampoArquivo
              rotulo="Carta de correção ou nota substitutiva"
              ajuda="PDF, XML ou foto. Sem ele, esta correção não grava."
              accept="application/pdf,image/*,text/xml,application/xml"
              arquivo={anexo}
              onChange={setAnexo}
              erro={faltaAnexo ? "O documento novo é obrigatório." : undefined}
            />
            <Consequencia cor="amb">
              Este anexo <strong>não substitui</strong> a nota antiga — ele se
              soma a ela. A nota original continua no acervo, com o arquivo
              dela. O acervo só cresce.
            </Consequencia>
          </>
        ) : null}

        {/* ⚠️ SEM CAMPO. O CNPJ é a identidade do favorecido; é por ele que a
            Receita cruza tudo, e o nome só acompanha. */}
        <Card>
          <Linha rotulo="CNPJ / CPF deste favorecido — não muda aqui">
            <span className="mono">{cnpj ?? "—"}</span>
          </Linha>
          <div className="mt-2">
            <BotaoLink href={`/documento/${id}/cnpj-errado`}>
              O CNPJ é que está errado
            </BotaoLink>
          </div>
        </Card>

        <Card>
          <Linha rotulo="Nome gravado hoje">{sub}</Linha>
        </Card>
        {blocoAnexo}

        <CampoTexto
          rotulo="Nome como está impresso na nota"
          valor={nome}
          onChange={setNome}
          erro={
            igual
              ? "Igual ao que já está gravado — não há o que corrigir."
              : undefined
          }
        />

        {/* ── A afirmação, obrigatória (adendo §3) ───────────────────────── */}
        <Card className={afirmou ? "border-grn" : "border-amb"}>
          <label className="flex min-h-[44px] cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={afirmou}
              onChange={(e) => setAfirmou(e.target.checked)}
              className="mt-1 h-5 w-5 flex-none"
            />
            <span className="text-[13px]">
              {cnpj
                ? afirmacaoDoCnpj(cnpj)
                : "O CNPJ impresso na nota é o que está gravado — só o nome está diferente."}
            </span>
          </label>
          <Consequencia cor="amb">
            <strong>{AFIRMACAO_CNPJ_SEGUNDA_LINHA}</strong>{" "}
            <a className="underline" href={`/documento/${id}/cnpj-errado`}>
              O CNPJ/CPF do emitente está errado
            </a>
          </Consequencia>
        </Card>

        {/* ── Alcance (mock s5) ──────────────────────────────────────────── */}
        <Passo>Onde este nome aparece hoje</Passo>
        <Card>
          <Linha rotulo="Documentos">
            {alcance.documentos}{" "}
            {alcance.documentos === 1 ? "documento" : "documentos"}
          </Linha>
          <Linha rotulo="Pagamentos">
            {alcance.pagamentosPorAno.reduce((s, p) => s + p.quantidade, 0)}
            {alcance.pagamentosPorAno.length > 0
              ? ` — ${alcance.pagamentosPorAno
                  .map((p) => `${p.quantidade} de ${p.ano}`)
                  .join(", ")}`
              : ""}
          </Linha>
          <Dica>
            O nome muda em <strong>todos eles de uma vez</strong>. Não existe
            &quot;nome de antes&quot; e &quot;nome de agora&quot;: o favorecido é
            um só, e o CNPJ é que o identifica.
          </Dica>
          {/* Os documentos não são quebrados por ano: `documento` não tem data
              de emissão no schema (é o CONTAI-004). Usar `created_at` como ano
              do documento seria afirmar um fato fiscal que o app não tem. */}
        </Card>

        {anoAnterior ? (
          <>
            <Consequencia cor="amb">
              {avisoNomeEmAnoAnterior(anoAnterior.ano)}
            </Consequencia>
            <Dica>{AVISO_NOME_FICA_NO_HISTORICO}</Dica>
            <Dica>
              <strong>Isto não abre pendência na sua lista.</strong> O custo não
              muda um centavo, e pendência persistente só nasce quando a correção
              muda um número declarado. Aqui muda identificação: registro e
              aviso, e acabou.
            </Dica>
          </>
        ) : null}
      </Corpo>

      <Rodape>
        <Botao variante="primary" onClick={gravar} disabled={!podeGravar}>
          {gravando
            ? "Gravando…"
            : vazio
              ? "Digite o nome do papel para continuar"
              : igual
                ? "Nada a corrigir"
                : faltaAnexo
                  ? "Anexe o documento novo para gravar"
                  : !afirmou
                    ? "Confirme a afirmação para gravar"
                    : "Gravar a correção"}
        </Botao>
        <BotaoLink href={voltaHref}>Cancelar</BotaoLink>
      </Rodape>
    </>
  );
}

/** A fronteira que `useSearchParams` exige (Next 16). */
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando rotulo="Carregando o emitente" />}>
      <CorrigirEmitente />
    </Suspense>
  );
}
