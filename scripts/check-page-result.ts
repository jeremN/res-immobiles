import { geocodeOne } from '../src/ingest/geocode'
import { loadDeps } from '../src/web/loadDeps'
import { buildResult } from '../src/web/result'

const geo = await geocodeOne('8 rue Chaudrier La Rochelle')
if (!geo) throw new Error('geocode KO')
const deps = await loadDeps(geo.citycode, geo.dept)
const r = buildResult(
  { adresse: '8 rue Chaudrier', prix: 430000, surface: 110, classeDpe: 'G', typeLocal: 'Maison', profilAides: 'rose' },
  geo, deps)
console.log(JSON.stringify(r, null, 2))
process.exit(0)
