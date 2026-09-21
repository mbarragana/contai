"use client";

/**
 * **A fila unificada na tela — as dezoito famílias desenhadas uma a uma.**
 *
 * Extraído de `app/pendencias/page.tsx` no `CONTAI-040`: o dashboard mostra as
 * **quatro mais graves** e a view Pendências mostra a fila inteira, e o critério
 * 9 do ticket é explícito em que o painel do dashboard *"é um subconjunto dos
 * mesmos itens, nunca um resumo com texto reescrito"*. Com os dois lendo o mesmo
 * componente, não existe caminho para o texto divergir — que é a D46 (o mesmo
 * fato com dois rostos, e o Mateus decidindo em qual acreditar).
 *
 * ⚠️ **Cada família é desenhada pelo componente que já existia** —
 * `PendenciaCno`, `CardPagoSemComprovante`, `CardDocumentosSemArquivo`,
 * `PendenciaDeDatas` — e os textos vêm das mesmas constantes de sempre.
 * Re-emitir o conteúdo desses componentes aqui criaria a segunda cópia do mesmo
 * texto fiscal (o plural de "nota sem arquivo" e a linha do veto das saídas
 * anuais são **inline** lá dentro, sem constante) — é a D46 no ato.
 */

import { PendenciaCno } from "@/app/_components/obra";
import { CardDocumentosSemArquivo } from "@/app/_components/documento-sem-arquivo";
import { PendenciaDeDatas } from "@/app/_components/datas-do-desembolso";
import { CardPagoSemComprovante } from "@/app/_components/pago-sem-comprovante";
import {
  CardAguardandoInforme,
  CardFinanciamentoFaltaLancar,
  CardPendenciaDerivada,
  CardTerrenoSemData,
  CardTerrenoSemRegistro,
  CardVinculoCruzandoObras,
} from "@/app/_components/pendencias-derivadas";
import {
  Banner,
  BotaoLink,
  Card,
  Chip,
  Consequencia,
  Dica,
  Linha,
} from "@/app/_components/ui";
import { bordaDaCor, bordaDaGravidade } from "@/lib/fiscal/gravidade";
import { formatarDataBR } from "@/lib/fiscal/obra";
import type { ItemDePendencia } from "@/lib/fiscal/pendencias-unificadas";
import {
  AVISO_ANO_ANTERIOR,
  EMITENTE_ERRADO_O_QUE_FALTA,
  GRAVIDADE_CORRECAO_ANO_ANTERIOR,
} from "@/lib/fiscal/revisao";
import { COR_TERRENO_MAIS_DE_UMA_DATA } from "@/lib/fiscal/terreno";
import { formatarBRL } from "@/lib/money";
import type { Obra } from "@/lib/types";

/**
 * Uma linha da fila. O invólucro carrega a família em `data-item-pendencia`:
 * é o que permite CONTAR itens da fila numa superfície e na outra sem inventar
 * um seletor por família — e é a contagem que prova que o badge da sidebar e a
 * lista de `/pendencias` falam do mesmo conjunto.
 */
export function ItemDaFila({
  item,
  obras,
  hoje,
}: {
  item: ItemDePendencia;
  obras: Map<string, string>;
  hoje: string;
}) {
  return (
    <div data-item-pendencia={item.familia}>
      <CorpoDoItem item={item} obras={obras} hoje={hoje} />
    </div>
  );
}

function CorpoDoItem({
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

    // ── As 7 de `ResumoObra.pendencias[]`, com o card que a home já usava ─
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

/**
 * **O estado vazio — e ele NÃO diz "está tudo certo"** (Gate Fiscal §7.2 do
 * `CONTAI-042`).
 *
 * Afirmar ausência de pendência além do que o app apurou é reencenar a **D59**
 * justamente na superfície que existe para matá-la. O texto afirma **o que foi
 * verificado e em que escopo**, e diz que organizar não é assinar (§9).
 *
 * ⚠️ Usado pela view Pendências **e** pelo painel do dashboard: um "nenhuma
 * pendência" escrito de novo no dashboard seria a D59 de volta pela porta que o
 * `CONTAI-042` acabou de fechar.
 */
export function NadaAberto({ obra, ano }: { obra: Obra | null; ano: number }) {
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
