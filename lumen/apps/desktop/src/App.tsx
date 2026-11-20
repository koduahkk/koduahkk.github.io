import { useEffect, useState } from "react";
import { ipc } from "./ipc";
import { Onboarding } from "./onboarding/Onboarding";
import { Panel } from "./panel/Panel";
import { onboardingComplete } from "./web/consent";

const readRoute = () => window.location.hash.replace(/^#\/?/, "");

// Each Tauri window loads index.html with its own hash route. On the web
// there may be no hash: send first-time visitors to onboarding.
export function App() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (route !== "") return;
    ipc
      .consentState()
      .then((c) => (window.location.hash = onboardingComplete(c) ? "#/panel" : "#/onboarding"))
      .catch(() => (window.location.hash = "#/onboarding"));
  }, [route]);

  if (route === "onboarding") return <Onboarding />;
  if (route === "panel") return <Panel />;
  return null;
}
