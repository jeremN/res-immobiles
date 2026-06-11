import { createServerFn } from '@tanstack/react-start'
import { geocodeOne } from '../ingest/geocode'
import { getDeps } from './aggregates'
import { buildResult, type VerdictFnInput, type VerdictResult } from './result'

export const getVerdictFn = createServerFn({ method: 'POST' })
  .validator((d: VerdictFnInput) => d)
  .handler(async ({ data }): Promise<VerdictResult> => {
    const geo = await geocodeOne(data.adresse)
    if (!geo) return { couverte: false, raison: 'adresse-introuvable' }
    if (geo.citycode !== '17300') return { couverte: false, raison: 'hors-zone' }
    const deps = getDeps(geo.citycode, geo.dept)
    return buildResult(data, geo, deps)
  })
