"use client";

/**
 * **CONTAI-080 — LIGAR NOTAS A UM AGENDAMENTO AINDA NÃO PAGO** (pré-vínculo).
 *
 * Fonte normativa: `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`,
 * ADENDO 6 §J.0-J.5 (natureza do pré-vínculo, soma livre), ADENDO 7 §K.2
 * (bifurcação por N na conversão) e ADENDO 8 §L.2 (texto por N no detalhe).
 *
 * ⚠️ **NENHUM CAMPO AQUI É FISCAL, e é por isso que esta tela não tem anexo
 * obrigatório, valor nem data.** §J.1, `[Certain]`: o pré-vínculo é *"uma
 * anotação estruturada de INTENÇÃO, gravada no banco, sobre um fato que ainda
 * não aconteceu"* — não entra em soma nenhuma, não é nó de `alocarCusto` e não
 * tira a nota de "Notas hábeis sem pagamento vinculado". A disciplina "campo
 * vazio pergunta, campo preenchido afirma" aparece aqui assim: **o que carrega
 * marcado é o estado GRAVADO, nunca um default** — a tela não pré-marca nada
 * que ele já não tivesse afirmado, e salvar com tudo desmarcado é ato explícito
 * (remove todos), não estado inicial.
 *
 * ⚠️ **SEM semântica de cobertura/teto do CONTAI-074** (§J.4): nenhum chip
 * "Coberta por inteiro", nenhum bloco "Mostrar N já cobertas", nenhuma soma
 * comparada com nada. *"Não há restrição de soma no pré-vínculo, em nenhuma
 * direção"* — a restrição nasce só na CONVERSÃO, e é o `min()` que
 * `alocarCusto` já aplica.
 *
 * ⚠️ **A nota de origem (`documentoOrigemId`) NÃO é editável aqui** (critério
 * 15): ela é única e imutável desde a criação do agendamento (CONTAI-064/065).
 * Aparece fixa no topo, rotulada como herdada, e nenhuma linha desta tela a
 * toca. Ela participa do N da conversão em pé de igualdade com os pré-vínculos —
 * quem os funde, uma vez só, é `documentosResolvidosNaConfirmacao`.
 */

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CabecalhoDaTela,
  ColunaDeDetalhe,
  RodapeDeAcao,
} from "@/app/_components/detalhe";
import { useSessao } from "@/app/_components/sessao";
import {
  Banner,
  Botao,
  BotaoLink,
  BotaoSalvar,
  Card,
  Carregando,
  Chip,
  Dica,
  ErroDeGravacao,
  EstadoErro,
  Passo,
} from "@/app/_components/ui";
import {
  carregarCompromisso,
  carregarPainel,
  classificarErro,
  mensagemDeErroDeGravacao,
  salvarDocumentosPrevistos,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import {
  CHIP_PRE_VINCULO,
  PRE_VINCULO_SO_EM_ABERTO,
} from "@/lib/fiscal/compromisso";
import { ROTULO_DO_TIPO } from "@/lib/fiscal/documento";
import { filtrarCandidatos } from "@/lib/gestao/busca-candidatos";
import { formatarBRL } from "@/lib/money";
import type { Compromisso, Documento } from "@/lib/types";

/** CONTAI-078 — o mesmo campo e o mesmo limiar das duas telas `ligar`. */
const CAMPO_BUSCA =
  "min-h-[44px] w-full rounded-[9px] border border-line bg-white px-2.5 text-[16px] lg:min-h-[36px] lg:text-[13px]";
const MINIMO_PARA_BUSCAR = 5;

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      compromisso: Compromisso;
      painel: PainelDados;
      /** A nota herdada do agendamento, resolvida — fixa e não desmarcável. */
      origem: Documento | null;
      /** O universo editável: as notas da obra, MENOS a de origem. */
      editaveis: Documento[];
    };

/**
 * A ordem da lista: primeiro as notas do MESMO favorecido do agendamento,
 * preservando a ordem de chegada dentro de cada grupo.
 *
 * ⚠️ **Não é "sugestão" e não se rotula como tal na tela** — é só posição.
 * Sugestão, no produto, é o rótulo de `Candidato.sugestao`, que compara valor de
 * pagamento REAL com valor de nota; aqui não existe pagamento com que comparar,
 * e pintar isto de sugestão emprestaria a um agrupamento trivial o peso de uma
 * conferência que ele não fez.
 */
function ordenar(
  documentos: readonly Documento[],
  favorecidoId: string | null,
): Documento[] {
  if (favorecidoId === null) return [...documentos];
  return [
    ...documentos.filter((d) => d.favorecidoId === favorecidoId),
    ...documentos.filter((d) => d.favorecidoId !== favorecidoId),
  ];
}

export default function PreVincularNotas() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { pedirReautenticacao } = useSessao();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  /**
   * ⚠️ `null` enquanto não carregou, e não `[]`: o array vazio diria "ele
   * desmarcou tudo" antes de a tela saber o que estava gravado, e o diff
   * calculado sobre isso pediria a remoção de pré-vínculos que ele nunca tocou.
   */
  const [marcados, setMarcados] = useState<string[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [termoBusca, setTermoBusca] = useState("");

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const compromisso = await carregarCompromisso(id);
        const painel = await carregarPainel(compromisso.obraId);
        if (cancelado) return;
        const origem =
          compromisso.documentoOrigemId === null
            ? null
            : (painel.documentos.find(
                (d) => d.id === compromisso.documentoOrigemId,
              ) ?? null);
        setEstado({
          fase: "pronto",
          compromisso,
          painel,
          origem,
          // O universo é TODA nota da obra, de qualquer tipo e status —
          // quarentena e boleto inclusive. Pré-vínculo não é custo (§J.1), então
          // a condição de habilidade documental é irrelevante aqui, e é a mesma
          // abrangência que `documentoOrigemId` já aceita hoje.
          editaveis: ordenar(
            painel.documentos.filter(
              (d) => d.id !== compromisso.documentoOrigemId,
            ),
            compromisso.favorecidoId,
          ),
        });
        // ⚠️ O ESTADO GRAVADO, nunca um default: a origem não entra (ela não é
        // editável), e nada é marcado por semelhança.
        setMarcados(
          compromisso.documentoPrevistoIds.filter(
            (documentoId) => documentoId !== compromisso.documentoOrigemId,
          ),
        );
      } catch (erro) {
        if (!cancelado) setEstado({ fase: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ fase: "carregando" });
    setMarcados(null);
    setErroSalvar(null);
    setTentativa((t) => t + 1);
  }, []);

  const alternar = useCallback((documentoId: string) => {
    setMarcados((atual) =>
      atual === null
        ? atual
        : atual.includes(documentoId)
          ? atual.filter((x) => x !== documentoId)
          : [...atual, documentoId],
    );
  }, []);

  const pronto = estado.fase === "pronto" ? estado : null;
  const erroCarregar = estado.fase === "erro" ? estado.erro : null;

  /** O que está gravado hoje, sem a origem — a base do diff. */
  const gravados = useMemo(
    () =>
      (pronto?.compromisso.documentoPrevistoIds ?? []).filter(
        (documentoId) => documentoId !== pronto?.compromisso.documentoOrigemId,
      ),
    [pronto],
  );

  const diff = useMemo(() => {
    const atual = marcados ?? [];
    return {
      adicionar: atual.filter((x) => !gravados.includes(x)),
      remover: gravados.filter((x) => !atual.includes(x)),
    };
  }, [marcados, gravados]);

  const mudou = diff.adicionar.length > 0 || diff.remover.length > 0;

  const buscaDisponivel = (pronto?.editaveis.length ?? 0) > MINIMO_PARA_BUSCAR;
  const termo = termoBusca.trim();
  const buscaAtiva = buscaDisponivel && termo !== "";
  /** `filtrarCandidatos` é genérica no candidato inteiro — aqui o item é a nota. */
  const visiveis = buscaAtiva
    ? filtrarCandidatos(
        (pronto?.editaveis ?? []).map((item) => ({ item })),
        termo,
      ).map((c) => c.item)
    : (pronto?.editaveis ?? []);

  async function salvar() {
    if (!pronto || marcados === null || !mudou) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      // ⚠️ **A NOTA VIAJA INTEIRA, sem fallback de obra**: `salvarDocumentosPrevistos`
      // reconfere `podePreVincular` por item, e passar `compromisso.obraId` como
      // default para um id que a tela não achou faria a guarda de obra aprovar o
      // que ela existe para barrar. Id fora da lista carregada simplesmente não
      // vai — e ele não é alcançável, porque as marcas saem dela.
      await salvarDocumentosPrevistos({
        compromisso: pronto.compromisso,
        adicionar: pronto.editaveis.filter((d) => diff.adicionar.includes(d.id)),
        remover: diff.remover,
      });
      // Sem tela de sucesso intermediária (mesma decisão do CONTAI-073): o
      // "sucesso" visível é o chip/texto do §J.2 aparecendo no detalhe.
      router.push(`/compromisso/${pronto.compromisso.id}`);
    } catch (erro) {
      setSalvando(false);
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroSalvar(
        mensagemDeErroDeGravacao(
          erro,
          "no detalhe do agendamento, se as notas já aparecem pré-ligadas",
        ),
      );
    }
  }

  if (!pronto || marcados === null) {
    return (
      <>
        <CabecalhoDaTela titulo="Ligar notas a este agendamento" />
        <ColunaDeDetalhe>
          {erroCarregar ? (
            <>
              <Banner cor="red" role="alert">
                <strong>Não deu para carregar as notas desta obra.</strong>{" "}
                <strong>Nada foi pré-ligado</strong> — o agendamento continua
                como estava.
              </Banner>
              <EstadoErro erro={erroCarregar} onTentarDeNovo={tentarDeNovo} />
            </>
          ) : (
            <Carregando rotulo="Carregando as notas desta obra" />
          )}
        </ColunaDeDetalhe>
      </>
    );
  }

  const c = pronto.compromisso;

  /**
   * A recusa que não depende de documento, com o MESMO texto de
   * `podePreVincular` — que é a guarda de escrita e continua valendo por item, no
   * `salvar`. Aqui não há documento para checar obra, então a tela lê a única
   * condição que depende só do compromisso: **já respondido** (critério 2, a vida
   * do pré-vínculo é a do compromisso).
   *
   * ⚠️ **CONTAI-081 — a recusa por cartão saiu** (critério 3): esta tela é
   * reaproveitada sem mudança para compras no cartão, porque a lista de
   * candidatos nunca dependeu da origem. O que faltava era a conversão do outro
   * lado, e ela existe agora (migration 0024 + `/fatura/[id]/vinculos`).
   *
   * Âmbar, nunca vermelho — nada de fiscal aconteceu nem deixou de acontecer, e o
   * agendamento fica exatamente como estava.
   */
  const recusa = c.situacao !== "aberto" ? PRE_VINCULO_SO_EM_ABERTO : null;

  if (recusa !== null) {
    return (
      <>
        <CabecalhoDaTela
          titulo="Ligar notas a este agendamento"
          sub={`${c.favorecidoNome ?? "favorecido não informado"} · ${pronto.painel.obra.nome}`}
        />
        <ColunaDeDetalhe>
          <Banner cor="amb" role="status">
            {recusa}
          </Banner>
          <BotaoLink href={`/compromisso/${c.id}`} variante="primary">
            Voltar ao agendamento
          </BotaoLink>
        </ColunaDeDetalhe>
      </>
    );
  }

  return (
    <>
      <CabecalhoDaTela
        titulo="Ligar notas a este agendamento"
        sub={`${c.favorecidoNome ?? "favorecido não informado"} · ${pronto.painel.obra.nome}`}
      />
      <ColunaDeDetalhe>
        {erroSalvar ? (
          <ErroDeGravacao
            mensagem={erroSalvar}
            antes={
              <>
                <strong>Não deu para salvar.</strong>{" "}
              </>
            }
            depois={
              <>
                {" "}
                <strong>Nada mudou</strong> — as marcações continuam como
                estavam.
              </>
            }
          />
        ) : null}

        {/* O chip e a consequência ANTES da escolha: o que ele vai afirmar aqui
            não é custo, e a tela diz isso antes do primeiro toque. */}
        <Card>
          <Chip cor="amb" peso="vazado">
            {CHIP_PRE_VINCULO}
          </Chip>
          <Dica>
            Marcar aqui é <strong>registrar a intenção</strong> de que esta
            parcela se refere a estas notas. Nada entra no custo de aquisição,
            nada abate a base do INSS e nada aparece em relatório algum{" "}
            <strong>até o pagamento ser confirmado</strong>. As notas continuam
            contando em &quot;Notas hábeis sem pagamento vinculado&quot;.
          </Dica>
        </Card>

        {/* A nota de origem: LEITURA, fixa, sem checkbox (critério 15). */}
        {pronto.origem ? (
          <Card className="bg-soft">
            <Passo>Nota de origem — herdada</Passo>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-semibold break-words">
                🔒 {ROTULO_DO_TIPO[pronto.origem.tipo]}
                {pronto.origem.numero ? ` nº ${pronto.origem.numero}` : ""} ·{" "}
                {pronto.origem.favorecidoNome ?? "emitente não informado"}
              </span>
              <span className="mono flex-none text-[15px] font-bold">
                {pronto.origem.valorCentavos === null
                  ? "—"
                  : formatarBRL(pronto.origem.valorCentavos)}
              </span>
            </div>
            <Dica>
              Vinculada na criação deste agendamento —{" "}
              <strong>não pode ser removida aqui</strong>. Ela conta junto com as
              notas marcadas abaixo quando o pagamento for confirmado.
            </Dica>
          </Card>
        ) : null}

        {buscaDisponivel ? (
          <input
            type="text"
            aria-label="Buscar notas"
            placeholder="Buscar por favorecido, valor ou número da nota…"
            className={CAMPO_BUSCA}
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
          />
        ) : null}

        {pronto.editaveis.length === 0 ? (
          <Card>
            <div className="text-center text-[34px] leading-none">📄</div>
            <div className="mt-2 text-center font-semibold">
              Nenhuma nota registrada nesta obra ainda.
            </div>
            <Dica>
              {pronto.origem
                ? "Fora a nota de origem acima, não há outra nota desta obra para pré-ligar."
                : "Quando a nota chegar, registre-a — depois ela aparece aqui para ser pré-ligada."}
            </Dica>
            <div className="mt-2.5">
              <BotaoLink href="/adicionar/documento">
                Registrar o documento agora
              </BotaoLink>
            </div>
          </Card>
        ) : visiveis.length === 0 ? (
          <Card>
            <div className="text-center text-[34px] leading-none">🔎</div>
            <div className="mt-2 text-center font-semibold">
              Nada encontrado para &quot;{termo}&quot;
            </div>
            <Dica>
              Nenhuma nota desta obra combina com esse texto. Confira a grafia ou
              tente um valor diferente.
            </Dica>
            <div className="mt-2.5">
              <Botao variante="ghost" onClick={() => setTermoBusca("")}>
                Limpar busca
              </Botao>
            </div>
          </Card>
        ) : (
          <>
            <Passo>Notas desta obra</Passo>
            {visiveis.map((d) => {
              const marcado = marcados.includes(d.id);
              return (
                <label
                  key={d.id}
                  className={`flex min-h-[44px] cursor-pointer gap-3 rounded-[10px] border px-3 py-2.5 ${
                    marcado ? "border-ink bg-soft" : "border-line bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => alternar(d.id)}
                    className="mt-1 h-5 w-5 flex-none"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[14px] font-semibold break-words">
                        {d.favorecidoNome ?? "Emitente não informado"}
                      </span>
                      <span className="mono flex-none text-[15px] font-bold">
                        {d.valorCentavos === null
                          ? "—"
                          : formatarBRL(d.valorCentavos)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[12px] text-mut">
                      {ROTULO_DO_TIPO[d.tipo]}
                      {d.numero ? ` · nº ${d.numero}` : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </>
        )}
      </ColunaDeDetalhe>

      <RodapeDeAcao>
        <Dica>
          {/* ⚠️ NENHUMA SOMA AQUI, e a ausência é decisão do parecer (§J.4):
              pré-vínculo não tem teto em direção nenhuma, então um total
              comparado com o valor previsto anunciaria um limite que não
              existe. O aviso não-bloqueante de estouro ficou FORA do escopo
              deste ticket (decisão de produto do `po`). */}
          {marcados.length === 0
            ? "Nenhuma nota marcada — salvar assim remove os pré-vínculos que existirem."
            : `${marcados.length} ${marcados.length === 1 ? "nota marcada" : "notas marcadas"}, mais a de origem quando houver. Nada disso é custo ainda.`}
        </Dica>
        <BotaoSalvar
          ocupado={salvando}
          variante="primary"
          onClick={salvar}
          disabled={salvando || !mudou}
        >
          {salvando
            ? "Salvando…"
            : !mudou
              ? "Nada mudou para salvar"
              : marcados.length === 0
                ? "Salvar — sem nota pré-ligada"
                : `Salvar ${marcados.length} ${marcados.length === 1 ? "nota pré-ligada" : "notas pré-ligadas"}`}
        </BotaoSalvar>
        <BotaoLink href={`/compromisso/${c.id}`}>Cancelar</BotaoLink>
      </RodapeDeAcao>
    </>
  );
}
