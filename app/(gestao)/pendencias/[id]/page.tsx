"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CampoTexto } from "@/app/_components/campos";
// ⚠️ `rotuloDoCampo` é IMPORTADO, e não uma cópia (Gate 2 do CONTAI-061): este
// arquivo tinha um `ROTULO_CAMPO` próprio, idêntico ao de `corrigir.tsx`, e
// acrescentar `comprovante` exigia editar os dois à mão — esquecer um deixaria o
// typecheck verde com um token cru na tela. Uma definição, exaustiva pelo tipo.
import {
  rotuloDoCampo,
  ROTULO_MOTIVO_NO_RASTRO,
} from "@/app/_components/corrigir";
import {
  CabecalhoDaTela,
  ColunaDeDetalhe,
  RodapeDeAcao,
} from "@/app/_components/detalhe";
import { useSessao } from "@/app/_components/sessao";
import {
  Banner,
  Botao,
  BotaoLink,
  BotaoSalvar,
  Card,
  Carregando,
  Chip,
  Consequencia,
  Dica,
  EstadoErro,
  Linha,
  Passo,
} from "@/app/_components/ui";
import {
  baixarPendencia,
  carregarObras,
  carregarPainelDePendencias,
  classificarErro,
  mensagemDeErroDeGravacao,
  type ErroDeTela,
} from "@/lib/data";
import { formatarDataBR } from "@/lib/fiscal/obra";
import {
  AVISO_ANO_ANTERIOR,
  DESFECHOS_DE_RETIFICADORA,
  DESFECHO_MANUAL_EMITENTE_ERRADO,
  EMITENTE_ERRADO_O_QUE_FALTA,
  GRAVIDADE_CORRECAO_ANO_ANTERIOR,
  montarPendenciasDeAno,
  sinalDoEmitenteErrado,
  SO_SEI_QUE_E_ANO_ANTERIOR,
  type PendenciaDeAno,
  type SinalDoEmitenteErrado,
} from "@/lib/fiscal/revisao";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import type {
  DesfechoPendencia,
  PendenciaPersistente,
  Revisao,
} from "@/lib/types";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      ano: PendenciaDeAno | null;
      emitente: PendenciaPersistente | null;
      revisoes: Revisao[];
      obras: Map<string, string>;
      /**
       * Item D do CONTAI-035 — `null` quando a pendência desta tela não é de
       * CNPJ errado (a de retificadora não tem documento por trás).
       */
      sinalDoEmitente: SinalDoEmitenteErrado | null;
    };

/**
 * A tela da pendência (mock s7c) e a baixa dela (s7d) — critérios 19, 20 e 21.
 *
 * ⚠️ **Só o Mateus baixa, em ato nomeado, e a baixa não apaga.** Nunca ao
 * fechar a tela, nunca em lote, nunca automático, nunca sugerido pelo app: ele
 * não sabe se a DAA foi entregue nem o que o contador respondeu, que são
 * exatamente as duas coisas que os três desfechos separam.
 *
 * ⚠️ **A pendência de CNPJ errado tem lista de desfecho PRÓPRIA** (critério 19,
 * corrigido pelo `po` em 19/08): os três desfechos do critério 21 são todos
 * sobre DAA, e nenhum descreve "resolvi o CNPJ errado". Quem recusa a lista
 * errada é o banco (check + FK composto da migration 0009).
 *
 * ⚠️ **CONTAI-045 — a tela migrou para o shell de gestão**, e com ela a saída:
 * o "Voltar às pendências" do rodapé de 430px virou o breadcrumb "‹ Pendências"
 * do topbar (`migalhaDaRota`), que aponta para `/pendencias` — a fila unificada
 * do `CONTAI-042`, **nunca** para a home antiga, que deixou de existir no
 * `CONTAI-040` (critério 4 e Pre-mortem 2 do ticket). Ele muda de lugar, não se
 * duplica: por isso não sobrou nenhum "Voltar" no rodapé.
 */
export default function DetalheDaPendencia() {
  const { id } = useParams<{ id: string }>();
  const { pedirReautenticacao } = useSessao();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [tratando, setTratando] = useState(false);
  const [desfecho, setDesfecho] = useState<DesfechoPendencia | null>(null);
  const [data, setData] = useState("");
  const [gravando, setGravando] = useState(false);
  const [erroGravar, setErroGravar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const [painel, obras] = await Promise.all([
          carregarPainelDePendencias(),
          carregarObras(),
        ]);
        if (cancelado) return;
        const anos = montarPendenciasDeAno(painel);
        const emitente =
          painel.pendencias.find(
            (p) => p.id === id && p.tipo === "emitente_errado",
          ) ?? null;
        setEstado({
          fase: "pronto",
          ano: anos.find((p) => p.id === id) ?? null,
          emitente,
          sinalDoEmitente: emitente
            ? sinalDoEmitenteErrado({
                documentoId: emitente.documentoId ?? "",
                vinculos: painel.vinculos,
                anoCorrente: Number(hojeIso().slice(0, 4)),
              })
            : null,
          revisoes: painel.revisoes.filter((r) =>
            painel.linhas.some(
              (l) => l.pendenciaId === id && l.revisaoId === r.id,
            ),
          ),
          obras: new Map(obras.map((o) => [o.id, o.nome])),
        });
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

  async function baixar() {
    if (!desfecho) return;
    setGravando(true);
    setErroGravar(null);
    try {
      await baixarPendencia({
        pendenciaId: id,
        desfecho,
        dataInformada: data || null,
      });
      setTratando(false);
      setDesfecho(null);
      setData("");
      setEstado({ fase: "carregando" });
      setTentativa((t) => t + 1);
    } catch (erro) {
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        setGravando(false);
        return;
      }
      setErroGravar(mensagemDeErroDeGravacao(erro, "na lista de pendências, se esta já aparece baixada"));
    } finally {
      setGravando(false);
    }
  }

  if (estado.fase !== "pronto") {
    return (
      <>
        <CabecalhoDaTela titulo="Pendência" />
        <ColunaDeDetalhe>
          {estado.fase === "erro" ? (
            <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando a pendência" />
          )}
        </ColunaDeDetalhe>
      </>
    );
  }

  // ── A pendência de CNPJ errado (critério 19) ───────────────────────────
  if (estado.emitente) {
    const p = estado.emitente;
    // Sempre presente neste ramo: quem carrega o sinal é a mesma leitura que
    // achou a pendência. O `??` existe só para o tipo, não para o caso real.
    const sinal =
      estado.sinalDoEmitente ??
      sinalDoEmitenteErrado({
        documentoId: p.documentoId ?? "",
        vinculos: [],
        anoCorrente: Number(hojeIso().slice(0, 4)),
      });
    return (
      <>
        <CabecalhoDaTela
          titulo="CNPJ errado — tratar"
          sub={`marcado em ${formatarDataBR(p.abertaEm.slice(0, 10))}`}
        />
        <ColunaDeDetalhe>
          {erroGravar ? (
            <Banner cor="red" role="alert">
              <strong>Não deu para baixar.</strong> {erroGravar} A pendência
              continua aberta.
            </Banner>
          ) : null}

          {p.desfecho ? (
            <Banner cor="grn" role="status">
              <strong>Baixada</strong> em{" "}
              {formatarDataBR(p.desfecho.baixadaEm.slice(0, 10))}. Ela saiu da
              lista e ficou no histórico —{" "}
              <strong>nada foi apagado para isso acontecer</strong>.
            </Banner>
          ) : (
            <>
              <Consequencia cor={sinal.gravidade}>
                {EMITENTE_ERRADO_O_QUE_FALTA}
              </Consequencia>
              {/* Âmbar mesmo quando a pendência é vermelha: o aviso informa a
                  escalada (critério 6), não a gravidade. */}
              {sinal.avisoAnoAnterior ? (
                <Consequencia cor="amb">{sinal.avisoAnoAnterior}</Consequencia>
              ) : null}
            </>
          )}

          <Card>
            <Dica>
              Ela é <strong>por documento</strong>, não por ano, e tem lista de
              desfecho própria — não é a mesma da pendência de retificadora.
            </Dica>
            <div className="mt-2">
              <BotaoLink href={`/documento/${p.documentoId}`}>
                Ver o documento marcado
              </BotaoLink>
            </div>
          </Card>

          {!p.desfecho ? (
            <Card>
              <div className="font-semibold">Como esta pendência termina</div>
              <Dica>
                A outra saída é <strong>automática</strong>, e é a única do
                sistema inteiro: quando a rodada 2 repontar o documento para o
                favorecido certo, o desfecho é gravado sozinho, por acréscimo. É
                legítima onde a da retificadora não seria — aqui o app{" "}
                <strong>prova</strong> o fato: o ponteiro mudou no banco.
              </Dica>
              {tratando ? (
                <>
                  <button
                    type="button"
                    onClick={() => setDesfecho("cnpj_gravado_esta_certo")}
                    aria-pressed={desfecho === "cnpj_gravado_esta_certo"}
                    className={`mt-2 min-h-[44px] w-full rounded-[10px] border px-[14px] py-3 text-left ${
                      desfecho === "cnpj_gravado_esta_certo"
                        ? "border-ink bg-ink text-paper"
                        : "border-line bg-white"
                    }`}
                  >
                    <div className="font-semibold">
                      {DESFECHO_MANUAL_EMITENTE_ERRADO.titulo}
                    </div>
                    <div className="mt-0.5 text-[12px] opacity-80">
                      {DESFECHO_MANUAL_EMITENTE_ERRADO.detalhe}
                    </div>
                  </button>
                  {desfecho ? (
                    <div className="mt-2">
                      <CampoTexto
                        rotulo="Data em que você conferiu — obrigatória"
                        tipo="date"
                        valor={data}
                        onChange={setData}
                      />
                    </div>
                  ) : null}
                  <Dica>Nada nasce marcado.</Dica>
                </>
              ) : null}
            </Card>
          ) : null}
        </ColunaDeDetalhe>

        {/* ⚠️ **CONTAI-045** — o rodapé existe só enquanto há UMA ação de
            página (decisão 4 do spec). Baixada, a pendência vira leitura: o
            rodapé some, e a saída é o breadcrumb "‹ Pendências" do topbar — o
            "Voltar às pendências" mudou de lugar, não se duplicou. */}
        {p.desfecho ? null : (
          <RodapeDeAcao>
            {tratando ? (
              <>
                <BotaoSalvar
                  ocupado={gravando}
                  variante="primary"
                  onClick={baixar}
                  disabled={gravando || !desfecho || data === ""}
                >
                  {gravando
                    ? "Gravando…"
                    : !desfecho
                      ? "Escolha o desfecho para continuar"
                      : data === ""
                        ? "Informe a data para continuar"
                        : "Marcar como tratada"}
                </BotaoSalvar>
                <Botao variante="ghost" onClick={() => setTratando(false)}>
                  Cancelar
                </Botao>
              </>
            ) : (
              <Botao variante="primary" onClick={() => setTratando(true)}>
                Marcar como tratada
              </Botao>
            )}
          </RodapeDeAcao>
        )}
      </>
    );
  }

  // ── A pendência de retificadora (critérios 20 e 21) ────────────────────
  const p = estado.ano;
  if (!p) {
    return (
      <>
        <CabecalhoDaTela titulo="Pendência" />
        <ColunaDeDetalhe>
          <Banner cor="amb" role="status">
            Esta pendência não existe nesta conta.
          </Banner>
        </ColunaDeDetalhe>
      </>
    );
  }

  const opcaoEscolhida = DESFECHOS_DE_RETIFICADORA.find(
    (o) => o.valor === desfecho,
  );
  const faltaData = opcaoEscolhida?.pedeData === true && data === "";

  return (
    <>
      <CabecalhoDaTela
        titulo={
          p.desfecho ? `Pendência de ${p.ano} · baixada` : "Correção mexeu em ano anterior"
        }
        sub={`${p.ano} · aberta em ${formatarDataBR(p.abertaEm.slice(0, 10))} · ${p.quantidadeDeAtos} ${p.quantidadeDeAtos === 1 ? "correção acumulada" : "correções acumuladas"}`}
      />
      <ColunaDeDetalhe>
        {erroGravar ? (
          <Banner cor="red" role="alert">
            <strong>Não deu para baixar.</strong> {erroGravar} A pendência
            continua aberta e nada foi alterado.
          </Banner>
        ) : null}

        {p.desfecho ? (
          <Banner cor="grn" role="status">
            <strong>Baixada</strong> em{" "}
            {formatarDataBR(p.desfecho.baixadaEm.slice(0, 10))}. Ela saiu da
            lista e ficou no histórico do ano —{" "}
            <strong>nada foi apagado para isso acontecer</strong>.
          </Banner>
        ) : null}

        {/* ── O acumulado do ano, POR OBRA ─────────────────────────────── */}
        <Passo>O acumulado do ano</Passo>
        <Card>
          {p.obras.map((o) => (
            <Linha
              key={o.obraId}
              rotulo={estado.obras.get(o.obraId) ?? "outra obra"}
            >
              <span className="mono">
                {formatarBRL(o.antesCentavos)} →{" "}
                <span className="font-semibold">
                  {formatarBRL(o.depoisCentavos)}
                </span>
              </span>
            </Linha>
          ))}
          <Dica>
            Do <strong>primeiro &quot;antes&quot;</strong> — como estava antes da
            primeira correção — ao <strong>último &quot;depois&quot;</strong>. É
            esse número que interessa a quem for avaliar a retificadora, não o
            delta de cada correção isolada.
          </Dica>
          {p.obras.length > 1 ? (
            <Dica>
              Uma pendência do ano pode atingir mais de uma obra — é o caso de
              mover um documento de obra. Aqui, onde o contexto é o ano, cada
              obra tem a <strong>sua linha</strong>, lado a lado e{" "}
              <strong>nunca somadas</strong>.
            </Dica>
          ) : null}
        </Card>

        {/* ── As correções que a compõem ───────────────────────────────── */}
        <Passo>
          {p.quantidadeDeAtos === 1
            ? "A correção que compõe esta pendência"
            : `As ${p.quantidadeDeAtos} correções que compõem esta pendência`}
        </Passo>
        <Card>
          {/* Um ato = uma linha. No banco o move são N linhas com o mesmo
              `ato_id`; aqui é uma, porque foi um ato só. */}
          {[...new Set(estado.revisoes.map((r) => r.atoId))].map((atoId) => {
            const linhas = estado.revisoes.filter((r) => r.atoId === atoId);
            const principal = linhas[0];
            /**
             * ⚠️ `slice(1)`, e não `linhas.filter(...)` — a mesma correção que
             * `LinhaDoAto` (`app/_components/corrigir.tsx`) já carregava desde o
             * CONTAI-008: as secundárias são as linhas DEPOIS da principal.
             * Contando por entidade fixa, a linha principal contava a si mesma
             * sempre que ela fosse de `pagamento` — e o ato do CONTAI-061 é uma
             * linha só, de `pagamento`, então diria "com 1 pagamento" num ato
             * que não tocou pagamento nenhum além do próprio.
             */
            const pagamentos = linhas
              .slice(1)
              .filter((l) => l.entidade === "pagamento");
            return (
              <div key={atoId} className="border-t border-line py-2.5 first:border-t-0">
                <div className="text-[11.5px] text-mut">
                  {formatarDataBR(principal.quando.slice(0, 10))} · por você
                </div>
                <div className="mt-0.5 font-semibold">
                  {rotuloDoCampo(principal.campo)}
                  {pagamentos.length > 0
                    ? `, com ${pagamentos.length} ${pagamentos.length === 1 ? "pagamento" : "pagamentos"}`
                    : ""}
                </div>
                <div className="text-[12px] text-mut">
                  motivo:{" "}
                  {principal.motivoTexto ??
                    ROTULO_MOTIVO_NO_RASTRO[principal.motivo]}
                </div>
                {principal.anosAfetados.map((a) => (
                  <div
                    key={`${a.obraId}-${a.ano}`}
                    className="mono text-[12px] text-mut"
                  >
                    custo de {a.ano} em{" "}
                    {estado.obras.get(a.obraId) ?? "outra obra"}:{" "}
                    {formatarBRL(a.antesCentavos)} →{" "}
                    {formatarBRL(a.depoisCentavos)}
                  </div>
                ))}
              </div>
            );
          })}
          <Dica>
            Cada uma tem a linha completa no histórico do documento dela. Aqui
            elas aparecem agrupadas <strong>pelo ano que mexeram</strong>, que é
            a unidade da retificadora.
          </Dica>
        </Card>

        <Consequencia cor={GRAVIDADE_CORRECAO_ANO_ANTERIOR}>
          {AVISO_ANO_ANTERIOR}
        </Consequencia>
        <Dica>{SO_SEI_QUE_E_ANO_ANTERIOR}</Dica>
        <Dica>
          O app <strong>não decide</strong> se você precisa retificar. Ele não
          sabe se a declaração de {p.ano} foi entregue, nem se essa diferença é
          material. Quem decide isso é o contador.
        </Dica>

        {/* ── A baixa (critério 21) ────────────────────────────────────── */}
        {p.desfecho ? (
          <Card>
            <Chip cor="grn">tratada</Chip>
            <Dica>
              desfecho:{" "}
              {DESFECHOS_DE_RETIFICADORA.find(
                (o) => o.valor === p.desfecho!.desfecho,
              )?.titulo(p.ano) ?? p.desfecho.desfecho}
              {p.desfecho.dataInformada
                ? ` em ${formatarDataBR(p.desfecho.dataInformada)}`
                : ""}
            </Dica>
            <Dica>
              <strong>Baixar não silencia o futuro.</strong> Se você corrigir
              outra coisa que mexa em {p.ano} depois de hoje, abre uma pendência{" "}
              <strong>nova</strong> — esta não reabre. Reabrir a antiga apagaria
              o fato de que ela foi tratada.
            </Dica>
          </Card>
        ) : (
          <>
            <Passo>Como esta pendência termina</Passo>
            <Card>
              <Dica>
                Ela não some sozinha, não some ao fechar a tela e{" "}
                <strong>o app nunca a baixa por você</strong>. Quem baixa é você,
                escolhendo o que de fato aconteceu.
              </Dica>
              {tratando ? (
                <>
                  <div className="mt-2 flex flex-col gap-2">
                    {DESFECHOS_DE_RETIFICADORA.map((o) => (
                      <button
                        key={o.valor}
                        type="button"
                        onClick={() => {
                          setDesfecho(o.valor);
                          if (!o.pedeData) setData("");
                        }}
                        aria-pressed={desfecho === o.valor}
                        className={`min-h-[44px] rounded-[10px] border px-[14px] py-3 text-left ${
                          desfecho === o.valor
                            ? "border-ink bg-ink text-paper"
                            : "border-line bg-white"
                        }`}
                      >
                        <div className="font-semibold">{o.titulo(p.ano)}</div>
                        <div className="mt-0.5 text-[12px] opacity-80">
                          {o.detalhe}
                        </div>
                      </button>
                    ))}
                  </div>
                  {opcaoEscolhida?.pedeData ? (
                    <div className="mt-2">
                      <CampoTexto
                        rotulo="Data — obrigatória"
                        tipo="date"
                        valor={data}
                        onChange={setData}
                      />
                    </div>
                  ) : null}
                  {opcaoEscolhida && !opcaoEscolhida.pedeData ? (
                    <Dica>
                      Este desfecho não pede data: não houve entrega a datar. A
                      data do ato fica registrada sozinha, como em toda linha do
                      acervo.
                    </Dica>
                  ) : null}
                  <Dica>
                    O app <strong>não sugere nenhum dos três</strong>, e não
                    marca nenhum por padrão. Não existe campo livre aqui: texto
                    solto em registro fiscal vira lugar de guardar o que ninguém
                    relê.
                  </Dica>
                </>
              ) : null}
              <Dica>
                <strong>Baixar não apaga.</strong> A pendência sai da lista e
                fica no histórico de {p.ano} — quem baixou, quando, qual desfecho
                e as correções que a compunham. Nenhuma delas some.
              </Dica>
            </Card>
          </>
        )}
      </ColunaDeDetalhe>

      {/* Mesma regra do ramo de CNPJ errado: baixada, a tela é leitura e o
          rodapé não existe. */}
      {p.desfecho ? null : (
        <RodapeDeAcao>
          {tratando ? (
            <>
              <BotaoSalvar
                ocupado={gravando}
                variante="primary"
                onClick={baixar}
                disabled={gravando || !desfecho || faltaData}
              >
                {gravando
                  ? "Gravando…"
                  : !desfecho
                    ? "Escolha o desfecho para continuar"
                    : faltaData
                      ? "Informe a data para continuar"
                      : "Marcar como tratada"}
              </BotaoSalvar>
              <Botao variante="ghost" onClick={() => setTratando(false)}>
                Cancelar
              </Botao>
            </>
          ) : (
            <Botao variante="primary" onClick={() => setTratando(true)}>
              Marcar como tratada
            </Botao>
          )}
        </RodapeDeAcao>
      )}
    </>
  );
}
