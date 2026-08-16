"use client";

import { useId } from "react";

/** Campos do formulário manual. Alvos grandes: canteiro, uma mão livre. */

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
  valor,
  onChange,
  erro,
  tipo = "text",
  placeholder,
  inputMode,
  autoComplete,
  classe = "",
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  erro?: string;
  tipo?: "text" | "date" | "email";
  placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal" | "email";
  /** `one-time-code` faz o iOS/Android oferecer o código do e-mail (CONTAI-002). */
  autoComplete?: string;
  /** Ajuste pontual de aparência (ex.: o campo do código, grande e espaçado). */
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
        type={tipo}
        value={valor}
        inputMode={inputMode}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={erro ? true : undefined}
        className={`min-h-[44px] rounded-lg border bg-white px-3 text-[15px] ${
          erro ? "border-red" : "border-line"
        } ${classe}`}
      />
      <ErroCampo mensagem={erro} />
    </div>
  );
}

export function Escolha<T extends string>({
  rotulo,
  opcoes,
  valor,
  onChange,
  erro,
  destaque = false,
}: {
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
    <fieldset className="flex flex-col gap-1.5">
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
  ajuda,
  arquivo,
  onChange,
  erro,
  accept,
}: {
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
