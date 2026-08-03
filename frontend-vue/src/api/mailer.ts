import { apiClient } from './client';

export interface EmailOptions {
  to: string;
  subject: string;
  template?: string;
  variables?: Record<string, any>;
  body?: string;
}

export class EmailSender {
  static async sendEmail(options: EmailOptions): Promise<{ success: boolean; message: string }> {
    if (!options.to || !options.subject) {
      return { success: false, message: 'Destinatário e assunto são obrigatórios' };
    }

    try {
      const response = await apiClient.post('/send-mail', {
        to: options.to,
        subject: options.subject,
        template: options.template || 'default.txt',
        variables: options.variables || {},
        body: options.body || ''
      });

      if (response.success) {
        return { success: true, message: 'E-mail enviado com sucesso!' };
      }
      return { success: false, message: response.error || 'Erro ao enviar e-mail' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Falha na conexão com o servidor de e-mail' };
    }
  }

  static async sendActivityResult(
    to: string,
    studentName: string,
    activityTitle: string,
    score: number,
    total: number
  ) {
    return this.sendEmail({
      to,
      subject: `Resultado: ${activityTitle} - ${studentName}`,
      variables: {
        nome: studentName,
        atividade: activityTitle,
        pontuacao: `${score}/${total}`,
        data: new Date().toLocaleDateString('pt-BR')
      },
      body: `Aluno ${studentName} concluiu a atividade ${activityTitle} com pontuação ${score}/${total}.`
    });
  }
}
