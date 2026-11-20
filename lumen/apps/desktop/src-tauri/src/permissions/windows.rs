//! Windows 10 (1903+) / 11. Windows.Graphics.Capture needs no grant, only OS
//! support. Desktop (unpackaged) apps never get a microphone prompt; access is
//! governed by the privacy switches, which we read from the consent store.
//! WASAPI loopback needs no permission.

use lumen_core::permissions::{Permission, PermissionStatus};
use windows::Graphics::Capture::GraphicsCaptureSession;
use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
use winreg::RegKey;

const MIC_KEY: &str =
    r"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone";

fn read_value(root: &RegKey, path: &str) -> Option<String> {
    root.open_subkey(path).ok()?.get_value::<String, _>("Value").ok()
}

fn mic_status() -> PermissionStatus {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    // Machine-wide switch (admin / policy).
    if read_value(&hklm, MIC_KEY).as_deref() == Some("Deny") {
        return PermissionStatus::Restricted;
    }
    let user = read_value(&hkcu, MIC_KEY);
    let desktop_apps = read_value(&hkcu, &format!(r"{MIC_KEY}\NonPackaged"));
    if user.as_deref() == Some("Deny") || desktop_apps.as_deref() == Some("Deny") {
        PermissionStatus::Denied
    } else {
        PermissionStatus::Granted
    }
}

fn screen_status() -> PermissionStatus {
    match GraphicsCaptureSession::IsSupported() {
        Ok(true) => PermissionStatus::Granted,
        _ => PermissionStatus::Unsupported,
    }
}

pub fn status(permission: Permission) -> PermissionStatus {
    match permission {
        Permission::ScreenRecording => screen_status(),
        Permission::Microphone => mic_status(),
        Permission::SystemAudio => PermissionStatus::NotApplicable,
    }
}

/// Windows shows no prompt for desktop apps; the UI sends users to Settings.
pub fn request(permission: Permission) -> PermissionStatus {
    status(permission)
}

pub fn settings_url(permission: Permission) -> Option<&'static str> {
    match permission {
        Permission::Microphone => Some("ms-settings:privacy-microphone"),
        Permission::ScreenRecording => Some("ms-settings:privacy-graphicsCaptureProgrammatic"),
        Permission::SystemAudio => None,
    }
}
