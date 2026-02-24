# Flux Downloader

A modern, fast, and feature-rich YouTube Downloader built with **Tauri**, **React**, **TypeScript**, and **Vite**.

![Flux Downloader](public/vite.svg)

## Features

- 🚀 Fast and lightweight desktop application.
- ⏬ Download videos and audio from YouTube using `yt-dlp`.
- ⚙️ Powered by `ffmpeg` for robust media conversion.
- 🎨 Beautiful UI with React and TailwindCSS.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Bun](https://bun.sh/) (Optional but recommended, used for package management)
- [Rust](https://www.rust-lang.org/tools/install) (Required for Tauri backend)
- Required build tools for Tauri (C++ build tools on Windows). See [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites/).

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone https://github.com/eoNaho/flux-downloader
   cd flux-downloader
   ```

2. **Install dependencies:**

   ```bash
   bun install
   ```

   _(or `npm install` / `yarn install` / `pnpm install`)_

3. **Download required binaries (`yt-dlp` and `ffmpeg`):**
   Flux Downloader uses `yt-dlp` and `ffmpeg` as external binaries. To avoid putting heavy binaries in the repository, we have a setup script that downloads them automatically:

   ```bash
   bun run setup
   ```

   _Note: The script currently downloads Windows (`x86_64-pc-windows-msvc`) binaries automatically. For Mac or Linux, you may need to download them manually to `src-tauri/binaries/` with the correct cross-platform target suffix._

4. **Run in development mode:**
   ```bash
   bun tauri dev
   ```
   _(Wait for Tauri to build the Rust backend; it may take a minute on the first run)._

## Building for Production

To build the optimized application for your operating system:

```bash
bun run build
```

The output installers will be available in `src-tauri/target/release/bundle/`.

## Architecture Details

- **Frontend:** React 19, Vite, TailwindCSS (v4), Zustand (state management).
- **Backend:** Rust / Tauri.
- **Media Processing:** Bundled with `yt-dlp` and `ffmpeg` via Tauri's `externalBin` configuration.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

## License

This project is licensed under the MIT License.
