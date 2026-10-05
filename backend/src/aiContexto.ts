export function markdownParaContexto(md: string, limiteChars?: number): string {
  if (!md) return '';

  let texto = md.replace(/^---\s*[\s\S]*?---\s*/, '');

  texto = texto.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  texto = texto.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  texto = texto.replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '');
  texto = texto.replace(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi, '');

  texto = texto.replace(/<!--[\s\S]*?-->/g, '');

  texto = texto.replace(/\n{3,}/g, '\n\n').trim();

  if (limiteChars && texto.length > limiteChars) {
    const linhas = texto.split('\n');
    let insideFence = false;
    let ultimaSliceValida = -1;
    let charsAcumulados = 0;
    const linhasAteLimite: string[] = [];

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      if (linha.trim().startsWith('```')) {
        insideFence = !insideFence;
      }

      const novaLinhaComLen = linha.length + 1;
      if (charsAcumulados + novaLinhaComLen > limiteChars) {
        break;
      }

      linhasAteLimite.push(linha);
      charsAcumulados += novaLinhaComLen;

      if (!insideFence && linha.trim() === '---') {
        ultimaSliceValida = linhasAteLimite.length;
      }
    }

    if (ultimaSliceValida > 0) {
      texto = linhasAteLimite.slice(0, ultimaSliceValida).join('\n').trim();
    } else {
      texto = texto.substring(0, limiteChars);
      let fencCount = 0;
      const matches = texto.match(/```/g);
      if (matches) {
        fencCount = matches.length;
      }
      if (fencCount % 2 !== 0) {
        texto += '\n```\n';
      }
    }
  }

  return texto;
}

export function distribuirOrcamentoContexto(
  aulas: Array<{ id?: number; titulo: string; conteudo_md: string; ordem?: number }>,
  orcamentoTotalChars: number = 30000
): string {
  if (!aulas || aulas.length === 0) return '';

  const orcamentoPorAula = Math.max(2000, Math.floor(orcamentoTotalChars / aulas.length));
  const blocos: string[] = [];

  for (let idx = 0; idx < aulas.length; idx++) {
    const aula = aulas[idx];
    const textoLimpo = markdownParaContexto(aula.conteudo_md || '', orcamentoPorAula);
    const bloco = `--- AULA ${idx + 1}: ${aula.titulo} ---\n${textoLimpo}`;
    blocos.push(bloco);
  }

  return blocos.join('\n\n');
}
