// The one module components use to reach the backend, so tests mock one file.
// The desktop app (Tauri) injects __TAURI_INTERNALS__ before any script runs;
// anywhere else we are the web app and use browser APIs.
import { tauriIpc } from "./ipc.tauri";
import { webIpc } from "./web/ipc.web";
import type { Ipc } from "./types";

export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const ipc: Ipc = isTauri() ? tauriIpc : webIpc;
