"use client";

import { Card, Consequencia, Dica } from "@/app/_components/ui";
import { CampoTexto, Escolha } from "@/app/_components/campos";
import { JanelaSemCno, PendenciaCno } from "@/app/_components/obra";
import {
  janelaSemCnoDias,
  type EntradaObra,
  type ErroCampoObra,
  type RespostaCno,
} from "@/lib/fiscal/obra";
import type { EntradaObraBanco } from "@/lib/data";
import { parseValorInput } from "@/lib/money";
import type { Obra } from "@/lib/types";

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
  valorTerreno: string;
  valorItbi: string;
  valorEscrituraRegistro: string;
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
  valorTerreno: "",
  valorItbi: "",
  valorEscrituraRegistro: "",
  // Uma unidade autônoma é o caso do produto; mais de uma dispara o aviso de
  // equiparação (critério 11), nunca em silêncio.
  unidadesAutonomas: "1",
  origemDesmembramento: null,
};

function centavosParaCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

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
    valorTerreno: centavosParaCampo(obra.valorTerrenoCentavos),
    valorItbi: centavosParaCampo(obra.valorItbiCentavos),
    valorEscrituraRegistro: centavosParaCampo(obra.valorEscrituraRegistroCentavos),
    unidadesAutonomas: String(obra.unidadesAutonomas),
    origemDesmembramento: obra.origemDesmembramentoLoteamento ? "sim" : "nao",
  };
}

/** Campo vazio de valor opcional é zero; texto ilegível é erro, nunca zero. */
function valorOpcional(texto: string): number | null {
  return texto.trim() === "" ? 0 : parseValorInput(texto);
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
    valorTerrenoCentavos: parseValorInput(estado.valorTerreno),
    valorItbiCentavos: valorOpcional(estado.valorItbi),
    valorEscrituraRegistroCentavos: valorOpcional(estado.valorEscrituraRegistro),
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
    valorTerrenoCentavos: entrada.valorTerrenoCentavos as number,
    valorItbiCentavos: entrada.valorItbiCentavos as number,
    valorEscrituraRegistroCentavos:
      entrada.valorEscrituraRegistroCentavos as number,
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

/** Tela 8 — composição do custo do terreno, fixada pelo contador. */
export function CamposTerreno({ estado, atualizar, erroDe }: PropsCampos) {
  const total =
    (parseValorInput(estado.valorTerreno) ?? 0) +
    (valorOpcional(estado.valorItbi) ?? 0) +
    (valorOpcional(estado.valorEscrituraRegistro) ?? 0);

  return (
    <>
      <Card className="flex flex-col gap-3.5">
        <Dica>
          Este valor abre o custo de aquisição do imóvel na ficha Bens e
          Direitos. Ele não é só o preço pago ao vendedor.
        </Dica>
        <CampoTexto
          rotulo="Valor pago pelo terreno"
          valor={estado.valorTerreno}
          onChange={(v) => atualizar("valorTerreno", v)}
          inputMode="decimal"
          placeholder="0,00"
          erro={erroDe("valorTerrenoCentavos")}
        />
        <CampoTexto
          rotulo="ITBI"
          valor={estado.valorItbi}
          onChange={(v) => atualizar("valorItbi", v)}
          inputMode="decimal"
          placeholder="0,00"
          erro={erroDe("valorItbiCentavos")}
        />
        <CampoTexto
          rotulo="Escritura e registro"
          valor={estado.valorEscrituraRegistro}
          onChange={(v) => atualizar("valorEscrituraRegistro", v)}
          inputMode="decimal"
          placeholder="0,00"
          erro={erroDe("valorEscrituraRegistroCentavos")}
        />
      </Card>
      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12px] text-mut">Custo do terreno</span>
          <span className="mono text-[13.5px] font-bold">
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(total / 100)}
          </span>
        </div>
        <Dica>
          ITBI e despesas de escritura/registro integram o custo de aquisição
          (IN SRF 84/2001, art. 17). Lançar só o preço do terreno subestimaria o
          custo e aumentaria o ganho de capital na venda.
        </Dica>
      </Card>
      <Dica>
        Cada item pode ser preenchido depois — o ITBI costuma ser pago em outra
        data.
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
