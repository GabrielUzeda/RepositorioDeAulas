const filas = new Map<string, Promise<void>>();

export function executarEmFila<T>(chave: string, tarefa: () => Promise<T>): Promise<T> {
  const anterior = filas.get(chave) ?? Promise.resolve();
  const resultado = anterior.then(() => tarefa());
  const proxima = resultado.then(
    () => undefined,
    () => undefined
  );
  filas.set(chave, proxima);
  void proxima.then(() => {
    if (filas.get(chave) === proxima) filas.delete(chave);
  });
  return resultado;
}
