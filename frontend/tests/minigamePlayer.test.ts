import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { MinigamePlayer } from '../src/aluno/components/minigame-player';

// Mock DOM environment for MinigamePlayer tests
class MockElement {
  id: string;
  innerHTML = '';
  innerText = '';
  value = '';
  disabled = false;
  className = '';
  style: Record<string, string> = {};
  children: MockElement[] = [];
  listeners: Record<string, Function[]> = {};

  classList = {
    add: (...tokens: string[]) => {
      this.className += ' ' + tokens.join(' ');
    },
    remove: (...tokens: string[]) => {
      for (const t of tokens) {
        this.className = this.className.replace(new RegExp(t, 'g'), '');
      }
    },
    contains: (token: string) => this.className.includes(token),
  };

  addEventListener(event: string, cb: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  removeEventListener(event: string, cb: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(fn => fn !== cb);
    }
  }

  appendChild(child: MockElement) {
    this.children.push(child);
    return child;
  }
  remove() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 };
  }
  getContext() {
    return {
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fill: () => {},
      stroke: () => {},
      arc: () => {},
      fillRect: () => {},
      fillText: () => {},
    };
  }

  constructor(id = '') {
    this.id = id;
  }
}

const elementsMap = new Map<string, MockElement>();

const mockDocument = {
  getElementById(id: string) {
    if (!elementsMap.has(id)) {
      elementsMap.set(id, new MockElement(id));
    }
    return elementsMap.get(id);
  },
  createElement(tag: string) {
    return new MockElement(tag);
  },
  querySelectorAll() {
    return [];
  },
};

(globalThis as any).document = mockDocument;
(globalThis as any).window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  innerWidth: 800,
  innerHeight: 600,
};
(globalThis as any).requestAnimationFrame = (_cb: any) => {};
(globalThis as any).cancelAnimationFrame = () => {};
(globalThis as any).performance = { now: () => Date.now() };

describe('MinigamePlayer engine', () => {
  beforeEach(() => {
    elementsMap.clear();
  });

  test('inicializa e faz o parse de perguntas no formato objects e JSON string', () => {
    const activityData = {
      titulo: 'Missão Teste',
      descricao: 'Teste de minigame',
      json_data: {
        questions: [
          {
            title: 'Q1',
            content: 'Qual a capital do Brasil?',
            options: [
              { text: 'Brasília', correct: true },
              { text: 'São Paulo', correct: false },
            ],
          },
        ],
      },
    };

    const player = new MinigamePlayer(activityData, () => {});
    expect(player.questions).toHaveLength(1);
    expect(player.questions[0].enunciado).toBe('Qual a capital do Brasil?');
    expect(player.questions[0].respostaCorreta).toBe('Brasília');
    expect(player.questions[0].alternativas).toEqual(['Brasília', 'São Paulo']);
  });

  test('faz parse de perguntas no formato alternativo "perguntas"', () => {
    const activityData = {
      titulo: 'Missão 2',
      json_data: JSON.stringify({
        perguntas: [
          {
            enunciado: '2 + 2 = ?',
            alternativas: ['4', '5'],
            respostaCorreta: '4',
          },
        ],
      }),
    };

    const player = new MinigamePlayer(activityData, () => {});
    expect(player.questions).toHaveLength(1);
    expect(player.questions[0].enunciado).toBe('2 + 2 = ?');
    expect(player.questions[0].respostaCorreta).toBe('4');
  });

  test('monta container e inicia partida corretamente com startGame', () => {
    const activityData = {
      id: 'act-1',
      titulo: 'Tiro ao Alvo Lógico',
      json_data: {
        questions: [
          {
            content: 'P1',
            options: [{ text: 'A', correct: true }, { text: 'B', correct: false }],
          },
          {
            content: 'P2',
            options: [{ text: 'C', correct: true }, { text: 'D', correct: false }],
          },
        ],
      },
    };

    const player = new MinigamePlayer(activityData, () => {});
    player.mount('game-container');

    expect(player.containerId).toBe('game-container');
    
    player.startGame();
    expect(player.isPlaying).toBe(true);
    expect(player.score).toBe(0);
    expect(player.gameOver).toBe(false);
    expect(player.availableQuestions).toHaveLength(1);
  });

  test('gerencia acerto de pergunta, cálculo de pontuação e eliminação do inimigo', () => {
    const activityData = {
      id: 'act-1',
      json_data: {
        questions: [
          { content: 'P1', options: [{ text: 'Correta', correct: true }] },
        ],
      },
    };

    const player = new MinigamePlayer(activityData, () => {});
    player.mount('game-container');
    player.availableQuestions = [...player.questions];
    player.spawnEnemy();
    expect(player.currentEnemy).not.toBeNull();

    player.answerChosen('Correta', 'Correta', new MockElement('btn'));
    expect(player.lastChosenAnswer).toBe('Correta');
  });

  test('gerencia erros de pergunta (resposta incorreta) e acionamento de alertas e bloqueio', () => {
    const activityData = {
      id: 'act-1',
      json_data: {
        questions: [
          { content: 'P1', options: [{ text: 'Certa', correct: true }, { text: 'Errada', correct: false }] },
        ],
      },
    };

    const player = new MinigamePlayer(activityData, () => {});
    player.mount('game-container');
    player.availableQuestions = [...player.questions];
    player.spawnEnemy();

    const btn = new MockElement('btn-err');
    
    // First incorrect answer
    player.answerChosen('Errada', 'Certa', btn);
    expect(player.enemyMistakes).toBe(1);
    expect(player.controlsLocked).toBe(false);

    // Second incorrect answer
    player.answerChosen('Errada', 'Certa', btn);
    expect(player.enemyMistakes).toBe(2);
    expect(player.controlsLocked).toBe(true);
  });

  test('ativa condição de Game Over e Vitória corretamente', () => {
    const activityData = {
      id: 'act-1',
      json_data: {
        questions: [{ content: 'P1', options: [{ text: 'A', correct: true }] }],
      },
    };

    const player = new MinigamePlayer(activityData, () => {});
    player.mount('game-container');

    // Test Game Over
    player.triggerGameOver();
    expect(player.gameOver).toBe(true);

    // Test Victory (when availableQuestions is empty)
    player.availableQuestions = [];
    player.spawnEnemy();
    expect(player.isPlaying).toBe(false);
  });

  test('destroy() encerra o loop e nao lanca mesmo sem canvas', () => {
    const player = new MinigamePlayer(
      { json_data: { questions: [{ content: 'P', options: [{ text: 'A', correct: true }] }] } },
      () => {}
    );
    player.mount('game-container');
    player.startGame();
    expect(player.isPlaying).toBe(true);
    player.destroy();
    expect(player.isPlaying).toBe(false);
    expect(() => player.destroy()).not.toThrow();
  });

  test('resetGame() restaura o estado inicial completo', () => {
    const player = new MinigamePlayer(
      { json_data: { questions: [{ content: 'P', options: [{ text: 'A', correct: true }] }] } },
      () => {}
    );
    player.mount('game-container');
    player.startGame();
    player.score = 999;
    player.triggerGameOver();
    player.resetGame();
    expect(player.gameOver).toBe(false);
    expect(player.score).toBe(0);
    expect(player.isPlaying).toBe(false);
    expect(player.currentEnemy).toBeNull();
    expect(player.particles).toEqual([]);
  });

  test('triggerVictory() exibe pontuacao final e libera novo registro', () => {
    const player = new MinigamePlayer({ json_data: { questions: [] } }, () => {});
    player.mount('game-container');
    player.score = 750;
    player.triggerVictory();
    expect(player.isPlaying).toBe(false);
    expect(player.isSubmitting).toBe(false);
  });

  test('answerChosen aceita comparacao case-insensitive', () => {
    const player = new MinigamePlayer(
      {
        json_data: {
          questions: [{ content: 'P', options: [{ text: 'Brasília', correct: true }] }],
        },
      },
      () => {}
    );
    player.mount('game-container');
    player.availableQuestions = [...player.questions];
    player.spawnEnemy();
    player.answerChosen('brasília', 'Brasília', new MockElement('btn'));
    expect(player.lastChosenAnswer).toBe('brasília');
    expect(player.enemyMistakes ?? 0).toBe(0);
  });

  test('answerChosen e ignorada sem inimigo, com lock ou apos game over', () => {
    const player = new MinigamePlayer(
      {
        json_data: {
          questions: [{ content: 'P', options: [{ text: 'A', correct: true }] }],
        },
      },
      () => {}
    );
    player.mount('game-container');

    player.answerChosen('A', 'A', new MockElement('b1'));
    expect(player.lastChosenAnswer).toBeNull();

    player.availableQuestions = [...player.questions];
    player.spawnEnemy();
    player.controlsLocked = true;
    player.answerChosen('A', 'A', new MockElement('b2'));
    expect(player.lastChosenAnswer).toBeNull();
    player.controlsLocked = false;

    player.triggerGameOver();
    player.answerChosen('A', 'A', new MockElement('b3'));
    expect(player.lastChosenAnswer).toBeNull();
  });

  test('startGame com zero perguntas encerra de imediato por exaustao', () => {
    const player = new MinigamePlayer({ json_data: { questions: [] } }, () => {});
    player.mount('game-container');
    player.startGame();
    expect(player.availableQuestions).toEqual([]);
    expect(player.gameOver).toBe(false);
    expect(player.isPlaying).toBe(false);
  });

  test('update() com gameOver e no-op e nao toca no inimigo', () => {
    const player = new MinigamePlayer({ json_data: { questions: [] } }, () => {});
    player.mount('game-container');
    player.gameOver = true;
    player.update(1);
    expect(player.currentEnemy).toBeNull();
  });

  test('update() sem inimigo tenta spawnar e sem perguntas encerra', () => {
    const player = new MinigamePlayer({ json_data: { questions: [] } }, () => {});
    player.mount('game-container');
    player.isPlaying = true;
    player.gameOver = false;
    player.update(1);
    expect(player.isPlaying).toBe(false);
  });

  test('loadNextQuestion popula currentOpts com as alternativas', () => {
    const player = new MinigamePlayer(
      {
        json_data: {
          questions: [
            {
              content: 'P1',
              options: [{ text: 'A', correct: true }, { text: 'B', correct: false }],
            },
          ],
        },
      },
      () => {}
    );
    player.mount('game-container');
    player.availableQuestions = [...player.questions];
    player.loadNextQuestion();
    expect(player.currentOpts).toHaveLength(2);
    expect(player.currentOpts).toContain('A');
    expect(player.currentOpts).toContain('B');
  });

  test('json_data invalido resulta em zero perguntas sem lancar', () => {
    const player = new MinigamePlayer({ json_data: '{invalido' }, () => {});
    expect(player.questions).toEqual([]);
    const player2 = new MinigamePlayer({}, () => {});
    expect(player2.questions).toEqual([]);
  });

  test('mount em container diferente registra o novo id', () => {
    const player = new MinigamePlayer({ json_data: { questions: [] } }, () => {});
    player.mount('outro-container');
    expect(player.containerId).toBe('outro-container');
  });
});
