"use client";

/**
 * **CONTAI-038 — o bloco "Retenção" do detalhe do documento.**
 *
 * ⚠️ **MUDOU NO CONTAI-053, e a frase antiga ficou obsoleta.** Ela dizia que o
 * repeater *"não cabia em `/adicionar/documento`, que é captura de canteiro"* —
 * e isso continua verdade **abaixo de 880px**, onde nada mudou. A partir dos
 * 880px da casca larga do `CONTAI-047`, o **`FormularioDeLinha` deste arquivo**
 * (e só ele) também é montado na captura, pelo `BlocoRetencaoDaCaptura` aqui
 * embaixo: o `BlocoRetencao` inteiro continua exigindo `documento.id` gravado e
 * continua sendo exclusivo da gestão.
 *
 * ⚠️ **Isto é tela de GESTÃO** (`CLAUDE.md`, tabela de cenários, corrigida em
 * 2026-08-18): o Mateus abre isto em casa, sentado, com a nota na mão. A régua
 * de "uma mão, com pressa" **não se aplica aqui** — é por isso que o repeater
 * tem cinco perguntas por linha e N linhas.
 *
 * ⚠️ **Um formulário, duas telas — nunca dois formulários.** O `FormularioDeLinha`
 * é o mesmo objeto nos dois lugares, com a MESMA validação
 * (`validarLinhaRetencao`) e os MESMOS textos (`lib/fiscal/retencao.ts`). É o
 * ponto que o Gate Fiscal do CONTAI-053 manda **revalidar**: drift de componente
 * é o vetor mais provável de a proibição de decompor "combinado" ou a proibição
 * de default vazar numa tela e sobreviver na outra.
 *
 * ⚠️ **Nenhuma rota nova** (spec, decisão de design 1): adicionar, remover e
 * responder acontecem **nesta tela**, expandindo e recolhendo no lugar.
 *
 * Todo texto com consequência fiscal vem de `lib/fiscal/retencao.ts`, copiado
 * do parecer. Este arquivo desenha; ele não redige regra nenhuma.
 */

import { useState } from "react";

import { CampoTexto, Escolha } from "@/app/_components/campos";
import {
  Banner,
  Botao,
  BotaoSalvar,
  Card,
  Chip,
  Consequencia,
  Dica,
  ErroDeGravacao,
  Linha,
} from "@/app/_components/ui";
import {
  classificarErro,
  criarLinhaRetencao,
  mensagemDeErroDeGravacao,
  removerLinhaRetencao,
  responderGateRetencao,
  responderQuemRecolhe,
} from "@/lib/data";
import {
  AJUDA_ROTULO_LITERAL,
  CHIP_RETENCAO_SEM_LINHA,
  CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR,
  descricaoDaComposicao,
  LINHA_RETENCAO_VAZIA,
  linhaSemRecolhedor,
  nomeDaRetencao,
  OPCOES_COMPOSICAO,
  OPCOES_GATE,
  OPCOES_QUEM_RECOLHE,
  OPCOES_TRIBUTO,
  PERGUNTA_COMPOSICAO,
  PERGUNTA_DESCONTO_EFETIVO,
  PERGUNTA_GATE,
  PERGUNTA_QUEM_RECOLHE,
  PERGUNTA_TRIBUTO,
  RETENCAO_FECHA_POR_NOTA,
  RETENCAO_SEM_LINHA_EFEITO,
  validarLinhaRetencao,
  type CampoLinhaRetencao,
  type EntradaLinhaRetencao,
} from "@/lib/fiscal/retencao";
import { formatarBRL, parseValorInput } from "@/lib/money";
import type {
  ComposicaoRetencao,
  Documento,
  LinhaRetencao,
  QuemRecolheRetencao,
  RespostaRetencaoNaNota,
  TributoRetido,
} from "@/lib/types";

const SIM_NAO = [
  { valor: "sim", texto: "Sim" },
  { valor: "nao", texto: "Não" },
] as const;

export function BlocoRetencao({
  documento,
  notaCoberta,
  onMudou,
  onSessaoExpirada,
}: {
  documento: Documento;
  /**
   * `Σ pagamentos vinculados` já cobre o valor bruto da nota. Vem do MESMO
   * cálculo que a home usa (`saldoDescobertoDaNota`), passado de cima — a tela
   * não recalcula cobertura, porque "quanto falta nesta nota" não pode ter
   * duas fontes de verdade.
   */
  notaCoberta: boolean;
  /** Recarrega o detalhe depois de qualquer gravação confirmada. */
  onMudou: () => void;
  onSessaoExpirada: () => void;
}) {
  if (documento.tipo !== "nf_servico") return null;

  if (documento.retencaoNaNota === null) {
    return (
      <ConfirmarGateLegado
        documentoId={documento.id}
        onMudou={onMudou}
        onSessaoExpirada={onSessaoExpirada}
      />
    );
  }

  if (documento.retencaoNaNota === "nenhuma") return null;

  return (
    <Repeater
      documento={documento}
      notaCoberta={notaCoberta}
      onMudou={onMudou}
      onSessaoExpirada={onSessaoExpirada}
    />
  );
}

/**
 * **Estado 2 do spec — o legado.** Documento gravado antes da migration 0017:
 * o gate está `null`, e `null` **não é "nenhuma"**.
 *
 * ⚠️ **Nada é pré-marcado, e não há backfill por inferência** (critério 18 /
 * decisão de design 9): a coluna antiga já não existe, então não há valor
 * anterior a exibir nem a converter. A tela pergunta do zero, olhando o papel
 * — que é a única fonte que vale.
 */
function ConfirmarGateLegado({
  documentoId,
  onMudou,
  onSessaoExpirada,
}: {
  documentoId: string;
  onMudou: () => void;
  onSessaoExpirada: () => void;
}) {
  const [escolha, setEscolha] = useState<RespostaRetencaoNaNota | null>(null);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    if (escolha === null) return;
    setGravando(true);
    setErro(null);
    try {
      await responderGateRetencao(documentoId, escolha);
      onMudou();
    } catch (e) {
      setGravando(false);
      if (classificarErro(e).tipo === "sem_sessao") {
        onSessaoExpirada();
        return;
      }
      // ⚠️ A escolha continua na tela: retry sem redigitar (padrão s3e do
      // CONTAI-021). Quando o servidor RECUSOU, a frase diz que nada foi
      // gravado; quando não houve resposta nenhuma, quem cala a afirmação é o
      // `ErroDeGravacao` (CONTAI-006, critério 6).
      setErro(mensagemDeErroDeGravacao(e, "no detalhe desta nota, se a resposta já aparece gravada"));
    }
  }

  return (
    <Card className="border-amb" data-pendencia="retencao-nao-perguntada">
      <Chip cor="amb">Retenção não perguntada</Chip>
      <p className="mt-2.5 text-[13.5px]">
        Esta nota foi registrada antes de o app perguntar sobre retenção.
        Confira no papel e responda — <strong>em branco não é “nenhuma”</strong>.
      </p>
      {erro ? (
        <ErroDeGravacao
          mensagem={erro}
          antes={
            <>
              <strong>Não deu para gravar.</strong>{" "}
            </>
          }
          depois={
            <>
              {" "}
              <strong>Nada foi alterado</strong> — a sua resposta continua aqui.
            </>
          }
        />
      ) : null}
      <div className="mt-3">
        <Escolha
          destaque
          rotulo={PERGUNTA_GATE}
          opcoes={OPCOES_GATE}
          valor={escolha}
          onChange={setEscolha}
        />
      </div>
      <div className="mt-2.5">
        <BotaoSalvar
          ocupado={gravando}
          variante="primary"
          type="button"
          onClick={confirmar}
          disabled={escolha === null || gravando}
        >
          {gravando ? "Confirmando…" : "Confirmar"}
        </BotaoSalvar>
      </div>
    </Card>
  );
}

/** Estados 3 a 7 do spec — a lista, o formulário e as duas correções. */
function Repeater({
  documento,
  notaCoberta,
  onMudou,
  onSessaoExpirada,
}: {
  documento: Documento;
  notaCoberta: boolean;
  onMudou: () => void;
  onSessaoExpirada: () => void;
}) {
  const [abrindo, setAbrindo] = useState(false);
  const linhas = documento.retencoes;
  const abertas = linhas.filter((l) => linhaSemRecolhedor(l, notaCoberta));
  // Decisão de design 8: o fechamento de "eu recolho" é por DOCUMENTO. Com
  // mais de uma linha nessa situação a tela DIZ isso, em vez de deixar ele
  // procurar por que duas sumiram juntas.
  const maisDeUmaEuRecolho =
    linhas.filter((l) => l.eDescontoEfetivo && l.quemRecolhe === "eu").length > 1;

  return (
    <Card
      className={abertas.length > 0 ? "border-red" : "border-amb"}
      data-bloco="retencao"
    >
      <div className="font-semibold">Retenção</div>

      {linhas.length === 0 ? (
        // ⚠️ **Estado 3 — critério 2.** "Destacada" com zero linhas é
        // inconsistência VISÍVEL, nunca lida como "sem retenção". Ela existe
        // porque o documento e as linhas gravam em dois statements: ele salvou
        // no canteiro e ainda não sentou para detalhar.
        <div data-pendencia="retencao-sem-linha">
          <div className="mt-1.5">
            <Chip cor="amb">{CHIP_RETENCAO_SEM_LINHA}</Chip>
          </div>
          <p className="mt-2.5 text-[13.5px]">{RETENCAO_SEM_LINHA_EFEITO}</p>
        </div>
      ) : (
        linhas.map((linha) => (
          <LinhaGravada
            key={linha.id}
            linha={linha}
            aberta={linhaSemRecolhedor(linha, notaCoberta)}
            onMudou={onMudou}
            onSessaoExpirada={onSessaoExpirada}
          />
        ))
      )}

      {maisDeUmaEuRecolho ? <Dica>{RETENCAO_FECHA_POR_NOTA}</Dica> : null}

      {abrindo ? (
        // ⚠️ **A persistência é do CHAMADOR desde o CONTAI-053** (`onAdicionar`),
        // e aqui ela é exatamente a de sempre: INSERT imediato por linha, com o
        // `documento.id` já gravado. O formulário não sabe mais gravar — é o que
        // o deixa servir também à captura, onde o documento ainda não existe.
        <FormularioDeLinha
          onAdicionar={async (entrada) => {
            await criarLinhaRetencao(documento.id, entrada);
            setAbrindo(false);
            onMudou();
          }}
          onCancelar={() => setAbrindo(false)}
          onSessaoExpirada={onSessaoExpirada}
        />
      ) : (
        <div className="mt-2.5">
          <Botao variante="ghost" type="button" onClick={() => setAbrindo(true)}>
            {linhas.length === 0
              ? "+ Adicionar a primeira linha de retenção"
              : "+ Adicionar outra linha"}
          </Botao>
        </div>
      )}
    </Card>
  );
}

/** Uma linha já gravada: o que ela diz, a pendência dela e as duas ações. */
function LinhaGravada({
  linha,
  aberta,
  onMudou,
  onSessaoExpirada,
}: {
  linha: LinhaRetencao;
  aberta: boolean;
  onMudou: () => void;
  onSessaoExpirada: () => void;
}) {
  const [escolha, setEscolha] = useState<QuemRecolheRetencao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function agir(acao: () => Promise<void>, marcar: (v: boolean) => void) {
    marcar(true);
    setErro(null);
    try {
      await acao();
      onMudou();
    } catch (e) {
      marcar(false);
      if (classificarErro(e).tipo === "sem_sessao") {
        onSessaoExpirada();
        return;
      }
      setErro(mensagemDeErroDeGravacao(e, "na lista de linhas de retenção desta nota"));
    }
  }

  const ocupado = salvando || removendo;

  return (
    <div className="mt-2.5 border-t border-line pt-2.5" data-retencao="linha">
      <div className="flex items-baseline justify-between gap-3">
        {/* ⚠️ O rótulo sai como está na nota, entre aspas e sem normalização
            nenhuma — é o ponto inteiro do `rotulo_literal` (ADENDO A.1). */}
        <span className="text-[13.5px] font-semibold break-words">
          “{linha.rotuloLiteral}”
        </span>
        <span className="mono flex-none text-[13.5px]">
          {formatarBRL(linha.valorCentavos)}
        </span>
      </div>
      <Dica>{descricaoDaComposicao(linha)}</Dica>
      <Linha rotulo="Abatido do pagamento">
        {linha.eDescontoEfetivo ? "sim" : "não — informativo na nota"}
      </Linha>
      {linha.eDescontoEfetivo ? (
        // ⚠️ **Rótulo LITERAL do ADENDO A.2** quando a composição é combinada
        // ou desconhecida: "retenção não discriminada, presumivelmente
        // recolhida por terceiros". Nunca "guia de ISS"/"guia de INSS" — nomear
        // o tributo de um valor que a nota não abriu é a decomposição por chute
        // que o A.1 proíbe, com outro rosto.
        <Linha rotulo="A recolher como">{nomeDaRetencao(linha)}</Linha>
      ) : null}

      {erro ? (
        <Banner cor="red" role="alert">
          {erro} <strong>Nada mudou nesta linha.</strong>
        </Banner>
      ) : null}

      {aberta ? (
        <div data-pendencia="retencao-sem-recolhedor">
          <Consequencia cor="red">
            {CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR}
          </Consequencia>
        </div>
      ) : null}

      {linha.eDescontoEfetivo ? (
        <div className="mt-2.5">
          <Escolha
            rotulo={PERGUNTA_QUEM_RECOLHE}
            opcoes={OPCOES_QUEM_RECOLHE}
            valor={escolha ?? linha.quemRecolhe}
            onChange={setEscolha}
          />
          <div className="mt-2">
            <BotaoSalvar
              ocupado={salvando}
              variante="primary"
              type="button"
              // Habilitado só quando a escolha MUDA em relação à gravada: um
              // botão que grava o mesmo valor ensina que o toque não faz nada.
              disabled={
                ocupado || escolha === null || escolha === linha.quemRecolhe
              }
              onClick={() =>
                agir(async () => {
                  if (escolha === null) return;
                  await responderQuemRecolhe(linha.id, escolha);
                }, setSalvando)
              }
            >
              {salvando ? "Salvando…" : "Salvar resposta"}
            </BotaoSalvar>
          </div>
        </div>
      ) : null}

      {/* Estado 7 — remover. **Sem diálogo de confirmação** (critério 3:
          "adicionar/remover livremente"), e **nunca otimista**: a linha só sai
          da tela depois de o servidor confirmar que apagou exatamente uma. */}
      <div className="mt-2">
        <BotaoSalvar
          ocupado={removendo} rotuloDemora="Ainda removendo…"
          variante="ghost"
          type="button"
          disabled={ocupado}
          onClick={() =>
            agir(() => removerLinhaRetencao(linha.id), setRemovendo)
          }
        >
          {removendo ? "Removendo…" : "Remover esta linha"}
        </BotaoSalvar>
      </div>
      {/* A correção de rótulo/valor/composição é remover e recriar — decisão do
          `cto-obra` em 2026-09-20. Dizer isso aqui evita que ele procure um
          "editar" que não existe. */}
      <Dica>
        Errou o rótulo, o valor ou a classificação? Remova a linha e registre de
        novo — a nota continua intacta no acervo.
      </Dica>
    </div>
  );
}

/**
 * **Estado 5 — o formulário de linha nova.** Uma peça, duas telas: a gestão
 * (`Repeater`, acima) e a captura em tela larga (`BlocoRetencaoDaCaptura`,
 * abaixo — CONTAI-053).
 *
 * ⚠️ Nasce **inteiramente em branco**, mesmo depois de uma linha já preenchida:
 * nenhum campo herda valor do anterior (spec, "Campos"). Herdar aqui seria um
 * default fiscal com outro nome. Vale nas DUAS telas e em qualquer largura —
 * critério 7 do CONTAI-053.
 *
 * ⚠️ **Atômico** (decisão de design 7): só entrega a linha com todos os campos
 * do ramo escolhido respondidos. Não existe "linha salva incompleta" — o banco
 * não permite essa linha existir (os dois CHECKs da 0017), e o botão nomeia o
 * que falta em vez de oferecer um toque que o servidor recusaria.
 *
 * ⚠️ **Ele não grava: `onAdicionar` grava** (extração do CONTAI-053). Na gestão
 * a prop é o INSERT imediato; na captura é um `push` no array local, síncrono,
 * porque o `documento_id` ainda não existe. Embutir o INSERT aqui era o que
 * obrigaria a captura a criar o documento antes do "Salvar" — o documento órfão
 * do pre-mortem 3 do ticket.
 */
export function FormularioDeLinha({
  onAdicionar,
  onCancelar,
  onSessaoExpirada,
}: {
  /**
   * Aceita a linha VÁLIDA. Pode ser assíncrono (gestão: grava e só então
   * resolve) ou síncrono (captura: acumula em memória). Erro levantado aqui é
   * mostrado no formulário, que continua preenchido.
   */
  onAdicionar: (entrada: EntradaLinhaRetencao) => Promise<void> | void;
  /**
   * `undefined` esconde o "Cancelar" — é o estado vazio da captura, onde o
   * formulário é a única coisa no bloco e não há a que voltar.
   */
  onCancelar?: () => void;
  /** Só existe onde há rede: a captura não passa (nada grava antes do Salvar). */
  onSessaoExpirada?: () => void;
}) {
  const [entrada, setEntrada] = useState<EntradaLinhaRetencao>(
    LINHA_RETENCAO_VAZIA,
  );
  const [valorTexto, setValorTexto] = useState("");
  const [tentou, setTentou] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const erros = validarLinhaRetencao(entrada);
  // Erro por campo só depois da primeira tentativa: um formulário que nasce
  // todo vermelho ensina a ignorar o vermelho.
  const erroDe = (campo: CampoLinhaRetencao) =>
    tentou ? erros.find((e) => e.campo === campo)?.mensagem : undefined;

  function mudar(patch: Partial<EntradaLinhaRetencao>) {
    setEntrada((atual) => ({ ...atual, ...patch }));
  }

  async function adicionar() {
    setTentou(true);
    if (erros.length > 0) return;
    setGravando(true);
    setErro(null);
    try {
      await onAdicionar(entrada);
    } catch (e) {
      setGravando(false);
      if (classificarErro(e).tipo === "sem_sessao") {
        onSessaoExpirada?.();
        return;
      }
      // ⚠️ O formulário continua preenchido, e NADA foi gravado: a linha só
      // existe no banco depois do INSERT confirmado (spec, estado 5).
      setErro(mensagemDeErroDeGravacao(e, "na lista de linhas de retenção desta nota"));
    }
  }

  return (
    <div
      className="mt-2.5 flex flex-col gap-3.5 border-t border-line pt-3"
      data-retencao="formulario"
    >
      <div className="font-semibold">Nova linha de retenção</div>

      {erro ? (
        <ErroDeGravacao
          mensagem={erro}
          antes={
            <>
              <strong>Não deu para adicionar.</strong>{" "}
            </>
          }
          depois={
            <>
              {" "}
              <strong>Nada foi gravado</strong> — o que você preencheu continua
              aqui.
            </>
          }
        />
      ) : null}

      <CampoTexto
        rotulo="Rótulo (copie exatamente da nota)"
        valor={entrada.rotuloLiteral}
        onChange={(v) => mudar({ rotuloLiteral: v })}
        ajuda={AJUDA_ROTULO_LITERAL}
        placeholder="Total das Retenções (ISSQN / Federais)"
        erro={erroDe("rotuloLiteral")}
      />

      <CampoTexto
        rotulo="Valor"
        valor={valorTexto}
        onChange={(v) => {
          setValorTexto(v);
          mudar({ valorCentavos: parseValorInput(v) });
        }}
        inputMode="decimal"
        placeholder="0,00"
        erro={erroDe("valorCentavos")}
      />

      <Escolha
        destaque
        rotulo={PERGUNTA_COMPOSICAO}
        opcoes={OPCOES_COMPOSICAO}
        valor={entrada.composicao}
        onChange={(v: ComposicaoRetencao) =>
          // ⚠️ Trocar a composição LIMPA o tributo: um tributo escolhido e
          // depois abandonado sobreviveria escondido no estado e violaria o
          // CHECK `documento_retencao_tributo_coerente`.
          mudar({
            composicao: v,
            tributo: v === "tributo_identificado" ? entrada.tributo : null,
          })
        }
        erro={erroDe("composicao")}
      />

      {entrada.composicao === "tributo_identificado" ? (
        <Escolha
          destaque
          rotulo={PERGUNTA_TRIBUTO}
          opcoes={OPCOES_TRIBUTO}
          valor={entrada.tributo}
          onChange={(v: TributoRetido) => mudar({ tributo: v })}
          erro={erroDe("tributo")}
        />
      ) : null}

      <Escolha
        destaque
        rotulo={PERGUNTA_DESCONTO_EFETIVO}
        opcoes={SIM_NAO}
        valor={
          entrada.eDescontoEfetivo === null
            ? null
            : entrada.eDescontoEfetivo
              ? "sim"
              : "nao"
        }
        onChange={(v) =>
          // Mesma limpeza da composição, pelo CHECK irmão
          // (`documento_retencao_recolhedor_coerente`).
          mudar({
            eDescontoEfetivo: v === "sim",
            quemRecolhe: v === "sim" ? entrada.quemRecolhe : null,
          })
        }
        erro={erroDe("eDescontoEfetivo")}
      />

      {entrada.eDescontoEfetivo === true ? (
        <Escolha
          destaque
          rotulo={PERGUNTA_QUEM_RECOLHE}
          opcoes={OPCOES_QUEM_RECOLHE}
          valor={entrada.quemRecolhe}
          onChange={(v: QuemRecolheRetencao) => mudar({ quemRecolhe: v })}
          erro={erroDe("quemRecolhe")}
        />
      ) : null}

      {/* Sem `erro` de campo antes da primeira tentativa, o leitor de tela
          ainda precisa ouvir o que falta — o rótulo do botão faz isso. */}
      <BotaoSalvar
        ocupado={gravando}
        variante="primary"
        type="button"
        onClick={adicionar}
        disabled={gravando || erros.length > 0}
      >
        {gravando
          ? "Adicionando…"
          : erros.length === 0
            ? "Adicionar linha"
            : `Faltam ${erros.length} ${
                erros.length === 1 ? "resposta" : "respostas"
              } para adicionar`}
      </BotaoSalvar>
      {onCancelar ? (
        <Botao variante="ghost" type="button" onClick={onCancelar}>
          Cancelar
        </Botao>
      ) : null}
    </div>
  );
}

/**
 * ══ CONTAI-053 — o repeater na CAPTURA, e só a partir de 880px ═════════════
 *
 * Fonte do desenho: `design/mocks/CONTAI-053.md` (delta sobre
 * `captura-no-desktop-v1.md`). Mora **dentro do card da pergunta** que o gera,
 * entre a resposta "Destacada" e a pergunta do CNO — nunca no rail: o rail só
 * espelha o já confirmado, e aqui pode nascer uma pendência fiscal nova
 * (Decisão 4 do mock da casca larga).
 *
 * ⚠️ **A largura é decidida por CSS, nunca por JS.** O bloco **sempre monta no
 * DOM** quando o gate é "destacada", e `hidden larga:flex` o esconde abaixo de
 * 880px. Isso não é preferência de estilo: é o que deixa o E2E provar a ausência
 * com `toBeHidden()` em vez de disputar uma corrida de hidratação com
 * `window.innerWidth` (spec, §1). Critério 6 — em tela estreita nada muda.
 *
 * ⚠️ **Nada aqui toca rede.** As linhas vivem no `useState` do formulário de
 * captura e só viram `INSERT` depois do "Salvar registro", por
 * `criarLinhasRetencao`. Por isso o bloco não tem estado de carregamento nem de
 * erro (spec, §2): não há nada para esperar e nada para falhar antes do Salvar.
 *
 * ⚠️ **Nenhum banner de `CONSEQUENCIA_RETENCAO_SEM_RECOLHEDOR` aqui**, ao
 * contrário da gestão — e a omissão é regra, não esquecimento: aquele julgamento
 * depende de `notaCoberta` (Σ pagamentos vinculados), que não existe antes de o
 * documento e os vínculos gravarem. Dizê-lo agora seria adivinhar; quem o diz é
 * `/documento/[id]`, com o dado de verdade.
 */
export function BlocoRetencaoDaCaptura({
  linhas,
  onAdicionar,
  onRemover,
}: {
  /** As linhas acumuladas em memória, na ordem em que ele as leu na nota. */
  linhas: EntradaLinhaRetencao[];
  onAdicionar: (entrada: EntradaLinhaRetencao) => void;
  onRemover: (indice: number) => void;
}) {
  const [abrindo, setAbrindo] = useState(false);
  const vazio = linhas.length === 0;

  return (
    <div
      data-captura="retencao"
      className="hidden flex-col border-b border-line pb-3 larga:flex"
    >
      {linhas.map((linha, i) => (
        <LinhaPendente
          // O índice é chave legítima aqui: `LinhaPendente` não tem estado
          // próprio, e a ordem é a única identidade que a linha ainda tem (ela
          // não foi gravada, logo não tem `id`).
          key={`${i}-${linha.rotuloLiteral}`}
          linha={linha}
          onRemover={() => onRemover(i)}
        />
      ))}

      {/* ⚠️ **Estado vazio: o formulário nasce JÁ ABERTO** — desvio proposital
          do `Repeater` da gestão (spec, §2). A Dor de Origem é "preencher tudo
          junto na adição do registro"; cobrar um clique para abrir o que ele
          veio preencher reintroduz a fricção que o ticket remove. Com uma linha
          já na lista o clique passa a fazer sentido, e aí ele volta. */}
      {vazio || abrindo ? (
        <FormularioDeLinha
          onAdicionar={(entrada) => {
            onAdicionar(entrada);
            setAbrindo(false);
          }}
          onCancelar={vazio ? undefined : () => setAbrindo(false)}
        />
      ) : (
        <div className="mt-2.5">
          <Botao variante="ghost" type="button" onClick={() => setAbrindo(true)}>
            + Adicionar outra linha
          </Botao>
        </div>
      )}
    </div>
  );
}

/**
 * Uma linha que ainda **não foi gravada** — o recap do estado "sucesso" do spec.
 *
 * ⚠️ Irmã de `LinhaGravada`, e as duas são renderizações da MESMA linha (dívida
 * nomeada na Viabilidade do ticket). O que esta não tem é ação de rede: sem
 * `id`, "Salvar resposta" e o DELETE não existem — "Remover esta linha" é
 * `splice` local, sem confirmação e sem servidor.
 *
 * ⚠️ A descrição sai das MESMAS funções da gestão (`descricaoDaComposicao`,
 * `nomeDaRetencao`): com composição combinada ou desconhecida, o nome continua
 * sendo o rótulo literal do ADENDO A.2 — nunca "guia de ISS".
 */
function LinhaPendente({
  linha,
  onRemover,
}: {
  linha: EntradaLinhaRetencao;
  onRemover: () => void;
}) {
  return (
    <div className="mt-2.5 border-t border-line pt-2.5" data-retencao="pendente">
      <div className="flex items-baseline justify-between gap-3">
        {/* O rótulo sai como está na nota, entre aspas e sem normalização. */}
        <span className="text-[13.5px] font-semibold break-words">
          “{linha.rotuloLiteral}”
        </span>
        <span className="mono flex-none text-[13.5px]">
          {formatarBRL(linha.valorCentavos ?? 0)}
        </span>
      </div>
      <Dica>{descricaoDaComposicao(linha)}</Dica>
      <Linha rotulo="Abatido do pagamento">
        {linha.eDescontoEfetivo ? "sim" : "não — informativo na nota"}
      </Linha>
      {linha.eDescontoEfetivo ? (
        <>
          <Linha rotulo="A recolher como">{nomeDaRetencao(linha)}</Linha>
          <Linha rotulo="Quem recolhe">
            {OPCOES_QUEM_RECOLHE.find((o) => o.valor === linha.quemRecolhe)
              ?.texto ?? "—"}
          </Linha>
        </>
      ) : null}
      <div className="mt-2">
        <Botao variante="ghost" type="button" onClick={onRemover}>
          Remover esta linha
        </Botao>
      </div>
    </div>
  );
}
