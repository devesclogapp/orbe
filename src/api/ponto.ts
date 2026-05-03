// src/api/ponto.ts

/**
 * Point data structure expected from the eventual API.
 * Arrange as needed once API is available.
 */
export interface PontoRecord {
  id: string;
  colaboradorId: string;
  empresaId: string;
  entrada: string; // ISO 8601 datetime
  saida: string;   // ISO 8601 datetime
  jornada: number; // in hours
}

/**
 * Placeholder fetch function. Returns a Promise that rejects until the API is
 * implemented. Keeps the rest of the codebase compiling.
 */
export async function fetchPonto(id: string): Promise<PontoRecord> {
  // TODO: Replace with actual API call once implemented.
  return Promise.reject(new Error("Ponto API not yet implemented"));
}

// Optional list fetch
export async function listPontoByEmpresa(empresaId: string): Promise<PontoRecord[]> {
  return Promise.reject(new Error("Ponto API not yet implemented"));
}
