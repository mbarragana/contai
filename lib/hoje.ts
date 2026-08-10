/**
 * Data de hoje em ISO, no fuso do aparelho — não em UTC.
 *
 * O canteiro é UTC−3: perto da meia-noite, `toISOString()` cru já joga o
 * pagamento para o dia seguinte, e a data do pagamento é o que define o
 * ano-calendário do custo (regime de caixa). As regras que consomem esta data
 * ficam em lib/fiscal/*, que recebe "hoje" por parâmetro e continua pura.
 */
export function hojeIso(): string {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
