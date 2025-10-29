# Boilerplate Nextron + Shadcn/ui

This project is a production-ready boilerplate for building cross-platform applications using Nextron (Next.js + Electron) with TypeScript, TailwindCSS, and Shadcn/ui. It enables developers to create modern desktop and web applications from a single codebase, leveraging Next.js 15 App Router architecture and Electron 33 for native desktop capabilities. The boilerplate includes pre-configured window state management, IPC communication, theme support, and build pipelines for multiple platforms.

The architecture separates concerns into distinct layers: the main process (`main/`) handles Electron lifecycle and native APIs, the renderer process (`renderer/`) contains the Next.js application with React 19 RC, and a preload script bridges the two with secure IPC communication. All tooling is pre-configured including ESLint, Prettier, and electron-builder for packaging. This setup allows teams to quickly bootstrap projects that need both web deployment and native desktop distribution without managing complex configuration.

## Installation and Project Setup

### Creating a New Project with NPX

```bash
# Install and create new project from template
npx install-nextron-shadcn-boilerplate

# Navigate to your project
cd your-project-name

# Install dependencies
npm install

# Start development for desktop
npm run electron:dev

# Start development for web
npm run next:dev
```

### Manual Installation from Repository

```bash
# Clone the repository
git clone git@github.com:MaximePremont/boilerplate-nextron-shadcn.git my-app
cd my-app

# Install dependencies
npm install

# Start desktop application in development mode
npm run electron:dev
```

### Adding Shadcn/ui Components

```bash
# Add any Shadcn/ui component to your project
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog

# Components are added to renderer/components/ui/
# Import and use in your Next.js pages
```

## Development Workflow

### Running Development Servers

```bash
# Desktop application with hot reload
npm run electron:dev
# Opens Electron window at http://localhost:8888 (port varies)
# DevTools automatically opened in development

# Web application with hot reload
npm run next:dev
# Serves at http://localhost:3000 by default
# Next.js Fast Refresh enabled

# TypeScript type checking
npm run typecheck
# Checks types without emitting files
```

### Code Formatting and Linting

```bash
# Format and fix all code
npm run format
# Runs ESLint with --fix and Prettier
# Formats .ts, .tsx, .js, .json, .md files

# Manual ESLint check (from package.json setup)
npx next lint renderer --fix
```

## Building and Packaging

### Web Application Build

```bash
# Build static web application
npm run next:build
# Output: dist/ directory with static files
# Next.js config uses output: 'export' for static export

# Start production web server
npm run next:start
# Serves the dist folder on port 80 using 'serve'
# Requires dist/ to exist from previous build
```

### Desktop Application Build

```bash
# Build for your current platform
npm run electron:build-current
# Auto-detects OS and architecture
# Output: dist/ directory with installer

# Build for all platforms (requires platform-specific tools)
npm run electron:build-all

# Platform-specific builds
npm run electron:build-win32   # Windows 32-bit
npm run electron:build-win64   # Windows 64-bit
npm run electron:build-linux   # Linux (deb, rpm, snap)
npm run electron:build-mac     # macOS (requires Mac)
npm run electron:build-mac-universal  # Universal macOS binary

# Example output structure:
# dist/
#   My Nextron App-1.2.0.AppImage     (Linux)
#   My Nextron App-1.2.0.deb          (Debian/Ubuntu)
#   My Nextron App Setup 1.2.0.exe    (Windows)
#   My Nextron App-1.2.0.dmg          (macOS)
```

## Main Process (Electron)

### Application Initialization and Window Management

```typescript
// main/background.ts - Entry point for Electron app
import path from 'path'
import { app, ipcMain } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'

const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

;(async () => {
  await app.whenReady()

  const mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  if (isProd) {
    await mainWindow.loadURL('app://./')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}/`)
    mainWindow.webContents.openDevTools()
  }
})()

app.on('window-all-closed', () => {
  app.quit()
})

// Example: Adding custom IPC handler
ipcMain.on('custom-event', (event, arg) => {
  console.log('Received:', arg)
  event.reply('custom-response', { success: true })
})
```

### Window State Persistence with electron-store

```typescript
// main/helpers/create-window.ts - Persistent window management
import { screen, BrowserWindow, BrowserWindowConstructorOptions, Rectangle } from 'electron'
import Store from 'electron-store'

export const createWindow = (
  windowName: string,
  options: BrowserWindowConstructorOptions
): BrowserWindow => {
  const key = 'window-state'
  const name = `window-state-${windowName}`
  const store = new Store<Rectangle>({ name })
  const defaultSize = {
    width: options.width,
    height: options.height
  }

  let state = {}

  const restore = () => store.get(key, defaultSize)

  const getCurrentPosition = () => {
    const position = win.getPosition()
    const size = win.getSize()
    return {
      x: position[0],
      y: position[1],
      width: size[0],
      height: size[1]
    }
  }

  const windowWithinBounds = (windowState, bounds) => {
    return (
      windowState.x >= bounds.x &&
      windowState.y >= bounds.y &&
      windowState.x + windowState.width <= bounds.x + bounds.width &&
      windowState.y + windowState.height <= bounds.y + bounds.height
    )
  }

  const resetToDefaults = () => {
    const bounds = screen.getPrimaryDisplay().bounds
    return Object.assign({}, defaultSize, {
      x: (bounds.width - defaultSize.width) / 2,
      y: (bounds.height - defaultSize.height) / 2
    })
  }

  const ensureVisibleOnSomeDisplay = windowState => {
    const visible = screen.getAllDisplays().some(display => {
      return windowWithinBounds(windowState, display.bounds)
    })
    if (!visible) {
      return resetToDefaults()
    }
    return windowState
  }

  const saveState = () => {
    if (!win.isMinimized() && !win.isMaximized()) {
      Object.assign(state, getCurrentPosition())
    }
    store.set(key, state)
  }

  state = ensureVisibleOnSomeDisplay(restore())

  const win = new BrowserWindow({
    ...state,
    ...options,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      ...options.webPreferences
    }
  })

  win.on('close', saveState)

  return win
}

// Usage: Create multiple windows with state persistence
const mainWindow = createWindow('main', {
  width: 1200,
  height: 800,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js')
  }
})

const settingsWindow = createWindow('settings', {
  width: 600,
  height: 400,
  parent: mainWindow,
  modal: true
})
```

## IPC Communication Bridge

### Preload Script for Secure IPC

```typescript
// main/preload.ts - Secure bridge between main and renderer
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

const handler = {
  send(channel: string, value: unknown) {
    ipcRenderer.send(channel, value)
  },
  on(channel: string, callback: (...args: unknown[]) => void) {
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
      callback(...args)
    ipcRenderer.on(channel, subscription)

    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  }
}

contextBridge.exposeInMainWorld('ipc', handler)

export type IpcHandler = typeof handler

// Example: Adding invoke pattern for request/response
const enhancedHandler = {
  ...handler,
  invoke(channel: string, ...args: unknown[]) {
    return ipcRenderer.invoke(channel, ...args)
  }
}

contextBridge.exposeInMainWorld('ipc', enhancedHandler)
```

### Type-Safe IPC in Renderer

```typescript
// renderer/preload.d.ts - Global type definitions
import { IpcHandler } from '../main/preload'

declare global {
  interface Window {
    ipc: IpcHandler
  }
}

// Usage in any renderer component:
// renderer/app/example/page.tsx
'use client'

import { useEffect, useState } from 'react'

export default function ExamplePage() {
  const [data, setData] = useState<string>('')

  useEffect(() => {
    // Send message to main process
    window.ipc.send('request-data', { id: 123 })

    // Listen for response
    const unsubscribe = window.ipc.on('data-response', (response) => {
      setData(response as string)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const handleClick = () => {
    window.ipc.send('save-data', { value: data })
  }

  return (
    <div>
      <h1>Data: {data}</h1>
      <button onClick={handleClick}>Save</button>
    </div>
  )
}
```

## Renderer Process (Next.js Application)

### Root Layout with Theme Support

```typescript
// renderer/app/layout.tsx - Root layout with theme provider
import React from 'react'
import '@/styles/globals.css'
import { Inter as FontSans } from 'next/font/google'
import { cn } from '@/lib/utils'
import { Metadata } from 'next'
import ThemeProvider from '@/components/providers/theme-provider'

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans'
})

export const metadata: Metadata = {
  title: 'Nextron Boilerplate',
  description: 'Nextron ( Next.Js + Electron ) project boilerplate in TypeScript, with TailwindCSS + Shadcn/ui, web and desktop crossbuild'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('bg-background min-h-screen font-sans antialiased', fontSans.variable)}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Page Components with Shadcn/ui

```typescript
// renderer/app/page.tsx - Home page example
import React from 'react'
import Image from 'next/image'

function IndexPage() {
  return (
    <main className="flex flex-col items-center gap-2 pt-10">
      <Image
        priority
        src="/images/logo.png"
        alt="logo"
        width={150}
        height={150}
      />
      <h1 className="text-lg font-semibold">
        Nextron ( Next.Js + Electron ) Boilerplate
      </h1>
      <p>With TypeScript, TailwindCSS and Shadcn/ui</p>
      <p>Crossbuild for Web or Desktop</p>
    </main>
  )
}

export default IndexPage

// Example: Page with Shadcn components (after installing)
// npx shadcn@latest add button card
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

function DashboardPage() {
  return (
    <main className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Welcome to your dashboard</p>
          <Button variant="default">Click me</Button>
        </CardContent>
      </Card>
    </main>
  )
}
```

### Theme Provider Configuration

```typescript
// renderer/components/providers/theme-provider.tsx
'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type ThemeProviderProps } from 'next-themes/dist/types'

function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

export default ThemeProvider

// Usage: Theme toggle component
// npx shadcn@latest add dropdown-menu
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ThemeToggle() {
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

## Utility Functions and Helpers

### TailwindCSS Class Merging Utility

```typescript
// renderer/lib/utils.ts - Class name utility
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Usage: Merge classes with proper precedence
import { cn } from '@/lib/utils'

function Component({ className, variant }: { className?: string; variant?: 'default' | 'primary' }) {
  return (
    <div
      className={cn(
        'px-4 py-2 rounded-md',
        variant === 'primary' && 'bg-primary text-primary-foreground',
        variant === 'default' && 'bg-secondary text-secondary-foreground',
        className
      )}
    >
      Content
    </div>
  )
}
```

## Configuration Files

### Next.js Configuration for Static Export

```javascript
// renderer/next.config.js
/** @type {import('next').NextConfig} */
module.exports = {
  output: 'export',
  distDir: process.env.NODE_ENV === 'production' ? '../dist' : '.next',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  webpack: config => {
    return config
  }
}

// Static export enables:
// - Self-contained dist/ folder with all HTML/CSS/JS
// - No Node.js server required for web deployment
// - Compatible with Electron's file:// protocol
// - Deploy to any static hosting (Netlify, Vercel, S3, etc.)
```

### TailwindCSS Configuration with Shadcn/ui Theme

```javascript
// renderer/tailwind.config.js
import { fontFamily } from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './renderer/app/**/*.{ts,tsx}',
    './renderer/components/**/*.{ts,tsx}'
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans]
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
```

### Electron Builder Configuration

```yaml
# electron-builder.yml - Packaging configuration
appId: com.example.nextron
productName: My Nextron App
copyright: Copyright © 2024 Maxime Premont
directories:
  output: dist
  buildResources: resources
files:
  - from: .
    filter:
      - package.json
      - app
publish: null
linux:
  target:
    - deb
    - rpm
    - snap
  category: Utility

# Customize for your app:
# - Change appId to your reverse domain (com.yourcompany.yourapp)
# - Update productName to your application name
# - Modify copyright information
# - Add icons: resources/icon.png (1024x1024 recommended)
# - Configure Windows: add win: section with target: nsis
# - Configure macOS: add mac: section with category and entitlements
```

## Summary

This boilerplate provides a complete foundation for building cross-platform applications with modern web technologies. The main use cases include: (1) desktop applications that need web-based UI with native capabilities like file system access, system tray, or auto-updates; (2) progressive web apps that can be deployed as both web and desktop versions from a single codebase; (3) internal tools and dashboards that benefit from offline capabilities and native integrations. The Shadcn/ui integration provides accessible, customizable components that work identically in both web and desktop contexts.

The project's architecture promotes separation of concerns through Electron's security model: the main process handles privileged operations, the renderer process runs the isolated React application, and the preload script provides a controlled bridge with type safety. Configuration is minimal yet flexible - the Next.js static export works seamlessly with Electron's protocol serving, TailwindCSS provides utility-first styling with dark mode support, and electron-builder handles packaging for Windows, macOS, and Linux. Teams can extend this foundation with additional Shadcn components, custom IPC channels, native modules, or deployment pipelines while maintaining the cross-platform development workflow.
