"use client";

/**
 * **Os chips de reaproveitar o comprovante de um pagamento IRMÃO da mesma
 * fatura — CONTAI-098, critérios 1 a 5.** Spec: `design/mocks/CONTAI-098.md`.
 *
 * ⚠️ **COMPONENTE PRÓPRIO, e não `ChipsDeAnexoExistente` generalizado** (decisão
 * do ticket, "Viabilidade"): aquele é escopado a anexos do MESMO documento — a
 * fonte é `carregarAnexosDoDocumento`, o rótulo fala de "papel" e de "correção
 * de campo", e a exclusão do anexo original é regra fiscal DAQUELE caso. Aqui a
 * fonte é outra (`carregarIrmaosDeComprovante`), a unidade é ARQUIVO (um grupo
 * por `comprovante_path` distinto, N origens cada) e o rótulo fala de favorecido
 * e valor. Compartilhar os dois seria um componente com dois regimes de
 * consequência e um `if` no meio. O que se compartilha é `ChipDePapel` — a
 * aparência e os estados do botão.
 *
 * ⚠️ **NENHUM CHIP É "O COMPROVANTE OFICIAL"**, e a recusa é explícita do
 * `contador` (Gate Fiscal item 5 + critério 16): com N arquivos distintos nenhum
 * tem precedência fiscal sobre os outros, e a UI não pode insinuar que um é mais
 * válido. O rótulo é sempre um fato neutro — quem usou este arquivo e quanto
 * pagou —, nunca uma afirmação de correção.
 *
 * ⚠️ **NENHUMA PERGUNTA FISCAL NOVA** (critério 9): este controle decide QUAL
 * ARQUIVO JÁ EXISTENTE usar, não afirma fato fiscal nenhum. Nenhum CPF, nenhuma
 * retenção — mesma restrição do CONTAI-061.
 */

import { Card, Dica } from "@/app/_components/ui";
import { ChipDePapel, CHIP_ARQUIVO_NOVO, type PapelDoPacote } from "@/app/_components/corrigir";
import type { ComprovanteIrmao } from "@/lib/data";
import { formatarBRL } from "@/lib/money";

/** Textos do spec (`design/mocks/CONTAI-098.md`, `## Textos de produto`). */
export const TITULO_CHIPS_IRMAO =
  "Ou reaproveite um comprovante já enviado nesta fatura";

/**
 * ⚠️ A dica diz o que o reaproveitamento É — um arquivo provando mais de um
 * lançamento, cada um com rastro próprio. Ela existe porque o Mateus precisa
 * saber que a escolha não apaga nem move nada: ela acrescenta uma revisão.
 */
export const MESMO_COMPROVANTE_MAIS_DE_UM_FAVORECIDO =
  "O mesmo comprovante pode provar o pagamento de mais de um favorecido " +
  "dentro da mesma fatura — cada reaproveitamento fica registrado como uma " +
  "revisão própria, com data e motivo.";

/**
 * **Favorecido + valor, sempre — critério 3 e mitigação do pre-mortem 1.**
 *
 * A fatura real que originou o relato tem três lojas da MESMA REDE como
 * favorecidos distintos: sem o valor no rótulo, dois comprovantes de lojas
 * diferentes ficam indistinguíveis, e o trigger de imutabilidade torna o erro
 * permanente no acervo que precisa sustentar até 2034. Nome de arquivo nunca
 * aparece aqui — ele não diz nada ao Mateus e diria menos ainda a um auditor.
 *
 * Com mais de uma origem para o MESMO arquivo, as origens se juntam com `" · "`
 * e o parêntese pluraliza — é o estado que "fatura paga integral" já produz
 * desde o CONTAI-022.
 */
export function rotuloDoChipIrmao(irmao: ComprovanteIrmao): string {
  const origens = irmao.origens
    .map(
      (o) =>
        `${o.favorecidoNome ?? "favorecido não informado"} — ${formatarBRL(
          o.valorCentavos,
        )}`,
    )
    .join(" · ");
  const parentese =
    irmao.origens.length > 1
      ? "(já enviado para outros pagamentos desta fatura)"
      : "(já enviado para outro pagamento desta fatura)";
  return `Usar o comprovante de ${origens} ${parentese}`;
}

/**
 * ⚠️ **O chip "Vou anexar um arquivo novo." está SEMPRE presente** — critério 4,
 * correção do `cto-obra` ratificada pelo `po`, e não é simetria de estilo:
 * "irmão" só é resolvível na granularidade de FATURA, nunca de desembolso (não
 * existe coluna que persista qual desembolso gerou qual `pagamento`). O único
 * arquivo visível entre os irmãos pode vir de um desembolso diferente do que
 * originou o pagamento em aberto, e não ser prova dele. Esconder o upload novo
 * nesse caso trocaria uma fricção reversível por um erro irreversível.
 *
 * Por isso ele NÃO é um parâmetro opcional como em `ChipsDeAnexoExistente`:
 * aqui ele não tem como ser desligado.
 *
 * ⚠️ **`escolhido` nasce `null` e nenhum chip vem pré-marcado** — critério 5 e
 * Gate Fiscal item 6, em qualquer contagem de irmãos (1 ou N). Com um candidato
 * só não há escolha entre arquivos, mas o CLIQUE continua humano: quem afirma o
 * registro é o Mateus. Quem garante o `null` inicial é a tela — este componente
 * só renderiza o que recebe, e nunca chama `onEscolher` por conta própria.
 */
export function ChipsDeComprovanteIrmao({
  irmaos,
  escolhido,
  onEscolher,
}: {
  irmaos: readonly ComprovanteIrmao[];
  escolhido: PapelDoPacote | null;
  onEscolher: (papel: PapelDoPacote) => void;
}) {
  return (
    <Card>
      <div className="font-semibold">{TITULO_CHIPS_IRMAO}</div>
      <div className="mt-2 flex flex-col gap-2">
        {irmaos.map((irmao, posicao) => (
          /* A chave leva a POSIÇÃO junto com o path, como em `ListaDeAnexos` e
             em `ChipsDeAnexoExistente`: `comprovantesDosIrmaos` já agrupa por
             path distinto, mas chave que depende de unicidade a montante é
             chave que o React descarta em silêncio no dia em que ela mudar — e
             chip sumido da tela é a D35 de volta. */
          <ChipDePapel
            key={`${posicao}-${irmao.comprovantePath}`}
            rotulo={rotuloDoChipIrmao(irmao)}
            marcado={
              escolhido?.tipo === "existente" &&
              escolhido.path === irmao.comprovantePath
            }
            onEscolher={() =>
              onEscolher({ tipo: "existente", path: irmao.comprovantePath })
            }
          />
        ))}
        <ChipDePapel
          rotulo={CHIP_ARQUIVO_NOVO}
          marcado={escolhido?.tipo === "novo"}
          onEscolher={() => onEscolher({ tipo: "novo" })}
        />
      </div>
      <Dica>{MESMO_COMPROVANTE_MAIS_DE_UM_FAVORECIDO}</Dica>
    </Card>
  );
}
