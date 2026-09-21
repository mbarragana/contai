"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CampoArquivo, Escolha } from "@/app/_components/campos";
import { useSessao } from "@/app/_components/sessao";
import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
  Passo,
  Rodape,
} from "@/app/_components/ui";
import {
  anexarArquivoDocumento,
  carregarDocumento,
  classificarErro,
  mensagemDeErro,
  subirParaAcervo,
  type ErroDeTela,
} from "@/lib/data";
import {
  exigeRetencao,
  faltaOArquivo,
  REPERGUNTA_PORQUE,
  REPERGUNTA_TITULO,
  type RespostaCpf,
} from "@/lib/fiscal/documento";
import {
  DICA_GATE_DESTACADA,
  OPCOES_GATE,
  PERGUNTA_GATE,
} from "@/lib/fiscal/retencao";
import { formatarBRL } from "@/lib/money";
import type { Documento, RespostaRetencaoNaNota } from "@/lib/types";

/**
 * **CONTAI-033, critérios 6 e 12 — o arquivo chegou depois.** Mock s3.
 *
 * Fonte: `docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`,
 * ADENDO 1 §A.3 (Guarda 3) e §A.7.3 (o texto da repergunta).
 *
 * ⚠️ **POR QUE AS DUAS PERGUNTAS VOLTAM, E VOLTAM VAZIAS.** O check *"a nota
 * está no seu CPF?"* é pergunta sobre **o que está impresso no papel**.
 * Respondê-la sem o papel à vista é o **"flip barato"** que o parecer de 18/08
 * manda impedir, e cuja mitigação é literalmente *"anexo visível na tela,
 * afirmação explícita e rastro"*. Sem anexo não existe "anexo visível na tela".
 *
 * Logo: enquanto não havia arquivo, as respostas estavam gravadas como
 * **declaradas de memória**. Agora que há papel, o app **repergunta — e NUNCA
 * herda a resposta anterior**, mesmo que o Mateus vá responder exatamente
 * igual (decisão de design 2 do mock; critério 12, guarda-chuva de default
 * fiscal). Pré-marcar a resposta antiga seria o flip barato disfarçado, que é o
 * pre-mortem 2 do ticket.
 *
 * ⚠️ **O ato é UM SÓ, no banco** (RPC `anexar_arquivo_documento`): path + os
 * dois checks + `status` + `motivo_quarentena`. Em dois UPDATEs existe o estado
 * intermediário "tem arquivo, status velho", e é nele que a nota volta a contar
 * como hábil com afirmação de memória.
 */
export default function AnexarArquivoDoDocumento() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { pedirReautenticacao } = useSessao();

  const [documento, setDocumento] = useState<Documento | null>(null);
  const [erroCarregar, setErroCarregar] = useState<ErroDeTela | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const [arquivo, setArquivo] = useState<File | null>(null);
  // ⚠️ Os dois nascem `null` e NÃO são inicializados com o que está no banco.
  // Isto não é esquecimento nem economia: é a Guarda 3 lida ao pé da letra.
  const [notaNoCpf, setNotaNoCpf] = useState<RespostaCpf | null>(null);
  // CONTAI-038 — a repergunta devolve o GATE de duas opções, nunca o repeater:
  // esta tela é uma repergunta rápida (o arquivo acabou de chegar), não uma
  // revisão de gestão. As linhas se preenchem no detalhe, sentado.
  const [retencaoNaNota, setRetencaoNaNota] =
    useState<RespostaRetencaoNaNota | null>(null);

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

  const documentoHref = `/documento/${id}`;

  if (!documento) {
    return (
      <>
        <AppBar titulo="Anexar o arquivo" />
        <Corpo>
          {erroCarregar ? (
            <EstadoErro erro={erroCarregar} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando o documento" />
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href={documentoHref}>Voltar ao documento</BotaoLink>
        </Rodape>
      </>
    );
  }

  const d = documento;
  const sub = `${d.favorecidoNome ?? "emitente não identificado"}${
    d.valorCentavos === null ? "" : ` · ${formatarBRL(d.valorCentavos)}`
  }`;

  /**
   * ⚠️ Chegada direta por URL num documento que **já tem papel**. Pelo fluxo
   * normal não acontece (o botão só existe na pendência), mas a rota é
   * endereçável e o banco recusaria a gravação de qualquer jeito — a função
   * aceita só `arquivo_path is null`. Aqui a tela diz isso ANTES de o Mateus
   * escolher um arquivo e responder duas perguntas para nada.
   *
   * E não há "substituir": `arquivo_path` é NÃO CORRIGÍVEL (parecer de 18/08,
   * §1) — papel novo entra como anexo ADICIONAL, pelas telas de correção.
   */
  if (!faltaOArquivo(d)) {
    return (
      <>
        <AppBar titulo="Anexar o arquivo" sub={sub} />
        <Corpo>
          <Banner cor="amb" role="status">
            <strong>Este documento já tem arquivo.</strong> O papel original não
            se substitui — se chegou um documento novo (carta de correção ou
            nota substitutiva), ele entra como anexo adicional pelas correções
            do documento.
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

  const pedeRetencao = exigeRetencao(d.tipo);
  const respondeuAsDuas =
    notaNoCpf !== null && (!pedeRetencao || retencaoNaNota !== null);
  const podeGravar = arquivo !== null && respondeuAsDuas && !gravando;

  async function gravar() {
    if (arquivo === null || notaNoCpf === null) return;
    if (pedeRetencao && retencaoNaNota === null) return;
    setGravando(true);
    setErroGravar(null);
    try {
      const arquivoPath = await subirParaAcervo(arquivo, "documento");
      await anexarArquivoDocumento(
        d.id,
        arquivoPath,
        notaNoCpf === "sim",
        // O gate só existe em NF de serviço; nos outros tipos vai `null` e a
        // RPC deixa a coluna como está, em vez de gravar um "respondido".
        pedeRetencao ? retencaoNaNota : null,
      );
      router.push(documentoHref);
    } catch (erro) {
      setGravando(false);
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroGravar(mensagemDeErro(erro));
    }
  }

  return (
    <>
      <AppBar titulo="Anexar o arquivo" sub={sub} />
      <Corpo>
        {erroGravar ? (
          <Banner cor="red" role="alert">
            <strong>Não deu para anexar.</strong> {erroGravar}{" "}
            <strong>Nada foi alterado</strong> — a nota continua sem arquivo, e
            as suas respostas continuam aqui na tela.
          </Banner>
        ) : null}

        <Card>
          <Linha rotulo="Valor da nota">
            <span className="mono">
              {d.valorCentavos === null ? "—" : formatarBRL(d.valorCentavos)}
            </span>
          </Linha>
        </Card>

        <CampoArquivo
          rotulo="Arquivo da nota"
          ajuda="PDF, XML ou foto — é ele que faz esta nota valer no acervo."
          accept=".pdf,.xml,image/*"
          arquivo={arquivo}
          onChange={setArquivo}
        />

        {/* ⚠️ A repergunta só existe DEPOIS de haver papel para conferir — e é
            literalmente o argumento do §A.7.3: "as perguntas voltam porque
            agora há papel para conferir". Mostrá-las antes seria pedir mais uma
            resposta de memória, que é o que esta tela existe para não fazer. */}
        {arquivo === null ? (
          <Dica>
            Escolha o arquivo para as duas perguntas aparecerem — elas voltam
            porque agora há papel para conferir.
          </Dica>
        ) : (
          <>
            <Card className="border-amb">
              <p className="text-[13.5px] font-semibold">{REPERGUNTA_TITULO}</p>
              <p className="mt-1.5 text-[13px]">{REPERGUNTA_PORQUE}</p>
            </Card>

            <Passo>Confirme olhando a nota</Passo>
            <Card className="flex flex-col gap-3.5">
              <Escolha
                destaque
                rotulo="A nota está no seu CPF?"
                opcoes={RESPOSTAS_CPF}
                valor={notaNoCpf}
                onChange={setNotaNoCpf}
              />
              {notaNoCpf === "nao" ? (
                <Banner cor="red" role="alert">
                  Vai para <strong>quarentena</strong>: não entra no custo de
                  aquisição. Peça a nota no seu CPF.
                </Banner>
              ) : null}

              {pedeRetencao ? (
                <>
                  <Escolha
                    destaque
                    rotulo={PERGUNTA_GATE}
                    opcoes={OPCOES_GATE}
                    valor={retencaoNaNota}
                    onChange={setRetencaoNaNota}
                  />
                  {retencaoNaNota === "destacada" ? (
                    <Dica>{DICA_GATE_DESTACADA}</Dica>
                  ) : null}
                </>
              ) : null}
            </Card>
            {/* Nada nasce marcado, nem o que já estava gravado. */}
            <Dica>
              Nenhuma resposta vem pré-marcada, mesmo que você já tenha
              respondido no registro: é o papel que a fiscalização lê.
            </Dica>
          </>
        )}
      </Corpo>

      <Rodape>
        <Botao variante="primary" onClick={gravar} disabled={!podeGravar}>
          {gravando
            ? "Anexando…"
            : arquivo === null
              ? "Escolha o arquivo para continuar"
              : !respondeuAsDuas
                ? "Responda as perguntas para confirmar"
                : "Confirmar o arquivo e as respostas"}
        </Botao>
        <BotaoLink href={documentoHref}>Voltar sem gravar</BotaoLink>
      </Rodape>
    </>
  );
}

/**
 * ⚠️ As mesmas opções do formulário de registro, e o texto é IDÊNTICO de
 * propósito: a repergunta tem de ser reconhecível como a MESMA pergunta, senão
 * "respondi diferente" passa a significar "leram diferente".
 *
 * (Ficam aqui, e não num módulo comum, porque são rótulos de tela — `sim` e
 * `nao` são o contrato desta pergunta. O gate de retenção, ao contrário, LÊ as
 * opções de `lib/fiscal/retencao.ts`: lá o texto tem consequência fiscal e
 * três telas o mostram, então duas cópias divergiriam.)
 */
const RESPOSTAS_CPF = [
  { valor: "sim", texto: "Sim" },
  { valor: "nao", texto: "Não" },
] as const satisfies readonly { valor: RespostaCpf; texto: string }[];
