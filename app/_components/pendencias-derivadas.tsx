"use client";

/**
 * **Os cards das pendências DERIVADAS — uma fonte só, duas superfícies
 * (CONTAI-042, Gate 2).**
 *
 * Estes seis cards nasceram dentro de `app/page.tsx` e, na primeira versão
 * deste ticket, foram **copiados** para `app/pendencias/page.tsx`. O `cto-obra`
 * reprovou, e com razão: texto fiscal inline em dois arquivos é a **D46** — o
 * mesmo fato com dois rostos, divergindo no dia em que só um for atualizado. E
 * o `CONTAI-040`, que consome a mesma lista no dashboard, seria a **terceira**
 * cópia.
 *
 * É o mesmo remédio que `pago-sem-comprovante.tsx` e `documento-sem-arquivo.tsx`
 * já aplicavam às famílias deles: *"um componente, duas telas — e a unificação é
 * o ponto"*.
 *
 * ⚠️ **Nenhuma frase fiscal é redigida aqui.** O que é constante vem de
 * `lib/fiscal/*`; o que é dado (`consequencia`, `aviso`, `titulo`) vem do
 * `ResumoObra`. Esta camada só desenha.
 *
 * ⚠️ **A cor também não nasce aqui**: as das famílias portadas vêm das
 * constantes nomeadas do `CONTAI-042` (ver `lib/fiscal/gravidade.ts`,
 * `bordaDaCor`), e a das sete derivadas vem do `Gravidade` branded que cada uma
 * já carrega.
 */

import { BotaoLink, Card, Chip, Consequencia, Dica } from "@/app/_components/ui";
import { BOLETO_FORA_DO_TOTAL } from "@/lib/fiscal/documento";
import { bordaDaCor } from "@/lib/fiscal/gravidade";
import type {
  FinanciamentoAguardandoInforme,
  FinanciamentoFaltaLancar,
  Pendencia,
  TerrenoSemData,
  TerrenoSemRegistro,
  VinculoCruzandoObras,
} from "@/lib/fiscal/resumo";
import {
  COR_AGUARDANDO_INFORME,
  COR_TERRENO_SEM_DATA,
  COR_TERRENO_SEM_REGISTRO,
} from "@/lib/fiscal/terreno";
import {
  COR_VINCULO_CRUZANDO_OBRAS,
  VINCULO_CRUZANDO_OBRAS_EFEITO,
  VINCULO_CRUZANDO_OBRAS_NAO_DEVERIA_EXISTIR,
  VINCULO_CRUZANDO_OBRAS_TITULO,
} from "@/lib/fiscal/vinculo";
import { formatarBRL } from "@/lib/money";

/**
 * O rótulo da ação de cada uma das sete famílias de `ResumoObra.pendencias[]`.
 *
 * ⚠️ **`Partial<Record<Pendencia["tipo"], string>>`, e não `Record<string,
 * string>`**: o tipo estrito é o que faz uma família NOVA de `TipoPendencia`
 * aparecer aqui em review em vez de silenciosamente não ter ação. A versão
 * frouxa nasceu na cópia reprovada no Gate 2 e não volta.
 *
 * As ausentes são deliberadas: `pago_sem_nota` age pelos `itens` (um link por
 * registro) e `nf_servico_sem_cno` traz a ação no próprio detalhe, ao lado do
 * prestador — é dele que se cobra.
 */
const ACAO_POR_TIPO: Partial<Record<Pendencia["tipo"], string>> = {
  quarentena: "Resolver",
  boleto_sem_nf: "Ver detalhes",
  // CONTAI-038 — mesmo rótulo que a pendência antiga usava: o remédio continua
  // sendo abrir a nota. O que mudou lá dentro é o que ele encontra — o repeater
  // e a pergunta "quem recolhe", em vez de um aviso sem ação.
  retencao_sem_recolhedor: "Ver detalhes",
  // CONTAI-019: as duas se resolvem no detalhe do pagamento — a diferença pelas
  // quatro resoluções do §F.2, o comprovante pelo anexo.
  diferenca_sem_explicacao: "Explicar a diferença",
  pago_sem_comprovante: "Anexar o comprovante",
};

/** Uma das sete famílias de `ResumoObra.pendencias[]`. */
export function CardPendenciaDerivada({ pendencia: p }: { pendencia: Pendencia }) {
  return (
    <Card>
      <Chip cor={p.gravidade}>{p.chip}</Chip>
      <div className="mt-1.5 font-semibold">{p.titulo}</div>
      <Dica>
        {p.detalhe} · <span className="mono">{formatarBRL(p.valorCentavos)}</span>
      </Dica>
      <Consequencia cor={p.gravidade}>{p.consequencia}</Consequencia>
      {/* CONTAI-005, Bloco 3 · a linha NOVA do card de boleto — as duas de cima
          não mudaram. Ela existe porque o boleto saiu do headline: sem dizer
          isso, o número teria encolhido em silêncio. */}
      {p.tipo === "boleto_sem_nf" ? <Dica>{BOLETO_FORA_DO_TOTAL}</Dica> : null}
      {p.href && ACAO_POR_TIPO[p.tipo] ? (
        <div className="mt-2.5">
          <BotaoLink href={p.href}>{ACAO_POR_TIPO[p.tipo]}</BotaoLink>
        </div>
      ) : null}
      {/* Critério 3: o cartão "pago sem nota" leva ao seletor inverso — metade
          do parque de registros nasceu como PIX e não tinha porta nenhuma. */}
      {p.itens?.map((item) => (
        <div key={item.id} className="mt-2.5">
          <BotaoLink href={item.href}>Ligar a uma nota — {item.rotulo}</BotaoLink>
        </div>
      ))}
    </Card>
  );
}

/**
 * **CONTAI-008, critério 12 · a REDE, não a porta.** As duas portas por onde
 * este estado nascia estão fechadas (migrations 0009 e 0016); o card é o que
 * sobra para o dia em que uma porta nova aparecer. Fora de `pendencias` e das
 * somas — não é dinheiro novo em risco, é defeito de dado.
 */
export function CardVinculoCruzandoObras({
  vinculo,
}: {
  vinculo: VinculoCruzandoObras;
}) {
  return (
    <Card className={bordaDaCor(COR_VINCULO_CRUZANDO_OBRAS)}>
      <Chip cor={COR_VINCULO_CRUZANDO_OBRAS}>
        {VINCULO_CRUZANDO_OBRAS_TITULO}
      </Chip>
      <Consequencia cor={COR_VINCULO_CRUZANDO_OBRAS}>
        {VINCULO_CRUZANDO_OBRAS_EFEITO}
      </Consequencia>
      <Dica>{VINCULO_CRUZANDO_OBRAS_NAO_DEVERIA_EXISTIR}</Dica>
      <div className="mt-2.5">
        <BotaoLink href={vinculo.href}>Abrir o pagamento</BotaoLink>
      </div>
    </Card>
  );
}

/**
 * **VERMELHO desde 23/08 (D39 revisada)** — o valor está pago e não cai em ano
 * nenhum: não é a pendência mais leve da tela, é uma das mais graves. Era âmbar
 * por herança do CONTAI-027.
 */
export function CardTerrenoSemData({ terreno }: { terreno: TerrenoSemData }) {
  return (
    <Card className={bordaDaCor(COR_TERRENO_SEM_DATA)}>
      <Chip cor={COR_TERRENO_SEM_DATA}>Falta a data</Chip>
      <div className="mt-1.5 font-semibold">{terreno.titulo}</div>
      <Dica>
        <span className="mono">{formatarBRL(terreno.valorCentavos)}</span>
      </Dica>
      <Consequencia cor={COR_TERRENO_SEM_DATA}>
        {terreno.consequencia}. <strong>Não bloqueia o app</strong> — fica como
        pendência até você preencher.
      </Consequencia>
      <div className="mt-2.5">
        <BotaoLink href={terreno.href}>Informar a data</BotaoLink>
      </div>
    </Card>
  );
}

/**
 * Ano JÁ FECHADO sem informe — o extrato existe, o dinheiro saiu, e o custo
 * daquele ano não existe no sistema.
 *
 * ⚠️ A cor **vem calculada** (`f.gravidade`, CONTAI-035 item B) e não escrita:
 * era aqui que a home e o painel do terreno divergiam da régua ao mesmo tempo.
 */
export function CardFinanciamentoFaltaLancar({
  financiamento: f,
}: {
  financiamento: FinanciamentoFaltaLancar;
}) {
  return (
    <Card className={bordaDaCor(f.gravidade)} data-falta-lancar={f.ano}>
      <Chip cor={f.gravidade}>falta lançar {f.ano}</Chip>
      <Consequencia cor={f.gravidade}>{f.aviso}</Consequencia>
      <div className="mt-2.5">
        <BotaoLink href={f.href} variante="primary">
          Registrar informe de {f.ano}
        </BotaoLink>
      </div>
    </Card>
  );
}

/**
 * O ano corrente sem informe — **aviso, não cobrança**: nada depende do Mateus,
 * é o calendário do banco. Por isso fica fora da contagem de abertas da fila
 * unificada, e por isso a estimativa é cinza, rotulada e **fora de toda soma**.
 *
 * @param comAnoNoChip a home põe o ano no `Passo` que encabeça o bloco; a fila
 * unificada não tem cabeçalho por família, e sem isto o ano se perderia lá. É a
 * única diferença legítima entre as duas superfícies — o resto é idêntico.
 */
export function CardAguardandoInforme({
  informe: f,
  comAnoNoChip = false,
}: {
  informe: FinanciamentoAguardandoInforme;
  comAnoNoChip?: boolean;
}) {
  return (
    <Card>
      <Chip cor={COR_AGUARDANDO_INFORME} vazado>
        {comAnoNoChip ? `Aguardando informe de ${f.ano}` : "Aguardando informe"}
      </Chip>
      <Consequencia cor={COR_AGUARDANDO_INFORME}>{f.aviso}</Consequencia>
      {f.estimativaCentavos !== null ? (
        <>
          {/* Cinza, rotulada, FORA de toda soma. */}
          <div className="mono mt-1.5 text-[14px] text-mut">
            Ordem de grandeza do que falta: ≈ {formatarBRL(f.estimativaCentavos)}
          </div>
          <Dica>{f.sobreAEstimativa}</Dica>
        </>
      ) : null}
      <div className="mt-2.5">
        <BotaoLink href={f.href}>Ver o terreno ano a ano</BotaoLink>
      </div>
    </Card>
  );
}

/**
 * **As duas metades COMUNS do "terreno sem registro"** — a consequência e a
 * ação.
 *
 * ⚠️ Só isto é compartilhado, e a razão é que as duas superfícies desenham o
 * NÚMERO de formas legitimamente diferentes: na home ele aparece nomeado
 * (*"Terreno nesta soma"*) **dentro** do card de custo confirmado, para o
 * "R$ 0,00 aqui" do aviso apontar para um número visível e não para a soma
 * inteira; na fila unificada ele é o valor da própria linha. O que não podia
 * estar em dois lugares — a frase e o rótulo do botão — está aqui.
 */
export function AvisoTerrenoSemRegistro({
  terreno,
}: {
  terreno: TerrenoSemRegistro;
}) {
  return (
    <>
      <Consequencia cor={COR_TERRENO_SEM_REGISTRO}>{terreno.aviso}</Consequencia>
      <div className="mt-2.5">
        <BotaoLink href={terreno.href}>
          Registrar os desembolsos do terreno
        </BotaoLink>
      </div>
    </>
  );
}

/** A 18ª família com linha própria na fila unificada (CONTAI-042). */
export function CardTerrenoSemRegistro({
  terreno,
}: {
  terreno: TerrenoSemRegistro;
}) {
  return (
    <Card
      className={bordaDaCor(COR_TERRENO_SEM_REGISTRO)}
      data-pendencia="terreno-sem-registro"
    >
      <Chip cor={COR_TERRENO_SEM_REGISTRO}>Terreno sem registro</Chip>
      {/* O R$ 0,00 aparece NOMEADO: é dele que o aviso fala, e ele não é uma
          apuração — é a ausência dela. */}
      <div className="mono mt-1.5 text-[20px] font-semibold">
        {formatarBRL(terreno.terrenoNoAcumuladoCentavos)}
      </div>
      <AvisoTerrenoSemRegistro terreno={terreno} />
    </Card>
  );
}
