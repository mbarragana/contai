"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  AfirmacaoObra,
  AvisoEquiparacao,
  PendenciaCno,
} from "@/app/_components/obra";
import {
  AppBar,
  Banner,
  BarraAdicionar,
  BotaoLink,
  Card,
  Carregando,
  Chip,
  Consequencia,
  Corpo,
  Dica,
  EstadoErro,
  Faixa,
  Passo,
  Secao,
} from "@/app/_components/ui";
import { BlocoAgendados } from "@/app/_components/agendado";
import {
  CardAfericaoInss,
  CardCustoEmRisco,
} from "@/app/_components/custo-em-risco";
import { PendenciaDeDatas } from "@/app/_components/datas-do-desembolso";
import { CardDocumentosSemArquivo } from "@/app/_components/documento-sem-arquivo";
// ⚠️ CONTAI-042, Gate 2: estes seis cards MORAVAM aqui e foram extraídos. A
// `/pendencias` (e, depois, o dashboard do CONTAI-040) desenha os mesmos — e
// texto fiscal inline em dois arquivos é a D46, o mesmo fato com dois rostos.
import {
  AvisoTerrenoSemRegistro,
  CardAguardandoInforme,
  CardFinanciamentoFaltaLancar,
  CardPendenciaDerivada,
  CardTerrenoSemData,
  CardVinculoCruzandoObras,
} from "@/app/_components/pendencias-derivadas";
import { CardPagoSemComprovante } from "@/app/_components/pago-sem-comprovante";
import {
  carregarCompromissos,
  carregarObras,
  carregarPainel,
  carregarPainelDePendencias,
  classificarErro,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import { montarAgendaDaHome, type AgendaHome } from "@/lib/fiscal/compromisso";
import { escolherObraAtiva } from "@/lib/fiscal/obra";
import { calcularResumo, type ResumoObra } from "@/lib/fiscal/resumo";
import {
  COR_TERRENO_MAIS_DE_UMA_DATA,
  FORA_DO_CUSTO_CONFIRMADO,
  FORA_DO_CUSTO_CONFIRMADO_PORQUE,
} from "@/lib/fiscal/terreno";
// ⚠️ CONTAI-042: as cores destas quatro famílias eram LITERAIS aqui e passaram
// a sair das constantes do módulo fiscal dono de cada texto — a mesma definição
// que a fila unificada de `/pendencias` lê. Comportamento idêntico; o que muda
// é que agora existe UM lugar onde a cor delas está escrita.
import { bordaDaCor, bordaDaGravidade } from "@/lib/fiscal/gravidade";
import {
  AVISO_ANO_ANTERIOR,
  EMITENTE_ERRADO_O_QUE_FALTA,
  GRAVIDADE_CORRECAO_ANO_ANTERIOR,
  montarPendenciasDeAno,
  pendenciasAbertasDaObra,
  sinalDoEmitenteErrado,
  type PendenciaDeAno,
  type SinalDoEmitenteErrado,
} from "@/lib/fiscal/revisao";
import {
  EXPLICACAO_CUSTO_ZERO,
  EXPLICACAO_NOTAS_SEM_PAGAMENTO,
} from "@/lib/fiscal/vinculo";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import { lerObraPreferida } from "@/lib/obra-ativa";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      dados: PainelDados;
      resumo: ResumoObra;
      /**
       * ⚠️ A agenda vem em CAMPO SEPARADO, e não dentro de `dados`. `dados`
       * é o que entra em `calcularResumo({ ...dados, ano })`: um compromisso
       * ali viajaria pelo spread até a porta do cálculo de custo (critério 3).
       */
      agenda: AgendaHome;
      /**
       * CONTAI-021, critério 20(d): a pendência de retificadora aparece na tela
       * inicial de CADA OBRA AFETADA. Campo separado como a agenda, e pela
       * mesma razão: nada disto pode viajar pelo spread até a porta de
       * `calcularResumo` — é alarme gravado, não número de custo.
       */
      pendenciasDeCorrecao: PendenciaDeAno[];
      /** Marcações de "CNPJ errado" abertas de documentos DESTA obra. */
      emitenteErrado: {
        id: string;
        documentoId: string;
        abertaEm: string;
        /** Item D do CONTAI-035: a cor depende do vínculo, e o aviso do ano. */
        sinal: SinalDoEmitenteErrado;
      }[];
      nomeDasObras: Map<string, string>;
    };


export default function Home() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const obras = await carregarObras();
        // Critério 6: sem valor confiável de obra ativa — primeiro uso, celular
        // novo, storage limpo, outro dispositivo — o app ABRE A LISTA e não
        // escolhe obra nenhuma. Nem a primeira, nem a mais recente, nem a
        // única: escolher em silêncio é o bug que este ticket veio matar.
        const ativa = escolherObraAtiva(obras, lerObraPreferida());
        if (cancelado) return;
        if (!ativa) {
          router.replace("/obras");
          return;
        }

        const dados = await carregarPainel(ativa.id);
        const compromissos = await carregarCompromissos(ativa.id);
        const painelPendencias = await carregarPainelDePendencias();
        const ano = Number(hojeIso().slice(0, 4));
        if (cancelado) return;
        const docsDaObra = new Set(dados.documentos.map((d) => d.id));
        setEstado({
          fase: "pronto",
          dados,
          resumo: calcularResumo({ ...dados, ano }),
          agenda: montarAgendaDaHome(compromissos, hojeIso()),
          pendenciasDeCorrecao: pendenciasAbertasDaObra(
            montarPendenciasDeAno(painelPendencias),
            ativa.id,
          ),
          emitenteErrado: painelPendencias.pendencias
            .filter(
              (p) =>
                p.tipo === "emitente_errado" &&
                p.desfecho === null &&
                p.documentoId !== null &&
                docsDaObra.has(p.documentoId),
            )
            .map((p) => ({
              id: p.id,
              documentoId: p.documentoId as string,
              abertaEm: p.abertaEm,
              sinal: sinalDoEmitenteErrado({
                documentoId: p.documentoId as string,
                vinculos: painelPendencias.vinculos,
                anoCorrente: ano,
              }),
            })),
          nomeDasObras: new Map(obras.map((o) => [o.id, o.nome])),
        });
      } catch (erro) {
        if (cancelado) return;
        setEstado({ fase: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [tentativa, router]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ fase: "carregando" });
    setTentativa((t) => t + 1);
  }, []);

  const trocarObra = useCallback(() => router.push("/obras"), [router]);

  const obra = estado.fase === "pronto" ? estado.dados.obra : null;
  const ano = estado.fase === "pronto" ? estado.resumo.ano : new Date().getFullYear();
  const hoje = hojeIso();
  /**
   * O estado em que esta tela DE FATO tem duas colunas — e, portanto, o único
   * em que ela pede a casca larga (CONTAI-039, Gate 2). Carregando e erro
   * ficam nos 430px de toda tela do app.
   */
  const emGestao = estado.fase === "pronto" && obra !== null;

  return (
    <>
      <AppBar
        titulo="contai"
        sub={
          obra
            ? `${obra.nome}${obra.cno ? ` · CNO ${obra.cno}` : " · sem CNO"} · ${ano}`
            : `Obra · ${ano}`
        }
      />

      {/* ── CONTAI-039 · duas colunas a partir de `lg` ───────────────────
          ⚠️ **`largo` é a DECLARAÇÃO DA PÁGINA de que ela é larga** — é ele
          que abre a casca de 430px para 1280px em `lg` (`app/layout.tsx`,
          via `:has([data-largo])`, atributo que o `Corpo` emite sozinho a
          partir do prop). Fica só no estado PRONTO, e a razão é a mesma do
          `lg:flex-row`: carregando e erro ocupam o `Corpo` inteiro (spec de
          design), porque split com régua fiscal vazia ao lado não informa
          nada — e esticar um esqueleto ou um banner de erro por 1244px em
          coluna única é a regressão de legibilidade que o Gate 2 mediu nas
          outras telas.

          O trio que anda junto: `largo` + `lg:flex-row lg:gap-8` aqui,
          `alinharComFila` na `BarraAdicionar` — os três ligam e desligam
          pelo MESMO `emGestao`.

          ⚠️ `lg:gap-8` é a MESMA grafia do espaçador da `BarraAdicionar`
          (`app/_components/ui.tsx`) — sincronia por comentário cruzado. */}
      <Corpo
        largo={emGestao}
        className={emGestao ? "lg:flex-row lg:gap-8" : ""}
      >
        {estado.fase === "carregando" ? (
          <Carregando rotulo="Carregando a obra" />
        ) : null}

        {estado.fase === "erro" ? (
          <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
        ) : null}

        {estado.fase === "pronto" && obra ? (
          <>
            {/* ── A RÉGUA DE POSIÇÃO FISCAL ────────────────────────────────
                Os quatro blocos que se LÊ enquanto se percorre a fila: obra
                aberta, custo confirmado, custo em risco e aferição do INSS.
                Em `lg` viram coluna fixa (`sticky`) de 400px, para o número
                que a fila está corrigindo não sair da tela junto com o
                scroll (CONTAI-039, critério 5).

                ⚠️ **`lg:max-h-full lg:overflow-y-auto` NÃO é o fallback que o
                ticket deixou Out of Scope — é correção de defeito medido no
                Gate 2.** A régua tem 1111px de altura contra 654px de
                viewport útil em 1280×800 **no cenário mínimo** (1 NF de
                serviço + 1 PIX aguardando NF): pregada pelo `sticky`, os
                ~457px de baixo — `CardAfericaoInss` e parte do
                `CardCustoEmRisco` — ficavam INALCANÇÁVEIS enquanto a fila
                rolasse. Pendência que não se alcança é pendência sem
                superfície (critério 9, mesma classe de D46/D47). Com o scroll
                próprio, os quatro blocos continuam alcançáveis em qualquer
                altura de fila.

                ⚠️ `max-h-full` e não `100dvh`: a altura de referência é a do
                `main`, que já é definida (`h-dvh` na casca, `flex-1` aqui), e
                `dvh` ignoraria o `AppBar` e o `Rodape` — sobraria régua
                embaixo do rodapé.

                ⚠️ Abaixo de `lg` não há `position`, largura nem scroll
                próprios: é a mesma pilha do `Corpo`, com o mesmo `gap-3` de
                hoje.

                ⚠️ `lg:w-[400px]` é a MESMA grafia do espaçador da
                `BarraAdicionar` (`app/_components/ui.tsx`), e o par
                400 + `gap-8` sai do `lg:max-w-[1280px]` da casca
                (`app/layout.tsx`). Mudou um, muda os três — Tailwind exige
                string literal (Pre-mortem 3). */}
            <aside className="flex flex-col gap-3 lg:sticky lg:top-0 lg:max-h-full lg:w-[400px] lg:flex-none lg:self-start lg:overflow-y-auto">
              {/* Critério 7: a obra é afirmada, não subentendida. */}
              <AfirmacaoObra
                rotulo="Obra aberta"
                nome={obra.nome}
                onTrocar={trocarObra}
              />

              <Card>
                {/* Critério 9: todo número carrega o nome da obra. */}
                <Dica>
                  Custo confirmado em {estado.resumo.ano} · {obra.nome}
                </Dica>
                <div className="mono text-[26px] font-bold tracking-tight">
                  {formatarBRL(estado.resumo.custoConfirmadoAnoCentavos)}
                </div>
                {/* Critério 14: o zero NUNCA aparece mudo havendo registro na
                    obra. O texto é cópia literal do parecer §5.1 — colapsar
                    "não demonstrável" em "inexistente" é o defeito que este
                    ticket veio matar. */}
                {estado.resumo.custoConfirmadoAnoCentavos === 0 &&
                estado.resumo.temRegistro ? (
                  <Consequencia cor="amb">
                    {EXPLICACAO_CUSTO_ZERO} Ligue cada pagamento à sua nota nas
                    seções abaixo.
                  </Consequencia>
                ) : null}
                {estado.resumo.despesas.length > 0 ? (
                  <Dica>
                    {estado.resumo.despesas.length}{" "}
                    {estado.resumo.despesas.length === 1
                      ? "despesa comprovada"
                      : "despesas comprovadas"}{" "}
                    — nota + pagamento ligados
                  </Dica>
                ) : null}
                <div className="mono mt-1 text-[14px] font-semibold">
                  Acumulado desta obra:{" "}
                  {formatarBRL(estado.resumo.acumuladoImovelCentavos)}
                </div>
                {/* ⚠️ A MOLDURA CAI JUNTO COM O NÚMERO. Sem terreno registrado,
                    chamar isto de "situação em 31/12 na ficha Bens e Direitos" é
                    afirmar que o número serve para a declaração — e ele não
                    serve. O painel do terreno já substituía a moldura pelo
                    aviso; a home fazia as duas coisas no mesmo card, o que é
                    contradição visível (ressalva do `contador`, Gate 2). */}
                {estado.resumo.terrenoSemRegistro === null ? (
                  <Dica>
                    = situação em 31/12 na ficha Bens e Direitos (terreno + obra)
                  </Dica>
                ) : null}
                {/* ── CONTAI-025, critério 9 · o SEGUNDO número ───────────────
                    O acumulado passou a excluir o desembolso do terreno pago sem
                    comprovante (critério 8). Sem esta linha ele encolheria em
                    SILÊNCIO, e o §2.4 do parecer diz que "item incluído em
                    silêncio é o pior dos mundos; nomeado, é posição declarada" —
                    e que isso vale nos DOIS sentidos, excluído também. O rótulo é o do §4.5,
                    o mesmo do relatório anual — dois nomes para o mesmo número é
                    como nasce a D46. */}
                {estado.resumo.terrenoForaDoAcumuladoCentavos > 0 ? (
                  <div className="mt-1.5" data-fora-do-custo-confirmado>
                    <div className="text-[13px] font-semibold text-red">
                      {FORA_DO_CUSTO_CONFIRMADO}:{" "}
                      <span className="mono">
                        {formatarBRL(
                          estado.resumo.terrenoForaDoAcumuladoCentavos,
                        )}
                      </span>
                    </div>
                    <Dica>{FORA_DO_CUSTO_CONFIRMADO_PORQUE}</Dica>
                  </div>
                ) : null}
                {/* Relato do Mateus, 2026-09-18: ele quer ver quanto já saiu do
                    bolso, comprovado ou não — mas isso não pode virar o
                    acumulado oficial (que É o valor da declaração e por isso só
                    conta o que tem documento hábil). Linha nomeada e separada,
                    só some quando não há diferença nenhuma a mostrar. */}
                {estado.resumo.gastoRealComPendentesCentavos >
                estado.resumo.acumuladoImovelCentavos ? (
                  <div className="mt-1.5">
                    <div className="mono text-[13px]">
                      Gasto real até agora (com o que ainda não tem
                      comprovante):{" "}
                      {formatarBRL(estado.resumo.gastoRealComPendentesCentavos)}
                    </div>
                    <Dica>
                      Não é o valor da declaração — some quando o comprovante
                      entrar.
                    </Dica>
                  </div>
                ) : null}
                {/* ⚠️ O R$ 0,00 do terreno NÃO é apuração — é a ausência dela.
                    A parte do terreno aparece nomeada logo abaixo do acumulado
                    para o "R$ 0,00 aqui" do aviso apontar para um número
                    visível, e não para a soma inteira (que pode ter custo de
                    obra dentro). Sem isto, a linha afirma fato falso com
                    moldura de fato apurado, e a direção do erro é a
                    irreversível: custo subestimado = ganho de capital inflado. */}
                {estado.resumo.terrenoSemRegistro ? (
                  <>
                    <div className="mono mt-1 text-[13px]">
                      Terreno nesta soma:{" "}
                      {formatarBRL(
                        estado.resumo.terrenoSemRegistro
                          .terrenoNoAcumuladoCentavos,
                      )}
                    </div>
                    <AvisoTerrenoSemRegistro
                      terreno={estado.resumo.terrenoSemRegistro}
                    />
                  </>
                ) : null}
                <Dica>
                  Nada é somado com as outras obras — cada matrícula é um item da
                  declaração.
                </Dica>
                {/* ⚠️ A linha "Em pendência: R$ X — resolver abaixo" MORREU aqui
                    (CONTAI-005). Ela exibia a soma crua de `pendencias[]`: perda
                    de custo + conta a pagar + base de INSS no mesmo número, e o
                    mesmo dispêndio podendo entrar duas vezes (boleto registrado +
                    o pagamento avulso dele). O que entra no lugar é o card
                    abaixo, com UMA moeda e a composição sempre visível. */}
              </Card>

              {/* ── CONTAI-005 · o headline ────────────────────────────────────
                  Card PRÓPRIO, e não uma linha dentro do card de cima (decisão 1
                  do mock v5): a R4 exige a decomposição colada ao total, e o
                  texto inteiro não cabe como linha secundária sem competir com o
                  número principal do "Custo confirmado".

                  ⚠️ **R5 já está atendida pelo card de cima**, por código que não
                  é deste ticket: `EXPLICACAO_CUSTO_ZERO` aparece sempre que o
                  custo confirmado é zero havendo registro. O zero nunca convive
                  com este headline sem dizer por quê — que é o que a ressalva
                  pede. Repetir a ressalva aqui seria um segundo caminho para o
                  mesmo texto fiscal. */}
              <CardCustoEmRisco
                risco={estado.resumo.custoEmRiscoIr}
                nomeDaObra={obra.nome}
              />

              {/* Outra apuração, em BASE, e nunca somada à de cima (R2). Só com
                  CNO e só com exposição — ver `CardAfericaoInss`. */}
              {obra.cno && estado.resumo.exposicaoInssBaseCentavos > 0 ? (
                <CardAfericaoInss
                  cno={obra.cno}
                  baseCentavos={estado.resumo.exposicaoInssBaseCentavos}
                />
              ) : null}
            </aside>

            {/* ── A FILA DE TRABALHO ───────────────────────────────────────
                A MESMA ORDEM FISCAL de hoje, item por item — o que muda é
                que, em `lg`, cada `Card` vira célula de um grid de 2 colunas
                e o que não é `Card` (`Passo`, `Banner`, `BlocoAgendados`,
                `Dica`) atravessa as duas via `Faixa`.

                ⚠️ Nenhum `order`, nenhum `grid-auto-flow: dense`: ordem
                visual = ordem do DOM = ordem de gravidade (critério 6). */}
            <Secao>
              {/* `Faixa` mesmo podendo renderizar nada: o aviso só existe no
                  caso de equiparação, e a `Faixa` some junto (ver `Faixa`). */}
              <Faixa>
                <AvisoEquiparacao obra={obra} />
              </Faixa>

              {/* A pendência de CNO fica aberta na obra até o CNO existir. */}
              {obra.cno ? null : (
                <PendenciaCno
                  obra={obra}
                  hoje={hoje}
                  acao={
                    <BotaoLink href={`/obras/${obra.id}`}>
                      Já registrei — informar o CNO
                    </BotaoLink>
                  }
                />
              )}

              {/* O TERCEIRO ESTADO (parecer §5.2). Seção PRÓPRIA, fora das
                  pendências de propósito: este número não soma com o custo
                  confirmado nem com o custo em risco. O mock s10 desenhou o
                  cartão dentro de "Pendências"; o parecer vence. */}
              {estado.resumo.notasSemPagamento.length > 0 ? (
                <>
                  <Faixa>
                    <Passo>Notas hábeis sem pagamento vinculado</Passo>
                  </Faixa>
                  <Card className="border-amb">
                    <div className="mono text-[19px] font-bold">
                      {formatarBRL(estado.resumo.notasSemPagamentoCentavos)}
                    </div>
                    <Consequencia cor="amb">
                      {EXPLICACAO_NOTAS_SEM_PAGAMENTO}
                    </Consequencia>
                    <Dica>
                      Não soma com o custo confirmado nem com o que está em
                      pendência.
                    </Dica>
                  </Card>
                  {estado.resumo.notasSemPagamento.map((n) => (
                    <Card key={n.id}>
                      <Chip cor="amb">Sem pagamento ligado</Chip>
                      <div className="mt-1.5 font-semibold">{n.titulo}</div>
                      <Dica>
                        {n.detalhe} ·{" "}
                        <span className="mono">{formatarBRL(n.valorCentavos)}</span>
                      </Dica>
                      <div className="mt-2.5">
                        <BotaoLink href={`${n.href}/ligar`} variante="primary">
                          Ligar a um pagamento
                        </BotaoLink>
                      </div>
                    </Card>
                  ))}
                </>
              ) : null}

              {/* Critério 13: o par vira UMA despesa — não a NF e o PIX lado a
                  lado, que é a palavra "duplicadas" do relato. */}
              {estado.resumo.despesas.length > 0 ? (
                <>
                  <Faixa>
                    <Passo>Despesas comprovadas</Passo>
                  </Faixa>
                  {estado.resumo.despesas.map((d) => (
                    <Card key={d.id} className="border-grn">
                      <Chip cor="grn">Custo comprovado</Chip>
                      <div className="mt-1.5 font-semibold">
                        {d.titulo} ·{" "}
                        <span className="mono">{formatarBRL(d.valorCentavos)}</span>
                      </div>
                      <Dica>{d.detalhe}</Dica>
                      {d.noAnoCentavos !== d.valorCentavos ? (
                        <Dica>
                          Em {estado.resumo.ano}:{" "}
                          <span className="mono">
                            {formatarBRL(d.noAnoCentavos)}
                          </span>{" "}
                          — o resto caiu no ano do pagamento que o gerou.
                        </Dica>
                      ) : null}
                      <div className="mt-2.5">
                        <BotaoLink href={d.href}>Ver a despesa</BotaoLink>
                      </div>
                    </Card>
                  ))}
                </>
              ) : null}

              {/* ⚠️ CONTAI-021, critério 20 — a pendência PERSISTENTE, que não
                  some ao fechar a tela. Bloco próprio, ANTES das pendências
                  derivadas: estas são recalculadas a cada carga e desaparecem
                  sozinhas quando o fato muda; a de correção é linha GRAVADA e só
                  sai com um desfecho escolhido pelo Mateus. */}
              {estado.pendenciasDeCorrecao.length > 0 ||
              estado.emitenteErrado.length > 0 ? (
                <Faixa>
                  <Passo>Correções a tratar</Passo>
                </Faixa>
              ) : null}

              {estado.pendenciasDeCorrecao.map((p) => {
                const nesta = p.obras.find((o) => o.obraId === obra.id);
                const outras = p.obras
                  .filter((o) => o.obraId !== obra.id)
                  .map((o) => estado.nomeDasObras.get(o.obraId) ?? "outra obra");
                return (
                  <Card
                    key={p.id}
                    className={bordaDaGravidade(GRAVIDADE_CORRECAO_ANO_ANTERIOR)}
                    data-pendencia={p.ano}
                  >
                    <Chip cor={GRAVIDADE_CORRECAO_ANO_ANTERIOR}>
                      Correção mexeu em ano anterior
                    </Chip>
                    <div className="mt-1.5 font-semibold">
                      {p.ano} — o custo do ano mudou depois de {p.quantidadeDeAtos}{" "}
                      {p.quantidadeDeAtos === 1 ? "correção sua" : "correções suas"}
                    </div>
                    {nesta ? (
                      <Dica>
                        Nesta obra:{" "}
                        <span className="mono">
                          {formatarBRL(nesta.antesCentavos)} →{" "}
                          {formatarBRL(nesta.depoisCentavos)}
                        </span>
                        .
                      </Dica>
                    ) : null}
                    {/* ⚠️ A outra obra é NOMEADA SEM VALOR: dinheiro de duas obras
                        lado a lado na mesma tela é a soma que não existe em
                        declaração nenhuma (critério 14 de /obras). */}
                    {outras.length > 0 ? (
                      <Dica>
                        Esta correção também mudou o custo de {p.ano} em{" "}
                        {outras.join(", ")}.
                      </Dica>
                    ) : null}
                    <Consequencia cor={GRAVIDADE_CORRECAO_ANO_ANTERIOR}>
                      {AVISO_ANO_ANTERIOR}
                    </Consequencia>
                    <div className="mt-2.5">
                      <BotaoLink href={`/pendencias/${p.id}`}>
                        Abrir a pendência de {p.ano}
                      </BotaoLink>
                    </div>
                  </Card>
                );
              })}

              {estado.emitenteErrado.map((p) => (
                <Card key={p.id} className={bordaDaGravidade(p.sinal.gravidade)}>
                  <Chip cor={p.sinal.gravidade}>CNPJ errado — tratar</Chip>
                  <div className="mt-1.5 font-semibold">
                    O CNPJ do emitente de 1 documento está errado
                  </div>
                  <Consequencia cor={p.sinal.gravidade}>
                    {EMITENTE_ERRADO_O_QUE_FALTA}
                  </Consequencia>
                  {/* O aviso NÃO carrega a cor da pendência: ele informa a
                      escalada (critério 6), e por isso fica âmbar mesmo no card
                      vermelho. */}
                  {p.sinal.avisoAnoAnterior ? (
                    <Consequencia cor="amb">{p.sinal.avisoAnoAnterior}</Consequencia>
                  ) : null}
                  <div className="mt-2.5">
                    <BotaoLink href={`/documento/${p.documentoId}`}>
                      Ver o documento marcado
                    </BotaoLink>
                  </div>
                </Card>
              ))}

              {estado.resumo.pendencias.length > 0 ? (
                <Faixa>
                  <Passo>Pendências</Passo>
                </Faixa>
              ) : null}

              {/* ⚠️ Achado no teste manual no browser do CONTAI-033: este banner só
                  olhava `pendencias`, e `documentosSemArquivo` fica FORA dela de
                  propósito (crit. 11) — o banner dizia "Nenhuma pendência" com o
                  card vermelho de "Nota sem arquivo" logo abaixo, na mesma tela.
                  Mesma classe de defeito que o ticket inteiro existe para evitar
                  (D47). Não estendido aos outros agregados "fora de pendencias"
                  (terreno, financiamento) — auditoria maior, fora deste ticket;
                  registrado como dívida no backlog. */}
              {estado.resumo.pendencias.length === 0 &&
              !estado.resumo.documentosSemArquivo &&
              estado.resumo.vinculosCruzandoObras.length === 0 ? (
                <Faixa>
                  <Banner cor="grn" role="status">
                    <strong>Nenhuma pendência.</strong> Todo documento e
                    pagamento registrado está com a documentação em ordem.
                  </Banner>
                </Faixa>
              ) : null}

              {estado.resumo.pendencias.map((p) => (
                <CardPendenciaDerivada key={p.id} pendencia={p} />
              ))}

              {/* ── CONTAI-008, critério 12 · a REDE, não a porta ────────────
                  `alocarCusto` descartava em silêncio o vínculo que cruza duas
                  obras, sob um comentário que dizia que o caso não nascia pela
                  interface. As duas portas estão fechadas (migrations 0009 e
                  0016) e este card é o que sobra para o dia em que uma porta nova
                  aparecer: "nenhum vínculo cruzando obras pode ser descartado sem
                  que alguém fique sabendo". Fora de `pendencias` e das somas —
                  não é dinheiro novo em risco, é defeito de dado. */}
              {estado.resumo.vinculosCruzandoObras.length > 0 ? (
                <>
                  <Faixa>
                    <Passo>Vínculo entre obras — conferir</Passo>
                  </Faixa>
                  {estado.resumo.vinculosCruzandoObras.map((v) => (
                    <CardVinculoCruzandoObras
                      key={`${v.pagamentoId}:${v.documentoId}`}
                      vinculo={v}
                    />
                  ))}
                </>
              ) : null}

              {/* ⚠️ CONTAI-010 — os dois estados do TERRENO. Bloco próprio,
                  DEPOIS das pendências fiscais e fora delas (critério 21):
                  nenhum dos dois entra no headline de "Custo em risco no IR"
                  (CONTAI-005). O primeiro é pendência de COMPLEMENTO (falta
                  um dado que só o Mateus tem); o segundo é o calendário do banco.
                  Nenhum dos dois é bloqueio. */}
              {/* ── CONTAI-025, critério 11 · o card agregado da pendência ───
                  A superfície que faltava (D47): "pago sem papel" só existia
                  DENTRO da linha do desembolso. Sem card próprio, liberar a
                  gravação trocaria "custo não registrado" por "custo registrado
                  que ninguém vai completar" (§1.5), que na venda dá no mesmo.
                  VERMELHO (D39): o dinheiro saiu. Valor total + contagem + link
                  para a lista, e a linha do §4.3 junto da pendência. */}
              {estado.resumo.terrenoPagoSemComprovante ? (
                <>
                  <Faixa>
                    <Passo>Terreno — pago sem comprovante</Passo>
                  </Faixa>
                  <CardPagoSemComprovante
                    totalCentavos={
                      estado.resumo.terrenoPagoSemComprovante.totalCentavos
                    }
                    quantidade={
                      estado.resumo.terrenoPagoSemComprovante.quantidade
                    }
                    href={estado.resumo.terrenoPagoSemComprovante.href}
                  />
                </>
              ) : null}

              {/* ── CONTAI-033, critério 11 · o card irmão, do lado do DOCUMENTO
                  A mesma disciplina, o mesmo D47: nota gravada sem o arquivo
                  precisa de superfície própria, senão "registra e esquece"
                  (§A.5). VERMELHO — o arquivo que falta É o documento hábil.
                  CTA só quando há UM documento (decisão do `po`, 2026-09-19). */}
              {estado.resumo.documentosSemArquivo ? (
                <>
                  <Faixa>
                    <Passo>Documentos — pendências</Passo>
                  </Faixa>
                  <CardDocumentosSemArquivo
                    totalCentavos={estado.resumo.documentosSemArquivo.totalCentavos}
                    quantidade={estado.resumo.documentosSemArquivo.quantidade}
                    href={estado.resumo.documentosSemArquivo.href}
                  />
                </>
              ) : null}

              {/* ⚠️ **VERMELHO desde 23/08 (D39 revisada)** — o valor está pago e
                  não cai em ano nenhum: é a pendência MAIS grave da tela, não a
                  mais leve. Era âmbar por herança do CONTAI-027. */}
              {estado.resumo.terrenoSemData.length > 0 ? (
                <>
                  <Faixa>
                    <Passo>Terreno — valores sem data</Passo>
                  </Faixa>
                  {estado.resumo.terrenoSemData.map((t) => (
                    <CardTerrenoSemData key={t.id} terreno={t} />
                  ))}
                </>
              ) : null}

              {/* ── CONTAI-027, critério 12c: a HOME é uma das duas superfícies
                  onde esta pendência é indispensável. Vem ANTES da de "falta a
                  data" porque é vermelha — fato consumado com consequência
                  fiscal aberta —, e a de data é âmbar. ⚠️ Sem "ok, entendi":
                  não se dispensa, não se adia, não se esconde. */}
              {estado.resumo.terrenoMaisDeUmaData.length > 0 ? (
                <>
                  <Faixa>
                    <Passo>Terreno — um lançamento, mais de uma data</Passo>
                  </Faixa>
                  {estado.resumo.terrenoMaisDeUmaData.map((t) => (
                    <Card
                      key={t.id}
                      className={bordaDaCor(COR_TERRENO_MAIS_DE_UMA_DATA)}
                    >
                      <PendenciaDeDatas
                        valorCentavos={t.valorCentavos}
                        titulo={t.titulo}
                      >
                        <BotaoLink href={t.href}>Abrir o desembolso</BotaoLink>
                      </PendenciaDeDatas>
                    </Card>
                  ))}
                </>
              ) : null}

              {/* Ano JÁ FECHADO sem informe — o extrato existe, o dinheiro
                  saiu, e o custo daquele ano não existe no sistema. Vem ANTES do
                  "aguardando informe" porque é o único dos dois que tem ação
                  possível hoje.
                  ⚠️ CONTAI-035, item B: era esta frase, escrita aqui, contra
                  `border-amb` na linha seguinte — o argumento do vermelho ao
                  lado da cor errada. A cor agora VEM da régua (`f.gravidade`),
                  e não dá mais para discordar dela sem apagar a conta. */}
              {estado.resumo.financiamentoFaltaLancar.length > 0 ? (
                <>
                  <Faixa>
                    <Passo>Financiamento — informe anual não lançado</Passo>
                  </Faixa>
                  {estado.resumo.financiamentoFaltaLancar.map((f) => (
                    <CardFinanciamentoFaltaLancar key={f.ano} financiamento={f} />
                  ))}
                </>
              ) : null}

              {estado.resumo.financiamentoAguardandoInforme ? (
                <>
                  <Faixa>
                    <Passo>
                      Financiamento{" "}
                      {estado.resumo.financiamentoAguardandoInforme.ano} —
                      aguardando informe anual
                    </Passo>
                  </Faixa>
                  <CardAguardandoInforme
                    informe={estado.resumo.financiamentoAguardandoInforme}
                  />
                </>
              ) : null}

              {/* ⚠️ BLOCO SEPARADO, RÓTULO PRÓPRIO, LONGE DO CUSTO (critério
                  10). Ele fica DEPOIS das pendências fiscais de propósito:
                  agendado não é pendência fiscal — nada saiu da conta, logo não
                  há risco fiscal ainda (critério 19). E não há soma nenhuma
                  aqui, só contagem (critério 42). */}
              {/* Bloco ATÔMICO: ele traz `Passo` + lista própria por dentro e
                  não se decompõe pela grade do pai — por isso atravessa as duas
                  colunas inteiro. A `Faixa` some junto quando a agenda é vazia. */}
              <Faixa>
                <BlocoAgendados agenda={estado.agenda} hoje={hoje} />
              </Faixa>

              <Faixa>
                <Dica>
                  <Link href={`/obras/${obra.id}`} className="underline">
                    Dados da obra
                  </Link>{" "}
                  — matrícula e CNO ·{" "}
                  <Link href={`/obras/${obra.id}/terreno`} className="underline">
                    Terreno
                  </Link>{" "}
                  — desembolsos datados, contrato e informes anuais.
                </Dica>
              </Faixa>

              {/* Único caminho até a saída (critério 6 do CONTAI-002): logout
                  que não se encontra é logout que não existe. */}
              <Faixa>
                <Dica>
                  <Link href="/conta" className="underline">
                    Sua conta
                  </Link>{" "}
                  — e-mail da sessão e sair deste aparelho.
                </Dica>
              </Faixa>
            </Secao>
          </>
        ) : null}
      </Corpo>

      {/* Critério 12: o alvo sai do FAB flutuante e vai para a barra fixa —
          o FAB pousava sobre o acumulado quando a lista de pendências crescia.

          `alinharComFila` acompanha o `data-largo` do `Corpo`: "+ Adicionar"
          cria pendência, logo pertence à FILA (coluna direita), e só existe
          coluna direita no estado em que a casca é larga. */}
      <BarraAdicionar alinharComFila={emGestao} />
    </>
  );
}
