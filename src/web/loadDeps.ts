import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { zoneDecote, coutTravaux } from '../db/schema'
import type { Deps } from '../verdict/engine'

export async function loadDeps(insee: string, dept: string): Promise<Deps> {
  const zd = await db.select().from(zoneDecote).where(eq(zoneDecote.insee, insee))
  const ct = await db.select().from(coutTravaux).where(eq(coutTravaux.dept, dept))
  return {
    zoneDecote: zd.map((z) => ({ insee: z.insee, typeLocal: z.typeLocal, etiquette: z.etiquette, prixM2Median: z.prixM2Median!, n: z.n })),
    coutTravaux: ct.map((c) => ({ dept: c.dept, classeCible: c.classeCible, trancheSurface: c.trancheSurface, coutMedian: c.coutMedian!, coutP25: c.coutP25!, coutP75: c.coutP75!, n: c.n })),
  }
}
