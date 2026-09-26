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
  sugerido = null,
}: ComCampo & {
  rotulo: string;
  opcoes: readonly { valor: T; texto: string }[];
  valor: T | null;
  onChange: (v: T) => void;
  erro?: string;
  /** Checks fiscais obrigatórios ficam visualmente marcados. */
  destaque?: boolean;
  /**
   * **CONTAI-062** — o valor cuja pílula MARCADA deve ser lida como
   * **sugestão a conferir**, e não como resposta que o Mateus deu: âmbar claro
   * com selo, nunca o preenchido escuro de sempre.
   *
   * `null` (o default) é "nenhuma mudança de visual" — todo outro `Escolha` do
   * app continua idêntico, byte a byte, porque nenhum deles passa este prop.
   *
   * ⚠️ **Dois canais, nunca só cor** (ADENDO 5 §3, salvaguarda 1 do parecer
   * `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`): cor âmbar +
   * o selo com a palavra "Sugerida" + o equivalente para leitor de tela. Cor
   * sozinha é um canal só e falha para quem não a distingue — o mesmo motivo
   * que o `Chip vazado` de `ui.tsx` já documenta.
   */
  sugerido?: T | null;
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
          // Só a pílula MARCADA pode ser "sugerida": sugestão sem valor marcado
          // não existe — o gate ou está preenchido (por ele ou pela leitura) ou
          // está vazio.
          const ehSugerido = marcado && sugerido === o.valor;
          return (
            // ⚠️ `relative` existe por causa do `sr-only` do rádio abaixo:
            // `sr-only` é `position: absolute`, e sem um ancestral posicionado
            // o bloco contêiner dele vira o bloco contêiner INICIAL — o rádio
            // escapa do `overflow-hidden` do shell e estica o documento até a
            // posição estática dele. Resultado medido em 565×703: a página
            // ganhava ~600px de rolagem fantasma e o Mateus via um vazio
            // enorme em branco depois do último card. Com `relative` o rádio é
            // recortado onde nasce e some da altura do documento.
            <label
              key={o.valor}
              className={`relative flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 text-center text-[13.5px] font-semibold ${
                ehSugerido
                  ? "border-amb bg-amb-bg text-ink"
                  : marcado
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
                /**
                 * ⚠️ **CONTAI-062 — e aqui a spec do Gate 0 estava errada.** Ela
                 * afirmava que o `onChange` do React dispara "em TODO clique,
                 * mesmo quando a opção clicada já estava marcada". Não dispara:
                 * o `ChangeEventPlugin` do react-dom só sintetiza `change` a
                 * partir do `click` de um radio quando `node.checked` MUDOU, e
                 * clicar no rádio já marcado não muda nada. Sem este `onClick`,
                 * tocar na pílula sugerida não teria efeito nenhum e o selo
                 * "Sugerida" ficaria na tela depois de o Mateus tê-la
                 * confirmado com o dedo — critério 8 do ticket. **Medido**, não
                 * deduzido: com esta linha comentada, o caso "toque 1" do teste
                 * 6.2 reprova com a pílula ainda em `border-amb bg-amb-bg`.
                 *
                 * Ele existe **só enquanto a pílula está sugerida**, e é isso
                 * que o mantém inofensivo: nenhum outro `Escolha` passa
                 * `sugerido`, então `ehSugerido` é sempre `false` no resto do
                 * app e o handler nem chega ao DOM. No único caso em que ele
                 * existe, `onChange` não pode disparar junto (o valor não muda),
                 * logo não há chamada dupla — e a chamada que ele faz é a mesma
                 * que o toque do dedo significa: "esta resposta agora é minha".
                 */
                onClick={ehSugerido ? () => onChange(o.valor) : undefined}
                className="sr-only"
              />
              {/* ⚠️ O texto da opção mora num `<span>` PRÓPRIO, e não solto no
                  `<label>`: com o selo e o texto de leitor de tela ao lado, o
                  `textContent` do label deixa de ser só "Destacada", e o
                  `getByText(opcao, { exact: true })` de `e2e/formularios.ts`
                  (o `escolher`, usado por ~20 testes) não acharia mais a opção.
                  Com o span, o alvo exato continua existindo em qualquer
                  estado. */}
              <span>{o.texto}</span>
              {ehSugerido ? (
                <>
                  {/* O selo: âmbar SÓLIDO com texto claro, porque o corpo da
                      pílula já é o âmbar claro — claro sobre claro não seria
                      segundo canal nenhum. */}
                  <span
                    aria-hidden="true"
                    className="absolute -top-2 right-1 rounded-full bg-amb px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-paper uppercase"
                  >
                    Sugerida
                  </span>
                  {/* O mesmo aviso, para quem não vê o selo. Entra no nome
                      acessível do rádio, que é exatamente onde ele precisa
                      estar: quem ouve "Destacada" marcado tem de ouvir também
                      que não foi ele quem marcou. */}
                  <span className="sr-only">
                    {" — sugerida automaticamente, ainda não confirmada"}
                  </span>
                </>
              ) : null}
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
  acaoNoSucesso,
}: ComCampo & {
  rotulo: string;
  ajuda: string;
  arquivo: File | null;
  onChange: (f: File | null) => void;
  erro?: string;
  accept: string;
  /**
   * ⚠️ **CONTAI-048, Estado F do mock — uma AÇÃO, nunca um campo.** Aparece ao
   * lado da linha de sucesso ("nome.pdf ✓ vai para o acervo") e existe só para
   * o "Ver documento" do piso, que é onde não há rail com miniatura. Nada aqui
   * pergunta, afirma ou preenche: quem puser uma escolha fiscal neste slot
   * está no arquivo errado.
   */
  acaoNoSucesso?: React.ReactNode;
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
        <p className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-grn">
          <span className="min-w-0 break-all">{arquivo.name}</span>
          <span className="whitespace-nowrap">{" ✓ vai para o acervo"}</span>
          {acaoNoSucesso}
        </p>
      ) : (
        <p className="text-[12px] text-mut">{ajuda}</p>
      )}
      <ErroCampo mensagem={erro} />
    </div>
  );
}
