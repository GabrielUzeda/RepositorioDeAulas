export interface AulaOutlineSlide {
  titulo: string;
  objetivo: string;
  conceitos_novos: string[];
  recurso: 'texto' | 'codigo' | 'tabela' | 'mermaid' | 'katex';
}

export interface AulaOutlineSecao {
  titulo: string;
  slides: AulaOutlineSlide[];
}

export interface AulaOutline {
  titulo: string;
  subtitulo: string;
  objetivos: string[];
  prerequisitos: string[];
  secoes: AulaOutlineSecao[];
  fixacao: string[];
}

export const SLIDES_TOTAIS_MIN = 10;
export const SLIDES_TOTAIS_MAX = 16;
export const FIXACAO_MIN = 3;
export const FIXACAO_MAX = 5;

const MERMAID_TYPES = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'erDiagram',
  'pie',
  'gantt',
  'mindmap',
  'timeline',
];

function extrairJsonObjeto(content: string): any | null {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export function parseOutline(content: string): AulaOutline | null {
  const parsed = extrairJsonObjeto(content);
  if (!parsed || parsed === null || typeof parsed !== 'object') return null;
  if (typeof parsed.titulo !== 'string' || parsed.titulo.trim() === '') return null;
  return parsed as AulaOutline;
}

export function diagnosticarOutline(outline: any): string[] {
  const erros: string[] = [];

  if (!outline || typeof outline !== 'object') {
    return ['O outline retornado não é um objeto válido.'];
  }

  if (!outline.titulo || String(outline.titulo).trim() === '') {
    erros.push('Titulo ausente no outline.');
  }

  if (!Array.isArray(outline.secoes) || outline.secoes.length === 0) {
    erros.push('Lista de secoes vazia.');
    return erros;
  }

  let totalSlides = 0;
  outline.secoes.forEach((secao: any, sIdx: number) => {
    if (!secao || typeof secao !== 'object' || !secao.titulo || String(secao.titulo).trim() === '') {
      erros.push(`Secao ${sIdx + 1}: titulo ausente.`);
    }
    if (!Array.isArray(secao.slides) || secao.slides.length === 0) {
      erros.push(`Secao ${sIdx + 1}: nenhum slide planejado.`);
      return;
    }
    secao.slides.forEach((slide: any, slIdx: number) => {
      totalSlides++;
      if (!slide?.titulo || String(slide.titulo).trim() === '') {
        erros.push(`Secao ${sIdx + 1}, slide ${slIdx + 1}: titulo do slide ausente.`);
      }
    });
  });

  if (totalSlides < SLIDES_TOTAIS_MIN || totalSlides > SLIDES_TOTAIS_MAX) {
    erros.push(
      `Total de slides (${totalSlides}) fora da faixa esperada (${SLIDES_TOTAIS_MIN} a ${SLIDES_TOTAIS_MAX}).`
    );
  }

  if (!Array.isArray(outline.fixacao) || outline.fixacao.length < FIXACAO_MIN) {
    erros.push(`Fixacao deve ter no minimo ${FIXACAO_MIN} perguntas (recebidas: ${Array.isArray(outline.fixacao) ? outline.fixacao.length : 0}).`);
  } else if (outline.fixacao.length > FIXACAO_MAX) {
    erros.push(`Fixacao deve ter no maximo ${FIXACAO_MAX} perguntas (recebidas: ${outline.fixacao.length}).`);
  }

  const conceitosVistos = new Map<string, string>();
  outline.secoes?.forEach((secao: any, sIdx: number) => {
    if (!Array.isArray(secao?.slides)) return;
    secao.slides.forEach((slide: any, slIdx: number) => {
      if (!Array.isArray(slide?.conceitos_novos)) return;
      for (const conceito of slide.conceitos_novos) {
        const chave = String(conceito || '')
          .trim()
          .toLowerCase();
        if (!chave) continue;
        if (conceitosVistos.has(chave)) {
          erros.push(
            `Conceito duplicado "${conceito}" nos slides ${conceitosVistos.get(chave)} e Secao ${sIdx + 1}, slide ${slIdx + 1}.`
          );
        } else {
          conceitosVistos.set(chave, `Secao ${sIdx + 1}, slide ${slIdx + 1}`);
        }
      }
    });
  });

  return erros;
}

export function dividirEmSlides(conteudoMd: string): string[] {
  const linhas = conteudoMd.split('\n');
  const slides: string[] = [];
  let atual: string[] = [];
  let dentroDeFence = false;
  let posFrontMatterFim = -1;

  if (linhas[0]?.trim() === '---') {
    for (let i = 1; i < linhas.length; i++) {
      if (linhas[i].trim() === '---') {
        posFrontMatterFim = i;
        break;
      }
    }
  }

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (posFrontMatterFim !== -1 && i <= posFrontMatterFim) {
      atual.push(linha);
      if (i === posFrontMatterFim) {
        posFrontMatterFim = -1;
      }
      continue;
    }

    if (linha.trimStart().startsWith('```')) {
      dentroDeFence = !dentroDeFence;
      atual.push(linha);
      continue;
    }

    if (!dentroDeFence && linha.trim() === '---') {
      slides.push(atual.join('\n'));
      atual = [];
      continue;
    }

    atual.push(linha);
  }

  if (atual.length > 0) slides.push(atual.join('\n'));

  return slides.filter((s) => s.trim() !== '');
}

export function validarSlideMarp(slideMd: string): string[] {
  const erros: string[] = [];

  const fences = (slideMd.match(/^[ \t]*```/gm) || []).length;
  if (fences % 2 !== 0) {
    erros.push('Fence de codigo (```) aberto e nao fechado dentro do slide.');
  }

  const dollares = (slideMd.match(/^\s*\$\$/gm) || []).length;
  if (dollares % 2 !== 0) {
    erros.push('Bloco KaTeX ($$) aberto e nao fechado dentro do slide.');
  }

  const tagsSimples = ['style', 'script', 'template', 'textarea', 'div'];
  for (const tag of tagsSimples) {
    const abre = (slideMd.match(new RegExp(`<${tag}\\b[^>]*>`, 'gi')) || []).length;
    const fecha = (slideMd.match(new RegExp(`</${tag}\\s*>`, 'gi')) || []).length;
    if (abre !== fecha) {
      erros.push(`Tag <${tag}> aberta e nao fechada dentro do slide.`);
    }
  }

  const mermaidMatch = slideMd.match(/```mermaid\s*\n\s*([a-zA-Z]+)/);
  if (mermaidMatch && !MERMAID_TYPES.includes(mermaidMatch[1])) {
    erros.push(`Diagrama mermaid com tipo desconhecido: ${mermaidMatch[1]}.`);
  }

  return erros;
}

export function validarAulaMarp(conteudoMd: string): { valido: boolean; erros: string[] } {
  const erros: string[] = [];

  if (!conteudoMd || !conteudoMd.includes('---')) {
    return { valido: false, erros: ['Conteudo Marp ausente ou sem separador de slide (---).'] };
  }

  const slides = dividirEmSlides(conteudoMd);
  slides.forEach((slide, idx) => {
    for (const erro of validarSlideMarp(slide)) {
      erros.push(`Slide ${idx + 1}: ${erro}`);
    }
  });

  return { valido: erros.length === 0, erros };
}

export function gerarFrontMatterEPrimeiroSlide(outline: AulaOutline, autor: string): string {
  const titulo = (outline.titulo || 'Nova Aula').replace(/[\r\n]+/g, ' ').trim();
  const subtitulo = (outline.subtitulo || '').replace(/[\r\n]+/g, ' ').trim();

  const frontMatter = [
    '---',
    'marp: true',
    'theme: default',
    'paginate: true',
    `title: ${titulo}`,
    ...(subtitulo ? [`description: ${subtitulo}`] : []),
    '---',
    '',
    `# ${titulo}`,
    ...(subtitulo ? ['', `## ${subtitulo}`] : []),
    ...(autor ? ['', `**${autor}**`] : []),
  ];

  return frontMatter.join('\n');
}

export function removerFrontMatterRestante(secaoMd: string): string {
  let texto = secaoMd.trim();
  texto = texto.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  if (texto.startsWith('---')) {
    const fimFront = texto.slice(3).indexOf('---');
    if (fimFront !== -1) {
      texto = texto.slice(3 + fimFront + 3);
      texto = texto.trim();
    }
  }

  while (texto.startsWith('---')) {
    texto = texto.slice(3).trim();
  }

  const linhas = texto.split('\n');
  while (linhas.length > 0 && (linhas[0].trim() === '---' || linhas[0].trim() === '')) linhas.shift();
  while (linhas.length > 0 && (linhas[linhas.length - 1].trim() === '---' || linhas[linhas.length - 1].trim() === ''))
    linhas.pop();

  return linhas.join('\n');
}

export function promptSecaoAula(params: {
  outline: AulaOutline;
  indiceSecao: number;
  conceitosJaCobertos: string[];
  titulosSlidesAnteriores: string[];
  contextoLimpo: string;
}): { systemPrompt: string; userPrompt: string } {
  const { outline, indiceSecao, conceitosJaCobertos, titulosSlidesAnteriores, contextoLimpo } = params;
  const secao = outline.secoes[indiceSecao];
  const slidesAnteriores = titulosSlidesAnteriores.slice(-8);

  const systemPrompt = `Você é um especialista em didática, design instrucional e metodologias de ensino inclusivo.
Sua tarefa é redigir em Marp Next Markdown APENAS os slides da seção "${secao.titulo}" de uma aula maior, a partir do outline estruturado.

Regras:
1. Responda APENAS com os slides Marp dessa seção (sem front-matter YAML, sem --- no início ou no fim).
2. No PRIMEIRO slide da seção use um cabeçalho '#' com o título da seção; nos demais slides use '##' com o título do slide.
3. Máximo de 10 frases por slide; use negrito para os pontos-chave.
4. Use listas fragmentadas (* ou 1.) quando fizer sentido.
5. NÃO repita conceitos já cobertos em outros slides/aulas (lista enviada). Construa a progressão do concreto ao abstrato.
6. NÃO rotule nada como nível de dificuldade; NÃO use callouts do tipo "Regra de Ouro:", "Dica:", "Atenção:".
7. Use KaTeX (fórmulas: $...$ inline, $$...$$ bloco), código com linguagem, tabelas e Mermaid (baixo/achatado, largura antes que altura) conforme o recurso planejado de cada slide.
8. Fonte de verdade: o contexto fornecido. Não invente conceitos ausentes nele.
9. Não use placeholders de imagem.
10. Considere dark mode ao embutir HTML/CSS: use pares contrastantes ou variáveis de tema (var(--text-primary), var(--slide-bg), var(--border)).

Responda somente com os slides.`;

  let userPrompt = `TÍTULO DA AULA: ${outline.titulo} — ${outline.subtitulo || ''}\n`;
  userPrompt += `SEÇÃO ATUAL (${indiceSecao + 1} de ${outline.secoes.length}): ${secao.titulo}\n`;
  userPrompt += `SLIDES PLANEJADOS PARA ESTA SEÇÃO:\n${JSON.stringify(secao.slides, null, 2)}\n`;
  if (conceitosJaCobertos.length > 0) {
    userPrompt += `CONCEITOS JÁ COBERTOS (não repetir):\n- ${conceitosJaCobertos.slice(-30).join('\n- ')}\n`;
  }
  if (slidesAnteriores.length > 0) {
    userPrompt += `TÍTULOS DOS SLIDES JÁ ESCRITOS (continuidade):\n- ${slidesAnteriores.join('\n- ')}\n`;
  }
  if (contextoLimpo) {
    userPrompt += `CONTEXTO DE REFERÊNCIA:\n${contextoLimpo}\n`;
  }
  userPrompt += `Redija os slides da seção "${secao.titulo}".`;

  return { systemPrompt, userPrompt };
}
