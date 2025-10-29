**Short answer: No, a "deployed Tauri backend" doesn't make sense architecturally.**

Here's why:

## What Tauri Actually Is

Tauri is a **desktop app framework** (like Electron). It bundles:
- Your web frontend (React/Vite)
- A Rust backend that runs **locally on the user's machine**
- OS APIs for file system, windows, etc.

It's specifically designed to create **native desktop applications**, not server applications.

## The Mismatch

**What you're suggesting:**
- Tauri backend deployed to server ❌
- React/Vite deployed to web ✅

**The problem:**
- Tauri's Rust backend is designed to communicate with a **local** web view via IPC (inter-process communication)
- It expects to run on the same machine as the frontend
- It's not an HTTP API server - it's a desktop app runtime

## What You Actually Want

For cloud video editing, you need:

**Frontend (Web):**
- React + Vite (deployed to Vercel/Netlify)
- Static site that makes HTTP API calls

**Backend (Server):**
- Regular HTTP API server (Node.js, Go, Python, **or Rust**)
- Runs FFmpeg for video processing
- Deployed to Railway/Render/AWS

## If You Want to Use Rust for the Backend

**YES, you can use Rust** - just not Tauri! Use a web framework like:

```rust
// Use Axum or Actix-web for HTTP API
use axum::{Router, Json};

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/api/export", post(export_handler));
    
    axum::Server::bind(&"0.0.0.0:3000")
        .serve(app.into_make_service())
        .await
        .unwrap();
}
```

**Rust for cloud backend:**
- ✅ Fast FFmpeg orchestration
- ✅ Memory safe
- ✅ Good for high-performance video processing
- ❌ More complex than Node.js
- ❌ Smaller ecosystem for video tools

## Tauri is for Desktop Only

If you want to keep a **desktop version** alongside the cloud version:

**Desktop:** Tauri app (Rust backend + React frontend bundled together)
**Cloud:** Separate Rust/Node.js HTTP API + React frontend deployed separately

But you can't "deploy Tauri to the server" - that's not what it's designed for.

**TL;DR:** Use regular Rust web frameworks (Axum/Actix) for the server backend, not Tauri. Tauri is only for desktop apps.