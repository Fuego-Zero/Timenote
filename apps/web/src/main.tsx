import { createRoot } from "react-dom/client";

import App from "./App.js";
import { nonceRuntimeStyles, readCspNonce } from "./lib/nonce.js";
import "./style.css";

nonceRuntimeStyles(readCspNonce());
createRoot(document.getElementById("root")!).render(<App />);
