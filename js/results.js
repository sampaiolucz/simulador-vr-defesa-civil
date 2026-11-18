// Tela de resultado compartilhada por todos os cenários.
// results: [{ fase, text, ok, pts, max }]

/** Cria um registrador de pontuação. */
export function createScore() {
  const results = [];
  const record = (fase, text, ok, max = 1, pts = ok ? max : 0) => results.push({ fase, text, ok, pts, max });
  return { results, record };
}

/**
 * Mostra o resultado e trata a escolha (jogar novamente / menu).
 * messages: frases por faixa de desempenho [>=90%, >=70%, >=50%, <50%].
 */
export async function showResults(g, run, results, messages) {
  const { ui, sfx } = g;
  const total = results.reduce((s, r) => s + r.pts, 0);
  const max = results.reduce((s, r) => s + r.max, 0) || 1;
  const pct = total / max;
  const msg = pct >= 0.9 ? messages[0] : pct >= 0.7 ? messages[1] : pct >= 0.5 ? messages[2] : messages[3];
  const fases = [...new Set(results.map((r) => r.fase))];
  const items = fases.map((f) => {
    const rs = results.filter((r) => r.fase === f);
    const p = rs.reduce((s, r) => s + r.pts, 0);
    const m = rs.reduce((s, r) => s + r.max, 0);
    return { text: `${f}: ${p} de ${m} pontos`, ok: p / m >= 0.7 };
  });
  const erros = results.filter((r) => !r.ok).map((r) => r.text);
  sfx.stopAll();
  g.aimMode = false;
  ui.setHud([]);
  const body =
    msg +
    (erros.length
      ? '\n\nPara revisar:\n' + erros.slice(0, 6).map((e) => '• ' + e).join('\n') + (erros.length > 6 ? `\n• e mais ${erros.length - 6}...` : '')
      : '\n\nVocê acertou tudo!');
  const fim = await ui.ask(run, {
    tone: pct >= 0.7 ? 'success' : 'warning',
    title: `Resultado: ${total} de ${max} pontos`,
    body,
    items,
    width: 1.35,
    buttons: [
      { label: 'Jogar novamente', value: 'again' },
      { label: 'Menu de cenas', value: 'menu' },
    ],
  });
  if (fim === 'menu') g.toMenu();
  else g.restart();
}
