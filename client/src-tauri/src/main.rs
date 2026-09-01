// Windows: don't spawn a console window alongside the GUI app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    code_butler_lib::run();
}
