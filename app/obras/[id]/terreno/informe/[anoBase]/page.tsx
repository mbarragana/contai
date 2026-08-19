"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CampoArquivo, CampoTexto } from "@/app/_components/campos";
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
  carregarFinanciamento,
  carregarInformes,
  carregarObra,
  classificarErro,
  criarInforme,
  mensagemDeErro,
  subirParaAcervo,
  type ErroDeTela,
} from "@/lib/data";
import {
  custoDoInformeCentavos,
  GUARDADO_NAO_E_DESCARTADO,
  INFORME_EXIGE_ANEXO,
  INSUMO_PARA_REVISAO_CRC,
  penalidadesCentavos,
  RUBRICA_EM_ABERTO,
  rubricasComClassificacaoEmAberto,
  SALDO_DEVEDOR_INFORMATIVO,
  SALDO_DEVEDOR_OBRIGATORIO,
  TAXAS_E_FCVS_NA_MESMA_LINHA,
  travaDaSoma,
  UM_INFORME_POR_ANO,
} from "@/lib/fiscal/terreno";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL, parseValorInput } from "@/lib/money";
import type { Financiamento, FinanciamentoInforme, Obra } from "@/lib/types";

/**
 * O informe anual do financiamento, em 3 passos (mock s3 → s4 → s6 → s7).
 *
 * Acontece **uma vez por ano**, em jan/fev, quando a instituição publica o
 * "Extrato do Imposto de Renda". Cenário: **gestão, em casa, sentado** — a tela
 * é densa de propósito; 375px é piso, não alvo.
 *
 * Duas travas, e elas não se confundem:
 * 1. **O anexo vem antes dos números** (critério 10) — sem o extrato não grava.
 * 2. **A soma das sete rubricas fecha com o total pago** (critério 11), com
 *    tolerância ZERO, e a recusa nomeia a diferença exata.
 */

/** As sete rubricas do extrato, na ordem em que ele as apresenta. */
const RUBRICAS = [
  {
    chave: "amortizacao",
    rotulo: "Amortização",
    explicacao: "a parte da parcela que abate o preço do terreno — é preço do imóvel",
    destino: "entra" as const,
    nota: "▲ soma no custo",
  },
  {
    chave: "jurosCorrecao",
    rotulo: "Juros / Correção Monetária",
    explicacao:
      "o que você pagou ao banco pelo dinheiro emprestado, mais a correção do saldo",
    destino: "entra" as const,
    nota: "▲ soma no custo — em linha nomeada na declaração",
  },
  {
    chave: "seguros",
    rotulo: "Seguros (MIP e DFI)",
    explicacao: "MIP cobre morte e invalidez; DFI cobre dano físico ao imóvel",
    // ⚠️ NEUTRO. O critério 18 foi REMOVIDO em 2026-08-19: nenhuma tela deste
    // ticket afirma o tratamento dos seguros. O parecer do agente `contador`
    // exclui; o contador com CRC que assina a declaração do Mateus INCLUI
    // (ADENDO 4). A tela mostra a rubrica, o valor e de onde ele veio, e cala.
    destino: "aberto" as const,
    nota: RUBRICA_EM_ABERTO,
  },
  {
    chave: "taxasFcvs",
    rotulo: "Taxas + FCVS",
    explicacao:
      "taxa de administração do contrato, somada ao FCVS — Fundo de Compensação de Variações Salariais",
    destino: "aberto" as const,
    nota: RUBRICA_EM_ABERTO,
  },
  {
    chave: "mora",
    rotulo: "Mora",
    explicacao: "juros cobrados por parcela paga em atraso",
    // Este PODE ser afirmado: `[Certain]` no parecer, critério 12.
    destino: "nunca" as const,
    nota: "✕ penalidade nunca é custo",
  },
  {
    chave: "multa",
    rotulo: "Multa",
    explicacao: "penalidade por atraso",
    destino: "nunca" as const,
    nota: "✕ penalidade nunca é custo",
  },
  {
    chave: "diferencaTeoricoPago",
    rotulo: "Diferença Teórico / Pago",
    explicacao:
      "é o nome que o banco dá a esta linha. Ninguém aqui sabe o que ela representa — e não vamos supor",
    destino: "aberto" as const,
    nota: RUBRICA_EM_ABERTO,
  },
] as const;

type ChaveRubrica = (typeof RUBRICAS)[number]["chave"];

type Campos = Record<ChaveRubrica | "totalPago" | "saldoDevedor", string>;

const CAMPOS_VAZIOS: Campos = {
  amortizacao: "",
  jurosCorrecao: "",
  seguros: "",
  taxasFcvs: "",
  mora: "",
  multa: "",
  diferencaTeoricoPago: "",
  totalPago: "",
  saldoDevedor: "",
};

type Fase =
  | { nome: "carregando" }
  | { nome: "erro"; erro: ErroDeTela }
  | { nome: "pronto" }
  | { nome: "salvando" }
  | { nome: "gravado" };

export default function InformeAnual() {
  const params = useParams<{ id: string; anoBase: string }>();
  const router = useRouter();
  const id = params.id;
  const anoBase = Number(params.anoBase);
  const anoCorrente = Number(hojeIso().slice(0, 4));

  const [fase, setFase] = useState<Fase>({ nome: "carregando" });
  const [obra, setObra] = useState<Obra | null>(null);
  const [financiamento, setFinanciamento] = useState<Financiamento | null>(null);
  const [jaRegistrados, setJaRegistrados] = useState<FinanciamentoInforme[]>([]);
  const [tentativa, setTentativa] = useState(0);

  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [campos, setCampos] = useState<Campos>(CAMPOS_VAZIOS);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [carregada, contrato] = await Promise.all([
      carregarObra(id),
      carregarFinanciamento(id),
    ]);
    setObra(carregada);
    setFinanciamento(contrato);
    setJaRegistrados(contrato ? await carregarInformes(contrato.id) : []);
  }, [id]);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        await carregar();
        if (!cancelado) setFase({ nome: "pronto" });
      } catch (erro) {
        if (!cancelado) setFase({ nome: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [carregar, tentativa]);

  /**
   * Campo em branco vale ZERO aqui, e a exceção é deliberada: a instrução da
   * tela é copiar as linhas do extrato **inclusive as zeradas**, e o extrato
   * traz R$ 0,00 impresso. Texto ILEGÍVEL continua sendo erro — vira `null`,
   * a soma não fecha e a trava recusa. Nunca vira zero em silêncio.
   */
  const centavos = useCallback(
    (chave: keyof Campos): number | null => {
      const texto = campos[chave];
      if (texto.trim() === "") return 0;
      return parseValorInput(texto);
    },
    [campos],
  );

  const numeros = useMemo(() => {
    const lidos = {
      amortizacaoCentavos: centavos("amortizacao"),
      jurosCorrecaoCentavos: centavos("jurosCorrecao"),
      segurosCentavos: centavos("seguros"),
      taxasFcvsCentavos: centavos("taxasFcvs"),
      moraCentavos: centavos("mora"),
      multaCentavos: centavos("multa"),
      diferencaTeoricoPagoCentavos: centavos("diferencaTeoricoPago"),
      totalPagoCentavos: centavos("totalPago"),
      saldoDevedorCentavos: centavos("saldoDevedor"),
    };
    const algumIlegivel = Object.values(lidos).some((v) => v === null);
    return { lidos, algumIlegivel };
  }, [centavos]);

  const valores = useMemo(
    () => ({
      amortizacaoCentavos: numeros.lidos.amortizacaoCentavos ?? 0,
      jurosCorrecaoCentavos: numeros.lidos.jurosCorrecaoCentavos ?? 0,
      segurosCentavos: numeros.lidos.segurosCentavos ?? 0,
      taxasFcvsCentavos: numeros.lidos.taxasFcvsCentavos ?? 0,
      moraCentavos: numeros.lidos.moraCentavos ?? 0,
      multaCentavos: numeros.lidos.multaCentavos ?? 0,
      diferencaTeoricoPagoCentavos:
        numeros.lidos.diferencaTeoricoPagoCentavos ?? 0,
      totalPagoCentavos: numeros.lidos.totalPagoCentavos ?? 0,
      saldoDevedorCentavos: numeros.lidos.saldoDevedorCentavos ?? 0,
    }),
    [numeros],
  );

  const trava = travaDaSoma(valores);
  const totalInformado = (numeros.lidos.totalPagoCentavos ?? 0) > 0;
  /**
   * ⚠️ O saldo devedor é o ÚNICO campo desta tela em que branco não pode valer
   * zero. As sete rubricas têm a trava da soma conferindo cada uma contra o
   * total pago; o saldo devedor não participa de soma nenhuma e por isso **nada
   * o confere**. Em branco virando 0 a tela imprime "Saldo devedor em 31/12:
   * R$ 0,00", que lido literalmente diz FINANCIAMENTO QUITADO — default em
   * campo fiscal, proibido pelo CLAUDE.md — e o número vaza para o texto da
   * discriminação do Passo 2, que exige "pago + saldo devedor = preço
   * contratado".
   *
   * **0,00 DIGITADO é afirmação e passa** (o contrato pode ter sido quitado de
   * verdade); branco não é resposta.
   */
  const saldoInformado = campos.saldoDevedor.trim() !== "";
  const podeGravar =
    !numeros.algumIlegivel &&
    totalInformado &&
    trava.fecha &&
    saldoInformado &&
    arquivo !== null;

  const jaExiste = jaRegistrados.some((i) => i.anoBase === anoBase);

  async function gravar() {
    if (!financiamento || !arquivo || !trava.fecha) return;
    setErroSalvar(null);
    setFase({ nome: "salvando" });
    try {
      // O anexo sobe ANTES do lançamento: sem o extrato no acervo, o número não
      // serve para nada no dia da venda (critério 10).
      const caminho = await subirParaAcervo(arquivo, "informe");
      await criarInforme({
        financiamentoId: financiamento.id,
        anoBase,
        ...valores,
        arquivoPath: caminho,
      });
      setFase({ nome: "gravado" });
    } catch (erro) {
      const codigo = (erro as { code?: string } | null)?.code;
      // 23505 = `unique (financiamento_id, ano_base)` — a trava da dupla
      // contagem no banco. A tela diz o motivo por extenso, não o código.
      setErroSalvar(codigo === "23505" ? UM_INFORME_POR_ANO : mensagemDeErro(erro));
      setFase({ nome: "pronto" });
    }
  }

  // ── Estados de carregamento e erro ─────────────────────────────────────
  if (fase.nome === "carregando" || fase.nome === "erro" || !obra) {
    return (
      <>
        <AppBar titulo={`Informe anual de ${anoBase}`} />
        <Corpo>
          {fase.nome === "erro" ? (
            <EstadoErro
              erro={fase.erro}
              onTentarDeNovo={() => {
                setFase({ nome: "carregando" });
                setTentativa((t) => t + 1);
              }}
            />
          ) : (
            <Carregando rotulo="Carregando o informe" />
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href={`/obras/${id}/terreno`}>Voltar ao terreno</BotaoLink>
        </Rodape>
      </>
    );
  }

  // ── Ano-base no futuro: o exercício ainda não existe ───────────────────
  //
  // O CHECK do banco só limita 1990-2999, e a rota é digitável: `/informe/2031`
  // gravaria custo de aquisição de um ano que ainda não aconteceu. A tela é a
  // única barreira aqui, e a régua é a mesma do desembolso com data futura —
  // o app não registra fato que ainda não ocorreu.
  if (anoBase > anoCorrente) {
    return (
      <>
        <AppBar titulo={`Informe anual de ${anoBase}`} sub={obra.nome} />
        <Corpo>
          <Banner cor="red" role="alert">
            {anoBase} ainda não aconteceu. Não existe extrato de um exercício
            que não fechou, e o app não grava custo de aquisição em ano que
            ainda não existe. O ano-base mais recente com extrato publicado é{" "}
            {anoCorrente - 1}.
          </Banner>
        </Corpo>
        <Rodape>
          <BotaoLink
            href={`/obras/${id}/terreno/informe/${anoCorrente - 1}`}
            variante="primary"
          >
            Registrar informe de {anoCorrente - 1}
          </BotaoLink>
          <BotaoLink href={`/obras/${id}/terreno`}>Voltar ao terreno</BotaoLink>
        </Rodape>
      </>
    );
  }

  // ── Sem contrato não há informe ────────────────────────────────────────
  if (!financiamento) {
    return (
      <>
        <AppBar titulo={`Informe anual de ${anoBase}`} sub={obra.nome} />
        <Corpo>
          <Banner cor="amb" role="status">
            O contrato do financiamento ainda não foi cadastrado, e o informe
            pertence a ele. Cadastre o contrato primeiro — é uma vez na vida.
          </Banner>
        </Corpo>
        <Rodape>
          <BotaoLink
            href={`/obras/${id}/terreno/financiamento`}
            variante="primary"
          >
            Cadastrar o contrato
          </BotaoLink>
          <BotaoLink href={`/obras/${id}/terreno`}>Voltar ao terreno</BotaoLink>
        </Rodape>
      </>
    );
  }

  // ── Já registrado: a trava da dupla contagem, antes de digitar nada ────
  if (jaExiste && fase.nome !== "gravado") {
    return (
      <>
        <AppBar titulo={`Informe anual de ${anoBase}`} sub={obra.nome} />
        <Corpo>
          <Banner cor="red" role="alert">
            {UM_INFORME_POR_ANO}
          </Banner>
        </Corpo>
        <Rodape>
          <BotaoLink href={`/obras/${id}/terreno`} variante="primary">
            Voltar ao terreno
          </BotaoLink>
        </Rodape>
      </>
    );
  }

  // ── Gravado ────────────────────────────────────────────────────────────
  if (fase.nome === "gravado") {
    return (
      <>
        <AppBar titulo={`${anoBase} fechado`} sub={obra.nome} />
        <Corpo>
          <Banner cor="grn" role="status">
            Informe de {anoBase} gravado. O custo de aquisição de {anoBase} passa
            a existir no sistema com o documento que o sustenta.
          </Banner>
          <Card className="border-grn">
            <Linha rotulo={`Custo de aquisição de ${anoBase}`}>
              <span className="mono font-semibold text-grn">
                {formatarBRL(custoDoInformeCentavos(valores))}
              </span>
            </Linha>
            {/* ⚠️ DUAS LINHAS, NUNCA UMA. Somá-las apagaria a diferença que o
                critério 13 manda preservar: "em aberto" é rubrica cuja
                classificação ninguém fechou (seguros, taxas/FCVS, Diferença
                Teórico/Pago — ADENDO 4); "penalidade" tem classificação
                FECHADA, nunca é custo. Balde único é a via pela qual o FCVS
                vira seguro e o seguro vira mora — e `lib/fiscal/terreno.ts`
                mantém as duas funções separadas justamente por isso. */}
            <Linha rotulo="Guardado — classificação com o seu contador">
              <span className="mono">
                {formatarBRL(rubricasComClassificacaoEmAberto(valores))}
              </span>
            </Linha>
            <Linha rotulo="Guardado — penalidade, nunca é custo">
              <span className="mono">
                {formatarBRL(penalidadesCentavos(valores))}
              </span>
            </Linha>
            <Linha rotulo={`Saldo devedor em 31/12/${anoBase}`}>
              <span className="mono">
                {formatarBRL(valores.saldoDevedorCentavos)}
              </span>
            </Linha>
            <Consequencia cor="amb">{INSUMO_PARA_REVISAO_CRC}</Consequencia>
          </Card>
        </Corpo>
        <Rodape>
          <BotaoLink href={`/obras/${id}/terreno`} variante="primary">
            Voltar ao painel do terreno
          </BotaoLink>
        </Rodape>
      </>
    );
  }

  // ── Passo 1 de 3 — o extrato antes dos números ─────────────────────────
  if (passo === 1) {
    return (
      <>
        <AppBar
          titulo={`Informe anual de ${anoBase} — passo 1 de 3`}
          sub={`${financiamento.instituicao} · o extrato antes dos números`}
        />
        <Corpo>
          <Banner cor="amb" role="status">
            <strong>O documento vem primeiro de propósito.</strong> Você vai
            transcrever números dele no próximo passo — tê-lo aberto ao lado é o
            jeito de não errar.
          </Banner>

          <Card>
            <Dica>
              No site ou app da instituição, procure por{" "}
              <strong>“Extrato do Imposto de Renda”</strong> ou{" "}
              <strong>“Informe de rendimentos / pagamentos”</strong>, exercício{" "}
              <strong>{anoBase + 1}</strong>, ano-base <strong>{anoBase}</strong>
              . É publicação automática do banco para o IR —{" "}
              <strong>não precisa pedir a ninguém</strong>, é download.
            </Dica>
          </Card>

          <Card className="flex flex-col gap-3.5">
            <CampoArquivo
              rotulo="Extrato do exercício"
              ajuda="PDF baixado do banco, ou foto da folha impressa."
              accept=".pdf,image/*"
              arquivo={arquivo}
              onChange={setArquivo}
            />
            {arquivo ? null : (
              <Consequencia cor="red">{INFORME_EXIGE_ANEXO}</Consequencia>
            )}
          </Card>

          <Dica>
            O extrato fica no acervo pelo prazo de guarda do imóvel — e o prazo
            deste contrato é longo: obra não vendida = prazo indefinido.
          </Dica>
        </Corpo>
        <Rodape>
          <Botao
            variante="primary"
            onClick={() => setPasso(2)}
            disabled={arquivo === null}
          >
            Continuar para os números
          </Botao>
          {arquivo === null ? (
            <Dica>Anexe o extrato para continuar.</Dica>
          ) : null}
          <BotaoLink href={`/obras/${id}/terreno`}>Voltar ao terreno</BotaoLink>
        </Rodape>
      </>
    );
  }

  // ── Passo 2 de 3 — as sete rubricas e a trava ao vivo ──────────────────
  if (passo === 2) {
    return (
      <>
        <AppBar
          titulo={`Informe anual de ${anoBase} — passo 2 de 3`}
          sub="Copie cada linha do extrato · a tela confere a soma sozinha"
        />
        <Corpo>
          <Banner cor="amb" role="status">
            <strong>Um lançamento por ano, não doze.</strong> Copie as linhas
            exatamente como estão no extrato, <strong>inclusive as zeradas</strong>{" "}
            — é a soma delas que prova que nenhuma linha ficou de fora.
          </Banner>

          {RUBRICAS.map((r) => (
            <Card key={r.chave} className="flex flex-col gap-2">
              <CampoTexto
                rotulo={r.rotulo}
                valor={campos[r.chave]}
                onChange={(v) => setCampos((c) => ({ ...c, [r.chave]: v }))}
                inputMode="decimal"
                placeholder="0,00"
                ajuda={r.explicacao}
                erro={
                  centavos(r.chave) === null
                    ? "Valor não reconhecido — copie como está no extrato."
                    : undefined
                }
              />
              <span
                className={`text-[12px] font-semibold ${
                  r.destino === "entra" ? "text-grn" : "text-mut"
                }`}
              >
                {r.nota}
              </span>
              {r.chave === "taxasFcvs" &&
              (numeros.lidos.taxasFcvsCentavos ?? 0) > 0 ? (
                <Consequencia cor="amb">
                  {TAXAS_E_FCVS_NA_MESMA_LINHA}
                </Consequencia>
              ) : null}
            </Card>
          ))}

          <Passo>A trava — o número que confere tudo</Passo>
          <Card className="flex flex-col gap-3.5">
            <CampoTexto
              rotulo="Total Pago no Exercício"
              valor={campos.totalPago}
              onChange={(v) => setCampos((c) => ({ ...c, totalPago: v }))}
              inputMode="decimal"
              placeholder="0,00"
              ajuda="o total que o extrato fecha. É contra ele que as linhas acima têm de bater"
              erro={
                centavos("totalPago") === null
                  ? "Valor não reconhecido — copie como está no extrato."
                  : undefined
              }
            />
          </Card>

          <Card
            className={trava.fecha && totalInformado ? "border-grn" : "border-amb"}
            data-trava={trava.fecha && totalInformado ? "fecha" : "nao-fecha"}
          >
            <Linha rotulo="Soma das linhas que você digitou">
              <span className="mono">{formatarBRL(trava.somaCentavos)}</span>
            </Linha>
            <Linha rotulo="Total pago no exercício">
              <span className="mono">
                {formatarBRL(valores.totalPagoCentavos)}
              </span>
            </Linha>
            <Linha rotulo="Diferença">
              <span
                className={`mono font-semibold ${
                  trava.diferencaCentavos === 0 ? "text-grn" : "text-red"
                }`}
              >
                {formatarBRL(trava.diferencaCentavos)}
              </span>
            </Linha>
            {totalInformado && !trava.fecha ? (
              <Consequencia cor="red">{trava.mensagem}</Consequencia>
            ) : null}
            {totalInformado && trava.fecha ? (
              <Consequencia cor="amb">
                ✓ A soma das sete linhas fecha com o total pago no exercício.
                Nenhuma linha do seu extrato ficou de fora.
              </Consequencia>
            ) : null}
          </Card>

          <Passo>Informativo — não é custo</Passo>
          <Card className="flex flex-col gap-3.5">
            <CampoTexto
              rotulo={`Saldo Devedor em 31/12/${anoBase}`}
              valor={campos.saldoDevedor}
              onChange={(v) => setCampos((c) => ({ ...c, saldoDevedor: v }))}
              inputMode="decimal"
              placeholder="0,00"
              erro={
                centavos("saldoDevedor") === null
                  ? "Valor não reconhecido — copie como está no extrato."
                  : !saldoInformado
                    ? SALDO_DEVEDOR_OBRIGATORIO
                    : undefined
              }
            />
            <Consequencia cor="amb">{SALDO_DEVEDOR_INFORMATIVO}</Consequencia>
          </Card>

          <Card>
            <Dica>Se fechar, o custo de aquisição de {anoBase} será</Dica>
            <div className="mono text-[22px] font-bold">
              {formatarBRL(custoDoInformeCentavos(valores))}
            </div>
            <Dica>amortização + juros/correção</Dica>
          </Card>
        </Corpo>
        <Rodape>
          <Botao
            variante="primary"
            onClick={() => setPasso(3)}
            disabled={!podeGravar}
          >
            Conferir e gravar
          </Botao>
          {podeGravar ? null : (
            <Dica>
              {numeros.algumIlegivel
                ? "Há um valor que o app não conseguiu ler."
                : !totalInformado
                  ? "Informe o total pago no exercício."
                  : !trava.fecha
                    ? "A soma precisa fechar com o total pago para continuar."
                    : SALDO_DEVEDOR_OBRIGATORIO}
            </Dica>
          )}
          <Botao variante="ghost" onClick={() => setPasso(1)}>
            Voltar ao anexo
          </Botao>
        </Rodape>
      </>
    );
  }

  // ── Passo 3 de 3 — conferência antes de gravar ─────────────────────────
  return (
    <>
      <AppBar
        titulo={`Informe anual de ${anoBase} — passo 3 de 3`}
        sub="Confira antes de gravar"
      />
      <Corpo>
        {erroSalvar ? (
          <Banner cor="red" role="alert">
            {erroSalvar}
          </Banner>
        ) : null}

        <Banner cor="grn" role="status">
          ✓ A soma das sete linhas fecha com o total pago no exercício:{" "}
          <strong className="mono">
            {formatarBRL(valores.totalPagoCentavos)}
          </strong>
          .
        </Banner>

        <Passo>Vai para o custo de aquisição de {anoBase}</Passo>
        <Card className="border-grn">
          <Linha rotulo="Amortização">
            <span className="mono">
              {formatarBRL(valores.amortizacaoCentavos)}
            </span>
          </Linha>
          <Linha rotulo="Juros / Correção Monetária">
            <span className="mono">
              {formatarBRL(valores.jurosCorrecaoCentavos)}
            </span>
          </Linha>
          <Linha rotulo={`Custo de aquisição de ${anoBase}`}>
            <span className="mono font-semibold text-grn">
              {formatarBRL(custoDoInformeCentavos(valores))}
            </span>
          </Linha>
          <Consequencia cor="amb">{INSUMO_PARA_REVISAO_CRC}</Consequencia>
        </Card>

        <Passo>Fica guardado, fora da soma</Passo>
        <Card>
          <Linha rotulo="Seguros (MIP e DFI)">
            <span className="mono">{formatarBRL(valores.segurosCentavos)}</span>
          </Linha>
          <Linha rotulo="Taxas + FCVS">
            <span className="mono">{formatarBRL(valores.taxasFcvsCentavos)}</span>
          </Linha>
          <Linha rotulo="Diferença Teórico / Pago">
            <span className="mono">
              {formatarBRL(valores.diferencaTeoricoPagoCentavos)}
            </span>
          </Linha>
          <Dica>
            <Chip cor="amb">classificação com o seu contador</Chip>{" "}
            {RUBRICA_EM_ABERTO}
          </Dica>
          <Linha rotulo="Mora">
            <span className="mono">{formatarBRL(valores.moraCentavos)}</span>
          </Linha>
          <Linha rotulo="Multa">
            <span className="mono">{formatarBRL(valores.multaCentavos)}</span>
          </Linha>
          <Dica>Mora e multa são penalidade — penalidade nunca é custo.</Dica>
          <Consequencia cor="amb">{GUARDADO_NAO_E_DESCARTADO}</Consequencia>
        </Card>

        <Passo>Informativo</Passo>
        <Card>
          <Linha rotulo={`Saldo devedor em 31/12/${anoBase}`}>
            <span className="mono">
              {formatarBRL(valores.saldoDevedorCentavos)}
            </span>
          </Linha>
          <Consequencia cor="amb">{SALDO_DEVEDOR_INFORMATIVO}</Consequencia>
        </Card>

        <Passo>Documento</Passo>
        <Card>
          <Dica>
            {arquivo?.name} — Extrato do Imposto de Renda · exercício{" "}
            {anoBase + 1} · ano-base {anoBase}
          </Dica>
        </Card>
      </Corpo>
      <Rodape>
        <Botao
          variante="primary"
          onClick={() => void gravar()}
          disabled={fase.nome === "salvando" || !podeGravar}
        >
          {fase.nome === "salvando"
            ? "Gravando…"
            : `Gravar informe de ${anoBase}`}
        </Botao>
        <Botao variante="ghost" onClick={() => setPasso(2)}>
          Voltar aos números
        </Botao>
        <Botao
          variante="ghost"
          onClick={() => router.push(`/obras/${id}/terreno`)}
        >
          Cancelar
        </Botao>
      </Rodape>
    </>
  );
}
