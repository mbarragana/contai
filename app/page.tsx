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
  Passo,
} from "@/app/_components/ui";
import { BlocoAgendados } from "@/app/_components/agendado";
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
import { calcularResumo, type Pendencia, type ResumoObra } from "@/lib/fiscal/resumo";
import {
  AVISO_ANO_ANTERIOR,
  EMITENTE_ERRADO_O_QUE_FALTA,
  montarPendenciasDeAno,
  pendenciasAbertasDaObra,
  type PendenciaDeAno,
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
      emitenteErrado: { id: string; documentoId: string; abertaEm: string }[];
      nomeDasObras: Map<string, string>;
    };

const ACAO_POR_TIPO: Partial<Record<Pendencia["tipo"], string>> = {
  quarentena: "Resolver",
  boleto_sem_nf: "Ver detalhes",
  servico_sem_retencao: "Ver detalhes",
  // CONTAI-019: as duas se resolvem no detalhe do pagamento — a diferença
  // pelas quatro resoluções do §F.2, o comprovante pelo anexo.
  diferenca_sem_explicacao: "Explicar a diferença",
  pago_sem_comprovante: "Anexar o comprovante",
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

      <Corpo>
        {estado.fase === "carregando" ? (
          <Carregando rotulo="Carregando a obra" />
        ) : null}

        {estado.fase === "erro" ? (
          <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
        ) : null}

        {estado.fase === "pronto" && obra ? (
          <>
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
                  <Consequencia cor="amb">
                    {estado.resumo.terrenoSemRegistro.aviso}
                  </Consequencia>
                  <div className="mt-2.5">
                    <BotaoLink href={estado.resumo.terrenoSemRegistro.href}>
                      Registrar os desembolsos do terreno
                    </BotaoLink>
                  </div>
                </>
              ) : null}
              <Dica>
                Nada é somado com as outras obras — cada matrícula é um item da
                declaração.
              </Dica>
              {estado.resumo.pendencias.length > 0 ? (
                <p className="mt-1.5 text-[12px] text-mut">
                  Em pendência:{" "}
                  <span className="mono font-semibold text-red">
                    {formatarBRL(estado.resumo.emPendenciaCentavos)}
                  </span>{" "}
                  — resolver abaixo
                </p>
              ) : null}
            </Card>

            <AvisoEquiparacao obra={obra} />

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
                <Passo>Notas hábeis sem pagamento vinculado</Passo>
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
                <Passo>Despesas comprovadas</Passo>
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
              <Passo>Correções a tratar</Passo>
            ) : null}

            {estado.pendenciasDeCorrecao.map((p) => {
              const nesta = p.obras.find((o) => o.obraId === obra.id);
              const outras = p.obras
                .filter((o) => o.obraId !== obra.id)
                .map((o) => estado.nomeDasObras.get(o.obraId) ?? "outra obra");
              return (
                <Card key={p.id} className="border-amb" data-pendencia={p.ano}>
                  <Chip cor="amb">Correção mexeu em ano anterior</Chip>
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
                  <Consequencia cor="amb">{AVISO_ANO_ANTERIOR}</Consequencia>
                  <div className="mt-2.5">
                    <BotaoLink href={`/pendencias/${p.id}`}>
                      Abrir a pendência de {p.ano}
                    </BotaoLink>
                  </div>
                </Card>
              );
            })}

            {estado.emitenteErrado.map((p) => (
              <Card key={p.id} className="border-amb">
                <Chip cor="amb">CNPJ errado — tratar</Chip>
                <div className="mt-1.5 font-semibold">
                  O CNPJ do emitente de 1 documento está errado
                </div>
                <Consequencia cor="amb">
                  {EMITENTE_ERRADO_O_QUE_FALTA}
                </Consequencia>
                <div className="mt-2.5">
                  <BotaoLink href={`/documento/${p.documentoId}`}>
                    Ver o documento marcado
                  </BotaoLink>
                </div>
              </Card>
            ))}

            {estado.resumo.pendencias.length > 0 ? (
              <Passo>Pendências</Passo>
            ) : null}

            {estado.resumo.pendencias.length === 0 ? (
              <Banner cor="grn" role="status">
                <strong>Nenhuma pendência.</strong> Todo documento e pagamento
                registrado está com a documentação em ordem.
              </Banner>
            ) : null}

            {estado.resumo.pendencias.map((p) => (
              <Card key={p.id}>
                <Chip cor={p.gravidade}>{p.chip}</Chip>
                <div className="mt-1.5 font-semibold">{p.titulo}</div>
                <Dica>
                  {p.detalhe} ·{" "}
                  <span className="mono">{formatarBRL(p.valorCentavos)}</span>
                </Dica>
                <Consequencia cor={p.gravidade}>{p.consequencia}</Consequencia>
                {p.href && ACAO_POR_TIPO[p.tipo] ? (
                  <div className="mt-2.5">
                    <BotaoLink href={p.href}>{ACAO_POR_TIPO[p.tipo]}</BotaoLink>
                  </div>
                ) : null}
                {/* Critério 3: o cartão "pago sem nota" leva ao seletor
                    inverso — metade do parque de registros nasceu como PIX e
                    não tinha porta nenhuma. */}
                {p.itens?.map((item) => (
                  <div key={item.id} className="mt-2.5">
                    <BotaoLink href={item.href}>
                      Ligar a uma nota — {item.rotulo}
                    </BotaoLink>
                  </div>
                ))}
              </Card>
            ))}

            {/* ⚠️ CONTAI-010 — os dois estados do TERRENO. Bloco próprio,
                DEPOIS das pendências fiscais e fora delas (critério 21):
                nenhum dos dois entra em `emPendenciaCentavos`, e o CONTAI-005
                não muda de código. O primeiro é pendência de COMPLEMENTO (falta
                um dado que só o Mateus tem); o segundo é o calendário do banco.
                Nenhum dos dois é bloqueio. */}
            {estado.resumo.terrenoSemData.length > 0 ? (
              <>
                <Passo>Terreno — valores sem data</Passo>
                {estado.resumo.terrenoSemData.map((t) => (
                  <Card key={t.id} className="border-amb">
                    <Chip cor="amb">Falta a data</Chip>
                    <div className="mt-1.5 font-semibold">{t.titulo}</div>
                    <Dica>
                      <span className="mono">{formatarBRL(t.valorCentavos)}</span>
                    </Dica>
                    <Consequencia cor="amb">
                      {t.consequencia}. <strong>Não bloqueia o app</strong> —
                      fica como pendência até você preencher.
                    </Consequencia>
                    <div className="mt-2.5">
                      <BotaoLink href={t.href}>Informar a data</BotaoLink>
                    </div>
                  </Card>
                ))}
              </>
            ) : null}

            {/* Ano JÁ FECHADO sem informe — o extrato existe, o dinheiro
                saiu, e o custo daquele ano não existe no sistema. Vem ANTES do
                "aguardando informe" porque é o único dos dois que tem ação
                possível hoje. */}
            {estado.resumo.financiamentoFaltaLancar.length > 0 ? (
              <>
                <Passo>Financiamento — informe anual não lançado</Passo>
                {estado.resumo.financiamentoFaltaLancar.map((f) => (
                  <Card key={f.ano} className="border-amb" data-falta-lancar={f.ano}>
                    <Chip cor="amb">falta lançar {f.ano}</Chip>
                    <Consequencia cor="amb">{f.aviso}</Consequencia>
                    <div className="mt-2.5">
                      <BotaoLink href={f.href} variante="primary">
                        Registrar informe de {f.ano}
                      </BotaoLink>
                    </div>
                  </Card>
                ))}
              </>
            ) : null}

            {estado.resumo.financiamentoAguardandoInforme ? (
              <>
                <Passo>
                  Financiamento {estado.resumo.financiamentoAguardandoInforme.ano}{" "}
                  — aguardando informe anual
                </Passo>
                <Card>
                  <Chip cor="amb" vazado>
                    Aguardando informe
                  </Chip>
                  <Consequencia cor="amb">
                    {estado.resumo.financiamentoAguardandoInforme.aviso}
                  </Consequencia>
                  {estado.resumo.financiamentoAguardandoInforme
                    .estimativaCentavos !== null ? (
                    <>
                      {/* Cinza, rotulada, FORA de toda soma. */}
                      <div className="mono mt-1.5 text-[14px] text-mut">
                        Ordem de grandeza do que falta: ≈{" "}
                        {formatarBRL(
                          estado.resumo.financiamentoAguardandoInforme
                            .estimativaCentavos,
                        )}
                      </div>
                      <Dica>
                        {
                          estado.resumo.financiamentoAguardandoInforme
                            .sobreAEstimativa
                        }
                      </Dica>
                    </>
                  ) : null}
                  <div className="mt-2.5">
                    <BotaoLink
                      href={estado.resumo.financiamentoAguardandoInforme.href}
                    >
                      Ver o terreno ano a ano
                    </BotaoLink>
                  </div>
                </Card>
              </>
            ) : null}

            {/* ⚠️ BLOCO SEPARADO, RÓTULO PRÓPRIO, LONGE DO CUSTO (critério
                10). Ele fica DEPOIS das pendências fiscais de propósito:
                agendado não é pendência fiscal — nada saiu da conta, logo não
                há risco fiscal ainda (critério 19). E não há soma nenhuma
                aqui, só contagem (critério 42). */}
            <BlocoAgendados agenda={estado.agenda} hoje={hoje} />

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

            {/* Único caminho até a saída (critério 6 do CONTAI-002): logout
                que não se encontra é logout que não existe. */}
            <Dica>
              <Link href="/conta" className="underline">
                Sua conta
              </Link>{" "}
              — e-mail da sessão e sair deste aparelho.
            </Dica>
          </>
        ) : null}
      </Corpo>

      {/* Critério 12: o alvo sai do FAB flutuante e vai para a barra fixa —
          o FAB pousava sobre o acumulado quando a lista de pendências crescia. */}
      <BarraAdicionar />
    </>
  );
}
