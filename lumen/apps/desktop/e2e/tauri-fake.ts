// Installed with page.addInitScript before the app loads. Replaces the Tauri
// IPC bridge with an in-page fake backend so the real UI can be driven in a
// browser. Mirrors the command names in src-tauri/src/commands.rs.
export function installTauriFake() {
  type Cb = (payload: unknown) => void;
  const callbacks = new Map<number, Cb>();
  const listeners = new Map<string, number[]>();
  let nextId = 1;
  const statuses: Record<string, string> = {
    screenRecording: "notDetermined",
    microphone: "notDetermined",
    systemAudio: "notDetermined",
  };
  const calls: Array<{ cmd: string; args: unknown }> = [];

  const handlers: Record<string, (args: any) => unknown> = {
    platform: () => "macos",
    permission_report: () =>
      Object.entries(statuses).map(([permission, status]) => ({
        permission,
        status,
        required: permission === "screenRecording",
        settingsUrl: "x-apple.systempreferences:fake",
      })),
    request_permission: ({ permission }) => {
      statuses[permission] = "granted";
      if (permission === "screenRecording") statuses.systemAudio = "granted";
      return "granted";
    },
    open_permission_settings: () => null,
    relaunch: () => null,
    complete_onboarding: (args) => {
      if (statuses.screenRecording !== "granted") throw "screen recording permission is still needed";
      if (!args.acceptableUseAck || !args.disclosureAck) throw "you must accept the responsible-use terms";
      return { termsVersion: 1, completedAt: 1, ...args, meetingReminderShown: false };
    },
    indicator_state: () => ({ active: false, sources: [] }),
    "plugin:event|listen": ({ event, handler }) => {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
      return handler;
    },
    "plugin:event|unlisten": () => null,
  };

  const w = window as any;
  w.__TAURI_INTERNALS__ = {
    invoke: async (cmd: string, args: unknown) => {
      calls.push({ cmd, args });
      const h = handlers[cmd];
      if (!h) throw `fake: unknown command ${cmd}`;
      return h(args ?? {});
    },
    transformCallback: (cb: Cb) => {
      const id = nextId++;
      callbacks.set(id, cb);
      return id;
    },
    unregisterCallback: (id: number) => callbacks.delete(id),
    metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
  };
  w.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  w.__lumenFake = {
    calls,
    emit(event: string, payload: unknown) {
      for (const id of listeners.get(event) ?? []) callbacks.get(id)?.({ event, id: 0, payload });
    },
  };
}
