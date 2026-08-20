"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CampoTexto } from "@/app/_components/campos";
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
  baixarPendencia,
  carregarObras,
  carregarPainelDePendencias,
  classificarErro,
  mensagemDeErro,
  type ErroDeTela,
} from "@/lib/data";
import { formatarDataBR } from "@/lib/fiscal/obra";
import {
  AVISO_ANO_ANTERIOR,
  DESFECHOS_DE_RETIFICADORA,
  DESFECHO_MANUAL_EMITENTE_ERRADO,
  EMITENTE_ERRADO_O_QUE_FALTA,
  montarPendenciasDeAno,
  SO_SEI_QUE_E_ANO_ANTERIOR,
  type PendenciaDeAno,
} from "@/lib/fiscal/revisao";
import { formatarBRL } from "@/lib/money";
import type {
  DesfechoPendencia,
  PendenciaPersistente,
  Revisao,
} from "@/lib/types";

const ROTULO_CAMPO: Record<string, string> = {
  valor: "valor",
  classificacao: "classificação",
  nome: "nome do favorecido",
  obra: "obra",
  vinculo: "vínculo pagamento↔nota",
};

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      ano: PendenciaDeAno | null;
      emitente: PendenciaPersistente | null;
      revisoes: Revisao[];
      obras: Map<string, string>;
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
        setEstado({
          fase: "pronto",
          ano: anos.find((p) => p.id === id) ?? null,
          emitente:
            painel.pendencias.find(
              (p) => p.id === id && p.tipo === "emitente_errado",
            ) ?? null,
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
      setErroGravar(mensagemDeErro(erro));
    } finally {
      setGravando(false);
    }
  }

  if (estado.fase !== "pronto") {
    return (
      <>
        <AppBar titulo="Pendência" />
        <Corpo>
          {estado.fase === "erro" ? (
            <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando a pendência" />
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href="/pendencias">Voltar às pendências</BotaoLink>
        </Rodape>
      </>
    );
  }

  // ── A pendência de CNPJ errado (critério 19) ───────────────────────────
  if (estado.emitente) {
    const p = estado.emitente;
    return (
      <>
        <AppBar
          titulo="CNPJ errado — tratar"
          sub={`marcado em ${formatarDataBR(p.abertaEm.slice(0, 10))}`}
        />
        <Corpo>
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
            <Consequencia cor="amb">{EMITENTE_ERRADO_O_QUE_FALTA}</Consequencia>
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
        </Corpo>
        <Rodape>
          {p.desfecho ? (
            <BotaoLink href="/pendencias" variante="primary">
              Voltar às pendências
            </BotaoLink>
          ) : tratando ? (
            <>
              <Botao
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
              </Botao>
              <Botao variante="ghost" onClick={() => setTratando(false)}>
                Cancelar
              </Botao>
            </>
          ) : (
            <>
              <Botao variante="primary" onClick={() => setTratando(true)}>
                Marcar como tratada
              </Botao>
              <BotaoLink href="/pendencias">Voltar às pendências</BotaoLink>
            </>
          )}
        </Rodape>
      </>
    );
  }

  // ── A pendência de retificadora (critérios 20 e 21) ────────────────────
  const p = estado.ano;
  if (!p) {
    return (
      <>
        <AppBar titulo="Pendência" />
        <Corpo>
          <Banner cor="amb" role="status">
            Esta pendência não existe nesta conta.
          </Banner>
        </Corpo>
        <Rodape>
          <BotaoLink href="/pendencias" variante="primary">
            Voltar às pendências
          </BotaoLink>
        </Rodape>
      </>
    );
  }

  const opcaoEscolhida = DESFECHOS_DE_RETIFICADORA.find(
    (o) => o.valor === desfecho,
  );
  const faltaData = opcaoEscolhida?.pedeData === true && data === "";

  return (
    <>
      <AppBar
        titulo={
          p.desfecho ? `Pendência de ${p.ano} · baixada` : "Correção mexeu em ano anterior"
        }
        sub={`${p.ano} · aberta em ${formatarDataBR(p.abertaEm.slice(0, 10))} · ${p.quantidadeDeAtos} ${p.quantidadeDeAtos === 1 ? "correção acumulada" : "correções acumuladas"}`}
      />
      <Corpo>
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
            const pagamentos = linhas.filter((l) => l.entidade === "pagamento");
            return (
              <div key={atoId} className="border-t border-line py-2.5 first:border-t-0">
                <div className="text-[11.5px] text-mut">
                  {formatarDataBR(principal.quando.slice(0, 10))} · por você
                </div>
                <div className="mt-0.5 font-semibold">
                  {ROTULO_CAMPO[principal.campo] ?? principal.campo}
                  {pagamentos.length > 0
                    ? `, com ${pagamentos.length} ${pagamentos.length === 1 ? "pagamento" : "pagamentos"}`
                    : ""}
                </div>
                <div className="text-[12px] text-mut">
                  motivo:{" "}
                  {principal.motivoTexto ?? principal.motivo.replaceAll("_", " ")}
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

        <Consequencia cor="amb">{AVISO_ANO_ANTERIOR}</Consequencia>
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
      </Corpo>

      <Rodape>
        {p.desfecho ? (
          <BotaoLink href="/pendencias" variante="primary">
            Voltar às pendências
          </BotaoLink>
        ) : tratando ? (
          <>
            <Botao
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
            </Botao>
            <Botao variante="ghost" onClick={() => setTratando(false)}>
              Cancelar
            </Botao>
          </>
        ) : (
          <>
            <Botao variante="primary" onClick={() => setTratando(true)}>
              Marcar como tratada
            </Botao>
            <BotaoLink href="/pendencias">Voltar às pendências</BotaoLink>
          </>
        )}
      </Rodape>
    </>
  );
}
