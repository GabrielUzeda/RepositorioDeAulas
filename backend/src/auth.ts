import type { Context, Next } from 'hono';

export async function professorAuth(c: Context, next: Next) {
  const authHeader = c.req.header('X-Professor-Password');
  const professorPassword = process.env.PROFESSOR_PASSWORD || 'admin123';
  if (authHeader && authHeader === professorPassword) {
    return next();
  }
  return c.body(null, 401);
}
