//! Tray / menu-bar icon: the always-visible capture indicator.

use lumen_core::indicator::{IndicatorError, IndicatorSink, IndicatorState};
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager};

pub const TRAY_ID: &str = "lumen-tray";
pub const INDICATOR_EVENT: &str = "indicator://changed";

fn idle_icon() -> tauri::Result<Image<'static>> {
    Image::from_bytes(include_bytes!("../icons/tray-idle.png"))
}

fn active_icon() -> tauri::Result<Image<'static>> {
    Image::from_bytes(include_bytes!("../icons/tray-active.png"))
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Lumen", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Lumen", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(idle_icon()?)
        .icon_as_template(true)
        .tooltip(IndicatorState::default().label())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window(crate::PANEL_WINDOW) {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

/// Renders indicator state to the tray icon and broadcasts it to every window
/// so the panel badge mirrors it.
pub struct TraySink {
    app: AppHandle,
}

impl TraySink {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

fn failed(e: impl std::fmt::Display) -> IndicatorError {
    IndicatorError::DisplayFailed(e.to_string())
}

impl IndicatorSink for TraySink {
    fn render(&self, state: &IndicatorState) -> Result<(), IndicatorError> {
        let tray = self.app.tray_by_id(TRAY_ID).ok_or_else(|| failed("tray icon missing"))?;
        let icon = if state.active { active_icon() } else { idle_icon() }.map_err(failed)?;
        tray.set_icon(Some(icon)).map_err(failed)?;
        // Template icons are monochrome; the active icon must keep its red dot.
        tray.set_icon_as_template(!state.active).map_err(failed)?;
        tray.set_tooltip(Some(state.label())).map_err(failed)?;
        #[cfg(target_os = "macos")]
        tray.set_title(if state.active { Some("REC") } else { None }).map_err(failed)?;
        self.app.emit(INDICATOR_EVENT, state).map_err(failed)?;
        Ok(())
    }
}
