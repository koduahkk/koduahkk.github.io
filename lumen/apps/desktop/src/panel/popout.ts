// Document Picture-in-Picture (Chrome/Edge 116+): a small always-on-top
// window — the closest the web gets to the desktop floating panel.

interface DocumentPiP {
  requestWindow(opts: { width: number; height: number }): Promise<Window>;
}

const api = (): DocumentPiP | undefined =>
  (window as unknown as { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture;

export const canPopOut = () => !!api();

export async function popOut(): Promise<Window> {
  const w = await api()!.requestWindow({ width: 380, height: 520 });
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = w.document.createElement("style");
      style.textContent = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join("\n");
      w.document.head.append(style);
    } catch {
      if (sheet.href) {
        const link = w.document.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        w.document.head.append(link);
      }
    }
  }
  w.document.title = document.title;
  return w;
}
