// scripts/check-deploy-result.ts
// Parité du chemin couvert (sans réseau pour le store) : geocodeOne + pickDeps(agg dépt) + buildResult.
import { readFileSync } from 'node:fs'
import { geocodeOne } from '../src/ingest/geocode'
import { pickDeps, type DeptAgg } from '../src/web/deptStore'
import { buildResult } from '../src/web/result'

const geo = await geocodeOne('8 rue Chaudrier La Rochelle')
if (!geo) throw new Error('geocode KO')
const agg = JSON.parse(readFileSync(new URL('../public/agg/17.json', import.meta.url), 'utf8')) as DeptAgg
const r = buildResult(
  { adresse: '8 rue Chaudrier', prix: 430000, surface: 110, classeDpe: 'G', typeLocal: 'Maison', profilAides: 'rose' },
  geo, pickDeps(agg, geo.citycode),
)
console.log(JSON.stringify(r, null, 2))
if (!('couverte' in r) || r.couverte !== true) {
  console.error('ATTENDU couverte:true')
  process.exit(1)
}
process.exit(0)
