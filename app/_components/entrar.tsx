"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

import { CampoTexto } from "@/app/_components/campos";
import {
  Banner,
  Botao,
  Card,
  Corpo,
  Dica,
  Rodape,
} from "@/app/_components/ui";
import { ehEmailValido, MENSAGEM_FALHA, mensagemDeFalhaAuth } from "@/lib/auth";
import {
  atalhoDevDisponivel,
  emailConhecidoNesteAparelho,
  entrarComSenha,
  entrarComoDesenvolvimento,
} from "@/lib/sessao";

/**
 * O fluxo de entrar: e-mail + senha, um passo só.
 *
 * Era em dois passos (e-mail → código de 6 dígitos) até 2026-08-17, quando o
 * Mateus trocou o método: o SMTP embutido do Supabase não deixa editar o
 * template, então o e-mail chega sempre como link e o código nunca existe. Ver
 * lib/sessao.ts. O mock (design/mocks/CONTAI-002.html) ainda mostra o fluxo do
 * código — a tela de senha vai ser aprovada no deploy de preview, exceção
 * deliberada ao mock-first registrada no ticket.
 *
 * Renderiza `Corpo` + `Rodape` e nada mais, de propósito: quem monta o cabeçalho
 * é o chamador. São dois — a rota /entrar e o sobreposto de reautenticação que
 * aparece quando a sessão cai no meio de um formulário (tela 6). O sobreposto
 * não pode navegar para lugar nenhum: navegar desmontaria o formulário e levaria
 * junto o que já foi digitado.
 */

/**
 * O e-mail lembrado é storage do aparelho, não estado do React: quem lê storage
 * na renderização é `useSyncExternalStore`, com `null` no servidor (que não
 * conhece este aparelho) — assim a hidratação bate. Nunca muda enquanto a tela
 * está aberta, então não há o que assinar.
 */
const semAssinatura = () => () => {};
const semEmailNoServidor = () => null;

export function FluxoEntrar({
  aoEntrar,
  aviso,
}: {
  /** Chamado com a sessão já estabelecida. */
  aoEntrar: () => void;
  /** Bloco no topo do corpo — usado pelo sobreposto (tela 6). */
  aviso?: ReactNode;
}) {
  /** E-mail do último login neste aparelho — desempata a mensagem de erro. */
  const emailConhecido = useSyncExternalStore(
    semAssinatura,
    emailConhecidoNesteAparelho,
    semEmailNoServidor,
  );
  // `null` = ainda não tocou no campo, então vale o e-mail do aparelho. Derivar
  // em vez de copiar para o estado: cópia exigiria um efeito, e o efeito
  // rodaria depois da primeira pintura — o campo piscaria vazio.
  const [emailDigitado, setEmailDigitado] = useState<string | null>(null);
  const email = emailDigitado ?? emailConhecido ?? "";
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function entrar() {
    if (ocupado) return;
    setErro(null);
    if (!ehEmailValido(email)) {
      setErro(MENSAGEM_FALHA.email_invalido);
      return;
    }
    if (senha.length === 0) {
      setErro(MENSAGEM_FALHA.senha_vazia);
      return;
    }
    setOcupado(true);
    try {
      await entrarComSenha(email, senha);
      aoEntrar();
    } catch (e) {
      setErro(
        mensagemDeFalhaAuth(e, { emailTentado: email, emailConhecido }),
      );
      // A senha NÃO é apagada: errar um caractere e ter de redigitar tudo com
      // uma mão só, no canteiro, é pior do que o risco de deixá-la no campo.
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

  return (
    <>
      <Corpo>
        {aviso}

        {/* O erro é banner, não rodapé de campo (tela 3 do mock): é a primeira
            coisa que a tela diz, e vem com a saída junto. */}
        {erro ? (
          <>
            <Banner cor="red" role="alert">
              {erro}
            </Banner>
            <Card>
              <Dica>
                Nada foi perdido: seus documentos e pagamentos continuam
                guardados. É só entrar de novo.
              </Dica>
            </Card>
          </>
        ) : null}

        <div className="mt-4 text-center">
          <div className="text-[26px] font-bold tracking-tight">contai</div>
          <div className="mt-1 text-[12.5px] text-mut">
            a contabilidade da sua obra
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <CampoTexto
            rotulo="Seu e-mail"
            valor={email}
            onChange={setEmailDigitado}
            tipo="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
          />
          {/* `current-password` + `type="password"` é o que faz o gerenciador do
              iPhone oferecer a senha guardada — sem isso, entrar no canteiro
              vira digitar senha na tela pequena, com uma mão. */}
          <CampoTexto
            rotulo="Sua senha"
            valor={senha}
            onChange={setSenha}
            tipo="password"
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </div>

        <Banner cor="grn" role="status">
          <strong>Você entra neste aparelho, sempre.</strong> Nenhum e-mail é
          enviado — não existe link que possa abrir no navegador errado e deixar
          o app deslogado.
        </Banner>

        <Card>
          <Dica>
            O app guarda CPF, CNO e as notas da obra. O login é o que separa
            esses dados de qualquer outra pessoa — não é formalidade.
          </Dica>
        </Card>

        <Dica>
          Esqueceu a senha? Ela se troca no painel do Supabase
          (Authentication → Users) — o app não manda e-mail de recuperação, de
          propósito.
        </Dica>
      </Corpo>

      <Rodape>
        <Botao
          variante="primary"
          onClick={() => void entrar()}
          disabled={ocupado}
        >
          {ocupado ? "Entrando…" : "Entrar"}
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
