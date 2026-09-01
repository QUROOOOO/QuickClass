//! Native process execution. Runs a REAL child process and streams its
//! real stdout/stderr back to the frontend via Tauri events. No output is
//! ever synthesized.

use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Clone)]
pub struct ProcessResult {
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

/// Tracks in-flight child processes so `process_terminate` can kill them.
#[derive(Default)]
pub struct ProcessRegistry(pub Mutex<HashMap<String, Arc<Mutex<std::process::Child>>>>);

// Only a fixed, known-safe set of program binaries can be launched. Arbitrary
// shell strings are never executed — the frontend must pass a program name
// (e.g. "git", "npm", "pytest") plus an argument list, never a shell command.
const ALLOWED_PROGRAMS: &[&str] = &[
    "git", "npm", "npm.cmd", "node", "python", "python3", "pytest", "cargo", "pip", "pip3",
];

#[tauri::command]
pub fn process_execute(
    app: AppHandle,
    registry: State<'_, ProcessRegistry>,
    run_id: String,
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
) -> Result<ProcessResult, String> {
    if !ALLOWED_PROGRAMS.contains(&command.as_str()) {
        return Err(format!(
            "'{}' is not an allowed command. Allowed: {:?}",
            command, ALLOWED_PROGRAMS
        ));
    }

    let mut cmd = Command::new(&command);
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(dir) = &cwd {
        cmd.current_dir(dir);
    }
    if let Some(vars) = &env {
        for (k, v) in vars {
            cmd.env(k, v);
        }
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn '{}': {}", command, e))?;

    let stdout = child.stdout.take().expect("stdout piped");
    let stderr = child.stderr.take().expect("stderr piped");

    registry
        .0
        .lock()
        .unwrap()
        .insert(run_id.clone(), Arc::new(Mutex::new(child)));

    let mut captured_out = String::new();
    let mut captured_err = String::new();

    let out_app = app.clone();
    let out_run_id = run_id.clone();
    let out_thread = std::thread::spawn(move || {
        let mut buf = String::new();
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            buf.push_str(&line);
            buf.push('\n');
            let _ = out_app.emit(&format!("process:{}:stdout", out_run_id), line);
        }
        buf
    });

    let err_app = app.clone();
    let err_run_id = run_id.clone();
    let err_thread = std::thread::spawn(move || {
        let mut buf = String::new();
        let reader = BufReader::new(stderr);
        for line in reader.lines().map_while(Result::ok) {
            buf.push_str(&line);
            buf.push('\n');
            let _ = err_app.emit(&format!("process:{}:stderr", err_run_id), line);
        }
        buf
    });

    captured_out.push_str(&out_thread.join().map_err(|_| "stdout thread panicked")?);
    captured_err.push_str(&err_thread.join().map_err(|_| "stderr thread panicked")?);

    let child_arc = registry.0.lock().unwrap().remove(&run_id);
    let exit_code = if let Some(child_arc) = child_arc {
        let mut guard = child_arc.lock().unwrap();
        guard.wait().ok().and_then(|s| s.code())
    } else {
        None
    };

    Ok(ProcessResult {
        exit_code,
        stdout: captured_out,
        stderr: captured_err,
    })
}

#[tauri::command]
pub fn process_terminate(registry: State<'_, ProcessRegistry>, run_id: String) -> Result<(), String> {
    let map = registry.0.lock().unwrap();
    if let Some(child_arc) = map.get(&run_id) {
        let mut child = child_arc.lock().unwrap();
        child.kill().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("No running process with id {}", run_id))
    }
}
