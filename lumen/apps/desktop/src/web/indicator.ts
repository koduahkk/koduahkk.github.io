// Browser port of lumen-core's CaptureIndicator. Same invariant: a capture
// may only start after begin() has rendered the indicator, and the indicator
// stays on until every guard is released.
import type { CaptureSource, IndicatorState } from "../types";

const ORDER: CaptureSource[] = ["screen", "microphone", "systemAudio"];
const TITLE_PREFIX = "● Recording — ";

export interface CaptureGuard {
  readonly source: CaptureSource;
  release(): void;
}

type Listener = (s: IndicatorState) => void;

export class CaptureIndicator {
  private counts = new Map<CaptureSource, number>();
  private listeners = new Set<Listener>();

  state(): IndicatorState {
    const sources = ORDER.filter((s) => (this.counts.get(s) ?? 0) > 0);
    return { active: sources.length > 0, sources };
  }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  begin(source: CaptureSource): CaptureGuard {
    this.counts.set(source, (this.counts.get(source) ?? 0) + 1);
    this.render();
    let released = false;
    return {
      source,
      release: () => {
        if (released) return;
        released = true;
        this.counts.set(source, Math.max(0, (this.counts.get(source) ?? 0) - 1));
        this.render();
      },
    };
  }

  private render() {
    const state = this.state();
    // The tab title is the web's equivalent of the tray icon: visible in the
    // tab strip, the window switcher and to assistive tech.
    if (typeof document !== "undefined") {
      const base = document.title.startsWith(TITLE_PREFIX)
        ? document.title.slice(TITLE_PREFIX.length)
        : document.title;
      document.title = state.active ? TITLE_PREFIX + base : base;
    }
    this.listeners.forEach((l) => l(state));
  }
}

export const indicator = new CaptureIndicator();
