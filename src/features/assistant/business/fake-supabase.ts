/**
 * Test helper: a stand-in Supabase client that answers each table with canned rows and
 * records every query, so loaders run for real without a database. Filters are recorded,
 * not applied: row security is the database's job and is covered by the SQL test plans.
 */

export type FakeAnswer = { data?: unknown; error?: { message: string; code?: string } | null; count?: number };

export type FakeCall = { table: string; method: string; args: unknown[] };

export function fakeSupabase(answers: Record<string, FakeAnswer | ((call: FakeCall[]) => FakeAnswer)> = {}, rpc: Record<string, FakeAnswer> = {}) {
  const calls: FakeCall[] = [];
  function from(table: string) {
    const own: FakeCall[] = [];
    const record = (method: string, args: unknown[]) => {
      const call = { table, method, args };
      own.push(call);
      calls.push(call);
    };
    const answer = () => {
      const configured = answers[table];
      const value = typeof configured === "function" ? configured(own) : configured ?? {};
      return { data: value.data ?? [], error: value.error ?? null, count: value.count ?? null };
    };
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq", "in", "gte", "lte", "or", "order", "limit", "is", "insert", "update", "delete"]) {
      builder[method] = (...args: unknown[]) => {
        record(method, args);
        return builder;
      };
    }
    const first = () => {
      const { data, error } = answer();
      return { data: Array.isArray(data) ? data[0] ?? null : data, error };
    };
    builder.maybeSingle = async () => first();
    builder.single = async () => first();
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(answer()).then(resolve, reject);
    return builder;
  }
  return {
    calls,
    client: {
      from,
      rpc: async (name: string, args: unknown) => {
        calls.push({ table: `rpc:${name}`, method: "rpc", args: [args] });
        const value = rpc[name] ?? {};
        return { data: value.data ?? null, error: value.error ?? null };
      },
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    },
  };
}
