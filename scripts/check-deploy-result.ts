// scripts/check-deploy-result.ts
// Reproduit le chemin déployé SANS Postgres : geocodeOne + getDeps + buildResult.
import { geocodeOne } from '../src/ingest/geocode'
import { getDeps } from '../src/web/aggregates'
import { buildResult } from '../src/web/result'

const geo = await geocodeOne('8 rue Chaudrier La Rochelle')
if (!geo) throw new Error('geocode KO')
const deps = getDeps(geo.citycode, geo.dept)
const r = buildResult(
  { adresse: '8 rue Chaudrier', prix: 430000, surface: 110, classeDpe: 'G', typeLocal: 'Maison', profilAides: 'rose' },
  geo, deps,
)
console.log(JSON.stringify(r, null, 2))
if (!('couverte' in r) || r.couverte !== true) {
  console.error('ATTENDU couverte:true — le chemin DB-free ne produit pas de fiche')
  process.exit(1)
}
process.exit(0)
