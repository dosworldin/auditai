/**
 * Type-safe helpers for Supabase queries.
 * Since we don't have auto-generated types, these helpers cast results properly.
 */

/* eslint-disable */

/** Cast a Supabase query result to avoid generic type issues */
export function asQuery<T>(query: any): { data: T[] | null; error: any } {
  return query as { data: T[] | null; error: any };
}

/** Cast a Supabase single query result */
export function asSingle<T>(query: any): { data: T | null; error: any } {
  return query as { data: T | null; error: any };
}

/** Generic insert helper */
export async function supabaseInsert(supabase: any, table: string, data: any, options?: { select?: string }) {
  let query = supabase.from(table).insert(data);
  if (options?.select) {
    query = query.select(options.select);
  }
  return query as { data: any; error: any };
}

/** Generic upsert helper */
export async function supabaseUpsert(supabase: any, table: string, data: any, onConflict?: string) {
  let query = supabase.from(table).upsert(data);
  if (onConflict) {
    query = query.select().single();
  }
  return query as { data: any; error: any };
}

/** Generic update helper */
export function supabaseUpdate(supabase: any, table: string, data: any, filter: { column: string; value: string }) {
  return supabase
    .from(table)
    .update(data)
    .eq(filter.column, filter.value) as { data: any; error: any };
}

/** Generic select with filters */
export function supabaseSelect(
  supabase: any,
  table: string,
  options?: {
    select?: string;
    filters?: Array<{ column: string; value: string | number | boolean }>;
    order?: { column: string; ascending?: boolean };
    limit?: number;
    range?: { from: number; to: number };
  },
) {
  let query = supabase.from(table).select(options?.select ?? "*");

  if (options?.filters) {
    for (const filter of options.filters) {
      query = query.eq(filter.column, filter.value);
    }
  }
  if (options?.order) {
    query = query.order(options.order.column, { ascending: options.order.ascending ?? false });
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.range) {
    query = query.range(options.range.from, options.range.to);
  }

  return query as { data: any[] | null; error: any };
}
