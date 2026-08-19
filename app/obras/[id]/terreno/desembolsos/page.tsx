"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CampoArquivo, CampoTexto, Escolha } from "@/app/_components/campos";
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
  APP_NAO_INVENTA_DATA,
  DESEMBOLSO_SEM_DATA,
  FGTS_NA_ENTRADA_ENTRA,
  NOME_DO_DESEMBOLSO,
  PREVISTO_NAO_E_PAGO,
  tiposDeDesembolsoPara,
} from "@/lib/fiscal/terreno";
import { hojeIso } from "@/lib/hoje";
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
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erros, setErros] = useState<ErroCampo[]>([]);

  // ── Completar a data de um desembolso gravado sem ela ──────────────────
  const [completando, setCompletando] = useState<string | null>(null);
  const [dataCompletar, setDataCompletar] = useState("");
  const [arquivoCompletar, setArquivoCompletar] = useState<File | null>(null);
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
      // ⚠️ A data é OBRIGATÓRIA no desembolso pago, e não tem default: é ela
      // que decide o ano-calendário do custo. Campo vazio pergunta; data de
      // memória afirma.
      if (!ehDataValida(data)) {
        encontrados.push({
          campo: "data",
          mensagem: `Informe a data em que o dinheiro saiu da conta. ${DESEMBOLSO_SEM_DATA}.`,
        });
      } else if (data > hoje) {
        encontrados.push({
          campo: "data",
          mensagem:
            "Data no futuro — se ainda não saiu da conta, registre como 'ainda não paguei'.",
        });
      }
      // Anexo obrigatório para toda linha NOVA paga (disciplina do anexo no ato
      // do registro). Linha `previsto` não tem o que anexar: nada foi pago.
      if (!arquivo) {
        encontrados.push({
          campo: "arquivo",
          mensagem: "Anexe o comprovante — é ele que sustenta este custo na venda.",
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
      const caminho = arquivo ? await subirParaAcervo(arquivo, "terreno") : null;
      await criarDesembolsoTerreno({
        obraId: id,
        tipo: tipo!,
        valorCentavos: parseValorInput(valor)!,
        // Previsto NUNCA leva data (constraint da 0008): previsto não é pago.
        dataPagamento: estado === "pago" ? data : null,
        estado: estado!,
        origemRecurso: tipo === "entrada" ? origem : null,
        arquivoPath: caminho,
      });
      await recarregar();
      setSalvo(
        estado === "pago"
          ? `${NOME_DO_DESEMBOLSO[tipo!]} registrado no custo de ${data.slice(0, 4)}.`
          : `${NOME_DO_DESEMBOLSO[tipo!]} registrado como previsto — não entra em ano nenhum.`,
      );
      setTipo(null);
      setValor("");
      setEstado(null);
      setData("");
      setOrigem(null);
      setArquivo(null);
      setFase({ nome: "pronto" });
    } catch (erro) {
      setErroSalvar(mensagemDeErro(erro));
      setFase({ nome: "pronto" });
    }
  }

  async function completar(desembolsoId: string) {
    setErroCompletar(null);
    if (!ehDataValida(dataCompletar)) {
      setErroCompletar("Informe a data em que o dinheiro saiu da conta.");
      return;
    }
    if (dataCompletar > hoje) {
      setErroCompletar("Data no futuro — informe a data real do pagamento.");
      return;
    }
    setFase({ nome: "salvando" });
    try {
      const caminho = arquivoCompletar
        ? await subirParaAcervo(arquivoCompletar, "terreno")
        : null;
      await completarDesembolsoTerreno(desembolsoId, dataCompletar, caminho);
      await recarregar();
      setCompletando(null);
      setDataCompletar("");
      setArquivoCompletar(null);
      setSalvo(`Data informada — o valor passa a compor o custo de ${dataCompletar.slice(0, 4)}.`);
      setFase({ nome: "pronto" });
    } catch (erro) {
      setErroCompletar(mensagemDeErro(erro));
      setFase({ nome: "pronto" });
    }
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

  const tipos = opcoesDeTipo(obra.naturezaAquisicaoTerreno);

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
              <Card key={d.id} className="border-amb" data-sem-data={d.tipo}>
                <Chip cor="amb">Falta a data</Chip>
                <Linha rotulo={NOME_DO_DESEMBOLSO[d.tipo]}>
                  <span className="mono font-semibold">
                    {formatarBRL(d.valorCentavos)}
                  </span>
                </Linha>
                <Consequencia cor="amb">{DESEMBOLSO_SEM_DATA}.</Consequencia>
                {completando === d.id ? (
                  <div className="mt-2.5 flex flex-col gap-3">
                    <CampoTexto
                      rotulo="Data em que saiu da conta"
                      tipo="date"
                      valor={dataCompletar}
                      onChange={setDataCompletar}
                      ajuda={A_DATA_QUE_VALE}
                      erro={erroCompletar ?? undefined}
                    />
                    <CampoArquivo
                      rotulo="Comprovante (se você tiver)"
                      ajuda="Este valor está gravado sem comprovante. Anexar agora fortalece o acervo, e não é exigido para informar a data — o que falta aqui é a data."
                      accept=".pdf,image/*"
                      arquivo={arquivoCompletar}
                      onChange={setArquivoCompletar}
                    />
                    <Botao
                      variante="primary"
                      onClick={() => void completar(d.id)}
                      disabled={fase.nome === "salvando"}
                    >
                      {fase.nome === "salvando" ? "Salvando…" : "Informar a data"}
                    </Botao>
                    <Botao variante="ghost" onClick={() => setCompletando(null)}>
                      Cancelar
                    </Botao>
                  </div>
                ) : (
                  <div className="mt-2.5">
                    <Botao
                      variante="primary"
                      onClick={() => {
                        setCompletando(d.id);
                        setDataCompletar("");
                        setErroCompletar(null);
                      }}
                    >
                      Informar a data
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
              <CampoArquivo
                rotulo="Comprovante"
                ajuda="Obrigatório: é o documento que sustenta este custo no dia da venda."
                accept=".pdf,image/*"
                arquivo={arquivo}
                onChange={setArquivo}
                erro={erroDe("arquivo")}
              />
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
        <Botao
          variante="primary"
          onClick={() => void salvar()}
          disabled={fase.nome === "salvando"}
        >
          {fase.nome === "salvando" ? "Salvando…" : "Registrar desembolso"}
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
