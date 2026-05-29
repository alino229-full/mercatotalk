import { useEffect, useState } from 'react';
import { getDailyPhrase, saveDailyPhrase, type DailyPhrase } from '@/database/italpro-local-db';
import { getExpoApiBaseUrl } from '@/services/api-base-url';

// ─── Context rotation ─────────────────────────────────────────────────────────

const CONTEXTS: { context: string; contextEmoji: string }[] = [
  { context: 'Accroche téléphonique', contextEmoji: '📞' },
  { context: 'Objection commerciale', contextEmoji: '🛡' },
  { context: 'Politesse formelle Lei', contextEmoji: '🤝' },
  { context: 'Closing commercial', contextEmoji: '✅' },
  { context: 'Question de qualification', contextEmoji: '🔍' },
  { context: 'Négociation', contextEmoji: '⚖' },
  { context: 'Livraison et délais', contextEmoji: '🚚' },
  { context: 'Technique container standard', contextEmoji: '📦' },
  { context: 'Email professionnel', contextEmoji: '✉' },
  { context: 'Prise de congé', contextEmoji: '👋' },
  { context: 'Rassurer le client', contextEmoji: '🛡' },
  { context: 'Urgence et réactivité', contextEmoji: '⚡' },
  { context: 'Expression italienne', contextEmoji: '🇮🇹' },
  { context: 'Container piscine', contextEmoji: '🏊' },
  { context: 'Container habitable', contextEmoji: '🏠' },
  { context: 'Container frigorifique', contextEmoji: '❄' },
  { context: 'Relance commerciale', contextEmoji: '🔁' },
];

// ─── Fallback local pool (une phrase par contexte, même ordre) ────────────────

const FALLBACK_POOL: Omit<DailyPhrase, 'date'>[] = [
  { context: 'Accroche téléphonique', contextEmoji: '📞', it: 'Buongiorno, sono Pierre di MercatoTalk. Le disturbo un momento?', fr: 'Bonjour, je suis Pierre de MercatoTalk. Je vous dérange un instant ?', phonetic: '[bwon-djor-no, so-no Pierre di MercatoTalk. Le dis-tur-bo un mo-men-to]' },
  { context: 'Objection commerciale', contextEmoji: '🛡', it: 'Capisco la Sua obiezione. Possiamo trovare una soluzione insieme.', fr: 'Je comprends votre objection. Nous pouvons trouver une solution ensemble.', phonetic: '[ka-pi-sko la sua ob-biet-tsio-ne. pos-sia-mo tro-va-re u-na so-lu-tsio-ne]' },
  { context: 'Politesse formelle Lei', contextEmoji: '🤝', it: 'Grazie per il Suo tempo, è stato un piacere parlare con Lei.', fr: 'Merci pour votre temps, c\'était un plaisir de vous parler.', phonetic: '[gra-tsie per il suo tem-po, è sta-to un pia-che-re par-la-re kon lei]' },
  { context: 'Closing commercial', contextEmoji: '✅', it: 'Posso inviarLe il preventivo oggi stesso?', fr: 'Puis-je vous envoyer le devis aujourd\'hui même ?', phonetic: '[pos-so in-via-re-le il pre-ven-ti-vo od-ji stes-so]' },
  { context: 'Question de qualification', contextEmoji: '🔍', it: 'Di cosa ha bisogno esattamente per il Suo progetto?', fr: 'De quoi avez-vous exactement besoin pour votre projet ?', phonetic: '[di ko-za ha bi-zo-nyo e-sat-ta-men-te per il suo pro-jet-to]' },
  { context: 'Négociation', contextEmoji: '⚖', it: 'Siamo aperti alla trattativa e vogliamo venirLe incontro.', fr: 'Nous sommes ouverts à la négociation et voulons aller dans votre sens.', phonetic: '[sia-mo a-per-ti al-la trat-ta-ti-va e vol-ia-mo ve-nir-le in-kon-tro]' },
  { context: 'Livraison et délais', contextEmoji: '🚚', it: 'La consegna è prevista entro 48 ore dalla conferma dell\'ordine.', fr: 'La livraison est prévue sous 48h à compter de la confirmation de commande.', phonetic: '[la kon-se-nya è pre-vis-ta en-tro 48 ore]' },
  { context: 'Technique container standard', contextEmoji: '📦', it: 'Il container è certificato IICL e viene fornito con rapporto di ispezione.', fr: 'Le container est certifié IICL et livré avec rapport d\'inspection.', phonetic: '[il kon-te-ni-to-re è cher-ti-fi-ka-to IICL]' },
  { context: 'Email professionnel', contextEmoji: '✉', it: 'Come da accordi, Le invio in allegato il preventivo richiesto.', fr: 'Comme convenu, je vous envoie ci-joint le devis demandé.', phonetic: '[ko-me da ak-kor-di, le in-vi-o in al-le-ga-to il pre-ven-ti-vo]' },
  { context: 'Prise de congé', contextEmoji: '👋', it: 'La richiamo domani mattina per fare il punto della situazione.', fr: 'Je vous rappelle demain matin pour faire le point.', phonetic: '[la ri-kia-mo do-ma-ni mat-ti-na per fa-re il pun-to]' },
  { context: 'Rassurer le client', contextEmoji: '🛡', it: 'Le garantisco che rispetteremo i tempi concordati. Ha la mia parola.', fr: 'Je vous garantis que nous respecterons les délais convenus. Vous avez ma parole.', phonetic: '[le ga-ran-tis-ko ke ris-pet-te-re-mo i tem-pi kon-kor-da-ti]' },
  { context: 'Urgence et réactivité', contextEmoji: '⚡', it: 'Rispondo entro 24 ore, anche nel fine settimana se è urgente.', fr: 'Je réponds sous 24h, même le week-end si c\'est urgent.', phonetic: '[ris-pon-do en-tro 24 ore, an-ke nel fi-ne set-ti-ma-na]' },
  { context: 'Expression italienne', contextEmoji: '🇮🇹', it: 'Chi trova un amico trova un tesoro — costruiamo un rapporto duraturo.', fr: 'Qui trouve un ami trouve un trésor — construisons une relation durable.', phonetic: '[ki tro-va un a-mi-ko tro-va un te-zo-ro]' },
  { context: 'Container piscine', contextEmoji: '🏊', it: 'Il sistema di nuoto controcorrente è regolabile da 1,5 a 3 kW di potenza.', fr: 'Le système de nage à contre-courant est réglable de 1,5 à 3 kW de puissance.', phonetic: '[il sis-te-ma di nwo-to kon-tro-kor-ren-te è re-go-la-bi-le]' },
  { context: 'Container habitable', contextEmoji: '🏠', it: 'Per un\'installazione temporanea sotto i tre anni basta la CILA asseverata.', fr: 'Pour une installation temporaire de moins de trois ans, seule la CILA asseverata suffit.', phonetic: '[per un in-stal-la-tsio-ne tem-po-ra-ne-a sot-to i tre an-ni bas-ta la CILA]' },
  { context: 'Container frigorifique', contextEmoji: '❄', it: 'Il container frigo è certificato ATP categoria A e conforme alle norme HACCP.', fr: 'Le container frigo est certifié ATP catégorie A et conforme aux normes HACCP.', phonetic: '[il kon-te-ni-to-re fri-go è cher-ti-fi-ka-to ATP ka-te-go-ria A]' },
  { context: 'Relance commerciale', contextEmoji: '🔁', it: 'La ricontatto per sapere se ha avuto il tempo di valutare la nostra proposta.', fr: 'Je vous recontacte pour savoir si vous avez eu le temps d\'évaluer notre proposition.', phonetic: '[la ri-kon-tat-to per sa-pe-re se ha a-vu-to il tem-po di va-lu-ta-re]' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDayContextIndex(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  return dayOfYear % CONTEXTS.length;
}

function getApiBaseUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_ITALPRO_API_URL ?? process.env.EXPO_PUBLIC_ITALPRO_AI_URL;
  return getExpoApiBaseUrl(url);
}

async function fetchPhraseFromApi(
  context: string,
  contextEmoji: string,
  date: string,
): Promise<DailyPhrase | null> {
  const base = getApiBaseUrl();
  if (!base) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`${base}/daily-phrase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, contextEmoji, date }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    return (await response.json()) as DailyPhrase;
  } catch {
    return null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type DailyPhraseState = {
  phrase: DailyPhrase | null;
  isLoading: boolean;
  isAiGenerated: boolean;
};

export function useDailyPhrase(): DailyPhraseState {
  const [state, setState] = useState<DailyPhraseState>({
    phrase: null,
    isLoading: true,
    isAiGenerated: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 1 — Cache DB valide pour aujourd'hui
      const cached = await getDailyPhrase();
      if (cached) {
        if (!cancelled) setState({ phrase: cached, isLoading: false, isAiGenerated: true });
        return;
      }

      // 2 — Choisir le contexte du jour (rotation déterministe)
      const idx = getDayContextIndex();
      const { context, contextEmoji } = CONTEXTS[idx]!;
      const today = getTodayString();

      // 3 — Génération IA via API proxy
      const aiPhrase = await fetchPhraseFromApi(context, contextEmoji, today);
      if (aiPhrase && !cancelled) {
        await saveDailyPhrase(aiPhrase);
        setState({ phrase: aiPhrase, isLoading: false, isAiGenerated: true });
        return;
      }

      // 4 — Fallback local déterministe (pas de réseau ou pas de clé)
      if (!cancelled) {
        const base = FALLBACK_POOL[idx % FALLBACK_POOL.length]!;
        const fallback: DailyPhrase = { ...base, date: today };
        await saveDailyPhrase(fallback);
        setState({ phrase: fallback, isLoading: false, isAiGenerated: false });
      }
    }

    load().catch(() => {
      if (!cancelled) setState({ phrase: null, isLoading: false, isAiGenerated: false });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
