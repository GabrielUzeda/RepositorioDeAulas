import { describe, it, expect } from 'bun:test';
import { stripGabarito } from './routes';

describe('stripGabarito security tests', () => {
  it('should remove resposta_esperada and rubrica from all question types, and correct only from normal/prova', () => {
    const tiposQuePreservamGabarito = ['reforco', 'roleta', 'minigame'];
    const tiposQueRemovemGabarito = ['normal', 'prova'];

    for (const tipo of [...tiposQuePreservamGabarito, ...tiposQueRemovemGabarito]) {
      const row = {
        id: 1,
        tipo,
        senha: 'secret_password',
        json_data: JSON.stringify({
          questions: [
            {
              title: 'Q1',
              content: 'Content 1',
              resposta_esperada: 'Minha resposta esperada secreta',
              rubrica: [
                { criterio: 'Clareza', peso: 2, descricao: 'Boa clareza' }
              ],
              options: [
                { text: 'Opt 1', correct: true },
                { text: 'Opt 2', correct: false }
              ]
            }
          ]
        })
      };

      const stripped = stripGabarito(row);
      expect(stripped.senha).toBeUndefined();

      const parsed = JSON.parse(stripped.json_data);
      expect(parsed.questions[0].resposta_esperada).toBeUndefined();
      expect(parsed.questions[0].rubrica).toBeUndefined();
      if (tiposQuePreservamGabarito.includes(tipo)) {
        expect(parsed.questions[0].options[0].correct).toBe(true);
      } else {
        expect(parsed.questions[0].options[0].correct).toBeUndefined();
      }
    }
  });

  it('should not mutate original row or json_data state', () => {
    const row = {
      id: 2,
      tipo: 'normal',
      json_data: JSON.stringify({
        questions: [
          {
            title: 'Q1',
            content: 'Content 1',
            resposta_esperada: 'Gabarito',
            rubrica: [{ criterio: 'C1', peso: 1, descricao: 'D1' }]
          }
        ]
      })
    };

    const originalJson = row.json_data;
    const stripped = stripGabarito(row);

    expect(row.json_data).toBe(originalJson);
    const originalParsed = JSON.parse(originalJson);
    expect(originalParsed.questions[0].resposta_esperada).toBe('Gabarito');
    expect(originalParsed.questions[0].rubrica).toBeDefined();
  });
});
