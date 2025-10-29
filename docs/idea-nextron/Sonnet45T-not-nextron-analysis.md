# ClipForge Cloud Architecture: The Right Way

## What I Got Wrong Before

My previous analysis was overengineered. You're absolutely right - we don't need Nextron for a cloud video editor. Most cloud video editors use a simple, proven architecture:

**Frontend (Thin Client):**
- React/Vue/etc. static app
- Handles UI, timeline, preview
- Uploads media to cloud
- Displays processing progress

**Backend (Heavy Processing):**
- FFmpeg runs on servers (not in browser!)
- Processes videos in cloud
- Returns download links

This is how **CapCut Online**, **Clipchamp**, **VEED.io**, **Runway ML**, and others work.

---

## How Real Cloud Video Editors Work

### Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    USER'S BROWSER                            │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │   React App (Vite) - Static Assets from CDN       │    │
│  │   - Timeline UI                                    │    │
│  │   - Video preview (HTML5 video + canvas)           │    │
│  │   - Project state management (Zustand)             │    │
│  │   - Calls REST API for processing                  │    │
│  └────────────────────────────────────────────────────┘    │
│                        │                                     │
│                        │ HTTPS API Calls                     │
│                        ▼                                     │
└─────────────────────────────────────────────────────────────┘
                         │
                         │
┌─────────────────────────────────────────────────────────────┐
│                   CLOUD BACKEND                              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │   API Server (Node.js / Go / Python)               │    │
│  │   - File upload endpoints                          │    │
│  │   - Export job management                          │    │
│  │   - Project persistence                            │    │
│  │   - Authentication                                 │    │
│  └────────────────────────────────────────────────────┘    │
│                        │                                     │
│                        ▼                                     │
│  ┌────────────────────────────────────────────────────┐    │
│  │   Object Storage (S3 / R2 / GCS)                   │    │
│  │   - Raw uploaded media                             │    │
│  │   - Processed exports                              │    │
│  │   - Thumbnails/previews                            │    │
│  └────────────────────────────────────────────────────┘    │
│                        │                                     │
│                        ▼                                     │
│  ┌────────────────────────────────────────────────────┐    │
│  │   Processing Workers (FFmpeg)                      │    │
│  │   - Lambda / Cloud Run / ECS containers            │    │
│  │   - FFmpeg binary on Linux                         │    │
│  │   - Queue for long jobs (SQS / Redis)              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### How It Works: Step-by-Step

**1. Upload Phase**
```
User selects video → Frontend uploads to cloud storage → 
Backend generates signed URLs → Frontend shows upload progress
```

**2. Editing Phase**
```
User edits in browser → All edits stored in project JSON → 
Video playback uses cloud URLs → Timeline runs entirely in browser
```

**3. Export Phase**
```
User clicks export → Frontend sends edit plan to API →
Backend spawns FFmpeg worker → Worker downloads clips from storage →
FFmpeg processes video → Worker uploads result to storage →
Backend sends download URL to frontend
```

---

## Proposed Architecture for ClipForge Cloud

### Keep Your Current Frontend (React + Vite)

**No need to change to Next.js!** Your current setup is perfect:

```
clipforge-electron/
├── src/                    # Current React app - KEEP THIS
│   ├── components/        # All your existing components
│   ├── lib/               # Canvas renderer, audio manager
│   ├── store/             # Zustand stores
│   └── main.tsx
├── vite.config.ts         # Your current Vite config
└── package.json
```

**Only change:** Remove Electron-specific code, add API client

### Add a Separate Backend API

**New repository or monorepo:**

```
clipforge-backend/
├── src/
│   ├── routes/
│   │   ├── upload.ts      # POST /api/upload
│   │   ├── export.ts      # POST /api/export
│   │   ├── projects.ts    # CRUD for projects
│   │   └── jobs.ts        # GET /api/jobs/:id (status)
│   ├── services/
│   │   ├── storage.ts     # S3/R2 client
│   │   ├── ffmpeg.ts      # FFmpeg processing
│   │   └── queue.ts       # Job queue
│   ├── workers/
│   │   └── export-worker.ts # FFmpeg processing worker
│   └── server.ts
├── Dockerfile
└── package.json
```

---

## Detailed Implementation

### Frontend Changes (Minimal!)

#### 1. Replace Electron IPC with HTTP API

**Current (Electron):**
```typescript
// src/lib/bindings.ts
export async function exportProject(
  projectJson: string,
  settings: ExportSettings
): Promise<ExportResult> {
  return window.electronAPI.exportProject(projectJson, settings);
}
```

**New (Cloud API):**
```typescript
// src/lib/api-client.ts
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.clipforge.app';

export async function exportProject(
  projectJson: string,
  settings: ExportSettings
): Promise<{ jobId: string }> {
  const response = await fetch(`${API_BASE}/api/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      project: JSON.parse(projectJson),
      settings
    })
  });
  
  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }
  
  return response.json();
}

// Poll for job completion
export async function getJobStatus(jobId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  downloadUrl?: string;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/api/jobs/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });
  
  return response.json();
}
```

#### 2. Update Media Sources to Use Cloud URLs

**Current:**
```typescript
// Uses custom media:// protocol
const videoSrc = `media://${filePath}`;
```

**New:**
```typescript
// Uses signed S3/R2 URLs
const videoSrc = asset.cloudUrl; // https://media.clipforge.app/videos/abc123.mp4
```

#### 3. File Upload Instead of Local Ingest

**Current (copies to cache directory):**
```typescript
const results = await window.electronAPI.ingestFiles({ file_paths: paths });
```

**New (uploads to cloud):**
```typescript
// src/lib/api-client.ts
export async function uploadMedia(file: File, onProgress?: (pct: number) => void) {
  // Step 1: Get signed upload URL
  const { uploadUrl, assetId } = await fetch(`${API_BASE}/api/upload/init`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size
    })
  }).then(r => r.json());
  
  // Step 2: Upload directly to S3/R2 (bypass server for large files)
  const xhr = new XMLHttpRequest();
  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable && onProgress) {
      onProgress((e.loaded / e.total) * 100);
    }
  });
  
  await new Promise((resolve, reject) => {
    xhr.onload = () => xhr.status === 200 ? resolve(xhr) : reject(xhr);
    xhr.onerror = reject;
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
  
  // Step 3: Notify backend that upload completed
  const asset = await fetch(`${API_BASE}/api/upload/complete`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ assetId })
  }).then(r => r.json());
  
  return asset; // { id, cloudUrl, metadata }
}
```

#### 4. Environment-Specific Builds

**vite.config.ts:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  
  // Different builds for different targets
  define: {
    __PLATFORM__: JSON.stringify(mode) // 'web' or 'desktop'
  },
  
  build: {
    outDir: mode === 'web' ? 'dist-web' : 'dist-desktop',
    rollupOptions: {
      // Exclude Electron code in web build
      external: mode === 'web' ? ['electron'] : []
    }
  }
}));
```

**Usage in code:**
```typescript
// src/lib/adapters/index.ts
declare const __PLATFORM__: 'web' | 'desktop';

export const useCloudStorage = __PLATFORM__ === 'web';
export const useLocalFFmpeg = __PLATFORM__ === 'desktop';

// Dynamically import the right adapter
export const api = __PLATFORM__ === 'web'
  ? await import('./api-client')
  : await import('./electron-bindings');
```

---

### Backend Implementation (New)

#### Technology Choices

**Option A: Node.js (Familiar, same language as Electron)**
```typescript
// Pros: Same language, use existing FFmpeg knowledge
// Cons: Not the fastest for CPU-intensive tasks
// Best for: Quick migration, familiar syntax
```

**Option B: Go (Fast, good for FFmpeg orchestration)**
```go
// Pros: Fast, good concurrency, single binary deployment
// Cons: New language to learn
// Best for: Production-grade performance
```

**Option C: Python (Best FFmpeg libraries)**
```python
# Pros: Excellent FFmpeg libs (moviepy, ffmpeg-python), AI/ML integration
# Cons: Slightly slower than Go
# Best for: Advanced video processing, AI features
```

**Recommendation:** Start with **Node.js** since you're already familiar with it from Electron.

---

### Backend Architecture (Node.js + Express)

#### 1. API Server

```typescript
// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const app = express();
const redis = new Redis(process.env.REDIS_URL);
const s3 = new S3Client({ 
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

const exportQueue = new Queue('video-export', { connection: redis });

app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://clipforge.app'
}));
app.use(express.json({ limit: '10mb' }));

// ===== Upload Routes =====

// Initialize upload (get presigned URL)
app.post('/api/upload/init', authenticateUser, async (req, res) => {
  const { filename, contentType, size } = req.body;
  const userId = req.user.id;
  
  // Generate unique asset ID
  const assetId = `${userId}_${Date.now()}_${randomId()}`;
  const key = `uploads/${userId}/${assetId}/${filename}`;
  
  // Create presigned POST for direct S3 upload
  const { url, fields } = await createPresignedPost(s3, {
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    Conditions: [
      ['content-length-range', 0, 5 * 1024 * 1024 * 1024], // Max 5GB
      ['eq', '$Content-Type', contentType]
    ],
    Expires: 3600 // 1 hour to complete upload
  });
  
  res.json({
    uploadUrl: url,
    fields,
    assetId,
    key
  });
});

// Confirm upload completed
app.post('/api/upload/complete', authenticateUser, async (req, res) => {
  const { assetId } = req.body;
  const userId = req.user.id;
  
  // TODO: Verify file exists in S3
  // TODO: Extract metadata (can delegate to worker)
  // TODO: Save to database
  
  const asset = {
    id: assetId,
    userId,
    cloudUrl: `https://cdn.clipforge.app/${assetId}`,
    status: 'ready',
    metadata: {
      // Will be populated by background worker
    }
  };
  
  await db.assets.create(asset);
  
  res.json(asset);
});

// ===== Export Routes =====

app.post('/api/export', authenticateUser, async (req, res) => {
  const { project, settings } = req.body;
  const userId = req.user.id;
  
  // Validate project
  if (!project.tracks || project.tracks.length === 0) {
    return res.status(400).json({ error: 'Empty project' });
  }
  
  // Create job
  const jobId = `job_${Date.now()}_${randomId()}`;
  
  // Add to queue
  await exportQueue.add('export-video', {
    jobId,
    userId,
    project,
    settings
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: false, // Keep job for status queries
    removeOnFail: false
  });
  
  res.json({ jobId });
});

// Get job status
app.get('/api/jobs/:jobId', authenticateUser, async (req, res) => {
  const { jobId } = req.params;
  const userId = req.user.id;
  
  const job = await exportQueue.getJob(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  // Check ownership
  if (job.data.userId !== userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  const state = await job.getState();
  const progress = job.progress || 0;
  
  let response: any = {
    jobId,
    status: state, // 'waiting', 'active', 'completed', 'failed'
    progress
  };
  
  if (state === 'completed') {
    response.downloadUrl = job.returnvalue?.downloadUrl;
  } else if (state === 'failed') {
    response.error = job.failedReason;
  }
  
  res.json(response);
});

// ===== Server =====

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});
```

#### 2. Export Worker (FFmpeg Processing)

```typescript
// backend/src/workers/export-worker.ts
import { Worker, Job } from 'bullmq';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const s3 = new S3Client({ /* config */ });

// Worker processes export jobs
const worker = new Worker('video-export', async (job: Job) => {
  const { jobId, userId, project, settings } = job.data;
  
  console.log(`[${jobId}] Starting export for user ${userId}`);
  
  // Create temp directory for this job
  const tempDir = path.join(os.tmpdir(), jobId);
  await fs.ensureDir(tempDir);
  
  try {
    // Step 1: Download clips from S3
    job.updateProgress(10);
    const localClips = await downloadClips(project, tempDir);
    
    // Step 2: Build FFmpeg command (reuse your existing logic!)
    job.updateProgress(20);
    const outputPath = path.join(tempDir, 'output.mp4');
    const plan = buildPlan(project); // Your existing function!
    
    // Step 3: Execute FFmpeg
    await executeFFmpeg(plan, localClips, outputPath, (progress) => {
      // Update job progress: 20% + (progress * 60%)
      job.updateProgress(20 + (progress * 60));
    });
    
    // Step 4: Upload result to S3
    job.updateProgress(85);
    const resultKey = `exports/${userId}/${jobId}/output.mp4`;
    await uploadToS3(outputPath, resultKey);
    
    // Step 5: Generate signed download URL (expires in 24 hours)
    job.updateProgress(95);
    const downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: resultKey
      }),
      { expiresIn: 86400 } // 24 hours
    );
    
    // Cleanup
    await fs.remove(tempDir);
    
    console.log(`[${jobId}] Export completed: ${downloadUrl}`);
    
    return {
      downloadUrl,
      size: (await fs.stat(outputPath)).size
    };
  } catch (error) {
    console.error(`[${jobId}] Export failed:`, error);
    await fs.remove(tempDir);
    throw error;
  }
}, {
  connection: redis,
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2') // Process 2 videos at once
});

// Helper: Download clips from S3 to local temp directory
async function downloadClips(project: any, tempDir: string) {
  const clips: { [id: string]: string } = {};
  
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (!clips[clip.assetId]) {
        console.log(`Downloading asset ${clip.assetId}`);
        
        // Get asset info from DB
        const asset = await db.assets.findById(clip.assetId);
        
        // Download from S3
        const response = await s3.send(new GetObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: asset.s3Key
        }));
        
        // Save to temp file
        const localPath = path.join(tempDir, `${clip.assetId}.mp4`);
        const writeStream = fs.createWriteStream(localPath);
        response.Body.pipe(writeStream);
        
        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });
        
        clips[clip.assetId] = localPath;
      }
    }
  }
  
  return clips;
}

// Helper: Execute FFmpeg (reuse your existing logic!)
async function executeFFmpeg(
  plan: any,
  localClips: { [id: string]: string },
  outputPath: string,
  onProgress: (progress: number) => void
) {
  // Map cloud asset IDs to local paths
  const planWithLocalPaths = {
    ...plan,
    clips: plan.clips.map((clip: any) => ({
      ...clip,
      srcPath: localClips[clip.assetId] // Use local path instead of cloud URL
    }))
  };
  
  // Use your existing FFmpeg logic from electron/export.js!
  // Just needs to work with local file paths
  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    
    // Build filter chain (your existing code)
    const filterChain = buildFilterChain(planWithLocalPaths);
    
    command
      .complexFilter(filterChain)
      .output(outputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .on('progress', (progress) => {
        if (progress.percent) {
          onProgress(progress.percent / 100);
        }
      })
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

// Helper: Upload to S3
async function uploadToS3(filePath: string, key: string) {
  const fileStream = fs.createReadStream(filePath);
  
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    Body: fileStream,
    ContentType: 'video/mp4'
  }));
}

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log('Export worker started');
```

---

### Deployment Options

#### Option 1: Vercel + AWS Lambda (Easiest)

**Frontend (Vercel):**
```bash
# Deploy frontend (free tier)
npm run build:web
vercel deploy --prod
```

**Backend (AWS Lambda):**
```yaml
# serverless.yml
service: clipforge-api

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    S3_BUCKET: ${env:S3_BUCKET}
    REDIS_URL: ${env:REDIS_URL}

functions:
  api:
    handler: src/lambda.handler
    timeout: 30
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true
  
  exportWorker:
    handler: src/workers/export-lambda.handler
    timeout: 900 # 15 minutes max
    memorySize: 3008 # Max memory for more CPU
    layers:
      - arn:aws:lambda:us-east-1:123456789012:layer:ffmpeg:1
    events:
      - sqs:
          arn: !GetAtt ExportQueue.Arn
```

**Pros:**
- Serverless (pay per use)
- Scales automatically
- Vercel free tier for frontend

**Cons:**
- Lambda has 15 min timeout (limits video length)
- Cold starts
- FFmpeg layer can be large

---

#### Option 2: Railway / Render (Simple Containers)

**Frontend:** Still on Vercel/Netlify (static)

**Backend:** Railway or Render (Docker container)

```dockerfile
# Dockerfile
FROM node:20

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

CMD ["node", "dist/server.js"]
```

**Railway deployment:**
```bash
# One command deployment
railway up
```

**Pros:**
- No timeout limits (can process long videos)
- Easier FFmpeg installation
- Simple deployment

**Cons:**
- $5-$20/month minimum
- Need to scale manually

---

#### Option 3: Cloudflare Workers + R2 (Cheapest at scale)

**Frontend:** Cloudflare Pages (free, unlimited bandwidth!)

**Backend:** Cloudflare Workers + Durable Objects

**Storage:** Cloudflare R2 (S3-compatible, no egress fees!)

```typescript
// workers/src/index.ts
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    
    if (url.pathname === '/api/export') {
      // Queue export job
      const jobId = crypto.randomUUID();
      await env.EXPORT_QUEUE.send({
        jobId,
        project: await request.json()
      });
      return Response.json({ jobId });
    }
    
    return Response.json({ error: 'Not found' }, { status: 404 });
  },
  
  async queue(batch: MessageBatch, env: Env) {
    // Process export jobs
    for (const message of batch.messages) {
      const { jobId, project } = message.body;
      
      // Spawn FFmpeg on separate compute
      // (Cloudflare Workers can't run FFmpeg directly)
      // Use Cloudflare Workers + External FFmpeg service
    }
  }
};
```

**Pros:**
- Insanely cheap at scale
- Unlimited bandwidth (Cloudflare Pages)
- Global edge network

**Cons:**
- Workers can't run FFmpeg (need separate compute)
- More complex architecture

---

## Cost Comparison

### Per 1000 Exports (5-minute 1080p videos)

**AWS Lambda + S3:**
- Lambda compute: $8.33 (15 min × 3GB × 1000 jobs)
- S3 storage: $0.46 (2GB × 1000 uploads × 1 month)
- S3 egress: $90 (2GB × 1000 downloads × $0.09/GB)
- **Total: ~$100/month**

**Railway (Always-on server):**
- Pro plan: $20/month (4GB RAM, 2 vCPU)
- Can process ~100 videos/day
- **Total: ~$20/month** (if server can keep up)

**Cloudflare R2 + External FFmpeg:**
- R2 storage: $0.30 (2GB × 1000 × $0.015/GB)
- R2 egress: $0 (no egress fees!)
- External FFmpeg (Render): $7/month
- **Total: ~$8/month** (cheapest!)

---

## Migration Path

### Phase 1: Dual Mode (2-3 weeks)

Keep desktop app working, add cloud mode:

```typescript
// src/lib/config.ts
export const MODE = import.meta.env.VITE_MODE || 'desktop'; // 'desktop' | 'cloud'

// src/lib/api.ts
export const api = MODE === 'cloud' 
  ? await import('./api-client')
  : await import('./electron-bindings');
```

**Build commands:**
```json
{
  "scripts": {
    "dev": "vite",
    "dev:cloud": "VITE_MODE=cloud vite",
    "build:desktop": "vite build && electron-builder",
    "build:cloud": "VITE_MODE=cloud vite build"
  }
}
```

### Phase 2: Backend MVP (2-3 weeks)

1. Setup Node.js API server
2. Implement upload routes
3. Implement export worker (reuse FFmpeg logic!)
4. Deploy to Railway

### Phase 3: Frontend Updates (1-2 weeks)

1. Add file upload UI
2. Add export progress polling
3. Add authentication
4. Deploy to Vercel

### Phase 4: Production (1 week)

1. Add monitoring (Sentry, DataDog)
2. Add analytics
3. Add rate limiting
4. Add billing (Stripe)

**Total: 6-9 weeks**

---

## Answering Your Questions

> "Isn't most of the processing done on a server, not in the web?"

**YES!** You're 100% correct. Real cloud video editors:
- **VEED.io**: React frontend + Python/FFmpeg backend
- **CapCut Online**: React frontend + Cloud FFmpeg
- **Clipchamp**: Web frontend + Azure backend
- **Runway ML**: React frontend + GPU backend

> "Can't ffmpeg still be used that way?"

**Absolutely!** Your existing FFmpeg code can be reused almost as-is. Just:
1. Download clips from S3 to temp directory
2. Run your existing FFmpeg logic
3. Upload result back to S3

> "Shouldn't we use a new API to communicate between the two?"

**YES!** Simple REST API:
- `POST /api/upload` - Upload media
- `POST /api/export` - Start export job
- `GET /api/jobs/:id` - Check status

> "Maybe the Nextjs part is unnecessary and just keep react+vite?"

**EXACTLY!** Keep React + Vite for frontend. Deploy as static site. Build separate Node.js backend for FFmpeg. This is the standard architecture.

---

## Recommended Final Architecture

```
Frontend (Current):
- Keep React + Vite
- Deploy to Vercel/Netlify as static site
- Add API client for backend calls

Backend (New):
- Node.js + Express API
- BullMQ for job queue
- Reuse your FFmpeg code
- Deploy to Railway ($7/month)

Storage:
- Cloudflare R2 or AWS S3
- Store uploads and exports

Desktop App (Keep!):
- Best experience for power users
- No upload/download time
- Works offline
```

This is much simpler than my previous Nextron proposal!

