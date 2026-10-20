import { useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import UploadForm from "./src/components/UploadForm";
import LoadingView from "./src/components/LoadingView";
import ResultView from "./src/components/ResultView";
import { analyzeListing, findMatches } from "./src/services/api";
import type { Listing, MatchState, QualityResult, Step } from "./src/types";

export default function App() {
  const [step, setStep] = useState<Step>("form");
  const [result, setResult] = useState<QualityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastListing, setLastListing] = useState<Listing | null>(null);
  const [matchState, setMatchState] = useState<MatchState>({ status: "skipped" });
  // Değişince form sıfırlanır (yeni ilan); "Forma dön"de form verisi korunur.
  const [formKey, setFormKey] = useState(0);
  // Geç gelen eşleştirme yanıtı yeni bir ilanın ekranını ezmesin.
  const matchRequestId = useRef(0);

  async function runMatch(listing: Listing, quality: QualityResult) {
    const requestId = ++matchRequestId.current;
    if (!quality.isOrganicByproduct) {
      setMatchState({ status: "skipped" });
      return;
    }
    setMatchState({ status: "loading" });
    try {
      const { radiusKm, matches } = await findMatches(listing, quality);
      if (requestId === matchRequestId.current) setMatchState({ status: "done", radiusKm, matches });
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
    setResult(null);
    setError(null);
    setLastListing(null);
    setMatchState({ status: "skipped" });
    setFormKey((key) => key + 1);
    setStep("form");
  }

  return (
    <View style={styles.container}>
      <View style={[styles.container, step !== "form" && styles.hidden]}>
        <UploadForm key={formKey} onSubmit={runAnalysis} />
      </View>
      {step === "loading" && (
        <LoadingView error={error} onRetry={handleRetry} onBack={handleBackToForm} />
      )}
      {step === "result" && result && lastListing && (
        <ResultView
          result={result}
          listing={lastListing}
          matchState={matchState}
          onRetryMatch={handleRetryMatch}
          onReset={handleReset}
        />
      )}
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  hidden: { display: "none" },
});
