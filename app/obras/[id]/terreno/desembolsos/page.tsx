"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ListaDeAnexos, papeisDoDesembolso } from "@/app/_components/anexo";
import {
  comprovantesEscolhidos,
  EscolhaDeAnexos,
  semPapel,
  type AnexoEscolhido,
} from "@/app/_components/anexos-novos";
import { CampoTexto, Escolha } from "@/app/_components/campos";
import {
  PendenciaDeDatas,
  PerguntaQuandoSaiu,
  type RespostaDeDatas,
} from "@/app/_components/datas-do-desembolso";
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
  carregarDesembolsosTerreno,
  carregarObra,
  classificarErro,
  completarDesembolsoTerreno,
  criarDesembolsoTerreno,
  mensagemDeErro,
  subirParaAcervo,
  type ErroDeTela,
} from "@/lib/data";
import { ehDataValida } from "@/lib/fiscal/pagamento";
import {
  A_DATA_QUE_VALE,
  ANTES_DE_DIZER_O_QUE_E_CADA_PAPEL,
  APP_NAO_INVENTA_DATA,
  CHIP_FALTA_DATA_E_COMPROVANTE,
  CHIP_PAGO_SEM_COMPROVANTE,
  COMECE_PELA_DATA,
  COMPROVANTE_POR_TIPO,
  DATA_NO_FUTURO,
  DATA_NO_FUTURO_NO_COMPLEMENTO,
  dataInformada,
  desembolsoRegistrado,
  DESEMBOLSO_SEM_DATA,
  estadoDoGravar,
  FALTA_DATA_E_COMPROVANTE,
  FGTS_NA_ENTRADA_ENTRA,
  NOME_DO_DESEMBOLSO,
  PAGO_SEM_COMPROVANTE,
  PAGO_SEM_PAPEL,
  pagoSemComprovante,
  pagoSemPapel,
  PAPEL_NOVO_E_ACRESCIMO,
  pendenciaDeDatasAberta,
  perguntaNoComplemento,
  perguntaNoRegistro,
  PREVISTO_NAO_E_PAGO,
  temComprovante,
  tiposDeDesembolsoPara,
} from "@/lib/fiscal/terreno";
import { hojeIso } from "@/lib/hoje";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { formatarBRL, parseValorInput } from "@/lib/money";
import type {
  NaturezaAquisicaoTerreno,
  Obra,
  OrigemRecursoEntrada,
  TerrenoDesembolso,
  TipoDesembolsoTerreno,
} from "@/lib/types";

/**
 * Passo 2 do fluxo (mocks s15 e s16): o que saiu do bolso fora do banco.
 *
 * **É a data de cada um que decide em que ano ele entra** — não a data da
 * compra. Terreno pago em 2024 e ITBI recolhido em 2025 são custo de anos
 * diferentes, e é por isso que este ticket existe.
 *
 * A tela também é onde a pendência de complemento se resolve (critério 23): as
 * um desembolso pode ter valor e ainda não ter data (critérios 5 e 23).
 */

/**
 * ⚠️ As opções são FILTRADAS pela natureza da aquisição, e isso é trava
 * fiscal, não conveniência de tela.
 *
 * A trava do critério 14 impede a dupla contagem por AUSÊNCIA DE TIPO — não
 * existe "parcela do financiamento" no modelo. Mas ela só protege o tipo que
 * nomeia: numa obra `financiado`, oferecer "Parcela ao vendedor" ou "Pagamento
 * do terreno" é a porta lateral pela qual o débito mensal do banco entra como
 * linha avulsa, some com o informe do ano e o mesmo dinheiro é contado duas
 * vezes — custo inflado em Bens e Direitos é redução indevida de ganho de
 * capital, cobrada com multa (critérios 2 e 14).
 *
 * A regra mora em `lib/fiscal/terreno.ts`, com teste; aqui só se renderiza.
 * Natureza desconhecida devolve a lista cheia: o app não inventa restrição
 * sobre fato que não sabe.
 */
function opcoesDeTipo(
  natureza: NaturezaAquisicaoTerreno | null,
): readonly { valor: TipoDesembolsoTerreno; texto: string }[] {
  return tiposDeDesembolsoPara(natureza).map((valor) => ({
    valor,
    texto: NOME_DO_DESEMBOLSO[valor],
  }));
}

const ESTADOS = [
  { valor: "pago", texto: "Já paguei" },
  { valor: "previsto", texto: "Ainda não paguei" },
] as const;

const ORIGENS = [
  { valor: "proprio", texto: "Recurso próprio" },
  { valor: "fgts", texto: "FGTS" },
] as const satisfies readonly {
  valor: OrigemRecursoEntrada;
  texto: string;
}[];

type Fase =
  | { nome: "carregando" }
  | { nome: "erro"; erro: ErroDeTela }
  | { nome: "pronto" }
  | { nome: "salvando" };

interface ErroCampo {
  campo: string;
  mensagem: string;
}

/**
 * Este desembolso está esperando a data do pagamento?
 *
 * ⚠️ **`previsto` NÃO está**, e a distinção é fiscal, não cosmética: previsto
 * é o que ainda não foi pago (critério 5 do CONTAI-010), e o banco proíbe que
 * ele tenha data (`terreno_desembolso_previsto_sem_data`). Perguntar a data ao
 * anexar um contrato num previsto seria pedir a data de um débito que não
 * aconteceu — o app fabricando a evidência que ele não tem.
 *
 * A ausência de data num previsto também mantém a pergunta do critério 12
 * REPRESADA, que é o certo: sem pagamento não há data de caixa a colapsar.
 */
function precisaDaData(d: TerrenoDesembolso): boolean {
  return d.estado === "pago" && d.dataPagamento === null;
}

export default function DesembolsosDoTerreno() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [fase, setFase] = useState<Fase>({ nome: "carregando" });
  const [obra, setObra] = useState<Obra | null>(null);
  const [desembolsos, setDesembolsos] = useState<TerrenoDesembolso[]>([]);
  const [tentativa, setTentativa] = useState(0);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<string | null>(null);

  // ── Formulário do desembolso novo ──────────────────────────────────────
  const [tipo, setTipo] = useState<TipoDesembolsoTerreno | null>(null);
  const [valor, setValor] = useState("");
  const [estado, setEstado] = useState<"pago" | "previsto" | null>(null);
  const [data, setData] = useState("");
  const [origem, setOrigem] = useState<OrigemRecursoEntrada | null>(null);
  /** N papéis, cada um com o seu `papel` — critérios 8 e 14. */
  const [anexos, setAnexos] = useState<AnexoEscolhido[]>([]);
  /** A resposta do critério 12. `null` = ainda não respondeu. Sem default. */
  const [resposta, setResposta] = useState<RespostaDeDatas | null>(null);
  const [erros, setErros] = useState<ErroCampo[]>([]);

  // ── Completar a data / anexar o papel que chegou depois (critério 9b) ──
  // ⚠️ É a MESMA ação, e é por isso que é o mesmo bloco de estado: o que muda
  // é o que falta naquele desembolso (a data, o papel, ou os dois).
  const [completando, setCompletando] = useState<string | null>(null);
  const [dataCompletar, setDataCompletar] = useState("");
  const [anexosCompletar, setAnexosCompletar] = useState<AnexoEscolhido[]>([]);
  const [respostaCompletar, setRespostaCompletar] =
    useState<RespostaDeDatas | null>(null);
  const [erroCompletar, setErroCompletar] = useState<string | null>(null);

  const hoje = hojeIso();

  const recarregar = useCallback(async () => {
    const [carregada, lista] = await Promise.all([
      carregarObra(id),
      carregarDesembolsosTerreno(id),
    ]);
    setObra(carregada);
    setDesembolsos(lista);
  }, [id]);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        await recarregar();
        if (!cancelado) setFase({ nome: "pronto" });
      } catch (erro) {
        if (!cancelado) setFase({ nome: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [recarregar, tentativa]);

  const erroDe = (campo: string) =>
    erros.find((e) => e.campo === campo)?.mensagem;

  function validar(): ErroCampo[] {
    const encontrados: ErroCampo[] = [];
    if (tipo === null) {
      encontrados.push({ campo: "tipo", mensagem: "Diga o que é este desembolso." });
    }
    const centavos = parseValorInput(valor);
    if (centavos === null || centavos <= 0) {
      encontrados.push({ campo: "valor", mensagem: "Informe o valor pago." });
    }
    if (estado === null) {
      encontrados.push({
        campo: "estado",
        mensagem: "Responda se este valor já foi pago.",
      });
    }
    if (estado === "pago") {
      // ══ CONTAI-025 · A TRAVA SAIU DAQUI, e o comentário que a carimbava
      // saiu com ela. ═══════════════════════════════════════════════════════
      //
      // Estavam aqui duas recusas, e **nenhuma das duas tinha parecer**:
      // `!ehDataValida(data)` e `anexos.length === 0`. A segunda é a **D49** —
      // o texto que parecia justificá-la (*"sem o extrato anexado, este
      // lançamento não grava"*) é de OUTRA entidade, o informe anual, onde o
      // anexo é FONTE do dado e a recusa continua de pé (§1.2 e §A.2 do
      // parecer de 23/08). Aqui o anexo é **PROVA** de um fato que o Mateus
      // conhece sem ele: *"bloquear anexo-PROVA não evita erro nenhum: evita o
      // registro"*. Ele parou de usar o app por causa dela, e o banco de
      // produção está vazio.
      //
      // ⚠️ **O que NÃO saiu**: (a) a data continua **perguntada e sem
      // default** — nenhum caminho aqui a preenche, nem com `created_at` nem
      // com hoje (critério 4; `APP_NAO_INVENTA_DATA` segue em tela); (b) o
      // `papel` do anexo que EXISTIR continua obrigatório (critério 14 do
      // CONTAI-027); (c) data no FUTURO continua recusada, porque aí não é
      // ausência de fato — é fato contraditado.
      //
      // ⚠️ E nenhum texto desta tela oferece `previsto` como SAÍDA a quem já
      // disse que pagou (§1.4.1): isso tiraria o custo de todo ano-calendário
      // e é **pior** que a trava.
      if (data !== "" && !ehDataValida(data)) {
        encontrados.push({
          campo: "data",
          mensagem: `Data incompleta. Deixe vazia se ainda não sabe — ${DESEMBOLSO_SEM_DATA}.`,
        });
      } else if (ehDataValida(data) && data > hoje) {
        // ⚠️ Redação nova do `contador` (Gate 2 do CONTAI-025). A anterior
        // oferecia SÓ `previsto` — a saída que tira o valor de todo
        // ano-calendário — para o erro que hoje é o mais provável: data errada
        // num pagamento real. Agora que o campo vazio grava, "deixe vazio" é a
        // saída certa, e ela precisava estar dita.
        encontrados.push({ campo: "data", mensagem: DATA_NO_FUTURO });
      }
      if (semPapel(anexos) > 0) {
        // Critério 14: `papel` é obrigatório e sem default. O papel que não foi
        // respondido não grava — nem com um palpite do app. Zero papel grava;
        // papel sem classificação, não.
        encontrados.push({
          campo: "anexos",
          mensagem:
            semPapel(anexos) === 1
              ? "Diga o que é o papel que falta — sem isso ele não grava."
              : `Diga o que é cada papel — ${semPapel(anexos)} ainda sem resposta.`,
        });
      }
      // Critério 12: com dois comprovantes, a resposta é OBRIGATÓRIA e não tem
      // default. O registro não é recusado por causa dela — ele é recusado por
      // ela estar em branco, que é outra coisa: o fato consumado grava dos dois
      // jeitos, e é a pergunta que precisa ser respondida antes.
      if (perguntaDoRegistro && resposta === null) {
        encontrados.push({
          campo: "resposta",
          mensagem: "Responda quando esse dinheiro saiu da sua conta.",
        });
      }
    }
    return encontrados;
  }

  async function salvar() {
    const encontrados = validar();
    setErros(encontrados);
    setErroSalvar(null);
    setSalvo(null);
    if (encontrados.length > 0) return;

    setFase({ nome: "salvando" });
    try {
      // Os N papéis sobem ANTES; o lançamento e as N linhas de anexo entram
      // depois, num ato só (RPC `terreno_desembolso_gravar`). Objeto no bucket
      // sem linha no banco é lixo silencioso e recuperável; linha sem objeto
      // seria o inverso, e não é.
      const gravar = await Promise.all(
        anexos.map(async (a) => ({
          arquivoPath: await subirParaAcervo(a.arquivo, "terreno"),
          papel: a.papel!,
        })),
      );
      await criarDesembolsoTerreno({
        obraId: id,
        tipo: tipo!,
        valorCentavos: parseValorInput(valor)!,
        // Previsto NUNCA leva data (constraint da 0008): previsto não é pago.
        // ⚠️ **`pago` sem data é LEGAL** e vai como `null` — o banco sempre
        // aceitou (o comentário da 0008 já previa "linhas `pago` sem data").
        // Aqui é onde a tentação mora: `?? hoje` ou `?? created_at` fariam o
        // app inventar o ano-calendário do custo. Critério 4.
        dataPagamento: estado === "pago" && data !== "" ? data : null,
        estado: estado!,
        origemRecurso: tipo === "entrada" ? origem : null,
        anexos: gravar,
        // ⚠️ **Grava assim mesmo, com pendência ou sem ela**: "nunca recuse o
        // registro de um fato consumado" (adendo 2 do parecer de 18/08).
        debitosMesmoDia: perguntaDoRegistro ? resposta === "mesmo_dia" : null,
      });
      await recarregar();
      // ⚠️ Critério 13 — a mensagem de sucesso **não pode mentir**. A anterior
      // afirmava "registrado no custo de {ano}" olhando só a data; com o
      // portão do comprovante, isso é falso metade das vezes.
      setSalvo(
        estado === "pago"
          ? desembolsoRegistrado(
              NOME_DO_DESEMBOLSO[tipo!],
              data === "" ? null : data.slice(0, 4),
              comprovantesEscolhidos(anexos) > 0,
            )
          : `${NOME_DO_DESEMBOLSO[tipo!]} registrado como previsto — não entra em ano nenhum.`,
      );
      setTipo(null);
      setValor("");
      setEstado(null);
      setData("");
      setOrigem(null);
      setAnexos([]);
      setResposta(null);
      setFase({ nome: "pronto" });
    } catch (erro) {
      setErroSalvar(mensagemDeErro(erro));
      setFase({ nome: "pronto" });
    }
  }

  /**
   * A pergunta do critério 12 dispara NESTE registro? Régua do §6: **dois
   * papéis `comprovante`**, nunca contagem de arquivos — e represada sem data.
   */
  const perguntaDoRegistro =
    estado === "pago" &&
    perguntaNoRegistro(data, comprovantesEscolhidos(anexos));

  // ── CONTAI-025 · o rótulo do Gravar e a consequência do que falta ──────
  //
  // ⚠️ **O botão GRAVA SEMPRE** (ADENDO 2 §5 de 18/08: *"o botão grava
  // sempre; o que muda é o estado que nasce"*). O que o desabilita é só (a) o
  // desembolso ainda não estar preenchido e (b) papel escolhido sem `papel`
  // respondido — critério 14 do CONTAI-027, que este ticket não toca. Falta de
  // data ou de comprovante **nunca** desabilita: isso seria a trava de volta
  // com rótulo novo, que é exatamente o que o relato 005 descreve.
  const valorEmCentavos = parseValorInput(valor);
  const temComprovanteAqui = comprovantesEscolhidos(anexos) > 0;
  const temDataAqui = ehDataValida(data);
  const botaoGravar = estadoDoGravar({
    preenchido:
      tipo !== null &&
      valorEmCentavos !== null &&
      valorEmCentavos > 0 &&
      estado !== null,
    estado,
    papeisSemResposta: estado === "pago" ? semPapel(anexos) : 0,
    temData: temDataAqui,
    temComprovante: temComprovanteAqui,
  });

  /**
   * A consequência do que está faltando — **UMA caixa, nunca duas
   * empilhadas** (Gate Fiscal §4), e só depois de o desembolso estar
   * preenchido: antes disso ela cobraria papel de um lançamento que ainda não
   * existe.
   */
  const consequenciaDoFormulario =
    estado !== "pago" ||
    !botaoGravar.habilitado ||
    (temDataAqui && temComprovanteAqui) ? null : (
      <div
        className="rounded-[10px] border border-red px-[14px] py-3"
        data-consequencia-do-formulario
      >
        {!temDataAqui && !temComprovanteAqui ? (
          <>
            <Chip cor="red">{CHIP_FALTA_DATA_E_COMPROVANTE}</Chip>
            <Consequencia cor="red">
              {FALTA_DATA_E_COMPROVANTE} {COMECE_PELA_DATA}
            </Consequencia>
          </>
        ) : !temComprovanteAqui ? (
          <>
            <Chip cor="red">{CHIP_PAGO_SEM_COMPROVANTE}</Chip>
            <Consequencia cor="red">
              <strong>{CHIP_PAGO_SEM_COMPROVANTE}.</strong>{" "}
              {PAGO_SEM_COMPROVANTE}
            </Consequencia>
          </>
        ) : (
          <>
            <Chip cor="red">Falta a data</Chip>
            <Consequencia cor="red">{DESEMBOLSO_SEM_DATA}.</Consequencia>
          </>
        )}
      </div>
    );

  /**
   * Completar a data **e/ou** anexar o papel que chegou depois — critério 9b.
   * É a MESMA ação: o que muda é o que falta naquele desembolso.
   *
   * ⚠️ **INSERT, nunca substituição, nunca remoção.** O papel novo se soma;
   * nenhum papel gravado é tocado.
   */
  async function completar(d: TerrenoDesembolso) {
    setErroCompletar(null);
    const faltaData = precisaDaData(d);

    if (faltaData) {
      if (!ehDataValida(dataCompletar)) {
        setErroCompletar("Informe a data em que o dinheiro saiu da conta.");
        return;
      }
      if (dataCompletar > hoje) {
        // ⚠️ Texto PRÓPRIO deste ato (`contador`, Gate 2): aqui "deixe o campo
        // vazio" não cabe — o ato existe para informar a data. A saída segura
        // é SAIR SEM GRAVAR, e o texto anterior não a nomeava. E não oferece
        // `previsto`: quem completa a data já disse que pagou (critério 6).
        setErroCompletar(DATA_NO_FUTURO_NO_COMPLEMENTO);
        return;
      }
    }
    if (semPapel(anexosCompletar) > 0) {
      setErroCompletar(
        "Diga o que é cada papel — sem isso ele não grava (critério 14).",
      );
      return;
    }
    const dataDoAto = faltaData ? dataCompletar : d.dataPagamento;
    const precisaResponder = perguntaNoComplemento(
      d,
      comprovantesEscolhidos(anexosCompletar),
      dataDoAto,
    );
    if (precisaResponder && respostaCompletar === null) {
      setErroCompletar("Responda quando esse dinheiro saiu da sua conta.");
      return;
    }
    if (anexosCompletar.length === 0 && !faltaData && !precisaResponder) {
      setErroCompletar("Escolha ao menos um papel para anexar.");
      return;
    }

    setFase({ nome: "salvando" });
    try {
      const gravar = await Promise.all(
        anexosCompletar.map(async (a) => ({
          arquivoPath: await subirParaAcervo(a.arquivo, "terreno"),
          papel: a.papel!,
        })),
      );
      await completarDesembolsoTerreno(d.id, {
        dataPagamento: faltaData ? dataCompletar : undefined,
        anexos: gravar,
        debitosMesmoDia: precisaResponder
          ? respostaCompletar === "mesmo_dia"
          : undefined,
      });
      await recarregar();
      setCompletando(null);
      setDataCompletar("");
      setAnexosCompletar([]);
      setRespostaCompletar(null);
      // ⚠️ **Critério 13 — a mensagem não pode mentir.** A anterior escolhia
      // só por `faltaData` e afirmava que *"o valor passa a compor o custo de
      // {ano}"* ignorando o comprovante: com o portão do critério 8, ele **não
      // passa** se não houver papel `comprovante`. Mensagem de sucesso que
      // mente sobre consequência fiscal fecha a pendência na cabeça do Mateus.
      // Os dois textos são cópia literal do §5 do parecer.
      const temComprovanteAgora =
        temComprovante(d) || comprovantesEscolhidos(anexosCompletar) > 0;
      setSalvo(
        faltaData
          ? dataInformada(dataCompletar.slice(0, 4), temComprovanteAgora)
          : gravar.length === 1
            ? "Papel anexado — o acervo deste desembolso cresceu."
            : `${gravar.length} papéis anexados — o acervo deste desembolso cresceu.`,
      );
      setFase({ nome: "pronto" });
    } catch (erro) {
      setErroCompletar(mensagemDeErro(erro));
      setFase({ nome: "pronto" });
    }
  }

  /** Abre o formulário de complemento naquele desembolso, do zero. */
  function abrirComplemento(desembolsoId: string) {
    setCompletando(desembolsoId);
    setDataCompletar("");
    setAnexosCompletar([]);
    setRespostaCompletar(null);
    setErroCompletar(null);
  }

  if (fase.nome === "carregando" || fase.nome === "erro" || !obra) {
    return (
      <>
        <AppBar titulo="Desembolsos do terreno" />
        <Corpo>
          {fase.nome === "erro" ? (
            <EstadoErro
              erro={fase.erro}
              onTentarDeNovo={() => {
                setFase({ nome: "carregando" });
                setTentativa((t) => t + 1);
              }}
            />
          ) : (
            <Carregando rotulo="Carregando os desembolsos" />
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href={`/obras/${id}/terreno`}>Voltar ao terreno</BotaoLink>
        </Rodape>
      </>
    );
  }

  const semData = desembolsos.filter(
    (d) => d.estado === "pago" && d.dataPagamento === null,
  );

  /**
   * Os que já têm data — é neles que o papel novo entra pelo critério 9b, e é
   * onde o card do desembolso mostra a pendência do critério 12c. Os `previsto`
   * também entram: contrato e escritura chegam antes do pagamento, e recusar o
   * papel ali seria fechar o acervo por antecipação.
   */
  const jaGravados = desembolsos.filter((d) => !semData.includes(d));

  const tipos = opcoesDeTipo(obra.naturezaAquisicaoTerreno);

  /**
   * O formulário de complemento de UM desembolso — critério 9b.
   *
   * ⚠️ **Sem tela nova, e sem SEGUNDO componente**: é o mesmo bloco para os
   * três casos que existem (falta a data; falta o papel; chegou papel novo num
   * desembolso completo). O que muda é qual campo aparece. Dois formulários
   * quase iguais é como um deles deixa de disparar a pergunta do critério 12.
   */
  function formularioDeComplemento(d: TerrenoDesembolso) {
    const faltaData = precisaDaData(d);
    const dataDoAto = faltaData ? dataCompletar : d.dataPagamento;
    const precisaResponder = perguntaNoComplemento(
      d,
      comprovantesEscolhidos(anexosCompletar),
      dataDoAto,
    );
    return (
      <div className="mt-2.5 flex flex-col gap-3">
        {faltaData ? (
          <CampoTexto
            rotulo="Data em que saiu da conta"
            tipo="date"
            valor={dataCompletar}
            onChange={setDataCompletar}
            ajuda={A_DATA_QUE_VALE}
          />
        ) : null}
        <EscolhaDeAnexos
          rotulo="Anexar papel"
          ajuda={PAPEL_NOVO_E_ACRESCIMO}
          itens={anexosCompletar}
          onChange={setAnexosCompletar}
        />
        {/* A represa do §6 abre AQUI, no mesmo ato em que a data entra. */}
        {precisaResponder && dataDoAto ? (
          <PerguntaQuandoSaiu
            dataPagamento={dataDoAto}
            valor={respostaCompletar}
            onChange={setRespostaCompletar}
          />
        ) : null}
        {erroCompletar ? (
          <p role="alert" className="text-[12px] font-semibold text-red">
            {erroCompletar}
          </p>
        ) : null}
        <Botao
          variante="primary"
          onClick={() => void completar(d)}
          disabled={fase.nome === "salvando"}
        >
          {fase.nome === "salvando"
            ? "Salvando…"
            : faltaData
              ? "Informar a data"
              : "Gravar o papel"}
        </Botao>
        <Botao variante="ghost" onClick={() => setCompletando(null)}>
          Cancelar
        </Botao>
      </div>
    );
  }

  return (
    <>
      <AppBar titulo="O que saiu do seu bolso" sub={`${obra.nome} · terreno`} />
      <Corpo>
        {erroSalvar ? (
          <Banner cor="red" role="alert">
            {erroSalvar}
          </Banner>
        ) : null}
        {salvo ? (
          <Banner cor="grn" role="status">
            {salvo}
          </Banner>
        ) : null}

        <Banner cor="amb" role="status">
          <strong>É a data de cada um que decide em que ano ele entra</strong> —
          não a data da compra. Eles quase nunca acontecem todos no mesmo ano.
        </Banner>

        {/* ── Pendência de complemento (critério 23) ─────────────────────── */}
        {semData.length > 0 ? (
          <>
            <Passo>Valores sem data — falta completar</Passo>
            {semData.map((d) => (
              // ⚠️ **VERMELHO desde 23/08 (D39 revisada)**: o dinheiro saiu e
              // o valor não cai em ano nenhum. Era âmbar por herança do
              // CONTAI-027, não por critério.
              <Card key={d.id} className="border-red" data-sem-data={d.tipo}>
                {/* ── CONTAI-025, critério 10 · o ESTADO COMBINADO ──────────
                    **UM chip que nomeia os DOIS fatos** (mock v2): com os dois
                    eixos em vermelho, dois chips lado a lado viram mancha e o
                    olho lê *um* problema borrado. A fusão é só de
                    APRESENTAÇÃO — a consequência **não funde**: continuam as
                    duas frases do parecer, ordem data → comprovante, e
                    "Comece pela data" é literal. Nunca dois blocos
                    empilhados. */}
                {temComprovante(d) ? (
                  <Chip cor="red">Falta a data</Chip>
                ) : (
                  <Chip cor="red">{CHIP_FALTA_DATA_E_COMPROVANTE}</Chip>
                )}
                <Linha rotulo={NOME_DO_DESEMBOLSO[d.tipo]}>
                  <span className="mono font-semibold">
                    {formatarBRL(d.valorCentavos)}
                  </span>
                </Linha>
                {temComprovante(d) ? (
                  <Consequencia cor="red">{DESEMBOLSO_SEM_DATA}.</Consequencia>
                ) : (
                  <div data-pendencia="terreno-data-e-comprovante">
                    <Consequencia cor="red">
                      {FALTA_DATA_E_COMPROVANTE} {COMECE_PELA_DATA}
                    </Consequencia>
                  </div>
                )}
                {/* Falta a data, não o papel: quem já anexou tem o que abrir. */}
                <ListaDeAnexos
                  titulo="Papéis anexados"
                  itens={papeisDoDesembolso(d)}
                />
                {completando === d.id ? (
                  formularioDeComplemento(d)
                ) : (
                  <div className="mt-2.5">
                    <Botao
                      variante="primary"
                      onClick={() => abrirComplemento(d.id)}
                    >
                      Informar a data
                    </Botao>
                  </div>
                )}
              </Card>
            ))}
          </>
        ) : null}

        {/* ── Critério 9b: o papel que chega DEPOIS, num desembolso já
            gravado. Mesma ação, mesma tela — e a lista inclui os que já têm
            data e já têm papel, que é justamente o caso que não existia. */}
        {jaGravados.length > 0 ? (
          <>
            <Passo>Papéis de um desembolso já registrado</Passo>
            {jaGravados.map((d) => (
              <Card
                key={d.id}
                data-desembolso-gravado={d.id}
                className={
                  pendenciaDeDatasAberta(d) || pagoSemComprovante(d)
                    ? "border-red"
                    : undefined
                }
              >
                {/* Critério 12c — o card do desembolso é uma das duas
                    superfícies onde a pendência é indispensável. */}
                {pendenciaDeDatasAberta(d) ? (
                  <div className="mb-2">
                    <PendenciaDeDatas valorCentavos={d.valorCentavos} />
                  </div>
                ) : null}
                <Linha rotulo={NOME_DO_DESEMBOLSO[d.tipo]}>
                  <span className="mono font-semibold">
                    {formatarBRL(d.valorCentavos)}
                  </span>
                </Linha>
                {d.dataPagamento ? (
                  <Linha rotulo={d.estado === "pago" ? "Pago em" : "Previsto"}>
                    <span className="mono">
                      {formatarDataBR(d.dataPagamento)}
                    </span>
                  </Linha>
                ) : null}
                <ListaDeAnexos
                  titulo="Papéis deste desembolso"
                  itens={papeisDoDesembolso(d)}
                />
                {/* ── CONTAI-025, critério 8 · "tem papel, e nenhum deles é
                    comprovante". É o caso literal do relato: ele tem a
                    escritura, não tem os comprovantes — e a escritura prova o
                    preço, não o pagamento (§4.3).
                    ⚠️ Chip DIFERENTE do de baixo, e a diferença é o conjunto,
                    não o fato fiscal (§3 do Gate Fiscal). */}
                {pagoSemComprovante(d) && !pagoSemPapel(d) ? (
                  <div data-pendencia="terreno-sem-comprovante">
                    <Chip cor="red">{CHIP_PAGO_SEM_COMPROVANTE}</Chip>
                    <Consequencia cor="red">
                      <strong>{CHIP_PAGO_SEM_COMPROVANTE}.</strong>{" "}
                      {PAGO_SEM_COMPROVANTE}
                    </Consequencia>
                  </div>
                ) : null}
                {/* Critério 15 — "pago, e sem papel nenhum" continua visível,
                    agora derivado de "não existe linha de anexo". */}
                {pagoSemPapel(d) ? (
                  <div data-pendencia="terreno-sem-papel">
                    <Chip cor="red">Pago, e sem papel nenhum</Chip>
                    <Consequencia cor="red">{PAGO_SEM_PAPEL}</Consequencia>
                  </div>
                ) : null}
                {completando === d.id ? (
                  formularioDeComplemento(d)
                ) : (
                  <div className="mt-2.5">
                    <Botao
                      variante={pagoSemComprovante(d) ? "primary" : "ghost"}
                      onClick={() => abrirComplemento(d.id)}
                    >
                      {pagoSemComprovante(d)
                        ? "Anexar o comprovante"
                        : "Anexar um papel"}
                    </Botao>
                  </div>
                )}
              </Card>
            ))}
          </>
        ) : null}

        {/* ── Registrar um desembolso ────────────────────────────────────── */}
        <Passo>Registrar um desembolso</Passo>
        <Card className="flex flex-col gap-3.5">
          <Escolha
            destaque
            rotulo="O que é este desembolso?"
            opcoes={tipos}
            valor={tipo}
            onChange={setTipo}
            erro={erroDe("tipo")}
          />
          <CampoTexto
            rotulo="Valor"
            valor={valor}
            onChange={setValor}
            inputMode="decimal"
            placeholder="0,00"
            erro={erroDe("valor")}
          />
          <Escolha
            destaque
            rotulo="Este valor já foi pago?"
            opcoes={ESTADOS}
            valor={estado}
            onChange={setEstado}
            erro={erroDe("estado")}
          />

          {estado === "previsto" ? (
            <Consequencia cor="amb">{PREVISTO_NAO_E_PAGO}</Consequencia>
          ) : null}

          {estado === "pago" ? (
            <>
              <CampoTexto
                rotulo="Data em que saiu da conta"
                tipo="date"
                valor={data}
                onChange={setData}
                ajuda={A_DATA_QUE_VALE}
                erro={erroDe("data")}
              />
              {/* ⚠️ CONTAI-025 — a ajuda deixou de dizer "obrigatório", e não
                  é ajuste de tom: **zero papel grava**, e é o ponto do ticket.
                  O que o comprovante decide é se o valor entra no custo
                  CONFIRMADO, não se o registro existe. */}
              <EscolhaDeAnexos
                rotulo="Papéis deste desembolso"
                ajuda="Pode ser mais de um. Não são obrigatórios para gravar — é o comprovante que decide se este valor entra no custo confirmado."
                itens={anexos}
                onChange={setAnexos}
                erro={erroDe("anexos")}
              />
              {/* ── §4.3 NO MOMENTO DE ESCOLHER O PAPEL (critério 12) ────────
                  ⚠️ É o remédio do defeito derivado nomeado no Gate Fiscal §1:
                  `ROTULO_DO_PAPEL.nota = "Nota ou recibo"` captura o **recibo
                  do vendedor**, que pelo §4.3 é comprovante de entrada. Papel
                  mal escolhido joga desembolso legítimo para fora do custo
                  confirmado **em silêncio** — e é aqui que o erro nasce. A
                  mesma linha aparece junto da pendência. */}
              {anexos.length > 0 ? (
                <div className="rounded-lg border border-line px-2.5 py-2 text-[12px]">
                  <strong>{ANTES_DE_DIZER_O_QUE_E_CADA_PAPEL}</strong>
                  {COMPROVANTE_POR_TIPO.map((c) => (
                    <p key={c.titulo} className="mt-1">
                      <strong>{c.titulo}</strong> — {c.texto}
                    </p>
                  ))}
                </div>
              ) : null}
              {/* ── A consequência do que está faltando: UMA caixa, nunca duas
                  empilhadas. Ordem data → comprovante. */}
              {consequenciaDoFormulario}
              {/* A pergunta do critério 12. ⚠️ Ela NÃO aparece para quem anexou
                  um só papel, nem para comprovante + recibo: a régua é o PAPEL
                  (dois `comprovante`), nunca a contagem de arquivos. */}
              {perguntaDoRegistro ? (
                <PerguntaQuandoSaiu
                  dataPagamento={data}
                  valor={resposta}
                  onChange={setResposta}
                  erro={erroDe("resposta")}
                />
              ) : null}
            </>
          ) : null}

          {tipo === "entrada" ? (
            <>
              <Escolha
                rotulo="De onde saiu o dinheiro da entrada?"
                opcoes={ORIGENS}
                valor={origem}
                onChange={setOrigem}
              />
              <Dica>{FGTS_NA_ENTRADA_ENTRA}</Dica>
            </>
          ) : null}

          <Dica>{APP_NAO_INVENTA_DATA}</Dica>
        </Card>

        <Card>
          <Dica>
            <strong>Por que a data de cada um, e não uma data só:</strong> com
            uma data só, a situação declarada em 31/12 do ano da compra sairia
            inflada por um imposto que ainda não tinha sido pago, e a do ano
            seguinte sairia sem ele — a maior num ano e a menor no outro, nos
            dois casos sem lastro de desembolso.
          </Dica>
        </Card>
      </Corpo>

      <Rodape>
        {/* ⚠️ **O rótulo NOMEIA A CONSEQUÊNCIA** (Gate Fiscal §4), nunca diz
            "gravar mesmo assim". São quatro, um por combinação de data ×
            comprovante, e os três de pendência foram adjudicados pelo
            `contador` — o de "tem comprovante, falta a data" em 23/08, com o
            *"que falta"* recusando a simetria óbvia: *"da data" vs "de datas"
            faria uma distinção fiscal real depender de uma letra*, no mesmo
            formulário em que nasce a pendência "mais de uma data". */}
        <Botao
          variante="primary"
          data-gravar
          onClick={() => void salvar()}
          disabled={fase.nome === "salvando" || !botaoGravar.habilitado}
        >
          {fase.nome === "salvando" ? "Salvando…" : botaoGravar.rotulo}
        </Botao>
        <Botao
          variante="ghost"
          onClick={() => router.push(`/obras/${id}/terreno`)}
        >
          Voltar ao terreno
        </Botao>
      </Rodape>
    </>
  );
}
