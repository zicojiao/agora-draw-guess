export type QueryResult<T = Record<string, unknown>> = { results: T[]; meta: { changes: number }; success: boolean }
export class DatabaseStatement {
 constructor(readonly database: GameDatabase, readonly sql: string, readonly params: unknown[] = []) {}
 bind(...params: unknown[]) { return new DatabaseStatement(this.database, this.sql, params) }
 async all<T = Record<string, unknown>>() { return (await this.database.batch([this]))[0] as QueryResult<T> }
 async first<T = Record<string, unknown>>() { return (await this.all<T>()).results[0] ?? null }
 async run() { return (await this.database.batch([this]))[0] }
}
export class GameDatabase {
 prepare(sql: string) { return new DatabaseStatement(this, sql) }
 async batch(statements: DatabaseStatement[]): Promise<QueryResult[]> {
  const endpoint = process.env.DATABASE_SERVICE_URL
  const key = process.env.DATABASE_SERVICE_KEY
  if (!endpoint || !key) throw new Error('Persistent database is not configured')
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/query`, {
   method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
   body: JSON.stringify({statements: statements.map(({sql,params}) => ({sql,params}))}), signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Database request failed (${response.status})`)
  const results = await response.json() as QueryResult[]
  if (!Array.isArray(results) || results.some(r => !r.success)) throw new Error('Database query failed')
  return results
 }
}
