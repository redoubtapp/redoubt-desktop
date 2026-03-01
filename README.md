# Redoubt Desktop

A native desktop client for [Redoubt](https://github.com/redoubtapp) — the self-hosted communication platform. Connect to one or many Redoubt servers simultaneously with real-time messaging, voice channels, and a modern dark-themed interface. Built with Tauri, React, and Rust.

## Features

### Messaging
- Real-time text messaging over WebSocket
- Message editing with full edit history
- Threaded replies
- Emoji reactions with inline picker and `:` autocomplete
- File attachments (up to 10 files, 25 MB each) with image previews
- Link previews via OpenGraph metadata
- Typing indicators and unread counts
- Optimistic sending with retry on failure

### Voice
- Low-latency voice channels powered by [LiveKit](https://livekit.io)
- Audio device selection (input and output)
- Mute and deafen controls
- Voice Activity Detection (VAD) and Push-to-Talk modes
- Active speaker detection and connection quality indicators
- Join/leave sound effects

### Multi-Instance
- Connect to multiple Redoubt servers at once
- Tab-based instance switching with independent auth per server
- Automatic server validation on connect
- Per-instance state isolation (messages, spaces, presence)

### Desktop Integration
- Global keyboard shortcuts (configurable):
  | Shortcut | Action |
  |----------|--------|
  | `Alt + \`` | Push-to-Talk |
  | `Alt + M` | Toggle Mute |
  | `Alt + D` | Toggle Deafen |
- Native window with 1280x720 default (resizable, min 940x500)
- Secure credential storage via Tauri's platform keychain

### Personalization
- 6 accent color themes (Blue, Purple, Green, Orange, Cyan, Rose)
- Dark UI built on Radix primitives

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop runtime | [Tauri 2](https://tauri.app) (Rust) |
| Frontend | [React 19](https://react.dev) + TypeScript |
| Build | [Vite 7](https://vite.dev) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| UI primitives | [Radix UI](https://radix-ui.com) |
| State | [Zustand 5](https://zustand.docs.pmnd.rs) |
| Voice/Video | [LiveKit](https://livekit.io) |
| Package manager | [Bun](https://bun.sh) |

## Prerequisites

- [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)
- [Rust](https://rustup.rs) 1.77.2+ (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- Platform dependencies:
  - **macOS** — Xcode Command Line Tools (`xcode-select --install`)
  - **Linux (Ubuntu 22.04+)** — `sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
  - **Windows** — [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with C++ workload

## Getting Started

```bash
# Clone the repository
git clone https://github.com/redoubt/redoubt-desktop.git
cd redoubt-desktop

# Install dependencies
bun install

# Configure environment (optional — defaults to localhost:8080)
cp .env.local.example .env.local

# Run in development mode (starts Vite + Tauri together)
bun run tauri dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8080/api/v1` | REST API base URL |
| `VITE_WS_URL` | `ws://localhost:8080/ws` | WebSocket endpoint |

These are only used as defaults — the multi-instance system lets users connect to any server URL at runtime.

## Building

```bash
# Type-check and build frontend assets
bun run build

# Build the native desktop app
bun run tauri build
```

Build artifacts are output to `src-tauri/target/release/`:
- **macOS** — `.dmg` and `.app`
- **Linux** — `.AppImage` and `.deb`
- **Windows** — `.msi` and `.exe`

## Project Structure

```
redoubt-desktop/
├── src/                        # React frontend
│   ├── components/
│   │   ├── auth/               # Login and registration forms
│   │   ├── chat/               # Messages, input, threads, emoji, attachments
│   │   ├── instance/           # Multi-instance UI (add dialog, tab bar)
│   │   ├── layout/             # Sidebar and header
│   │   ├── settings/           # User settings, avatar, invites
│   │   ├── ui/                 # Shared Radix-based primitives
│   │   └── voice/              # Voice controls, participants, audio settings
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # API client, WebSocket, connection manager
│   ├── store/                  # Zustand stores (instance-scoped and global)
│   └── types/                  # TypeScript type definitions
├── src-tauri/                  # Tauri / Rust backend
│   ├── src/
│   │   ├── lib.rs              # Plugin registration and app setup
│   │   └── commands/           # Global shortcut commands
│   ├── capabilities/           # Permission scopes
│   └── tauri.conf.json         # Window, build, and bundle config
└── public/
    └── sounds/                 # Voice join/leave audio
```

## Architecture

The app uses a **multi-instance architecture** where each Redoubt server connection is fully isolated:

- **Instance-scoped stores** — Auth, chat, spaces, and presence each maintain independent state per server via a factory pattern (`createInstanceAwareStore`)
- **API client registry** — Each instance gets a dedicated `ApiClient` with its own base URL and auth token, cached by instance ID
- **Connection manager** — A singleton that coordinates WebSocket subscriptions and voice connections across all instances
- **Voice** — Only one active voice connection at a time (across all instances), managed by a global voice store

Real-time communication flows through WebSocket with exponential backoff reconnection (1s, 2s, 5s, 10s, 30s). HTTP requests are routed through Tauri's HTTP plugin to bypass browser CORS restrictions.

## CI

GitHub Actions builds and validates across all three platforms on every push to `main`:

| Platform | Target |
|----------|--------|
| macOS | `aarch64-apple-darwin`, `x86_64-apple-darwin` |
| Linux | Ubuntu 22.04 |
| Windows | Latest |

## License

[GNU Affero General Public License v3.0](LICENSE)
