//! Versioned record of what the user agreed to during onboarding. Bumping
//! [`CURRENT_TERMS_VERSION`] makes onboarding show the responsible-use step
//! again.

use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

pub const CURRENT_TERMS_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsentRecord {
    /// Terms of Service / acceptable-use version the user accepted. 0 = never.
    pub terms_version: u32,
    /// Unix seconds when the user finished onboarding.
    pub completed_at: Option<u64>,
    /// User agreed not to use Lumen where AI help is prohibited.
    pub acceptable_use_ack: bool,
    /// User agreed to tell others when capturing a conversation.
    pub disclosure_ack: bool,
    /// User opted in to system-audio capture (still needs the per-meeting reminder).
    pub system_audio_opt_in: bool,
    /// Meeting-disclosure reminder already shown once (Phase 3 uses this).
    pub meeting_reminder_shown: bool,
}

impl ConsentRecord {
    pub fn onboarding_complete(&self) -> bool {
        self.terms_version >= CURRENT_TERMS_VERSION
            && self.acceptable_use_ack
            && self.disclosure_ack
            && self.completed_at.is_some()
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConsentError {
    #[error("you must accept the responsible-use terms to continue")]
    TermsNotAccepted,
    #[error("io error: {0}")]
    Io(#[from] io::Error),
    #[error("corrupt consent file: {0}")]
    Parse(#[from] serde_json::Error),
}

/// JSON file store in the app's data directory.
pub struct ConsentStore {
    path: PathBuf,
}

impl ConsentStore {
    pub fn new(dir: &Path) -> Self {
        Self { path: dir.join("consent.json") }
    }

    /// Missing or corrupt file means "not onboarded" — never fail open.
    pub fn load(&self) -> ConsentRecord {
        fs::read(&self.path)
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or_default()
    }

    pub fn complete(
        &self,
        acceptable_use_ack: bool,
        disclosure_ack: bool,
        system_audio_opt_in: bool,
        now_unix: u64,
    ) -> Result<ConsentRecord, ConsentError> {
        if !acceptable_use_ack || !disclosure_ack {
            return Err(ConsentError::TermsNotAccepted);
        }
        let mut record = self.load();
        record.terms_version = CURRENT_TERMS_VERSION;
        record.completed_at = Some(now_unix);
        record.acceptable_use_ack = true;
        record.disclosure_ack = true;
        record.system_audio_opt_in = system_audio_opt_in;
        self.save(&record)?;
        Ok(record)
    }

    pub fn save(&self, record: &ConsentRecord) -> Result<(), ConsentError> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        // Write-then-rename so a crash never leaves a half-written file.
        let tmp = self.path.with_extension("json.tmp");
        fs::write(&tmp, serde_json::to_vec_pretty(record)?)?;
        fs::rename(&tmp, &self.path)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("lumen-consent-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn missing_file_is_not_onboarded() {
        let store = ConsentStore::new(&temp_dir("missing"));
        assert!(!store.load().onboarding_complete());
    }

    #[test]
    fn corrupt_file_is_not_onboarded() {
        let dir = temp_dir("corrupt");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("consent.json"), b"{not json").unwrap();
        assert!(!ConsentStore::new(&dir).load().onboarding_complete());
    }

    #[test]
    fn refuses_without_both_acknowledgements() {
        let store = ConsentStore::new(&temp_dir("refuse"));
        assert!(matches!(store.complete(true, false, false, 1), Err(ConsentError::TermsNotAccepted)));
        assert!(matches!(store.complete(false, true, false, 1), Err(ConsentError::TermsNotAccepted)));
        assert!(!store.load().onboarding_complete());
    }

    #[test]
    fn completes_and_persists() {
        let dir = temp_dir("complete");
        let store = ConsentStore::new(&dir);
        store.complete(true, true, true, 1_700_000_000).unwrap();
        let loaded = ConsentStore::new(&dir).load();
        assert!(loaded.onboarding_complete());
        assert!(loaded.system_audio_opt_in);
        assert_eq!(loaded.completed_at, Some(1_700_000_000));
    }

    #[test]
    fn older_terms_version_requires_onboarding_again() {
        let record = ConsentRecord {
            terms_version: CURRENT_TERMS_VERSION - 1,
            completed_at: Some(1),
            acceptable_use_ack: true,
            disclosure_ack: true,
            ..Default::default()
        };
        assert!(!record.onboarding_complete());
    }
}
