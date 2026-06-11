import type { Fiche as FicheT } from '../verdict/types'
import type { Classe } from '../regulatory/ruleset'
import { verdictDisplay, positionnementText, euros, confianceText, showDpeBanner } from '../web/fiche-format'

const gris = { color: '#6b7280', fontSize: 13 }
const block = { borderTop: '1px solid #eee', padding: '12px 0' }

export function Fiche({ fiche, classe }: { fiche: FicheT; classe: Classe }) {
  const v = verdictDisplay(fiche.verdict)
  return (
    <div>
      {showDpeBanner(classe) && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 }}>
          Ton DPE date peut-être d'avant 2026. Avec le nouveau coefficient électricité, ta classe a pu s'améliorer sans travaux —{' '}
          <a href="https://observatoire-dpe-audit.ademe.fr/" target="_blank" rel="noreferrer">recalcul gratuit ADEME</a>.
        </div>
      )}

      <div style={block}>
        <div style={gris}>Prix vs marché réel</div>
        <div><b>{euros(fiche.prixM2Demande)}/m²</b> · {positionnementText(fiche.comparable.positionnement)}
          {fiche.comparable.prixM2Median != null && <> (médian {euros(fiche.comparable.prixM2Median)}/m²)</>}</div>
        <div style={gris}>{confianceText(fiche.comparable.confiance, 'ventes')}</div>
      </div>

      <div style={block}>
        <div style={gris}>Décote verte (zone)</div>
        <div>Classe actuelle {euros(fiche.decote.prixM2ClasseActuelle)}/m² · cible D {euros(fiche.decote.prixM2ClasseCible)}/m²</div>
        <div style={gris}>{confianceText(fiche.decote.confiance, 'ventes')}</div>
      </div>

      <div style={block}>
        <div style={gris}>Coût mise en conformité → D <span style={gris}>(estimation, pas un devis)</span></div>
        <div><b>{euros(fiche.cout.median)}</b> · fourchette {euros(fiche.cout.p25)}–{euros(fiche.cout.p75)}</div>
        <div style={gris}>{confianceText(fiche.cout.confiance, 'audits')}</div>
      </div>

      <div style={block}>
        <div style={gris}>Échéance & aides</div>
        <div>{fiche.echeance.dateInterdiction
          ? `Location ${fiche.echeance.enVigueur ? 'interdite depuis' : 'interdite à partir du'} ${fiche.echeance.dateInterdiction}`
          : "Pas d’échéance d’interdiction"}</div>
        <div>Aides estimées : {euros(fiche.aides.montant)}</div>
      </div>

      <div style={{ background: v.color + '18', border: `1px solid ${v.color}`, borderRadius: 8, padding: 14, marginTop: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: v.color }}>{v.label}</div>
        {fiche.margePotentielle != null
          ? <div style={{ fontSize: 18, fontWeight: 700 }}>marge ~ {euros(fiche.margePotentielle)}</div>
          : <div style={gris}>Pas assez de comparables de cette classe pour conclure sur la marge.</div>}
        <div style={gris}>valeur après travaux − prix − coût net d'aides</div>
      </div>
    </div>
  )
}
