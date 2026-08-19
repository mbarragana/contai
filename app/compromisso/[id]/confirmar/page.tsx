"use client";

/**
 * CONFIRMAR O PAGAMENTO de um agendamento — CONTAI-019, critérios 12 a 17,
 * 28 a 30, 44 e 45.
 *
 * ⚠️ **O CAMPO DE DATA NASCE VAZIO** (critério 17). O mock v2 ainda o
 * pré-preenche com a data prevista, e **isso é o defeito, não o requisito** —
 * o próprio `designer` chamou de "o defeito mais caro deste desenho", porque o
 * ticket original apontava como mitigação do pre-mortem justamente o critério
 * que causava o risco.
 *
 * A razão é a decisão nº 1 do fechamento de 18/08, e ela distingue os dois
 * campos: o VALOR vem pré-preenchido porque **o documento afirma o valor** — é
 * fato documentado. **A data prevista não é afirmada por documento nenhum**: é
 * palpite, e só o extrato sabe quando o dinheiro saiu. Preencher afirma fato
 * inexistente.
 *
 * A opção "manter o previsto exigindo um toque de confirmação" foi descartada
 * como **pior que pré-preencher**: é máquina de habituação — ele confirma o
 * default com a mesma mão, agora com a sensação de ter conferido.
 *
 * A linha que separa o permitido do proibido: **default de navegação sim,
 * default de valor não**. O date picker pode abrir no mês corrente; nada é
 * gravado até ele escolher o dia. **Não existe atalho "hoje"** nesta tela.
 *
 * ⚠️ **Nenhum caminho de código grava a data prevista** — ela aparece só como
 * referência read-only, cinza e com `~`.
 */

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CampoArquivo, CampoTexto } from "@/app/_components/campos";
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
  carregarCompromisso,
  carregarFavorecido,
  carregarPainel,
  classificarErro,
  criarPagamento,
  mensagemDeErro,
  quitarCompromisso,
  registrarDiferenca,
  subirParaAcervo,
  type ErroDeTela,
} from "@/lib/data";
import { preposicaoDeTempo, saldoDoCompromisso } from "@/lib/fiscal/compromisso";
import { formatarDataBR } from "@/lib/fiscal/obra";
import {
  DATA_QUE_VALE_PARA_O_CUSTO,
  ehDataValida,
  rotulosPagoSemComprovante,
  STATUS_PAGAMENTO_AVULSO,
  textoDiferencaSemExplicacao,
} from "@/lib/fiscal/pagamento";
import { hojeIso } from "@/lib/hoje";
import { centavosParaInput, formatarBRL, parseValorInput } from "@/lib/money";
import type { Compromisso, Pagamento, TipoFavorecido } from "@/lib/types";

/**
 * ⚠️ **Sem default e sem pré-seleção** (critério 13, adendo §D). `null` é o
 * estado inicial e o botão de gravar fica desabilitado enquanto ele durar:
 * "nenhum dos dois erros é mais barato, então não há default seguro para onde
 * cair — assumir desconto fecha um compromisso ainda devido e MATA O ALERTA;
 * assumir parcial deixa um saldo fantasma que trava o relatório anual".
 */
type EscolhaMenor = "quita" | "falta" | null;

export default function ConfirmarPagamento() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hoje = hojeIso();

  const [compromisso, setCompromisso] = useState<Compromisso | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [tipoFavorecido, setTipoFavorecido] = useState<TipoFavorecido | null>(null);
  const [erroCarregar, setErroCarregar] = useState<ErroDeTela | null>(null);

  /** ⚠️ VAZIA. Ver o cabeçalho do arquivo. */
  const [data, setData] = useState("");
  const [valor, setValor] = useState("");
  const [encargos, setEncargos] = useState("");
  const [escolhaMenor, setEscolhaMenor] = useState<EscolhaMenor>(null);
  const [dataSaldo, setDataSaldo] = useState("");
  const [saldoSemData, setSaldoSemData] = useState(false);
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  /**
   * ⚠️ **O RETRY RETOMA, NUNCA RECOMEÇA** (Gate 2 do CONTAI-019, B4).
   *
   * A gravação são quatro passos em quatro chamadas — não existe transação
   * multi-statement pelo PostgREST. Antes disto, uma falha em qualquer um
   * deles devolvia ao mesmo botão, e o toque seguinte **re-executava
   * `criarPagamento`**: nascia um SEGUNDO pagamento real e o primeiro ficava
   * órfão, como pendência vermelha, **para sempre** — o app não apaga nada
   * (acervo append-only, CONTAI-009) e a correção do CONTAI-021 não existe.
   * Com favorecido PF o dano sai do app: o desembolso duplicado entra na ficha
   * **Pagamentos Efetuados**, CPF por CPF.
   *
   * Cada passo bem-sucedido fica registrado aqui, e o retry pula o que já
   * passou.
   */
  const [progresso, setProgresso] = useState<{
    comprovanteEnviado: boolean;
    comprovantePath: string | null;
    pagamentoId: string | null;
    diferencaGravada: boolean;
  }>({
    comprovanteEnviado: false,
    comprovantePath: null,
    pagamentoId: null,
    diferencaGravada: false,
  });

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const c = await carregarCompromisso(id);
        const painel = await carregarPainel(c.obraId);
        if (cancelado) return;
        setCompromisso(c);
        setPagamentos(painel.pagamentos.filter((p) => c.pagamentoIds.includes(p.id)));
        // ⚠️ O tipo vem da TABELA `favorecido`, não de outros pagamentos dele.
        // Derivar de pagamentos errava exatamente no PRIMEIRO pagamento a um
        // PJ: caía em `null` e a tela saía VERMELHA pedindo um CNPJ que já
        // estava cadastrado. O §G.3 reserva o vermelho ao favorecido **não
        // identificado** — este está identificado.
        setTipoFavorecido(
          c.favorecidoId === null
            ? null
            : ((await carregarFavorecido(c.favorecidoId))?.tipo ?? null),
        );
        // ⚠️ O VALOR vem pré-preenchido — o documento afirma o valor. A DATA
        // não: ver o cabeçalho. São os dois campos obrigatórios do critério 45.
        setValor(
          centavosParaInput(
            saldoDoCompromisso(c, painel.pagamentos) || c.valorPrevistoCentavos,
          ),
        );
      } catch (e) {
        if (!cancelado) setErroCarregar(classificarErro(e));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id]);

  const pagoCentavos = parseValorInput(valor);
  const encargosCentavos = encargos.trim() === "" ? 0 : parseValorInput(encargos);
  const previstoCentavos = compromisso
    ? saldoDoCompromisso(compromisso, pagamentos) ||
      compromisso.valorPrevistoCentavos
    : 0;

  const diferenca = pagoCentavos === null ? 0 : pagoCentavos - previstoCentavos;
  const pagouMais = diferenca > 0;
  const pagouMenos = diferenca < 0;

  /**
   * O que sobra depois dos encargos identificados. Fica FORA do custo enquanto
   * não houver resposta — direção segura, subestima (§F.2).
   */
  const naoExplicadoCentavos = useMemo(() => {
    if (!pagouMais) return 0;
    return Math.max(0, diferenca - (encargosCentavos ?? 0));
  }, [pagouMais, diferenca, encargosCentavos]);

  const dataNoFuturo = data !== "" && ehDataValida(data) && data > hoje;

  /**
   * ⚠️ Botão DESABILITADO enquanto a data estiver vazia (critério 17), e
   * enquanto a escolha do valor menor não for feita (critério 13).
   */
  const podeSalvar =
    data !== "" &&
    ehDataValida(data) &&
    !dataNoFuturo &&
    pagoCentavos !== null &&
    pagoCentavos > 0 &&
    (!pagouMais || encargosCentavos !== null) &&
    (!pagouMenos || escolhaMenor !== null) &&
    (!pagouMenos || escolhaMenor !== "falta" || saldoSemData || dataSaldo !== "");

  async function salvar() {
    if (!compromisso || !podeSalvar || pagoCentavos === null) return;
    setSalvando(true);
    setErro(null);

    // Cópia local porque `setProgresso` é assíncrono: os passos seguintes
    // deste mesmo `salvar` precisam enxergar o que o anterior acabou de fazer.
    let feito = progresso;
    const avancar = (parcial: Partial<typeof progresso>) => {
      feito = { ...feito, ...parcial };
      setProgresso(feito);
    };

    try {
      // PASSO 1 · o comprovante NÃO bloqueia (critério 16): *nunca recuse o
      // registro de um fato consumado.* Sem ele o pagamento grava, não entra
      // no custo confirmado e vira a pendência "pago sem comprovante".
      if (!feito.comprovanteEnviado) {
        avancar({
          comprovanteEnviado: true,
          comprovantePath: comprovante
            ? await subirParaAcervo(comprovante, "comprovante")
            : null,
        });
      }

      // PASSO 2 · confirmar CRIA UM PAGAMENTO (critério 12) — não converte o
      // agendamento. Dois registros distintos com vínculo (parecer §3).
      //
      // ⚠️ A guarda `=== null` é o coração do B4: este é o passo que, repetido,
      // duplica dinheiro num acervo que não apaga.
      if (feito.pagamentoId === null) {
        avancar({
          pagamentoId: await criarPagamento({
            obra_id: compromisso.obraId,
            favorecido_id: compromisso.favorecidoId,
            valorCentavos: pagoCentavos,
            // ⚠️ A DATA QUE VAI PARA O BANCO É A DIGITADA. A prevista é
            // descartada na gravação — não há caminho de código que a grave.
            data_pagamento: data,
            // `origem` e `meio` são enums distintos com os mesmos três
            // valores, e este ramo é no-op HOJE: `origem = 'cartao'` não é
            // alcançável, porque a compra no cartão é recusada na entrada
            // (critérios 25-27). Quando o `CONTAI-022` abrir o fluxo da
            // fatura, é aqui que `data_compra` deixa de ser `null` — a linha
            // fica como marcação do ponto, não como conversão.
            meio: compromisso.origem === "cartao" ? "cartao" : compromisso.origem,
            data_compra: null,
            comprovante_path: feito.comprovantePath,
            status: STATUS_PAGAMENTO_AVULSO,
          }),
        });
      }

      // PASSO 3 · a composição do desembolso, quando existe. Gravada UMA vez;
      // só a resolução muda depois (critério 32). `pagamento_diferenca` tem o
      // `pagamento_id` como PK, então repetir aqui daria 23505 — o `feito`
      // evita transformar isso em erro de tela.
      if (
        !feito.diferencaGravada &&
        ((encargosCentavos ?? 0) > 0 || naoExplicadoCentavos > 0)
      ) {
        await registrarDiferenca({
          pagamentoId: feito.pagamentoId!,
          encargosCentavos: encargosCentavos ?? 0,
          naoExplicadoCentavos,
        });
        avancar({ diferencaGravada: true });
      }

      // PASSO 4 · ⚠️ `quitaIntegralmente` é DECISÃO HUMANA, nunca cálculo.
      // Pagou igual ou mais: quita. Pagou menos: é o que ele escolheu, sem
      // default. É idempotente por construção — o vínculo é upsert com
      // `ignoreDuplicates` e o `update` da situação é o mesmo valor.
      await quitarCompromisso({
        compromisso,
        pagamento: { id: feito.pagamentoId!, obraId: compromisso.obraId },
        quitaIntegralmente: !pagouMenos || escolhaMenor === "quita",
        ...(pagouMenos && escolhaMenor === "falta"
          ? { novaDataPrevista: saldoSemData ? null : dataSaldo }
          : {}),
      });

      router.push(`/pagamento/${feito.pagamentoId!}`);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  if (!compromisso) {
    return (
      <>
        <AppBar titulo="Registrar o pagamento" />
        <Corpo>
          {erroCarregar ? (
            <EstadoErro erro={erroCarregar} />
          ) : (
            <Carregando rotulo="Carregando o agendamento" />
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href="/">Voltar ao início</BotaoLink>
        </Rodape>
      </>
    );
  }

  const rotulosComprovante = rotulosPagoSemComprovante(tipoFavorecido);

  return (
    <>
      <AppBar
        titulo="Registrar o pagamento"
        sub={`${compromisso.favorecidoNome ?? "favorecido"} · ${preposicaoDeTempo(compromisso, hoje)}`}
      />
      <Corpo>
        {erro ? (
          <Banner cor="red" role="alert">
            {erro}
            {progresso.pagamentoId !== null ? (
              <>
                {" "}
                <strong>
                  O pagamento já está salvo — tocar de novo NÃO grava um
                  segundo.
                </strong>{" "}
                Falta só ligá-lo a este agendamento, e é isso que o botão faz
                agora.
              </>
            ) : null}
          </Banner>
        ) : null}

        {/* ⚠️ O PREVISTO SÓ COMO REFERÊNCIA — read-only, cinza e com `~`. Ele
            nunca é o número que conta (critério 17). */}
        <Card className="border-dashed border-amb">
          <Linha rotulo="Valor previsto">
            <span className="mono text-mut" data-marca="valor-previsto">
              ~ {formatarBRL(previstoCentavos)}
            </span>
          </Linha>
          <Linha rotulo="Era para">
            <span className="text-mut">
              {compromisso.dataPrevista
                ? formatarDataBR(compromisso.dataPrevista)
                : "sem data definida"}
            </span>
          </Linha>
        </Card>

        <Card className="flex flex-col gap-3.5">
          {/* CAMPO 1 DOS DOIS OBRIGATÓRIOS (critério 45). NASCE VAZIO. */}
          <CampoTexto
            rotulo="Data em que o dinheiro saiu"
            tipo="date"
            valor={data}
            onChange={setData}
            // ⚠️ Congela depois que o pagamento entrou no banco: o retry só
            // completa o que falta, e um campo editável aqui ofereceria uma
            // correção que este botão não faz (o acervo não apaga).
            desabilitado={progresso.pagamentoId !== null}
            ajuda={DATA_QUE_VALE_PARA_O_CUSTO}
            erro={
              dataNoFuturo
                ? "Data no futuro — um pagamento só existe com desembolso ocorrido. Troque para o dia em que o dinheiro realmente saiu."
                : undefined
            }
          />

          {/* CAMPO 2 DOS DOIS. Pré-preenchido: o documento afirma o valor. */}
          <CampoTexto
            rotulo="Valor efetivamente pago"
            valor={valor}
            onChange={setValor}
            inputMode="decimal"
            placeholder="0,00"
            desabilitado={progresso.pagamentoId !== null}
          />

          {/* ⚠️ A densidade cresce com a complicação fiscal, NÃO antes dela
              (critério 45): com valor igual ao previsto, esta tela tem dois
              campos e um botão, e nada mais aparece. */}
          {pagouMais ? (
            <div className="flex flex-col gap-2">
              {/* ⚠️ Este banner era a PORTA DE ENTRADA do erro do Gate 2: ele
                  perguntava só "quanto foi juros?", e o que sobrasse virava
                  "sem explicação" — fazendo a PREVISÃO virar o teto do custo
                  quando a previsão é que estava baixa. A pergunta agora tem as
                  duas saídas, e a segunda é dita aqui, antes do campo. */}
              <Banner cor="amb" role="status">
                <strong>
                  Você pagou {formatarBRL(diferenca)} a mais que o previsto.
                </strong>{" "}
                Quanto disso foi juros e multa por atraso? Juros e multa de mora{" "}
                <strong>não compõem custo de aquisição</strong>. Se não houve
                atraso, deixe em zero:{" "}
                <strong>a previsão estar errada é resposta legítima</strong>, e
                você a registra no detalhe do pagamento — o valor pago entra
                inteiro no custo, e quem limita é a nota.
              </Banner>
              <CampoTexto
                rotulo="Juros e multa por atraso"
                valor={encargos}
                onChange={setEncargos}
                inputMode="decimal"
                placeholder="0,00"
              />
              {naoExplicadoCentavos > 0 ? (
                <Banner cor="red" role="status">
                  {/* Texto LITERAL do §F.4, com o valor interpolado. */}
                  {textoDiferencaSemExplicacao(naoExplicadoCentavos)}
                </Banner>
              ) : null}
            </div>
          ) : null}

          {pagouMenos ? (
            <div className="flex flex-col gap-2">
              <Banner cor="amb" role="status">
                <strong>
                  Você pagou {formatarBRL(-diferenca)} a menos que o previsto.
                </strong>{" "}
                O app não tem como saber o que aconteceu. Você é quem diz:
              </Banner>
              {/* ⚠️ DOIS BOTÕES DE MESMO PESO, NENHUM PRÉ-SELECIONADO. Rótulo
                  pelo RESULTADO, nunca pela causa — ele não tem de caracterizar
                  se foi desconto, erro de previsão ou abatimento. */}
              <Botao
                variante={escolhaMenor === "quita" ? "primary" : "ghost"}
                onClick={() => setEscolhaMenor("quita")}
              >
                Quita o agendamento
              </Botao>
              <Botao
                variante={escolhaMenor === "falta" ? "primary" : "ghost"}
                onClick={() => setEscolhaMenor("falta")}
              >
                Falta pagar o resto
              </Botao>
              <Dica>Nenhum vem pré-selecionado, e os dois têm o mesmo peso.</Dica>

              {escolhaMenor === "quita" ? (
                <Dica>
                  O custo do ano é <strong>o pago</strong>. O agendamento fecha
                  sem resíduo — sem saldo e sem pendência pela diferença.
                </Dica>
              ) : null}

              {/* ⚠️ Critério 30: a quitação parcial PEDE a nova data do saldo.
                  Sem isso o saldo nasce vencido-sem-resposta e trava o
                  relatório anual PARA SEMPRE. */}
              {escolhaMenor === "falta" ? (
                <div className="flex flex-col gap-2">
                  <CampoTexto
                    rotulo="Quando você pretende pagar o resto?"
                    tipo="date"
                    valor={dataSaldo}
                    onChange={(v) => {
                      setDataSaldo(v);
                      setSaldoSemData(false);
                    }}
                  />
                  <Botao
                    variante={saldoSemData ? "primary" : "ghost"}
                    onClick={() => {
                      setSaldoSemData(true);
                      setDataSaldo("");
                    }}
                  >
                    Ainda não sei — deixar sem data
                  </Botao>
                  <Dica>
                    <strong>&quot;Ainda não sei&quot; é resposta válida</strong>{" "}
                    e não trava nada — incerteza declarada não é silêncio. O
                    saldo <strong>não é custo de nada</strong> até sair da conta.
                  </Dica>
                </div>
              ) : null}
            </div>
          ) : null}

          <CampoArquivo
            rotulo="Comprovante"
            ajuda="O botão salva mesmo sem ele — o que muda é o estado que nasce."
            accept=".pdf,image/*"
            arquivo={comprovante}
            onChange={setComprovante}
          />
          {comprovante === null ? (
            <Banner cor={rotulosComprovante.gravidade} role="status">
              <strong>Vai salvar assim mesmo.</strong> Fica como{" "}
              <strong>{rotulosComprovante.consequencia}</strong>.
            </Banner>
          ) : null}
        </Card>

        <Card className="border-ink">
          <Passo>O que vai ser salvo</Passo>
          <Linha rotulo="Pagamento, na data acima">
            <span className="mono">
              {pagoCentavos === null ? "—" : formatarBRL(pagoCentavos)}
            </span>
          </Linha>
          {(encargosCentavos ?? 0) > 0 ? (
            <Linha rotulo="Juros e multa — registrados, fora do custo">
              <span className="mono">{formatarBRL(encargosCentavos ?? 0)}</span>
            </Linha>
          ) : null}
          {naoExplicadoCentavos > 0 ? (
            <Linha rotulo="Diferença sem explicação — fora do custo">
              <span className="mono text-red">
                {formatarBRL(naoExplicadoCentavos)}
              </span>
            </Linha>
          ) : null}
          <Dica>
            O agendamento <strong>não vira</strong> este pagamento: ele continua
            existindo, ligado a ele.
          </Dica>
        </Card>
      </Corpo>
      <Rodape>
        <Botao variante="primary" onClick={salvar} disabled={salvando || !podeSalvar}>
          {salvando
            ? "Salvando…"
            : progresso.pagamentoId !== null
              ? "Tentar de novo — só falta ligar ao agendamento"
              : data === ""
                ? "Informe a data em que o dinheiro saiu"
                : pagouMenos && escolhaMenor === null
                  ? "Diga se quita ou se falta o resto"
                  : "Salvar pagamento"}
        </Botao>
        {/* Critério 44: sair sem gravar não altera nada e não deixa rascunho. */}
        <BotaoLink href={`/compromisso/${compromisso.id}`}>
          Voltar sem salvar
        </BotaoLink>
      </Rodape>
    </>
  );
}
