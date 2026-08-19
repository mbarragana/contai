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

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const c = await carregarCompromisso(id);
        const painel = await carregarPainel(c.obraId);
        if (cancelado) return;
        setCompromisso(c);
        setPagamentos(painel.pagamentos.filter((p) => c.pagamentoIds.includes(p.id)));
        setTipoFavorecido(
          painel.pagamentos.find((p) => p.favorecidoId === c.favorecidoId)
            ?.favorecidoTipo ?? null,
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
    try {
      // Comprovante NÃO bloqueia (critério 16): *nunca recuse o registro de um
      // fato consumado.* Sem ele o pagamento grava, não entra no custo
      // confirmado e vira a pendência "pago sem comprovante".
      const comprovantePath = comprovante
        ? await subirParaAcervo(comprovante, "comprovante")
        : null;

      // Confirmar CRIA UM PAGAMENTO (critério 12) — não converte o
      // agendamento. Dois registros distintos com vínculo (parecer §3).
      const pagamentoId = await criarPagamento({
        obra_id: compromisso.obraId,
        favorecido_id: compromisso.favorecidoId,
        valorCentavos: pagoCentavos,
        // ⚠️ A DATA QUE VAI PARA O BANCO É A DIGITADA. A prevista é descartada
        // na gravação — não há caminho de código que a grave.
        data_pagamento: data,
        meio: compromisso.origem === "cartao" ? "cartao" : compromisso.origem,
        data_compra: null,
        comprovante_path: comprovantePath,
        status: STATUS_PAGAMENTO_AVULSO,
      });

      // A composição do desembolso, quando existe. Gravada UMA vez; só a
      // resolução muda depois (critério 32).
      if ((encargosCentavos ?? 0) > 0 || naoExplicadoCentavos > 0) {
        await registrarDiferenca({
          pagamentoId,
          encargosCentavos: encargosCentavos ?? 0,
          naoExplicadoCentavos,
        });
      }

      // ⚠️ `quitaIntegralmente` é DECISÃO HUMANA, nunca cálculo. Pagou igual ou
      // mais: quita. Pagou menos: é o que ele escolheu, sem default.
      await quitarCompromisso({
        compromisso,
        pagamento: { id: pagamentoId, obraId: compromisso.obraId },
        quitaIntegralmente: !pagouMenos || escolhaMenor === "quita",
        ...(pagouMenos && escolhaMenor === "falta"
          ? { novaDataPrevista: saldoSemData ? null : dataSaldo }
          : {}),
      });

      router.push(`/pagamento/${pagamentoId}`);
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
          />

          {/* ⚠️ A densidade cresce com a complicação fiscal, NÃO antes dela
              (critério 45): com valor igual ao previsto, esta tela tem dois
              campos e um botão, e nada mais aparece. */}
          {pagouMais ? (
            <div className="flex flex-col gap-2">
              <Banner cor="amb" role="status">
                <strong>
                  Você pagou {formatarBRL(diferenca)} a mais que o previsto.
                </strong>{" "}
                Quanto disso foi juros e multa por atraso? Juros e multa de mora{" "}
                <strong>não compõem custo de aquisição</strong>.
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
