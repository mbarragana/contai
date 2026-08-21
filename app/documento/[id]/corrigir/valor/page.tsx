"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CampoArquivo, CampoTexto } from "@/app/_components/campos";
import {
  ErroEstaNaNota,
  MotivoEscolhidoResumo,
  PassoMotivo,
  ROTULO_MOTIVO_NO_RASTRO,
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
  carregarPainel,
  classificarErro,
  corrigirValorDoDocumento,
  mensagemDeErro,
  subirParaAcervo,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import {
  anosAfetadosDeUmaObra,
  AVISO_ANO_ANTERIOR,
  SO_SEI_QUE_E_ANO_ANTERIOR,
} from "@/lib/fiscal/revisao";
import { custoComprovadoAteOAno, alocarCusto } from "@/lib/fiscal/vinculo";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL, parseValorInput } from "@/lib/money";
import type { AnoAfetado, Documento } from "@/lib/types";

type Fase =
  | { nome: "passo1" }
  | { nome: "erro_do_papel" }
  | { nome: "campo"; motivo: MotivoEscolhido; motivoTexto: string | null }
  | { nome: "gravado"; anos: AnoAfetado[]; valorCentavos: number };

/**
 * Tela s3 do mock v2 — **corrigir o valor**, critério 3 do CONTAI-021.
 *
 * É o único campo do `documento` que move custo entre anos-calendário: ele muda
 * `C = min(Σ pagamentos, Σ documentos)` e a repartição cronológica retira ou
 * acrescenta a partir do pagamento mais recente (parecer §0(a)). `data_emissao`
 * **nunca** governa o ano do custo — por isso esta tela se chama "corrigir o
 * valor", e nunca "corrigir valor/data".
 *
 * `null → valor` (a dor D-018.5, tela s3c) é **o mesmo caminho, sem exceção**
 * (parecer §1): mesma pergunta de motivo, mesmo rastro, mesma conta. O "antes"
 * é gravado VAZIO, não zero — zero é um valor, branco é a ausência dele.
 */
export default function CorrigirValor() {
  const { id } = useParams<{ id: string }>();
  const { pedirReautenticacao } = useSessao();
  const [carregado, setCarregado] = useState<{
    documento: Documento;
    painel: PainelDados;
  } | null>(null);
  const [erroCarregar, setErroCarregar] = useState<ErroDeTela | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [fase, setFase] = useState<Fase>({ nome: "passo1" });
  const [texto, setTexto] = useState("");
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

  const ano = Number(hojeIso().slice(0, 4));
  const novoCentavos = parseValorInput(texto);

  const conta = useMemo(() => {
    if (!carregado || novoCentavos === null) return null;
    const { documento, painel } = carregado;
    if (novoCentavos === documento.valorCentavos) return null;

    const depois = {
      documentos: painel.documentos.map((d) =>
        d.id === documento.id ? { ...d, valorCentavos: novoCentavos } : d,
      ),
      pagamentos: painel.pagamentos,
    };

    return {
      anos: anosAfetadosDeUmaObra(documento.obraId, painel, depois, ano),
      acumuladoAntes: custoComprovadoAteOAno(alocarCusto(painel), ano),
      acumuladoDepois: custoComprovadoAteOAno(alocarCusto(depois), ano),
    };
  }, [carregado, novoCentavos, ano]);

  async function gravar() {
    if (!carregado || fase.nome !== "campo" || novoCentavos === null) return;
    setGravando(true);
    setErroGravar(null);
    try {
      // ⚠️ O upload vem ANTES da gravação, e é o único jeito: o `arquivo_path`
      // precisa existir no acervo para a função Postgres o registrar no mesmo
      // ato. Falha no upload = nada foi gravado, e a tela diz isso.
      const anexoPath = anexo ? await subirParaAcervo(anexo, "documento") : null;
      await corrigirValorDoDocumento({
        documentoId: carregado.documento.id,
        valorCentavos: novoCentavos,
        motivo: fase.motivo,
        motivoTexto: fase.motivoTexto,
        anos: conta?.anos ?? [],
        anexoPath,
      });
      setFase({
        nome: "gravado",
        anos: conta?.anos ?? [],
        valorCentavos: novoCentavos,
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

  const documentoHref = `/documento/${id}`;

  // ── Carregando / erro ──────────────────────────────────────────────────
  if (!carregado) {
    return (
      <>
        <AppBar titulo="Corrigir o valor" />
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
  const sub = `${d.favorecidoNome ?? "emitente não identificado"}`;
  const valorHoje =
    d.valorCentavos === null ? "—" : formatarBRL(d.valorCentavos);

  // ── Gravado ────────────────────────────────────────────────────────────
  if (fase.nome === "gravado") {
    return (
      <>
        <AppBar titulo="Valor corrigido ✓" sub={sub} />
        <Corpo>
          <Banner cor="grn" role="status">
            <strong>Corrigido.</strong> O valor desta nota agora é{" "}
            <strong>{formatarBRL(fase.valorCentavos)}</strong>, e a correção
            ficou registrada no histórico do documento.
          </Banner>
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
          {fase.anos.some((a) => a.pendencia) ? (
            <Card className="border-amb">
              <Chip cor="amb">Correção mexeu em ano anterior</Chip>
              <Consequencia cor="amb">{AVISO_ANO_ANTERIOR}</Consequencia>
              <Dica>{SO_SEI_QUE_E_ANO_ANTERIOR}</Dica>
              <div className="mt-2.5">
                <BotaoLink href="/pendencias">Ver a pendência na lista</BotaoLink>
              </div>
            </Card>
          ) : null}
        </Corpo>
        <Rodape>
          <BotaoLink href={documentoHref} variante="primary">
            Voltar ao documento
          </BotaoLink>
        </Rodape>
      </>
    );
  }

  // ── Passo 1 e a saída "o erro é do papel" ──────────────────────────────
  if (fase.nome === "passo1" || fase.nome === "erro_do_papel") {
    return (
      <>
        <AppBar
          titulo="Corrigir o valor"
          sub={fase.nome === "passo1" ? `${sub} · passo 1 de 3` : sub}
        />
        <Corpo>
          <Card>
            <Linha rotulo="Valor gravado hoje">
              <span className="mono">{valorHoje}</span>
            </Linha>
            <Linha rotulo="Papel anexado">
              {d.arquivoPath.split("/").pop()}
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

  // ── Passos 2 e 3: o campo, e o que ele muda ────────────────────────────
  const igual = novoCentavos !== null && novoCentavos === d.valorCentavos;
  const invalido = texto.trim() !== "" && novoCentavos === null;
  const faltaAnexo = fase.motivo === "emitente_corrigiu_a_nota" && anexo === null;
  const podeGravar =
    novoCentavos !== null && !igual && !invalido && !faltaAnexo && !gravando;

  const rotuloBotao = gravando
    ? "Gravando…"
    : novoCentavos === null
      ? "Digite o valor do papel para continuar"
      : igual
        ? "Nada a corrigir"
        : faltaAnexo
          ? "Anexe o documento novo para gravar"
          : conta && conta.anos.length > 0
            ? `Gravar — o custo de ${conta.anos[0].ano} passa a ${formatarBRL(conta.anos[0].depoisCentavos)}`
            : "Gravar a correção";

  return (
    <>
      <AppBar titulo="Corrigir o valor" sub={`${sub} · passos 2 e 3 de 3`} />
      <Corpo>
        {erroGravar ? (
          <Banner cor="red" role="alert">
            <strong>Não deu para gravar.</strong> {erroGravar}{" "}
            <strong>Nada foi alterado</strong> — o valor continua {valorHoje} e
            nenhum registro de correção foi criado.
          </Banner>
        ) : null}

        <MotivoEscolhidoResumo
          motivo={fase.motivo}
          texto={fase.motivoTexto}
          onTrocar={() => setFase({ nome: "passo1" })}
        />

        <Card>
          <div className="font-semibold">Papel anexado — confira antes de digitar</div>
          <Dica>
            {d.arquivoPath.split("/").pop()} — o anexo{" "}
            <strong>não se substitui</strong>; se precisar, anexa-se um
            adicional.
          </Dica>
        </Card>

        {fase.motivo === "emitente_corrigiu_a_nota" ? (
          <>
            <Passo>Documento novo do emitente</Passo>
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
              soma a ela. A nota original continua no acervo, com o arquivo dela.
              O acervo só cresce.
            </Consequencia>
          </>
        ) : null}

        <Card>
          <Linha rotulo="Valor gravado hoje">
            <span className="mono">{valorHoje}</span>
          </Linha>
        </Card>

        <CampoTexto
          rotulo="Valor que está no papel"
          valor={texto}
          onChange={setTexto}
          inputMode="decimal"
          placeholder="0,00"
          erro={
            invalido
              ? "Não consigo ler isto como um valor em reais. Digite só números, com vírgula nos centavos."
              : igual
                ? "Igual ao que já está gravado — não há o que corrigir. Gravar assim criaria um registro de uma correção que não aconteceu."
                : undefined
          }
        />

        {d.valorCentavos === null ? (
          <Consequencia cor="amb">
            Este registro entrou <strong>sem valor</strong>. Enquanto o valor
            estiver em branco, ele não cobre pagamento nenhum — o que foi pago
            contra ele continua como &quot;pago sem nota&quot;. No registro da
            correção, o &quot;antes&quot; fica <strong>vazio, não zero</strong>:
            zero é um valor, branco é a ausência dele.
          </Consequencia>
        ) : null}

        {/* ── Passo 3: o que isso muda, ANTES de gravar ─────────────────── */}
        <Passo>O que isso muda no seu custo</Passo>
        {!conta ? (
          <Dica>
            Digite o valor do papel para ver o custo confirmado de cada ano,
            antes e depois.
          </Dica>
        ) : (
          <>
            <Card>
              <Dica>
                Custo confirmado por ano-calendário — o que entra na declaração
                de cada ano.
              </Dica>
              {conta.anos.length === 0 ? (
                <Dica>
                  Nenhum ano muda: sem pagamento ligado a esta nota, o valor dela
                  não entra em custo confirmado nenhum. Documento sozinho não
                  comprova custo — o que comprova é o par.
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
              <Linha rotulo={`Acumulado até ${ano}`}>
                <span className="mono">
                  {formatarBRL(conta.acumuladoAntes)} →{" "}
                  <span className="font-semibold">
                    {formatarBRL(conta.acumuladoDepois)}
                  </span>
                </span>
              </Linha>
            </Card>
            <Dica>
              Custo comprovado do par = mínimo entre a soma dos pagamentos e a
              soma dos documentos hábeis. O ano é o da{" "}
              <strong>data do pagamento</strong> — regime de caixa.
            </Dica>

            {conta.anos.some((a) => a.pendencia) ? (
              <>
                <Consequencia cor="amb">{AVISO_ANO_ANTERIOR}</Consequencia>
                <Dica>{SO_SEI_QUE_E_ANO_ANTERIOR}</Dica>
                <Consequencia cor="amb">
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
          <Linha rotulo="campo valor">
            <span className="mono">
              {d.valorCentavos === null ? "(em branco)" : valorHoje} →{" "}
              {novoCentavos === null ? "—" : formatarBRL(novoCentavos)}
            </span>
          </Linha>
          <Linha rotulo="motivo">
            {fase.motivoTexto ?? ROTULO_MOTIVO_NO_RASTRO[fase.motivo]}
          </Linha>
          <Linha rotulo="quando, e por quem">no ato da gravação</Linha>
          <Linha rotulo="anos afetados">
            {conta && conta.anos.length > 0
              ? conta.anos.map((a) => a.ano).join(", ")
              : "nenhum"}
          </Linha>
        </Card>
        <Dica>
          Correção registrada <strong>não se apaga e não se edita</strong> — nem
          por você. A correção e o registro dela vão juntos, numa operação só:
          ou as duas coisas acontecem, ou nenhuma acontece.
        </Dica>
      </Corpo>

      <Rodape>
        <Botao variante="primary" onClick={gravar} disabled={!podeGravar}>
          {rotuloBotao}
        </Botao>
        <BotaoLink href={documentoHref}>Cancelar</BotaoLink>
      </Rodape>
    </>
  );
}
