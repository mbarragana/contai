"use client";

/**
 * As peças compartilhadas pelas TRÊS ações nomeadas de correção
 * (`/documento/[id]/corrigir/{valor|classificacao|emitente}`) — CONTAI-021.
 *
 * ⚠️ Compartilhar o PASSO 1 não faz disto um formulário genérico. O que o
 * `cto-obra` recusou em 18/08 foi um form com N campos: "os campos têm regimes
 * de consequência diferentes (valor recalcula custo e pode pedir retificadora;
 * classificação muda composição e não muda total; nome do emitente é outra
 * tabela; CNPJ é proibido)", e "o campo proibido sentado ao lado dos editáveis
 * é o convite a inventar dado no campo que sobrou". O passo 1 é a MESMA
 * pergunta nas três, com o MESMO texto do §3 do parecer — repeti-lo três vezes
 * seria três lugares para ele divergir.
 *
 * ⚠️ Esta tela NÃO é a de mover de obra. Aquela **não pergunta motivo** (adendo
 * §5): o papel não tem obra, e perguntar o que só tem uma resposta ensina a
 * clicar sem ler.
 */

import { useState } from "react";

import {
  Banner,
  Botao,
  BotaoLink,
  Card,
  Consequencia,
  Dica,
  Linha,
  Passo,
} from "@/app/_components/ui";
import {
  agruparPorAto,
  quandoDoAtoLegivel,
  type AtoDeCorrecao,
} from "@/lib/fiscal/revisao";
import { formatarBRL, numericParaCentavos } from "@/lib/money";
import type { CampoRevisao, MotivoRevisao, Revisao } from "@/lib/types";

/**
 * O motivo, do §5 do parecer: "carrega o §3 — é a primeira pergunta de um
 * auditor". `arquivamento_corrigido` não aparece aqui de propósito: ele é o
 * motivo do move, gravado sozinho.
 *
 * ⚠️ `comprovante_chegou_depois` (CONTAI-061) sai pela MESMA razão, e não por
 * simetria de estilo: ele é gravado pela máquina no anexo tardio do comprovante,
 * e aquela tela **não pergunta motivo** — não existe motivo possível para "o
 * comprovante chegou depois". Oferecê-lo na lista do §5 seria pedir ao Mateus
 * que escolhesse a causa de um fato que o próprio ato já descreve.
 */
export type MotivoEscolhido = Exclude<
  MotivoRevisao,
  "arquivamento_corrigido" | "comprovante_chegou_depois"
>;

/** A quarta resposta do passo 1, e ela NÃO grava nada (adendo §1). */
export type RespostaPasso1 = MotivoEscolhido | "erro_do_papel";

export const ROTULO_MOTIVO: Record<MotivoEscolhido, string> = {
  erro_de_digitacao_minha: "eu digitei errado no app — o papel está certo",
  emitente_corrigiu_a_nota: "a nota estava errada e o emitente já corrigiu",
  outro: "outro motivo",
};

/**
 * O motivo COMO ELE APARECE NO RASTRO (critério 16 e meta 3): quem lê o
 * histórico em 2034 lê a frase que o Mateus escolheu, não o token do enum.
 * As três primeiras frases são as do `ROTULO_MOTIVO` — vêm do parecer e do
 * mock aprovado, e não se reescrevem aqui: reusá-las é o que impede as duas
 * listas de divergirem.
 *
 * ⚠️ `arquivamento_corrigido` é o único que fica com o token legível: ele é
 * gravado pela MÁQUINA no move de obra, sem pergunta (adendo §5), e a v2 do
 * mock o mostra assim de propósito. Não há frase do Mateus para exibir.
 *
 * Tipado pelo enum do banco: valor novo em `motivo_revisao` quebra o
 * typecheck aqui, em vez de vazar para a tela como token.
 */
export const ROTULO_MOTIVO_NO_RASTRO: Record<MotivoRevisao, string> = {
  ...ROTULO_MOTIVO,
  arquivamento_corrigido: "arquivamento corrigido",
  /**
   * CONTAI-061 — como `arquivamento_corrigido`, este fica com o token legível:
   * ele é gravado pela MÁQUINA no anexo tardio do comprovante, sem pergunta (a
   * tela não pergunta motivo — não há motivo possível para "o comprovante
   * chegou depois"). Não há frase do Mateus para exibir.
   */
  comprovante_chegou_depois: "o comprovante chegou depois",
};

/**
 * §3 do parecer, **copiado literalmente**. O ticket é explícito: "Não
 * reescrever." Cada quebra de linha aqui é um parágrafo do parecer.
 */
export const ERRO_NA_NOTA_ABERTURA =
  "Se está errado na nota, não dá para consertar aqui. O que vale na " +
  "fiscalização é o papel: se o app disser uma coisa e o arquivo anexado " +
  "disser outra, a divergência derruba a prova — e quem explica isso numa " +
  "intimação é você.";

export const ERRO_NA_NOTA_SUBSTITUTIVA =
  "Valor, CNPJ/CPF do destinatário ou data de emissão errados → nota " +
  "substitutiva (cancelamento e reemissão). Carta de correção não conserta " +
  "nenhum desses.";

export const ERRO_NA_NOTA_CARTA =
  "Descrição do serviço ou dado sem efeito no valor → carta de correção, que " +
  "ele te manda em arquivo.";

export const ERRO_NA_NOTA_FECHO =
  "Quando o documento novo chegar, registre e anexe. Esta nota continua no " +
  "acervo — nada aqui se apaga.";

/** Adendo §1 — o texto do botão de saída, literal. */
export const SAIDA_DEIXAR_COMO_ESTA =
  "Nada foi alterado. O documento continua no acervo com o valor que está no " +
  "papel que você anexou. Quando o emitente mandar a nota substitutiva ou a " +
  "carta de correção, volte aqui e anexe: é nesse momento que a correção fica " +
  "registrada.";

/**
 * PASSO 1 — a pergunta que vem ANTES do campo (tela s2).
 *
 * "Se o erro é da nota, não existe campo a mostrar — mostrar mesmo assim
 * ensina a digitar por cima do papel." Nada nasce escolhido: campo que decide
 * consequência fiscal não tem resposta padrão.
 */
export function PassoMotivo({
  documentoHref,
  onEscolher,
}: {
  documentoHref: string;
  onEscolher: (resposta: RespostaPasso1, texto: string | null) => void;
}) {
  const [escolha, setEscolha] = useState<RespostaPasso1 | null>(null);
  const [texto, setTexto] = useState("");

  const opcoes: { valor: RespostaPasso1; titulo: string; detalhe: string }[] = [
    {
      valor: "erro_de_digitacao_minha",
      titulo: "Só aqui no app — eu digitei errado",
      detalhe: "O papel anexado está certo. Vou corrigir o app para bater com ele.",
    },
    {
      valor: "emitente_corrigiu_a_nota",
      titulo: "A nota estava errada e o emitente já corrigiu",
      detalhe:
        "Recebi carta de correção ou nota substitutiva — tenho o arquivo aqui " +
        "para anexar agora.",
    },
    {
      valor: "outro",
      titulo: "Outro motivo — vou escrever",
      detalhe: "Nenhum dos dois descreve o caso.",
    },
    {
      valor: "erro_do_papel",
      titulo: "A nota está errada e eu ainda não pedi nada ao emitente",
      detalhe: "Não dá para consertar aqui — e a próxima tela diz o que pedir.",
    },
  ];

  const faltaTexto = escolha === "outro" && texto.trim() === "";
  const pronto = escolha !== null && !faltaTexto;

  return (
    <>
      <Passo>Passo 1 de 3</Passo>
      <Card>
        <div className="font-semibold">
          Esse dado está errado na nota, ou só aqui no app?
        </div>
        <Dica>
          Esta resposta fica gravada junto com a correção. É a primeira coisa
          que se pergunta quando alguém lê este acervo depois.
        </Dica>
      </Card>

      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => setEscolha(o.valor)}
          aria-pressed={escolha === o.valor}
          className={`min-h-[44px] rounded-[10px] border px-[14px] py-3 text-left ${
            escolha === o.valor
              ? "border-ink bg-ink text-paper"
              : "border-line bg-white"
          }`}
        >
          <div className="font-semibold">{o.titulo}</div>
          <div className="mt-0.5 text-[12px] opacity-80">{o.detalhe}</div>
        </button>
      ))}

      {escolha === "outro" ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="motivo-livre" className="text-[12px] text-mut">
            Escreva o motivo (obrigatório)
          </label>
          <textarea
            id="motivo-livre"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            // 16px: abaixo disso o Safari do iPhone dá zoom ao focar o campo
            // (CONTAI-014, critério 4).
            className="min-h-[66px] rounded-lg border border-line bg-white px-3 py-2 text-[16px]"
          />
        </div>
      ) : null}

      {escolha === "emitente_corrigiu_a_nota" ? (
        <Consequencia cor="amb">
          No próximo passo o documento novo é anexado.{" "}
          <strong>Sem ele, esta correção não grava</strong> — senão o app passa a
          divergir do papel na direção oposta.
        </Consequencia>
      ) : null}

      <Dica>
        Nada aqui nasce escolhido. Campo que decide consequência fiscal não tem
        resposta padrão.
      </Dica>

      <div className="flex flex-col gap-2">
        <Botao
          variante="primary"
          disabled={!pronto}
          onClick={() =>
            escolha
              ? onEscolher(escolha, escolha === "outro" ? texto.trim() : null)
              : undefined
          }
        >
          {escolha === null
            ? "Escolha o motivo para continuar"
            : faltaTexto
              ? "Escreva o motivo para continuar"
              : "Continuar"}
        </Botao>
        <BotaoLink href={documentoHref}>Cancelar</BotaoLink>
      </div>
    </>
  );
}

/**
 * Tela s2b — **o erro está na nota**.
 *
 * Não grava, não marca quarentena, não muda status, e **não deixa rastro**
 * (adendo §1): "`revisao` grava antes→depois de um fato do acervo. Aqui não
 * houve antes nem depois — o app está certo, o papel é que está errado.
 * 'Consultei e não corrigi' é ruído que, repetido, torna ilegível em 2034
 * exatamente a linha que importa."
 */
export function ErroEstaNaNota({
  documentoHref,
  onVoltarAoPasso1,
}: {
  documentoHref: string;
  onVoltarAoPasso1: () => void;
}) {
  return (
    <>
      <Banner cor="amb" role="status">
        <strong>Esse dado está errado na nota, ou só aqui no app?</strong>
      </Banner>

      <Card>
        <p className="text-[13px]">{ERRO_NA_NOTA_ABERTURA}</p>
        <div className="mt-2 font-semibold">Peça ao emitente:</div>
        <ul className="mt-1 flex list-disc flex-col gap-1.5 pl-4 text-[13px]">
          <li>{ERRO_NA_NOTA_SUBSTITUTIVA}</li>
          <li>{ERRO_NA_NOTA_CARTA}</li>
        </ul>
        <p className="mt-2 text-[13px]">{ERRO_NA_NOTA_FECHO}</p>
      </Card>

      <Card>
        <Linha rotulo="O que o app faz agora">nada</Linha>
        <Dica>
          Não grava, não marca quarentena, não muda status. O documento fica
          exatamente como está, e você volta aqui quando o arquivo novo chegar.
        </Dica>
        <Consequencia cor="amb">
          Quarentena tem <strong>um significado só</strong> no contai —
          destinatário diferente do seu CPF. Usá-la para &quot;nota errada do
          emitente&quot; destruiria o único sinal fiscal daquela coluna.
        </Consequencia>
      </Card>

      <Card>
        <div className="font-semibold">
          Sair daqui não deixa registro — e isso é decisão, não esquecimento
        </div>
        <Dica>{SAIDA_DEIXAR_COMO_ESTA}</Dica>
      </Card>

      <div className="flex flex-col gap-2">
        <BotaoLink href={documentoHref} variante="primary">
          Voltar ao documento — deixar como está
        </BotaoLink>
        <Botao variante="ghost" onClick={onVoltarAoPasso1}>
          Voltar ao passo 1
        </Botao>
      </div>
    </>
  );
}

/** O motivo escolhido, sempre visível nos passos seguintes, com "trocar". */
export function MotivoEscolhidoResumo({
  motivo,
  texto,
  onTrocar,
}: {
  motivo: MotivoEscolhido;
  texto: string | null;
  onTrocar: () => void;
}) {
  return (
    <Card>
      <Linha rotulo="Motivo escolhido">
        {motivo === "outro" ? texto : ROTULO_MOTIVO[motivo]}
      </Linha>
      <div className="mt-2">
        <Botao variante="ghost" onClick={onTrocar}>
          Trocar o motivo
        </Botao>
      </div>
    </Card>
  );
}

// ── O histórico de correções (critério 16) ───────────────────────────────

/**
 * O campo do rastro como o histórico o nomeia.
 *
 * ⚠️ **UMA definição, e a unificação é do Gate 2 do CONTAI-061.** Este mapa
 * existia DUAS vezes — aqui e em `/pendencias/[id]` —, os dois `Record<string,
 * string>`: acrescentar `comprovante` exigiu editar os dois à mão, e esquecer um
 * deixaria o typecheck VERDE com um token cru na tela (o mesmo defeito que o
 * item C do CONTAI-035 nomeia para a cor da régua, na outra ponta).
 *
 * `Record<CampoRevisao, string>` é o que fecha isso: valor novo no check
 * `revisao_campo_da_entidade` sem rótulo aqui **quebra o typecheck**. A lista
 * fechada continua morando no banco (`lib/types.ts` explica por quê); este é o
 * espelho de exibição.
 */
const ROTULO_CAMPO: Record<CampoRevisao, string> = {
  valor: "valor",
  classificacao: "classificação",
  nome: "nome do favorecido",
  obra: "obra",
  vinculo: "vínculo pagamento↔nota",
  // CONTAI-061 — o comprovante do pagamento, anexado depois (dívida D56).
  comprovante: "comprovante do pagamento",
};

/**
 * O rótulo do campo, com fallback para o token.
 *
 * ⚠️ **É esta função que sai do módulo, e não o mapa** — `Revisao.campo` é
 * `string` (vem do Postgres sem validação em runtime), e indexar um
 * `Record<CampoRevisao, …>` com `string` no call site exigiria um cast, que é
 * exatamente onde o tipo para de proteger. O casamento acontece aqui, uma vez:
 * exaustividade garantida do lado do mapa, fallback garantido do lado da
 * leitura. Campo que o banco admita e a tela não conheça aparece como o token,
 * nunca como `undefined`.
 */
export function rotuloDoCampo(campo: string): string {
  return ROTULO_CAMPO[campo as CampoRevisao] ?? campo;
}

const ROTULO_CLASSIFICACAO: Record<string, string> = {
  material: "material",
  mao_obra: "mão de obra",
};

/**
 * `antes`/`depois` são TEXTO no banco (§5: "texto preserva `null`, zeros à
 * esquerda e enum"), e é aqui — e só aqui — que viram algo legível.
 *
 * ⚠️ `null` NÃO vira "R$ 0,00". Zero é um valor; branco é a ausência dele, e a
 * diferença é o caso da dor D-018.5 (documento que entrou sem valor).
 */
function legivel(
  campo: string,
  valor: string | null,
  obras: Map<string, string>,
  /**
   * CONTAI-008, critério 14 — id do documento → rótulo. Quem tem o mapa é a
   * tela; aqui só se traduz. Vazio é estado normal (a tela do documento conhece
   * um documento só).
   */
  documentos: Map<string, string>,
) {
  /**
   * ⚠️ `vinculo` ANTES do teste de `null`, e a ordem é o ponto (critério 14).
   * O `antes` desta linha é `documento_id::text` e o `depois` é `null`
   * (0009:823 e 0016): pela regra geral ela sairia como
   * *"e3f1…-…" → "(em branco)"* — UUID cru numa tela cujo propósito declarado é
   * ser lida em 2034. Aqui `null` não é "campo vazio": é o vínculo que deixou
   * de existir, e é isso que se escreve.
   */
  if (campo === "vinculo") {
    if (valor === null) return "vínculo desfeito";
    return documentos.get(valor) ?? "nota deste acervo";
  }
  /**
   * ⚠️ CONTAI-061, e a razão é a mesma de `vinculo` logo acima: o `depois` desta
   * linha é o CAMINHO do objeto no bucket (`{user_id}/comprovante/{uuid}-…`).
   * Pela regra geral ele sairia cru numa tela cujo propósito declarado é ser
   * lida em 2034 — e o caminho não prova nada a quem lê o histórico; o que
   * importa é que antes não havia comprovante e agora há. O papel em si abre
   * pela `ListaDeAnexos` do detalhe do pagamento, não por aqui.
   */
  if (campo === "comprovante") {
    return valor === null ? "sem comprovante" : "comprovante anexado";
  }
  if (valor === null) return "(em branco)";
  if (campo === "valor") {
    const centavos = numericParaCentavos(valor);
    return centavos === null ? valor : formatarBRL(centavos);
  }
  if (campo === "classificacao") return ROTULO_CLASSIFICACAO[valor] ?? valor;
  if (campo === "obra") return obras.get(valor) ?? "obra não encontrada";
  return valor;
}

// `quandoDoAtoLegivel` mora em `lib/fiscal/revisao.ts` (módulo puro, com teste)
// e não aqui: ele deixou de ser fatia de string e virou conversão de fuso —
// CONTAI-008, critério 14.

/**
 * UMA linha por ATO — nunca uma por linha do banco.
 *
 * O move (critério 13) grava N linhas de `revisao` com o mesmo `ato_id`: o
 * documento e cada pagamento. Na tela ele é **uma** correção, porque foi um ato
 * só: *"Documento movido de A para B, com 2 pagamentos"* (critério 20a).
 */
function LinhaDoAto({
  ato,
  obras,
  documentos,
  cnpj,
}: {
  ato: AtoDeCorrecao;
  obras: Map<string, string>;
  documentos: Map<string, string>;
  cnpj: string | null;
}) {
  const principal = ato.linhas[0];
  /**
   * ⚠️ **As secundárias são as linhas DEPOIS da principal**, e não "todas as de
   * entidade pagamento" (CONTAI-008). O move do DOCUMENTO grava
   * `documento:obra` primeiro e N linhas de pagamento; o move do PAGAMENTO
   * grava `pagamento:obra` primeiro e N linhas de nota. Contar por entidade
   * fixa fazia a linha principal contar a si mesma — *"com 1 pagamento"* num
   * ato que não tocou pagamento nenhum além do próprio.
   */
  const secundarias = ato.linhas.slice(1);
  const pagamentos = secundarias.filter((l) => l.entidade === "pagamento");
  const notas = secundarias.filter((l) => l.entidade === "documento");
  const acompanham = [
    pagamentos.length > 0
      ? `${pagamentos.length} ${pagamentos.length === 1 ? "pagamento" : "pagamentos"}`
      : null,
    notas.length > 0
      ? `${notas.length} ${notas.length === 1 ? "nota" : "notas"}`
      : null,
  ].filter((p): p is string => p !== null);
  const campo = rotuloDoCampo(principal.campo);

  return (
    <div className="border-t border-line py-2.5 first:border-t-0">
      <div className="text-[11.5px] text-mut">
        {quandoDoAtoLegivel(ato.quando)} · por você
      </div>
      <div className="mt-0.5 font-semibold">
        {campo}
        {principal.entidade === "favorecido" && cnpj ? (
          <span className="mono text-[12px] font-normal"> {cnpj}</span>
        ) : null}
      </div>
      <div className="mono text-[13px]">
        {legivel(principal.campo, principal.antes, obras, documentos)} →{" "}
        {legivel(principal.campo, principal.depois, obras, documentos)}
        {acompanham.length > 0 ? `, com ${acompanham.join(" e ")}` : ""}
      </div>
      <div className="text-[12px] text-mut">
        motivo: {ato.motivoTexto ?? ROTULO_MOTIVO_NO_RASTRO[ato.motivo]}
      </div>
      {ato.anosAfetados.length > 0 ? (
        <div className="text-[12px] text-mut">
          {ato.anosAfetados
            .map(
              (a) =>
                `custo de ${a.ano} em ${obras.get(a.obraId) ?? "outra obra"}: ` +
                `${formatarBRL(a.antesCentavos)} → ${formatarBRL(a.depoisCentavos)}`,
            )
            .join(" · ")}
        </div>
      ) : null}
    </div>
  );
}

/**
 * O card read-only do detalhe do documento (critério 16, decisão do `po` de
 * 19/08). Rastro que só o banco vê não cumpre a meta 3 — quem vai ler isso em
 * 2034 é o Mateus, não o Postgres.
 *
 * Nada aqui se edita nem se apaga, e a garantia é do banco: `revisao` não tem
 * UPDATE nem DELETE para `authenticated` (migration 0009).
 */
export function HistoricoDeCorrecoes({
  correcoes,
  obras,
  documentos = new Map(),
  cnpj,
}: {
  correcoes: Revisao[];
  obras: Map<string, string>;
  /**
   * id do documento → rótulo legível, para a linha de `vinculo` não exibir UUID
   * cru (critério 14). Opcional: a tela que não conhece nenhum documento cai no
   * texto genérico, que continua sendo uma frase e não um identificador.
   */
  documentos?: Map<string, string>;
  cnpj: string | null;
}) {
  const atos = agruparPorAto(correcoes);
  return (
    <Card>
      <div className="font-semibold">Histórico de correções</div>
      {atos.length === 0 ? (
        <Dica>Nenhuma correção neste registro.</Dica>
      ) : (
        <>
          <div className="mt-1">
            {atos.map((a) => (
              <LinhaDoAto
                key={a.atoId}
                ato={a}
                obras={obras}
                documentos={documentos}
                cnpj={cnpj}
              />
            ))}
          </div>
          <Dica>
            Esta lista <strong>só cresce</strong>. Nenhuma linha pode ser editada
            ou apagada — nem por você.
          </Dica>
        </>
      )}
    </Card>
  );
}
