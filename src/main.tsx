import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { recoverStaleModalLayers } from "./lib/recoverStaleModalLayers";

(window as unknown as { recoverStaleModalLayers: typeof recoverStaleModalLayers }).recoverStaleModalLayers =
  recoverStaleModalLayers;

createRoot(document.getElementById("root")!).render(<App />);
