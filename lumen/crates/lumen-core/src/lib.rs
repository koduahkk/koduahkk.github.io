//! Lumen core: logic that does not depend on Tauri or any OS API, so it can be
//! unit-tested on every platform. The desktop shell (`apps/desktop/src-tauri`)
//! wires these types to real OS calls.

pub mod consent;
pub mod indicator;
pub mod permissions;
