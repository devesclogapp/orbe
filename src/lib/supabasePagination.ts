export interface SupabasePageResponse<T> {
  data: T[] | null;
  error: any;
  status?: number;
}

export interface FetchAllPagesOptions {
  pageSize?: number;
  maxPages?: number;
  dedupeById?: boolean;
}

const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_MAX_PAGES = 100;

/**
 * Executes a paginated Supabase/PostgREST query using `.range(from, to)` until all rows are fetched.
 * Returns `{ data, error, status }` so callers can either throw directly or pass to `safeData`.
 * Never returns partial data if an intermediate page fails.
 */
export async function fetchAllSupabasePagesResult<T = any>(
  buildQuery: () => any,
  options: FetchAllPagesOptions = {},
): Promise<SupabasePageResponse<T>> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const dedupeById = options.dedupeById ?? true;

  const collected: T[] = [];
  const seenIds = new Set<string>();

  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const query = buildQuery();
    const hasRange = typeof query?.range === "function";
    const hasLimit = typeof query?.limit === "function";

    const response = hasRange
      ? await query.range(from, to)
      : hasLimit && typeof query?.then !== "function"
        ? await query.limit(pageSize)
        : await query;

    if (response?.error) {
      return {
        data: null,
        error: response.error,
        status: response.status,
      };
    }

    const pageRows: T[] = Array.isArray(response?.data) ? response.data : [];

    for (const row of pageRows) {
      if (dedupeById && row && typeof row === "object" && "id" in row && (row as any).id != null) {
        const key = String((row as any).id);
        if (seenIds.has(key)) continue;
        seenIds.add(key);
      }
      collected.push(row);
    }

    if (!hasRange || pageRows.length < pageSize) {
      return { data: collected, error: null };
    }
  }

  return {
    data: null,
    error: new Error(
      `Limite de segurança de paginação atingido (${maxPages} páginas / ${maxPages * pageSize} registros).`,
    ),
  };
}

/**
 * Convenience wrapper that throws on any page error and returns `T[]`.
 */
export async function fetchAllSupabasePages<T = any>(
  buildQuery: () => any,
  options: FetchAllPagesOptions = {},
): Promise<T[]> {
  const result = await fetchAllSupabasePagesResult<T>(buildQuery, options);
  if (result.error) {
    throw result.error;
  }
  return result.data ?? [];
}
