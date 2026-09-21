"use client";

import { useId } from "react";

/** Campos do formulário manual. Alvos grandes: canteiro, uma mão livre. */

/**
 * ⚠️ **`campo` é o elo do CONTAI-034**, e o valor dele é o **id do spec do
 * mock** (`fData`, `cData`, `iTotal`…) — nunca o nome do state. É o que amarra
 * a linha `- \`fData\` … SEM DEFAULT` do `design/mocks/*.md` ao controle que
 * nasce na tela, e é por ele que `e2e/campos-fiscais.spec.ts` compara os dois.
 *
 * Sem ele, o controle aparece na enumeração do E2E como "sem `data-campo`" e a
 * suíte fica vermelha com o rótulo dele. O tipo não obriga (radio pré-marcado
 * no JSX escaparia de qualquer invariante de tipo — foi por isso que o helper
 * `useCampoFiscal` foi recusado no ticket); quem obriga é o teste.
 */
export type ComCampo = {
  /** O id do spec do mock. Ver o bloco acima. */
  campo?: string;
};

export function Rotulo({ children }: { children: React.ReactNode }) {
  return <span className="text-[12px] text-mut">{children}</span>;
}

export function ErroCampo({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null;
  return (
    <p role="alert" className="text-[12px] font-semibold text-red">
      {mensagem}
    </p>
  );
}

export function CampoTexto({
  rotulo,
  campo,
  valor,
  onChange,
  erro,
  ajuda,
  tipo = "text",
  placeholder,
  inputMode,
  autoComplete,
  desabilitado = false,
  classe = "",
}: ComCampo & {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  erro?: string;
  /**
   * De onde veio o que está no campo. Campo preenchido pelo app SEM dizer a
   * origem lê como algo que o usuário digitou e conferiu — e não foi isso que
   * aconteceu.
   */
  ajuda?: string;
  tipo?: "text" | "date" | "email" | "password";
  placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal" | "email";
  /** `current-password` faz o gerenciador do iPhone preencher (CONTAI-002). */
  autoComplete?: string;
  /**
   * Campo cujo valor JÁ FOI GRAVADO e não pode mais ser editado nesta tela.
   * Existe para o retry parcial do CONTAI-019 (Gate 2, B4): depois que o
   * pagamento entrou no banco, deixar o valor editável ofereceria uma correção
   * que o botão não faz — e o acervo é append-only, sem DELETE.
   */
  desabilitado?: boolean;
  /** Ajuste pontual de aparência. */
  classe?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id}>
        <Rotulo>{rotulo}</Rotulo>
      </label>
      <input
        id={id}
        data-campo={campo}
        type={tipo}
        value={valor}
        inputMode={inputMode}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        disabled={desabilitado}
        aria-invalid={erro ? true : undefined}
        // 16px não é escolha estética: abaixo disso o Safari do iPhone dá zoom
        // a cada foco de campo, e o viewport não trava mais a escala para
        // segurar o pulo (CONTAI-014, critério 4).
        className={`min-h-[44px] rounded-lg border bg-white px-3 text-[16px] disabled:bg-soft disabled:text-mut ${
          erro ? "border-red" : "border-line"
        } ${classe}`}
      />
      {ajuda ? <p className="text-[12px] text-mut">{ajuda}</p> : null}
      <ErroCampo mensagem={erro} />
    </div>
  );
}

export function Escolha<T extends string>({
  rotulo,
  campo,
  opcoes,
  valor,
  onChange,
  erro,
  destaque = false,
}: ComCampo & {
  rotulo: string;
  opcoes: readonly { valor: T; texto: string }[];
  valor: T | null;
  onChange: (v: T) => void;
  erro?: string;
  /** Checks fiscais obrigatórios ficam visualmente marcados. */
  destaque?: boolean;
}) {
  const nome = useId();
  return (
    // O `data-campo` fica no FIELDSET, não em cada rádio: o campo é a ESCOLHA,
    // e "nasce sem default" quer dizer nenhum dos rádios marcado.
    <fieldset data-campo={campo} className="flex flex-col gap-1.5">
      <legend className={destaque ? "text-[13px] font-semibold" : ""}>
        <Rotulo>{rotulo}</Rotulo>
      </legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => {
          const marcado = valor === o.valor;
          return (
            <label
              key={o.valor}
              className={`flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 text-center text-[13.5px] font-semibold ${
                marcado
                  ? "border-ink bg-ink text-paper"
                  : erro
                    ? "border-red bg-white text-ink"
                    : "border-line bg-white text-ink"
              }`}
            >
              <input
                type="radio"
                name={nome}
                value={o.valor}
                checked={marcado}
                onChange={() => onChange(o.valor)}
                className="sr-only"
              />
              {o.texto}
            </label>
          );
        })}
      </div>
      <ErroCampo mensagem={erro} />
    </fieldset>
  );
}

export function CampoArquivo({
  rotulo,
  campo,
  ajuda,
  arquivo,
  onChange,
  erro,
  accept,
}: ComCampo & {
  rotulo: string;
  ajuda: string;
  arquivo: File | null;
  onChange: (f: File | null) => void;
  erro?: string;
  accept: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id}>
        <Rotulo>{rotulo}</Rotulo>
      </label>
      <input
        id={id}
        data-campo={campo}
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        aria-invalid={erro ? true : undefined}
        className={`min-h-[44px] rounded-lg border bg-white px-3 py-2.5 text-[13px] ${
          erro ? "border-red" : "border-line"
        }`}
      />
      {arquivo ? (
        <p className="text-[12px] font-semibold text-grn">
          {arquivo.name} ✓ vai para o acervo
        </p>
      ) : (
        <p className="text-[12px] text-mut">{ajuda}</p>
      )}
      <ErroCampo mensagem={erro} />
    </div>
  );
}
