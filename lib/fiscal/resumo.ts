/**
 * Resumo da home: custo confirmado do ano, acumulado do imóvel, as pendências
 * com a consequência fiscal explícita e — desde o CONTAI-018 — o TERCEIRO
 * ESTADO e as despesas já comprovadas. Módulo puro.
 *
 * Regras aplicadas (todas do parecer / CLAUDE.md):
 * - Custo é regime de caixa: entra pela DATA DO PAGAMENTO.
 * - Só conta como custo o pagamento coberto por documento hábil VINCULADO —
 *   boleto sozinho não sustenta, e documento em quarentena não é hábil.
 * - `pagamento.status` NÃO é consultado por decisão de custo nenhuma
 *   (parecer §2; critérios 4 e 7 do CONTAI-018). O cálculo inteiro vem de
 *   `lib/fiscal/vinculo.ts`.
 * - Acumulado = situação em 31/12 na ficha Bens e Direitos = terreno + obra.
 *   ⚠️ Mudou no CONTAI-010: o terreno deixou de ser três escalares somados
 *   inteiros em TODO ano e passou a ser `custoTerrenoAteOAno` — desembolsos
 *   DATADOS com ano ≤ o declarado, mais amortização + juros/correção dos
 *   informes anuais do financiamento. Regime de caixa também vale para o
 *   terreno: ITBI recolhido em 2025 não é custo de 2024.
 * - Nada é somado entre obras: a entrada é de UMA obra (CONTAI-003, crit. 9).
 *
 * ⚠️ **COMPROMISSO NÃO ENTRA AQUI POR CAMINHO NENHUM** (CONTAI-019, critério
 * 3; parecer de 2026-08-18, §2). Não em `custoConfirmadoAnoCentavos`, não em
 * `acumuladoImovelCentavos`, não em `emPendenciaCentavos`, não em
 * `notasSemPagamento` (o TERCEIRO NÚMERO, que "é composto por documentos, não
 * por previsões" — §2, item 6) e não em `despesas`.
 *
 * A proteção é de TIPO, não de atenção: `EntradaResumo` **não tem campo de
 * compromisso**, este arquivo **não importa `lib/fiscal/compromisso.ts`**, e
 * há teste afirmando as duas coisas. Um cálculo escrito daqui a seis meses não
 * pode ter como pegar um compromisso por engano — é essa a razão de o
 * compromisso viver em outra tabela, com outro tipo.
 */

import type {
  Documento,
  Financiamento,
  FinanciamentoInforme,
  Obra,
  Pagamento,
  TerrenoDesembolso,
  TipoFavorecido,
} from "@/lib/types";
import {
  CONSEQUENCIA_BOLETO,
  CONSEQUENCIA_QUARENTENA,
  CONSEQUENCIA_SEM_RETENCAO,
} from "./documento";
import {
  AGUARDANDO_INFORME,
  anosDoFinanciamento,
  custoDoInformeCentavos,
  custoTerrenoAteOAno,
  DESEMBOLSO_SEM_DATA,
  ESTIMATIVA_NAO_E_APURACAO,
  faltaLancarInforme,
  NOME_DO_DESEMBOLSO,
  TERRENO_ZERO_NAO_E_NADA_PAGO,
} from "./terreno";
import {
  anoCalendario,
  consequenciaPagoSemComprovante,
  rotulosPagoSemComprovante,
  rotulosPagoSemNota,
  textoDiferencaSemExplicacao,
} from "./pagamento";
import {
  alocarCusto,
  custoComprovadoAteOAno,
  custoComprovadoDoAno,
  despesasComprovadas,
  documentosHabeisSemPagamento,
  ehDocumentoHabil,
  valorBloqueadoPorComprovante,
  type Alocacao,
} from "./vinculo";

export type TipoPendencia =
  | "quarentena"
  | "boleto_sem_nf"
  | "pago_sem_nota"
  | "servico_sem_retencao"
  // ── CONTAI-019 ─────────────────────────────────────────────────────────
  // As duas entram no bloco de PENDÊNCIAS FISCAIS porque o dinheiro JÁ SAIU:
  // são fato consumado, mesma família de "pago sem nota". É o que as separa
  // do compromisso vencido, que é âmbar e mora no bloco de agendados —
  // **vermelho = dinheiro que saiu e não está no custo; âmbar = nada saiu
  // ainda** (critérios 19 e 31).
  | "pago_sem_comprovante"
  | "diferenca_sem_explicacao";

/** Registro individual por trás de uma pendência agregada — leva ao seletor. */
export interface ItemPendencia {
  id: string;
  rotulo: string;
  href: string;
}

export interface Pendencia {
  id: string;
  tipo: TipoPendencia;
  chip: string;
  titulo: string;
  detalhe: string;
  valorCentavos: number;
  consequencia: string;
  gravidade: "red" | "amb";
  /** Rota do detalhe, quando existe documento único por trás. */
  href?: string;
  /** Critério 3: o cartão "pago sem nota" leva ao seletor, registro a registro. */
  itens?: ItemPendencia[];
}

/**
 * O terceiro estado do parecer §5.2: nota hábil registrada, ainda sem
 * pagamento ligado. **Não soma** com o custo confirmado nem com o em risco —
 * é por isso que isto NÃO é uma `Pendencia` (a lista de pendências alimenta
 * `emPendenciaCentavos`, e somar aqui inflaria a exposição).
 */
export interface NotaSemPagamento {
  id: string;
  titulo: string;
  detalhe: string;
  valorCentavos: number;
  href: string;
}

/**
 * Critério 13: depois do vínculo a despesa aparece UMA vez — o par, não a NF e
 * o PIX lado a lado. É a resposta à palavra "duplicadas" do relato.
 */
export interface DespesaComprovada {
  id: string;
  titulo: string;
  detalhe: string;
  /** Custo comprovado do conjunto inteiro (todos os anos). */
  valorCentavos: number;
  /** A parte que cai no ano em tela — regime de caixa. */
  noAnoCentavos: number;
  href: string;
}

/**
 * Desembolso do terreno **pago** cuja data não se conhece — a linha herdada do
 * sem data de pagamento conhecida (critério 23).
 *
 * ⚠️ Campo PRÓPRIO, fora de `pendencias` e fora de todas as somas (critério
 * 21). Não é `Pendencia` porque a lista de pendências alimenta
 * `emPendenciaCentavos`, que é o headline de "custo em risco" do CONTAI-005 —
 * e o CONTAI-005 **não muda de código** neste ticket. É pendência de
 * COMPLEMENTO, não de risco fiscal: **não é bloqueio**.
 */
export interface TerrenoSemData {
  id: string;
  titulo: string;
  valorCentavos: number;
  /** Cópia literal do critério 23. */
  consequencia: string;
  href: string;
}

/**
 * O ano corrente sem informe anual (critério 16). Nomeado, **nunca em
 * silêncio**: o painel subestima o financiamento entre janeiro e a chegada do
 * informe, e isso é fato conhecido, não bug.
 *
 * ⚠️ Fora de todas as somas, como o anterior. A `estimativaCentavos` é ordem de
 * grandeza tirada do informe do ano anterior — **não é apuração e não soma em
 * lugar nenhum**.
 */
export interface FinanciamentoAguardandoInforme {
  ano: number;
  estimativaCentavos: number | null;
  aviso: string;
  sobreAEstimativa: string;
  href: string;
}

/**
 * Ano **JÁ FECHADO** sem informe lançado (critério 16). Não se confunde com o
 * anterior: aqui o extrato já foi publicado pelo banco, o dinheiro já saiu, e o
 * custo daquele ano-calendário simplesmente não existe no sistema.
 *
 * É o estado real da obra do Mateus hoje — contrato assinado, zero informes —
 * e era exatamente ele que a home calava.
 *
 * ⚠️ Fora de todas as somas, como os outros dois: não há valor a somar, porque
 * o número que faltaria é justamente o que ninguém lançou.
 */
export interface FinanciamentoFaltaLancar {
  ano: number;
  aviso: string;
  href: string;
}

/**
 * ⚠️ **O R$ 0,00 do terreno afirmado como situação de Bens e Direitos.**
 *
 * Sem nenhum desembolso datado e sem nenhum informe, a parte do terreno do
 * acumulado é zero — e zero apresentado sob o rótulo "situação em 31/12 na
 * ficha Bens e Direitos" é fato falso com moldura de fato apurado. Este campo
 * existe para a tela dizer que o zero é ausência de registro, não ausência de
 * pagamento.
 */
export interface TerrenoSemRegistro {
  /** A parte do terreno dentro do acumulado — zero, e é esse o ponto. */
  terrenoNoAcumuladoCentavos: number;
  aviso: string;
  href: string;
}

export interface ResumoObra {
  ano: number;
  custoConfirmadoAnoCentavos: number;
  acumuladoImovelCentavos: number;
  emPendenciaCentavos: number;
  pendencias: Pendencia[];
  /**
   * ⚠️ Os DOIS estados do terreno ficam aqui, em campo próprio, e **não** em
   * `pendencias`, **não** em `emPendenciaCentavos`, **não** em
   * `custoConfirmadoAnoCentavos`, **não** em `notasSemPagamento` e **não** em
   * `despesas` (critério 21). Há teste afirmando cada um desses "não".
   */
  terrenoSemData: TerrenoSemData[];
  financiamentoAguardandoInforme: FinanciamentoAguardandoInforme | null;
  /** Anos já fechados sem informe — do mais antigo para o mais recente. */
  financiamentoFaltaLancar: FinanciamentoFaltaLancar[];
  /** `null` quando existe algum valor datado no terreno. */
  terrenoSemRegistro: TerrenoSemRegistro | null;
  /** Terceiro número em tela (parecer §5.2) — fora das duas somas. */
  notasSemPagamento: NotaSemPagamento[];
  notasSemPagamentoCentavos: number;
  despesas: DespesaComprovada[];
  /** Critério 14: havendo registro, o zero nunca pode aparecer mudo. */
  temRegistro: boolean;
  /** Para as telas que precisam do detalhe por registro. */
  alocacao: Alocacao;
}

/**
 * ⚠️ **Quatro campos, e nenhum deles é compromisso** — nem virá a ser
 * (critério 3). A agenda de compromissos é montada em outra estrutura, por
 * `lib/fiscal/compromisso.ts`, e nunca se encontra com estes números.
 */
export interface EntradaResumo {
  obra: Obra;
  documentos: Documento[];
  pagamentos: Pagamento[];
  /**
   * CONTAI-010 — os desembolsos DATADOS do terreno. Obrigatório e não
   * opcional de propósito: `obra` não carrega mais valor de terreno nenhum, e
   * um campo opcional faria o custo do terreno sumir em silêncio de qualquer
   * chamador que esquecesse de passá-lo.
   */
  desembolsosTerreno: TerrenoDesembolso[];
  informesFinanciamento: FinanciamentoInforme[];
  /**
   * CONTAI-010 — o CONTRATO do financiamento, ou `null` quando a obra não tem.
   *
   * **Obrigatório e não opcional, pelo mesmo motivo de `desembolsosTerreno`**:
   * um campo opcional faria a home voltar a calar sobre o financiamento em
   * qualquer chamador que esquecesse de passá-lo — que foi exatamente o defeito
   * que este campo veio consertar (a existência do contrato era INFERIDA de
   * haver informe, então contrato assinado e zero informes = silêncio total).
   *
   * ⚠️ O `precoContratado` que ele carrega **nunca entra em soma nenhuma**
   * (critério 8). O que se lê daqui é a EXISTÊNCIA do contrato e a
   * `dataContrato`, que diz desde quando enumerar os anos.
   */
  financiamento: Financiamento | null;
  ano: number;
}

const SEM_FAVORECIDO = "Favorecido não informado";

const NOME_TIPO_CURTO: Record<Documento["tipo"], string> = {
  nf_material: "NF de material",
  nf_servico: "NF de serviço",
  boleto: "Boleto",
};

function dataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function calcularResumo(entrada: EntradaResumo): ResumoObra {
  const {
    obra,
    documentos,
    pagamentos,
    desembolsosTerreno,
    informesFinanciamento,
    financiamento,
    ano,
  } = entrada;

  // TODO o cálculo de custo sai daqui — e nenhuma linha dele olha `status`.
  const alocacao = alocarCusto({ documentos, pagamentos });

  const custoAno = custoComprovadoDoAno(alocacao, ano);
  const custoAteFimDoAno = custoComprovadoAteOAno(alocacao, ano);

  const pendencias: Pendencia[] = [];

  // 1 · Documento fora do CPF do dono → quarentena.
  for (const d of documentos) {
    if (d.status !== "quarentena") continue;
    pendencias.push({
      id: `quarentena:${d.id}`,
      tipo: "quarentena",
      chip: "Quarentena",
      titulo: d.tipo === "boleto" ? "Boleto fora do seu CPF" : "NF fora do seu CPF",
      detalhe: d.favorecidoNome ?? SEM_FAVORECIDO,
      valorCentavos: d.valorCentavos ?? 0,
      consequencia: CONSEQUENCIA_QUARENTENA,
      gravidade: "red",
      href: `/documento/${d.id}`,
    });
  }

  // 2 · Boleto registrado: título de cobrança, ainda sem NF que sustente.
  for (const d of documentos) {
    if (d.tipo !== "boleto" || d.status !== "aguardando_pagamento") continue;
    pendencias.push({
      id: `boleto:${d.id}`,
      tipo: "boleto_sem_nf",
      // O chip reflete o estado gravado (`aguardando_pagamento`): o boleto
      // ainda não foi pago. O ciclo de vida completo do boleto continua fora.
      chip: "Aguardando pagamento",
      titulo: "Boleto sem nota vinculada",
      detalhe: d.favorecidoNome ?? SEM_FAVORECIDO,
      valorCentavos: d.valorCentavos ?? 0,
      consequencia: CONSEQUENCIA_BOLETO,
      gravidade: "amb",
      href: `/documento/${d.id}`,
    });
  }

  // 3 · Exposição "pago sem nota", acumulada por favorecido (US-007, item 4).
  //
  // Mudou no CONTAI-018: o que expõe NÃO é mais `status === 'aguardando_nf'`
  // (filtro que o parecer §2 derrubou), é o EXCEDENTE NÃO COBERTO do
  // pagamento. Pagamento coberto por inteiro some daqui — critério 13, a
  // despesa vinculada deixa de aparecer duas vezes.
  const porFavorecido = new Map<
    string,
    {
      nome: string;
      tipo: TipoFavorecido | null;
      total: number;
      qtd: number;
      sohPix: boolean;
      itens: ItemPendencia[];
    }
  >();
  for (const p of pagamentos) {
    const semNota = alocacao.porPagamento.get(p.id)?.semNotaCentavos ?? 0;
    if (semNota <= 0) continue;
    const chave = p.favorecidoId ?? `sem-favorecido:${p.id}`;
    const atual = porFavorecido.get(chave) ?? {
      nome: p.favorecidoNome ?? SEM_FAVORECIDO,
      tipo: p.favorecidoTipo,
      total: 0,
      qtd: 0,
      sohPix: true,
      itens: [],
    };
    atual.total += semNota;
    atual.qtd += 1;
    atual.sohPix = atual.sohPix && p.meio === "pix";
    atual.itens.push({
      id: p.id,
      rotulo: dataBR(p.dataPagamento),
      href: `/pagamento/${p.id}`,
    });
    porFavorecido.set(chave, atual);
  }
  for (const [chave, agregado] of porFavorecido) {
    const unidade = agregado.sohPix
      ? "PIX"
      : agregado.qtd === 1
        ? "pagamento"
        : "pagamentos";
    const rotulos = rotulosPagoSemNota(agregado.tipo);
    pendencias.push({
      id: `pago-sem-nota:${chave}`,
      tipo: "pago_sem_nota",
      chip: rotulos.chip,
      titulo: `${agregado.qtd} ${unidade} ${rotulos.semVinculo}`,
      detalhe: agregado.nome,
      valorCentavos: agregado.total,
      consequencia: rotulos.consequencia,
      gravidade: "red",
      itens: agregado.itens,
    });
  }

  // 3b · Diferença não explicada — o "em revisão" do CONTAI-019 (§F.4).
  //
  // Fica AQUI, no bloco de pendências fiscais, e não numa lista própria: o
  // pagamento está gravado, é fato consumado com dinheiro fora do custo. O que
  // o parecer §2.5 mantém fora deste bloco é o COMPROMISSO, porque nada saiu.
  //
  // Só aparece enquanto não há resposta. `erro_digitacao` conta como sem
  // resposta de propósito (§F.2, item 4): "errei o valor digitado" não é
  // classificação fiscal, é correção de registro com rastro — o `CONTAI-021`.
  // Enquanto a correção não acontece, o dinheiro continua fora do custo e a
  // pendência continua de pé; tratá-la como resolvida faria o alerta sumir sem
  // que nada tivesse mudado no mundo.
  //
  // ⚠️ Esta pendência NÃO bloqueia o relatório anual (critério 31b), ao
  // contrário do compromisso vencido: aqui o fato consumado já está
  // registrado e o único erro possível SUBESTIMA o custo.
  for (const p of pagamentos) {
    if (p.naoExplicadoCentavos <= 0) continue;
    if (p.resolucaoDiferenca !== null && p.resolucaoDiferenca !== "erro_digitacao") {
      continue;
    }
    pendencias.push({
      id: `diferenca:${p.id}`,
      tipo: "diferenca_sem_explicacao",
      chip: "Diferença sem explicação",
      titulo: "Pagamento com diferença sem explicação",
      detalhe: p.favorecidoNome ?? SEM_FAVORECIDO,
      valorCentavos: p.naoExplicadoCentavos,
      // Texto LITERAL do §F.4, com o valor interpolado (critério 31e). A
      // minuta anterior foi reprovada por ancorar a consequência no PREVISTO —
      // previsão não decide custo; quem limita é o documento hábil.
      consequencia: textoDiferencaSemExplicacao(p.naoExplicadoCentavos),
      gravidade: "red",
      href: `/pagamento/${p.id}`,
    });
  }

  // 3c · Pago sem comprovante (critérios 46-47, ADENDO 2 §5).
  //
  // O pagamento GRAVOU — *nunca recuse o registro de um fato consumado* — e
  // não entra no custo confirmado até o comprovante existir. O peso muda com o
  // favorecido, e a diferença é fiscal: para PF o comprovante é CONSTITUTIVO
  // (sem o rastro bancário não existe condição 3), para PJ é reforço
  // probatório forte sobre uma NF que já sustenta o resto.
  //
  // O valor é o BLOQUEADO PELO COMPROVANTE, não o valor cheio: encargos e
  // diferença sem explicação já estão fora por motivos próprios e aparecem nas
  // suas próprias linhas. As parcelas particionam o pagamento — o mesmo
  // dinheiro nunca é contado em duas pendências.
  for (const p of pagamentos) {
    const bloqueado = valorBloqueadoPorComprovante(p);
    if (bloqueado <= 0) continue;
    const rotulos = rotulosPagoSemComprovante(p.favorecidoTipo);
    // Falta SÓ o comprovante, ou faltam os dois? A pendência tem de nomear os
    // dois buracos quando os dois existem — senão anexar o comprovante faz
    // nascer um vermelho novo, e o app parece mudar de exigência.
    const temDocumentoHabil = documentos.some(
      (d) => p.documentoIds.includes(d.id) && ehDocumentoHabil(d),
    );
    pendencias.push({
      id: `sem-comprovante:${p.id}`,
      tipo: "pago_sem_comprovante",
      chip: rotulos.chip,
      titulo: temDocumentoHabil
        ? "Pagamento sem comprovante anexado"
        : "Pagamento sem comprovante e sem nota",
      detalhe: p.favorecidoNome ?? SEM_FAVORECIDO,
      valorCentavos: bloqueado,
      consequencia: consequenciaPagoSemComprovante(
        p.favorecidoTipo,
        temDocumentoHabil,
      ),
      gravidade: rotulos.gravidade,
      href: `/pagamento/${p.id}`,
    });
  }

  // 4 · NF de serviço sem retenção confirmada → não abate no INSS (SERO).
  for (const d of documentos) {
    if (d.tipo !== "nf_servico" || d.status === "quarentena") continue;
    if (d.retencao11 === true) continue;
    pendencias.push({
      id: `sem-retencao:${d.id}`,
      tipo: "servico_sem_retencao",
      chip: "Sem retenção 11%",
      titulo: "NF de serviço sem retenção",
      detalhe: d.favorecidoNome ?? SEM_FAVORECIDO,
      valorCentavos: d.valorCentavos ?? 0,
      consequencia: CONSEQUENCIA_SEM_RETENCAO,
      gravidade: "amb",
      href: `/documento/${d.id}`,
    });
  }

  const emPendencia = pendencias.reduce((s, p) => s + p.valorCentavos, 0);

  // O terceiro estado. Fica FORA de `pendencias` de propósito: o parecer §5.2
  // exige que este número não some com o confirmado nem com o em risco.
  const notasSemPagamento: NotaSemPagamento[] = documentosHabeisSemPagamento(
    alocacao,
  ).map(({ documento: d }) => ({
    id: `sem-pagamento:${d.id}`,
    titulo: `${NOME_TIPO_CURTO[d.tipo]} sem pagamento ligado`,
    detalhe: d.favorecidoNome ?? SEM_FAVORECIDO,
    valorCentavos: d.valorCentavos ?? 0,
    href: `/documento/${d.id}`,
  }));

  // Mais recente primeiro: é o que o Mateus acabou de conciliar. A ordenação
  // vem antes do `map` para o tipo de saída não carregar campo de ordenação.
  const despesas: DespesaComprovada[] = [...despesasComprovadas(alocacao)]
    .sort((a, b) =>
      (a.pagamentos.at(-1)?.dataPagamento ?? "") <
      (b.pagamentos.at(-1)?.dataPagamento ?? "")
        ? 1
        : -1,
    )
    .map((c) => {
      // `ehDocumentoHabil` e não o predicado escrito à mão: duas definições de
      // "documento hábil" descolam em silêncio no dia em que a regra mudar.
      const habeis = c.documentos.filter(ehDocumentoHabil);
      const noAno = c.pagamentos.reduce(
        (s, p) =>
          anoCalendario(p.dataPagamento) === ano
            ? s + (alocacao.porPagamento.get(p.id)?.comprovadoCentavos ?? 0)
            : s,
        0,
      );
      const doc = habeis[0] ?? c.documentos[0];
      const nomes = [...new Set(habeis.map((d) => d.favorecidoNome ?? SEM_FAVORECIDO))];
      return {
        id: c.id,
        titulo: nomes.join(" · ") || SEM_FAVORECIDO,
        detalhe:
          `${habeis.length} ${habeis.length === 1 ? "documento hábil" : "documentos hábeis"}` +
          ` + ${c.pagamentos.length} ${c.pagamentos.length === 1 ? "pagamento" : "pagamentos"}` +
          " — uma despesa, não duas",
        valorCentavos: c.custoComprovadoCentavos,
        noAnoCentavos: noAno,
        href: doc ? `/documento/${doc.id}` : `/pagamento/${c.pagamentos[0].id}`,
      };
    });

  // ── CONTAI-010 · os dois estados do terreno, FORA de toda soma ─────────
  //
  // Ficam depois do `emPendencia` de propósito: nenhum dos dois participa
  // daquela soma. O primeiro é pendência de COMPLEMENTO (falta um dado que só
  // o Mateus tem); o segundo é o calendário do banco. Nenhum é risco fiscal.
  const terrenoSemData: TerrenoSemData[] = desembolsosTerreno
    .filter((d) => d.estado === "pago" && d.dataPagamento === null)
    .map((d) => ({
      id: `terreno-sem-data:${d.id}`,
      titulo: `${NOME_DO_DESEMBOLSO[d.tipo]} — falta a data`,
      valorCentavos: d.valorCentavos,
      consequencia: DESEMBOLSO_SEM_DATA,
      href: `/obras/${obra.id}/terreno/desembolsos`,
    }));

  // ⚠️ A CONDIÇÃO É O CONTRATO, não a existência de informe.
  //
  // A versão anterior disparava com `informesFinanciamento.length > 0`, e o
  // dilema que a justificava — "sem informe não dá para saber se há
  // financiamento, e afirmar 'aguardando informe' numa obra à vista é pior que
  // calar" — era FALSO: `carregarPainel` já carregava o contrato, e bastava
  // trazê-lo até aqui. Com contrato assinado e ZERO informes, que é o estado
  // real da obra hoje, a home ficava muda e o acumulado subestimava ~R$ 60 mil
  // por ano-base não lançado. Critério 16: nunca em silêncio.
  //
  // Sem financiamento (`null`), nada é afirmado — a obra à vista continua sem
  // ver uma palavra sobre informe, que é o comportamento certo.
  const temInformeDoAno = informesFinanciamento.some((i) => i.anoBase === ano);
  const informeAnterior = informesFinanciamento.find(
    (i) => i.anoBase === ano - 1,
  );
  const financiamentoAguardandoInforme: FinanciamentoAguardandoInforme | null =
    financiamento !== null && !temInformeDoAno
      ? {
          ano,
          // ⚠️ Ordem de grandeza, NUNCA somada — ver `ESTIMATIVA_NAO_E_APURACAO`.
          estimativaCentavos: informeAnterior
            ? custoDoInformeCentavos(informeAnterior)
            : null,
          aviso: AGUARDANDO_INFORME,
          sobreAEstimativa: ESTIMATIVA_NAO_E_APURACAO,
          href: `/obras/${obra.id}/terreno`,
        }
      : null;

  // Os anos JÁ FECHADOS sem informe — o caso que dói hoje. `anosDoFinanciamento`
  // é a mesma função que o painel do terreno usa: uma definição só de "desde
  // quando enumerar" e de "o que é falta_lancar".
  const financiamentoFaltaLancar: FinanciamentoFaltaLancar[] =
    financiamento === null
      ? []
      : anosDoFinanciamento(financiamento.dataContrato, informesFinanciamento, ano)
          .filter((a) => a.situacao === "falta_lancar")
          .map((a) => ({
            ano: a.ano,
            aviso: faltaLancarInforme(a.ano),
            href: `/obras/${obra.id}/terreno/informe/${a.ano}`,
          }));

  // O R$ 0,00 do terreno: ausência de registro, nunca ausência de pagamento.
  // A condição é "nenhum valor DATADO e nenhum informe" — é a mesma coisa que
  // `custoTerrenoAteOAno === 0`, e é deliberadamente mais larga que "nenhum
  // desembolso": uma linha `pago` sem data também deixa o acumulado em zero, e
  // nesse caso o zero mente exatamente igual.
  const terrenoNoAcumuladoCentavos = custoTerrenoAteOAno(
    desembolsosTerreno,
    informesFinanciamento,
    ano,
  );
  const terrenoSemRegistro: TerrenoSemRegistro | null =
    terrenoNoAcumuladoCentavos === 0
      ? {
          terrenoNoAcumuladoCentavos,
          aviso: TERRENO_ZERO_NAO_E_NADA_PAGO,
          href: `/obras/${obra.id}/terreno`,
        }
      : null;

  return {
    ano,
    custoConfirmadoAnoCentavos: custoAno,
    // Conserta de carona o defeito original (terreno inteiro em todo ano): só
    // o que foi efetivamente desembolsado até 31/12 deste ano entra.
    acumuladoImovelCentavos: terrenoNoAcumuladoCentavos + custoAteFimDoAno,
    emPendenciaCentavos: emPendencia,
    pendencias,
    terrenoSemData,
    financiamentoAguardandoInforme,
    financiamentoFaltaLancar,
    terrenoSemRegistro,
    notasSemPagamento,
    notasSemPagamentoCentavos: notasSemPagamento.reduce(
      (s, n) => s + n.valorCentavos,
      0,
    ),
    despesas,
    temRegistro: documentos.length > 0 || pagamentos.length > 0,
    alocacao,
  };
}
