import { Onboarding } from "./onboarding/Onboarding";
import { Panel } from "./panel/Panel";

// Each Tauri window loads index.html with its own hash route.
export function App() {
  const route = window.location.hash.replace(/^#\/?/, "");
  return route === "onboarding" ? <Onboarding /> : <Panel />;
}
