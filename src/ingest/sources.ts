import { splitCsvLine } from './geocode'

export interface DvfRow {
  idMutation: string; insee: string; typeLocal: 'Maison' | 'Appartement'
  valeurFonciere: number; surfaceReelle: number; prixM2: number | null
  adresseKey: string; adresse: string
}

export function parseDvfCsv(csv: string): DvfRow[] {
  const lines = csv.trim().split('\n')
  const h = splitCsvLine(lines[0]); const ix = (n: string) => h.indexOf(n)
  const out: DvfRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const f = splitCsvLine(lines[i])
    if (f[ix('nature_mutation')] !== 'Vente') continue
    const t = f[ix('type_local')]
    if (t !== 'Maison' && t !== 'Appartement') continue
    const vf = Number(f[ix('valeur_fonciere')]); const s = Number(f[ix('surface_reelle_bati')])
    const adresse = `${f[ix('adresse_numero')]} ${f[ix('adresse_suffixe')]} ${f[ix('adresse_nom_voie')]}`.replace(/\s+/g, ' ').trim()
    out.push({
      idMutation: f[ix('id_mutation')], insee: f[ix('code_commune')], typeLocal: t,
      valeurFonciere: vf, surfaceReelle: s, prixM2: s > 0 ? vf / s : null,
      adresseKey: `${adresse}|${f[ix('code_postal')]}`, adresse,
    })
  }
  return out
}

const DPE_DS = 'meg-83tjwtg8dyz4vv7h1dqe'
const AUDIT_DS = 'ync2epx48x9azbdnggbygqp0'

export async function fetchDvf(insee: string, dept: string, years = ['2022', '2023', '2024']): Promise<DvfRow[]> {
  const all: DvfRow[] = []
  for (const y of years) {
    const url = `https://geo-dvf.s3.sbg.io.cloud.ovh.net/latest/csv/${y}/communes/${dept}/${insee}.csv`
    const res = await fetch(url)
    if (res.ok) all.push(...parseDvfCsv(await res.text()))
  }
  return all
}

export async function fetchDpe(insee: string): Promise<any[]> {
  const rows: any[] = []
  let url: string | null = `https://data.ademe.fr/data-fair/api/v1/datasets/${DPE_DS}/lines?size=10000&qs=code_insee_ban:${insee}&select=identifiant_ban,etiquette_dpe,type_batiment,surface_habitable_logement,numero_etage_appartement`
  while (url) {
    const d: any = await (await fetch(url)).json()
    rows.push(...(d.results ?? []))
    url = d.next ?? null
  }
  return rows
}

export async function fetchAudits(insee: string): Promise<any[]> {
  const rows: any[] = []
  let url: string | null = `https://data.ademe.fr/data-fair/api/v1/datasets/${AUDIT_DS}/lines?size=1000&qs=code_insee_ban:${insee}&select=couts_cumules_travaux,classe_bilan_dpe,surface_habitable_logement,etape_travaux`
  while (url) {
    const d: any = await (await fetch(url)).json()
    rows.push(...(d.results ?? []))
    url = d.next ?? null
  }
  return rows
}
