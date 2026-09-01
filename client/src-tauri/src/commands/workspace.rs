//! Workspace inspection — turns a user-picked folder into workspace metadata.

use std::path::Path;

use serde::Serialize;

#[derive(Serialize)]
pub struct WorkspaceInfo {
    pub path: String,
    pub name: String,
    pub is_git_repository: bool,
}

#[tauri::command]
pub fn workspace_inspect(path: String) -> Result<WorkspaceInfo, String> {
    let p = Path::new(&path);
    if !p.exists() || !p.is_dir() {
        return Err(format!("{} is not a valid directory.", path));
    }
    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    Ok(WorkspaceInfo {
        is_git_repository: p.join(".git").exists(),
        path,
        name,
    })
}
