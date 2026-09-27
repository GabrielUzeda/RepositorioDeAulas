import { describe, expect, test } from 'bun:test';
import { executarEmFila } from './fila';

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('executarEmFila: serialização por chave', () => {
  test('tarefas da mesma chave nunca se sobrepõem e preservam a ordem', async () => {
    const eventos: string[] = [];

    await Promise.all([
      executarEmFila('mesma', async () => {
        eventos.push('inicio-1');
        await esperar(25);
        eventos.push('fim-1');
      }),
      executarEmFila('mesma', async () => {
        eventos.push('inicio-2');
        await esperar(1);
        eventos.push('fim-2');
      }),
      executarEmFila('mesma', async () => {
        eventos.push('inicio-3');
        eventos.push('fim-3');
      }),
    ]);

    expect(eventos).toEqual(['inicio-1', 'fim-1', 'inicio-2', 'fim-2', 'inicio-3', 'fim-3']);
  });

  test('chaves diferentes rodam em paralelo', async () => {
    const eventos: string[] = [];

    await Promise.all([
      executarEmFila('a', async () => {
        eventos.push('a-inicio');
        await esperar(20);
        eventos.push('a-fim');
      }),
      executarEmFila('b', async () => {
        eventos.push('b-inicio');
        await esperar(1);
        eventos.push('b-fim');
      }),
    ]);

    expect(eventos).toEqual(['a-inicio', 'b-inicio', 'b-fim', 'a-fim']);
  });

  test('erro em uma tarefa não trava a fila da mesma chave', async () => {
    const eventos: string[] = [];

    const comErro = executarEmFila('erro', async () => {
      eventos.push('falha');
      throw new Error('falha esperada');
    });
    await expect(comErro).rejects.toThrow('falha esperada');

    await executarEmFila('erro', async () => {
      eventos.push('depois');
    });

    expect(eventos).toEqual(['falha', 'depois']);
  });
});
