mod commands;

use commands::process::ProcessRegistry;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(ProcessRegistry::default())
        .invoke_handler(tauri::generate_handler![
            commands::fs::fs_read_file,
            commands::fs::fs_write_file,
            commands::fs::fs_list_directory,
            commands::fs::fs_create_directory,
            commands::process::process_execute,
            commands::process::process_terminate,
            commands::git::git_status,
            commands::git::git_diff,
            commands::workspace::workspace_inspect,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Code Butler");
}
