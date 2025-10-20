// Prevents additional console window on Windows in release mode
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod circuit_breaker;
mod protocol;
mod pty;
mod ssh;
mod stream;
mod wasm;

use tauri::Manager;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to rebe-shell.", name)
}

fn main() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::from_default_env())
        .init();

    tauri::Builder::default()
        .setup(|app| {
            tracing::info!("rebe-shell starting");

            #[cfg(debug_assertions)]
            {
                let window = app.get_window("main").unwrap();
                window.open_devtools();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
