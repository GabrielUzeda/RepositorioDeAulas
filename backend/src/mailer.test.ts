import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { db } from './db';
import app from './routes';
import { sendMail } from './mailer';
import {
  adminToken,
  createAtividade,
  createCurso,
  createDisciplina,
  createProfessor,
  deleteCurso,
  deleteProfessor,
  jsonHeaders,
  linkProfessorToCurso,
  readBody,
  roletaJson,
} from './testHelpers';

interface SmtpSession {
  from: string;
  to: string[];
  data: string;
}

function startFakeSmtp() {
  const sessions: SmtpSession[] = [];
  let pending: SmtpSession | null = null;
  let buffer = '';
  let emDados = false;

  const server = Bun.listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: {
      open(socket) {
        socket.write('220 fake.local ESMTP\r\n');
      },
      data(socket, chunk) {
        buffer += chunk.toString();
        for (;;) {
          if (emDados) {
            const fim = buffer.indexOf('\r\n.\r\n');
            if (fim === -1) return;
            if (pending) {
              pending.data = buffer.slice(0, fim);
              sessions.push(pending);
            }
            pending = null;
            buffer = buffer.slice(fim + 5);
            emDados = false;
            socket.write('250 2.0.0 Ok: queued\r\n');
            continue;
          }

          const quebra = buffer.indexOf('\r\n');
          if (quebra === -1) return;
          const linha = buffer.slice(0, quebra);
          buffer = buffer.slice(quebra + 2);
          const comando = linha.toUpperCase();
          const entreChevrons = () => {
            const ini = linha.indexOf('<');
            const fim = linha.lastIndexOf('>');
            return ini >= 0 && fim > ini ? linha.slice(ini + 1, fim) : linha;
          };

          if (comando.startsWith('EHLO') || comando.startsWith('HELO')) {
            socket.write('250-fake.local\r\n250-PIPELINING\r\n250 SIZE 10485760\r\n');
          } else if (comando.startsWith('MAIL FROM')) {
            pending = { from: entreChevrons(), to: [], data: '' };
            socket.write('250 2.1.0 Ok\r\n');
          } else if (comando.startsWith('RCPT TO')) {
            pending?.to.push(entreChevrons());
            socket.write('250 2.1.5 Ok\r\n');
          } else if (comando.startsWith('DATA')) {
            emDados = true;
            socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
          } else if (comando.startsWith('QUIT')) {
            socket.write('221 2.0.0 Bye\r\n');
            socket.end();
          } else if (comando.startsWith('RSET')) {
            pending = null;
            socket.write('250 2.0.0 Ok\r\n');
          } else {
            socket.write('250 2.0.0 Ok\r\n');
          }
        }
      },
      close() {},
      error() {},
    },
  });

  return {
    server,
    sessions,
    ultima(): SmtpSession {
      const ultimaSessao = sessions[sessions.length - 1];
      if (!ultimaSessao) throw new Error('Nenhuma mensagem SMTP capturada');
      return ultimaSessao;
    },
  };
}

let fake: ReturnType<typeof startFakeSmtp>;
const smtpOriginal = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  from: process.env.MAIL_FROM,
};

function restaurarEnv(nome: string, valor: string | undefined) {
  if (valor === undefined) delete process.env[nome];
  else process.env[nome] = valor;
}

beforeAll(() => {
  fake = startFakeSmtp();
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String(fake.server.port);
  process.env.MAIL_FROM = 'no-reply@teste.local';
});

afterAll(() => {
  fake.server.stop(true);
  restaurarEnv('SMTP_HOST', smtpOriginal.host);
  restaurarEnv('SMTP_PORT', smtpOriginal.port);
  restaurarEnv('MAIL_FROM', smtpOriginal.from);
});

describe('Mailer: composição, templates e degradação', () => {
  test('envia html e respeita o envelope (from/to/subject)', async () => {
    const antes = fake.sessions.length;
    const resultado = await sendMail({
      to: 'aluno.mailer@example.com',
      subject: 'Prova de envio',
      html: '<p>Corpo do email de teste</p>',
    });

    expect(resultado.success).toBe(true);
    expect(resultado.message).toBe('Email enviado com sucesso');
    expect(fake.sessions.length).toBe(antes + 1);
    const sessao = fake.ultima();
    expect(sessao.from).toBe('no-reply@teste.local');
    expect(sessao.to).toContain('aluno.mailer@example.com');
    expect(sessao.data).toContain('Subject: Prova de envio');
    expect(sessao.data).toContain('Corpo do email de teste');
  });

  test('renderiza template real substituindo variáveis e escapando HTML', async () => {
    const resultado = await sendMail({
      to: 'aluno.template@example.com',
      subject: 'Feedback da turma',
      template: 'envio_atividades.html',
      variables: {
        from_name: 'Escola de Teste',
        turma: 'Turma A',
        tema: 'Redes',
        mensagem: '<script>alert(1)</script>',
      },
    });

    expect(resultado.success).toBe(true);
    const corpo = fake.ultima().data.replace(/=\r\n/g, '');
    expect(corpo).toContain('Escola de Teste');
    expect(corpo).toContain('Turma A');
    expect(corpo).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(corpo).not.toContain('<script>alert(1)');
    expect(corpo).not.toContain('{{mensagem}}');
  });

  test('rejeita nome de template com travessia de diretório sem lançar', async () => {
    const resultado = await sendMail({
      to: 'aluno.traversal@example.com',
      subject: 'Tentativa',
      template: '../../etc/passwd',
    });

    expect(resultado.success).toBe(false);
    expect(resultado.message).toContain('Invalid template name');
  });

  test('resolve com erro quando o template não existe', async () => {
    const resultado = await sendMail({
      to: 'aluno.semtpl@example.com',
      subject: 'Sem template',
      template: 'template_que_nao_existe.html',
    });

    expect(resultado.success).toBe(false);
    expect(resultado.message).toContain('Template file not found');
  });

  test('sem SMTP configurado degrada sem lançar', async () => {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;

    try {
      const resultado = await sendMail({
        to: 'aluno.semsmtp@example.com',
        subject: 'Sem SMTP',
        html: '<p>não deve sair</p>',
      });
      expect(resultado.success).toBe(false);
      expect(resultado.message).toContain('SMTP não configurado');
    } finally {
      restaurarEnv('SMTP_HOST', host);
      restaurarEnv('SMTP_PORT', port);
    }
  });

  test('falha de transporte SMTP resolve com success false sem lançar', async () => {
    const sonda = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data() {} } });
    const portaFechada = sonda.port;
    sonda.stop(true);

    const hostAnterior = process.env.SMTP_HOST;
    const portaAnterior = process.env.SMTP_PORT;
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = String(portaFechada);

    try {
      const resultado = await sendMail({
        to: 'aluno.transporte@example.com',
        subject: 'SMTP caído',
        html: '<p>não deve sair</p>',
      });
      expect(resultado.success).toBe(false);
      expect(resultado.message).toContain('Erro ao enviar email');
    } finally {
      restaurarEnv('SMTP_HOST', hostAnterior);
      restaurarEnv('SMTP_PORT', portaAnterior);
    }
  });
});

describe('Rotas que disparam e-mail', () => {
  let admin = '';
  let dono = { id: 0, token: '' };
  let intruso = { id: 0, token: '' };
  let cursoId = 0;
  let discId = 0;
  let atvId = 0;
  let respostaId = 0;

  beforeAll(async () => {
    admin = await adminToken();
    const donoProf = await createProfessor(admin);
    const intrusoProf = await createProfessor(admin);
    dono = { id: donoProf.id, token: donoProf.token };
    intruso = { id: intrusoProf.id, token: intrusoProf.token };

    const curso = await createCurso(admin);
    cursoId = curso.id;
    await linkProfessorToCurso(admin, dono.id, cursoId);

    discId = (await createDisciplina(dono.token, cursoId)).id;
    atvId = (
      await createAtividade(dono.token, discId, {
        tipo: 'roleta',
        json_data: roletaJson([
          {
            id: 'q1',
            content: 'Quanto é 2 + 2?',
            options: [
              { text: '4', correct: true },
              { text: '5', correct: false },
            ],
          },
        ]),
      })
    ).id;

    const submissao = await app.request(`/atividades/${atvId}/respostas`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        aluno_nome: 'Aluno Email',
        aluno_email: 'aluno.email@example.com',
        respostas: { q1: '4' },
      }),
    });
    expect(submissao.status).toBe(201);
    respostaId = (await readBody(submissao)).id;
  });

  afterAll(async () => {
    await deleteCurso(admin, cursoId);
    await deleteProfessor(admin, dono.id);
    await deleteProfessor(admin, intruso.id);
  });

  test('POST /atividades/:id/rascunhos/enviar-email valida entrada e envia o código', async () => {
    const emailInvalido = await app.request(`/atividades/${atvId}/rascunhos/enviar-email`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email: 'sem-arroba', codigo: 'ABCDEF123456' }),
    });
    expect(emailInvalido.status).toBe(400);

    const semCodigo = await app.request(`/atividades/${atvId}/rascunhos/enviar-email`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email: 'aluno.rascunho@example.com' }),
    });
    expect(semCodigo.status).toBe(400);

    const antes = fake.sessions.length;
    const envio = await app.request(`/atividades/${atvId}/rascunhos/enviar-email`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ email: 'aluno.rascunho@example.com', codigo: 'ABCDEF123456' }),
    });
    expect(envio.status).toBe(200);
    const corpo = await readBody(envio);
    expect(corpo.success).toBe(true);
    expect(fake.sessions.length).toBe(antes + 1);
    expect(fake.ultima().to).toContain('aluno.rascunho@example.com');
    expect(fake.ultima().data).toContain('ABCDEF123456');
  });

  test('envio de feedback em lote: só o professor da disciplina, e só conta o que realmente saiu', async () => {
    const comoIntruso = await app.request(`/disciplinas/${discId}/enviar-emails-feedback`, {
      method: 'POST',
      headers: jsonHeaders(intruso.token),
      body: JSON.stringify({}),
    });
    expect(comoIntruso.status).toBe(403);

    const avaliacao = await app.request(`/respostas/${respostaId}/avaliacao`, {
      method: 'PUT',
      headers: jsonHeaders(dono.token),
      body: JSON.stringify({ nota: 90, feedback: 'Bom trabalho' }),
    });
    expect(avaliacao.status).toBe(200);

    const antes = fake.sessions.length;
    const comSmtp = await app.request(`/disciplinas/${discId}/enviar-emails-feedback`, {
      method: 'POST',
      headers: jsonHeaders(dono.token),
      body: JSON.stringify({}),
    });
    expect(comSmtp.status).toBe(200);
    const comSmtpBody = await readBody(comSmtp);
    expect(comSmtpBody.enviados).toBe(1);
    expect(fake.sessions.length).toBe(antes + 1);
    expect(fake.ultima().to).toContain('aluno.email@example.com');

    const marcada = db
      .query('SELECT enviado_em FROM respostas_alunos WHERE id = ?')
      .get(respostaId) as any;
    expect(marcada.enviado_em).toBeTruthy();

    db.query('UPDATE respostas_alunos SET enviado_em = NULL WHERE id = ?').run(respostaId);

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    let semSmtpBody: any;
    try {
      const semSmtp = await app.request(`/disciplinas/${discId}/enviar-emails-feedback`, {
        method: 'POST',
        headers: jsonHeaders(dono.token),
        body: JSON.stringify({ forcar_reenvio: true }),
      });
      expect(semSmtp.status).toBe(200);
      semSmtpBody = await readBody(semSmtp);
    } finally {
      process.env.SMTP_HOST = host;
      process.env.SMTP_PORT = port;
    }

    expect(semSmtpBody.enviados).toBe(0);
    const naoMarcada = db
      .query('SELECT enviado_em FROM respostas_alunos WHERE id = ?')
      .get(respostaId) as any;
    expect(naoMarcada.enviado_em).toBeNull();
  });

  test('comprovante de resposta: HTML do aluno é sanitizado e o título da questão sai sem tags', async () => {
    const atvComprovante = await createAtividade(dono.token, discId, {
      tipo: 'roleta',
      json_data: roletaJson([
        {
          id: 'q1',
          content: '<p>Analise o <strong>código</strong>:</p>',
          options: [
            { text: '4', correct: true },
            { text: '5', correct: false },
          ],
        },
      ]),
    });
    expect([200, 201]).toContain(atvComprovante.res.status);
    const atvIdComprovante = atvComprovante.id;

    const respostaMaliciosa =
      '<p>Resposta do aluno</p><script>alert("xss")</script>' +
      '<img src=x onerror="alert(1)">' +
      '<pre><code>if (a &lt; b) { console.log("ok"); }</code></pre>';

    const antes = fake.sessions.length;
    const submissao = await app.request(`/atividades/${atvIdComprovante}/respostas`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        aluno_nome: 'Aluno Comprovante',
        aluno_email: 'aluno.comprovante@example.com',
        enviar_email: true,
        respostas: { q1: respostaMaliciosa },
      }),
    });
    expect(submissao.status).toBe(201);

    const esperarSessao = async () => {
      for (let i = 0; i < 100 && fake.sessions.length === antes; i++) {
        await new Promise((r) => setTimeout(r, 50));
      }
      return fake.sessions.length > antes;
    };
    expect(await esperarSessao()).toBe(true);

    const corpo = fake.ultima().data.replace(/=\r\n/g, '');
    expect(fake.ultima().to).toContain('aluno.comprovante@example.com');

    expect(corpo).not.toContain('<script');
    expect(corpo).not.toContain('onerror');
    expect(corpo).not.toContain('alert');

    // Título da questão (content com HTML, sem title) sai como texto, sem tags escapadas
    expect(corpo).toContain('Analise o c');
    expect(corpo).not.toContain('&lt;p&gt;Analise');
    expect(corpo).not.toContain('&lt;strong&gt;');

    // Bloco de código preservado, com entidades escapadas uma única vez
    expect(corpo).toContain('if (a &lt; b)');
    expect(corpo).not.toContain('&amp;lt; b');

    const respostaPersistida = db
      .query('SELECT respostas FROM respostas_alunos WHERE atividade_id = ?')
      .get(atvIdComprovante) as any;
    expect(respostaPersistida.respostas).toBeTruthy();
  });
});
