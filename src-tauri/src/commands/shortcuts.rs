use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Register the Push-to-Talk shortcut
/// Emits "ptt-pressed" when pressed and "ptt-released" when released
#[tauri::command]
pub async fn register_ptt_shortcut(app: AppHandle, shortcut: String) -> Result<(), String> {
    let shortcut: Shortcut = shortcut.parse().map_err(|e| format!("{}", e))?;

    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _shortcut, event| {
            match event.state() {
                ShortcutState::Pressed => {
                    let _ = app.emit("ptt-pressed", ());
                }
                ShortcutState::Released => {
                    let _ = app.emit("ptt-released", ());
                }
            }
        })
        .map_err(|e| format!("{}", e))?;

    Ok(())
}

/// Register the mute toggle shortcut
/// Emits "toggle-mute" when pressed
#[tauri::command]
pub async fn register_mute_shortcut(app: AppHandle, shortcut: String) -> Result<(), String> {
    let shortcut: Shortcut = shortcut.parse().map_err(|e| format!("{}", e))?;

    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                let _ = app.emit("toggle-mute", ());
            }
        })
        .map_err(|e| format!("{}", e))?;

    Ok(())
}

/// Register the deafen toggle shortcut
/// Emits "toggle-deafen" when pressed
#[tauri::command]
pub async fn register_deafen_shortcut(app: AppHandle, shortcut: String) -> Result<(), String> {
    let shortcut: Shortcut = shortcut.parse().map_err(|e| format!("{}", e))?;

    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                let _ = app.emit("toggle-deafen", ());
            }
        })
        .map_err(|e| format!("{}", e))?;

    Ok(())
}

/// Unregister a specific shortcut
#[tauri::command]
pub async fn unregister_shortcut(app: AppHandle, shortcut: String) -> Result<(), String> {
    let shortcut: Shortcut = shortcut.parse().map_err(|e| format!("{}", e))?;

    app.global_shortcut()
        .unregister(shortcut)
        .map_err(|e| format!("{}", e))?;

    Ok(())
}

/// Unregister all shortcuts
#[tauri::command]
pub async fn unregister_all_shortcuts(app: AppHandle) -> Result<(), String> {
    app.global_shortcut()
        .unregister_all()
        .map_err(|e| format!("{}", e))?;

    Ok(())
}
