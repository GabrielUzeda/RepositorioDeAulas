import { describe, expect, test } from 'bun:test';
import { isOrderSensitiveOption, shuffleArray, shuffleQuestionOptions } from '../src/shared/utils/shuffle';

function permutacoes<T>(items: readonly T[]): string[] {
  if (items.length <= 1) return [items.join(',')];
  const resultado: string[] = [];
  items.forEach((item, indice) => {
    const resto = [...items.slice(0, indice), ...items.slice(indice + 1)];
    for (const cauda of permutacoes(resto)) {
      resultado.push(`${item},${cauda}`);
    }
  });
  return resultado;
}

describe('shuffleArray', () => {
  test('devolve uma permutação com os mesmos elementos e sem mutar a origem', () => {
    const origem = [1, 2, 3, 4, 5];
    const copia = [...origem];
    const resultado = shuffleArray(origem);

    expect(origem).toEqual(copia);
    expect(resultado).toHaveLength(origem.length);
    expect([...resultado].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  test('lida com listas vazias e com um único elemento', () => {
    expect(shuffleArray([])).toEqual([]);
    expect(shuffleArray([7])).toEqual([7]);
    expect(shuffleArray(['a', 'b'])).toHaveLength(2);
  });

  test('produz ordem aleatória com distribuição uniforme das permutações', () => {
    const total = 6000;
    const contagem = new Map<string, number>();
    for (let i = 0; i < total; i++) {
      const chave = shuffleArray(['a', 'b', 'c', 'd']).join('');
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }

    expect(contagem.size).toBe(permutacoes(['a', 'b', 'c', 'd']).length);

    const esperado = total / 24;
    for (const vezes of contagem.values()) {
      expect(vezes).toBeGreaterThan(esperado * 0.6);
      expect(vezes).toBeLessThan(esperado * 1.4);
    }
  });

  test('a primeira posição não é viciada em nenhum elemento', () => {
    const total = 4000;
    const contagem = new Map<string, number>();
    for (let i = 0; i < total; i++) {
      const primeiro = shuffleArray(['x', 'y', 'z'])[0];
      contagem.set(primeiro, (contagem.get(primeiro) ?? 0) + 1);
    }

    expect(contagem.size).toBe(3);
    for (const vezes of contagem.values()) {
      expect(vezes).toBeGreaterThan(total * 0.25);
      expect(vezes).toBeLessThan(total * 0.42);
    }
  });
});

describe('isOrderSensitiveOption', () => {
  test('reconhece alternativas que dependem da posição', () => {
    const sensiveis = [
      'Nenhuma das anteriores',
      'Todas as alternativas acima',
      'Todas as opções estão corretas',
      'Todas as afirmativas são verdadeiras',
      'Apenas I e II',
      'I',
      'II',
      'III',
      'IV',
      'V',
      'Verdadeiro',
      'Falso',
      'Marque a alternativa correta',
      'As alternativas A e B estão corretas',
    ];
    for (const texto of sensiveis) {
      expect(isOrderSensitiveOption(texto)).toBe(true);
      expect(isOrderSensitiveOption({ text: texto })).toBe(true);
    }
  });

  test('não marca alternativas comuns nem entradas vazias', () => {
    expect(isOrderSensitiveOption('Brasília')).toBe(false);
    expect(isOrderSensitiveOption('JavaScript/TypeScript')).toBe(false);
    expect(isOrderSensitiveOption('Reduzir o tempo de acesso a dados frequentes da RAM')).toBe(false);
    expect(isOrderSensitiveOption('x = 10')).toBe(false);
    expect(isOrderSensitiveOption('v = 20 m/s')).toBe(false);
    expect(isOrderSensitiveOption('for (let i = 0; i < n; i++)')).toBe(false);
    expect(isOrderSensitiveOption('{{vazio}}')).toBe(false);
    expect(isOrderSensitiveOption('')).toBe(false);
    expect(isOrderSensitiveOption({})).toBe(false);
    expect(isOrderSensitiveOption(null)).toBe(false);
    expect(isOrderSensitiveOption(undefined)).toBe(false);
  });
});

describe('shuffleQuestionOptions', () => {
  const questao = () => ({
    id: 'q1',
    title: 'Conceito',
    content: 'Qual peça é o cérebro do computador?',
    options: [
      { text: 'CPU', correct: true },
      { text: 'Fonte', correct: false },
      { text: 'Monitor', correct: false },
      { text: 'Teclado', correct: false },
    ],
  });

  function textos(questao: { options?: Array<{ text: string }> }): string[] {
    return (questao.options ?? []).map((o) => o.text);
  }

  test('embaralha as alternativas preservando os demais campos e sem mutar a origem', () => {
    const original = questao();
    const referencia = JSON.stringify(original);
    const vistas = new Set<string>();

    for (let i = 0; i < 400; i++) {
      const [resultado] = shuffleQuestionOptions([original]);
      vistas.add(textos(resultado).join(','));
      expect(resultado.id).toBe('q1');
      expect(resultado.title).toBe('Conceito');
      expect(resultado.content).toBe(original.content);
      expect(resultado.options).toHaveLength(4);
      expect((resultado.options ?? []).find((o) => o.correct)?.text).toBe('CPU');
    }

    expect(JSON.stringify(original)).toBe(referencia);
    expect(vistas.size).toBe(24);
  });

  test('não altera a ordem das alternativas sensíveis à posição', () => {
    const verdadeiroFalso = { content: 'A Terra é plana?', options: [{ text: 'Verdadeiro' }, { text: 'Falso' }] };
    const romanos = { content: 'Quais itens?', options: [{ text: 'I' }, { text: 'II' }, { text: 'III' }] };
    const meta = {
      content: 'Qual o total?',
      options: [{ text: '10' }, { text: '20' }, { text: 'Nenhuma das anteriores' }],
    };

    for (let i = 0; i < 50; i++) {
      const [vf, rom, mt] = shuffleQuestionOptions([verdadeiroFalso, romanos, meta]);
      expect(textos(vf)).toEqual(['Verdadeiro', 'Falso']);
      expect(textos(rom)).toEqual(['I', 'II', 'III']);
      expect(textos(mt)).toEqual(['10', '20', 'Nenhuma das anteriores']);
    }
  });

  test('mantém questões sem alternativas, com uma alternativa ou nulas', () => {
    const discursiva: { content: string; options?: Array<{ text: string }> } = {
      content: 'Disserte sobre redes.',
    };
    const unica: { content: string; options?: Array<{ text: string }> } = {
      content: 'Única',
      options: [{ text: 'A' }],
    };

    const resultados = shuffleQuestionOptions([discursiva, unica, null as unknown as { options?: unknown[] }]);

    expect(resultados[0]).toBe(discursiva);
    expect(resultados[1]).toBe(unica);
    expect(resultados[2]).toBeNull();
  });

  test('aceita listas nulas ou indefinidas', () => {
    expect(shuffleQuestionOptions(null)).toEqual([]);
    expect(shuffleQuestionOptions(undefined)).toEqual([]);
    expect(shuffleQuestionOptions([])).toEqual([]);
  });
});
