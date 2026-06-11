import { pgTable, serial, text, integer, doublePrecision, index } from 'drizzle-orm/pg-core'

// Ventes DVF (logements), géocodées BAN
export const dvfMutations = pgTable('dvf_mutations', {
  id: serial('id').primaryKey(),
  idMutation: text('id_mutation').notNull(),
  insee: text('insee').notNull(),
  iris: text('iris'),                       // maille zone (rempli plus tard ; commune en repli)
  banId: text('ban_id'),
  typeLocal: text('type_local').notNull(),  // 'Maison' | 'Appartement'
  valeurFonciere: doublePrecision('valeur_fonciere'),
  surfaceReelle: doublePrecision('surface_reelle'),
  prixM2: doublePrecision('prix_m2'),
  etiquetteDpe: text('etiquette_dpe'),
}, (t) => ({ inseeIdx: index('dvf_insee_idx').on(t.insee) }))

// DPE logements existants (clé BAN + énergie)
export const dpeLogements = pgTable('dpe_logements', {
  id: serial('id').primaryKey(),
  banId: text('ban_id').notNull(),
  insee: text('insee').notNull(),
  typeBatiment: text('type_batiment').notNull(),
  etiquette: text('etiquette'),
  surfaceHabitable: doublePrecision('surface_habitable'),
  etage: text('etage'),
}, (t) => ({ banIdx: index('dpe_ban_idx').on(t.banId) }))

// Agrégat précalculé : décote €/m² par zone × classe × type
export const zoneDecote = pgTable('zone_decote', {
  id: serial('id').primaryKey(),
  insee: text('insee').notNull(),
  typeLocal: text('type_local').notNull(),
  etiquette: text('etiquette').notNull(),
  prixM2Median: doublePrecision('prix_m2_median').notNull(),
  n: integer('n').notNull(),
}, (t) => ({ zIdx: index('zd_idx').on(t.insee, t.typeLocal) }))

// Agrégat précalculé : coût travaux pour atteindre une classe cible
export const coutTravaux = pgTable('cout_travaux', {
  id: serial('id').primaryKey(),
  dept: text('dept').notNull(),
  classeCible: text('classe_cible').notNull(),
  trancheSurface: text('tranche_surface').notNull(),
  coutMedian: doublePrecision('cout_median').notNull(),
  coutP25: doublePrecision('cout_p25').notNull(),
  coutP75: doublePrecision('cout_p75').notNull(),
  n: integer('n').notNull(),
})
