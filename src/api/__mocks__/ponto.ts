// src/api/__mocks__/ponto.ts
// Mock implementation used during tests or when real API not available.
import type { PontoRecord } from '../ponto';

export async function fetchPonto(id: string): Promise<PontoRecord> {
  // Return a deterministic fake record
  return {
    id,
    colaboradorId: '00000000-0000-0000-0000-000000000001',
    empresaId: '11111111-1111-1111-1111-111111111111',
    entrada: new Date('2024-01-01T08:00:00Z').toISOString(),
    saida: new Date('2024-01-01T17:00:00Z').toISOString(),
    jornada: 9,
  };
}

export async function listPontoByEmpresa(empresaId: string): Promise<PontoRecord[]> {
  // Return an array with one fake record
  return [await fetchPonto('unique-id')];
}
