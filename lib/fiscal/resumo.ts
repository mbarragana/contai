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
 * `acumuladoImovelCentavos`, não em `custoEmRiscoIr`, não em
 * `notasSemPagamento` (o TERCEIRO NÚMERO, que "é composto por documentos, não
 * por previsões" — §2, item 6) e não em `despesas`.
 *
 * ⚠️ **`emPendenciaCentavos` MORREU no CONTAI-005**, e não coexiste com o que
 * entrou no lugar: ele somava quatro moedas (perda de custo, conta a pagar,
 * base de INSS) e podia contar o mesmo dispêndio duas vezes. O headline agora é
 * `custoEmRiscoIr` (`lib/fiscal/risco.ts`), a exposição previdenciária é
 * `exposicaoInssBaseCentavos`, **em base**, e as duas nunca se somam. Dois
 * agregados no mesmo módulo seria o convite para a próxima tela usar o errado.
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
  faltaOArquivo,
} from "./documento";
import { ACAO_NOTA_SEM_CNO, CONSEQUENCIA_CNO_DA_NOTA } from "./obra";
import {
  custoEmRiscoIr,
  exposicaoInssBaseCentavos,
  type CustoEmRiscoIr,
} from "./risco";
import {
  AGUARDANDO_INFORME,
  anosDoFinanciamento,
  custoDoInformeCentavos,
  custoTerrenoAteOAno,
  DESEMBOLSO_SEM_DATA,
  ESTIMATIVA_NAO_E_APURACAO,
  faltaLancarInforme,
  NOME_DO_DESEMBOLSO,
  pagosSemComprovante,
  pendenciaDeDatasAberta,
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
  | "diferenca_sem_explicacao"
  // ── CONTAI-007, critério 4 ─────────────────────────────────────────────
  // Âmbar, e irmã de `servico_sem_retencao`: NF de serviço que não abate a
  // aferição do INSS, com o custo de aquisição intacto. O que está aberto é o
  // INSS, não o dinheiro — e o conserto ainda existe enquanto houver parcela.
  | "nf_servico_sem_cno";

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
 * é por isso que isto NÃO é uma `Pendencia` (nota hábil e não paga não é
 * dispêndio nenhum, e somá-la inflaria a exposição).
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
 * 21) — inclusive fora de `custoEmRiscoIr`, que desde o CONTAI-005 conta só
 * dispêndio sem documento hábil e quarentena. É pendência de COMPLEMENTO, não
 * de risco fiscal: o dinheiro saiu, o documento existe, **falta a data**. E
 * **não é bloqueio**.
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
/**
 * **CONTAI-027, critério 12c** — o desembolso cuja resposta do critério 12 foi
 * *"em mais de um dia"*, e cujo valor está numa data só.
 *
 * ⚠️ **Campo próprio, fora de `pendencias` e fora de TODA soma**, pelo mesmo
 * motivo de `terrenoSemData` — e aqui **não há custo em risco de ficar de
 * fora**. O dinheiro saiu e ESTÁ no custo; o que está aberto é o ANO dele.
 *
 * ⚠️ **É VERMELHA, e não âmbar** (D39 do `po`): *"vermelho = fato consumado
 * com consequência fiscal aberta; âmbar = nada saiu ainda"*.
 *
 * ⚠️ **Não tem baixa, e a home não oferece nenhuma** (§5 do parecer de
 * 2026-08-21): não se dispensa, não se adia, não se esconde. Os textos vêm de
 * `lib/fiscal/terreno.ts`, copiados do §4b — a home não os redige.
 */
export interface TerrenoMaisDeUmaData {
  id: string;
  /** O lançamento, para quem lê a pendência longe do card dele. */
  titulo: string;
  valorCentavos: number;
  href: string;
}

/**
 * **CONTAI-025, critério 11** — o desembolso do terreno **pago sem
 * comprovante**, agregado da OBRA inteira.
 *
 * ⚠️ **A superfície é o critério.** Até aqui `pagoSemPapel` só existia DENTRO
 * da linha do desembolso (`terreno/page.tsx`) — que é a **D47 com outro nome**:
 * pendência sem superfície é buraco silencioso, e liberar a gravação sem ela
 * trocaria *"custo não registrado"* por *"custo registrado que ninguém vai
 * completar"* (§1.5 do parecer). Na venda dá no mesmo, com a agravante de
 * parecer resolvido.
 *
 * ⚠️ **Campo próprio, fora de `pendencias`, fora de `custoEmRiscoIr` e fora de
 * `custoConfirmadoAnoCentavos`** (critério 21 do CONTAI-010), com teste
 * afirmando cada "não".
 *
 * ⚠️ **VERMELHO** (D39): *vermelho = fato consumado com consequência fiscal
 * aberta*. O dinheiro saiu.
 *
 * ⚠️ **É da OBRA, não do ano** — inclui os `pago` **sem data**, que não caem em
 * ano nenhum. É por isso que este total pode ser maior que o segundo número do
 * card do ano, e a diferença é dita em tela.
 */
/**
 * ⚠️ **Só DADO, nenhum texto — e a ausência é deliberada.** O chip (§4.1), a
 * pendência (§4.2) e a linha do §4.3 são lidos das constantes de
 * `lib/fiscal/terreno.ts` pelo componente único que desenha este card
 * (`app/_components/pago-sem-comprovante.tsx`). Repassá-los por aqui criaria
 * um SEGUNDO caminho para o mesmo texto — e dois caminhos para o mesmo texto
 * fiscal divergem no dia em que só um for atualizado, que é como nasce a D46.
 *
 * (`terrenoSemData` carrega `consequencia` por herança do CONTAI-010; não é
 * padrão a copiar.)
 */
export interface TerrenoPagoSemComprovante {
  totalCentavos: number;
  quantidade: number;
  href: string;
}

/**
 * **CONTAI-033, critério 11** — o agregado da pendência "Nota sem arquivo".
 *
 * Mesma disciplina do `TerrenoPagoSemComprovante`: a guarda de superfície
 * existe porque *"quatro superfícies gravando e nenhuma cobrando é trocar 'não
 * registra' por 'registra e esquece'"* (D47, parecer ADENDO 1 §A.5). Ela é
 * **adicional** à quarentena, não redundante — decisão do `contador` em
 * 2026-09-19: o predicado é só `arquivo_path IS NULL`, sem olhar `status`, e um
 * documento pode acumular as duas pendências e deve aparecer nas duas.
 *
 * ⚠️ **NENHUM TEXTO passa por aqui**, como no agregado do terreno: o chip e a
 * pendência (§A.7.2) são lidos das constantes de `lib/fiscal/documento.ts` pelo
 * componente único que desenha o card (`app/_components/documento-sem-arquivo.tsx`).
 */
export interface DocumentosSemArquivo {
  quantidade: number;
  totalCentavos: number;
  /**
   * `null` quando há mais de um — **decisão do `po` em 2026-09-19, opção (b),
   * sem lista nova** (`docs/backlog/32-2026-09-19-cta-documentos-sem-arquivo-contai-033.md`).
   * Com um só, aponta para `/documento/[id]`, que já mostra chip, pendência e o
   * botão de anexar. Com vários, o card fica informativo: não existe lista de
   * documentos no app, e criar uma é fricção de processo, não obrigação fiscal.
   *
   * ⚠️ Diferente de `TerrenoPagoSemComprovante`, que sempre tem lista para onde
   * apontar. A diferença é de produto, não de descuido.
   */
  href: string | null;
}

/**
 * **CONTAI-008, critério 12** — a rede, não a porta.
 *
 * Um pagamento desta obra que aponta para uma nota de OUTRA obra. As duas
 * portas por onde esse estado nascia estão fechadas (migrations 0009 e 0016), e
 * é justamente por isso que ele precisa ser REPORTADO em vez de descartado: o
 * verbo do critério 12 mudou de propósito — *"fechar este ticket é fechar a
 * porta; reportar é a rede que sobra para o dia em que uma porta nova
 * aparecer"*.
 *
 * ⚠️ **Fora de `pendencias`, fora de `custoEmRiscoIr`, fora de
 * `custoConfirmadoAnoCentavos`** — e há teste afirmando cada um desses "não",
 * pela mesma régua de `terrenoPagoSemComprovante` e `documentosSemArquivo`.
 * Não é dinheiro em risco a somar: é um defeito de dado, com valor nenhum
 * próprio, e somá-lo contaria duas vezes um pagamento que já está em "pago sem
 * nota".
 */
export interface VinculoCruzandoObras {
  pagamentoId: string;
  documentoId: string;
  /** O pagamento desta obra — a ponta que esta home consegue abrir. */
  href: string;
}

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
  /**
   * Gasto real da obra — `acumuladoImovelCentavos` mais o que já foi pago mas
   * ainda não tem nota/comprovante vinculado (obra + terreno). **Nunca é o
   * valor da declaração**: existe só para o Mateus acompanhar o quanto de
   * fato já saiu do bolso, comprovado ou não. Não soma com `custoEmRiscoIr`
   * nem o substitui — as duas contas partem de perguntas diferentes: esta é
   * "quanto saiu do bolso", aquela é "quanto do que saiu não entra no custo".
   */
  gastoRealComPendentesCentavos: number;
  /**
   * **CONTAI-005 — o headline, e o único número de "risco" da tela.**
   *
   * Quarentena + pago sem nota + pago sem comprovante — a regra do §1 do
   * parecer de 2026-08-16 com a **terceira parcela** que o `contador` acrescentou
   * no Gate 2 (art. 17 da IN SRF 84/2001 é condição COMPOSTA: dispêndio
   * comprovado E documentação hábil; cada parcela falha uma das pernas). Veio
   * no lugar de `emPendenciaCentavos`, que somava quatro moedas e **não
   * coexiste com este** (decisão do `cto-obra`: *"dois agregados no mesmo
   * módulo é o convite para a próxima tela usar o errado"*).
   *
   * ⚠️ Vem como ESTRUTURA, não escalar, porque a R4 é bloqueante: *"o total
   * nunca aparece sem a decomposição visível"*. Total e parcelas viajam juntos
   * para não existir caminho em que a tela tenha um sem as outras.
   */
  custoEmRiscoIr: CustoEmRiscoIr;
  /**
   * **R2 — a exposição previdenciária, EM BASE (R$ de NF de serviço que não
   * abate a aferição), nunca em reais de imposto.**
   *
   * Duas famílias, **uma vez por documento**: sem retenção de 11% e sem CNO
   * impresso na nota. Ver `exposicaoInssBaseCentavos` em `lib/fiscal/risco.ts`.
   *
   * ⚠️ **Não soma com `custoEmRiscoIr` em direção nenhuma** (§2): são apurações
   * distintas, e a nota que compõe este número — estando no CPF do Mateus e
   * paga — é custo **confirmado** no IRPF, não custo em risco. É por isso que
   * ela tem campo próprio, e é por isso que a tela carrega a frase do Bloco 2.
   *
   * A unidade também é hedge: a **pergunta nº 1 ao CRC** segue aberta (o art.
   * 31 da Lei 8.212/91 dirige a retenção à *empresa* contratante). Se a tese
   * cair, muda o rótulo — não o dado.
   */
  exposicaoInssBaseCentavos: number;
  pendencias: Pendencia[];
  /**
   * ⚠️ Os DOIS estados do terreno ficam aqui, em campo próprio, e **não** em
   * `pendencias`, **não** em `custoEmRiscoIr`, **não** em
   * `custoConfirmadoAnoCentavos`, **não** em `notasSemPagamento` e **não** em
   * `despesas` (critério 21). Há teste afirmando cada um desses "não".
   */
  terrenoSemData: TerrenoSemData[];
  /**
   * CONTAI-027, critério 12c. Fora de `pendencias`, fora de `custoEmRiscoIr`,
   * fora de `custoConfirmadoAnoCentavos` — e há teste afirmando cada um desses
   * "não", como para `terrenoSemData`.
   */
  terrenoMaisDeUmaData: TerrenoMaisDeUmaData[];
  /**
   * CONTAI-025, critério 11. `null` quando não há nenhum. Fora de
   * `pendencias`, de `custoEmRiscoIr` e de `custoConfirmadoAnoCentavos` —
   * com teste afirmando cada um desses "não".
   */
  terrenoPagoSemComprovante: TerrenoPagoSemComprovante | null;
  /**
   * CONTAI-033, critério 11. `null` quando não há nenhum. Fora de
   * `pendencias`, de `custoEmRiscoIr` e de `custoConfirmadoAnoCentavos` —
   * com teste afirmando cada um desses "não", pela mesma régua do
   * `terrenoPagoSemComprovante`.
   */
  documentosSemArquivo: DocumentosSemArquivo | null;
  /**
   * CONTAI-008, critério 12. Vazio em toda obra saudável; ver
   * `VinculoCruzandoObras` para por que fica fora das três somas.
   */
  vinculosCruzandoObras: VinculoCruzandoObras[];
  /**
   * **Critério 9** — o que o portão do comprovante TIROU de
   * `acumuladoImovelCentavos`, para o card do acumulado nunca encolher em
   * silêncio. É a parte **datada** até 31/12 do ano em tela; os sem data estão
   * em `terrenoPagoSemComprovante`, que é da obra.
   *
   * ⚠️ Este número **não soma** com o acumulado em lugar nenhum: ele é a linha
   * nomeada logo abaixo dele (§2.4).
   */
  terrenoForaDoAcumuladoCentavos: number;
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
 * ⚠️ **Sete campos, e nenhum deles é compromisso** — nem virá a ser
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

  // 5 · CONTAI-007, critério 4 — a nota de serviço que não traz CNO impresso.
  //
  // ⚠️ **`nota_traz_cno === false`, nunca `null`.** `null` é "não foi
  // perguntado" (registro anterior ao ticket, ou material/boleto) e não afirma
  // nada; `false` é o Mateus tendo olhado o papel e respondido. Abrir pendência
  // sobre o `null` seria cobrar do prestador uma nota que ninguém conferiu — e
  // aviso que erra é aviso que se aprende a ignorar.
  //
  // ⚠️ Mesma FORMA do irmão fiscal logo acima (`servico_sem_retencao`), e a
  // simetria é intencional: as duas são NF de serviço que não abate a aferição,
  // com o custo de aquisição intacto. Âmbar pela régua da D39 — o dinheiro que
  // saiu continua no custo; o que está aberto é o INSS.
  //
  // ⚠️ **OBRA SEM CNO NÃO ABRE ESTA PENDÊNCIA** (Gate 2 do CONTAI-007,
  // `cto-obra`), e o silêncio aqui é a decisão certa por dois motivos que se
  // somam:
  // - a ação seria **inexequível**: não dá para pedir ao prestador que imprima
  //   um CNO que ainda não existe. Pendência com ação impossível é a que ensina
  //   o Mateus a ignorar a lista inteira;
  // - ela seria **redundante**: a obra sem CNO já tem a sua pendência, do
  //   CONTAI-003, e lá a ação é a certa e a única que destrava as outras —
  //   registrar o CNO no e-CAC. Uma nota por nota repetindo a mesma causa
  //   afogaria a pendência que resolve.
  //   O registro do fato não se perde: `nota_traz_cno = false` está gravado, a
  //   nota entra na lista de cobrança do critério 8, e no dia em que o CNO for
  //   registrado esta pendência aparece sozinha, com a ação agora possível.
  const obraTemCno = obra.cno !== null;
  for (const d of documentos) {
    if (!obraTemCno) break;
    if (d.tipo !== "nf_servico" || d.status === "quarentena") continue;
    if (d.notaTrazCno !== false) continue;
    pendencias.push({
      id: `sem-cno:${d.id}`,
      tipo: "nf_servico_sem_cno",
      chip: "Nota sem CNO",
      titulo: "NF de serviço sem CNO impresso",
      // A ação óbvia entra no DETALHE, ao lado do prestador: é dele que se
      // cobra, e o critério 4 pede a ação junto da pendência, não numa tela
      // adiante.
      detalhe: `${d.favorecidoNome ?? SEM_FAVORECIDO} — ${ACAO_NOTA_SEM_CNO}`,
      valorCentavos: d.valorCentavos ?? 0,
      consequencia: CONSEQUENCIA_CNO_DA_NOTA,
      gravidade: "amb",
      href: `/documento/${d.id}`,
    });
  }

  // ── CONTAI-005 · o headline, e o que ele NÃO é ─────────────────────────
  //
  // ⚠️ **Não é mais a soma de `pendencias[]`.** Era, e por isso somava perda de
  // custo com conta a pagar com base de INSS — quatro moedas num número só, que
  // não corresponde a nenhuma linha de nenhuma declaração. A regra de
  // composição inteira vive em `lib/fiscal/risco.ts`, com o parecer citado
  // linha a linha; aqui só se chama.
  //
  // O anti-divergência com a US-004 é IMPORTAR esta função, nunca reescrever a
  // fórmula numa view do Postgres: seriam duas implementações da mesma regra
  // fiscal, e a segunda fora do alcance do Vitest.
  const emRisco = custoEmRiscoIr({ documentos, pagamentos, alocacao });

  // R2 · a exposição do INSS, **em base** e em campo próprio.
  //
  // ⚠️ **As DUAS famílias entram** — sem retenção 11% E sem CNO impresso
  // (decisão do `contador` no Gate 2 do CONTAI-005): as duas são NF de serviço
  // que não abate a aferição desta obra. E entram por **união de `documento.id`**,
  // calculada sobre os DOCUMENTOS, porque uma nota pode carregar as duas
  // pendências ao mesmo tempo e somar as duas listas contaria o valor dela
  // duas vezes. A regra literal está em `lib/fiscal/risco.ts`.
  const exposicaoInss = exposicaoInssBaseCentavos({
    documentos,
    obraTemCno: obra.cno !== null,
  });

  // Gasto real da obra (relato do Mateus, 2026-09-18): pagamento feito sem
  // comprovante ainda continua sendo dinheiro que saiu do bolso dele, e ele
  // quer ver isso somado em algum lugar — só que não pode ser no
  // `acumuladoImovelCentavos`, que É o valor da ficha Bens e Direitos e por
  // isso só conta o que tem documento hábil vinculado. Este é um número
  // PARALELO, só para acompanhamento pessoal: soma o acumulado oficial com o
  // que está pago mas ainda bloqueado por falta de nota/comprovante
  // (`pago_sem_nota` e `pago_sem_comprovante`, os dois tipos de pendência que
  // representam dinheiro já desembolsado) mais o equivalente do terreno
  // (`terrenoForaDoAcumuladoCentavos`, já isolado por decisão anterior).
  // Deliberadamente NÃO inclui `diferenca_sem_explicacao` (erro de registro,
  // não falta de documento) nem `servico_sem_retencao` (documentado, questão
  // de INSS, não de comprovante de pagamento).
  const pagoSemComprovanteCentavos = pendencias
    .filter((p) => p.tipo === "pago_sem_nota" || p.tipo === "pago_sem_comprovante")
    .reduce((s, p) => s + p.valorCentavos, 0);

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
  // Ficam depois do headline de propósito: nenhum dos dois participa da soma
  // do `custoEmRiscoIr`. O primeiro é pendência de COMPLEMENTO (falta um dado que só
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

  /**
   * CONTAI-027, critério 12c — a home é uma das DUAS superfícies que existem
   * hoje (a outra é o card do desembolso). A terceira, a lista de revisão
   * pré-declaração, é da US-004, e **nenhuma tela promete a terceira**.
   *
   * Deriva de `debitosMesmoDia === false` (`pendenciaDeDatasAberta`) — nada é
   * contado aqui, e nada é lido de `pendencia`.
   */
  const terrenoMaisDeUmaData: TerrenoMaisDeUmaData[] = desembolsosTerreno
    .filter(pendenciaDeDatasAberta)
    .map((d) => ({
      id: `terreno-mais-de-uma-data:${d.id}`,
      titulo: `${NOME_DO_DESEMBOLSO[d.tipo]} do terreno`,
      valorCentavos: d.valorCentavos,
      href: `/obras/${obra.id}/terreno`,
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

  // ── CONTAI-025 · o custo do terreno passa a ser DOIS números ───────────
  //
  // ⚠️ **A D50 se conserta AQUI, no cálculo puro** — nunca na query. Filtrar o
  // desembolso sem comprovante na leitura esconderia justamente o número que o
  // §2.4 manda mostrar em linha nomeada, e o app voltaria a decidir em
  // silêncio — só que para baixo.
  const custoDoTerreno = custoTerrenoAteOAno(
    desembolsosTerreno,
    informesFinanciamento,
    ano,
  );

  // O R$ 0,00 do terreno: ausência de registro, nunca ausência de pagamento.
  // A condição é "nenhum valor DATADO e nenhum informe", e é deliberadamente
  // mais larga que "nenhum desembolso": uma linha `pago` sem data também deixa
  // o acumulado em zero, e nesse caso o zero mente exatamente igual.
  //
  // ⚠️ **O sem-comprovante entra nesta condição, e não pode sair dela**: com um
  // desembolso datado e sem comprovante, o confirmado é zero mas o terreno
  // ESTÁ registrado — dizer "nada foi registrado" ali seria trocar um zero que
  // mente por outro.
  const terrenoNoAcumuladoCentavos = custoDoTerreno.confirmadoCentavos;
  const terrenoSemRegistro: TerrenoSemRegistro | null =
    terrenoNoAcumuladoCentavos === 0 &&
    custoDoTerreno.semComprovanteCentavos === 0
      ? {
          terrenoNoAcumuladoCentavos,
          aviso: TERRENO_ZERO_NAO_E_NADA_PAGO,
          href: `/obras/${obra.id}/terreno`,
        }
      : null;

  // Critério 11 — o agregado da OBRA, a superfície que faltava (D47).
  const semComprovante = pagosSemComprovante(desembolsosTerreno);
  const terrenoPagoSemComprovante: TerrenoPagoSemComprovante | null =
    semComprovante.length === 0
      ? null
      : {
          totalCentavos: semComprovante.reduce(
            (s, d) => s + d.valorCentavos,
            0,
          ),
          quantidade: semComprovante.length,
          href: `/obras/${obra.id}/terreno/desembolsos`,
        };

  // CONTAI-033, critério 11 — a superfície própria da pendência "Nota sem
  // arquivo" (D47 de novo, agora do lado do documento).
  //
  // ⚠️ O predicado é SÓ `arquivoPath === null`, sem olhar `status`: confirmação
  // do `contador` em 2026-09-19. Quarentena sem arquivo entra aqui TAMBÉM — as
  // duas pendências são aditivas, e mostrar só uma reabre o buraco que a guarda
  // existe para fechar.
  const semArquivo = documentos.filter(faltaOArquivo);
  const documentosSemArquivo: DocumentosSemArquivo | null =
    semArquivo.length === 0
      ? null
      : {
          quantidade: semArquivo.length,
          totalCentavos: semArquivo.reduce(
            (s, d) => s + (d.valorCentavos ?? 0),
            0,
          ),
          // Decisão do `po`: um documento → aponta para ele; vários → sem CTA.
          href:
            semArquivo.length === 1 ? `/documento/${semArquivo[0].id}` : null,
        };

  return {
    ano,
    custoConfirmadoAnoCentavos: custoAno,
    // Conserta de carona o defeito original (terreno inteiro em todo ano): só
    // o que foi efetivamente desembolsado até 31/12 deste ano entra.
    acumuladoImovelCentavos: terrenoNoAcumuladoCentavos + custoAteFimDoAno,
    gastoRealComPendentesCentavos:
      terrenoNoAcumuladoCentavos +
      custoAteFimDoAno +
      pagoSemComprovanteCentavos +
      custoDoTerreno.semComprovanteCentavos,
    custoEmRiscoIr: emRisco,
    exposicaoInssBaseCentavos: exposicaoInss,
    pendencias,
    terrenoSemData,
    terrenoMaisDeUmaData,
    terrenoPagoSemComprovante,
    documentosSemArquivo,
    // CONTAI-008, critério 12: o que `alocarCusto` descartaria em silêncio sobe
    // até a tela. Nenhum valor entra em soma nenhuma — ver `VinculoCruzandoObras`.
    vinculosCruzandoObras: alocacao.vinculosOrfaos.map((v) => ({
      pagamentoId: v.pagamentoId,
      documentoId: v.documentoId,
      href: `/pagamento/${v.pagamentoId}`,
    })),
    // ⚠️ Linha nomeada, NUNCA somada ao acumulado (§2.4).
    terrenoForaDoAcumuladoCentavos: custoDoTerreno.semComprovanteCentavos,
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
