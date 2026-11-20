mod commands;
mod permissions;
mod tray;

use lumen_core::consent::ConsentStore;
use lumen_core::indicator::CaptureIndicator;
use std::sync::Arc;
use tauri::Manager;

pub struct AppState {
    pub consent: ConsentStore,
    pub indicator: CaptureIndicator,
}

pub const ONBOARDING_WINDOW: &str = "onboarding";
pub const PANEL_WINDOW: &str = "panel";

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            // The tray icon is the persistent capture indicator. If it cannot
            // be created the app still runs, but CaptureIndicator::begin will
            // refuse to start any capture.
            if let Err(e) = tray::create(&handle) {
                eprintln!("lumen: tray unavailable, capture disabled: {e}");
            }
            let consent = ConsentStore::new(&app.path().app_data_dir()?);
            let indicator = CaptureIndicator::new(Arc::new(tray::TraySink::new(handle.clone())));
            let onboarded = consent.load().onboarding_complete();
            app.manage(AppState { consent, indicator });

            let first = if onboarded { PANEL_WINDOW } else { ONBOARDING_WINDOW };
            if let Some(window) = app.get_webview_window(first) {
                window.show()?;
                window.set_focus()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::platform,
            commands::permission_report,
            commands::request_permission,
            commands::open_permission_settings,
            commands::consent_state,
            commands::complete_onboarding,
            commands::indicator_state,
            commands::relaunch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lumen");
}
