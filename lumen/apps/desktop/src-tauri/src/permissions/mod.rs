//! Platform permission backends behind one interface.

use lumen_core::permissions::{Permission, PermissionReport, PermissionStatus};

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
use macos as platform;

#[cfg(windows)]
mod windows;
#[cfg(windows)]
use self::windows as platform;

#[cfg(not(any(target_os = "macos", windows)))]
mod linux;
#[cfg(not(any(target_os = "macos", windows)))]
use linux as platform;

pub fn status(permission: Permission) -> PermissionStatus {
    platform::status(permission)
}

/// Trigger the OS prompt where one exists; returns the status afterwards.
pub fn request(permission: Permission) -> PermissionStatus {
    platform::request(permission)
}

pub fn settings_url(permission: Permission) -> Option<&'static str> {
    platform::settings_url(permission)
}

pub fn report() -> Vec<PermissionReport> {
    Permission::ALL
        .iter()
        .map(|&permission| PermissionReport {
            permission,
            status: status(permission),
            required: permission.is_required(),
            settings_url: settings_url(permission).map(str::to_string),
        })
        .collect()
}
