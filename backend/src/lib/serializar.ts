// Fila em memória por chave: chamadas com a mesma chave rodam uma depois da outra;
// chaves diferentes rodam em paralelo. Vale para um único processo (PM2 fork).

const filas = new Map<string, Promise<unknown>>();

export function serializarPorChave<T>(chave: string, fn: () => Promise<T>): Promise<T> {
  const anterior = filas.get(chave) ?? Promise.resolve();
  const atual = anterior.catch(() => {}).then(fn);
  const cauda = atual.catch(() => {});
  filas.set(chave, cauda);
  // Libera a entrada do Map quando esta for a última da fila.
  cauda.finally(() => { if (filas.get(chave) === cauda) filas.delete(chave); });
  return atual;
}

/** Só para testes. */
export function tamanhoFilas() { return filas.size; }
