//! macOS 13+: Screen Recording via CoreGraphics preflight/request (the same
//! TCC grant ScreenCaptureKit uses, including its audio), microphone via
//! AVFoundation.

use lumen_core::permissions::{Permission, PermissionStatus};
use objc2::runtime::Bool;
use objc2_av_foundation::{AVAuthorizationStatus, AVCaptureDevice, AVMediaTypeAudio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::time::Duration;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

/// macOS cannot tell "never asked" from "denied" for screen recording, so we
/// remember whether we asked during this run.
static SCREEN_REQUESTED: AtomicBool = AtomicBool::new(false);

fn screen_status() -> PermissionStatus {
    if unsafe { CGPreflightScreenCaptureAccess() } {
        PermissionStatus::Granted
    } else if SCREEN_REQUESTED.load(Ordering::SeqCst) {
        PermissionStatus::Denied
    } else {
        PermissionStatus::NotDetermined
    }
}

fn mic_status() -> PermissionStatus {
    let Some(media) = (unsafe { AVMediaTypeAudio }) else {
        return PermissionStatus::Unsupported;
    };
    let status = unsafe { AVCaptureDevice::authorizationStatusForMediaType(media) };
    match status {
        AVAuthorizationStatus::Authorized => PermissionStatus::Granted,
        AVAuthorizationStatus::Denied => PermissionStatus::Denied,
        AVAuthorizationStatus::Restricted => PermissionStatus::Restricted,
        AVAuthorizationStatus::NotDetermined => PermissionStatus::NotDetermined,
        _ => PermissionStatus::Unsupported,
    }
}

fn request_mic() -> PermissionStatus {
    let Some(media) = (unsafe { AVMediaTypeAudio }) else {
        return PermissionStatus::Unsupported;
    };
    let (tx, rx) = mpsc::channel::<bool>();
    let handler = block2::RcBlock::new(move |granted: Bool| {
        let _ = tx.send(granted.as_bool());
    });
    unsafe { AVCaptureDevice::requestAccessForMediaType_completionHandler(media, &handler) };
    match rx.recv_timeout(Duration::from_secs(300)) {
        Ok(true) => PermissionStatus::Granted,
        Ok(false) => PermissionStatus::Denied,
        Err(_) => mic_status(),
    }
}

pub fn status(permission: Permission) -> PermissionStatus {
    match permission {
        Permission::ScreenRecording | Permission::SystemAudio => screen_status(),
        Permission::Microphone => mic_status(),
    }
}

pub fn request(permission: Permission) -> PermissionStatus {
    match permission {
        Permission::ScreenRecording | Permission::SystemAudio => {
            SCREEN_REQUESTED.store(true, Ordering::SeqCst);
            // Shows the system prompt the first time; afterwards it is a no-op
            // and the user must use System Settings. A new grant applies only
            // after relaunch, so `true` here is rare on first ask.
            if unsafe { CGRequestScreenCaptureAccess() } {
                PermissionStatus::Granted
            } else {
                PermissionStatus::Denied
            }
        }
        Permission::Microphone => match mic_status() {
            PermissionStatus::NotDetermined => request_mic(),
            other => other,
        },
    }
}

pub fn settings_url(permission: Permission) -> Option<&'static str> {
    Some(match permission {
        Permission::ScreenRecording | Permission::SystemAudio => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
        }
        Permission::Microphone => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
        }
    })
}
