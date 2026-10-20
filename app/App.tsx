import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import UploadForm from "./src/components/UploadForm";
import LoadingView from "./src/components/LoadingView";
import ResultView from "./src/components/ResultView";
import { analyzeListing } from "./src/services/api";
import type { Listing, QualityResult, Step } from "./src/types";

export default function App() {
  const [step, setStep] = useState<Step>("form");
  const [result, setResult] = useState<QualityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastListing, setLastListing] = useState<Listing | null>(null);
  // Değişince form sıfırlanır (yeni ilan); "Forma dön"de form verisi korunur.
  const [formKey, setFormKey] = useState(0);

  async function runAnalysis(listing: Listing) {
    setLastListing(listing);
    setError(null);
    setStep("loading");
    try {
      const quality = await analyzeListing(listing);
      setResult(quality);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.");
    }
  }

  function handleRetry() {
    if (lastListing) runAnalysis(lastListing);
  }

  function handleBackToForm() {
    setError(null);
    setStep("form");
  }

  function handleReset() {
    setResult(null);
    setError(null);
    setLastListing(null);
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
      {step === "result" && result && <ResultView result={result} onReset={handleReset} />}
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  hidden: { display: "none" },
});
