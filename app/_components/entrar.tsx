"use client";

import { useState, type ReactNode } from "react";

import { CampoTexto } from "@/app/_components/campos";
import {
  Banner,
  Botao,
  Card,
  Corpo,
  Dica,
  Rodape,
} from "@/app/_components/ui";
import {
  codigoCompleto,
  DIGITOS_CODIGO,
  ehEmailValido,
  MENSAGEM_FALHA,
  mensagemDeFalhaAuth,
  normalizarCodigo,
} from "@/lib/auth";
import {
  atalhoDevDisponivel,
  entrarComCodigo,
  entrarComoDesenvolvimento,
  pedirCodigo,
} from "@/lib/sessao";

/**
 * O fluxo de entrar, em dois passos: e-mail → código de 6 dígitos
 * (design/mocks/CONTAI-002.html, telas 1 a 3).
 *
 * Renderiza `Corpo` + `Rodape` e nada mais, de propósito: quem monta o cabeçalho
 * é o chamador. São dois — a rota /entrar e o sobreposto de reautenticação que
 * aparece quando a sessão cai no meio de um formulário (tela 6). O sobreposto
 * não pode navegar para lugar nenhum: navegar desmontaria o formulário e levaria
 * junto o que já foi digitado.
 */

type Passo =
  | { nome: "email" }
  | { nome: "codigo"; email: string; reenviado: boolean };

export function FluxoEntrar({
  aoEntrar,
  aviso,
}: {
  /** Chamado com a sessão já estabelecida. */
  aoEntrar: () => void;
  /** Bloco no topo do corpo — usado pelo sobreposto (tela 6). */
  aviso?: ReactNode;
}) {
  const [passo, setPasso] = useState<Passo>({ nome: "email" });
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviarCodigo(reenvio = false) {
    if (ocupado) return;
    setErro(null);
    if (!ehEmailValido(email)) {
      setErro(MENSAGEM_FALHA.email_invalido);
      return;
    }
    setOcupado(true);
    try {
      await pedirCodigo(email);
      setCodigo("");
      setPasso({ nome: "codigo", email: email.trim(), reenviado: reenvio });
    } catch (e) {
      setErro(mensagemDeFalhaAuth(e, "email"));
    } finally {
      setOcupado(false);
    }
  }

  async function verificar(emailDoPasso: string) {
    if (ocupado) return;
    setErro(null);
    if (!codigoCompleto(codigo)) {
      setErro(`Digite os ${DIGITOS_CODIGO} dígitos que chegaram no e-mail.`);
      return;
    }
    setOcupado(true);
    try {
      await entrarComCodigo(emailDoPasso, codigo);
      aoEntrar();
    } catch (e) {
      setErro(mensagemDeFalhaAuth(e, "codigo"));
      setOcupado(false);
    }
  }

  async function atalhoDev() {
    setErro(null);
    setOcupado(true);
    try {
      await entrarComoDesenvolvimento();
      aoEntrar();
    } catch {
      setErro("Atalho de desenvolvimento falhou — o stack local está de pé?");
      setOcupado(false);
    }
  }

  if (passo.nome === "codigo") {
    return (
      <>
        <Corpo>
          {aviso}

          {/* Tela 3 do mock: o erro do código é banner, não rodapé de campo —
              é a primeira coisa que a tela diz, e vem com a saída junto. */}
          {erro ? (
            <>
              <Banner cor="red" role="alert">
                {erro}
              </Banner>
              <Card>
                <Dica>
                  Nada foi perdido: seus documentos e pagamentos continuam
                  guardados. É só digitar de novo.
                </Dica>
              </Card>
            </>
          ) : null}

          <div className="mt-2 text-center text-[32px]">✉️</div>
          <div className="text-center">
            <div className="text-[15px] font-semibold">Digite o código</div>
            <p className="mt-2 text-[12px] text-mut">
              Enviamos {DIGITOS_CODIGO} dígitos para{" "}
              <strong>{passo.email}</strong>.
            </p>
          </div>

          <CampoTexto
            rotulo="Código do e-mail"
            valor={codigo}
            onChange={(v) => setCodigo(normalizarCodigo(v))}
            inputMode="numeric"
            // Sem maxLength de propósito: o atributo corta o texto ANTES do
            // onChange, e colar "417 209" (com o espaço que a notificação do
            // iOS traz) perderia o último dígito. Quem limita é
            // `normalizarCodigo`, que primeiro tira o que não é dígito.
            autoComplete="one-time-code"
            placeholder="000000"
            classe="mono text-center text-[26px] tracking-[0.4em]"
          />

          {passo.reenviado && !erro ? (
            <Banner cor="grn" role="status">
              Novo código enviado. O anterior não vale mais.
            </Banner>
          ) : null}

          <Banner cor="grn" role="status">
            <strong>Você entra neste aparelho, sempre.</strong> O código é
            digitado aqui dentro — não existe link que possa abrir no navegador
            errado e deixar o app deslogado.
          </Banner>

          <Card>
            <Dica>
              Não chegou em 1 minuto? Veja o spam antes de pedir outro — pedir de
              novo invalida o código anterior.
            </Dica>
            <div className="mt-2">
              <Botao
                variante="ghost"
                onClick={() => void enviarCodigo(true)}
                disabled={ocupado}
              >
                Enviar de novo
              </Botao>
            </div>
          </Card>

          <Dica>
            Trocar de e-mail?{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                setErro(null);
                setCodigo("");
                setPasso({ nome: "email" });
              }}
            >
              Voltar
            </button>
          </Dica>
        </Corpo>

        <Rodape>
          <Botao
            variante="primary"
            onClick={() => void verificar(passo.email)}
            disabled={ocupado}
          >
            {ocupado ? "Entrando…" : "Entrar"}
          </Botao>
        </Rodape>
      </>
    );
  }

  return (
    <>
      <Corpo>
        {aviso}

        {erro ? (
          <Banner cor="red" role="alert">
            {erro}
          </Banner>
        ) : null}

        <div className="mt-4 text-center">
          <div className="text-[26px] font-bold tracking-tight">contai</div>
          <div className="mt-1 text-[12.5px] text-mut">
            a contabilidade da sua obra
          </div>
        </div>

        <div className="mt-5">
          <CampoTexto
            rotulo="Seu e-mail"
            valor={email}
            onChange={setEmail}
            tipo="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
          />
        </div>

        <Dica>
          Você recebe um <strong>código de {DIGITOS_CODIGO} dígitos</strong> por
          e-mail e digita aqui. Sem senha para lembrar no meio do canteiro.
        </Dica>

        <Card>
          <Dica>
            O app guarda CPF, CNO e as notas da obra. O login é o que separa
            esses dados de qualquer outra pessoa — não é formalidade.
          </Dica>
        </Card>
      </Corpo>

      <Rodape>
        <Botao
          variante="primary"
          onClick={() => void enviarCodigo()}
          disabled={ocupado}
        >
          {ocupado ? "Enviando…" : "Enviar código"}
        </Botao>
        {/* Só no stack local, só fora de produção, só com a flag do
            `npm run dev:local` — ver lib/sessao.ts. */}
        {atalhoDevDisponivel() ? (
          <Botao variante="ghost" onClick={() => void atalhoDev()} disabled={ocupado}>
            Entrar como desenvolvimento
          </Botao>
        ) : null}
      </Rodape>
    </>
  );
}
