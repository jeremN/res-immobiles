import { db } from '../src/db/client'
import { zoneDecote, coutTravaux } from '../src/db/schema'
import { getVerdict } from '../src/verdict/engine'

const zd = (await db.select().from(zoneDecote)).map((z) => ({ insee: z.insee, typeLocal: z.typeLocal, etiquette: z.etiquette, prixM2Median: z.prixM2Median!, n: z.n }))
const ct = (await db.select().from(coutTravaux)).map((c) => ({ dept: c.dept, classeCible: c.classeCible, trancheSurface: c.trancheSurface, coutMedian: c.coutMedian!, coutP25: c.coutP25!, coutP75: c.coutP75!, n: c.n }))
const fiche = getVerdict({ insee: '17300', typeLocal: 'Maison', surface: 110, prixDemande: 430000, classeDpe: 'G', profilAides: 'rose', classeCible: 'D' }, { zoneDecote: zd, coutTravaux: ct })
console.log(JSON.stringify(fiche, null, 2))
process.exit(0)
