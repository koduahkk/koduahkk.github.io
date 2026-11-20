//! IPC commands exposed to the web UI. Keep these thin: logic lives in
//! `lumen-core` or the platform `permissions` module.

use crate::{permissions, AppState, ONBOARDING_WINDOW, PANEL_WINDOW};
use lumen_core::consent::ConsentRecord;
use lumen_core::indicator::IndicatorState;
use lumen_core::permissions::{Permission, PermissionReport, PermissionStatus};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub fn platform() -> &'static str {
    std::env::consts::OS
}

#[tauri::command]
pub fn permission_report() -> Vec<PermissionReport> {
    permissions::report()
}

#[tauri::command]
pub async fn request_permission(permission: Permission) -> Result<PermissionStatus, String> {
    // Native prompts can block until the user answers; keep them off the IPC thread.
    tauri::async_runtime::spawn_blocking(move || permissions::request(permission))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_permission_settings(app: AppHandle, permission: Permission) -> Result<(), String> {
    // The URL comes from our own table, never from the web view.
    let url = permissions::settings_url(permission)
        .ok_or_else(|| "this platform has no settings page for that permission".to_string())?;
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn consent_state(state: State<'_, AppState>) -> ConsentRecord {
    state.consent.load()
}

#[tauri::command]
pub fn complete_onboarding(
    app: AppHandle,
    state: State<'_, AppState>,
    acceptable_use_ack: bool,
    disclosure_ack: bool,
    system_audio_opt_in: bool,
) -> Result<ConsentRecord, String> {
    if !lumen_core::permissions::required_permissions_met(&permissions::report()) {
        return Err("screen recording permission is still needed".into());
    }
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let record = state
        .consent
        .complete(acceptable_use_ack, disclosure_ack, system_audio_opt_in, now)
        .map_err(|e| e.to_string())?;

    if let Some(panel) = app.get_webview_window(PANEL_WINDOW) {
        panel.show().map_err(|e| e.to_string())?;
        panel.set_focus().map_err(|e| e.to_string())?;
    }
    if let Some(onboarding) = app.get_webview_window(ONBOARDING_WINDOW) {
        onboarding.hide().map_err(|e| e.to_string())?;
    }
    Ok(record)
}

#[tauri::command]
pub fn indicator_state(state: State<'_, AppState>) -> IndicatorState {
    state.indicator.state()
}

/// macOS applies a new Screen Recording grant only after a relaunch.
#[tauri::command]
pub fn relaunch(app: AppHandle) {
    app.restart();
}
