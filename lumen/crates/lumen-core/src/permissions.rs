//! The permission model shared by every platform backend and the onboarding UI.

use serde::{Deserialize, Serialize};

/// An OS-level permission Lumen may ask for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Permission {
    /// macOS "Screen & System Audio Recording"; Windows Graphics Capture support.
    ScreenRecording,
    /// Microphone input.
    Microphone,
    /// System audio loopback. On macOS 13+ this is covered by the Screen
    /// Recording grant (ScreenCaptureKit audio); WASAPI loopback on Windows
    /// needs no separate grant. It still has its own consent step because it
    /// records other people.
    SystemAudio,
}

impl Permission {
    pub const ALL: [Permission; 3] = [
        Permission::ScreenRecording,
        Permission::Microphone,
        Permission::SystemAudio,
    ];

    /// Whether onboarding can finish without this permission. Screen
    /// recording is required because every capture mode reads the screen
    /// (Manual and Screen-only need it; Listen uses it for context).
    pub fn is_required(self) -> bool {
        matches!(self, Permission::ScreenRecording)
    }
}

/// Normalised permission status across platforms.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PermissionStatus {
    Granted,
    Denied,
    /// The user has not been asked yet.
    NotDetermined,
    /// Blocked by policy (MDM, parental controls, group policy).
    Restricted,
    /// Granted, but the OS only applies it after the app relaunches
    /// (macOS screen recording behaves this way).
    GrantedNeedsRelaunch,
    /// The platform has no such permission (e.g. loopback audio on Windows).
    NotApplicable,
    /// The capability is not available on this OS/version at all.
    Unsupported,
}

impl PermissionStatus {
    /// Whether Lumen can use the capability right now.
    pub fn is_usable(self) -> bool {
        matches!(self, PermissionStatus::Granted | PermissionStatus::NotApplicable)
    }

    /// Whether the OS will still show a prompt if we ask. If not, the only way
    /// forward is to send the user to System Settings.
    pub fn can_prompt(self) -> bool {
        matches!(self, PermissionStatus::NotDetermined)
    }
}

/// What onboarding needs to know to decide whether the user may continue.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionReport {
    pub permission: Permission,
    pub status: PermissionStatus,
    pub required: bool,
    /// Deep link to the relevant OS settings page, if one exists.
    pub settings_url: Option<String>,
}

/// True when every required permission is usable.
pub fn required_permissions_met(reports: &[PermissionReport]) -> bool {
    Permission::ALL
        .iter()
        .filter(|p| p.is_required())
        .all(|p| {
            reports
                .iter()
                .find(|r| r.permission == *p)
                .is_some_and(|r| r.status.is_usable())
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn report(permission: Permission, status: PermissionStatus) -> PermissionReport {
        PermissionReport { permission, status, required: permission.is_required(), settings_url: None }
    }

    #[test]
    fn only_screen_recording_is_required() {
        assert!(Permission::ScreenRecording.is_required());
        assert!(!Permission::Microphone.is_required());
        assert!(!Permission::SystemAudio.is_required());
    }

    #[test]
    fn usable_statuses() {
        assert!(PermissionStatus::Granted.is_usable());
        assert!(PermissionStatus::NotApplicable.is_usable());
        assert!(!PermissionStatus::GrantedNeedsRelaunch.is_usable());
        assert!(!PermissionStatus::Denied.is_usable());
        assert!(!PermissionStatus::Restricted.is_usable());
    }

    #[test]
    fn only_not_determined_can_prompt() {
        assert!(PermissionStatus::NotDetermined.can_prompt());
        assert!(!PermissionStatus::Denied.can_prompt());
    }

    #[test]
    fn required_met_ignores_optional_permissions() {
        let reports = vec![
            report(Permission::ScreenRecording, PermissionStatus::Granted),
            report(Permission::Microphone, PermissionStatus::Denied),
        ];
        assert!(required_permissions_met(&reports));
    }

    #[test]
    fn required_not_met_when_screen_missing_or_denied() {
        assert!(!required_permissions_met(&[]));
        let reports = vec![report(Permission::ScreenRecording, PermissionStatus::Denied)];
        assert!(!required_permissions_met(&reports));
    }

    #[test]
    fn serialises_camel_case_for_the_ui() {
        let json = serde_json::to_string(&PermissionStatus::GrantedNeedsRelaunch).unwrap();
        assert_eq!(json, "\"grantedNeedsRelaunch\"");
        let json = serde_json::to_string(&Permission::ScreenRecording).unwrap();
        assert_eq!(json, "\"screenRecording\"");
    }
}
