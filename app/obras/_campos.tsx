"use client";

import { Banner, Card, Consequencia, Dica } from "@/app/_components/ui";
import { CampoTexto, Escolha } from "@/app/_components/campos";
import { JanelaSemCno, PendenciaCno } from "@/app/_components/obra";
import {
  janelaSemCnoDias,
  type EntradaObra,
  type ErroCampoObra,
  type RespostaCno,
} from "@/lib/fiscal/obra";
import { O_QUE_CADA_NATUREZA_MUDA } from "@/lib/fiscal/terreno";
import type { EntradaObraBanco } from "@/lib/data";
import type { NaturezaAquisicaoTerreno, Obra } from "@/lib/types";

/**
 * Campos do cadastro/edição de obra (mock CONTAI-003, telas 4 a 9). Os mesmos
 * blocos servem ao cadastro em 4 passos e à edição em uma tela só — o cadastro
 * é editável depois porque o CNO sai depois do início e o ITBI é pago em outra
 * data (critério 5).
 */

export interface EstadoObra {
  nome: string;
  municipio: string;
  matricula: string;
  cartorio: string;
  dataInicioObra: string;
  temCno: RespostaCno | null;
  cno: string;
  cnoRegistradoEm: string;
  /** CONTAI-010 — a bifurcação. `null` = ainda não respondida. */
  naturezaAquisicaoTerreno: NaturezaAquisicaoTerreno | null;
  unidadesAutonomas: string;
  origemDesmembramento: "sim" | "nao" | null;
}

export const ESTADO_VAZIO: EstadoObra = {
  nome: "",
  municipio: "",
  matricula: "",
  cartorio: "",
  dataInicioObra: "",
  temCno: null,
  cno: "",
  cnoRegistradoEm: "",
  // ⚠️ SEM DEFAULT, e é proibição do CLAUDE.md: campo fiscal não tem default.
  // Foi presumindo compra à vista que o app respondeu errado sozinho.
  naturezaAquisicaoTerreno: null,
  // Uma unidade autônoma é o caso do produto; mais de uma dispara o aviso de
  // equiparação (critério 11), nunca em silêncio.
  unidadesAutonomas: "1",
  origemDesmembramento: null,
};

export function estadoDaObra(obra: Obra): EstadoObra {
  return {
    nome: obra.nome,
    municipio: obra.municipio ?? "",
    matricula: obra.matricula ?? "",
    cartorio: obra.cartorio ?? "",
    dataInicioObra: obra.dataInicioObra,
    temCno: obra.cno ? "sim" : "nao",
    cno: obra.cno ?? "",
    cnoRegistradoEm: obra.cnoRegistradoEm ?? "",
    naturezaAquisicaoTerreno: obra.naturezaAquisicaoTerreno,
    unidadesAutonomas: String(obra.unidadesAutonomas),
    origemDesmembramento: obra.origemDesmembramentoLoteamento ? "sim" : "nao",
  };
}

export function paraEntrada(estado: EstadoObra): EntradaObra {
  return {
    nome: estado.nome,
    municipio: estado.municipio,
    matricula: estado.matricula,
    cartorio: estado.cartorio,
    dataInicioObra: estado.dataInicioObra,
    temCno: estado.temCno,
    cno: estado.cno,
    cnoRegistradoEm: estado.cnoRegistradoEm,
    naturezaAquisicaoTerreno: estado.naturezaAquisicaoTerreno,
    unidadesAutonomas: /^\d+$/.test(estado.unidadesAutonomas.trim())
      ? Number(estado.unidadesAutonomas)
      : null,
    origemDesmembramentoLoteamento: paraBooleano(estado.origemDesmembramento),
  };
}

function paraBooleano(resposta: "sim" | "nao" | null): boolean | null {
  if (resposta === "sim") return true;
  if (resposta === "nao") return false;
  return null;
}

/** Só é chamada depois de `validarObra` não achar erro — daí os `as number`. */
export function paraBanco(entrada: EntradaObra): EntradaObraBanco {
  const semCno = entrada.temCno !== "sim";
  const vazioParaNulo = (t: string) => (t.trim() === "" ? null : t.trim());
  return {
    nome: entrada.nome.trim(),
    municipio: vazioParaNulo(entrada.municipio),
    matricula: vazioParaNulo(entrada.matricula),
    cartorio: vazioParaNulo(entrada.cartorio),
    cno: semCno ? null : entrada.cno.trim(),
    // Data de registro sem CNO é estado impossível (constraint da 0004): se a
    // resposta virou "ainda não tenho", a data cai junto.
    cnoRegistradoEm: semCno ? null : entrada.cnoRegistradoEm,
    dataInicioObra: entrada.dataInicioObra,
    // `null` viaja até o banco de propósito: é "ainda não respondida", e o
    // banco guarda a ausência em vez de um palpite.
    naturezaAquisicaoTerreno: entrada.naturezaAquisicaoTerreno,
    unidadesAutonomas: entrada.unidadesAutonomas as number,
    origemDesmembramentoLoteamento:
      entrada.origemDesmembramentoLoteamento === true,
  };
}

export type Atualizar = <C extends keyof EstadoObra>(
  campo: C,
  valor: EstadoObra[C],
) => void;

export type ErroDe = (campo: ErroCampoObra["campo"]) => string | undefined;

interface PropsCampos {
  estado: EstadoObra;
  atualizar: Atualizar;
  erroDe: ErroDe;
}

const RESPOSTAS_CNO = [
  { valor: "sim", texto: "Já tenho o CNO" },
  { valor: "nao", texto: "Ainda não tenho" },
] as const satisfies readonly { valor: RespostaCno; texto: string }[];

const SIM_NAO = [
  { valor: "sim", texto: "Sim" },
  { valor: "nao", texto: "Não" },
] as const;

/** Tela 4 — identificação e data de início. */
export function CamposIdentidade({ estado, atualizar, erroDe }: PropsCampos) {
  return (
    <Card className="flex flex-col gap-3.5">
      <CampoTexto
        rotulo="Nome da obra"
        valor={estado.nome}
        onChange={(v) => atualizar("nome", v)}
        placeholder="Casa do Morro"
        erro={erroDe("nome")}
      />
      <Dica>É este nome que vai aparecer toda vez que você registrar algo.</Dica>
      <CampoTexto
        rotulo="Município"
        valor={estado.municipio}
        onChange={(v) => atualizar("municipio", v)}
        placeholder="Florianópolis"
        erro={erroDe("municipio")}
      />
      <CampoTexto
        rotulo="Matrícula do imóvel"
        valor={estado.matricula}
        onChange={(v) => atualizar("matricula", v)}
        placeholder="45.892"
        erro={erroDe("matricula")}
      />
      <CampoTexto
        rotulo="Cartório de registro"
        valor={estado.cartorio}
        onChange={(v) => atualizar("cartorio", v)}
        placeholder="2º Ofício de Registro de Imóveis"
        erro={erroDe("cartorio")}
      />
      <CampoTexto
        rotulo="Data de início da obra"
        tipo="date"
        valor={estado.dataInicioObra}
        onChange={(v) => atualizar("dataInicioObra", v)}
        erro={erroDe("dataInicioObra")}
      />
      <Consequencia cor="amb">
        Obrigatória com ou sem CNO. É ela que define o prazo legal do CNO (30
        dias) e o período que a aferição do INSS enxerga. Informe a data{" "}
        <strong>real</strong> de início.
      </Consequencia>
    </Card>
  );
}

/** Telas 5, 6 e 7 — o CNO é por obra, e a ausência dele é dívida, não campo em branco. */
export function CamposCno({
  estado,
  atualizar,
  erroDe,
  hoje,
  obraParaPendencia,
}: PropsCampos & {
  hoje: string;
  /** Obra "de mentira" só para a pendência ler a data de início digitada. */
  obraParaPendencia: Obra;
}) {
  return (
    <>
      <Card className="flex flex-col gap-3.5">
        <Dica>
          O CNO é o cadastro da obra na Receita. É por ele que o INSS da
          construção é apurado — e ele é <strong>por obra</strong>, nunca
          compartilhado.
        </Dica>
        <Escolha
          destaque
          rotulo="Esta obra já tem CNO?"
          opcoes={RESPOSTAS_CNO}
          valor={estado.temCno}
          onChange={(v) => atualizar("temCno", v)}
          erro={erroDe("temCno")}
        />
        {estado.temCno === "sim" ? (
          <>
            <CampoTexto
              rotulo="Número do CNO"
              valor={estado.cno}
              onChange={(v) => atualizar("cno", v)}
              placeholder="12.345.67890/26"
              erro={erroDe("cno")}
            />
            <CampoTexto
              rotulo="Data em que o CNO foi registrado"
              tipo="date"
              valor={estado.cnoRegistradoEm}
              onChange={(v) => atualizar("cnoRegistradoEm", v)}
              erro={erroDe("cnoRegistradoEm")}
            />
            <Dica>
              O intervalo entre o início da obra e esta data é a janela em que as
              notas saíram sem CNO. É essa lista que você vai cobrar da
              empreiteira.
            </Dica>
          </>
        ) : null}
      </Card>

      {estado.temCno === "sim" ? (
        <JanelaSemCno
          inicio={estado.dataInicioObra}
          dias={
            janelaSemCnoDias(
              estado.dataInicioObra,
              estado.cnoRegistradoEm || null,
            ) ?? 0
          }
        />
      ) : null}

      {estado.temCno === "nao" ? (
        <>
          <PendenciaCno obra={obraParaPendencia} hoje={hoje} />
          <Dica>
            O app não bloqueia obra sem CNO: suas notas continuam valendo como
            custo no IRPF, e travar o cadastro te devolveria para a planilha.
          </Dica>
        </>
      ) : null}
    </>
  );
}

const NATUREZAS = [
  { valor: "a_vista", texto: "À vista" },
  { valor: "financiado", texto: "Financiado com um banco" },
  { valor: "parcelado_vendedor", texto: "Parcelado com o vendedor" },
  { valor: "recebido", texto: "Recebido (herança, doação, permuta)" },
] as const satisfies readonly {
  valor: NaturezaAquisicaoTerreno;
  texto: string;
}[];

/**
 * Tela 8 — a BIFURCAÇÃO do CONTAI-010 (mock s2, critério 2).
 *
 * Os três campos de valor que moravam aqui MORRERAM com as colunas (migration
 * 0008): terreno, ITBI e escritura viraram desembolsos DATADOS, cada um com a
 * sua data, porque cada um cai no ano da SUA quitação. Eles são registrados em
 * `/obras/[id]/terreno/desembolsos`.
 *
 * O que fica aqui é a pergunta que decide qual regra roda — e ela não pode
 * ficar escondida num canto (mock, pergunta 1). Sem ela, o app PRESUMIU COMPRA
 * À VISTA e tratou o terreno como um valor só, sem data: é exatamente o defeito
 * que este ticket conserta.
 */
export function CamposTerreno({ estado, atualizar }: PropsCampos) {
  return (
    <>
      <Banner cor="amb" role="status">
        Esta pergunta não existia no app. Sem ela, o sistema{" "}
        <strong>presumiu compra à vista</strong> e tratou o terreno como um valor
        só, sem data — que é o defeito que esta versão conserta.
      </Banner>
      <Card className="flex flex-col gap-3.5">
        <Escolha
          destaque
          rotulo="Como você adquiriu o terreno?"
          opcoes={NATUREZAS}
          valor={estado.naturezaAquisicaoTerreno}
          onChange={(v) => atualizar("naturezaAquisicaoTerreno", v)}
        />
        <Dica>
          Pode ser respondida depois — nada aqui bloqueia o cadastro. Enquanto
          ficar em branco, ela aparece como pendência de complemento no painel do
          terreno.
        </Dica>
      </Card>
      <Card>
        <Dica>O que cada resposta muda</Dica>
        {NATUREZAS.map((n) => (
          <div
            key={n.valor}
            className="flex flex-col gap-0.5 border-b border-line py-[9px] last:border-b-0"
          >
            <span className="text-[13px] font-semibold">{n.texto}</span>
            <span className="text-[12px] text-mut">
              {O_QUE_CADA_NATUREZA_MUDA[n.valor]}
            </span>
          </div>
        ))}
      </Card>
      <Dica>
        Os valores — pagamento do terreno, entrada, ITBI, escritura e registro —
        são registrados um a um, <strong>cada um com a sua data</strong>, na tela
        do terreno. É a data de cada um que decide o ano dele.
      </Dica>
    </>
  );
}

/** Tela 9 — as duas perguntas que decidem se os relatórios servem (critério 11). */
export function CamposPremissas({ estado, atualizar, erroDe }: PropsCampos) {
  return (
    <Card className="flex flex-col gap-3.5">
      <Dica>
        Duas perguntas que decidem se os relatórios deste app servem para a sua
        situação.
      </Dica>
      <CampoTexto
        rotulo="Quantas unidades autônomas tem a matrícula?"
        valor={estado.unidadesAutonomas}
        onChange={(v) => atualizar("unidadesAutonomas", v)}
        inputMode="numeric"
        erro={erroDe("unidadesAutonomas")}
      />
      <Escolha
        rotulo="O terreno veio de desmembramento ou loteamento?"
        opcoes={SIM_NAO}
        valor={estado.origemDesmembramento}
        onChange={(v) => atualizar("origemDesmembramento", v)}
        erro={erroDe("origemDesmembramentoLoteamento")}
      />
    </Card>
  );
}
