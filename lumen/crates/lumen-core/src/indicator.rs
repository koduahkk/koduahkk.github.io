//! Capture indicator.
//!
//! Invariant: **capture of any source can only happen while the indicator is
//! visible.** Every capture pipeline must hold a [`CaptureGuard`], and the
//! only way to get one is [`CaptureIndicator::begin`], which shows the
//! indicator first and refuses to hand out a guard if showing it failed.
//! Dropping the last guard hides the indicator. Capture code that does not
//! hold a guard should not compile against the capture APIs (later phases take
//! `&CaptureGuard` as a parameter).

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CaptureSource {
    Screen,
    Microphone,
    SystemAudio,
}

/// What the tray icon and the panel badge render.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorState {
    pub active: bool,
    /// Sorted, de-duplicated list of active sources.
    pub sources: Vec<CaptureSource>,
}

impl IndicatorState {
    /// Human-readable text used for the tray tooltip and screen readers.
    pub fn label(&self) -> String {
        if !self.active {
            return "Lumen — not capturing".to_string();
        }
        let names: Vec<&str> = self
            .sources
            .iter()
            .map(|s| match s {
                CaptureSource::Screen => "screen",
                CaptureSource::Microphone => "microphone",
                CaptureSource::SystemAudio => "system audio",
            })
            .collect();
        format!("Lumen — capturing {}", names.join(", "))
    }
}

/// Renders the indicator. Implemented by the tray + panel badge in the app and
/// by a recording fake in tests. `show` must not return `Ok` unless the
/// indicator is actually on screen.
pub trait IndicatorSink: Send + Sync {
    fn render(&self, state: &IndicatorState) -> Result<(), IndicatorError>;
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum IndicatorError {
    #[error("could not display the capture indicator: {0}")]
    DisplayFailed(String),
}

struct Inner {
    counts: BTreeMap<CaptureSource, usize>,
    sink: Arc<dyn IndicatorSink>,
}

impl Inner {
    fn state(&self) -> IndicatorState {
        let sources: Vec<CaptureSource> =
            self.counts.iter().filter(|(_, n)| **n > 0).map(|(s, _)| *s).collect();
        IndicatorState { active: !sources.is_empty(), sources }
    }
}

#[derive(Clone)]
pub struct CaptureIndicator {
    inner: Arc<Mutex<Inner>>,
}

impl CaptureIndicator {
    pub fn new(sink: Arc<dyn IndicatorSink>) -> Self {
        Self { inner: Arc::new(Mutex::new(Inner { counts: BTreeMap::new(), sink })) }
    }

    pub fn state(&self) -> IndicatorState {
        self.inner.lock().expect("indicator lock").state()
    }

    /// Show the indicator for `source` and return a guard. Capture may start
    /// only after this returns `Ok`.
    pub fn begin(&self, source: CaptureSource) -> Result<CaptureGuard, IndicatorError> {
        let mut inner = self.inner.lock().expect("indicator lock");
        *inner.counts.entry(source).or_insert(0) += 1;
        let state = inner.state();
        if let Err(e) = inner.sink.render(&state) {
            // Roll back: we never capture without a visible indicator.
            if let Some(n) = inner.counts.get_mut(&source) {
                *n -= 1;
            }
            let rolled_back = inner.state();
            let _ = inner.sink.render(&rolled_back);
            return Err(e);
        }
        Ok(CaptureGuard { indicator: self.clone(), source })
    }

    fn end(&self, source: CaptureSource) {
        let mut inner = self.inner.lock().expect("indicator lock");
        if let Some(n) = inner.counts.get_mut(&source) {
            *n = n.saturating_sub(1);
        }
        let state = inner.state();
        // Hiding can fail harmlessly (worst case the indicator stays on longer).
        let _ = inner.sink.render(&state);
    }
}

/// Proof that the indicator is visible for `source`. Stop capturing before
/// dropping it.
#[must_use = "capture must stop when the guard is dropped"]
pub struct CaptureGuard {
    indicator: CaptureIndicator,
    source: CaptureSource,
}

impl CaptureGuard {
    pub fn source(&self) -> CaptureSource {
        self.source
    }
}

impl Drop for CaptureGuard {
    fn drop(&mut self) {
        self.indicator.end(self.source);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};

    #[derive(Default)]
    struct RecordingSink {
        renders: Mutex<Vec<IndicatorState>>,
        fail: AtomicBool,
    }

    impl IndicatorSink for RecordingSink {
        fn render(&self, state: &IndicatorState) -> Result<(), IndicatorError> {
            if state.active && self.fail.load(Ordering::SeqCst) {
                return Err(IndicatorError::DisplayFailed("tray unavailable".into()));
            }
            self.renders.lock().unwrap().push(state.clone());
            Ok(())
        }
    }

    fn setup() -> (Arc<RecordingSink>, CaptureIndicator) {
        let sink = Arc::new(RecordingSink::default());
        (sink.clone(), CaptureIndicator::new(sink))
    }

    #[test]
    fn indicator_is_rendered_before_guard_is_returned() {
        let (sink, ind) = setup();
        let guard = ind.begin(CaptureSource::Screen).unwrap();
        let last = sink.renders.lock().unwrap().last().cloned().unwrap();
        assert!(last.active);
        assert_eq!(last.sources, vec![CaptureSource::Screen]);
        drop(guard);
    }

    #[test]
    fn dropping_last_guard_hides_indicator() {
        let (sink, ind) = setup();
        let a = ind.begin(CaptureSource::Microphone).unwrap();
        let b = ind.begin(CaptureSource::Microphone).unwrap();
        drop(a);
        assert!(ind.state().active, "still one mic guard alive");
        drop(b);
        assert!(!ind.state().active);
        assert!(!sink.renders.lock().unwrap().last().unwrap().active);
    }

    #[test]
    fn multiple_sources_are_listed_in_stable_order() {
        let (_sink, ind) = setup();
        let _m = ind.begin(CaptureSource::Microphone).unwrap();
        let _s = ind.begin(CaptureSource::Screen).unwrap();
        let state = ind.state();
        assert_eq!(state.sources, vec![CaptureSource::Screen, CaptureSource::Microphone]);
        assert_eq!(state.label(), "Lumen — capturing screen, microphone");
    }

    #[test]
    fn capture_is_refused_when_indicator_cannot_be_shown() {
        let (sink, ind) = setup();
        sink.fail.store(true, Ordering::SeqCst);
        let err = ind.begin(CaptureSource::Screen).err().unwrap();
        assert!(matches!(err, IndicatorError::DisplayFailed(_)));
        assert!(!ind.state().active, "count rolled back");
    }

    #[test]
    fn idle_label() {
        assert_eq!(IndicatorState::default().label(), "Lumen — not capturing");
    }
}
