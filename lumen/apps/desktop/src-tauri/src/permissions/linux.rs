//! Linux is a stretch goal. Wayland grants screen capture per session through
//! xdg-desktop-portal (the portal shows its own picker each time), and X11 and
//! PulseAudio/PipeWire have no app-level permission, so there is nothing to
//! pre-flight here. Later phases request the portal at capture time.

use lumen_core::permissions::{Permission, PermissionStatus};

pub fn status(_permission: Permission) -> PermissionStatus {
    PermissionStatus::NotApplicable
}

pub fn request(permission: Permission) -> PermissionStatus {
    status(permission)
}

pub fn settings_url(_permission: Permission) -> Option<&'static str> {
    None
}
