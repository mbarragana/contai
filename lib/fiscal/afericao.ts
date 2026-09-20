/**
 * A **base de aferição do INSS (SERO)**, segregada por CNO — CONTAI-007,
 * critério 5. Módulo puro: nenhuma dependência de rede ou de UI.
 *
 * ⚠️ **ESTE MÓDULO NÃO CALCULA A AFERIÇÃO, E NÃO PODE PASSAR A CALCULAR.**
 * O valor da aferição é a **US-004** e depende de o `contador` fechar a fórmula
 * (área construída, padrão, CUB, período) — está explicitamente em
 * *Out of Scope* do CONTAI-007: *"este ticket só captura a base"*. O que existe
 * aqui é o que o app SABE hoje: quais notas de serviço abatem a base de qual
 * CNO, e por que as outras não abatem.
 *
 * Fonte das regras — nada aqui é inferido. Gate Fiscal do CONTAI-007 (parecer
 * de 2026-08-09, Q8), no formato "se X → Y":
 *
 * - **Se** documento = NF de serviço PJ → a dedução da base só vale se a nota
 *   **referenciar o CNO daquela obra** *e* a retenção de 11% tiver sido
 *   declarada em EFD-Reinf pelo prestador. **NF da obra A jamais abate base da
 *   obra B.**
 * - **Se** a nota não traz CNO → não abate a aferição, e **continua sendo
 *   documentação hábil para o custo de aquisição** (IN SRF 84/2001, art. 17):
 *   são duas apurações distintas, e é por isso que o critério 3 grava com
 *   pendência em vez de recusar.
 * - **Se** falta o arquivo → não abate (CONTAI-033, Guarda 2: *"o abatimento
 *   depende da nota de serviço com a retenção de 11%, não da lembrança dela"*).
 *
 * ⚠️ **Conferir se a retenção foi de fato declarada em EFD-Reinf está FORA do
 * alcance do produto** (Out of Scope): é obrigação do prestador. O app registra
 * o que a nota diz e marca o que não sabe — e `retencao11 = null` ("não sei")
 * **não abate**, porque a direção segura do erro aqui é subestimar o
 * abatimento, não inventá-lo.
 */

import type { Documento, Obra } from "@/lib/types";
import type { LiberadoAfericaoInss } from "./compromisso";
import { faltaOArquivo } from "./documento";
import { cnoNormalizado } from "./obra";

/** Uma nota que compõe a base de um CNO. */
export interface NotaQueAbate {
  documentoId: string;
  numero: string | null;
  dataEmissao: string | null;
  prestador: string | null;
  valorCentavos: number;
}

/**
 * Por que uma NF de serviço **não** abate. Enumerado, e não um booleano: a
 * posição da aferição tem de dizer o que fazer com cada nota que ficou de fora
 * — e três dos cinco motivos ainda têm conserto.
 */
export type MotivoForaDaBase =
  /** A obra não tem CNO: não há base a abater (a pendência é do cadastro). */
  | "obra_sem_cno"
  /** A nota não traz CNO impresso — critério 3. Conserto: pedir a nota certa. */
  | "nota_sem_cno"
  /** Nunca foi perguntado (registro anterior ao CONTAI-007). */
  | "cno_nao_perguntado"
  /** O CNO impresso não é o da obra onde a nota está arquivada. */
  | "cno_divergente"
  /** Sem retenção de 11%, ou "não sei" — que não vira "sim". */
  | "sem_retencao"
  /** Sem o arquivo no acervo (CONTAI-033, Guarda 2). */
  | "sem_arquivo"
  /** Fora do CPF do dono da obra. */
  | "quarentena";

export interface NotaForaDaBase {
  documentoId: string;
  obraId: string;
  numero: string | null;
  prestador: string | null;
  valorCentavos: number;
  motivo: MotivoForaDaBase;
}

/**
 * A base de UM CNO.
 *
 * ⚠️ `obraIds` é uma LISTA de propósito. O CNO é por obra e nunca compartilhado
 * (parecer de 2026-08-09), então a lista tem um elemento em toda situação
 * saudável — e no dia em que duas obras carregarem o mesmo CNO no cadastro, a
 * lista com dois nomes é o que torna o fato VISÍVEL, em vez de somar duas obras
 * em silêncio sob um número só.
 */
export interface BaseDeAfericao {
  cno: string;
  obraIds: string[];
  baseCentavos: number;
  notas: NotaQueAbate[];
}

/**
 * A posição da aferição.
 *
 * ⚠️ **NÃO EXISTE, E NÃO PODE EXISTIR, UM CAMPO DE TOTAL AQUI** (critério 5:
 * *"segregada por CNO — nunca somada entre obras"*). Somar bases de CNOs
 * diferentes produz um número que não existe em apuração nenhuma: cada CNO é
 * uma aferição própria, com regularização própria e averbação própria. Há teste
 * afirmando a ausência deste campo.
 */
export interface PosicaoDeAfericao {
  porCno: BaseDeAfericao[];
  /** O que ficou de fora, com o motivo — nada é descartado em silêncio. */
  foraDaBase: NotaForaDaBase[];
}

// ⚠️ `cnoNormalizado` é IMPORTADO de `./obra`, e não copiado (Gate 2 do
// CONTAI-007). A cópia que morava aqui e a original divergiriam no dia em que
// só uma fosse ajustada — e divergir, aqui, é uma nota abatendo a aferição numa
// função e não abatendo na outra, pelo mesmo par de números.

/**
 * ⚠️ A ORDEM DAS PERGUNTAS É A ORDEM DA CONSEQUÊNCIA, e não é arbitrária: o
 * motivo devolvido é o primeiro que já basta para a nota não abater, do mais
 * estrutural (a obra não tem CNO) ao mais circunstancial (falta o papel).
 * Trocar a ordem não muda quem abate — muda o que a tela manda o Mateus fazer.
 */
function motivoForaDaBase(
  documento: Documento,
  cnoDaObra: string | null,
): MotivoForaDaBase | null {
  if (cnoDaObra === null) return "obra_sem_cno";
  if (documento.status === "quarentena") return "quarentena";
  if (documento.notaTrazCno === null) return "cno_nao_perguntado";
  if (documento.notaTrazCno === false) return "nota_sem_cno";
  if (cnoNormalizado(documento.cnoReferenciado) !== cnoDaObra) {
    return "cno_divergente";
  }
  // "não sei" (`null`) NÃO vira "sim": sem retenção confirmada, não abate.
  if (documento.retencao11 !== true) return "sem_retencao";
  if (faltaOArquivo(documento)) return "sem_arquivo";
  return null;
}

/**
 * A posição da aferição de um conjunto de obras, **uma linha por CNO**.
 *
 * Recebe as obras junto dos documentos DELAS: é essa amarração que impede a
 * soma entre obras de ser sequer representável — não há um "todos os
 * documentos" solto a somar.
 *
 * ⚠️ Só NF de serviço entra na conta. Material é irrelevante para a aferição
 * (invariante fiscal do `CLAUDE.md`), e boleto não é documentação hábil — nem
 * um nem outro aparece sequer em `foraDaBase`, porque "ficou de fora" sugere
 * que poderia ter entrado.
 *
 * ⚠️ **EXIGE A MARCA DA PORTA ÚNICA** (`LiberadoAfericaoInss`, CONTAI-036): a
 * posição da aferição é uma das TRÊS saídas do produto (meta 2), e nenhuma sai
 * com pendência que a vete. Receber a marca é proteção mais forte do que
 * chamar a porta — quem não passou por ela não consegue nem compilar a
 * chamada. O `ano` que a marca carrega **não é usado aqui, e não deve ser**: a
 * aferição de um CNO é do PERÍODO DA OBRA, não do ano-calendário. A marca é
 * uma permissão, não um dado.
 */
export function posicaoDeAfericao(
  liberado: LiberadoAfericaoInss,
  obras: readonly { obra: Obra; documentos: readonly Documento[] }[],
): PosicaoDeAfericao {
  void liberado;
  const porCno = new Map<string, BaseDeAfericao>();
  const foraDaBase: NotaForaDaBase[] = [];

  for (const { obra, documentos } of obras) {
    const cnoDaObra = cnoNormalizado(obra.cno);

    for (const d of documentos) {
      if (d.tipo !== "nf_servico") continue;
      const valorCentavos = d.valorCentavos ?? 0;

      const motivo = motivoForaDaBase(d, cnoDaObra);
      if (motivo !== null) {
        foraDaBase.push({
          documentoId: d.id,
          obraId: obra.id,
          numero: d.numero,
          prestador: d.favorecidoNome,
          valorCentavos,
          motivo,
        });
        continue;
      }

      // A chave é o CNO **impresso na nota**, não o da obra: eles são iguais
      // aqui (é o que `motivoForaDaBase` acabou de exigir), e usar o da nota
      // deixa claro de onde a base vem.
      const chave = cnoNormalizado(d.cnoReferenciado) as string;
      const atual = porCno.get(chave) ?? {
        cno: d.cnoReferenciado as string,
        obraIds: [],
        baseCentavos: 0,
        notas: [],
      };
      if (!atual.obraIds.includes(obra.id)) atual.obraIds.push(obra.id);
      atual.baseCentavos += valorCentavos;
      atual.notas.push({
        documentoId: d.id,
        numero: d.numero,
        dataEmissao: d.dataEmissao,
        prestador: d.favorecidoNome,
        valorCentavos,
      });
      porCno.set(chave, atual);
    }
  }

  return { porCno: [...porCno.values()], foraDaBase };
}
