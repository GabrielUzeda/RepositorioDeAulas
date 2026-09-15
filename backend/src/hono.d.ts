export {};

declare module 'hono' {
  interface ContextVariableMap {
    professorId: string | number;
    professorRole: string;
  }
}
