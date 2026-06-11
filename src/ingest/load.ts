import { db } from '../db/client'
import { dvfMutations, dpeLogements, zoneDecote, coutTravaux } from '../db/schema'
import { computeZoneDecote } from '../verdict/decote'
import { computeCoutTravaux } from '../verdict/cout'

const CHUNK = 500

async function insertChunked<T extends Record<string, unknown>>(table: any, rows: T[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(table).values(rows.slice(i, i + CHUNK))
  }
}

export function labelDvfWithDpe(dvf: any[], dpeByBan: Map<string, any[]>): any[] {
  return dvf.map((d) => {
    const cands = (dpeByBan.get(d.banId) ?? []).filter((x) => x.type_batiment === (d.typeLocal === 'Maison' ? 'maison' : 'appartement') && x.etiquette_dpe)
    if (!cands.length) return { ...d, etiquetteDpe: null }
    const best = cands.reduce((a, b) =>
      Math.abs((b.surface_habitable_logement ?? 0) - d.surfaceReelle) < Math.abs((a.surface_habitable_logement ?? 0) - d.surfaceReelle) ? b : a)
    return { ...d, etiquetteDpe: best.etiquette_dpe }
  })
}

export async function loadCommune(args: {
  insee: string; dvfLabeled: any[]; dpeRows: any[]; auditRows: any[]
}) {
  const dvfValues = args.dvfLabeled.map((d) => ({
    idMutation: d.idMutation, insee: d.insee, banId: d.banId, typeLocal: d.typeLocal,
    valeurFonciere: d.valeurFonciere, surfaceReelle: d.surfaceReelle, prixM2: d.prixM2, etiquetteDpe: d.etiquetteDpe,
  }))
  if (dvfValues.length) await insertChunked(dvfMutations, dvfValues)

  const dpeValues = args.dpeRows.filter((r) => r.identifiant_ban).map((r) => ({
    banId: r.identifiant_ban, insee: args.insee, typeBatiment: r.type_batiment ?? '',
    etiquette: r.etiquette_dpe, surfaceHabitable: r.surface_habitable_logement, etage: r.numero_etage_appartement,
  }))
  if (dpeValues.length) await insertChunked(dpeLogements, dpeValues)

  const decote = computeZoneDecote(args.dvfLabeled.map((d) => ({ insee: d.insee, typeLocal: d.typeLocal, etiquette: d.etiquetteDpe, prixM2: d.prixM2 })))
  if (decote.length) await db.insert(zoneDecote).values(decote)

  const audits = args.auditRows.map((a) => ({ classeBilan: a.classe_bilan_dpe, surface: a.surface_habitable_logement, coutCumule: a.couts_cumules_travaux }))
  const cout = computeCoutTravaux(audits)
  if (cout.length) await db.insert(coutTravaux).values(cout)
}
