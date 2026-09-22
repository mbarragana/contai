"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  CabecalhoDaTela,
  ColunaDeDetalhe,
} from "@/app/_components/detalhe";
import {
  Banner,
  BotaoLink,
  Card,
  Carregando,
  Chip,
  Consequencia,
  Dica,
  EstadoErro,
  Linha,
} from "@/app/_components/ui";
import { classificarErro, type ErroDeTela } from "@/lib/data";
import {
  carregarSaidaAnual,
  type SaidaAnualDaObra,
} from "@/lib/dados/saida-anual";
import { preposicaoDeTempo } from "@/lib/fiscal/compromisso";
import { formatarBRL } from "@/lib/money";
import { hojeIso } from "@/lib/hoje";
import {
  FORA_DO_CUSTO_CONFIRMADO,
  INSUMO_PARA_REVISAO_CRC,
} from "@/lib/fiscal/terreno";

/**
 * **DISCRIMINAÇÃO DE {ano} — ANTES DE DECLARAR.** Tela 4 do mock `CONTAI-025`
 * v2, fatia 2. É a **primeira saída anual do produto**: antes dela, nenhuma
 * rota gerava texto de declaração nenhum.
 *
 * Cenário: **gestão** — em casa, sentado, revisando antes de preencher a DAA.
 * O **Teste do Canteiro não se aplica** (régua corrigida no `CLAUDE.md` em
 * 18/08); 375px é **piso**, não alvo, e a densidade é deliberada.
 *
 * ⚠️ **A tela não decide nada e não monta argumento nenhum.** Ela chama
 * `carregarSaidaAnual(obraId, ano)` — a porta composta —, e é lá dentro que a
 * porta única (`podeGerarRelatorioAnual`) é consultada e o texto é gerado com
 * a marca que ela devolve. Não existe caminho daqui até o texto que não passe
 * por ali.
 *
 * ⚠️ **CONTAI-046 — por que esta tela NÃO é exceção de largura** (critério 2 do
 * ticket, pergunta que o Gate 0 deixou aberta). A régua é a mesma do
 * `fatura/[id]/alocar` no `CONTAI-044`: a exceção se justifica pela FORMA do
 * conteúdo, nunca por conforto de layout. O bloco copiável é **prosa**, não
 * tabela, e o `<pre>` já é `whitespace-pre-wrap break-words` — ele **quebra**,
 * então nem trunca nem pede scroll horizontal em 640px (regra de legibilidade
 * fiscal do critério 2, atendida sem alargar nada). E alargar teria custo: o
 * achado do Gate 2 do `CONTAI-039` é que texto esticado por 1244px é MENOS
 * legível, e linha longa demais é justamente onde o olho pula uma linha na
 * conferência que esta tela existe para permitir. O que o texto precisa é de
 * quebra fiel e de fonte mono — as duas já estão aqui.
 *
 * ⚠️ **O `ano` vem do PARÂMETRO DE ROTA, e isso não fere o `CONTAI-042` §5.** O
 * `ano` do shell (`useGestao()`) é função pura de `hojeIso()`, calculada uma vez
 * no `ProvedorDeGestao` e **sem setter** — nenhuma tela escreve nele. Abrir a
 * discriminação de um ano anterior não pode, por construção, corromper o ano que
 * o dashboard e `/pendencias` leem depois de voltar: são duas leituras
 * independentes, e só uma delas existe.
 *
 * ⚠️ **Três coisas ficam FORA do bloco copiável, e a separação é fiscal**
 * (decisão de design 5 do mock, Gate Fiscal §3): o que está **dentro** do
 * bloco é texto de declaração; o aviso, a linha do §4.5 e as faltas são
 * **orientação**. Colá-las na ficha seria o app escrevendo na DAA uma frase
 * que não é do contribuinte.
 */

type Fase =
  | { nome: "carregando" }
  | { nome: "erro"; erro: ErroDeTela }
  | { nome: "pronto"; saida: SaidaAnualDaObra };

export default function DiscriminacaoDoAno() {
  const params = useParams<{ id: string; ano: string }>();
  const obraId = params.id;
  /**
   * ⚠️ **Rota malformada não vira `31/12/NaN` num texto de declaração.**
   * `Number("abc")` é `NaN`, e `NaN` atravessava o gerador inteiro em silêncio
   * até sair impresso no bloco copiável. Ano fora da faixa é **erro nomeado**,
   * do mesmo jeito que o informe de ano impossível já é (CONTAI-010).
   */
  const ano = /^\d{4}$/.test(params.ano ?? "") ? Number(params.ano) : null;
  const [fase, setFase] = useState<Fase>({ nome: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const hoje = hojeIso();

  useEffect(() => {
    if (ano === null) return;
    let cancelado = false;
    void (async () => {
      try {
        const saida = await carregarSaidaAnual(obraId, ano);
        if (!cancelado) setFase({ nome: "pronto", saida });
      } catch (erro) {
        if (!cancelado) setFase({ nome: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [obraId, ano, tentativa]);

  const tentarDeNovo = useCallback(() => setTentativa((t) => t + 1), []);

  return (
    <>
      <CabecalhoDaTela
        titulo={ano === null ? "Discriminação" : `Discriminação de ${ano}`}
        sub="Bens e Direitos · antes de declarar"
      />
      <ColunaDeDetalhe>
        {ano === null ? (
          <Banner cor="red" role="alert">
            <strong>Este endereço não diz de que ano é a discriminação.</strong>{" "}
            O ano faz parte do endereço e tem quatro dígitos — sem ele, não há
            texto a gerar. Volte para a obra e escolha o ano.
          </Banner>
        ) : fase.nome === "carregando" ? (
          <Carregando rotulo={`Montando a discriminação de ${ano}`} />
        ) : fase.nome === "erro" ? (
          <EstadoErro erro={fase.erro} onTentarDeNovo={tentarDeNovo} />
        ) : fase.saida.ok === false && fase.saida.faltamResponder.length > 0 ? (
          // ⚠️ O portão TRANSVERSAL (crit. 21 do CONTAI-019): compromisso
          // vencido sem resposta veta as TRÊS saídas anuais, não só esta.
          // Sem a resposta, ninguém sabe a que ano o desembolso pertence.
          <div className="flex flex-col gap-3">
            <Banner cor="red" role="alert">
              <strong data-veto="transversal">
                A discriminação de {ano} não vai ser gerada ainda.
              </strong>{" "}
              {fase.saida.faltamResponder.length === 1
                ? "Um agendamento venceu"
                : `${fase.saida.faltamResponder.length} agendamentos venceram`}{" "}
              sem resposta. Enquanto ninguém disser se o dinheiro saiu, o
              ano-calendário desse valor está em aberto — e ele pode ser deste
              ano ou do anterior.
            </Banner>
            <Card>
              <div className="text-[12px] font-semibold text-mut">
                O que falta responder
              </div>
              {fase.saida.faltamResponder.map((c) => (
                <Linha
                  key={c.id}
                  rotulo={`${c.favorecidoNome ?? "Favorecido não informado"} · ${preposicaoDeTempo(c, hoje)}`}
                >
                  <a className="underline" href={`/compromisso/${c.id}`}>
                    Responder
                  </a>
                </Linha>
              ))}
            </Card>
            <Dica>
              Vale para as três saídas do ano — Bens e Direitos, Pagamentos
              Efetuados e a posição da aferição. A resposta é justamente o dado
              que decide o ano.
            </Dica>
          </div>
        ) : fase.saida.ok === false ? (
          // ⚠️ **CONTAI-033, critério 11** — o segundo veto, e ele é IRMÃO do de
          // cima, não uma variante dele: a causa é outra (nota registrada sem o
          // arquivo no acervo) e o remédio é outro (subir o papel, não responder
          // um agendamento). Só um dos dois é não-vazio de cada vez, porque a
          // porta pura curto-circuita na ordem — o transversal tem precedência.
          //
          // ⚠️ **Este texto NÃO é do parecer** e não finge ser: o §A.7.2 fala da
          // pendência do documento, não deste banner. Ele diz o mesmo fato com
          // as palavras desta tela, sem prometer nada que o parecer não promete
          // (§A.7.5: nenhuma tela afirma que o registro sem arquivo "vale").
          <div className="flex flex-col gap-3">
            <Banner cor="red" role="alert">
              <strong data-veto="sem-arquivo">
                A discriminação de {ano} não vai ser gerada ainda.
              </strong>{" "}
              {fase.saida.semArquivo.length === 1
                ? "Uma nota está"
                : `${fase.saida.semArquivo.length} notas estão`}{" "}
              sem arquivo no acervo. Enquanto o arquivo não chega, o app não
              consegue provar o que{" "}
              {fase.saida.semArquivo.length === 1 ? "ela sustenta" : "elas sustentam"}{" "}
              — e custo sem lastro na declaração é redução indevida de ganho de
              capital.
            </Banner>
            <Card>
              <div className="text-[12px] font-semibold text-mut">
                O que falta anexar
              </div>
              {fase.saida.semArquivo.map((d) => (
                <Linha
                  key={d.id}
                  rotulo={`${d.favorecidoNome ?? "Emitente não informado"} · ${
                    d.valorCentavos === null
                      ? "valor não informado"
                      : formatarBRL(d.valorCentavos)
                  }`}
                >
                  <a className="underline" href={`/documento/${d.id}`}>
                    Abrir a nota
                  </a>
                </Linha>
              ))}
            </Card>
            <Dica>
              Vale para as três saídas do ano — Bens e Direitos, Pagamentos
              Efetuados e a posição da aferição. Peça o arquivo ao emitente
              enquanto ainda há parcela a liberar.
            </Dica>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* ⚠️ INCONDICIONAL (critério 6) e SEMPRE ACIMA do bloco. */}
            <Banner cor="amb" role="status">
              <strong>{fase.saida.discriminacao.aviso}</strong>
            </Banner>

            {/* O que se copia. Nada de orientação aqui dentro. */}
            <Card className="!px-0 !py-0">
              <pre
                data-bloco="copiavel"
                className="mono overflow-x-auto whitespace-pre-wrap break-words px-[14px] py-3 text-[12.5px] leading-[1.55]"
              >
                {fase.saida.discriminacao.blocoCopiavel}
              </pre>
            </Card>
            <button
              type="button"
              className="self-start rounded-lg border border-line px-3 py-1.5 text-[12.5px]"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(fase.saida.ok ? fase.saida.discriminacao.blocoCopiavel : "")
                  .then(() => setCopiado(true))
                  .catch(() => setCopiado(false));
              }}
            >
              {copiado ? "Copiado" : "Copiar o texto"}
            </button>

            {/* ⚠️ A LINHA DO §4.5 — fora do bloco, IMEDIATAMENTE abaixo dele. */}
            {fase.saida.discriminacao.linhaForaDoCusto ? (
              <Consequencia cor="red">
                <span data-linha="§4.5">
                  {fase.saida.discriminacao.linhaForaDoCusto}
                </span>
              </Consequencia>
            ) : null}

            {/* §2.4 — NUNCA um número só. */}
            <Card>
              <div className="text-[12px] font-semibold text-mut">
                Os dois números
              </div>
              <Linha rotulo={`Dispêndios pagos em ${ano}`}>
                <span className="mono">
                  {formatarBRL(
                    fase.saida.discriminacao.totalConfirmadoAnoCentavos,
                  )}
                </span>
              </Linha>
              <Linha rotulo={`Situação em 31/12/${ano}`}>
                <span className="mono">
                  {formatarBRL(fase.saida.discriminacao.acumuladoCentavos)}
                </span>
              </Linha>
              {fase.saida.discriminacao.foraDoCustoConfirmadoQuantidade > 0 ? (
                <>
                  <Linha rotulo={FORA_DO_CUSTO_CONFIRMADO}>
                    <span className="mono text-red">
                      {formatarBRL(
                        fase.saida.discriminacao.foraDoCustoConfirmadoCentavos,
                      )}
                    </span>
                  </Linha>
                  <div className="mt-2 flex items-center gap-2">
                    <Chip cor="red">
                      {fase.saida.discriminacao.foraDoCustoConfirmadoQuantidade}{" "}
                      {fase.saida.discriminacao
                        .foraDoCustoConfirmadoQuantidade === 1
                        ? "lançamento"
                        : "lançamentos"}
                    </Chip>
                    <BotaoLink
                      href={`/obras/${obraId}/terreno/desembolsos`}
                    >
                      Abrir a lista
                    </BotaoLink>
                  </div>
                </>
              ) : null}
            </Card>

            {/* O que o texto NÃO diz — nomeado, nunca placeholder vazio. */}
            <Card>
              <div className="text-[12px] font-semibold text-mut">
                O que este texto não diz
              </div>
              {fase.saida.discriminacao.faltas.map((f) => (
                <p key={f} className="mt-2 text-[12.5px] leading-[1.5]">
                  {f}
                </p>
              ))}
            </Card>

            <Dica>{INSUMO_PARA_REVISAO_CRC}</Dica>
          </div>
        )}
      </ColunaDeDetalhe>
    </>
  );
}
