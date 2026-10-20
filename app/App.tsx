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

  async function handleSubmit(listing: Listing) {
    setStep("loading");
    const quality = await analyzeListing(listing);
    setResult(quality);
    setStep("result");
  }

  function handleReset() {
    setResult(null);
    setStep("form");
  }

  return (
    <View style={styles.container}>
      {step === "form" && <UploadForm onSubmit={handleSubmit} />}
      {step === "loading" && <LoadingView />}
      {step === "result" && result && <ResultView result={result} onReset={handleReset} />}
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
});
