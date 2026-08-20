"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CampoArquivo } from "@/app/_components/campos";
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
  carregarDocumento,
  carregarPainel,
  classificarErro,
  corrigirClassificacaoDoDocumento,
  mensagemDeErro,
  subirParaAcervo,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import {
  composicaoDaDiscriminacao,
  RODAPE_MARCENARIA,
} from "@/lib/fiscal/revisao";
import { alocarCusto } from "@/lib/fiscal/vinculo";
import { formatarBRL } from "@/lib/money";
import type { Classificacao, Documento } from "@/lib/types";

type Fase =
  | { nome: "passo1" }
  | { nome: "erro_do_papel" }
  | { nome: "campo"; motivo: MotivoEscolhido; motivoTexto: string | null }
  | { nome: "gravado"; classificacao: Classificacao };

const ROTULO: Record<Classificacao, string> = {
  material: "Material",
  mao_obra: "Mão de obra",
};

const DETALHE: Record<Classificacao, string> = {
  material:
    "Cimento, tijolo, esquadria, revestimento — coisa comprada e incorporada ao imóvel.",
  mao_obra: "Serviço executado na obra — empreitada, instalação, acabamento.",
};

/**
 * Tela s4 do mock v2 — **corrigir a classificação**, critério 5.
 *
 * Parecer §1: "CORRIGÍVEL sempre, sem trava. Não muda total nenhum; muda a
 * COMPOSIÇÃO (material × mão de obra) da discriminação." Por isso esta é a
 * única das três que **não abre pendência em hipótese nenhuma**: pendência
 * persistente só nasce quando a correção muda um NÚMERO declarado, e aqui o
 * número é o mesmo — o que muda é o texto que vai na descrição do imóvel.
 */
export default function CorrigirClassificacao() {
  const { id } = useParams<{ id: string }>();
  const { pedirReautenticacao } = useSessao();
  const [carregado, setCarregado] = useState<{
    documento: Documento;
    painel: PainelDados;
  } | null>(null);
  const [erroCarregar, setErroCarregar] = useState<ErroDeTela | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [fase, setFase] = useState<Fase>({ nome: "passo1" });
  const [escolha, setEscolha] = useState<Classificacao | null>(null);
  const [anexo, setAnexo] = useState<File | null>(null);
  const [gravando, setGravando] = useState(false);
  const [erroGravar, setErroGravar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const documento = await carregarDocumento(id);
        const painel = await carregarPainel(documento.obraId);
        if (!cancelado) setCarregado({ documento, painel });
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

  const conta = useMemo(() => {
    if (!carregado || escolha === null) return null;
    const { documento, painel } = carregado;
    if (escolha === documento.classificacao) return null;
    const depois = {
      documentos: painel.documentos.map((d) =>
        d.id === documento.id ? { ...d, classificacao: escolha } : d,
      ),
      pagamentos: painel.pagamentos,
    };
    return {
      antes: composicaoDaDiscriminacao(alocarCusto(painel)),
      depois: composicaoDaDiscriminacao(alocarCusto(depois)),
    };
  }, [carregado, escolha]);

  async function gravar() {
    if (!carregado || fase.nome !== "campo" || escolha === null) return;
    setGravando(true);
    setErroGravar(null);
    try {
      const anexoPath = anexo ? await subirParaAcervo(anexo, "documento") : null;
      await corrigirClassificacaoDoDocumento({
        documentoId: carregado.documento.id,
        classificacao: escolha,
        motivo: fase.motivo,
        motivoTexto: fase.motivoTexto,
        anexoPath,
      });
      setFase({ nome: "gravado", classificacao: escolha });
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

  if (!carregado) {
    return (
      <>
        <AppBar titulo="Corrigir a classificação" />
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

  const d = carregado.documento;
  const sub = d.favorecidoNome ?? "emitente não identificado";

  if (fase.nome === "gravado") {
    return (
      <>
        <AppBar titulo="Classificação corrigida ✓" sub={sub} />
        <Corpo>
          <Banner cor="grn" role="status">
            <strong>Corrigido.</strong> Esta nota agora conta como{" "}
            <strong>{ROTULO[fase.classificacao].toLowerCase()}</strong>.{" "}
            <strong>O total do seu custo não mudou.</strong>
          </Banner>
          <Dica>
            O que mudou foi a composição do texto que vai na descrição do
            imóvel: quanto foi material e quanto foi mão de obra.
          </Dica>
        </Corpo>
        <Rodape>
          <BotaoLink href={documentoHref} variante="primary">
            Voltar ao documento
          </BotaoLink>
        </Rodape>
      </>
    );
  }

  if (fase.nome === "passo1" || fase.nome === "erro_do_papel") {
    return (
      <>
        <AppBar
          titulo="Corrigir a classificação"
          sub={fase.nome === "passo1" ? `${sub} · passo 1 de 3` : sub}
        />
        <Corpo>
          <Card>
            <Linha rotulo="Classificação hoje">
              {d.classificacao ? ROTULO[d.classificacao] : "—"}
            </Linha>
          </Card>
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

  const faltaAnexo = fase.motivo === "emitente_corrigiu_a_nota" && anexo === null;
  const igual = escolha !== null && escolha === d.classificacao;
  const podeGravar = escolha !== null && !igual && !faltaAnexo && !gravando;

  return (
    <>
      <AppBar titulo="Corrigir a classificação" sub={`${sub} · passos 2 e 3 de 3`} />
      <Corpo>
        {erroGravar ? (
          <Banner cor="red" role="alert">
            <strong>Não deu para gravar.</strong> {erroGravar}{" "}
            <strong>Nada foi alterado</strong> — a classificação continua como
            estava e nenhum registro de correção foi criado.
          </Banner>
        ) : null}

        <MotivoEscolhidoResumo
          motivo={fase.motivo}
          texto={fase.motivoTexto}
          onTrocar={() => setFase({ nome: "passo1" })}
        />

        {fase.motivo === "emitente_corrigiu_a_nota" ? (
          <CampoArquivo
            rotulo="Carta de correção ou nota substitutiva"
            ajuda="PDF, XML ou foto. Sem ele, esta correção não grava."
            accept="application/pdf,image/*,text/xml,application/xml"
            arquivo={anexo}
            onChange={setAnexo}
            erro={faltaAnexo ? "O documento novo é obrigatório." : undefined}
          />
        ) : null}

        <Card>
          <Linha rotulo="Classificação hoje">
            {d.classificacao ? ROTULO[d.classificacao] : "—"}
          </Linha>
        </Card>

        <Passo>O que esta nota é</Passo>
        {(["material", "mao_obra"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setEscolha(c)}
            aria-pressed={escolha === c}
            className={`min-h-[44px] rounded-[10px] border px-[14px] py-3 text-left ${
              escolha === c ? "border-ink bg-ink text-paper" : "border-line bg-white"
            }`}
          >
            <div className="font-semibold">{ROTULO[c]}</div>
            <div className="mt-0.5 text-[12px] opacity-80">{DETALHE[c]}</div>
          </button>
        ))}
        {/* Nem a classificação ATUAL nasce marcada: campo que decide
            consequência fiscal não tem resposta padrão. */}
        <Dica>Nada nasce marcado, nem a classificação atual.</Dica>

        <Passo>O que isso muda</Passo>
        {!conta ? (
          <Dica>
            {igual
              ? "É a classificação que já está gravada — não há o que corrigir."
              : "Escolha a classificação para ver a composição, antes e depois."}
          </Dica>
        ) : (
          <>
            <Card>
              <Linha rotulo="Material">
                <span className="mono">
                  {formatarBRL(conta.antes.materialCentavos)} →{" "}
                  <span className="font-semibold">
                    {formatarBRL(conta.depois.materialCentavos)}
                  </span>
                </span>
              </Linha>
              <Linha rotulo="Mão de obra">
                <span className="mono">
                  {formatarBRL(conta.antes.maoObraCentavos)} →{" "}
                  <span className="font-semibold">
                    {formatarBRL(conta.depois.maoObraCentavos)}
                  </span>
                </span>
              </Linha>
              <Linha rotulo="Total — igual">
                <span className="mono font-semibold">
                  {formatarBRL(conta.antes.totalCentavos)} →{" "}
                  {formatarBRL(conta.depois.totalCentavos)}
                </span>
              </Linha>
            </Card>
            <Consequencia cor="amb">
              <strong>O total do seu custo não muda — nem um centavo.</strong> O
              que muda é a composição do texto que vai na descrição do imóvel:
              quanto foi material e quanto foi mão de obra. Se o ano já foi
              declarado, o aviso é menor: a composição declarada muda, o total
              não.
            </Consequencia>
          </>
        )}

        <Dica>{RODAPE_MARCENARIA}</Dica>
      </Corpo>

      <Rodape>
        <Botao variante="primary" onClick={gravar} disabled={!podeGravar}>
          {gravando
            ? "Gravando…"
            : escolha === null
              ? "Escolha a classificação para continuar"
              : igual
                ? "Nada a corrigir"
                : faltaAnexo
                  ? "Anexe o documento novo para gravar"
                  : "Gravar a correção"}
        </Botao>
        <BotaoLink href={documentoHref}>Cancelar</BotaoLink>
      </Rodape>
    </>
  );
}
