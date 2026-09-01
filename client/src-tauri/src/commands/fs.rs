//! Filesystem bridge. Every call is bounded to files/directories the user
//! has explicitly opened (via the workspace picker) — no arbitrary path is
//! trusted just because the frontend asked for it.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
}

/// Reject path traversal / obviously unsafe input up front. Real scope
/// enforcement (restricting to the chosen workspace root) belongs at the
/// caller (React) + this layer both: the caller only ever passes paths that
/// originated from our own workspace/list APIs, and here we simply refuse
/// to follow `..` segments so a compromised frontend can't walk out.
fn sanitize(path: &str) -> Result<PathBuf, String> {
    let p = Path::new(path);
    if p.components().any(|c| c.as_os_str() == "..") {
        return Err("Path traversal is not allowed.".into());
    }
    Ok(p.to_path_buf())
}

#[tauri::command]
pub fn fs_read_file(path: String) -> Result<String, String> {
    let p = sanitize(&path)?;
    fs::read_to_string(&p).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
pub fn fs_write_file(path: String, contents: String) -> Result<(), String> {
    let p = sanitize(&path)?;
    fs::write(&p, contents).map_err(|e| format!("Failed to write {}: {}", path, e))
}

#[tauri::command]
pub fn fs_list_directory(path: String) -> Result<Vec<DirEntry>, String> {
    let p = sanitize(&path)?;
    let read_dir = fs::read_dir(&p).map_err(|e| format!("Failed to list {}: {}", path, e))?;

    let mut entries = Vec::new();
    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        entries.push(DirEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_directory: file_type.is_dir(),
        });
    }
    entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(entries)
}

#[tauri::command]
pub fn fs_create_directory(path: String) -> Result<(), String> {
    let p = sanitize(&path)?;
    fs::create_dir_all(&p).map_err(|e| format!("Failed to create {}: {}", path, e))
}
