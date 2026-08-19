"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  AppBar,
  Banner,
  BarraAdicionar,
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
} from "@/app/_components/ui";
import { SugestaoQuitacao } from "@/app/_components/quitacao";
import {
  carregarPagamento,
  carregarPainel,
  classificarErro,
  mensagemDeErro,
  resolverDiferenca,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import { formatarDataBR } from "@/lib/fiscal/obra";
import {
  DATA_QUE_VALE_PARA_O_CUSTO,
  rotulosPagoSemComprovante,
  rotulosPagoSemNota,
  textoDiferencaSemExplicacao,
} from "@/lib/fiscal/pagamento";
import {
  alocarCusto,
  baseDocumentavel,
  type PagamentoAlocado,
} from "@/lib/fiscal/vinculo";
import { formatarBRL } from "@/lib/money";
import type { Documento, Pagamento, ResolucaoDiferenca } from "@/lib/types";

/**
 * O CONJUNTO FECHADO DE RESOLUÇÕES (§F.2), rotulado pelo **resultado, nunca
 * pela causa** — ele não tem de caracterizar juridicamente nada.
 *
 * ⚠️ **"Não sei ainda" é estado permitido e é o único que pode ser inicial**,
 * porque é o único que não afirma nada. "Forçar classificação ensina a
 * inventar dado no campo que sobrou." Por isso não há opção "não sei" na
 * lista: ela É o estado de partida, e a lista só oferece saídas.
 */
const RESOLUCOES: {
  valor: ResolucaoDiferenca;
  rotulo: string;
  efeito: string;
}[] = [
  {
    valor: "nao_compoe_custo",
    rotulo: "Não compõe custo da obra",
    efeito:
      "Juros, multa, taxa ou item que não foi incorporado ao imóvel. Fica fora do custo definitivamente, registrado — e sem pendência: não há o que cobrar.",
  },
  {
    valor: "falta_documento",
    // ⚠️ Critério 31d: esta opção FICA, e a tela NÃO promete aumento no ato.
    // Tirar o botão é o mais caro dos dois erros: encargo fica fora para
    // sempre e sem pendência, enquanto principal sem nota é custo real que
    // vira "pago sem nota" — cobrança a fazer enquanto ainda há parcela a
    // liberar (§F.1).
    rotulo: "É da obra e falta o documento",
    efeito:
      "O número não se move hoje — quem limita o custo é a nota. Ele passa a contar como pago sem nota, e entra no custo quando houver nota no seu CPF que o cubra.",
  },
  {
    valor: "multiplos_documentos",
    rotulo: "O pagamento cobriu mais de um documento",
    efeito:
      "É o único caminho que aumenta o custo no ato, e ele se resolve por vínculo, não por classificação: ligue a outra nota a este pagamento.",
  },
  {
    // ⚠️ QUINTA RESOLUÇÃO — acrescentada pelo `contador` no Gate 2 do
    // CONTAI-019, `[Certain]`, fechando uma lacuna do próprio parecer.
    //
    // Sem ela, um pagamento maior que o PREVISTO e sem encargo nenhum não
    // tinha resposta verdadeira: nenhuma das quatro anteriores descrevia
    // "o previsto é que estava errado". O custo ficava preso no valor
    // previsto e subia uma pendência vermelha sem saída — e vermelho sem
    // resposta correta é o alarme que se aprende a ignorar.
    valor: "previsao_errada",
    rotulo: "A previsão é que estava errada — o valor pago é o certo",
    efeito:
      "O valor pago entra inteiro no custo, e quem volta a limitar é a nota — nunca a previsão. Não fica resíduo nem pendência.",
  },
  {
    valor: "erro_digitacao",
    rotulo: "Errei o valor digitado",
    efeito:
      "Isto não é classificação fiscal, é correção do registro com rastro — e a correção ainda não existe no app (CONTAI-021). Até lá a diferença continua fora do custo.",
  },
];

const NOME_TIPO: Record<Documento["tipo"], string> = {
  nf_material: "NF de material",
  nf_servico: "NF de serviço",
  boleto: "Boleto",
};

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      pagamento: Pagamento;
      painel: PainelDados;
      alocado: PagamentoAlocado | undefined;
      ligados: Documento[];
    };

/**
 * Detalhe do pagamento — critério 3 do CONTAI-018.
 *
 * Até aqui só existia `/pagamento/[id]/obra`: metade do parque de registros do
 * Mateus nasceu como PIX avulso e não tinha porta nenhuma para ganhar a nota
 * depois. Esta tela é essa porta, e o seletor inverso sai dela.
 */
export default function DetalhePagamento() {
  const { id } = useParams<{ id: string }>();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [resolvendo, setResolvendo] = useState(false);
  const [erroResolver, setErroResolver] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const pagamento = await carregarPagamento(id);
        const painel = await carregarPainel(pagamento.obraId);
        if (cancelado) return;
        const alocacao = alocarCusto(painel);
        setEstado({
          fase: "pronto",
          pagamento,
          painel,
          alocado: alocacao.porPagamento.get(pagamento.id),
          ligados: painel.documentos.filter((d) =>
            pagamento.documentoIds.includes(d.id),
          ),
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
    setTentativa((t) => t + 1);
  }, []);

  /**
   * A resolução é ato do Mateus, e **resolver NÃO apaga o registro da
   * diferença** (critério 32, acervo append-only do CONTAI-009): os valores
   * continuam gravados; o que entra é a classificação, com a data dela.
   */
  const resolver = useCallback(
    async (pagamentoId: string, resolucao: ResolucaoDiferenca) => {
      setResolvendo(true);
      setErroResolver(null);
      try {
        await resolverDiferenca(pagamentoId, resolucao);
        setEstado({ fase: "carregando" });
        setTentativa((t) => t + 1);
      } catch (e) {
        setErroResolver(mensagemDeErro(e));
      } finally {
        setResolvendo(false);
      }
    },
    [],
  );

  if (estado.fase !== "pronto") {
    return (
      <>
        <AppBar titulo="Pagamento" />
        <Corpo>
          {estado.fase === "carregando" ? (
            <Carregando rotulo="Carregando o pagamento" />
          ) : (
            <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
          )}
        </Corpo>
        <BarraAdicionar
          voltar={<BotaoLink href="/">Voltar ao início</BotaoLink>}
        />
      </>
    );
  }

  const p = estado.pagamento;
  const comprovado = estado.alocado?.comprovadoCentavos ?? 0;
  /** A EXPOSIÇÃO fiscal: quanto saiu e não está no custo. */
  const semNota = estado.alocado?.semNotaCentavos ?? p.valorCentavos;
  /**
   * ⚠️ Quanto deste pagamento ainda PODE receber uma nota — pergunta
   * DOCUMENTAL, não fiscal, e as duas divergem exatamente no caso que o Gate 2
   * pegou: **sem comprovante, o elegível é 0 por construção**, logo `semNota`
   * é 0, e o botão "Ligar a uma nota" desaparecia. O pagamento sem comprovante
   * E sem nota mostrava "nenhum documento ligado" e nenhuma ação para ligar —
   * a home levava até aqui e a tela não tinha saída.
   */
  const descoberto = Math.max(0, baseDocumentavel(p) - comprovado);
  const rotulos = rotulosPagoSemNota(p.favorecidoTipo);

  return (
    <>
      <AppBar
        titulo="Pagamento"
        sub={`${p.favorecidoNome ?? "favorecido não informado"} · ${estado.painel.obra.nome}`}
      />
      <Corpo>
        <Card>
          <Linha rotulo="Valor">
            <span className="mono">{formatarBRL(p.valorCentavos)}</span>
          </Linha>
          <Linha rotulo="Data do pagamento">
            <span className="mono">{formatarDataBR(p.dataPagamento)}</span>
          </Linha>
          <Linha rotulo="Meio">{p.meio.toUpperCase()}</Linha>
          <Linha rotulo="Comprovante">
            {p.comprovantePath ? (
              <span className="font-semibold text-grn">anexado ✓</span>
            ) : (
              <span className="font-semibold text-red">sem comprovante</span>
            )}
          </Linha>
          {/* Item (f) do Gate 1b + decisão 10 de 18/08: "regime de caixa" sai
              da tela (critério 7) e entra a frase do §F.5, COM o exemplo — é
              ele que ensina, e a sentença abstrata sozinha é esquecível. */}
          <Dica>{DATA_QUE_VALE_PARA_O_CUSTO}</Dica>
        </Card>

        {comprovado > 0 ? (
          <Card className="border-grn">
            <Chip cor="grn">Custo comprovado</Chip>
            <div className="mono mt-1.5 text-[26px] font-bold tracking-tight">
              {formatarBRL(comprovado)}
            </div>
            <Dica>
              entra no custo de aquisição de {p.dataPagamento.slice(0, 4)} —
              pela data do pagamento
            </Dica>
          </Card>
        ) : null}

        {semNota > 0 ? (
          <Card className="border-red">
            <Chip cor="red">{rotulos.chip}</Chip>
            <div className="mono mt-1.5 text-[19px] font-bold">
              {formatarBRL(semNota)}
            </div>
            <Consequencia cor="red">{rotulos.consequencia}</Consequencia>
            <div className="mt-2.5">
              <BotaoLink href={`/pagamento/${p.id}/ligar`} variante="primary">
                Ligar a uma nota
              </BotaoLink>
            </div>
          </Card>
        ) : null}

        <Card>
          <div className="font-semibold">Documentos deste pagamento</div>
          {estado.ligados.length === 0 ? (
            <Dica>Nenhum documento ligado a este pagamento.</Dica>
          ) : (
            estado.ligados.map((d) => (
              <div key={d.id} className="mt-2 border-t border-line pt-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px]">
                    {NOME_TIPO[d.tipo]} · {d.favorecidoNome ?? "sem favorecido"}
                  </span>
                  <span className="mono flex-none text-[13.5px]">
                    {formatarBRL(d.valorCentavos ?? 0)}
                  </span>
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  <BotaoLink href={`/documento/${d.id}`}>Ver o documento</BotaoLink>
                  <BotaoLink href={`/documento/${d.id}/desligar?pagamento=${p.id}`}>
                    Desligar esta nota
                  </BotaoLink>
                </div>
              </div>
            ))
          )}
          {/* ⚠️ A PORTA QUE FALTAVA. Quando a exposição é 0 mas ainda cabe
              nota — o caso do pagamento sem comprovante —, a cobrança da nota
              precisa continuar tendo botão. `semNota > 0` já traz o seu no
              cartão vermelho acima; aqui fica o caso que ele não cobre. */}
          {semNota === 0 && descoberto > 0 ? (
            <div className="mt-2.5">
              <BotaoLink href={`/pagamento/${p.id}/ligar`} variante="primary">
                Ligar a uma nota
              </BotaoLink>
            </div>
          ) : null}

          {/* `descoberto`, e não `semNota`: um pagamento sem comprovante ligado
              só a um boleto tem exposição 0 (elegível 0) e NÃO está coberto por
              documento hábil nenhum — o verde ali seria mentira. */}
          {descoberto === 0 && estado.ligados.length > 0 ? (
            <Banner cor="grn" role="status">
              Este pagamento está coberto por documento hábil — ele e a nota são{" "}
              <strong>uma despesa só</strong>.
            </Banner>
          ) : null}
        </Card>

        {/* ⚠️ PAGO SEM COMPROVANTE (critérios 46-47). O peso muda com o
            favorecido, e a diferença é fiscal: para PF o comprovante é
            CONSTITUTIVO do custo. */}
        {p.comprovantePath === null ? (
          <Card
            className={
              rotulosPagoSemComprovante(p.favorecidoTipo).gravidade === "red"
                ? "border-red"
                : "border-amb"
            }
          >
            <Chip cor={rotulosPagoSemComprovante(p.favorecidoTipo).gravidade}>
              {rotulosPagoSemComprovante(p.favorecidoTipo).chip}
            </Chip>
            <Consequencia
              cor={rotulosPagoSemComprovante(p.favorecidoTipo).gravidade}
            >
              {rotulosPagoSemComprovante(p.favorecidoTipo).consequencia}
            </Consequencia>
            <Dica>
              O pagamento está registrado — o botão nunca recusa um fato
              consumado. O que falta é a prova, e ela é o documento mais
              perecível do acervo.
            </Dica>
          </Card>
        ) : null}

        {/* ⚠️ A DIFERENÇA, e as QUATRO resoluções do §F.2. */}
        {p.naoExplicadoCentavos > 0 || p.encargosCentavos > 0 ? (
          <Card
            className={
              p.naoExplicadoCentavos > 0 &&
              (p.resolucaoDiferenca === null ||
                p.resolucaoDiferenca === "erro_digitacao")
                ? "border-red"
                : ""
            }
          >
            <Passo>Composição deste desembolso</Passo>
            {p.encargosCentavos > 0 ? (
              <Linha rotulo="Juros e multa — fora do custo">
                <span className="mono">{formatarBRL(p.encargosCentavos)}</span>
              </Linha>
            ) : null}
            {p.naoExplicadoCentavos > 0 ? (
              <Linha rotulo="Diferença registrada">
                <span className="mono">
                  {formatarBRL(p.naoExplicadoCentavos)}
                </span>
              </Linha>
            ) : null}

            {p.naoExplicadoCentavos > 0 &&
            (p.resolucaoDiferenca === null ||
              p.resolucaoDiferenca === "erro_digitacao") ? (
              <>
                {/* Texto LITERAL do §F.4 (critério 31e). */}
                <Consequencia cor="red">
                  {textoDiferencaSemExplicacao(p.naoExplicadoCentavos)}
                </Consequencia>
                {erroResolver ? (
                  <Banner cor="red" role="alert">
                    {erroResolver}
                  </Banner>
                ) : null}
                <Dica>
                  Enquanto você não souber, deixe como está —{" "}
                  <strong>&quot;não sei ainda&quot; é resposta válida</strong>,
                  e é a única que não afirma nada.
                </Dica>
                <div className="mt-2 flex flex-col gap-3">
                  {RESOLUCOES.map((r) => (
                    <div key={r.valor}>
                      <Botao
                        variante="ghost"
                        disabled={resolvendo}
                        onClick={() => void resolver(p.id, r.valor)}
                      >
                        {r.rotulo}
                      </Botao>
                      <Dica>{r.efeito}</Dica>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {p.resolucaoDiferenca !== null &&
            p.resolucaoDiferenca !== "erro_digitacao" ? (
              <Dica>
                Resolvida como{" "}
                <strong>
                  {
                    RESOLUCOES.find((r) => r.valor === p.resolucaoDiferenca)
                      ?.rotulo
                  }
                </strong>
                . O registro da diferença continua aqui — resolver não apaga.
              </Dica>
            ) : null}
          </Card>
        ) : null}

        {/* Sugestão de quitação: DEPOIS do pagamento gravado, e ela nunca
            bloqueou nada (critério 37). */}
        <SugestaoQuitacao pagamento={p} onQuitou={tentarDeNovo} />

        <Card>
          <Linha rotulo="Obra">{estado.painel.obra.nome}</Linha>
          <div className="mt-2">
            <BotaoLink href={`/pagamento/${p.id}/obra`}>
              Corrigir a obra deste registro
            </BotaoLink>
          </div>
        </Card>
      </Corpo>
      <BarraAdicionar
        voltar={
          <BotaoLink href="/" variante="primary">
            Voltar ao início
          </BotaoLink>
        }
      />
    </>
  );
}
