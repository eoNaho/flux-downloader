// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandEvent, CommandChild};
use tauri::Emitter;
use tauri::Manager;
use base64::Engine;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AppState {
    pub active_downloads: Arc<Mutex<HashMap<String, CommandChild>>>,
}

fn get_ytdlp_command(app: &tauri::AppHandle) -> Result<tauri_plugin_shell::process::Command, String> {
    let mut data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    data_dir.push("yt-dlp.exe");
    #[cfg(not(target_os = "windows"))]
    data_dir.push("yt-dlp");

    if data_dir.exists() {
        Ok(app.shell().command(data_dir.to_string_lossy().to_string()))
    } else {
        app.shell().sidecar("yt-dlp").map_err(|e| e.to_string())
    }
}

#[tauri::command]
async fn download_video(
    app: tauri::AppHandle,
    id: String,
    url: String,
    path: String,
    format_id: Option<String>,
    is_audio: bool,
    subtitles: bool,
    start_time: Option<String>,
    end_time: Option<String>,
    cookies_browser: Option<String>,
) -> Result<(), String> {
    let sidecar_command = get_ytdlp_command(&app)?;

    // Resolve the path to the bundled ffmpeg binary (same directory as the app executable)
    let exe_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("Failed to get exe directory")?
        .to_path_buf();
    
    // In production builds, Tauri appends the target-triple to the binary name.
    // In dev mode, it may use just the plain name (e.g. "ffmpeg.exe").
    #[cfg(target_os = "windows")]
    let candidates = ["ffmpeg-x86_64-pc-windows-msvc.exe", "ffmpeg.exe"];
    #[cfg(target_os = "linux")]
    let candidates = ["ffmpeg-x86_64-unknown-linux-gnu", "ffmpeg"];
    #[cfg(target_os = "macos")]
    let candidates = ["ffmpeg-aarch64-apple-darwin", "ffmpeg"];
    
    let ffmpeg_location = candidates
        .iter()
        .map(|name| exe_dir.join(name))
        .find(|p| p.exists())
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "ffmpeg".to_string()); // Fallback: assume ffmpeg is on PATH

    let mut args = vec![
        "--ffmpeg-location".to_string(),
        ffmpeg_location,
        "--merge-output-format".to_string(),
        "mp4".to_string(),
        "-P".to_string(),
        path,
        "--restrict-filenames".to_string(),
        "--newline".to_string(),
        "--progress-template".to_string(),
        "download:%(progress._percent_str)s at %(progress._speed_str)s ETA %(progress._eta_str)s".to_string(), 
        // Use --print to output the final merged filepath natively, bypassing cmd.exe unicode corruption
        "--print".to_string(),
        "after_move:FILE_SAVED_AT: %(filepath)s".to_string(),
    ];

    // Cookies from browser
    if let Some(browser) = cookies_browser {
        if !browser.is_empty() && browser != "none" {
            args.push("--cookies-from-browser".to_string());
            args.push(browser);
        }
    }

    // Trimming logic: --download-sections "*start-end"
    if start_time.is_some() || end_time.is_some() {
        let start = start_time.unwrap_or_default();
        let end = end_time.unwrap_or_default();
        // Only add if at least one bound is provided
        if !start.is_empty() || !end.is_empty() {
            let section = format!("*{}-{}", start, end);
            args.push("--download-sections".to_string());
            args.push(section);
        }
    }

    if subtitles {
        args.push("--write-sub".to_string());
        args.push("--write-auto-sub".to_string());
        args.push("--sub-lang".to_string());
        args.push("en,pt,pt-BR".to_string());
        args.push("--embed-subs".to_string());
    }

    if is_audio {
        args.push("-x".to_string());
        args.push("--audio-format".to_string());
        args.push("mp3".to_string());
        if let Some(id) = format_id {
            args.push("-f".to_string());
            args.push(id);
        }
    } else if let Some(id) = format_id {
        args.push("-f".to_string());
        // If the ID already contains '+' (e.g. "137+140"), don't append bestaudio again
        if id.contains('+') {
            args.push(id);
        } else {
            args.push(format!("{}+bestaudio/best", id));
        }
    }

    // URL must be the LAST argument for yt-dlp
    args.push(url);

    let (mut rx, child) = sidecar_command
        .args(args)
        .spawn()
        .map_err(|e| e.to_string())?;

    {
        let state = app.state::<AppState>();
        let mut map = state.active_downloads.lock().await;
        map.insert(id.clone(), child);
    }

    // Read events until the process exits, capturing the exit code and stderr
    let mut exit_code: Option<i32> = None;
    let mut last_stderr = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                let line_str = String::from_utf8_lossy(&line);
                let _ = app.emit("download-progress", line_str.to_string());
            }
            CommandEvent::Stderr(line) => {
                let line_str = String::from_utf8_lossy(&line).to_string();
                let _ = app.emit("download-progress", line_str.clone());
                // Keep the last non-empty stderr line for error reporting
                let trimmed = line_str.trim().to_string();
                if !trimmed.is_empty() {
                    last_stderr = trimmed;
                }
            }
            CommandEvent::Terminated(payload) => {
                exit_code = payload.code;
            }
            _ => {}
        }
    }

    // Remove the process from active downloads
    {
        let state = app.state::<AppState>();
        let mut map = state.active_downloads.lock().await;
        map.remove(&id);
    }

    // Check the exit code of yt-dlp
    match exit_code {
        Some(0) => Ok(()),
        Some(code) => {
            let msg = if last_stderr.is_empty() {
                format!("Download failed – yt-dlp exited with code {}", code)
            } else {
                format!("Download failed (code {}): {}", code, last_stderr)
            };
            Err(msg)
        }
        None => Err("Download cancelled by user".into()),
    }
}

#[tauri::command]
async fn cancel_download(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut map = state.active_downloads.lock().await;
    if let Some(child) = map.remove(&id) {
        let _ = child.kill();
    }
    Ok(())
}

#[derive(serde::Serialize)]
struct Format {
    format_id: String,
    ext: String,
    resolution: String, // "1920x1080" or "audio only"
    fps: Option<f64>,
    filesize: Option<u64>,
}

#[derive(serde::Serialize)]
struct PlaylistEntry {
    id: String,
    title: String,
    duration: String, // formatted
    uploader: String,
    thumbnail: String,
}

#[derive(serde::Serialize)]
struct VideoMetadata {
    title: String,
    thumbnail: String,
    duration: String,
    uploader: String,
    formats: Vec<Format>,
    is_playlist: bool,
    playlist_entries: Vec<PlaylistEntry>,
}

#[tauri::command]
async fn get_video_metadata(app: tauri::AppHandle, url: String) -> Result<VideoMetadata, String> {
    // 1. Try to detect if it is a playlist using basic check or strict check
    let is_list_url = url.contains("list=");
    
    // Only verify if likely a playlist to save time, or just run with flat-playlist checks
    if is_list_url {
         let output = get_ytdlp_command(&app)?
            .args(["-J", "--flat-playlist", "--no-warnings", &url])
            .output()
            .await
            .map_err(|e| e.to_string())?;
            
         if output.status.success() {
             let stdout = String::from_utf8_lossy(&output.stdout);
             if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
                  if json.get("_type").and_then(|t| t.as_str()) == Some("playlist") {
                      // Parse playlist entries
                      let title = json["title"].as_str().unwrap_or("Playlist").to_string();
                      let uploader = json["uploader"].as_str().unwrap_or("Unknown").to_string();
                      // Thumb might not exist for playlist container, use first video?
                      let thumbnail = "".to_string(); 
                      
                      let mut entries = Vec::new();
                      if let Some(items) = json["entries"].as_array() {
                          for item in items {
                              let id = item["id"].as_str().unwrap_or("").to_string();
                              let t = item["title"].as_str().unwrap_or("Unknown Video").to_string();
                              let dur_sec = item["duration"].as_f64().unwrap_or(0.0);
                              let up = item["uploader"].as_str().unwrap_or("").to_string();
                              
                              entries.push(PlaylistEntry {
                                  id: id.clone(),
                                  title: t,
                                  duration: format_duration(dur_sec),
                                  uploader: up,
                                  thumbnail: format!("https://i.ytimg.com/vi/{}/mqdefault.jpg", id),
                              });
                          }
                      }
                      
                      return Ok(VideoMetadata {
                          title,
                          thumbnail,
                          duration: format!("{} videos", entries.len()),
                          uploader,
                          formats: vec![],
                          is_playlist: true,
                          playlist_entries: entries,
                      });
                  }
             }
         }
    }

    // 2. Fallback to Single Video
    let output = get_ytdlp_command(&app)?
        .args(["-J", "--no-warnings", "--no-playlist", &url])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&stdout).map_err(|e| e.to_string())?;

    let title = json["title"].as_str().unwrap_or("Unknown Title").to_string();
    let thumbnail = json["thumbnail"].as_str().unwrap_or("").to_string();
    let uploader = json["uploader"].as_str().unwrap_or("Unknown Author").to_string();
    
    let duration_sec = json["duration"].as_f64().unwrap_or(0.0);
    let duration = format_duration(duration_sec);

    let mut formats = Vec::new();
    if let Some(entries) = json["formats"].as_array() {
        for entry in entries {
            let format_id = entry["format_id"].as_str().unwrap_or("").to_string();
            let ext = entry["ext"].as_str().unwrap_or("").to_string();
            let width = entry["width"].as_u64();
            let height = entry["height"].as_u64();
            let fps = entry["fps"].as_f64();
            let filesize = entry["filesize"].as_u64();
            
            let vcodec = entry["vcodec"].as_str().unwrap_or("none").to_string();
            let acodec = entry["acodec"].as_str().unwrap_or("none").to_string();
            
            let resolution = if vcodec == "none" && acodec != "none" {
                "Audio Only".to_string()
            } else if let (Some(w), Some(h)) = (width, height) {
                format!("{}x{}", w, h)
            } else {
                "Unknown".to_string()
            };
            
            formats.push(Format {
                format_id,
                ext,
                resolution,
                fps,
                filesize
            });
        }
    }
    
    Ok(VideoMetadata {
        title,
        thumbnail,
        duration,
        uploader,
        formats,
        is_playlist: false,
        playlist_entries: vec![],
    })
}

fn format_duration(seconds: f64) -> String {
    let seconds = seconds as u64;
    let h = seconds / 3600;
    let m = (seconds % 3600) / 60;
    let s = seconds % 60;
    if h > 0 {
        format!("{}:{:02}:{:02}", h, m, s)
    } else {
        format!("{}:{:02}", m, s)
    }
}

#[tauri::command]
async fn fetch_image_base64(url: String) -> Result<String, String> {
    let response = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?;
    
    let bytes = response.bytes()
        .await
        .map_err(|e| e.to_string())?;
        
    let b64 = base64::prelude::BASE64_STANDARD.encode(&bytes);
    Ok(b64)
}

#[tauri::command]
async fn get_ytdlp_version(app: tauri::AppHandle) -> Result<String, String> {
    let output = get_ytdlp_command(&app)?
        .args(["--version"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("Failed to get yt-dlp version".into());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
async fn update_ytdlp(app: tauri::AppHandle) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
    #[cfg(target_os = "macos")]
    let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";
    #[cfg(target_os = "linux")]
    let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

    let mut data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !data_dir.exists() {
        tokio::fs::create_dir_all(&data_dir).await.map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    data_dir.push("yt-dlp.exe");
    #[cfg(not(target_os = "windows"))]
    data_dir.push("yt-dlp");

    let response = reqwest::get(url).await.map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Failed to download update: HTTP {}", response.status()));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    tokio::fs::write(&data_dir, bytes).await.map_err(|e| e.to_string())?;

    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&data_dir).map_err(|e| e.to_string())?.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&data_dir, perms).map_err(|e| e.to_string())?;
    }

    let output = get_ytdlp_command(&app)?
        .args(["--version"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("Update succeeded but failed to verify version".into());
    }

    Ok(format!("Successfully updated to version {}", String::from_utf8_lossy(&output.stdout).trim()))
}

#[tauri::command]
fn get_download_dir(app: tauri::AppHandle) -> Result<String, String> {
    let download_dir = app.path().download_dir().map_err(|e| e.to_string())?;
    Ok(download_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // When a second instance is opened (e.g. via deep link), forward the URL
            for arg in argv.iter().skip(1) {
                if arg.starts_with("fluxdownloader://") {
                    let _ = app.emit("deep-link-url", arg.clone());
                }
            }
            // Focus the main window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .setup(|_app| {
            // Register the deep link protocol at runtime (needed for dev mode)
            #[cfg(any(target_os = "windows", target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = _app.deep_link().register("fluxdownloader");
            }
            Ok(())
        })
        .manage(AppState {
            active_downloads: Arc::new(Mutex::new(HashMap::new())),
        })
        .invoke_handler(tauri::generate_handler![greet, download_video, cancel_download, get_video_metadata, fetch_image_base64, open_folder, get_download_dir, get_ytdlp_version, update_ytdlp])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
