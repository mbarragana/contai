"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useSessao } from "@/app/_components/sessao";
import {
  AppBar,
  Banner,
  Botao,
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
  Rodape,
} from "@/app/_components/ui";
import {
  carregarDocumento,
  carregarPendencias,
  classificarErro,
  marcarEmitenteErrado,
  mensagemDeErro,
  type ErroDeTela,
} from "@/lib/data";
import { formatarDocumento } from "@/lib/fiscal/identificacao";
import { formatarDataBR } from "@/lib/fiscal/obra";
import type { Documento, StatusDocumento } from "@/lib/types";

/**
 * ⚠️ Bloqueante 3 do Gate 2. A linha "Situação" era o literal
 * *"Em ordem — igual a antes"*, e o `blocoCorrigir` do detalhe também é
 * renderizado no ramo `status === "quarentena"` — ou seja, um documento EM
 * QUARENTENA chegava aqui e lia "Em ordem", apagando o ÚNICO SINAL FISCAL
 * daquela coluna (parecer §4.1: "quarentena tem um significado só —
 * destinatário ≠ CPF do dono"). Agora a tela lê o `status` real; o que ela
 * afirma é só o que é verdade em qualquer um dos três: marcar não o muda.
 */
const ROTULO_STATUS: Record<StatusDocumento, string> = {
  registrado: "Em ordem",
  quarentena: "Em quarentena — o destinatário não é o seu CPF",
  aguardando_pagamento: "Aguardando pagamento",
};

/**
 * Telas s6 e s6c do mock v2 — **o CNPJ/CPF do emitente está errado**.
 *
 * ⚠️ **Não tem campo, e não vai ter.** Parecer §4 e adendo de 2026-08-18 §2,
 * regra dura: *"CNPJ errado não é typo, é outro favorecido"*. Reescrever a
 * string trocaria um erro por outro, em silêncio, em todos os registros
 * daquele favorecido — e a correção de verdade é trocar o PONTEIRO
 * `documento.favorecido_id`, que é a rodada 2.
 *
 * O que esta tela oferece hoje é UMA ação (critério 19): marcar o erro, para
 * ele deixar de ser invisível. Texto com saída declarada **não é** o "bloqueio
 * total" que o §4.4 proíbe — o que ele proíbe é impasse sem explicação, e o
 * risco concreto sem esta ação é ele dar vazão à intenção **trocando o nome do
 * favorecido**, que é exatamente o que esta tela pede para não fazer.
 */
export default function CnpjErrado() {
  const { id } = useParams<{ id: string }>();
  const { pedirReautenticacao } = useSessao();
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [marcadoEm, setMarcadoEm] = useState<string | null>(null);
  const [erroCarregar, setErroCarregar] = useState<ErroDeTela | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [marcando, setMarcando] = useState(false);
  const [erroMarcar, setErroMarcar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const [doc, pendencias] = await Promise.all([
          carregarDocumento(id),
          carregarPendencias(),
        ]);
        if (cancelado) return;
        setDocumento(doc);
        const aberta = pendencias.find(
          (p) =>
            p.tipo === "emitente_errado" &&
            p.documentoId === id &&
            p.desfecho === null,
        );
        setMarcadoEm(aberta?.abertaEm ?? null);
      } catch (erro) {
        if (!cancelado) setErroCarregar(classificarErro(erro));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setErroCarregar(null);
    setDocumento(null);
    setErroMarcar(null);
    setTentativa((t) => t + 1);
  }, []);

  async function marcar() {
    setMarcando(true);
    setErroMarcar(null);
    try {
      await marcarEmitenteErrado(id);
      // Idempotente: marcar de novo devolve a MESMA pendência, e a lista
      // continua com uma linha só. Não existe "marcado duas vezes".
      setTentativa((t) => t + 1);
      setDocumento(null);
    } catch (erro) {
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        setMarcando(false);
        return;
      }
      setErroMarcar(mensagemDeErro(erro));
    } finally {
      setMarcando(false);
    }
  }

  const documentoHref = `/documento/${id}`;

  if (!documento) {
    return (
      <>
        <AppBar titulo="O CNPJ/CPF do emitente está errado" />
        <Corpo>
          {erroCarregar ? (
            <EstadoErro erro={erroCarregar} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando o documento" />
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href={documentoHref}>Voltar ao documento</BotaoLink>
        </Rodape>
      </>
    );
  }

  const cnpj = documento.favorecidoDocumento
    ? formatarDocumento(documento.favorecidoDocumento)
    : "—";

  return (
    <>
      <AppBar
        titulo="O CNPJ/CPF do emitente está errado"
        sub={documento.favorecidoNome ?? "emitente não identificado"}
      />
      <Corpo>
        {erroMarcar ? (
          <Banner cor="red" role="alert">
            <strong>Não deu para marcar.</strong> {erroMarcar} Nada foi alterado
            no documento.
          </Banner>
        ) : null}

        {marcadoEm ? (
          <Banner cor="amb" role="status">
            <strong>Marcado.</strong> Este registro entrou na lista de pendências
            como &quot;CNPJ errado — tratar&quot;, em{" "}
            {formatarDataBR(marcadoEm.slice(0, 10))}.
          </Banner>
        ) : null}

        <Card>
          <div className="font-semibold">
            CNPJ errado não é typo, é outro favorecido.
          </div>
          <Dica>
            Se o CNPJ gravado é <span className="mono">{cnpj}</span> e o do papel
            é outro, não existe letra errada a consertar: o registro está
            apontando para uma <strong>empresa diferente</strong> da que emitiu a
            nota. Reescrever a string trocaria um erro por outro, em silêncio, em
            todos os registros daquele favorecido.
          </Dica>
        </Card>

        <Passo>O que acontece com o que já está registrado</Passo>
        <Card>
          <ol className="flex list-decimal flex-col gap-2 pl-4 text-[13px]">
            <li>
              <strong>A nota continua no acervo.</strong> Não é anulada, não vai
              para quarentena, não se apaga.
            </li>
            <li>
              O que se corrige é <strong>para quem o documento aponta</strong> —
              o favorecido certo, existente ou novo — e nunca o CNPJ de um
              favorecido já cadastrado.
            </li>
            <li>
              Cada pagamento ligado é <strong>repontado um a um</strong>, por
              você. Nada em cascata: o app não muda quatro registros porque você
              mexeu em um.
            </li>
            <li>
              O favorecido errado <strong>fica no histórico</strong> e deixa de
              aparecer como sugestão em registro novo.
            </li>
          </ol>
          <Consequencia cor="amb">
            Quarentena tem <strong>um significado só</strong> — destinatário
            diferente do seu CPF. Usá-la para &quot;emitente errado&quot;
            destruiria o único sinal fiscal daquela coluna.
          </Consequencia>
        </Card>

        <Passo>Ainda não existe no app</Passo>
        <Card>
          <Dica>
            Trocar o favorecido de um documento é a <strong>rodada 2</strong>
            deste trabalho. Enquanto não existir, o caminho honesto é: registre o
            que aconteceu e não force nada.
          </Dica>
          <Consequencia cor="red">
            <strong>O que não fazer enquanto isso:</strong> não troque o nome do
            favorecido para o da empresa certa. O CNPJ continuaria o errado, e o
            registro passaria a mentir duas vezes — com uma aparência de certo.
          </Consequencia>
        </Card>

        <Passo>O que você pode fazer agora</Passo>
        <Card className={marcadoEm ? "border-amb" : undefined}>
          {marcadoEm ? (
            <>
              <Chip cor="amb">Já marcado — CNPJ errado, a tratar</Chip>
              <Dica>
                É uma pendência <strong>por documento</strong>. Voltar aqui e
                marcar outra vez deixa a lista com uma linha só — não existe
                &quot;marcado duas vezes&quot;.
              </Dica>
              <Dica>
                Enquanto a rodada 2 não existir, a pendência declara o que está
                esperando: <strong>a correção do apontamento ainda não existe no
                app</strong>.
              </Dica>
              <div className="mt-2.5">
                <BotaoLink href="/pendencias">Ver na lista de pendências</BotaoLink>
              </div>
            </>
          ) : (
            <>
              <Dica>
                Trocar o favorecido do documento é a rodada 2. Até lá o erro não
                precisa ficar invisível: marque-o e ele passa a aparecer na sua
                lista de pendências, com o documento nomeado.
              </Dica>
              <div className="mt-2.5">
                <Botao variante="primary" onClick={marcar} disabled={marcando}>
                  {marcando
                    ? "Marcando…"
                    : "Marcar: o CNPJ deste registro está errado — tratar"}
                </Botao>
              </div>
              <Dica>
                Marcar não muda nada no documento: não abre campo, não mexe na
                situação, não manda para quarentena, não altera valor nem desfaz
                vínculo. É anotação com consequência visível.
              </Dica>
            </>
          )}
        </Card>

        <Card>
          <Linha rotulo="Situação">
            {ROTULO_STATUS[documento.status]} — não muda com esta marcação
          </Linha>
          <Linha rotulo="Emitente">
            {documento.favorecidoNome ?? "—"} ·{" "}
            <span className="mono">{cnpj}</span>
          </Linha>
          <Dica>
            Marcar <strong>não é correção</strong>: nenhum dado do documento
            mudou, então não há antes → depois a registrar. O que existe é a
            pendência aberta, com a data.
          </Dica>
        </Card>
      </Corpo>

      <Rodape>
        <BotaoLink href={documentoHref} variante="primary">
          Voltar ao documento
        </BotaoLink>
      </Rodape>
    </>
  );
}
