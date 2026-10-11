/**
 * **CONTAI-092 — os 4 estados do card "Integrações" (critério 16), como função
 * pura.**
 *
 * Os textos e as guardas são literais de `design/mocks/CONTAI-092.md`. A
 * derivação mora aqui, e não na tela, por dois motivos:
 *
 * 1. o **estado 1 ("Não configurado")** depende de variável de ambiente
 *    server-only (critério 15) e o **estado 4** depende de `revogado_em`, que o
 *    servidor escreve — a tela recebe o veredito pronto da rota
 *    `/api/google/agenda/estado` e não refaz conta nenhuma;
 * 2. os quatro estados ficam testáveis sem browser e sem banco, inclusive o
 *    estado 1, que o E2E **não** pode exercitar (o servidor do Playwright sobe
 *    com as variáveis presentes — ver `playwright.config.ts`).
 *
 * ⚠️ **GATE FISCAL 7a-c.** Todo texto deste arquivo obedece às mesmas restrições
 * do texto do evento: nada de "obrigação", "prazo legal", "vencimento fiscal",
 * "DARF" ou "aferição"; a ausência ou a falha do lembrete **nunca** é
 * apresentada como fato fiscal ou operacional sobre o compromisso; nada sugere o
 * status de documentação hábil. O estado 4 diz que "a sincronização está
 * interrompida" e que "os lembretes não estão sendo criados" — fatos sobre a
 * INTEGRAÇÃO, nunca sobre o pagamento. `lib/agenda/estado.test.ts` varre os
 * termos proibidos em todas as mensagens.
 */

/** O que o card precisa saber. Montado pela rota, a partir do banco. */
export interface DadosDaIntegracao {
  /** As três variáveis de ambiente estão presentes no servidor? */
  configurado: boolean;
  /** `null` quando nunca houve autorização concluída. */
  concedidoEm: string | null;
  /** Preenchido = o Google recusou a credencial (critério 6). */
  revogadoEm: string | null;
  /** A conta Google, quando foi possível identificá-la (pode ser `null`). */
  emailConta: string | null;
  /**
   * Compromissos abertos PIX/boleto cujo lembrete está pendente ou com falha
   * (`precisaSincronizar`). **Não é pendência fiscal** e não aparece em
   * relatório nenhum — critério 9.
   */
  pendentes: number;
}

export type NomeDoEstado =
  | "nao-configurado"
  | "nao-conectado"
  | "conectado"
  | "expirado";

/** O texto do estado 1. Não é erro: é ausência de configuração, e é estável. */
export const TEXTO_NAO_CONFIGURADO =
  "Lembrete automático de pagamento ainda não está disponível nesta instalação.";

/**
 * O texto do estado 2 — e a restrição do Gate Fiscal aparece já na primeira vez
 * que o Mateus vê o recurso ("É conveniência — não substitui conferir o app"),
 * não só no corpo do evento.
 */
export const TEXTO_NAO_CONECTADO =
  "Lembretes automáticos (5, 2 e 0 dias antes) de cada pagamento PIX/boleto " +
  "agendado, na sua própria Google Agenda. É conveniência — não substitui " +
  "conferir o app.";

/** O aviso âmbar do estado 4. */
export const TEXTO_EXPIRADO =
  "A sincronização com o Google Agenda está interrompida. Os lembretes não " +
  "estão sendo criados nem atualizados até você conectar de novo.";

/**
 * A `Dica` transitória da volta cancelada/negada (estado 2 + aviso de um
 * carregamento só). "Nada foi alterado" é literal e é verdade: o callback não
 * grava linha nenhuma quando o consentimento não se concluiu (critério 17).
 */
export const TEXTO_NEGADO =
  "A conexão não foi concluída. Você pode tentar de novo quando quiser — nada " +
  "foi alterado.";

export function qualEstado(dados: DadosDaIntegracao): NomeDoEstado {
  // ⚠️ A ordem é a do spec: "não configurado" vence tudo. Sem variável de
  // ambiente não há chamada ao Google nem autorização possível, e mostrar
  // "conectado" com base numa linha antiga do banco prometeria lembrete que não
  // vai sair (critério 15).
  if (!dados.configurado) return "nao-configurado";
  if (dados.concedidoEm === null) return "nao-conectado";
  if (dados.revogadoEm !== null) return "expirado";
  return "conectado";
}
