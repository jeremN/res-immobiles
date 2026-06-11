import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { parseAnnonce } from '../parse/annonce'
import { getVerdictFn } from '../web/verdict.server'
import { Field } from '../components/Field'
import { Fiche } from '../components/Fiche'
import type { VerdictResult } from '../web/result'
import type { Classe, Profil } from '../regulatory/ruleset'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const [coll, setColl] = useState('')
  const [f, setF] = useState({ adresse: '', prix: '', surface: '', classeDpe: '', typeLocal: 'Maison', etage: '', profil: 'rose' })
  const [res, setRes] = useState<VerdictResult | null>(null)
  const [loading, setLoading] = useState(false)
  const set = (k: string) => (v: string) => setF((s) => ({ ...s, [k]: v }))

  function analyser() {
    const p = parseAnnonce(coll)
    setF((s) => ({ ...s,
      adresse: p.adresse ?? s.adresse, prix: p.prix?.toString() ?? s.prix,
      surface: p.surface?.toString() ?? s.surface, classeDpe: p.classeDpe ?? s.classeDpe,
      typeLocal: p.typeLocal ?? s.typeLocal, etage: p.etage ?? s.etage }))
  }

  async function verdict() {
    setLoading(true)
    const r = await getVerdictFn({ data: {
      adresse: f.adresse, prix: Number(f.prix), surface: Number(f.surface),
      classeDpe: f.classeDpe as Classe, typeLocal: f.typeLocal as 'Maison' | 'Appartement',
      profilAides: f.profil as Profil, etage: f.etage || undefined } })
    setRes(r); setLoading(false)
  }

  return (
    <main>
      <h1>Bonne affaire ou piège&nbsp;?</h1>
      <p style={{ color: '#6b7280' }}>Colle une annonce (La Rochelle), vérifie les champs, obtiens le verdict — données publiques uniquement.</p>

      <textarea value={coll} onChange={(e) => setColl(e.target.value)} rows={4}
        placeholder="Colle ton annonce ici…" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
      <button onClick={analyser} style={{ margin: '8px 0' }}>Analyser l'annonce</button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Adresse" value={f.adresse} onChange={set('adresse')} placeholder="8 rue Chaudrier" />
        <Field label="Prix demandé (€)" value={f.prix} onChange={set('prix')} />
        <Field label="Surface (m²)" value={f.surface} onChange={set('surface')} />
        <Field label="Classe DPE (A–G)" value={f.classeDpe} onChange={set('classeDpe')} />
        <Field label="Type (Maison/Appartement)" value={f.typeLocal} onChange={set('typeLocal')} />
        <Field label="Étage (si appart.)" value={f.etage} onChange={set('etage')} />
        <Field label="Profil revenus (bleu/jaune/violet/rose)" value={f.profil} onChange={set('profil')} />
      </div>
      <button onClick={verdict} disabled={loading} style={{ marginTop: 12, fontSize: 16, padding: '8px 16px' }}>
        {loading ? '…' : 'Obtenir le verdict'}</button>

      {res && (res.couverte
        ? <div style={{ marginTop: 20 }}><Fiche fiche={res.fiche} classe={f.classeDpe as Classe} /></div>
        : <p style={{ marginTop: 20, color: '#dc2626' }}>
            {res.raison === 'hors-zone' ? "Cette commune n'est pas encore couverte (lancement : La Rochelle)." : "Adresse non reconnue, vérifie-la."}</p>)}
    </main>
  )
}
