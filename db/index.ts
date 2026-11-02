import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { BatchItem } from "drizzle-orm/batch";
import * as schema from "./schema";

type Db = NeonHttpDatabase<typeof schema>;

let _db: Db | undefined;

function create(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string.");
  }
  return drizzle(neon(url), { schema });
}

/** Lazily created so importing this module never throws during build. */
export const db: Db = new Proxy({} as Db, {
  get(_t, prop, receiver) {
    _db ??= create();
    return Reflect.get(_db, prop, receiver);
  },
});

export type Statement = BatchItem<"pg">;

/** Run statements atomically (Neon HTTP batches execute in one transaction). */
export async function runBatch(statements: Statement[]) {
  if (statements.length === 0) return;
  await db.batch(statements as [Statement, ...Statement[]]);
}

export { schema };
