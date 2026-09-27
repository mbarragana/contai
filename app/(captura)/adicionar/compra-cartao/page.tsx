"use client";

/**
 * NOVA COMPRA NO CARTÃO — CONTAI-022, critérios 2 a 5, 11, 12, 14.
 *
 * ⚠️ Esta compra **nasce sempre agendamento** — o dinheiro só sai quando a
 * fatura for paga. Nunca passa por `decidirRegistro`: quem decide o branch é
 * só o gate do parcelamento (`lib/fiscal/fatura.ts`), nunca `data ≤ hoje`
 * (adendo §B(c) — uma compra de ontem no cartão não vira pagamento por
 * caminho nenhum).
 *
 * Cenário: **captura** (mock, s1) — mas a densidade é maior que o formulário
 * de PIX/boleto porque o vencimento da fatura é um campo a mais, obrigatório
 * (achado do `cto-obra`: sem ele a compra nunca vence e nunca bloqueia
 * relatório anual).
 */

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { CampoTexto, Escolha } from "@/app/_components/campos";
import {
  CamposCurtos,
  COLUNA_DO_FORMULARIO,
  PassosDaCaptura,
} from "@/app/_components/captura";
import {
  ajudaDoValorDaNota,
  FavorecidoHerdado,
  LigadoANota,
  sugerirValorDaNota,
  type SugestaoValor,
} from "@/app/_components/nota-de-origem";
import { useSessao } from "@/app/_components/sessao";
import { AfirmacaoObra, TelaTrocarObra } from "@/app/_components/obra";
import { useObraDoRegistro } from "@/app/_components/usar-obra-do-registro";
import {
  AppBar,
  Banner,
  BotaoLink,
  BotaoSalvar,
  Card,
  Carregando,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
  Passo,
  Rodape,
} from "@/app/_components/ui";
import {
  carregarDocumento,
  classificarErro,
  criarCompraCartao,
  garantirFavorecido,
  mensagemDeErroDeGravacao,
} from "@/lib/data";
import {
  RECUSA_PARCELADO,
  validarCompraCartao,
  type ErroCampoCompraCartao,
  type EntradaCompraCartao,
  type RespostaParcelamento,
} from "@/lib/fiscal/fatura";
import {
  formatarDocumento,
  soDigitos,
  tipoPorDocumento,
} from "@/lib/fiscal/identificacao";
import { MOTIVO_OBRA_DIFERENTE, podeVincular } from "@/lib/fiscal/vinculo";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL, parseValorInput } from "@/lib/money";
import { formatarDataBR } from "@/lib/fiscal/obra";
import type { Documento } from "@/lib/types";

const RESPOSTAS_PARC = [
  { valor: "vista", texto: "À vista" },
  { valor: "parcelado", texto: "Parcelado" },
] as const satisfies readonly { valor: RespostaParcelamento; texto: string }[];

type Fase =
  | { nome: "formulario" }
  | { nome: "salvando" }
  | {
      nome: "agendado";
      faturaId: string;
      favorecidoNome: string;
      valorCentavos: number;
      dataCompra: string;
      dataVencimento: string;
      /**
       * CONTAI-064, critério 10: a nota que ficou ANOTADA como origem desta
       * compra — e só quando ficou de verdade (obra divergente grava `null`, e
       * aí a confirmação não tem nada a dizer sobre nota nenhuma).
       */
      notaDeOrigem: Documento | null;
    };

function RegistrarCompraCartao() {
  const registro = useObraDoRegistro();
  const { pedirReautenticacao } = useSessao();
  const obra = registro.obra;
  const [trocando, setTrocando] = useState(false);
  const [fase, setFase] = useState<Fase>({ nome: "formulario" });
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  /**
   * CONTAI-064 — a compra que nasce de uma nota já registrada: o documento de
   * origem vem na query string de quem mandou para cá (hoje, a troca de "Como
   * foi pago" para Cartão em `/adicionar/pagamento`).
   *
   * `useSearchParams` e não `window.location` no primeiro render: chegando por
   * navegação client-side, o `location` ainda não tem a query e a herança
   * desapareceria sem aviso — que é exatamente o silêncio que este ticket veio
   * matar. O custo é a fronteira de Suspense no fim do arquivo.
   */
  const documentoNaUrl = useSearchParams().get("documento");
  const [documentoDeOrigemId, setDocumentoDeOrigemId] = useState<string | null>(
    documentoNaUrl,
  );
  const [documentoDeOrigem, setDocumentoDeOrigem] = useState<Documento | null>(
    null,
  );
  const [tentativaDaNota, setTentativaDaNota] = useState(0);

  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [parcelado, setParcelado] = useState<RespostaParcelamento | null>(null);
  const [valor, setValor] = useState("");
  const [dataCompra, setDataCompra] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [erros, setErros] = useState<ErroCampoCompraCartao[]>([]);
  /** O valor que veio da nota, para a tela poder DIZER de onde ele saiu. */
  const [sugestaoValor, setSugestaoValor] = useState<SugestaoValor | null>(null);

  useEffect(() => {
    if (!documentoDeOrigemId) return;
    let cancelado = false;

    void (async () => {
      try {
        const carregado = await carregarDocumento(documentoDeOrigemId);
        if (cancelado) return;
        setDocumentoDeOrigem(carregado);
        // NOME e CNPJ/CPF vêm da nota porque é o MESMO favorecido, e ele já
        // existe no banco com esse documento. Não é (só) para poupar
        // digitação: a dedup de `garantirFavorecido` é pela chave
        // (dono, DOCUMENTO), então um dígito trocado na redigitação cria um
        // SEGUNDO favorecido, e a ficha Pagamentos Efetuados sairia com a
        // mesma empresa em duas linhas. Nenhum dos dois sobrescreve o que já
        // está no campo — o dedo do Mateus vence o carregamento.
        setNome((atual) => atual || (carregado.favorecidoNome ?? ""));
        setDocumento(
          (atual) =>
            atual || formatarDocumento(carregado.favorecidoDocumento ?? ""),
        );
        const sugestao = await sugerirValorDaNota(carregado);
        if (cancelado || sugestao === null) return;
        setSugestaoValor(sugestao);
        setValor((atual) => atual || sugestao.texto);
      } catch {
        // Documento que não abre não pode travar o registro da compra: o
        // dispêndio (aqui, o compromisso) é o fato, e ele tem de entrar. A
        // tela segue como se tivesse chegado sem parâmetro nenhum.
        if (!cancelado) setDocumentoDeOrigemId(null);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [documentoDeOrigemId, tentativaDaNota]);

  /**
   * O "Tentar de novo" padrão do `Carregando` recarrega a página, e aqui isso
   * apagaria valor, datas e a resposta do parcelamento já preenchidos.
   */
  const recarregarNota = useCallback(() => {
    setTentativaDaNota((t) => t + 1);
  }, []);

  const erroDe = (campo: ErroCampoCompraCartao["campo"]) =>
    erros.find((e) => e.campo === campo)?.mensagem;

  /**
   * Conferido ANTES de salvar, como no registro de pagamento: chegando por
   * `?documento=` de uma nota da obra B com a preferência do aparelho na obra
   * A, o vínculo é impossível — e o Mateus tem de saber disso enquanto ainda
   * pode trocar a obra desta tela, não depois de gravar.
   */
  const permissaoVinculo =
    documentoDeOrigem && obra
      ? podeVincular({ obraId: obra.id }, documentoDeOrigem)
      : null;
  const obraDivergente = permissaoVinculo !== null && !permissaoVinculo.ok;
  /**
   * Critério 7: é este id que vai para a RPC — `null` sempre que a nota é de
   * outra obra. Vínculo de obra errada não se grava para depois se explicar.
   */
  const origemParaGravar =
    documentoDeOrigem && !obraDivergente ? documentoDeOrigem.id : null;

  const entrada: EntradaCompraCartao = useMemo(
    () => ({
      favorecidoNome: nome,
      favorecidoDocumento: documento,
      valorCentavos: parseValorInput(valor),
      dataCompra,
      dataVencimentoFatura: dataVencimento,
      parcelado,
    }),
    [nome, documento, valor, dataCompra, dataVencimento, parcelado],
  );

  const podeSalvar = validarCompraCartao(entrada).length === 0;
  // Nomeia o PRIMEIRO campo que falta — mesmo padrão do CONTAI-032 (o botão
  // desabilitado diz o que fazer, nunca só "preencha algo").
  const faltando =
    parcelado === "vista"
      ? nome.trim().length < 2
        ? "o favorecido"
        : parseValorInput(valor) === null
          ? "o valor"
          : !dataCompra
            ? "a data da compra"
            : !dataVencimento
              ? "o vencimento da fatura"
              : null
      : null;

  const tipoFavorecido = useMemo(() => tipoPorDocumento(documento), [documento]);

  async function salvar() {
    setErroSalvar(null);
    const encontrados = validarCompraCartao(entrada);
    setErros(encontrados);
    if (encontrados.length > 0 || !obra) return;

    setFase({ nome: "salvando" });
    try {
      if (tipoFavorecido === null) throw new Error("CNPJ/CPF inválido.");
      const favorecidoId = await garantirFavorecido({
        nome: nome.trim(),
        // ⚠️ SÓ DÍGITOS, como no registro de pagamento. A dedup de
        // `garantirFavorecido` é pela chave (dono, DOCUMENTO): gravando a
        // máscara, a compra herdada de uma nota criaria um SEGUNDO favorecido
        // com o mesmo CNPJ — exatamente o duplicado que a herança existe para
        // impedir, e a ficha Pagamentos Efetuados sairia com duas linhas da
        // mesma empresa.
        documento: soDigitos(documento),
        tipo: tipoFavorecido,
      });
      const valorCentavos = entrada.valorCentavos as number;
      const { faturaId } = await criarCompraCartao({
        obraId: obra.id,
        favorecidoId,
        valorCentavos,
        dataCompra,
        dataVencimentoFatura: dataVencimento,
        // A origem viaja DENTRO da mesma chamada atômica que grava a compra
        // (`compra_cartao_gravar`, migration 0013) — não existe aqui o modo de
        // falha "compra salvou, vínculo falhou" que o registro de pagamento
        // tem, porque lá são duas chamadas e aqui é uma.
        documentoOrigemId: origemParaGravar,
      });
      setFase({
        nome: "agendado",
        faturaId,
        favorecidoNome: nome.trim(),
        valorCentavos,
        dataCompra,
        dataVencimento,
        notaDeOrigem: origemParaGravar ? documentoDeOrigem : null,
      });
    } catch (erro) {
      setFase({ nome: "formulario" });
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroSalvar(mensagemDeErroDeGravacao(erro, "na lista de compras desta fatura"));
    }
  }

  if (fase.nome === "agendado") {
    /**
     * CONTAI-066 — a MESMA condição dos três pontos do ticket: comparação
     * lexicográfica de string ISO `YYYY-MM-DD`, padrão já usado no arquivo.
     * Aqui dispensa o guard de string vazia que o formulário precisa: a
     * compra já foi gravada, então `fase.dataVencimento` está preenchida.
     *
     * Vencido ≠ pago (rotativo, atraso). Isto NÃO afirma que a fatura foi
     * paga — só muda para onde o wayfinding aponta. Quem afirma o pagamento
     * (com data real + comprovante) continua sendo o clique dentro de
     * `/fatura/[id]/confirmar` (Pre-mortem 1).
     */
    const faturaVencida = fase.dataVencimento <= hojeIso();
    return (
      <>
        <AppBar titulo="Agendado" sub={fase.favorecidoNome} />
        <PassosDaCaptura atual={3} />
        <Corpo className={COLUNA_DO_FORMULARIO}>
          <Banner cor="amb" role="status">
            <strong>Agendado para {formatarDataBR(fase.dataVencimento)}.</strong>{" "}
            Nada entrou em custo.
          </Banner>
          <Card className="border-dashed border-amb">
            <Linha rotulo="Favorecido">{fase.favorecidoNome}</Linha>
            <Linha rotulo="Valor previsto">
              <span className="mono text-mut">~ {formatarBRL(fase.valorCentavos)}</span>
            </Linha>
            <Linha rotulo="Data da compra">
              <span className="mono">{formatarDataBR(fase.dataCompra)}</span>
            </Linha>
            <Linha rotulo="Quando o dinheiro sai">
              <strong>para {formatarDataBR(fase.dataVencimento)}</strong>{" "}
              <span className="hint text-mut">vencimento da fatura</span>
            </Linha>
            <Dica>
              A data da compra <strong>não decide ano nenhum</strong>. Quem
              decide é o dia em que a fatura (ou a parte dela) for paga.
            </Dica>
            {/* CONTAI-066, critério 2 — wayfinding, não alegação fiscal: a
                Dica acima diz QUANDO o custo entra, esta diz PARA ONDE ir
                agora. Segunda `<Dica>` no mesmo Card de propósito (spec, item
                2) — Card ou Banner novo daria a este texto o peso de aviso
                fiscal, que ele não tem. */}
            {faturaVencida ? (
              <Dica>
                Esta fatura já venceu. O próximo passo é confirmar esse
                pagamento e anexar o comprovante da fatura.
              </Dica>
            ) : null}
          </Card>

          {/* ⚠️ CONTAI-064, critério 10 — O QUE O SISTEMA GARANTE HOJE, e nada
              além. O aviso aparece SÓ aqui, na confirmação, e não no
              formulário: aviso que aparece toda vez vira aviso que se aprende
              a ignorar.
              ⚠️ **REESCRITO pelo CONTAI-065.** Até ele, este texto dizia que o
              pagamento da fatura "não vem ligado a esta nota automaticamente" e
              mandava religar à mão — porque `documento_origem_id` era
              write-only e o vínculo morria na quitação (D79). A migration 0020
              propaga, então a frase antiga passou a ser FALSA: ela mandava
              repetir um trabalho que o app já faz. O que continua verdadeiro e
              segue escrito: nada entrou em CUSTO aqui, e quem limita quanto
              disso vira custo é o documento hábil, nunca a previsão. */}
          {fase.notaDeOrigem ? (
            <Card className="border-dashed">
              <div className="text-[13px]">
                <strong>Nota de origem:</strong>{" "}
                {fase.notaDeOrigem.favorecidoNome ?? "documento sem emitente"} ·{" "}
                <span className="mono">
                  {formatarBRL(fase.notaDeOrigem.valorCentavos ?? 0)}
                </span>
              </div>
              <Dica>
                Fica anotada como origem desta compra. Quando você pagar a
                fatura, o pagamento que nascer daqui{" "}
                <strong>já nasce ligado a esta nota</strong>, e o vínculo
                continua visível e desfazível na tela do pagamento. Quem limita
                quanto disso vira custo é o documento hábil, nunca esta
                previsão.
              </Dica>
            </Card>
          ) : null}
          <Banner cor="red" role="status">
            ⚠️ <strong>Ressalva que viaja junto:</strong> a tese do ano do
            pagamento da fatura é defensável, não pacífica. Exige confirmação
            de contador humano (CRC) antes da primeira declaração que a use.
          </Banner>
        </Corpo>
        {/* Critério 8: "Ver a fatura" e "Voltar ao início" são rotas de
            `app/(gestao)/` — abrem com o shell, e o fluxo termina num lugar
            reconhecível do produto. */}
        {/* CONTAI-066, critério 1 + spec item 3 — destino e rótulo trocam
            JUNTOS: "Ver a fatura" apontando para a confirmação seria
            wayfinding falso. O rótulo descreve o destino real, não promete
            que o pagamento já existe. */}
        <Rodape className={COLUNA_DO_FORMULARIO}>
          {faturaVencida ? (
            <BotaoLink
              href={`/fatura/${fase.faturaId}/confirmar`}
              variante="primary"
            >
              Confirmar o pagamento
            </BotaoLink>
          ) : (
            <BotaoLink href={`/fatura/${fase.faturaId}`} variante="primary">
              Ver a fatura
            </BotaoLink>
          )}
          <BotaoLink href="/adicionar/compra-cartao">
            Registrar outra compra
          </BotaoLink>
          <BotaoLink href="/">Voltar ao início</BotaoLink>
        </Rodape>
      </>
    );
  }

  if (trocando && obra) {
    return (
      <TelaTrocarObra
        obras={registro.obras}
        hoje={hojeIso()}
        onEscolher={(escolhida) => {
          registro.escolher(escolhida);
          setTrocando(false);
        }}
        onCancelar={() => setTrocando(false)}
      />
    );
  }

  /**
   * CONTAI-066 — a mesma condição do estado "agendado", agora sobre o campo que
   * o Mateus está digitando. Nunca inferida de outra fonte (Fora de Escopo): só
   * a data que ele próprio informou.
   *
   * Declarada aqui, depois da saída do estado "agendado", justamente para não
   * sombrear a de lá: são duas leituras da mesma regra, em fontes diferentes.
   *
   * O guard de string vazia não é detalhe: `"" <= hojeIso()` é `true`, e sem
   * ele a frase apareceria com o campo ainda em branco.
   */
  const faturaVencida = dataVencimento !== "" && dataVencimento <= hojeIso();

  return (
    <>
      <AppBar
        titulo="Nova compra no cartão"
        sub={
          // Mesmo texto literal do registro de pagamento quando ele nasce
          // ligado. Fora desse caso o subtítulo não muda: a compra é sempre
          // agendamento aqui, não existe o branch "vai virar agendamento".
          documentoDeOrigem && !obraDivergente
            ? `Já nasce ligado a ${formatarBRL(documentoDeOrigem.valorCentavos ?? 0)}`
            : `hoje é ${formatarDataBR(hojeIso())}`
        }
      />
      <PassosDaCaptura atual={2} />
      {/* ⚠️ Sem rail, pela mesma decisão do `po` que valeu para o pagamento
          (Fora de Escopo do CONTAI-047): fluxo curto e sem extração. */}
      <Corpo className={COLUNA_DO_FORMULARIO}>
        {registro.fase === "carregando" ? (
          <Carregando rotulo="Carregando a obra" />
        ) : null}
        {registro.fase === "erro" ? (
          <EstadoErro
            erro={registro.erro ?? { tipo: "falha", mensagem: "" }}
            onTentarDeNovo={registro.recarregar}
          />
        ) : null}

        {registro.fase === "pronta" && obra ? (
          <>
            {erroSalvar ? (
              <Banner cor="red" role="alert">
                {erroSalvar}
              </Banner>
            ) : null}

            <AfirmacaoObra
              rotulo="Registrando em"
              nome={obra.nome}
              onTrocar={
                registro.obras.length > 1 ? () => setTrocando(true) : undefined
              }
            />

            {/* Dito ANTES de salvar, com o motivo e a saída — e os dois blocos
                aparecem independente de "Parcelado?", para o Mateus ver o que a
                compra ia herdar antes de qualquer outra escolha. */}
            {obraDivergente ? (
              <Banner cor="red" role="alert">
                <strong>Esta compra não vai nascer ligada à nota.</strong>{" "}
                {MOTIVO_OBRA_DIFERENTE} Troque a obra desta tela ou desfaça o
                vínculo antes de salvar.
              </Banner>
            ) : null}

            {documentoDeOrigem ? (
              <LigadoANota
                nota={documentoDeOrigem}
                onDesfazer={() => {
                  // Os dois juntos: o efeito só CARREGA, e desfazer é ato do
                  // usuário, não sincronização de estado.
                  setDocumentoDeOrigemId(null);
                  setDocumentoDeOrigem(null);
                }}
              />
            ) : null}

            {/* CONTAI-066, critério 3 — frase extra no banner JÁ EXISTENTE,
                nunca banner novo (spec, item 1). O banner está acima do campo
                "Vencimento da fatura" na árvore e reage a ele assim que o
                Mateus digita; não mover o banner (fora de escopo). */}
            <Banner cor="amb" role="status">
              <strong>Esta compra nasce sempre agendamento</strong> — o
              dinheiro só sai quando a fatura for paga. O favorecido é o{" "}
              <strong>lojista</strong>, nunca o banco nem a administradora.
              {faturaVencida ? (
                <>
                  {" "}
                  Esta fatura já venceu: o próximo passo depois de salvar é
                  confirmar esse pagamento e anexar o comprovante da fatura.
                </>
              ) : null}
            </Banner>

            <Card className="flex flex-col gap-3.5">
              <Escolha
                destaque
                campo="parc"
                rotulo="Parcelado?"
                opcoes={RESPOSTAS_PARC}
                valor={parcelado}
                onChange={setParcelado}
                erro={parcelado === null ? erroDe("parcelado") : undefined}
              />
              {parcelado === "parcelado" ? (
                <Banner cor="red" role="alert">
                  <strong>{RECUSA_PARCELADO}</strong>
                </Banner>
              ) : null}
            </Card>

            {parcelado === "vista" ? (
              <Card className="flex flex-col gap-3.5">
                {/* CONTAI-047, critério 2 — escalares curtos em pares na tela
                    larga. A `Escolha` "Parcelado?" e a `RECUSA_PARCELADO` que
                    a acompanha ficam no card de cima, em coluna única: bloco de
                    pergunta fiscal não divide largura (Pre-mortem 1). */}
                {/* CONTAI-064 — nascendo de uma nota, quem recebe o dinheiro é
                    atributo DELA e não tem campo (adendo de 2026-08-18, §1);
                    avulso, continua digitável. Mesma estrutura condicional do
                    registro de pagamento. */}
                {documentoDeOrigemId ? (
                  documentoDeOrigem ? (
                    <FavorecidoHerdado
                      nota={documentoDeOrigem}
                      nome={nome}
                      documento={documento}
                      erroNome={erroDe("favorecidoNome")}
                      erroDocumento={erroDe("favorecidoDocumento")}
                      /* Sem `onSairParaCorrigir`: esta tela não replica a
                         confirmação de saída (Fora de Escopo do ticket), então
                         "Corrigir na nota" é sempre link direto — e o
                         `voltar=compra-cartao` é o que traz o Mateus de volta
                         PARA CÁ com o nome novo, em vez de despejá-lo num
                         `/adicionar/pagamento` vazio. */
                      voltarPara="compra-cartao"
                    />
                  ) : (
                    <Carregando
                      rotulo="Carregando a nota"
                      onTentarDeNovo={recarregarNota}
                    />
                  )
                ) : (
                  <CamposCurtos>
                    <CampoTexto
                      campo="favorecido"
                      rotulo="Favorecido"
                      valor={nome}
                      onChange={setNome}
                      placeholder="O lojista — nunca o banco ou a administradora"
                      erro={erroDe("favorecidoNome")}
                    />
                    <CampoTexto
                      campo="favorecidoDocumento"
                      rotulo="CNPJ / CPF do favorecido"
                      valor={documento}
                      onChange={setDocumento}
                      inputMode="numeric"
                      placeholder="00.000.000/0000-00"
                    />
                  </CamposCurtos>
                )}
                <CampoTexto
                  campo="fValor"
                  rotulo="Valor da compra"
                  valor={valor}
                  onChange={setValor}
                  inputMode="decimal"
                  placeholder="0,00"
                  ajuda={ajudaDoValorDaNota(sugestaoValor, valor)}
                  erro={erroDe("valorCentavos")}
                />
                <CamposCurtos>
                  <CampoTexto
                    campo="fCompra"
                    rotulo="Data da compra"
                    tipo="date"
                    valor={dataCompra}
                    onChange={setDataCompra}
                    ajuda="Fica registrada e não decide ano nenhum — serve para ligar a nota à fatura."
                    erro={erroDe("dataCompra")}
                  />
                  <CampoTexto
                    campo="fVenc"
                    rotulo="Vencimento da fatura"
                    tipo="date"
                    valor={dataVencimento}
                    onChange={setDataVencimento}
                    ajuda="Esta é a data prevista do agendamento. Sem ela a compra nunca vence e nunca bloqueia relatório anual."
                    erro={erroDe("dataVencimentoFatura")}
                  />
                </CamposCurtos>
              </Card>
            ) : null}
          </>
        ) : null}
      </Corpo>
      {registro.fase === "pronta" ? (
        <Rodape className={COLUNA_DO_FORMULARIO}>
          <Passo>Passo 2 de 2 ↓</Passo>
          <BotaoSalvar
            ocupado={fase.nome === "salvando"}
            variante="ghost"
            onClick={salvar}
            disabled={fase.nome === "salvando" || !podeSalvar}
          >
            {fase.nome === "salvando"
              ? "Salvando…"
              : parcelado === null
                ? "Diga se é parcelado para continuar"
                : parcelado === "parcelado"
                  ? "Compra parcelada não é aceita aqui"
                  : !podeSalvar
                    ? faltando
                      ? `Informe ${faltando} para continuar`
                      : "Preencha os campos para continuar"
                    : "Agendar — não entra no custo"}
          </BotaoSalvar>
          <BotaoLink href="/adicionar">Voltar</BotaoLink>
        </Rodape>
      ) : (
        <Rodape className={COLUNA_DO_FORMULARIO}>
          <BotaoLink href="/adicionar">Voltar</BotaoLink>
        </Rodape>
      )}
    </>
  );
}

/** A fronteira que `useSearchParams` exige (Next 16). */
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando rotulo="Carregando a obra" />}>
      <RegistrarCompraCartao />
    </Suspense>
  );
}
