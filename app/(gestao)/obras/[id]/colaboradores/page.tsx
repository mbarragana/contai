"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CampoTexto, Escolha } from "@/app/_components/campos";
import { CabecalhoDaTela, ColunaDeDetalhe } from "@/app/_components/detalhe";
import {
  Banner,
  Botao,
  BotaoSalvar,
  Card,
  Carregando,
  Chip,
  Dica,
  ErroDeGravacao,
  EstadoErro,
} from "@/app/_components/ui";
import {
  adicionarColaborador,
  alterarVisibilidade,
  carregarColaboradores,
  classificarErro,
  mensagemDeErroDeGravacao,
  removerColaborador,
  type ErroDeTela,
} from "@/lib/data";
import { ehEmailValido } from "@/lib/auth";
import type { Colaborador, VisibilidadeColaborador } from "@/lib/types";

/**
 * **Tela (a) do CONTAI-093 — gestão de colaboradores da obra.**
 *
 * Cenário: **gestão** (em casa, sentado). O "Teste do Canteiro" não se aplica —
 * conceder e revogar acesso a dado fiscal de outra pessoa não é coisa de fazer
 * com uma mão, com pressa, em pé.
 *
 * ⚠️ **Nenhum campo fiscal nesta tela** (Gate Fiscal do ticket, item 2): nome,
 * e-mail e visibilidade não decidem consequência tributária nenhuma. É por isso
 * — e só por isso — que a visibilidade pode nascer PRÉ-SELECIONADA em
 * "restrita", o que a proibição de default em campo fiscal nunca permitiria. A
 * pré-seleção é visível e explícita, e é o acesso mais estreito dos dois.
 */

type Fase =
  | { nome: "carregando" }
  | { nome: "erro"; erro: ErroDeTela }
  | { nome: "pronto" };

const OPCOES_VISIBILIDADE: readonly {
  valor: VisibilidadeColaborador;
  texto: string;
}[] = [
  { valor: "restrita", texto: "Restrita" },
  { valor: "total", texto: "Total" },
];

/**
 * ⚠️ **Texto de produto — e é a resposta provisória da Pergunta Aberta 3 do
 * ticket** ("texto exato do aviso 'e-mail sem conta'", sem resposta do Mateus
 * nesta data). O que ele NÃO pode fazer é calar: o vínculo foi gravado e não
 * funciona ainda, e silêncio aqui é o Mateus avisando o engenheiro que o acesso
 * está liberado quando não está.
 *
 * O passo é fora do app de propósito (Out of Scope: ciclo de vida de senha é
 * passo de dashboard, dívida D-iv) — o app não cria conta nem define senha.
 */
const AVISO_SEM_CONTA =
  "Vínculo salvo, mas esse e-mail ainda não tem conta no contai — " +
  "o acesso só funciona depois que a conta existir. Crie-a no painel do " +
  "Supabase (Authentication → Users → Add user, com Auto Confirm marcado e " +
  "o MESMO e-mail). Feito isso, o vínculo liga sozinho, sem refazer nada aqui.";

/**
 * As DUAS recusas do banco que este formulário alcança com um dedo — e sem esta
 * tradução as duas chegariam ao Mateus como texto do Postgres ("violates check
 * constraint ..."), que não diz o que fazer.
 *
 * Não é tradução genérica de erro: é o par de constraints que a migration 0030
 * criou JUNTO com esta tela, e as duas correspondem a um erro de digitação
 * provável — o próprio e-mail, e o e-mail de quem já tem acesso. Qualquer outra
 * falha continua indo por `mensagemDeErroDeGravacao`, que é quem sabe separar
 * "o servidor recusou" de "não sei se salvou".
 */
function recusaConhecida(erro: unknown): string | null {
  const texto =
    typeof erro === "object" && erro !== null && "message" in erro
      ? String((erro as { message?: unknown }).message ?? "")
      : "";
  if (texto.includes("obra_colaborador_nao_e_o_dono")) {
    return (
      "Esse é o seu próprio e-mail. Você já é o dono desta obra — " +
      "use o e-mail da outra pessoa."
    );
  }
  if (texto.includes("obra_colaborador_email_unico_ativo")) {
    return "Esse e-mail já tem acesso a esta obra. Ele está na lista abaixo.";
  }
  return null;
}

const EXPLICACAO_VISIBILIDADE: Record<VisibilidadeColaborador, string> = {
  // ⚠️ Copiado da Emenda 2026-10-14 do ticket, não reescrito: "restrita" NÃO é
  // "só o que eu criei" — é próprios registros + todos os pendentes de revisão
  // da obra, de qualquer colaborador.
  restrita:
    "Vê os registros que ela mesma cadastrou e os que ainda aguardam a sua revisão.",
  total: "Vê todos os registros da obra.",
};

export default function ColaboradoresDaObra() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;

  const [fase, setFase] = useState<Fase>({ nome: "carregando" });
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [tentativa, setTentativa] = useState(0);

  // O formulário. `visibilidade` nasce "restrita" (ver o ⚠️ do cabeçalho);
  // nome e e-mail nascem vazios porque não há o que o app possa supor neles.
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [visibilidade, setVisibilidade] =
    useState<VisibilidadeColaborador>("restrita");

  const [erroNome, setErroNome] = useState<string | undefined>();
  const [erroEmail, setErroEmail] = useState<string | undefined>();
  const [erroGravar, setErroGravar] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [avisoSemConta, setAvisoSemConta] = useState<string | null>(null);
  const [concedido, setConcedido] = useState<string | null>(null);

  /** Quem está na confirmação de remoção. `null` = diálogo fechado. */
  const [removendo, setRemovendo] = useState<Colaborador | null>(null);

  const recarregar = useCallback(async () => {
    setColaboradores(await carregarColaboradores(obraId));
  }, [obraId]);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const lista = await carregarColaboradores(obraId);
        if (cancelado) return;
        setColaboradores(lista);
        setFase({ nome: "pronto" });
      } catch (erro) {
        if (!cancelado) setFase({ nome: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [obraId, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setFase({ nome: "carregando" });
    setTentativa((t) => t + 1);
  }, []);

  async function adicionar() {
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim();
    const faltaNome = nomeLimpo === "";
    const emailRuim = !ehEmailValido(emailLimpo);

    setErroNome(faltaNome ? "Diga como você chama essa pessoa." : undefined);
    setErroEmail(
      emailRuim ? "Digite o e-mail com que ela vai entrar no app." : undefined,
    );
    setErroGravar(null);
    setAvisoSemConta(null);
    setConcedido(null);
    if (faltaNome || emailRuim) return;

    setSalvando(true);
    try {
      const criado = await adicionarColaborador({
        obraId,
        nome: nomeLimpo,
        email: emailLimpo,
        visibilidade,
      });
      await recarregar();
      setNome("");
      setEmail("");
      setVisibilidade("restrita");
      setConcedido(criado.nome);
      // O caso (b) do critério 11: gravou, mas a conta não existe. A tela DIZ,
      // em vez de deixar o Mateus achar que o acesso já está de pé.
      if (criado.colaboradorUserId === null) setAvisoSemConta(AVISO_SEM_CONTA);
    } catch (erro) {
      const conhecida = recusaConhecida(erro);
      if (conhecida) {
        // Erro DO CAMPO, não da gravação: vai no e-mail, que é onde está o
        // conserto, em vez de num banner que fala de servidor.
        setErroEmail(conhecida);
      } else {
        setErroGravar(
          mensagemDeErroDeGravacao(
            erro,
            "a lista abaixo, se a pessoa já aparece com acesso",
          ),
        );
      }
    } finally {
      setSalvando(false);
    }
  }

  async function trocarVisibilidade(
    colaborador: Colaborador,
    nova: VisibilidadeColaborador,
  ) {
    setErroGravar(null);
    setConcedido(null);
    try {
      await alterarVisibilidade(colaborador.id, nova);
      await recarregar();
    } catch (erro) {
      setErroGravar(
        mensagemDeErroDeGravacao(
          erro,
          `o que ${colaborador.nome} vê na lista abaixo`,
        ),
      );
    }
  }

  async function confirmarRemocao(colaborador: Colaborador) {
    setErroGravar(null);
    setConcedido(null);
    try {
      await removerColaborador(colaborador.id);
      await recarregar();
      setRemovendo(null);
    } catch (erro) {
      setErroGravar(
        mensagemDeErroDeGravacao(
          erro,
          `se ${colaborador.nome} ainda aparece na lista abaixo`,
        ),
      );
      setRemovendo(null);
    }
  }

  return (
    <>
      <CabecalhoDaTela titulo="Colaboradores" sub="Quem mais mexe nesta obra" />
      <ColunaDeDetalhe>
        {/*
          ⚠️ **O FORMULÁRIO FICA SEMPRE VISÍVEL**, nos quatro estados (critério
          10 e spec de design): não é escondido atrás de "+ Adicionar", e
          continua ativo no estado vazio — conceder o primeiro acesso é
          justamente o que se faz numa lista vazia. Só o estado de ERRO o
          substitui, porque gravar sem saber quem já tem acesso é como se
          concede o mesmo acesso duas vezes.
        */}
        {fase.nome === "erro" ? (
          <EstadoErro erro={fase.erro} onTentarDeNovo={tentarDeNovo} />
        ) : (
          <>
            <Card>
              <div className="flex flex-col gap-3">
                <div className="text-[13px] font-semibold">
                  Dar acesso a alguém
                </div>
                <CampoTexto
                  rotulo="Nome"
                  campo="colabNome"
                  valor={nome}
                  onChange={setNome}
                  erro={erroNome}
                  ajuda="Como você chama essa pessoa. É o nome que vai aparecer em “criado por”."
                />
                <CampoTexto
                  rotulo="E-mail"
                  campo="colabEmail"
                  tipo="email"
                  inputMode="email"
                  autoComplete="off"
                  valor={email}
                  onChange={setEmail}
                  erro={erroEmail}
                  ajuda="O mesmo e-mail da conta dela no contai."
                />
                <Escolha
                  rotulo="O que ela vê"
                  campo="colabVisibilidade"
                  opcoes={OPCOES_VISIBILIDADE}
                  valor={visibilidade}
                  onChange={setVisibilidade}
                />
                <Dica>{EXPLICACAO_VISIBILIDADE[visibilidade]}</Dica>
                <BotaoSalvar
                  ocupado={salvando}
                  variante="primary"
                  onClick={() => void adicionar()}
                  disabled={salvando}
                >
                  {salvando ? "Salvando…" : "Adicionar colaborador"}
                </BotaoSalvar>
              </div>
            </Card>

            {concedido ? (
              <Banner cor="grn" role="status">
                <strong>{concedido}</strong> agora tem acesso a esta obra.
              </Banner>
            ) : null}
            {avisoSemConta ? (
              <Banner cor="amb" role="alert">
                {avisoSemConta}
              </Banner>
            ) : null}
            {erroGravar ? (
              <ErroDeGravacao
                mensagem={erroGravar}
                antes="Não deu para gravar. "
              />
            ) : null}

            {fase.nome === "carregando" ? (
              <Carregando rotulo="Carregando os colaboradores" />
            ) : null}

            {fase.nome === "pronto" && colaboradores.length === 0 ? (
              <Card>
                <div className="text-[13.5px] font-semibold">
                  Nenhum colaborador cadastrado ainda
                </div>
                <p className="mt-1.5 text-[12.5px] text-mut">
                  Só você tem acesso a esta obra.
                </p>
              </Card>
            ) : null}

            {fase.nome === "pronto" && colaboradores.length > 0
              ? colaboradores.map((colaborador) => (
                  <Card key={colaborador.id} data-colaborador={colaborador.id}>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[14px] font-semibold">
                        {colaborador.nome}
                      </span>
                      {/*
                        Pergunta Aberta 6 do ticket (chip dedicado × texto puro),
                        sem resposta do Mateus: usamos o `Chip` que já existe, em
                        VERDE para "restrita" e ÂMBAR para "total". A direção da
                        cor é deliberada e não é alarme fiscal — âmbar aqui diz
                        "alcance maior, confira se é isso que você quer", e
                        vermelho está reservado no app para "o dinheiro saiu e
                        não está no custo".
                      */}
                      <Chip
                        cor={
                          colaborador.visibilidade === "total" ? "amb" : "grn"
                        }
                        peso="vazado"
                      >
                        {colaborador.visibilidade === "total"
                          ? "Vê tudo"
                          : "Vê o próprio e os pendentes"}
                      </Chip>
                    </div>
                    <div className="mt-px text-[12.5px] text-mut">
                      {colaborador.email}
                    </div>

                    {colaborador.colaboradorUserId === null ? (
                      <p
                        className="mt-1.5 text-[12px] font-semibold text-amb"
                        role="status"
                      >
                        Ainda sem conta no contai — o acesso começa a funcionar
                        quando a conta for criada no painel do Supabase.
                      </p>
                    ) : null}

                    <div className="mt-2.5 flex flex-col gap-2">
                      <Escolha
                        rotulo="O que ela vê"
                        campo="colabVisibilidadeDaLinha"
                        opcoes={OPCOES_VISIBILIDADE}
                        valor={colaborador.visibilidade}
                        onChange={(nova) =>
                          void trocarVisibilidade(colaborador, nova)
                        }
                      />
                      <Botao
                        variante="ghost"
                        onClick={() => setRemovendo(colaborador)}
                      >
                        Remover acesso
                      </Botao>
                    </div>
                  </Card>
                ))
              : null}

            <Dica>
              Remover o acesso não apaga nada: os registros que a pessoa
              cadastrou continuam na obra, com o nome dela em “criado por”.
            </Dica>
          </>
        )}
      </ColunaDeDetalhe>

      {/*
        ⚠️ **Diálogo de confirmação** (critério 10): na prática a ação é
        irreversível — readmitir cria um vínculo NOVO, e no intervalo a pessoa
        perde o acesso. O banco preserva a linha (é dela que sai o nome do
        rastro de autoria), mas isso não é desfazer.

        `role="dialog"` + `aria-modal` seguem o padrão do lightbox de anexo
        (`app/_components/anexo-preview.tsx`), que é o único modal do app.
      */}
      {removendo ? (
        <div
          data-dialogo="remover-colaborador"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Remover acesso"
            className="w-full max-w-[380px] rounded-[14px] border border-line bg-paper p-4"
          >
            <div className="text-[14px] font-bold">Remover acesso?</div>
            <p className="mt-1.5 text-[12.5px] text-mut">
              <strong>{removendo.nome}</strong> perde o acesso a esta obra na
              próxima vez que usar o app. Os registros que ela cadastrou
              continuam aqui, com o nome dela.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Botao
                variante="primary"
                onClick={() => void confirmarRemocao(removendo)}
              >
                Remover acesso
              </Botao>
              <Botao variante="ghost" onClick={() => setRemovendo(null)}>
                Cancelar
              </Botao>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
