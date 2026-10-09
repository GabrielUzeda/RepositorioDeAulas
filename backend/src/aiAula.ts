import { GUIA_DIDATICO, CONTRATO_RENDERER, ESTRUTURA_AULA } from './aiGuiaDidatica';

export interface AulaOutlineSlide {
  titulo: string;
  objetivo: string;
  conceitos_novos: string[];
  recurso: 'texto' | 'codigo' | 'tabela' | 'mermaid' | 'katex';
}

export interface AulaOutlineSecao {
  titulo: string;
  proposito: string;
  conceitos: string[];
  analogia?: string;
  exemplo?: string;
}

export interface AulaOutlineSintese {
  conceito: string;
  resumo: string;
}

export interface AulaOutlineReferencia {
  titulo: string;
  detalhe: string;
  url?: string;
}

export interface AulaOutline {
  titulo: string;
  subtitulo: string;
  objetivos: string[];
  prerequisitos: string[];
  secoes: AulaOutlineSecao[];
  sintese: AulaOutlineSintese[];
  fixacao: string[];
  material_complementar: AulaOutlineReferencia[];
}

export const SECOES_MIN = 3;
export const SECOES_MAX = 5;
export const FIXACAO_MIN = 3;
export const FIXACAO_MAX = 5;
export const SINTESE_MIN = 4;
export const SINTESE_MAX = 8;
export const REFERENCIAS_MIN = 3;
export const REFERENCIAS_MAX = 5;
export const OBJETIVOS_MIN = 2;
export const OBJETIVOS_MAX = 4;
export const SLIDES_SECAO_MAX = 5;
export const SLIDES_TOTAIS_MAX = 30;
export const SLIDES_TOTAIS_MIN = 6;

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

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function listaDeTextos(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.map(texto).filter(Boolean) : [];
}

export function normalizarOutline(raw: any): AulaOutline | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const titulo = texto(raw.titulo);
  if (!titulo) return null;

  const secoesRaw = Array.isArray(raw.secoes) ? raw.secoes : [];
  const secoes: AulaOutlineSecao[] = secoesRaw
    .map((s: any) => {
      const slidesLegados = Array.isArray(s?.slides) ? s.slides : [];
      const conceitosDeclarados = listaDeTextos(s?.conceitos);
      const conceitosLegados = slidesLegados
        .flatMap((sl: any) => listaDeTextos(sl?.conceitos_novos))
        .filter(Boolean);
      const proposito = texto(s?.proposito) || texto(slidesLegados[0]?.objetivo);
      return {
        titulo: texto(s?.titulo),
        proposito,
        conceitos: [...new Set(conceitosDeclarados.length > 0 ? conceitosDeclarados : conceitosLegados)],
        analogia: texto(s?.analogia) || undefined,
        exemplo: texto(s?.exemplo) || undefined,
      };
    })
    .filter((s: AulaOutlineSecao) => s.titulo);

  const sintese: AulaOutlineSintese[] = (Array.isArray(raw.sintese) ? raw.sintese : [])
    .map((x: any) => ({ conceito: texto(x?.conceito), resumo: texto(x?.resumo) }))
    .filter((x: AulaOutlineSintese) => x.conceito);

  const material: AulaOutlineReferencia[] = (Array.isArray(raw.material_complementar) ? raw.material_complementar : [])
    .map((x: any) => ({
      titulo: texto(x?.titulo),
      detalhe: texto(x?.detalhe),
      url: texto(x?.url) || undefined,
    }))
    .filter((x: AulaOutlineReferencia) => x.titulo);

  return {
    titulo,
    subtitulo: texto(raw.subtitulo),
    objetivos: listaDeTextos(raw.objetivos),
    prerequisitos: listaDeTextos(raw.prerequisitos),
    secoes,
    sintese,
    fixacao: listaDeTextos(raw.fixacao),
    material_complementar: material,
  };
}

export function parseOutline(content: string): AulaOutline | null {
  return normalizarOutline(extrairJsonObjeto(content));
}

export function diagnosticarOutline(outline: any): string[] {
  const erros: string[] = [];
  if (!outline || typeof outline !== 'object' || Array.isArray(outline)) {
    return ['Outline ausente ou invalido.'];
  }

  if (!texto(outline.titulo)) erros.push('Titulo da aula ausente.');
  if (!texto(outline.subtitulo)) erros.push('Subtitulo da aula ausente.');

  const objetivos = listaDeTextos(outline.objetivos);
  if (objetivos.length < OBJETIVOS_MIN || objetivos.length > OBJETIVOS_MAX) {
    erros.push(`Objetivos devem ter de ${OBJETIVOS_MIN} a ${OBJETIVOS_MAX} itens (recebidos: ${objetivos.length}).`);
  }

  const secoes = Array.isArray(outline.secoes) ? outline.secoes : [];
  if (secoes.length < SECOES_MIN || secoes.length > SECOES_MAX) {
    erros.push(`Secoes devem ser de ${SECOES_MIN} a ${SECOES_MAX} (recebidas: ${secoes.length}).`);
  }

  const conceitosVistos = new Map<string, string>();
  secoes.forEach((secao: any, sIdx: number) => {
    const rotulo = `Secao ${sIdx + 1}`;
    if (!texto(secao?.titulo)) erros.push(`${rotulo}: titulo ausente.`);
    if (!texto(secao?.proposito)) erros.push(`${rotulo}: proposito ausente.`);
    const conceitos = listaDeTextos(secao?.conceitos);
    if (conceitos.length === 0) erros.push(`${rotulo}: nenhum conceito declarado.`);
    for (const conceito of conceitos) {
      const chave = conceito.toLowerCase();
      if (conceitosVistos.has(chave)) {
        erros.push(`Conceito duplicado "${conceito}" em ${conceitosVistos.get(chave)} e ${rotulo}.`);
      } else {
        conceitosVistos.set(chave, rotulo);
      }
    }
  });

  const sintese = Array.isArray(outline.sintese) ? outline.sintese : [];
  if (sintese.length < SINTESE_MIN || sintese.length > SINTESE_MAX) {
    erros.push(`Sintese deve ter de ${SINTESE_MIN} a ${SINTESE_MAX} linhas (recebidas: ${sintese.length}).`);
  }

  const fixacao = listaDeTextos(outline.fixacao);
  if (fixacao.length < FIXACAO_MIN || fixacao.length > FIXACAO_MAX) {
    erros.push(`Fixacao deve ter de ${FIXACAO_MIN} a ${FIXACAO_MAX} perguntas (recebidas: ${fixacao.length}).`);
  }

  const material = Array.isArray(outline.material_complementar) ? outline.material_complementar : [];
  if (material.length < REFERENCIAS_MIN || material.length > REFERENCIAS_MAX) {
    erros.push(
      `Material complementar deve ter de ${REFERENCIAS_MIN} a ${REFERENCIAS_MAX} referencias (recebidas: ${material.length}).`
    );
  }

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

const TAGS_BALANCEADAS = ['style', 'script', 'template', 'textarea', 'div', 'span', 'pre'];

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

  for (const tag of TAGS_BALANCEADAS) {
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

export function validarSecaoMarp(secaoMd: string): string[] {
  if (!secaoMd || !secaoMd.trim()) return ['Secao vazia.'];
  const erros: string[] = [];
  dividirEmSlides(secaoMd).forEach((slide, idx) => {
    for (const erro of validarSlideMarp(slide)) {
      erros.push(`Slide ${idx + 1}: ${erro}`);
    }
  });
  return erros;
}

export function validarAulaMarp(conteudoMd: string): { valido: boolean; erros: string[] } {
  if (!conteudoMd || !conteudoMd.includes('---')) {
    return { valido: false, erros: ['Conteudo Marp ausente ou sem separador de slide (---).'] };
  }

  const erros: string[] = [];
  dividirEmSlides(conteudoMd).forEach((slide, idx) => {
    for (const erro of validarSlideMarp(slide)) {
      erros.push(`Slide ${idx + 1}: ${erro}`);
    }
  });

  return { valido: erros.length === 0, erros };
}

export function repararSlideMarp(slideMd: string): string {
  let texto = slideMd;

  for (const tag of TAGS_BALANCEADAS) {
    const abre = (texto.match(new RegExp(`<${tag}\\b[^>]*>`, 'gi')) || []).length;
    const fecha = (texto.match(new RegExp(`</${tag}\\s*>`, 'gi')) || []).length;
    if (abre > fecha) {
      texto += `\n${`</${tag}>`.repeat(abre - fecha)}`;
    }
  }

  const fences = (texto.match(/^[ \t]*```/gm) || []).length;
  if (fences % 2 !== 0) {
    texto += '\n```';
  }

  const dollares = (texto.match(/^\s*\$\$/gm) || []).length;
  if (dollares % 2 !== 0) {
    texto += '\n$$';
  }

  return texto;
}

export function repararSlidesDoConteudo(conteudoMd: string): string {
  const slides = dividirEmSlides(conteudoMd);
  if (slides.length === 0) return conteudoMd;
  return slides.map(repararSlideMarp).join('\n\n---\n\n');
}

export function gerarFrontMatterEPrimeiroSlide(outline: AulaOutline, autor: string): string {
  const titulo = (outline.titulo || 'Nova Aula').replace(/[\r\n]+/g, ' ').trim();
  const subtitulo = (outline.subtitulo || '').replace(/[\r\n]+/g, ' ').trim();

  const frontMatter = [
    '---',
    'marp: true',
    'theme: default',
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

export function renderBlocoFechamento(outline: AulaOutline): string {
  const partes: string[] = [];

  if (outline.sintese.length > 0) {
    const linhas = outline.sintese.map((s) => `| **${s.conceito}** | ${s.resumo} |`);
    partes.push(
      ['## Sintese do percurso', '', '| Conceito | Em uma frase |', '| :--- | :--- |', ...linhas].join('\n')
    );
  }

  if (outline.fixacao.length > 0) {
    const itens = outline.fixacao.map((q, i) => `${i + 1}. ${q}`).join('\n');
    partes.push(['## Verifique o que voce aprendeu', '', itens].join('\n'));
  }

  if (outline.material_complementar.length > 0) {
    const itens = outline.material_complementar
      .map((r) => (r.url ? `- **${r.titulo}** — ${r.detalhe} ${r.url}` : `- **${r.titulo}** — ${r.detalhe}`))
      .join('\n');
    partes.push(['## Material Complementar', '', itens].join('\n'));
  }

  return partes.join('\n\n---\n\n');
}

export function promptPlanejadorAula(params: {
  tema: string;
  observacoes?: string;
  aulasContexto?: string;
  docsContexto?: string;
}): { systemPrompt: string; userPrompt: string } {
  const { tema, observacoes = '', aulasContexto = '', docsContexto = '' } = params;

  const systemPrompt = `Você é um coordenador pedagógico e designer instrucional sênior. Planeje a estrutura de UMA aula completa sobre o tema pedido, com começo, meio e fim.

Não planeje uma quantidade fixa de slides. Planeje os blocos conceituais necessários para que o aluno construa o entendimento passo a passo.

${GUIA_DIDATICO}

${ESTRUTURA_AULA}

${CONTRATO_RENDERER}

Retorne ESTRITAMENTE um objeto JSON neste formato:
{
  "titulo": "Título principal da aula",
  "subtitulo": "Subtítulo que situa o aluno",
  "objetivos": ["O que o aluno será capaz de fazer ao final", "..."],
  "prerequisitos": ["O que o aluno precisa já saber", "..."],
  "secoes": [
    {
      "titulo": "Título do bloco conceitual",
      "proposito": "O que o aluno deve compreender neste bloco",
      "conceitos": ["Conceito-chave apresentado aqui", "..."],
      "analogia": "Analogia concreta que conduz o bloco (opcional, mas recomendada)",
      "exemplo": "Exemplo central simplificado do bloco (opcional, mas recomendado)"
    }
  ],
  "sintese": [{ "conceito": "Conceito", "resumo": "Explicação em uma frase" }],
  "fixacao": ["Pergunta de fixação", "..."],
  "material_complementar": [{ "titulo": "Livro ou documentação", "detalhe": "Para que serve", "url": "https://..." }]
}

Regras:
1. De ${SECOES_MIN} a ${SECOES_MAX} seções em progressão: a primeira contextualiza e retoma pré-requisitos; a última consolida.
2. Cada seção declara de 1 a 3 conceitos-chave. Nenhum conceito pode se repetir entre seções.
3. A aula precisa ter começo, meio e fim; não encha com seções genéricas.
4. De ${OBJETIVOS_MIN} a ${OBJETIVOS_MAX} objetivos de aprendizagem (o que o aluno será capaz de fazer ao final).
5. De ${FIXACAO_MIN} a ${FIXACAO_MAX} perguntas de fixação, uma por conceito central.
6. De ${SINTESE_MIN} a ${SINTESE_MAX} linhas de síntese (conceito + resumo de uma frase).
7. De ${REFERENCIAS_MIN} a ${REFERENCIAS_MAX} referências reais (livro, documentação ou site de referência) em material complementar. Não invente URLs.
8. Fundamente-se nos documentos e aulas de referência. Se eles não cobrirem o tema, não invente conceitos.
9. Responda apenas com o JSON puro, sem markdown.`;

  let userPrompt = `TEMA: ${tema || 'Conteudo geral'}\n`;
  if (observacoes) userPrompt += `OBSERVACOES DO PROFESSOR: ${observacoes}\n`;
  if (aulasContexto) userPrompt += `\nAULAS DE REFERENCIA:\n${aulasContexto}\n`;
  if (docsContexto) userPrompt += `\nDOCUMENTOS ORIENTADORES:\n${docsContexto}\n`;
  userPrompt += 'Gere o outline pedagogico estruturado desta aula.';

  return { systemPrompt, userPrompt };
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
  const slidesAnteriores = titulosSlidesAnteriores.slice(-10);
  const primeiraSecao = indiceSecao === 0;

  const systemPrompt = `Você redige os slides de UMA seção de uma aula maior, em Marp Next Markdown.

${GUIA_DIDATICO}

${CONTRATO_RENDERER}

REGRAS DA SUA TAREFA:
1. Responda APENAS com os slides desta seção (sem front-matter YAML, sem --- no início ou no fim).
2. Abra a seção com um slide de título usando '# <título da seção>'. Nos demais slides use '## <título do slide>'.
3. TETO RÍGIDO: gere entre 2 e no máximo ${SLIDES_SECAO_MAX} slides para esta seção (incluindo o slide de abertura '#'). NUNCA ultrapasse ${SLIDES_SECAO_MAX} slides. Um conceito por slide, sem slides de preenchimento.
4. Use a analogia e o exemplo central fornecidos; não troque de analogia no meio da seção.
5. Não repita conceitos já cobertos nem slides anteriores; encadeie com o que veio antes.
6. PROIBIDO criar slides de "Reflexão", "Verifique o que você aprendeu", "Síntese", "Conclusão" ou "Material Complementar" — o sistema gera esses blocos.
7. Sem placeholders de imagem e sem imagens se não houver URL real. Sem emojis.

Responda somente com os slides.`;

  let userPrompt = `TÍTULO DA AULA: ${outline.titulo} — ${outline.subtitulo || ''}\n`;
  userPrompt += `SEÇÃO ATUAL (${indiceSecao + 1} de ${outline.secoes.length}): ${secao.titulo}\n`;
  userPrompt += `PROPÓSITO DA SEÇÃO: ${secao.proposito}\n`;
  userPrompt += `CONCEITOS-CHAVE A ENSINAR:\n- ${secao.conceitos.join('\n- ')}\n`;
  if (secao.analogia) userPrompt += `ANALOGIA CONDUTORA: ${secao.analogia}\n`;
  if (secao.exemplo) userPrompt += `EXEMPLO CENTRAL: ${secao.exemplo}\n`;
  if (primeiraSecao && outline.prerequisitos.length > 0) {
    userPrompt += `PRÉ-REQUISITOS A RETOMAR EM UMA FRASE: ${outline.prerequisitos.join('; ')}\n`;
  }
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
