import { GUIA_DIDATICO, CONTRATO_RENDERER, EXEMPLO_PADRAO_AULA } from './aiGuiaDidatica';
import { SKILL_RECURSOS_RENDER } from './aiSkillRenderer';
import MarkdownIt from 'markdown-it';
import { parseSlideInteractive } from './slideInteractive';

const interactiveMarkdown = new MarkdownIt();

export interface AulaOutlineSlide {
  titulo: string;
  objetivo: string;
  conceitos_novos: string[];
  recurso: 'texto' | 'codigo' | 'tabela' | 'mermaid' | 'katex' | 'interactive';
}

export interface AulaOutlineSecao {
  titulo: string;
  proposito: string;
  conceitos: string[];
  analogia?: string;
  exemplo?: string;
  desafio_pontual?: string;
  pergunta?: string;
  interacao?: string;
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
  problematica?: string;
  fio_condutor?: string;
  objetivos: string[];
  prerequisitos: string[];
  secoes: AulaOutlineSecao[];
  sintese: AulaOutlineSintese[];
  fixacao?: string[];
  material_complementar: AulaOutlineReferencia[];
}

export const SECOES_MIN = 3;
export const SECOES_MAX = 5;
export const SINTESE_MAX = 8;
export const REFERENCIAS_MAX = 5;
export const OBJETIVOS_MAX = 4;
export const SLIDES_TOTAIS_MAX = 60;
export const SLIDE_LINHAS_MAX = 24;
export const SLIDE_CHARS_MAX = 1600;

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

  const vistos = new Set<string>();
  const secoesRaw = Array.isArray(raw.secoes) ? raw.secoes : [];
  const secoes: AulaOutlineSecao[] = secoesRaw
    .map((s: any) => {
      const slidesLegados = Array.isArray(s?.slides) ? s.slides : [];
      const declarados = listaDeTextos(s?.conceitos);
      const legados = slidesLegados.flatMap((sl: any) => listaDeTextos(sl?.conceitos_novos));
      const conceitos = (declarados.length > 0 ? declarados : (legados as string[])).filter((c: string) => {
        const chave = c.toLowerCase();
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      });
      return {
        titulo: texto(s?.titulo),
        proposito: texto(s?.proposito) || texto(slidesLegados[0]?.objetivo),
        conceitos,
        analogia: texto(s?.analogia) || undefined,
        exemplo: texto(s?.exemplo) || undefined,
        desafio_pontual: texto(s?.desafio_pontual || s?.atividade || s?.desafio) || undefined,
        pergunta: texto(s?.pergunta) || undefined,
        interacao: texto(s?.interacao) || undefined,
      };
    })
    .filter((s: AulaOutlineSecao) => s.titulo);

  const sintese: AulaOutlineSintese[] = (Array.isArray(raw.sintese) ? raw.sintese : [])
    .map((x: any) => ({ conceito: texto(x?.conceito), resumo: texto(x?.resumo) }))
    .filter((x: AulaOutlineSintese) => x.conceito)
    .slice(0, SINTESE_MAX);

  const material: AulaOutlineReferencia[] = (Array.isArray(raw.material_complementar) ? raw.material_complementar : [])
    .map((x: any) => {
      const url = texto(x?.url);
      return { titulo: texto(x?.titulo), detalhe: texto(x?.detalhe), url: /^https?:\/\//i.test(url) ? url : undefined };
    })
    .filter((x: AulaOutlineReferencia) => x.titulo)
    .slice(0, REFERENCIAS_MAX);

  return {
    titulo,
    subtitulo: texto(raw.subtitulo),
    problematica: texto(raw.problematica || raw.gancho || raw.problema) || undefined,
    fio_condutor: texto(raw.fio_condutor) || undefined,
    objetivos: listaDeTextos(raw.objetivos).slice(0, OBJETIVOS_MAX),
    prerequisitos: listaDeTextos(raw.prerequisitos),
    secoes,
    sintese,
    fixacao: Array.isArray(raw.fixacao) ? listaDeTextos(raw.fixacao) : undefined,
    material_complementar: material,
  };
}

export function parseOutline(content: string): AulaOutline | null {
  return normalizarOutline(extrairJsonObjeto(content));
}

export function diagnosticarOutline(outline: any): string[] {
  if (!outline || typeof outline !== 'object' || Array.isArray(outline)) return ['Outline ausente ou invalido.'];
  const erros: string[] = [];
  if (!texto(outline.titulo)) erros.push('Titulo da aula ausente.');
  const secoes = Array.isArray(outline.secoes) ? outline.secoes : [];
  if (secoes.length < SECOES_MIN || secoes.length > SECOES_MAX) {
    erros.push(`Secoes devem ser de ${SECOES_MIN} a ${SECOES_MAX} (recebidas: ${secoes.length}).`);
  }
  secoes.forEach((secao: any, i: number) => {
    const rotulo = `Secao ${i + 1}`;
    if (!texto(secao?.titulo)) erros.push(`${rotulo}: titulo ausente.`);
    if (!texto(secao?.proposito)) erros.push(`${rotulo}: proposito ausente.`);
    if (listaDeTextos(secao?.conceitos).length === 0) erros.push(`${rotulo}: nenhum conceito declarado.`);
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

  for (const token of interactiveMarkdown.parse(slideMd, {})) {
    if (token.type !== 'fence' || token.info.trim() !== 'interactive') continue;
    try { parseSlideInteractive(token.content); }
    catch (error) { erros.push(`Interativo inválido: ${error instanceof Error ? error.message : 'JSON inválido'}`); }
  }

  const mermaidMatch = slideMd.match(/```mermaid\s*\n\s*([a-zA-Z]+)/);
  if (mermaidMatch && !MERMAID_TYPES.includes(mermaidMatch[1])) {
    erros.push(`Diagrama mermaid com tipo desconhecido: ${mermaidMatch[1]}.`);
  }

  return erros;
}

export function validarDensidadeSlide(slideMd: string): string[] {
  const erros: string[] = [];
  const linhas = slideMd.split('\n').filter((linha) => linha.trim() !== '');
  const caracteres = slideMd.replace(/\s+/g, ' ').trim().length;
  if (linhas.length > SLIDE_LINHAS_MAX || caracteres > SLIDE_CHARS_MAX) {
    erros.push(
      `Slide com conteudo demais (${linhas.length} linhas, ${caracteres} caracteres); divida em dois slides ou corte o excesso (limite: ${SLIDE_LINHAS_MAX} linhas / ${SLIDE_CHARS_MAX} caracteres).`
    );
  }
  return erros;
}

export function validarSecaoMarp(secaoMd: string): string[] {
  if (!secaoMd || !secaoMd.trim()) return ['Secao vazia.'];
  const erros: string[] = [];
  dividirEmSlides(secaoMd).forEach((slide, idx) => {
    for (const erro of validarSlideMarp(slide)) erros.push(`Slide ${idx + 1}: ${erro}`);
  });
  return erros;
}

export function avisosDensidade(conteudoMd: string, limite = 5): string[] {
  const avisos: string[] = [];
  dividirEmSlides(conteudoMd).forEach((slide, idx) => {
    for (const erro of validarDensidadeSlide(slide)) avisos.push(`Slide ${idx + 1}: ${erro}`);
  });
  return avisos.slice(0, limite);
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

export function inserirSeparadoresAusentes(md: string, preservarCapa = false): string {
  const linhas = md.split('\n');
  const saida: string[] = [];
  let dentroDeFence = false;
  let slideIniciado = false;
  let primeiroTitulo = -1;
  let totalTitulos = 0;

  for (const linha of linhas) {
    if (/^[ \t]*```/.test(linha)) {
      dentroDeFence = !dentroDeFence;
      saida.push(linha);
      continue;
    }

    if (!dentroDeFence && linha.trim() === '---') {
      slideIniciado = false;
      saida.push(linha);
      continue;
    }

    const abreSlide = !dentroDeFence && /^[ \t]{0,3}#{1,2}\s+\S/.test(linha);
    if (abreSlide) {
      const subtituloCapa = preservarCapa && totalTitulos === 1 && /^##\s/.test(linha) &&
        /^#\s/.test(saida[primeiroTitulo] ?? '') && saida.slice(primeiroTitulo + 1).every(l => !l.trim());
      totalTitulos += 1;
      if (slideIniciado && !subtituloCapa) {
        while (saida.length > 0 && saida[saida.length - 1].trim() === '') saida.pop();
        saida.push('', '---', '');
      }
      slideIniciado = true;
      if (primeiroTitulo < 0) primeiroTitulo = saida.length;
    }

    saida.push(linha);
  }

  return saida.join('\n');
}

export function gerarFrontMatterEPrimeiroSlide(outline: AulaOutline, autor?: string): string {
  const titulo = (outline.titulo || 'Nova Aula').replace(/[\r\n]+/g, ' ').trim();
  const subtitulo = (outline.subtitulo || '').replace(/[\r\n]+/g, ' ').trim();
  let problematica = (outline.problematica || '').replace(/[\r\n]+/g, ' ').trim();
  if (problematica) {
    problematica = problematica.replace(/^>\s*\*?"?|"?\*?\s*$/g, '').trim();
  }

  const frontMatter = [
    '---',
    'marp: true',
    'theme: default',
    `title: ${titulo}`,
    'animation: fade-up',
    'animation-stagger: 0.12s',
    'animation-duration: 0.5s',
    '---',
    '',
    `# ${titulo}`,
    ...(subtitulo ? ['', `## ${subtitulo}`] : []),
    ...(problematica ? ['', `> *"${problematica}"*`] : []),
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

  if (outline.sintese && outline.sintese.length > 0) {
    for (let i = 0; i < outline.sintese.length; i += 4) {
      const linhas = outline.sintese.slice(i, i + 4).map((s) => `| **${s.conceito}** | ${s.resumo} |`);
      partes.push(
        ['## Sintese do percurso' + (i === 0 ? '' : ' (continuação)'), '', '| Conceito | Em uma frase |', '| :--- | :--- |', ...linhas].join('\n')
      );
    }
  }

  if (Array.isArray(outline.fixacao) && outline.fixacao.length > 0) {
    const itens = outline.fixacao.map((q, i) => `${i + 1}. ${q}`).join('\n');
    partes.push(['## Verifique o que voce aprendeu', '', itens].join('\n'));
  }

  if (outline.material_complementar && outline.material_complementar.length > 0) {
    const itens = outline.material_complementar
      .map((r) => (r.url ? `- **${r.titulo}** — ${r.detalhe} <${r.url}>` : `- **${r.titulo}** — ${r.detalhe}`))
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

  const systemPrompt = `<INSTRUCOES>
Você é um coordenador pedagógico e designer instrucional sênior especializado em ensino inclusivo e metodologia ativa.
Sua tarefa é planejar a estrutura curricular de UMA aula completa sobre o tema solicitado.
Combine clareza conceitual com narrativa realista, progressão lógica e educação preventiva de erros.
</INSTRUCOES>

${GUIA_DIDATICO}

${CONTRATO_RENDERER}

<FORMATO_RESPOSTA>
Retorne ESTRITAMENTE um objeto JSON (sem markdown, sem blocos externos de código) neste formato exato:
{
  "titulo": "Título principal da aula",
  "subtitulo": "Comandos ou conceitos técnicos centrais, direto e específico",
  "problematica": "Pergunta provocativa ou situação-problema concreta para a capa",
  "fio_condutor": "História única, personagens, dados canônicos, resultados esperados e o que NÃO deve mudar entre seções",
  "objetivos": ["O que o aluno será capaz de fazer ao final"],
  "prerequisitos": ["O que o aluno já deve saber"],
  "secoes": [
    {
      "titulo": "Título do bloco conceitual",
      "proposito": "O que o aluno deve compreender neste bloco",
      "conceitos": ["Conceito-chave"],
      "analogia": "Analogia concreta condutora",
      "exemplo": "Exemplo central simplificado",
      "desafio_pontual": "Micro-desafio prático para fechar a seção",
      "pergunta": "Previsão que o aluno fará antes de ver a solução",
      "interacao": "Tipo nativo e estados/dados que demonstram a operação, sem escrever JSON do componente"
    }
  ],
  "sintese": [{ "conceito": "Conceito", "resumo": "Explicação em uma frase" }],
  "fixacao": ["Pergunta de previsão", "Diagnóstico de erro", "Transferência para uma situação nova"],
  "material_complementar": [{ "titulo": "Livro ou documentação oficial", "detalhe": "Para que serve", "url": "https://..." }]
}
</FORMATO_RESPOSTA>

<REGRAS_PLANEJAMENTO>
1. De ${SECOES_MIN} a ${SECOES_MAX} seções em progressão: da contextualização/analogia até a consolidação técnica.
2. Cada seção tem de 1 a 3 conceitos-chave exclusivos, sem repetir entre seções.
3. Objetivos: até ${OBJETIVOS_MAX}. Síntese: de 4 a ${SINTESE_MAX} linhas.
4. Material complementar: de 3 a ${REFERENCIAS_MAX} referências reais (livros canônicos ou documentações oficiais).
5. Preencha fio_condutor com o cenário, esquema/dados mínimos e resultados de referência. Preserve a unidade da pergunta (por pedido, cliente ou grupo); dados adicionais só entram quando anunciados.
6. Cada seção resolve uma limitação anterior e prepara a próxima, sem recomeçar a história. Planeje pergunta de previsão, exemplo resolvido e interação observável; não empilhe comandos desconectados.
7. JSON de planejamento é compacto: fio_condutor até 900 caracteres, exemplos e instruções de interação até 350 cada. Sem SQL completo nem diálogos extensos no outline.
8. Reserve espaço para desenvolver os conceitos em passos pequenos: motivação, tentativa, solução, evidência, variação e prática. Não comprima um percurso inteiro em 3 slides nem conte linhas de JSON como texto visível.
9. fixacao: 3–5 perguntas específicas de interpretação, diagnóstico e transferência. Não dê a resposta na pergunta.
</REGRAS_PLANEJAMENTO>

<PROIBICOES_NEGATIVAS>
- Não incluir metadados como: "Público-Alvo", "Duração", "Materiais Necessários".
- Não citar metodologias pedagógicas diretamente ("Educação Preventiva", "Ciclo de Gibbs").
- Não inventar URLs nem referências bibliográficas fictícias (como "Guia de Programação Inclusiva").
</PROIBICOES_NEGATIVAS>`;

  let userPrompt = `<SOLICITACAO>\nTEMA: ${tema || 'Conteudo geral'}\n`;
  if (observacoes) userPrompt += `OBSERVACOES DO PROFESSOR: ${observacoes}\n`;
  if (aulasContexto) userPrompt += `\nAULAS DE REFERENCIA:\n${aulasContexto}\n`;
  if (docsContexto) userPrompt += `\nDOCUMENTOS ORIENTADORES:\n${docsContexto}\n`;
  userPrompt += 'Gere o outline pedagógico estruturado desta aula.\n</SOLICITACAO>';

  return { systemPrompt, userPrompt };
}

export function normalizarEspacamentoMd(md: string): string {
  let texto = md.replace(/\r\n/g, '\n').trim();
  texto = texto.replace(/\n{3,}/g, '\n\n');
  return texto + '\n';
}

export function promptSecaoAula(params: {
  outline: AulaOutline;
  indiceSecao: number;
  contextoLimpo?: string;
  observacoes?: string;
}): { systemPrompt: string; userPrompt: string } {
  const { outline, indiceSecao, contextoLimpo = '', observacoes = '' } = params;
  const secao = outline.secoes[indiceSecao];
  const primeira = indiceSecao === 0;
  const numDesafio = String(indiceSecao + 1).padStart(2, '0');

  const systemPrompt = `<INSTRUCOES>
Você redige os slides de UMA seção de uma aula em Marp Next Markdown.
Responda exclusivamente com os slides Markdown desta seção (sem YAML front-matter e sem '---' na primeira ou última linha).
Seja conciso e direto.
</INSTRUCOES>

${GUIA_DIDATICO}

${CONTRATO_RENDERER}

${SKILL_RECURSOS_RENDER}

${EXEMPLO_PADRAO_AULA}

<REGRAS_SECAO>
1. TÍTULO ÚNICO: Todo slide tem rigorosamente um título '## Título' (proibido '#' e proibido '###').
2. SEPARADOR OBRIGATÓRIO: Todo slide é separado pelo delimitador '---' em linha isolada. Sem ele dois slides viram um e cortam texto.
3. EXTENSÃO: desenvolva o percurso em slides pequenos, sem quantidade fixa: uma pergunta, operação ou mudança por slide. Um conceito pode precisar de vários slides complementares; não repita definições. Respeite o LIMITE VERTICAL, não um mínimo de linhas.
4. DESAFIO PONTUAL: O último slide desta seção deve ser intitulado rigorosamente '## Desafio ${numDesafio}' (sem dois pontos, sem texto adicional no título).
5. A primeira seção apresenta história e dados, propõe uma previsão e uma tentativa ANTES de formalizar. As demais retomam a pergunta pendente da seção anterior em uma frase, sem repetir capa, tabelas-base ou introdução.
6. Inclua o interativo planejado com dados e resultados coerentes e uma variação interativa do mesmo conceito, uma comparação em cols-2 quando couber e pelo menos uma pausa de previsão com resposta recolhível. A animação deve demonstrar a operação, não apenas trocar textos genéricos.
7. Não resolva conceitos reservados a outras seções. Um exemplo pode preparar a próxima pergunta sem antecipar toda a sintaxe.
</REGRAS_SECAO>

<PROIBICOES_NEGATIVAS>
- PROIBIDO criar slides de "Reflexão", "Síntese", "Conclusão" ou "Material Complementar" (o motor já fecha a aula).
- Não incluir: "Público-Alvo", "Duração", "Materiais Necessários".
- Não usar placeholders como [Image of ...] nem inventar links de imagem.
- Não usar emojis nem prefixos mecânicos com dois pontos nos títulos ("Dica:", "Atenção:", "Armadilha comum:").
</PROIBICOES_NEGATIVAS>`;

  const outras = outline.secoes
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => i !== indiceSecao)
    .map(({ s, i }) => `- Seção ${i + 1} (${s.titulo}): ${s.conceitos.join(', ')}`);

  let userPrompt = `<TAREFA>\nTÍTULO DA AULA: ${outline.titulo}${outline.subtitulo ? ` — ${outline.subtitulo}` : ''}\n`;
  userPrompt += `SEÇÃO ATUAL (${indiceSecao + 1} de ${outline.secoes.length}): ${secao.titulo}\n`;
  userPrompt += `PROPÓSITO: ${secao.proposito}\n`;
  if (outline.fio_condutor) userPrompt += `FIO CONDUTOR E DADOS CANÔNICOS (iguais em todas as seções):\n${outline.fio_condutor}\n`;
  if (secao.pergunta) userPrompt += `PERGUNTA ANTES DA REVELAÇÃO: ${secao.pergunta}\n`;
  if (secao.interacao) userPrompt += `INTERAÇÃO PLANEJADA: ${secao.interacao}\n`;
  userPrompt += `CONCEITOS A ENSINAR:\n- ${secao.conceitos.join('\n- ')}\n`;
  if (secao.analogia) userPrompt += `ANALOGIA CONDUTORA: ${secao.analogia}\n`;
  if (secao.exemplo) userPrompt += `EXEMPLO CENTRAL: ${secao.exemplo}\n`;
  if (secao.desafio_pontual) userPrompt += `DESAFIO (## Desafio ${numDesafio}): ${secao.desafio_pontual}\n`;
  if (primeira && outline.prerequisitos.length > 0) userPrompt += `PRÉ-REQUISITOS A RETOMAR: ${outline.prerequisitos.join('; ')}\n`;
  if (primeira && outline.objetivos.length > 0) userPrompt += `OBJETIVOS DA AULA: ${outline.objetivos.join('; ')}\n`;
  if (outras.length > 0) userPrompt += `OUTRAS SEÇÕES DA AULA (cobertas lá, não repetir):\n${outras.join('\n')}\n`;
  if (observacoes) userPrompt += `OBSERVAÇÕES DO PROFESSOR (preservar na redação, aplicando os recursos pedidos na seção pertinente):\n${observacoes}\n`;
  if (contextoLimpo) userPrompt += `CONTEXTO DE REFERÊNCIA:\n${contextoLimpo}\n`;
  userPrompt += `Redija os slides da seção "${secao.titulo}".\n</TAREFA>`;

  return { systemPrompt, userPrompt };
}

export function promptAulaDireta(params: {
  tema: string;
  observacoes?: string;
  aulasContexto?: string;
  docsContexto?: string;
}): { systemPrompt: string; userPrompt: string } {
  const { tema, observacoes = '', aulasContexto = '', docsContexto = '' } = params;

  const systemPrompt = `<PROMPT name="GeracaoDidaticaAutoAvaliativa">
<INSTRUCOES>
Você redige uma aula em Marp Next no padrão de uma boa conversa de sala de aula.
Responda exclusivamente com Markdown, começando com front-matter. O modo expresso elimina o planner externo, não a profundidade didática.
</INSTRUCOES>

${GUIA_DIDATICO}

${CONTRATO_RENDERER}

${SKILL_RECURSOS_RENDER}

${EXEMPLO_PADRAO_AULA}

<PLANEJAMENTO_INTERNO>
Antes de redigir, organize silenciosamente 3–5 blocos conceituais encadeados:
- Uma história e um conjunto canônico de dados; confira operações e resultados e a pergunta que cada exemplo responde.
- Para cada bloco: necessidade -> previsão -> tentativa/limitação -> solução -> resultado -> variação -> prática com gabarito. Distribua esses passos em slides, não em parágrafos densos.
- Escolha a interação que torna o raciocínio visível e uma comparação em colunas quando houver antes/depois. Planeje momentos de observar, clicar e conferir em cada bloco.
- Feche voltando à história, não com uma lista de comandos.
Não exiba o planejamento. Não force 18–26 slides nem compacte para caber numa contagem: a extensão decorre do percurso, sempre respeitando a altura.
</PLANEJAMENTO_INTERNO>

<ESTRUTURA_DA_AULA>
Front-matter: marp:true, theme:default, title e animation:fade-up.
Capa única: # título e ## subtítulo no mesmo slide, sem separador entre os dois.
Apresente cenário e dados, faça a pergunta concreta e peça uma previsão. Formalize depois da primeira tentativa, não na capa.
Desenvolva todos os blocos em progressão; inclua interativos nativos pertinentes, código completo com linguagem, resultados conferidos e exercícios distribuídos com details.gab.
Cada título ## abre um slide separado por --- (exceto subtítulo da capa). Títulos naturais, sem etiquetas repetitivas. Perguntas específicas como "o que muda com um dado novo?" são preferíveis a "Pergunta antes de revelar".
Conclua com retorno ao problema, síntese em tabelas curtas (até 4 linhas por slide), prática de transferência com gabarito, 3–5 perguntas e referências reais.
</ESTRUTURA_DA_AULA>

<REVISAO_ANTES_DE_ENTREGAR>
EXPLICAR ANTES DE CITAR: apresente cada operação antes de usá-la em uma consulta maior.
PROIBIDO VAZAMENTO DE CONTEÚDO: não resolva um conceito avançado no exemplo de introdução; não disfarce mudança de pergunta como correção.
SEM TERMOS VAGOS OU GENÉRICOS: diga qual dado mudou, por que uma linha entra/sai e o que o aluno deve concluir.
Em slide com interativo, no máximo 2 frases curtas fora do widget; as etapas carregam a explicação, com textos curtos e dados do cenário.
Confira conta, cardinalidade, tipos, aliases e resultados. NULL e otimização não devem virar simplificações falsas.
Sem scripts/CSS próprios para recursos nativos, imagens, emojis ou referências inventadas.
Não incluir metadados: "Público-Alvo", "Duração", "Materiais Necessários".
</REVISAO_ANTES_DE_ENTREGAR>
</PROMPT>`;

  let userPrompt = `<SOLICITACAO>\nTEMA DA AULA: ${tema || 'Conteudo geral'}\n`;
  if (observacoes) userPrompt += `OBSERVACOES DO PROFESSOR: ${observacoes}\n`;
  if (aulasContexto) userPrompt += `\nAULAS DE REFERENCIA:\n${aulasContexto}\n`;
  if (docsContexto) userPrompt += `\nDOCUMENTOS ORIENTADORES:\n${docsContexto}\n`;
  userPrompt += 'Redija a aula completa do início ao fim em Marp Next Markdown com explicações ricas, progressão linear e densidade equilibrada.\n</SOLICITACAO>';

  return { systemPrompt, userPrompt };
}
