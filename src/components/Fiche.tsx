import type { Fiche as FicheT } from '../verdict/types'
import type { Classe } from '../regulatory/ruleset'
import { verdictDisplay, positionnementText, euros, confianceText, showDpeBanner } from '../web/fiche-format'

const VERDICT_CLASS: Record<FicheT['verdict'], string> = {
  'bonne-affaire': 'verdict--ok',
  correct: 'verdict--correct',
  piege: 'verdict--bad',
  indetermine: '',
}

export function Fiche({ fiche, classe }: { fiche: FicheT; classe: Classe }) {
  const v = verdictDisplay(fiche.verdict)
  return (
    <div>
      {showDpeBanner(classe) && (
        <div className="banner">
          Ton DPE date peut-être d'avant 2026. Avec le nouveau coefficient électricité, ta classe a pu s'améliorer sans travaux —{' '}
          <a href="https://observatoire-dpe-audit.ademe.fr/" target="_blank" rel="noreferrer">recalcul gratuit ADEME</a>.
        </div>
      )}

      <div className="block">
        <div className="block__label">Prix vs marché réel</div>
        <div className="block__value">
          <span className="block__num">{euros(fiche.prixM2Demande)}/m²</span> · {positionnementText(fiche.comparable.positionnement)}
          {fiche.comparable.prixM2Median != null && <> (médian {euros(fiche.comparable.prixM2Median)}/m²)</>}
        </div>
        <div className="block__conf">{confianceText(fiche.comparable.confiance, 'ventes')}</div>
      </div>

      <div className="block">
        <div className="block__label">Décote verte (zone)</div>
        <div className="block__value">Classe actuelle {euros(fiche.decote.prixM2ClasseActuelle)}/m² · cible D {euros(fiche.decote.prixM2ClasseCible)}/m²</div>
        <div className="block__conf">{confianceText(fiche.decote.confiance, 'ventes')}</div>
      </div>

      <div className="block">
        <div className="block__label">Coût mise en conformité → D <span>(estimation, pas un devis)</span></div>
        <div className="block__value"><span className="block__num">{euros(fiche.cout.median)}</span> · fourchette {euros(fiche.cout.p25)}–{euros(fiche.cout.p75)}</div>
        <div className="block__conf">{confianceText(fiche.cout.confiance, 'audits')}</div>
      </div>

      <div className="block">
        <div className="block__label">Échéance &amp; aides</div>
        <div className="block__value">{fiche.echeance.dateInterdiction
          ? `Location ${fiche.echeance.enVigueur ? 'interdite depuis' : 'interdite à partir du'} ${fiche.echeance.dateInterdiction}`
          : "Pas d'échéance d'interdiction"}</div>
        <div className="block__value">Aides estimées : {euros(fiche.aides.montant)}</div>
      </div>

      <div className={`verdict ${VERDICT_CLASS[fiche.verdict]}`}>
        <div className="verdict__label">{v.label}</div>
        {fiche.margePotentielle != null
          ? <div className="verdict__marge">marge ~ {euros(fiche.margePotentielle)}</div>
          : <div className="block__conf">Pas assez de comparables de cette classe pour conclure sur la marge.</div>}
        <div className="verdict__formula">valeur après travaux − prix − coût net d'aides</div>
      </div>
    </div>
  )
}
