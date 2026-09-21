"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AvisoEquiparacao, PendenciaCno } from "@/app/_components/obra";
import { CardDocumentosSemArquivo } from "@/app/_components/documento-sem-arquivo";
import { PendenciaDeDatas } from "@/app/_components/datas-do-desembolso";
import { CardPagoSemComprovante } from "@/app/_components/pago-sem-comprovante";
// ⚠️ Gate 2 do CONTAI-042: estes seis cards são os MESMOS que a home desenha —
// importados, nunca recopiados. Ver `app/_components/pendencias-derivadas.tsx`.
import {
  CardAguardandoInforme,
  CardFinanciamentoFaltaLancar,
  CardPendenciaDerivada,
  CardTerrenoSemData,
  CardTerrenoSemRegistro,
  CardVinculoCruzandoObras,
} from "@/app/_components/pendencias-derivadas";
import {
  AppBar,
  BarraAdicionar,
  Banner,
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
import {
  carregarObras,
  carregarPainel,
  carregarPainelDePendencias,
  classificarErro,
  type ErroDeTela,
} from "@/lib/data";
import { bordaDaCor, bordaDaGravidade } from "@/lib/fiscal/gravidade";
import { escolherObraAtiva, formatarDataBR } from "@/lib/fiscal/obra";
import {
  unificarPendencias,
  type ItemDePendencia,
  type PendenciasUnificadas,
} from "@/lib/fiscal/pendencias-unificadas";
import { calcularResumo } from "@/lib/fiscal/resumo";
import {
  AVISO_ANO_ANTERIOR,
  EMITENTE_ERRADO_O_QUE_FALTA,
  GRAVIDADE_CORRECAO_ANO_ANTERIOR,
} from "@/lib/fiscal/revisao";
import { COR_TERRENO_MAIS_DE_UMA_DATA } from "@/lib/fiscal/terreno";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import { lerObraPreferida } from "@/lib/obra-ativa";
import type { Obra } from "@/lib/types";

const ROTULO_DESFECHO: Record<string, string> = {
  retifiquei_a_daa: "retifiquei a DAA",
  contador_avaliou_nao_retifica: "meu contador avaliou e não é preciso retificar",
  daa_ainda_nao_entregue: "a DAA ainda não foi entregue",
  cnpj_gravado_esta_certo:
    "conferi o papel: o CNPJ gravado está certo — o erro foi meu ao marcar",
  apontamento_corrigido: "o apontamento foi corrigido",
};


type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      unificadas: PendenciasUnificadas;
      /**
       * A obra ABERTA — de onde saem as 16 famílias derivadas. `null` quando a
       * preferência do aparelho não aponta para obra nenhuma, e nesse caso a
       * tela **diz** que elas não foram apuradas (Gate Fiscal §3.4).
       */
      obra: Obra | null;
      /** Nome por id: a persistente de outra obra aparece NOMEADA. */
      obras: Map<string, string>;
      ano: number;
    };

/**
 * **A lista de pendências — as DEZOITO famílias, numa fila só (CONTAI-042).**
 *
 * Até aqui esta tela cobria duas: a correção de ano anterior e o CNPJ errado. As
 * outras dezesseis viviam agregadas dentro da home, e nenhuma superfície do app
 * as enumerava juntas — foi assim que o banner *"Nenhuma pendência"* pôde
 * conviver com um card vermelho na mesma tela (**D59**).
 *
 * Quem decide o que entra, em que ordem e quantas são é
 * `lib/fiscal/pendencias-unificadas.ts` — pura e com teste. Esta tela **desenha**
 * e não julga: cada família é renderizada pelo componente que já existia, com o
 * texto que já existia.
 *
 * ⚠️ **Dois escopos, e eles são ditos, não inferidos** (Gate Fiscal do
 * `contador`, 2026-09-21, §3.4): as persistentes são de **todas as obras** — é
 * assim que esta tela sempre funcionou, e restringi-las à obra aberta faria a
 * correção de outra obra perder a única superfície que tem —, e as derivadas são
 * da **obra aberta**, porque `calcularResumo` é de uma obra só.
 *
 * ⚠️ **Nenhum valor é somado aqui.** Nem total, nem subtotal por grupo. O valor
 * por linha continua onde já estava; o que não tinha valor não ganha. É a lição
 * do `emPendenciaCentavos` morto no CONTAI-005.
 */
export default function Pendencias() {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const [obras, painel] = await Promise.all([
          carregarObras(),
          carregarPainelDePendencias(),
        ]);
        if (cancelado) return;
        // Critério 6 do CONTAI-003: sem preferência confiável, o app não
        // escolhe obra nenhuma. Aqui isso NÃO leva para `/obras` — as
        // persistentes de todas as obras continuam sendo listadas, e a tela
        // diz o que deixou de apurar.
        const ativa = escolherObraAtiva(obras, lerObraPreferida());
        const dados = ativa ? await carregarPainel(ativa.id) : null;
        if (cancelado) return;

        // ⚠️ O MESMO ano da home (Gate Fiscal §5): três famílias
        // (`terrenoSemRegistro`, `financiamentoFaltaLancar`,
        // `financiamentoAguardandoInforme`) têm a condição de abertura ligada
        // a ele. Outro ano aqui mudaria quando elas abrem — que é exatamente o
        // que o gate proíbe ao migrar de tela.
        const ano = Number(hojeIso().slice(0, 4));
        const resumo = dados ? calcularResumo({ ...dados, ano }) : null;

        setEstado({
          fase: "pronto",
          unificadas: unificarPendencias({
            resumo,
            obra: dados?.obra ?? null,
            painel,
            anoCorrente: ano,
          }),
          obra: dados?.obra ?? null,
          obras: new Map(obras.map((o) => [o.id, o.nome])),
          ano,
        });
      } catch (erro) {
        if (!cancelado) setEstado({ fase: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ fase: "carregando" });
    setTentativa((t) => t + 1);
  }, []);

  return (
    <>
      <AppBar
        titulo="Pendências"
        sub="tudo que está aberto nesta obra — as derivadas somem quando o fato muda; as de correção, só com um desfecho escolhido"
      />
      <Corpo>
        {estado.fase === "carregando" ? (
          <Carregando rotulo="Carregando as pendências" />
        ) : null}
        {estado.fase === "erro" ? (
          <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
        ) : null}

        {estado.fase === "pronto" ? (
          <ListaDePendencias
            unificadas={estado.unificadas}
            obra={estado.obra}
            obras={estado.obras}
            ano={estado.ano}
          />
        ) : null}
      </Corpo>
      <BarraAdicionar voltar={<BotaoLink href="/">Voltar ao início</BotaoLink>} />
    </>
  );
}

function ListaDePendencias({
  unificadas,
  obra,
  obras,
  ano,
}: {
  unificadas: PendenciasUnificadas;
  obra: Obra | null;
  obras: Map<string, string>;
  ano: number;
}) {
  const hoje = hojeIso();
  const vermelhas = unificadas.itens.filter((i) => i.bloco === "vermelho");
  const ambares = unificadas.itens.filter((i) => i.bloco === "ambar");
  const informativos = unificadas.itens.filter((i) => i.bloco === "informativo");
  const { correcoes, emitente } = unificadas.baixadas;

  return (
    <>
      {/* ⚠️ Fora da lista e fora da contagem, por exigência do Gate Fiscal
          (§2): esta é a tela que se lê ANTES de fechar a declaração, e o aviso
          de equiparação diz que os relatórios deste app podem não se aplicar à
          situação dele. É a ressalva mais cara do produto. Ele já traz a guarda
          por dentro e some sozinho quando não se aplica. */}
      {obra ? <AvisoEquiparacao obra={obra} /> : null}

      <EscopoDaLista obra={obra} ano={ano} />

      {unificadas.itens.length === 0 ? <NadaAberto obra={obra} ano={ano} /> : null}

      {vermelhas.length > 0 ? (
        <>
          {/* Sem teto, sem "ver todos (N)", sem colapso: a régua de cor só
              governa risco se a lista inteira estiver visível (Gate §4a). */}
          <Passo>Resolver primeiro</Passo>
          {vermelhas.map((item) => (
            <ItemDaFila key={item.id} item={item} obras={obras} hoje={hoje} />
          ))}
        </>
      ) : null}

      {ambares.length > 0 ? (
        <>
          <Passo>Resolver antes de declarar</Passo>
          {ambares.map((item) => (
            <ItemDaFila key={item.id} item={item} obras={obras} hoje={hoje} />
          ))}
        </>
      ) : null}

      {informativos.length > 0 ? (
        <>
          {/* Nunca omitido, e nunca na contagem: não há obrigação aberta nem
              ação possível hoje — é o calendário do banco (Gate §7.1). */}
          <Passo>Avisos — não dependem de você</Passo>
          {informativos.map((item) => (
            <ItemDaFila key={item.id} item={item} obras={obras} hoje={hoje} />
          ))}
        </>
      ) : null}

      {correcoes.length > 0 || emitente.length > 0 ? (
        <>
          <Passo>Histórico — pendências já tratadas</Passo>
          {correcoes.map((p) => (
            <Card key={p.id} data-pendencia-baixada={p.ano}>
              <div className="text-[11.5px] text-mut">
                {formatarDataBR(p.desfecho!.baixadaEm.slice(0, 10))} · por você
              </div>
              <div className="mt-0.5 font-semibold">
                pendência de retificadora — {p.ano} · baixada
              </div>
              <Dica>
                desfecho: {ROTULO_DESFECHO[p.desfecho!.desfecho]}
                {p.desfecho!.dataInformada
                  ? ` em ${formatarDataBR(p.desfecho!.dataInformada)}`
                  : ""}
              </Dica>
              <Dica>
                compunham a pendência: {p.quantidadeDeAtos}{" "}
                {p.quantidadeDeAtos === 1 ? "correção" : "correções"} ·{" "}
                {p.obras
                  .map(
                    (o) =>
                      `${obras.get(o.obraId) ?? "outra obra"} ${formatarBRL(o.antesCentavos)} → ${formatarBRL(o.depoisCentavos)}`,
                  )
                  .join(" · ")}
              </Dica>
            </Card>
          ))}
          {emitente.map((p) => (
            <Card key={p.id}>
              <div className="text-[11.5px] text-mut">
                {formatarDataBR(p.desfecho!.baixadaEm.slice(0, 10))} · por você
              </div>
              <div className="mt-0.5 font-semibold">CNPJ errado — baixada</div>
              <Dica>desfecho: {ROTULO_DESFECHO[p.desfecho!.desfecho]}</Dica>
            </Card>
          ))}
          <Dica>
            A baixa foi gravada <strong>por acréscimo</strong>: a pendência não
            foi editada nem removida. Esta lista só cresce, como o resto do
            acervo.
          </Dica>
        </>
      ) : null}
    </>
  );
}

/**
 * **Os dois escopos, ditos — nunca inferidos** (Gate Fiscal §3.4).
 *
 * Sem esta linha a página misturaria "todas as obras" (as persistentes) com "só
 * esta obra" (as derivadas) em silêncio, e a contagem passaria a significar duas
 * coisas ao mesmo tempo. Número que não se sabe do que é não decide nada.
 */
function EscopoDaLista({ obra, ano }: { obra: Obra | null; ano: number }) {
  if (obra === null) {
    return (
      <Banner cor="amb" role="status">
        <strong>Nenhuma obra aberta neste aparelho.</strong> Abaixo estão só as
        pendências de <strong>correção</strong>, que são de todas as suas obras.
        As outras dezesseis famílias dependem do estado atual de uma obra —
        quarentena, pago sem nota, terreno, financiamento, CNO —{" "}
        <strong>e não foram apuradas</strong>.{" "}
        <Link href="/obras" className="underline">
          Abrir uma obra
        </Link>
        .
      </Banner>
    );
  }
  return (
    <Dica>
      Pendências de <strong>correção</strong>: de todas as suas obras, cada uma
      nomeada. As <strong>demais</strong>: de{" "}
      <Link href={`/obras/${obra.id}`} className="underline">
        {obra.nome}
      </Link>
      , apuradas em {ano}.
    </Dica>
  );
}

/**
 * **O estado vazio — e ele NÃO diz "está tudo certo"** (Gate Fiscal §7.2).
 *
 * Afirmar ausência de pendência além do que o app apurou é reencenar a **D59**
 * justamente na tela que existe para matá-la, e desta vez na superfície que se
 * lê antes de declarar. O texto afirma **o que foi verificado e em que escopo**,
 * e diz que organizar não é assinar (§9).
 */
function NadaAberto({ obra, ano }: { obra: Obra | null; ano: number }) {
  return (
    <>
      <Banner cor="grn" role="status">
        <strong>Nada aberto no que este app apura.</strong>{" "}
        {obra === null ? (
          <>
            Nenhuma pendência de correção em nenhuma das suas obras. As demais
            famílias não foram apuradas — não há obra aberta neste aparelho.
          </>
        ) : (
          <>
            Nenhuma das dezoito famílias de pendência está aberta: nem as de
            correção, em nenhuma das suas obras, nem as que dependem do estado
            atual de {obra.nome} em {ano}.
          </>
        )}
      </Banner>
      <Dica>
        Isto não é um atestado de declaração pronta. O app organiza e informa —
        ele não assina declaração, e o que depende do seu contador continua
        dependendo dele.
      </Dica>
    </>
  );
}

/**
 * Uma linha da fila. **Cada família é desenhada pelo componente que já
 * existia** — `PendenciaCno`, `CardPagoSemComprovante`,
 * `CardDocumentosSemArquivo`, `PendenciaDeDatas` — e os textos vêm das mesmas
 * constantes de sempre.
 *
 * ⚠️ Re-emitir o conteúdo desses componentes aqui criaria a segunda cópia do
 * mesmo texto fiscal (o plural de "nota sem arquivo" e a linha do veto das
 * saídas anuais são **inline** lá dentro, sem constante) — é a D46 no ato.
 */
function ItemDaFila({
  item,
  obras,
  hoje,
}: {
  item: ItemDePendencia;
  obras: Map<string, string>;
  hoje: string;
}) {
  switch (item.familia) {
    // ── A primeira do grupo vermelho, e a razão não é a cor ──────────────
    // Prazo legal de 30 dias correndo contra um terceiro (Lei 8.212/91, art.
    // 49, II), dano que acumula POR NOTA e não começa no dia 31, e a única
    // pendência do app que impede a VENDA (sem averbação o banco do comprador
    // não financia e o cartório não lavra). Gate Fiscal §4 — quem reordenar
    // isto por estética está desfazendo adjudicação do `contador`.
    case "cno":
      return (
        <PendenciaCno
          obra={item.obra}
          hoje={hoje}
          acao={
            <BotaoLink href={`/obras/${item.obra.id}`}>
              Já registrei — informar o CNO
            </BotaoLink>
          }
        />
      );

    case "correcao_ano_anterior": {
      const p = item.correcao;
      return (
        <Card
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
          {/* ⚠️ Uma linha POR OBRA, com o delta DELA. Nunca somadas: dinheiro
              de duas obras na mesma linha é a soma que não existe em declaração
              nenhuma (critério 14 de /obras). */}
          {p.obras.map((o) => (
            <Linha key={o.obraId} rotulo={obras.get(o.obraId) ?? "outra obra"}>
              <span className="mono">
                {formatarBRL(o.antesCentavos)} →{" "}
                <span className="font-semibold">
                  {formatarBRL(o.depoisCentavos)}
                </span>
              </span>
            </Linha>
          ))}
          <Dica>
            aberta em {formatarDataBR(p.abertaEm.slice(0, 10))} · última correção
            em {formatarDataBR(p.ultimaCorrecaoEm.slice(0, 10))}
          </Dica>
          <Consequencia cor={GRAVIDADE_CORRECAO_ANO_ANTERIOR}>
            {AVISO_ANO_ANTERIOR}
          </Consequencia>
          <div className="mt-2.5">
            <BotaoLink href={`/pendencias/${p.id}`} variante="primary">
              Abrir a pendência de {p.ano}
            </BotaoLink>
          </div>
        </Card>
      );
    }

    case "emitente_errado": {
      const { persistente: p, sinal } = item;
      return (
        <Card
          className={bordaDaGravidade(sinal.gravidade)}
          data-pendencia-emitente={p.id}
        >
          <Chip cor={sinal.gravidade}>CNPJ errado — tratar</Chip>
          <div className="mt-1.5 font-semibold">
            O CNPJ do emitente de 1 documento está errado
          </div>
          <Dica>
            marcado por você em {formatarDataBR(p.abertaEm.slice(0, 10))}
          </Dica>
          <Consequencia cor={sinal.gravidade}>
            {EMITENTE_ERRADO_O_QUE_FALTA}
          </Consequencia>
          {/* Âmbar mesmo no card vermelho: informa a escalada, não a cor. */}
          {sinal.avisoAnoAnterior ? (
            <Consequencia cor="amb">{sinal.avisoAnoAnterior}</Consequencia>
          ) : null}
          <div className="mt-2.5">
            <BotaoLink href={`/documento/${p.documentoId}`}>
              Ver o documento marcado
            </BotaoLink>
          </div>
          <div className="mt-2">
            <BotaoLink href={`/pendencias/${p.id}`}>
              Como esta pendência termina
            </BotaoLink>
          </div>
        </Card>
      );
    }

    // ── As 7 de `ResumoObra.pendencias[]`, com o card que a home já usa ───
    case "quarentena":
    case "boleto_sem_nf":
    case "pago_sem_nota":
    case "diferenca_sem_explicacao":
    case "pago_sem_comprovante":
    case "retencao_sem_recolhedor":
    case "nf_servico_sem_cno":
      return <CardPendenciaDerivada pendencia={item.derivada} />;

    case "vinculo_cruzando_obras":
      return <CardVinculoCruzandoObras vinculo={item.vinculo} />;

    case "terreno_pago_sem_comprovante":
      return (
        <CardPagoSemComprovante
          totalCentavos={item.terrenoPagoSemComprovante.totalCentavos}
          quantidade={item.terrenoPagoSemComprovante.quantidade}
          href={item.terrenoPagoSemComprovante.href}
        />
      );

    case "documentos_sem_arquivo":
      return (
        <CardDocumentosSemArquivo
          totalCentavos={item.documentosSemArquivo.totalCentavos}
          quantidade={item.documentosSemArquivo.quantidade}
          href={item.documentosSemArquivo.href}
        />
      );

    case "terreno_sem_data":
      return <CardTerrenoSemData terreno={item.terrenoSemData} />;

    case "terreno_mais_de_uma_data":
      return (
        <Card className={bordaDaCor(COR_TERRENO_MAIS_DE_UMA_DATA)}>
          <PendenciaDeDatas
            valorCentavos={item.terrenoMaisDeUmaData.valorCentavos}
            titulo={item.terrenoMaisDeUmaData.titulo}
          >
            <BotaoLink href={item.terrenoMaisDeUmaData.href}>
              Abrir o desembolso
            </BotaoLink>
          </PendenciaDeDatas>
        </Card>
      );

    case "financiamento_falta_lancar":
      return (
        <CardFinanciamentoFaltaLancar
          financiamento={item.financiamentoFaltaLancar}
        />
      );

    // ── A 18ª família: o R$ 0,00 do terreno, que só existia DENTRO do card
    //    de custo confirmado da home (Gate Fiscal §1) ──────────────────────
    case "terreno_sem_registro":
      return <CardTerrenoSemRegistro terreno={item.terrenoSemRegistro} />;

    // ⚠️ `comAnoNoChip`: a home nomeia o ano no `Passo` que encabeça o bloco
    // dela; a fila não tem cabeçalho por família, e sem isto o ano se perderia.
    case "financiamento_aguardando_informe":
      return (
        <CardAguardandoInforme
          informe={item.financiamentoAguardandoInforme}
          comAnoNoChip
        />
      );

    // Exaustivo por construção: `ItemDePendencia` é união fechada por
    // `familia`, e família nova sem `case` cai aqui e **não compila** — a
    // mesma malha do teste-trava, no compilador.
    default: {
      const naoTratada: never = item;
      return naoTratada;
    }
  }
}
