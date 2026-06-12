import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'
import { geocodeOne } from '../ingest/geocode'
import { fetchDeptAgg, pickDeps } from './deptStore'
import { buildResult, type VerdictFnInput, type VerdictResult } from './result'

export const getVerdictFn = createServerFn({ method: 'POST' })
  .validator((d: VerdictFnInput) => d)
  .handler(async ({ data }): Promise<VerdictResult> => {
    const geo = await geocodeOne(data.adresse)
    if (!geo) return { couverte: false, raison: 'adresse-introuvable' }
    const origin = new URL(getRequestUrl({ xForwardedHost: true })).origin
    const agg = await fetchDeptAgg(origin, geo.dept)
    if (!agg) return { couverte: false, raison: 'hors-zone' }
    return buildResult(data, geo, pickDeps(agg, geo.citycode))
  })
