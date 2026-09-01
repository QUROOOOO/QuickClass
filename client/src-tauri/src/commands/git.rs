//! Git status/diff via the real `git` binary — read-only for now.

use std::path::Path;
use std::process::Command;

use serde::Serialize;

#[derive(Serialize)]
pub struct GitStatus {
    pub branch: Option<String>,
    pub is_repository: bool,
    pub staged: Vec<String>,
    pub unstaged: Vec<String>,
    pub untracked: Vec<String>,
}

fn run_git(dir: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

#[tauri::command]
pub fn git_status(path: String) -> Result<GitStatus, String> {
    if !Path::new(&path).join(".git").exists() {
        return Ok(GitStatus {
            branch: None,
            is_repository: false,
            staged: vec![],
            unstaged: vec![],
            untracked: vec![],
        });
    }

    let branch = run_git(&path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .ok()
        .map(|s| s.trim().to_string());
    let status_out = run_git(&path, &["status", "--porcelain=v1"])?;

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();
    for line in status_out.lines() {
        if line.len() < 3 {
            continue;
        }
        let (code, file) = (&line[0..2], line[3..].to_string());
        if code.starts_with("??") {
            untracked.push(file);
        } else {
            if code.chars().next().map(|c| c != ' ').unwrap_or(false) {
                staged.push(file.clone());
            }
            if code.chars().nth(1).map(|c| c != ' ').unwrap_or(false) {
                unstaged.push(file);
            }
        }
    }

    Ok(GitStatus {
        branch,
        is_repository: true,
        staged,
        unstaged,
        untracked,
    })
}

#[tauri::command]
pub fn git_diff(path: String, file_path: Option<String>) -> Result<String, String> {
    let mut args = vec!["diff"];
    if let Some(f) = &file_path {
        args.push("--");
        args.push(f);
    }
    run_git(&path, &args)
}
