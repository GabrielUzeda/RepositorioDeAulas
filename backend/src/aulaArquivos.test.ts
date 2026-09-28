import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import app from './routes';
import { resolveFrontendDir } from './marp';
import { adminToken, authHeaders, createCurso, deleteCurso, jsonHeaders, readBody, unique } from './testHelpers';

describe('Arquivos de aula: colisão de caminho entre cursos', () => {
  let admin = '';
  let cursoA = 0;
  let cursoB = 0;
  const caminhos: string[] = [];

  async function criarDisciplina(cursoId: number, nome: string) {
    const res = await app.request('/disciplinas', {
      method: 'POST',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ curso_id: cursoId, nome, cor: 'bg-emerald-600', icone: 'school' }),
    });
    expect(res.status).toBe(201);
    return readBody(res);
  }

  async function criarAula(disciplinaId: number, titulo: string, markdown: string) {
    const res = await app.request('/aulas', {
      method: 'POST',
      headers: jsonHeaders(admin),
      body: JSON.stringify({ disciplina_id: disciplinaId, titulo, markdown }),
    });
    expect(res.status).toBe(201);
    return readBody(res);
  }

  beforeAll(async () => {
    admin = await adminToken();
    cursoA = (await createCurso(admin)).id;
    cursoB = (await createCurso(admin)).id;
  });

  afterAll(async () => {
    await deleteCurso(admin, cursoA);
    await deleteCurso(admin, cursoB);
    for (const caminho of caminhos) {
      try {
        rmSync(path.dirname(path.join(resolveFrontendDir(), caminho)), { recursive: true, force: true });
        rmSync(path.dirname(path.dirname(path.join(resolveFrontendDir(), caminho))), { recursive: true, force: true });
      } catch {
        void 0;
      }
    }
  });

  test('excluir um curso não apaga o arquivo compartilhado por aula de outro curso', async () => {
    const nomeDisciplina = unique('Colisao');
    const tituloAula = unique('Aula Compartilhada');
    const markdown = `# Slide\n\n${'conteudo compartilhado '.repeat(100)}`;

    const discA = await criarDisciplina(cursoA, nomeDisciplina);
    const discB = await criarDisciplina(cursoB, nomeDisciplina);
    expect(discA.slug).toBe(discB.slug);

    const aulaA = await criarAula(discA.id, tituloAula, markdown);
    const aulaB = await criarAula(discB.id, tituloAula, markdown);
    expect(aulaA.caminho).toBe(aulaB.caminho);
    caminhos.push(aulaA.caminho);

    const arquivo = path.join(resolveFrontendDir(), aulaA.caminho);
    expect(existsSync(arquivo)).toBe(true);

    const excluirA = await app.request(`/cursos/${cursoA}`, {
      method: 'DELETE',
      headers: authHeaders(admin),
    });
    expect(excluirA.status).toBe(204);
    expect(existsSync(arquivo)).toBe(true);

    const aulaDoOutroCurso = await app.request(`/${aulaB.caminho}`);
    expect(aulaDoOutroCurso.status).toBe(200);

    const excluirB = await app.request(`/cursos/${cursoB}`, {
      method: 'DELETE',
      headers: authHeaders(admin),
    });
    expect(excluirB.status).toBe(204);
    expect(existsSync(arquivo)).toBe(false);
  });
});
