import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const BINARY_DIR = path.join(process.cwd(), "src-tauri", "binaries");

// Ensure directory exists
if (!fs.existsSync(BINARY_DIR)) {
  fs.mkdirSync(BINARY_DIR, { recursive: true });
}

async function downloadFile(url: string, dest: string) {
  console.log(`Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(dest, buffer);
  console.log(`Downloaded to ${dest}`);
}

async function setupWindows() {
  const target = "x86_64-pc-windows-msvc";

  // yt-dlp
  const ytdlpPath = path.join(BINARY_DIR, `yt-dlp-${target}.exe`);
  if (!fs.existsSync(ytdlpPath)) {
    await downloadFile(
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
      ytdlpPath,
    );
  } else {
    console.log("yt-dlp already exists.");
  }

  // ffmpeg
  const ffmpegPath = path.join(BINARY_DIR, `ffmpeg-${target}.exe`);
  if (!fs.existsSync(ffmpegPath)) {
    const zipPath = path.join(BINARY_DIR, "ffmpeg.zip");
    await downloadFile(
      "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
      zipPath,
    );
    console.log("Extracting ffmpeg...");
    // Use tar to extract zip (Windows 10+)
    execSync(`tar -xf "${zipPath}" -C "${BINARY_DIR}"`, { stdio: "inherit" });

    // The zip extracts to a folder like ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe
    const extractedFolder = path.join(
      BINARY_DIR,
      "ffmpeg-master-latest-win64-gpl",
    );
    const extractedFfmpeg = path.join(extractedFolder, "bin", "ffmpeg.exe");

    if (fs.existsSync(extractedFfmpeg)) {
      fs.renameSync(extractedFfmpeg, ffmpegPath);
      console.log("ffmpeg setup complete.");
    } else {
      console.error("Failed to find extracted ffmpeg.exe");
    }

    // Cleanup
    try {
      fs.rmSync(extractedFolder, { recursive: true, force: true });
      fs.unlinkSync(zipPath);
    } catch (err) {
      console.warn(
        "Could not clean up extracted zip fully, you can ignore this.",
        err,
      );
    }
  } else {
    console.log("ffmpeg already exists.");
  }
}

async function main() {
  const platform = process.platform;

  console.log("--- FluxDownloader Environment Setup ---");
  if (platform === "win32") {
    await setupWindows();
  } else {
    console.log(`Setup for platform ${platform} is not fully implemented yet.`);
    console.log(
      "Please download yt-dlp and ffmpeg manually and place them in src-tauri/binaries/",
    );
    console.log(
      "Naming convention: <binary>-<target-triple> (e.g. yt-dlp-x86_64-apple-darwin)",
    );
  }
  console.log("Setup finished successfully!");
}

main().catch(console.error);
