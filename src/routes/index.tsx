import { createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { parseAnnonce } from '../parse/annonce'
import { getVerdictFn } from '../web/verdict.fn'
import { Field } from '../components/Field'
import { Segmented } from '../components/Segmented'
import { Fiche } from '../components/Fiche'
import { DPE_CLASSES, TYPES, PROFIL_OPTIONS, validateForm, parseNum, type FormState } from '../web/form'
import type { VerdictResult } from '../web/result'
import type { Classe, Profil } from '../regulatory/ruleset'

export const Route = createFileRoute('/')({ component: Home })

const DPE_OPTS = DPE_CLASSES.map((c) => ({ value: c, label: c }))
const TYPE_OPTS = TYPES.map((t) => ({ value: t, label: t }))

function Home() {
  const [coll, setColl] = useState('')
  const [f, setF] = useState<FormState>({ adresse: '', prix: '', surface: '', classeDpe: '', typeLocal: 'Maison', etage: '', profil: 'rose' })
  const [res, setRes] = useState<VerdictResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState(false)
  const set = (k: keyof FormState) => (v: string) => setF((s) => ({ ...s, [k]: v }))

  const valid = validateForm(f)

  function analyser() {
    const p = parseAnnonce(coll)
    setF((s) => ({ ...s,
      adresse: p.adresse ?? s.adresse, prix: p.prix?.toString() ?? s.prix,
      surface: p.surface?.toString() ?? s.surface, classeDpe: p.classeDpe ?? s.classeDpe,
      typeLocal: p.typeLocal ?? s.typeLocal, etage: p.etage ?? s.etage }))
  }

  async function verdict(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setTouched(true)
    if (!valid.ok) return
    setLoading(true); setErr(null); setRes(null)
    try {
      const r = await getVerdictFn({ data: {
        adresse: f.adresse, prix: parseNum(f.prix)!, surface: parseNum(f.surface)!,
        classeDpe: f.classeDpe as Classe, typeLocal: f.typeLocal as 'Maison' | 'Appartement',
        profilAides: f.profil as Profil, etage: f.etage || undefined } })
      setRes(r)
    } catch {
      setErr('Le service est momentanément indisponible, réessaie dans un instant.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <h1>Bonne affaire ou piège&nbsp;?</h1>
      <p className="subtitle">Colle une annonce (La Rochelle), vérifie les champs, obtiens le verdict — données publiques uniquement.</p>

      <div className="paste">
        <textarea className="input" value={coll} onChange={(e) => setColl(e.target.value)} rows={4} placeholder="Colle ton annonce ici…" />
        <div><button type="button" className="btn btn-ghost" onClick={analyser}>Analyser l'annonce</button></div>
      </div>

      <form className="stack" onSubmit={verdict}>
        <Field label="Adresse" value={f.adresse} onChange={set('adresse')} placeholder="8 rue Chaudrier" error={touched && !valid.fields.adresse} />
        <div className="row">
          <Field label="Prix demandé (€)" value={f.prix} onChange={set('prix')} inputMode="numeric" error={touched && !valid.fields.prix} />
          <Field label="Surface (m²)" value={f.surface} onChange={set('surface')} inputMode="numeric" error={touched && !valid.fields.surface} />
        </div>
        <Segmented legend="Classe DPE" name="dpe" options={DPE_OPTS} value={f.classeDpe} onChange={set('classeDpe')} />
        <div className="row">
          <Segmented legend="Type" name="type" options={TYPE_OPTS} value={f.typeLocal} onChange={set('typeLocal')} />
          {f.typeLocal === 'Appartement' && <Field label="Étage" value={f.etage} onChange={set('etage')} inputMode="numeric" />}
        </div>
        <label className="field">
          <span>Profil de revenus (pour estimer les aides)</span>
          <select className="input" value={f.profil} onChange={(e) => set('profil')(e.target.value)}>
            {PROFIL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <div>
          <button type="submit" className="btn btn-primary" disabled={loading || (touched && !valid.ok)}>
            {loading ? 'Analyse…' : 'Obtenir le verdict'}
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {err && <p className="error">{err}</p>}
        {res && (res.couverte
          ? <div className="fiche"><Fiche fiche={res.fiche} classe={f.classeDpe as Classe} /></div>
          : <p className="error">{res.raison === 'hors-zone'
              ? "Cette commune n'est pas encore couverte (lancement : La Rochelle)."
              : 'Adresse non reconnue, vérifie-la.'}</p>)}
      </div>
    </main>
  )
}
