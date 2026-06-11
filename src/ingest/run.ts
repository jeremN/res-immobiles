import { fetchDvf, fetchDpe, fetchAudits } from './sources'
import { geocodeBatch } from './geocode'
import { labelDvfWithDpe, loadCommune } from './load'

// Usage: DATABASE_URL=... pnpm ingest 17300 17
async function main() {
  const [insee, dept] = process.argv.slice(2)
  if (!insee || !dept) throw new Error('usage: ingest <insee> <dept>')

  const dvf = await fetchDvf(insee, dept)
  const dpeRows = await fetchDpe(insee)
  const auditRows = await fetchAudits(insee)

  const distinct = new Map<string, string>()
  for (const d of dvf) distinct.set(d.adresseKey, `${d.adresse} ${d.insee} LA ROCHELLE`)
  const geo = await geocodeBatch([...distinct].map(([key, adresse]) => ({ key, adresse })))
  for (const d of dvf) (d as any).banId = geo.get(d.adresseKey)?.banId ?? null

  const dpeByBan = new Map<string, any[]>()
  for (const r of dpeRows) {
    if (!r.identifiant_ban) continue
    ;(dpeByBan.get(r.identifiant_ban) ?? dpeByBan.set(r.identifiant_ban, []).get(r.identifiant_ban)!).push(r)
  }
  const dvfLabeled = labelDvfWithDpe(dvf, dpeByBan)

  await loadCommune({ insee, dvfLabeled, dpeRows, auditRows })
  console.log(`OK ${insee}: DVF=${dvf.length} DPE=${dpeRows.length} audits=${auditRows.length}`)
  process.exit(0)
}
main()
