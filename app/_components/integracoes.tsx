"use client";

/**
 * **CONTAI-092 — o card "Integrações" de `/conta` (critério 16).**
 *
 * Quatro estados, textos e guardas literais de `design/mocks/CONTAI-092.md`.
 * Posição no spec: **depois** do card de dados da conta e da `Dica` de sessão,
 * **antes** do card vermelho "Sair" — entre informação neutra e ação
 * destrutiva, nunca ao lado da segunda.
 *
 * ⚠️ **Cenário de GESTÃO** (em casa, sentado): `/conta` não tem versão de
 * canteiro, e nenhum dos quatro estados pede resposta rápida de uma mão. O
 * "Teste do Canteiro" não se aplica aqui — está dito no spec e no ticket.
 *
 * ⚠️ **GATE FISCAL 7a-c.** Nenhum texto deste arquivo usa vocabulário de
 * controle fiscal ("obrigação", "prazo legal", "vencimento fiscal", "DARF",
 * "aferição"), nenhum apresenta a falta do lembrete como fato sobre o pagamento,
 * e nenhum insinua status de documentação hábil. As mensagens longas moram em
 * `lib/agenda/estado.ts`, onde há teste varrendo os termos proibidos.
 *
 * ⚠️ **ÂMBAR no estado 4, nunca vermelho** (spec): o vermelho do app é reservado
 * a custo fora do lugar e documentação faltante. Aqui nenhum dinheiro saiu
 * errado e nenhum documento está faltando — é uma conveniência pausada.
 */

import { useState } from "react";

import {
  Banner,
  Botao,
  Card,
  Dica,
  Linha,
  Passo,
} from "@/app/_components/ui";
import {
  TEXTO_EXPIRADO,
  TEXTO_NAO_CONECTADO,
  TEXTO_NAO_CONFIGURADO,
  TEXTO_NEGADO,
  qualEstado,
  type DadosDaIntegracao,
} from "@/lib/agenda/estado";
import type { ResultadoOAuth } from "@/lib/agenda/oauth";
import { reconciliarAgenda } from "@/lib/data";
import { formatarDataBR } from "@/lib/fiscal/obra";

/** A rota que inicia o consentimento — navegação de página inteira. */
const ROTA_AUTORIZAR = "/api/google/agenda/autorizar";

export function CardIntegracoes({
  dados,
  aviso,
  onRecarregar,
}: {
  /** `"erro"` = a rota de estado não respondeu; o resto de `/conta` continua. */
  dados: DadosDaIntegracao | "erro";
  /** O resultado transitório da volta do OAuth, ou `null`. */
  aviso: ResultadoOAuth | null;
  onRecarregar: () => void;
}) {
  const [conectando, setConectando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  if (dados === "erro") {
    // ⚠️ Erro do CARD, não da tela: `/conta` existe para mostrar e-mail, obras e
    // a saída da conta. Uma falha na leitura da integração não pode esconder
    // nada disso — e não é erro fiscal, então não é vermelho.
    return (
      <Card data-integracao-google="erro">
        <Passo>Integrações</Passo>
        <div className="mt-1 text-[13.5px] font-semibold">Google Agenda</div>
        <Dica>Não foi possível ler o estado da integração agora.</Dica>
        <div className="mt-2.5">
          <Botao variante="ghost" onClick={onRecarregar}>
            Tentar de novo
          </Botao>
        </div>
      </Card>
    );
  }

  const estado = qualEstado(dados);

  function conectar() {
    // Estado de botão antes da navegação: é página inteira, então dura pouco —
    // existe para evitar duplo clique, não para informar.
    setConectando(true);
    /**
     * ⚠️ **`window.location`, e NÃO `router.push`** — e a regra de lint que
     * reclama aqui está olhando o caso que este não é.
     *
     * `ROTA_AUTORIZAR` não é página do Next: é Route Handler que responde 307
     * para `accounts.google.com`. O router do Next faz navegação de CLIENTE e
     * não segue redirecionamento para outro host — o resultado seria um clique
     * que não faz nada. E tem de ser navegação de página inteira por desenho: a
     * tela de consentimento precisa aparecer na barra de endereço do Mateus, com
     * o domínio do Google à vista, que é o que lhe permite conferir a quem ele
     * está dando acesso.
     */
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = ROTA_AUTORIZAR;
  }

  async function sincronizarAgora() {
    setSincronizando(true);
    try {
      await reconciliarAgenda();
    } catch {
      // ⚠️ Silêncio deliberado (Gate Fiscal 7b): o card de `/conta` reflete o
      // estado da CONEXÃO, nunca o de um evento individual. Falha pontual de um
      // compromisso aparece no detalhe DELE, com a ação de nova tentativa — e
      // aqui um aviso vermelho sugeriria que algo está errado com o pagamento.
    }
    // Atualiza a contagem in-place, sem reload (spec): se zerou, nenhuma
    // celebração — só o número vira 0.
    onRecarregar();
    setSincronizando(false);
  }

  return (
    <Card data-integracao-google={estado}>
      <Passo>Integrações</Passo>
      <div className="mt-1 text-[13.5px] font-semibold">Google Agenda</div>

      {estado === "nao-configurado" ? (
        // Sem botão e sem chip: não é erro (não tem retry), é ausência de
        // configuração — estado estável.
        <Dica>{TEXTO_NAO_CONFIGURADO}</Dica>
      ) : null}

      {estado === "nao-conectado" ? (
        <>
          <Dica>{TEXTO_NAO_CONECTADO}</Dica>
          {aviso !== null ? (
            // A `Dica` extra do spec: estado 2 com aviso de um carregamento só,
            // nunca um quinto estado persistente.
            <p className="mt-2 text-[12px] text-red" role="status">
              {TEXTO_NEGADO}
            </p>
          ) : null}
          <div className="mt-2.5">
            <Botao variante="primary" disabled={conectando} onClick={conectar}>
              {conectando ? "Conectando…" : "Conectar Google Agenda"}
            </Botao>
          </div>
        </>
      ) : null}

      {estado === "conectado" ? (
        <>
          <div className="mt-1.5">
            <Linha rotulo="Conta Google">
              {/* Não é necessariamente o mesmo e-mail de login do contai — são
                  contas diferentes por natureza, e a tela não sugere que são a
                  mesma coisa. `null` quando o escopo não permitiu descobrir. */}
              {dados.emailConta ?? "não identificada"}
            </Linha>
            <Linha rotulo="Conectado desde">
              {dados.concedidoEm
                ? formatarDataBR(dados.concedidoEm.slice(0, 10))
                : "—"}
            </Linha>
            {/* ⚠️ Mostra o número SEMPRE, inclusive 0 (spec): zero é a
                confirmação de que está tudo sincronizado, não um buraco na
                tela. E **não é pendência fiscal** — critério 9. */}
            <Linha rotulo="Pendentes">
              <span data-agenda-pendentes={String(dados.pendentes)}>
                {dados.pendentes === 1
                  ? "1 compromisso"
                  : `${dados.pendentes} compromissos`}
              </span>
            </Linha>
          </div>
          <div className="mt-2.5">
            {/* `ghost`, não `primary`: é reforço manual de algo que já roda
                automaticamente, não a ação principal da tela. */}
            <Botao
              variante="ghost"
              disabled={sincronizando}
              onClick={() => void sincronizarAgora()}
            >
              {sincronizando ? "Sincronizando…" : "Sincronizar agora"}
            </Botao>
          </div>
          {/* Sem botão de desconectar nesta entrega — decisão deliberada do
              spec, não esquecimento: revogar pela própria conta Google é o
              caminho que já existe fora do app, e inventar "o que fazer com os
              eventos já criados?" seria requisito novo. */}
        </>
      ) : null}

      {estado === "expirado" ? (
        <>
          <div className="mt-2">
            <Banner cor="amb" role="status">
              {TEXTO_EXPIRADO}
            </Banner>
          </div>
          <div className="mt-1.5">
            {/* Mantém o e-mail anterior visível: ajuda a saber se é a conta
                certa ao reconectar. */}
            <Linha rotulo="Última conta conectada">
              {dados.emailConta ?? "não identificada"}
            </Linha>
          </div>
          <div className="mt-2.5">
            <Botao variante="primary" disabled={conectando} onClick={conectar}>
              {conectando ? "Conectando…" : "Conectar de novo"}
            </Botao>
          </div>
        </>
      ) : null}
    </Card>
  );
}
