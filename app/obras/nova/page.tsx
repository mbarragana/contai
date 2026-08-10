"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import {
  AvisoEquiparacao,
  PendenciaCno,
  rotuloSemCno,
} from "@/app/_components/obra";
import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  Card,
  Corpo,
  Dica,
  Linha,
  Passo,
  Rodape,
} from "@/app/_components/ui";
import {
  CamposCno,
  CamposIdentidade,
  CamposPremissas,
  CamposTerreno,
  ESTADO_VAZIO,
  paraBanco,
  paraEntrada,
  type EstadoObra,
} from "@/app/obras/_campos";
import { criarObra, mensagemDeErro } from "@/lib/data";
import {
  custoTerrenoCentavos,
  formatarDataBR,
  validarObra,
  type ErroCampoObra,
} from "@/lib/fiscal/obra";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import { gravarObraPreferida } from "@/lib/obra-ativa";
import type { Obra } from "@/lib/types";

/**
 * Cadastro de obra em 4 passos (mock CONTAI-003, telas 4 a 10). Nenhum campo de
 * obra exige SQL (critério 2) — era a dor D9.
 */

const CAMPOS_DO_PASSO: Record<number, ErroCampoObra["campo"][]> = {
  1: ["nome", "municipio", "dataInicioObra"],
  2: ["temCno", "cno", "cnoRegistradoEm"],
  3: [
    "valorTerrenoCentavos",
    "valorItbiCentavos",
    "valorEscrituraRegistroCentavos",
  ],
  4: ["unidadesAutonomas", "origemDesmembramentoLoteamento"],
};

const TITULO_DO_PASSO: Record<number, string> = {
  1: "Passo 1 de 4 — identificação",
  2: "Passo 2 de 4 — CNO",
  3: "Passo 3 de 4 — custo do terreno",
  4: "Passo 4 de 4 — como o imóvel está registrado",
};

type Fase =
  | { nome: "formulario" }
  | { nome: "salvando" }
  | { nome: "criada"; obra: Obra };

export default function NovaObra() {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoObra>(ESTADO_VAZIO);
  const [passo, setPasso] = useState(1);
  const [fase, setFase] = useState<Fase>({ nome: "formulario" });
  const [erros, setErros] = useState<ErroCampoObra[]>([]);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const hoje = hojeIso();

  const atualizar = useCallback(
    <C extends keyof EstadoObra>(campo: C, valor: EstadoObra[C]) => {
      setEstado((atual) => ({ ...atual, [campo]: valor }));
    },
    [],
  );

  const entrada = useMemo(() => paraEntrada(estado), [estado]);
  const erroDe = (campo: ErroCampoObra["campo"]) =>
    erros.find((e) => e.campo === campo)?.mensagem;

  /**
   * A pendência de CNO precisa de uma obra para ler a data de início; no
   * cadastro ela ainda não existe, então se monta uma a partir do que está na
   * tela — os textos são os mesmos do parecer, com a data que o Mateus digitou.
   */
  const obraEmRascunho: Obra = useMemo(
    () => ({
      id: "rascunho",
      nome: estado.nome,
      cno: null,
      matricula: null,
      cartorio: null,
      municipio: estado.municipio,
      valorTerrenoCentavos: 0,
      valorItbiCentavos: 0,
      valorEscrituraRegistroCentavos: 0,
      dataInicioObra: estado.dataInicioObra,
      cnoRegistradoEm: null,
      unidadesAutonomas: 1,
      origemDesmembramentoLoteamento: false,
    }),
    [estado.nome, estado.municipio, estado.dataInicioObra],
  );

  function avancar() {
    const encontrados = validarObra(entrada, hoje);
    const doPasso = encontrados.filter((e) =>
      CAMPOS_DO_PASSO[passo].includes(e.campo),
    );
    setErros(doPasso);
    if (doPasso.length > 0) return;
    setErros([]);
    setPasso((p) => p + 1);
  }

  async function criar() {
    const encontrados = validarObra(entrada, hoje);
    setErros(encontrados);
    setErroSalvar(null);
    if (encontrados.length > 0) {
      // Erro fora do passo atual: volta para onde ele mora, senão a mensagem
      // apareceria numa tela que não tem o campo.
      const primeiro = encontrados[0].campo;
      const passoDoErro = Object.entries(CAMPOS_DO_PASSO).find(([, campos]) =>
        campos.includes(primeiro),
      );
      if (passoDoErro) setPasso(Number(passoDoErro[0]));
      return;
    }

    setFase({ nome: "salvando" });
    try {
      const dados = paraBanco(entrada);
      const id = await criarObra(dados);
      // "Está aberta agora" (tela 10): a preferência nasce de uma criação
      // explícita do Mateus, não de um palpite do app.
      gravarObraPreferida(id);
      setFase({
        nome: "criada",
        obra: {
          id,
          nome: dados.nome,
          cno: dados.cno,
          matricula: dados.matricula,
          cartorio: dados.cartorio,
          municipio: dados.municipio,
          valorTerrenoCentavos: dados.valorTerrenoCentavos,
          valorItbiCentavos: dados.valorItbiCentavos,
          valorEscrituraRegistroCentavos: dados.valorEscrituraRegistroCentavos,
          dataInicioObra: dados.dataInicioObra,
          cnoRegistradoEm: dados.cnoRegistradoEm,
          unidadesAutonomas: dados.unidadesAutonomas,
          origemDesmembramentoLoteamento: dados.origemDesmembramentoLoteamento,
        },
      });
    } catch (erro) {
      setErroSalvar(mensagemDeErro(erro));
      setFase({ nome: "formulario" });
    }
  }

  // ── Tela 10 — obra criada ─────────────────────────────────────────────
  if (fase.nome === "criada") {
    const obra = fase.obra;
    return (
      <>
        <AppBar titulo="Obra criada ✓" sub={obra.nome} />
        <Corpo>
          <Banner cor="grn" role="status">
            <strong>{obra.nome}</strong> foi criada e está aberta agora.
          </Banner>
          <Card>
            <Linha rotulo="Início da obra">
              <span className="mono">{formatarDataBR(obra.dataInicioObra)}</span>
            </Linha>
            <Linha rotulo="CNO">
              {obra.cno ? (
                <span className="mono">{obra.cno}</span>
              ) : (
                <span className="font-semibold text-red">
                  {rotuloSemCno(obra, hoje)}
                </span>
              )}
            </Linha>
            <Linha rotulo="Custo do terreno">
              <span className="mono">
                {formatarBRL(custoTerrenoCentavos(obra))}
              </span>
            </Linha>
            <Linha rotulo="Unidades">
              {obra.unidadesAutonomas} ·{" "}
              {obra.origemDesmembramentoLoteamento
                ? "de desmembramento/loteamento"
                : "sem desmembramento"}
            </Linha>
          </Card>

          <AvisoEquiparacao obra={obra} />
          {obra.cno ? null : <PendenciaCno obra={obra} hoje={hoje} />}

          <Dica>
            Você pode editar qualquer um destes campos depois — o CNO sai depois
            do início, e o ITBI pode ser pago em outra data.{" "}
            <Link href={`/obras/${obra.id}`} className="underline">
              Dados da obra
            </Link>
          </Dica>
        </Corpo>
        <Rodape>
          <BotaoLink href="/adicionar/documento" variante="primary">
            Registrar o primeiro documento
          </BotaoLink>
          <BotaoLink href="/obras">Ver minhas obras</BotaoLink>
        </Rodape>
      </>
    );
  }

  // ── Telas 4 a 9 — o formulário em passos ──────────────────────────────
  const props = { estado, atualizar, erroDe };
  return (
    <>
      <AppBar titulo="Nova obra" sub={TITULO_DO_PASSO[passo]} />
      <Corpo>
        {erroSalvar ? (
          <Banner cor="red" role="alert">
            {erroSalvar}
          </Banner>
        ) : null}

        {passo === 1 ? <CamposIdentidade {...props} /> : null}
        {passo === 2 ? (
          <CamposCno {...props} hoje={hoje} obraParaPendencia={obraEmRascunho} />
        ) : null}
        {passo === 3 ? <CamposTerreno {...props} /> : null}
        {passo === 4 ? <CamposPremissas {...props} /> : null}
      </Corpo>
      <Rodape>
        <Passo>{TITULO_DO_PASSO[passo]} ↓</Passo>
        {passo < 4 ? (
          <Botao variante="primary" onClick={avancar}>
            {passo === 2 && estado.temCno === "nao"
              ? "Continuar sem CNO"
              : "Continuar"}
          </Botao>
        ) : (
          <Botao
            variante="primary"
            onClick={criar}
            disabled={fase.nome === "salvando"}
          >
            {fase.nome === "salvando" ? "Criando…" : "Criar obra"}
          </Botao>
        )}
        {passo > 1 ? (
          <Botao variante="ghost" onClick={() => setPasso((p) => p - 1)}>
            Voltar
          </Botao>
        ) : (
          <Botao variante="ghost" onClick={() => router.push("/obras")}>
            Cancelar
          </Botao>
        )}
      </Rodape>
    </>
  );
}
