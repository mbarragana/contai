"use client";

import { useParams } from "next/navigation";

import {
  AppBar,
  BotaoLink,
  Card,
  Consequencia,
  Corpo,
  Dica,
  Linha,
  Passo,
  Rodape,
} from "@/app/_components/ui";

/**
 * Tela s6b do mock v2 — **está errado outro dado**.
 *
 * Saída DECLARADA, sem campo (critério 12). Dois grupos, e a diferença entre
 * eles não é de prazo:
 *
 * - o primeiro **não vai ter campo nunca**: `status` é derivado ("dropdown de
 *   status é o caminho de fraude silencioso: não exige mentir sobre fato
 *   nenhum, só escolher um valor" — parecer §1) e `arquivo_path` é a prova
 *   ("não se substitui — anexa-se adicional");
 * - o segundo é corrigível pelo parecer e ficou fora da rodada 1 porque cada um
 *   traz regra própria e não apareceu nenhum caso real.
 *
 * ⚠️ `numero`, `serie` e `data_emissao` não aparecem em lugar nenhum porque
 * **não existem no schema** — são o CONTAI-004. A tela não promete campo que o
 * registro não tem (critério 19 do CONTAI-018).
 */
export default function OutroDado() {
  const { id } = useParams<{ id: string }>();
  const documentoHref = `/documento/${id}`;

  return (
    <>
      <AppBar
        titulo="Está errado outro dado"
        sub="o que não se corrige aqui — cada um com o seu motivo"
      />
      <Corpo>
        <Passo>Não tem campo, e não vai ter</Passo>
        <Card>
          <Linha rotulo="Situação do documento">
            é consequência, não escolha
          </Linha>
          <Dica>
            A situação (em ordem, em quarentena) sai do que você respondeu sobre
            a nota. Ela muda quando você corrige o fato — nunca escolhendo a
            situação numa lista.
          </Dica>
          <Consequencia cor="red">
            Dropdown de situação é o caminho de fraude silencioso:{" "}
            <strong>não exige mentir sobre fato nenhum, só escolher um
            valor</strong>.
          </Consequencia>
        </Card>

        <Card>
          <Linha rotulo="Arquivo anexado">não se troca — acrescenta-se</Linha>
          <Dica>
            O anexo é a prova. Se a foto ficou ilegível ou chegou uma 2ª via,
            anexe o arquivo novo: <strong>os dois ficam</strong>. Nada sai do
            acervo.
          </Dica>
        </Card>

        <Passo>Ainda não nesta rodada</Passo>
        <Card>
          <Dica>
            Estes três são corrigíveis pelo parecer e ficaram de fora da primeira
            rodada porque cada um traz uma regra própria e ainda não apareceu
            nenhum caso real:
          </Dica>
          <ul className="mt-1.5 flex list-disc flex-col gap-1.5 pl-4 text-[13px]">
            <li>
              <strong>Tipo</strong> (NF de material ↔ NF de serviço) — trocar
              obriga a responder de novo classificação e retenção, e não pode
              atravessar para boleto.
            </li>
            <li>
              <strong>Vencimento</strong> — não decide ano nem custo.
            </li>
            <li>
              <strong>&quot;A nota está no meu CPF&quot;</strong> — voltar atrás
              aqui exige anexo à vista e afirmação explícita, nunca um toque.
            </li>
          </ul>
          <Dica>
            Número, série e data de emissão não aparecem porque{" "}
            <strong>ainda não existem no app</strong>. A tela não promete campo
            que o registro não tem.
          </Dica>
        </Card>

        <Passo>O que existe hoje</Passo>
        <div className="flex flex-col gap-2">
          <BotaoLink href={`/documento/${id}/corrigir/valor`}>
            Corrigir o valor
          </BotaoLink>
          <BotaoLink href={`/documento/${id}/corrigir/classificacao`}>
            Corrigir a classificação
          </BotaoLink>
          <BotaoLink href={`/documento/${id}/corrigir/emitente`}>
            Corrigir o nome do emitente
          </BotaoLink>
          <BotaoLink href={`/documento/${id}/obra`}>
            Corrigir a obra deste registro
          </BotaoLink>
        </div>
      </Corpo>

      <Rodape>
        <BotaoLink href={documentoHref} variante="primary">
          Voltar ao documento
        </BotaoLink>
      </Rodape>
    </>
  );
}
