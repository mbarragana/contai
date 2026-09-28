"use client";

/**
 * "Corrigir o valor previsto" — CONTAI-073, spec `design/mocks/CONTAI-073.md`.
 *
 * ⚠️ **MANTÉM O MESMO AGENDAMENTO**, como "Mudou a data": mesmo id, mesmos
 * vínculos, mesma data, mesma nota de origem. O valor anterior vai para
 * `compromisso_valor_historico` — tabela SEPARADA da de data, porque a contagem
 * de linhas daquela é o "adiado N×" exibido na home (critério 20).
 *
 * ⚠️ **SEM IMPACTO FISCAL** (Gate Fiscal do ticket, parecer
 * `2026-08-18-compromisso-versus-pagamento.md` §1): valor previsto não compõe
 * custo de aquisição (regime de caixa — a chave é `pagamento.data_pagamento`)
 * nem base de aferição INSS. A frase de fechamento do resumo é a mesma `Dica`
 * que já existe no card "O que isso muda hoje" do detalhe — texto em produção,
 * não texto fiscal novo.
 *
 * ⚠️ **ROTA PRÓPRIA, não unificada com `/data`** (Out of Scope do ticket):
 * "uma ação por rota" é o padrão já em uso na entidade (`data/`, `cancelar/`,
 * `confirmar/`), e `/data` já bifurca por cartão/não-cartão.
 *
 * Cenário: **gestão** (em casa, sentado). O "Teste do Canteiro" não se aplica;
 * 375px não é piso obrigatório, mas a tela não quebra nele — é o mesmo shell de
 * `/data` e `/cancelar`.
 */

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CampoTexto } from "@/app/_components/campos";
import {
  CabecalhoDaTela,
  ColunaDeDetalhe,
  RodapeDeAcao,
} from "@/app/_components/detalhe";
import {
  Banner,
  BotaoLink,
  BotaoSalvar,
  Card,
  Carregando,
  Dica,
  EstadoErro,
  Linha,
} from "@/app/_components/ui";
import {
  carregarCompromisso,
  carregarPainel,
  classificarErro,
  corrigirValorPrevisto,
  ehErroDeSaldoJaPago,
  mensagemDeErroDeGravacao,
  type ErroDeTela,
} from "@/lib/data";
import {
  pagoDoCompromisso,
  podeCorrigirValor,
  preposicaoDeTempo,
} from "@/lib/fiscal/compromisso";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import type { Compromisso } from "@/lib/types";

/**
 * O texto do §7 do spec, para a recusa da guarda de saldo reconferida no banco:
 * a única falha de gravação desta tela com causa NOMEÁVEL.
 */
const ERRO_CORRIDA_COM_PAGAMENTO =
  "O valor não foi salvo — um pagamento pode ter sido registrado contra este " +
  "agendamento enquanto você editava. Recarregue a tela e confira o valor já " +
  "pago antes de tentar de novo.";

export default function CorrigirValorPrevisto() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [carregado, setCarregado] = useState<{
    compromisso: Compromisso;
    pagoCentavos: number;
  } | null>(null);
  const [erroCarregar, setErroCarregar] = useState<ErroDeTela | null>(null);
  const [tentativa, setTentativa] = useState(0);
  // ⚠️ Os DOIS nascem VAZIOS (critério 11). Nenhum é sugerido nem pré-marcado:
  // o valor novo não é afirmado por documento nenhum, e o motivo é o que só o
  // Mateus sabe. Campo vazio pergunta; campo preenchido afirma.
  const [texto, setTexto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const hoje = hojeIso();

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const compromisso = await carregarCompromisso(id);
        // O painel é de onde saem os pagamentos ligados, como no detalhe: a
        // leitura é de mão única — o painel NÃO conhece compromisso.
        const painel = await carregarPainel(compromisso.obraId);
        if (cancelado) return;
        setCarregado({
          compromisso,
          pagoCentavos: pagoDoCompromisso(compromisso, painel.pagamentos),
        });
      } catch (e) {
        if (!cancelado) setErroCarregar(classificarErro(e));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setErroCarregar(null);
    setCarregado(null);
    setTentativa((t) => t + 1);
  }, []);

  const c = carregado?.compromisso ?? null;
  const pago = carregado?.pagoCentavos ?? 0;
  const atual = c?.valorPrevistoCentavos ?? 0;
  const saldoAtual = Math.max(0, atual - pago);

  // A precedência dos 5 erros do §5 do spec mora em `lib/fiscal/compromisso.ts`,
  // com teste. A tela só decide ONDE cada mensagem aparece.
  const permissao = c
    ? podeCorrigirValor({
        situacao: c.situacao,
        atualCentavos: atual,
        pagoCentavos: pago,
        texto,
        motivo,
      })
    : null;

  const erroDoValor =
    permissao && !permissao.ok && permissao.recusa !== "sem_motivo"
      ? permissao.motivo
      : null;
  const podeSalvar = permissao?.ok === true;
  const novoCentavos = permissao?.ok ? permissao.valorNovoCentavos : null;
  const saldoNovo =
    novoCentavos === null ? null : Math.max(0, novoCentavos - pago);

  async function salvar() {
    if (!c || !permissao?.ok) return;
    setSalvando(true);
    setErro(null);
    try {
      await corrigirValorPrevisto({
        compromissoId: c.id,
        valorNovoCentavos: permissao.valorNovoCentavos,
        motivo,
      });
      // Sem tela de sucesso própria (§8): o detalhe já mostra o valor novo e a
      // linha nova do histórico — mesma decisão de `mudarDataPrevista`.
      router.push(`/compromisso/${c.id}`);
    } catch (e) {
      // A guarda de saldo reconferida no banco tem causa nomeável, e a tela a
      // nomeia; qualquer outra falha cai no texto genérico, que já é claro o
      // bastante para não gravar nada e permitir nova tentativa.
      setErro(
        ehErroDeSaldoJaPago(e)
          ? ERRO_CORRIDA_COM_PAGAMENTO
          : mensagemDeErroDeGravacao(e, "no valor previsto do agendamento"),
      );
      setSalvando(false);
    }
  }

  return (
    <>
      <CabecalhoDaTela
        titulo="Corrigir o valor previsto"
        sub={c?.favorecidoNome ?? undefined}
      />
      <ColunaDeDetalhe>
        {erroCarregar ? (
          <EstadoErro erro={erroCarregar} onTentarDeNovo={tentarDeNovo} />
        ) : null}
        {!c && !erroCarregar ? (
          <Carregando rotulo="Carregando o agendamento" />
        ) : null}

        {/* ⚠️ Guarda de SITUAÇÃO (critério 13): por URL direta dava para chegar
            aqui num agendamento já quitado ou já cancelado. Fato consumado não
            se reescreve — mesma doutrina de `/data` e `/cancelar`. Nenhum campo
            aparece, e o rodapé continua renderizado: nunca tela muda, nunca
            crash. */}
        {c && c.situacao !== "aberto" ? (
          <Banner cor="amb" role="status">
            <strong>
              Este agendamento já foi respondido
              {c.situacao === "quitado"
                ? " — ele foi pago"
                : " — foi marcado como não vai ser pago"}
              .
            </strong>{" "}
            Não há o que corrigir de valor por aqui.
          </Banner>
        ) : null}

        {c && c.situacao === "aberto" ? (
          <>
            <Card className="border-dashed border-amb">
              <Linha rotulo="Valor previsto atual">
                <span className="mono text-mut">~ {formatarBRL(atual)}</span>
              </Linha>
              <Linha rotulo="Hoje está">
                <strong>{preposicaoDeTempo(c, hoje)}</strong>
              </Linha>
            </Card>

            {/* §4(a) — banner PERSISTENTE de pagamento parcial (critério 14):
                visível antes de qualquer digitação, porque ele não fala do que
                foi digitado, fala do que já saiu da conta. */}
            {pago > 0 ? (
              <Banner cor="amb" role="status">
                <strong>
                  Já pago {formatarBRL(pago)} contra este agendamento.
                </strong>{" "}
                O valor previsto só pode subir a partir daqui — abaixo disso o
                saldo zeraria sem explicação nenhuma.
              </Banner>
            ) : null}

            {erro ? (
              <Banner cor="red" role="alert">
                {erro}
              </Banner>
            ) : null}

            <Card>
              <CampoTexto
                campo="fValorNovo"
                rotulo="Novo valor previsto"
                valor={texto}
                onChange={setTexto}
                inputMode="decimal"
                placeholder="0,00"
                erro={erroDoValor ?? undefined}
              />
              <Dica>
                Digite o novo valor previsto. Nada muda até você salvar.
              </Dica>
            </Card>

            <Card>
              <CampoTexto
                campo="fMotivo"
                rotulo="Motivo da correção"
                valor={motivo}
                onChange={setMotivo}
                placeholder="Digitei errado — a parcela é maior"
              />
              <Dica>
                Campo obrigatório. Sem efeito fiscal, mas fica registrado por que
                o valor mudou.
              </Dica>
            </Card>

            {/* §6 — o resumo É a confirmação: clicar em Salvar grava direto, sem
                modal interposto. Só aparece quando o valor está válido E o
                motivo tem conteúdo. */}
            {podeSalvar && novoCentavos !== null ? (
              <Banner cor="amb" role="status">
                <strong>
                  Valor previsto: de {formatarBRL(atual)} para{" "}
                  {formatarBRL(novoCentavos)}.
                </strong>{" "}
                {pago > 0 && saldoNovo !== null ? (
                  <>
                    Saldo passa de {formatarBRL(saldoAtual)} para{" "}
                    {formatarBRL(saldoNovo)}.{" "}
                  </>
                ) : null}
                Sem impacto fiscal — é previsão, não custo: vai continuar assim
                até o dinheiro sair.
              </Banner>
            ) : null}
          </>
        ) : null}
      </ColunaDeDetalhe>

      <RodapeDeAcao>
        <BotaoSalvar
          ocupado={salvando}
          variante="primary"
          onClick={salvar}
          disabled={salvando || !podeSalvar}
        >
          {salvando ? "Salvando…" : "Salvar o novo valor"}
        </BotaoSalvar>
        <BotaoLink href={`/compromisso/${id}`}>Voltar sem salvar</BotaoLink>
      </RodapeDeAcao>
    </>
  );
}
