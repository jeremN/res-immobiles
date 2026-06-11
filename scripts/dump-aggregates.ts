// scripts/dump-aggregates.ts
import { writeFileSync } from 'node:fs'
import { loadDeps } from '../src/web/loadDeps'
import { pool } from '../src/db/client'

const INSEE = '17300'
const DEPT = '17'

const deps = await loadDeps(INSEE, DEPT)
await pool.end()
if (deps.zoneDecote.length === 0 || deps.coutTravaux.length === 0) {
  console.error('ERREUR: agrégats vides — Postgres resimmo_dev est-il peuplé ? (pnpm ingest)')
  process.exit(1)
}
const out = { insee: INSEE, dept: DEPT, zoneDecote: deps.zoneDecote, coutTravaux: deps.coutTravaux }
writeFileSync(new URL('../src/web/aggregates.lr.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
console.log(`zoneDecote=${out.zoneDecote.length} coutTravaux=${out.coutTravaux.length}`)
process.exit(0)
