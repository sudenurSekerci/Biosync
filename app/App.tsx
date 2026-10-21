import { useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import UploadForm, { EMPTY_DRAFT, type FormDraft } from "./src/components/UploadForm";
import LoadingView from "./src/components/LoadingView";
import ResultView from "./src/components/ResultView";
import SessionImpactBar, { EMPTY_SESSION_IMPACT } from "./src/components/SessionImpactBar";
import { analyzeListing, findMatches } from "./src/services/api";
import type {
  Listing,
  Match,
  MatchState,
  Offer,
  QualityResult,
  SessionImpact,
  Step,
} from "./src/types";

// Teklif simülasyonu: "iletildi" → bu süre sonra "kabul edildi (demo)".
const OFFER_ACCEPT_DELAY_MS = 2500;

export default function App() {
  const [step, setStep] = useState<Step>("form");
  const [result, setResult] = useState<QualityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastListing, setLastListing] = useState<Listing | null>(null);
  const [matchState, setMatchState] = useState<MatchState>({ status: "skipped" });
  // Form verisi burada tutulur; "Forma dön"de korunur, "Yeni ilan"da sıfırlanır.
  const [draft, setDraft] = useState<FormDraft>(EMPTY_DRAFT);
  // Geç gelen eşleştirme yanıtı yeni bir ilanın ekranını ezmesin.
  const matchRequestId = useRef(0);
  // Teklif (ilan başına tek) ve oturum etki sayacı (kalıcı değil; "Yeni ilan"da sıfırlanmaz).
  const [offer, setOffer] = useState<Offer | null>(null);
  const [sessionImpact, setSessionImpact] = useState<SessionImpact>(EMPTY_SESSION_IMPACT);
  const offerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearOffer() {
    if (offerTimer.current) clearTimeout(offerTimer.current);
    offerTimer.current = null;
    setOffer(null);
  }

  // Demo: teklif iletilir, birkaç saniye sonra kabul edilir ve oturum sayacına eklenir.
  function handleSendOffer(match: Match) {
    if (!lastListing || offer) return;
    const quantityKg = lastListing.quantityKg;
    setOffer({ buyerId: match.buyer.id, buyerName: match.buyer.name, status: "sent" });
    offerTimer.current = setTimeout(() => {
      offerTimer.current = null;
      setOffer((current) => (current ? { ...current, status: "accepted" } : current));
      setSessionImpact((total) => ({
        acceptedOffers: total.acceptedOffers + 1,
        wasteKg: total.wasteKg + quantityKg,
        netCo2eKg: total.netCo2eKg + match.netImpactCo2eKg,
      }));
    }, OFFER_ACCEPT_DELAY_MS);
  }

  async function runMatch(listing: Listing, quality: QualityResult) {
    const requestId = ++matchRequestId.current;
    if (!quality.isOrganicByproduct) {
      setMatchState({ status: "skipped" });
      return;
    }
    setMatchState({ status: "loading" });
    try {
      const { radiusKm, matches, eliminated } = await findMatches(listing, quality);
      if (requestId === matchRequestId.current) {
        setMatchState({ status: "done", radiusKm, matches, eliminated });
      }
    } catch (err) {
      if (requestId === matchRequestId.current) {
        setMatchState({
          status: "error",
          error: err instanceof Error ? err.message : "Eşleştirme sırasında beklenmeyen bir hata oluştu.",
        });
      }
    }
  }

  async function runAnalysis(listing: Listing) {
    clearOffer();
    setLastListing(listing);
    setError(null);
    setStep("loading");
    try {
      const quality = await analyzeListing(listing);
      setResult(quality);
      setStep("result");
      runMatch(listing, quality);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.");
    }
  }

  function handleRetry() {
    if (lastListing) runAnalysis(lastListing);
  }

  function handleRetryMatch() {
    if (lastListing && result) runMatch(lastListing, result);
  }

  function handleBackToForm() {
    setError(null);
    setStep("form");
  }

  function handleReset() {
    matchRequestId.current++;
    clearOffer();
    setResult(null);
    setError(null);
    setLastListing(null);
    setMatchState({ status: "skipped" });
    setDraft(EMPTY_DRAFT);
    setStep("form");
  }

  function handleDraftChange(patch: Partial<FormDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  return (
    <SafeAreaProvider>
      {/* Güvenli alan: kaydırılan içerik durum çubuğunun / alt çubuğun altına girmez. */}
      <SafeAreaView style={styles.page} edges={["top", "bottom", "left", "right"]}>
        {/* Geniş ekranda (web) ortalanmış en fazla 480 px sütun; dar ekranda tam genişlik. */}
        <View style={styles.column}>
          <SessionImpactBar impact={sessionImpact} />
          {step === "form" && (
            <UploadForm draft={draft} onDraftChange={handleDraftChange} onSubmit={runAnalysis} />
          )}
          {step === "loading" && (
            <LoadingView
              error={error}
              onRetry={handleRetry}
              onBack={handleBackToForm}
              photoUri={draft.photo?.uri ?? null}
            />
          )}
          {step === "result" && result && lastListing && (
            <ResultView
              result={result}
              listing={lastListing}
              matchState={matchState}
              offer={offer}
              onSendOffer={handleSendOffer}
              onRetryMatch={handleRetryMatch}
              onReset={handleReset}
            />
          )}
        </View>
      </SafeAreaView>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const MAX_COLUMN_WIDTH = 480;

const styles = StyleSheet.create({
  // Sütun dışı (yalnız geniş ekranda görünür): nötr gri.
  page: { flex: 1, backgroundColor: Platform.OS === "web" ? "#eef0f2" : "#fff" },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: MAX_COLUMN_WIDTH,
    alignSelf: "center",
    backgroundColor: "#fff",
  },
});
