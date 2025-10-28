# Electron Framework

Electron is a cross-platform desktop application framework that allows developers to build native desktop applications using web technologies: JavaScript, HTML, and CSS. Built on Node.js and Chromium, Electron provides a powerful runtime environment where developers can access both Node.js APIs for native system capabilities and web APIs for building user interfaces. Used by major applications like Visual Studio Code, Slack, Discord, and Microsoft Teams, Electron enables developers to write code once and deploy to macOS, Windows, and Linux.

The framework operates with a multi-process architecture consisting of a main process that controls the application lifecycle and manages browser windows, and multiple renderer processes that display web content. Communication between these processes happens through Inter-Process Communication (IPC) channels. Electron provides comprehensive APIs for window management, menus, dialogs, notifications, system integration, protocol handling, session management, and network operations. The contextBridge API ensures secure communication between isolated contexts, while the session API controls browser behavior, cookies, cache, and network settings.

## Application Lifecycle and Window Management

### Creating Basic Electron Application

```javascript
const { app, BrowserWindow } = require('electron')
const path = require('node:path')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Load remote URL
  mainWindow.loadURL('https://github.com')

  // Or load local HTML file
  // mainWindow.loadFile('index.html')
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
```

### Advanced Window Configuration

```javascript
const { BrowserWindow, screen } = require('electron')

// Create window with custom styling
const win = new BrowserWindow({
  width: 800,
  height: 600,
  backgroundColor: '#2e2c29',
  show: false, // Don't show until ready
  frame: false, // Frameless window
  transparent: true,
  titleBarStyle: 'hidden', // macOS traffic light buttons
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    sandbox: true
  }
})

// Show window gracefully when ready
win.once('ready-to-show', () => {
  win.show()
})

// Create modal child window
const child = new BrowserWindow({
  parent: win,
  modal: true,
  show: false,
  width: 400,
  height: 300
})

child.loadURL('https://github.com')
child.once('ready-to-show', () => {
  child.show()
})

// Position window on specific display
const displays = screen.getAllDisplays()
const externalDisplay = displays.find((display) => {
  return display.bounds.x !== 0 || display.bounds.y !== 0
})

if (externalDisplay) {
  win.setBounds({
    x: externalDisplay.bounds.x + 50,
    y: externalDisplay.bounds.y + 50,
    width: 800,
    height: 600
  })
}
```

## Inter-Process Communication (IPC)

### Renderer to Main Process (Two-way Communication)

```javascript
// main.js - Main Process
const { app, BrowserWindow, ipcMain, dialog } = require('electron')

async function handleFileOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'png', 'gif'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  if (!canceled) {
    return filePaths[0]
  }
}

async function handleDatabaseQuery(event, query) {
  try {
    // Simulate database query
    const result = await performDatabaseQuery(query)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

app.whenReady().then(() => {
  ipcMain.handle('dialog:openFile', handleFileOpen)
  ipcMain.handle('database:query', handleDatabaseQuery)
  createWindow()
})

// preload.js - Preload Script
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  queryDatabase: (query) => ipcRenderer.invoke('database:query', query)
})

// renderer.js - Renderer Process
const btn = document.getElementById('btn')
const filePathElement = document.getElementById('filePath')

btn.addEventListener('click', async () => {
  const filePath = await window.electronAPI.openFile()
  filePathElement.innerText = filePath
})

const queryBtn = document.getElementById('queryBtn')
queryBtn.addEventListener('click', async () => {
  const result = await window.electronAPI.queryDatabase('SELECT * FROM users')
  if (result.success) {
    console.log('Data:', result.data)
  } else {
    console.error('Error:', result.error)
  }
})
```

### Main to Renderer Process Communication

```javascript
// main.js
const { app, BrowserWindow, Menu, ipcMain } = require('electron')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  const menu = Menu.buildFromTemplate([
    {
      label: 'Counter',
      submenu: [
        {
          click: () => mainWindow.webContents.send('update-counter', 1),
          label: 'Increment',
          accelerator: 'CmdOrCtrl+Up'
        },
        {
          click: () => mainWindow.webContents.send('update-counter', -1),
          label: 'Decrement',
          accelerator: 'CmdOrCtrl+Down'
        }
      ]
    }
  ])
  Menu.setApplicationMenu(menu)

  mainWindow.loadFile('index.html')

  // Send periodic updates from main to renderer
  setInterval(() => {
    mainWindow.webContents.send('server-time', new Date().toISOString())
  }, 1000)
}

app.whenReady().then(createWindow)

// preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateCounter: (callback) => ipcRenderer.on('update-counter', (_event, value) => callback(value)),
  onServerTime: (callback) => ipcRenderer.on('server-time', (_event, time) => callback(time))
})

// renderer.js
const counter = document.getElementById('counter')
const timeDisplay = document.getElementById('time')

window.electronAPI.onUpdateCounter((value) => {
  const oldValue = Number(counter.innerText)
  const newValue = oldValue + value
  counter.innerText = newValue.toString()
})

window.electronAPI.onServerTime((time) => {
  timeDisplay.innerText = time
})
```

### One-way Renderer to Main Communication

```javascript
// main.js
const { app, BrowserWindow, ipcMain } = require('electron')

function handleSetTitle(event, title) {
  const webContents = event.sender
  const win = BrowserWindow.fromWebContents(webContents)
  win.setTitle(title)
}

function handleLogMessage(event, level, message) {
  console.log(`[${level.toUpperCase()}] ${message}`)
}

app.whenReady().then(() => {
  ipcMain.on('set-title', handleSetTitle)
  ipcMain.on('log-message', handleLogMessage)
  createWindow()
})

// preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (title) => ipcRenderer.send('set-title', title),
  log: (level, message) => ipcRenderer.send('log-message', level, message)
})

// renderer.js
const setButton = document.getElementById('btn')
const titleInput = document.getElementById('title')

setButton.addEventListener('click', () => {
  const title = titleInput.value
  window.electronAPI.setTitle(title)
})

window.electronAPI.log('info', 'Application started')
```

## Context Bridge and Secure API Exposure

### Exposing Safe APIs to Renderer

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

contextBridge.exposeInMainWorld('electron', {
  // Sync function
  platform: process.platform,

  // Async function
  readFile: async (filePath) => {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })
  },

  // Node.js crypto safely exposed
  crypto: {
    sha256sum(data) {
      const hash = crypto.createHash('sha256')
      hash.update(data)
      return hash.digest('hex')
    },
    randomBytes(size) {
      return crypto.randomBytes(size).toString('hex')
    }
  },

  // IPC safely exposed
  ipc: {
    send: (channel, data) => {
      const validChannels = ['toMain', 'save-data']
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data)
      }
    },
    receive: (channel, func) => {
      const validChannels = ['fromMain', 'data-update']
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => func(...args))
      }
    },
    invoke: (channel, ...args) => {
      const validChannels = ['get-data', 'save-file']
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args)
      }
    }
  },

  // Nested APIs
  fileSystem: {
    paths: {
      home: require('node:os').homedir(),
      temp: require('node:os').tmpdir()
    },
    operations: {
      exists: (filePath) => fs.existsSync(filePath),
      basename: (filePath) => path.basename(filePath),
      dirname: (filePath) => path.dirname(filePath)
    }
  }
})

// renderer.js - Usage in renderer process
async function loadData() {
  try {
    const filePath = '/path/to/file.txt'
    const content = await window.electron.readFile(filePath)
    console.log('File content:', content)
  } catch (error) {
    console.error('Failed to read file:', error)
  }
}

// Hash data
const hash = window.electron.crypto.sha256sum('hello world')
console.log('SHA-256:', hash)

// Use IPC
window.electron.ipc.send('toMain', { message: 'Hello from renderer' })

window.electron.ipc.receive('fromMain', (data) => {
  console.log('Received from main:', data)
})

// Check file existence
if (window.electron.fileSystem.operations.exists('/path/to/file')) {
  console.log('File exists')
}
```

## Session Management and Network Control

### Session Configuration and Cache Management

```javascript
const { app, BrowserWindow, session } = require('electron')

app.whenReady().then(() => {
  // Access default session
  const defaultSession = session.defaultSession

  // Create custom isolated session
  const customSession = session.fromPartition('persist:myapp')

  // Clear cache
  await defaultSession.clearCache()
  console.log('Cache cleared')

  // Get cache size
  const size = await defaultSession.getCacheSize()
  console.log(`Cache size: ${size} bytes`)

  // Clear specific storage data
  await defaultSession.clearStorageData({
    storages: ['cookies', 'localstorage', 'indexdb', 'websql'],
    origin: 'https://example.com',
    quotas: ['temporary', 'persistent', 'syncable']
  })

  // Set download behavior
  defaultSession.on('will-download', (event, item, webContents) => {
    // Set save path
    item.setSavePath('/tmp/' + item.getFilename())

    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        console.log('Download is interrupted but can be resumed')
      } else if (state === 'progressing') {
        if (item.isPaused()) {
          console.log('Download is paused')
        } else {
          const received = item.getReceivedBytes()
          const total = item.getTotalBytes()
          console.log(`Received ${received}/${total} bytes`)
        }
      }
    })

    item.once('done', (event, state) => {
      if (state === 'completed') {
        console.log('Download successfully completed')
      } else {
        console.log(`Download failed: ${state}`)
      }
    })
  })

  // Programmatically trigger download
  defaultSession.downloadURL('https://example.com/largefile.zip')

  const win = new BrowserWindow({
    webPreferences: {
      session: customSession // Use custom session
    }
  })
})
```

### Network Configuration and Proxy Settings

```javascript
const { session } = require('electron')

app.whenReady().then(async () => {
  const ses = session.defaultSession

  // Configure proxy
  await ses.setProxy({
    mode: 'fixed_servers',
    proxyRules: 'http://proxy.example.com:8080',
    proxyBypassRules: 'localhost,127.0.0.1,example.com'
  })

  // Network emulation for testing
  ses.enableNetworkEmulation({
    offline: false,
    latency: 500, // ms
    downloadThroughput: 6400 * 1024 / 8, // 6400 kbps
    uploadThroughput: 6400 * 1024 / 8
  })

  // Use Chromium's fetch API
  try {
    const response = await ses.fetch('https://api.example.com/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token123'
      },
      body: JSON.stringify({ query: 'search term' })
    })

    if (response.ok) {
      const data = await response.json()
      console.log('Response:', data)
    } else {
      console.error('HTTP error:', response.status)
    }
  } catch (error) {
    console.error('Fetch failed:', error)
  }

  // Disable network emulation
  ses.disableNetworkEmulation()
})
```

### Permission and Device Management

```javascript
const { session } = require('electron')

app.whenReady().then(() => {
  const ses = session.defaultSession

  // Handle permission requests
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents.getURL()

    if (permission === 'notifications' && url.startsWith('https://trusted.com')) {
      callback(true) // Grant permission
    } else if (permission === 'media' && url.startsWith('https://video-app.com')) {
      callback(true)
    } else {
      callback(false) // Deny permission
    }
  })

  // Permission check handler (called for every permission check)
  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    if (permission === 'clipboard-read' && requestingOrigin === 'https://trusted.com') {
      return true
    }
    return false
  })

  // USB device selection handler
  ses.on('select-usb-device', (event, details, callback) => {
    event.preventDefault()

    const selectedDevice = details.deviceList.find((device) => {
      // Select specific device by vendor/product ID
      return device.vendorId === 9025 && device.productId === 67
    })

    if (selectedDevice) {
      callback(selectedDevice.deviceId)
    } else {
      callback()
    }
  })

  // Set device permission handler
  ses.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'usb') {
      // Allow specific USB vendor
      if (details.device.vendorId === 123 && details.device.productId === 456) {
        return true
      }
    } else if (details.deviceType === 'hid') {
      // Allow HID devices from trusted origin
      if (details.origin === 'https://trusted.com') {
        return true
      }
    }
    return false
  })

  // Certificate verification
  ses.setCertificateVerifyProc((request, callback) => {
    const { hostname, certificate, verificationResult } = request

    if (hostname === 'internal-server.local') {
      // Accept self-signed certificate for internal server
      callback(0)
    } else {
      // Use Chromium's verification result
      callback(verificationResult === 'net::OK' ? 0 : -2)
    }
  })
})
```

## Custom Protocol Handling

### Registering Custom Protocol Schemes

```javascript
const { app, protocol, net } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

// Must be called before app ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: false
    }
  },
  {
    scheme: 'media',
    privileges: {
      standard: true,
      stream: true, // Enable streaming for large media files
      supportFetchAPI: true
    }
  }
])

app.whenReady().then(() => {
  // Handle app:// protocol
  protocol.handle('app', (req) => {
    const { host, pathname } = new URL(req.url)

    if (host === 'bundle') {
      if (pathname === '/') {
        return new Response('<h1>Welcome to App</h1>', {
          headers: { 'content-type': 'text/html' }
        })
      }

      // Serve files from app bundle
      const pathToServe = path.resolve(__dirname, 'assets', pathname)
      return net.fetch(pathToFileURL(pathToServe).toString())
    } else if (host === 'api') {
      // Proxy API requests
      return net.fetch('https://api.myserver.com' + pathname, {
        method: req.method,
        headers: req.headers,
        body: req.body
      })
    }

    return new Response('Not Found', { status: 404 })
  })

  // Handle media:// protocol with streaming
  protocol.handle('media', (req) => {
    const filePath = req.url.slice('media://'.length)
    const fullPath = path.join(__dirname, 'media', filePath)
    return net.fetch(pathToFileURL(fullPath).toString())
  })

  // Check if protocol is handled
  const isHandled = protocol.isProtocolHandled('app')
  console.log(`app:// protocol is handled: ${isHandled}`)

  const win = new BrowserWindow()
  win.loadURL('app://bundle/index.html')
})

// To unregister protocol
app.on('will-quit', () => {
  protocol.unhandle('app')
  protocol.unhandle('media')
})
```

### Session-Specific Protocol Handlers

```javascript
const { app, session, BrowserWindow, protocol, net } = require('electron')

app.whenReady().then(() => {
  const partition = 'persist:custom'
  const ses = session.fromPartition(partition)

  // Register protocol for specific session
  ses.protocol.handle('custom', (request) => {
    const url = request.url.slice('custom://'.length)

    // Custom protocol logic specific to this session
    if (url.startsWith('data/')) {
      const dataId = url.slice(5)
      const data = fetchDataById(dataId)
      return new Response(JSON.stringify(data), {
        headers: { 'content-type': 'application/json' }
      })
    }

    return new Response('Not Found', { status: 404 })
  })

  const win = new BrowserWindow({
    webPreferences: {
      partition: partition
    }
  })

  win.loadURL('custom://data/123')
})
```

## Network Requests and Clipboard Operations

### Making Network Requests with Net API

```javascript
const { app, net } = require('electron')

app.whenReady().then(async () => {
  // Using fetch API (recommended)
  try {
    const response = await net.fetch('https://api.github.com/repos/electron/electron', {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Electron-App'
      }
    })

    if (response.ok) {
      const data = await response.json()
      console.log('Repository stars:', data.stargazers_count)
      console.log('Repository forks:', data.forks_count)
    }
  } catch (error) {
    console.error('Request failed:', error)
  }

  // Using ClientRequest (lower-level API)
  const request = net.request({
    method: 'POST',
    url: 'https://api.example.com/submit',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  request.on('response', (response) => {
    console.log(`STATUS: ${response.statusCode}`)
    console.log(`HEADERS: ${JSON.stringify(response.headers)}`)

    response.on('data', (chunk) => {
      console.log(`BODY: ${chunk}`)
    })

    response.on('end', () => {
      console.log('No more data in response.')
    })

    response.on('error', (error) => {
      console.error(`ERROR: ${error}`)
    })
  })

  request.on('error', (error) => {
    console.error(`Request error: ${error}`)
  })

  request.write(JSON.stringify({ key: 'value' }))
  request.end()

  // Check network status
  const isOnline = net.isOnline()
  console.log(`Network status: ${isOnline ? 'Online' : 'Offline'}`)

  // DNS resolution
  const resolved = await net.resolveHost('github.com', {
    queryType: 'A',
    source: 'dns',
    cacheUsage: 'allowed',
    secureDnsPolicy: 'allow'
  })
  console.log('DNS resolution:', resolved)
})
```

### Clipboard Operations

```javascript
const { clipboard, nativeImage } = require('electron')

// Text operations
clipboard.writeText('Hello from Electron!')
const text = clipboard.readText()
console.log('Clipboard text:', text)

// HTML operations
clipboard.writeHTML('<h1>Hello</h1><p>This is <strong>HTML</strong> content</p>')
const html = clipboard.readHTML()
console.log('Clipboard HTML:', html)

// RTF operations
const rtf = '{\\rtf1\\ansi{\\fonttbl\\f0\\fswiss Helvetica;}\\f0\\pard\nThis is some {\\b bold} text.\\par\n}'
clipboard.writeRTF(rtf)
const rtfContent = clipboard.readRTF()

// Image operations
const image = nativeImage.createFromPath('/path/to/image.png')
clipboard.writeImage(image)
const clipboardImage = clipboard.readImage()
console.log('Image size:', clipboardImage.getSize())

// Bookmark operations (macOS/Windows)
clipboard.writeBookmark('Electron Homepage', 'https://electronjs.org')
const bookmark = clipboard.readBookmark()
console.log('Bookmark:', bookmark) // { title: 'Electron Homepage', url: 'https://electronjs.org' }

// Write multiple formats simultaneously
clipboard.write({
  text: 'Plain text content',
  html: '<b>HTML formatted</b> content',
  rtf: '{\\rtf1\\utf8 RTF content}',
  bookmark: 'Page Title'
})

// Check available formats
const formats = clipboard.availableFormats()
console.log('Available formats:', formats) // ['text/plain', 'text/html', ...]

// Check if specific format exists
const hasText = clipboard.has('text/plain')
const hasImage = clipboard.has('image/png')

// Clear clipboard
clipboard.clear()

// Linux selection clipboard (Linux only)
if (process.platform === 'linux') {
  clipboard.writeText('Selected text', 'selection')
  const selectedText = clipboard.readText('selection')
  console.log('Selection:', selectedText)
}
```

## System Dialogs and Native UI

### File and Message Dialogs

```javascript
const { dialog, BrowserWindow } = require('electron')

async function showDialogs() {
  const mainWindow = new BrowserWindow()

  // Open file dialog (async)
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select a file',
    defaultPath: '/home/user/documents',
    buttonLabel: 'Choose File',
    filters: [
      { name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp'] },
      { name: 'Videos', extensions: ['mkv', 'avi', 'mp4'] },
      { name: 'Documents', extensions: ['doc', 'docx', 'pdf', 'txt'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile', 'multiSelections', 'showHiddenFiles'],
    message: 'Select one or more files to open'
  })

  if (!result.canceled) {
    console.log('Selected files:', result.filePaths)
  }

  // Save file dialog
  const saveResult = await dialog.showSaveDialog(mainWindow, {
    title: 'Save file',
    defaultPath: '/home/user/untitled.txt',
    buttonLabel: 'Save',
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['showOverwriteConfirmation', 'createDirectory']
  })

  if (!saveResult.canceled) {
    console.log('Save path:', saveResult.filePath)
  }

  // Message box (information)
  const infoResponse = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Information',
    message: 'Operation completed successfully',
    detail: 'All files have been processed.',
    buttons: ['OK', 'View Details'],
    defaultId: 0,
    cancelId: 0
  })
  console.log('User clicked button:', infoResponse.response)

  // Message box (confirmation)
  const confirmResponse = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Confirm Action',
    message: 'Are you sure you want to delete these files?',
    detail: 'This action cannot be undone.',
    buttons: ['Cancel', 'Delete'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  })

  if (confirmResponse.response === 1) {
    console.log('User confirmed deletion')
  }

  // Error dialog
  dialog.showErrorBox('Error Occurred', 'An unexpected error has occurred. Please try again.')

  // Synchronous dialogs (blocks process - use sparingly)
  const files = dialog.showOpenDialogSync(mainWindow, {
    properties: ['openFile']
  })
  console.log('Selected synchronously:', files)
}
```

### Notifications

```javascript
const { Notification, app } = require('electron')

app.whenReady().then(() => {
  // Check if notifications are supported
  if (Notification.isSupported()) {
    // Basic notification
    const notification = new Notification({
      title: 'Basic Notification',
      body: 'This is a simple notification from Electron',
      silent: false
    })

    notification.show()

    // Advanced notification with actions (macOS)
    const advancedNotification = new Notification({
      title: 'Task Completed',
      subtitle: 'Background Process',
      body: 'Your file has been processed successfully',
      icon: '/path/to/icon.png',
      hasReply: true,
      replyPlaceholder: 'Type your response...',
      sound: 'default',
      urgency: 'critical',
      timeoutType: 'default',
      actions: [
        { type: 'button', text: 'View File' },
        { type: 'button', text: 'Dismiss' }
      ],
      closeButtonText: 'Close'
    })

    // Event handlers
    advancedNotification.on('show', () => {
      console.log('Notification shown')
    })

    advancedNotification.on('click', () => {
      console.log('Notification clicked')
      // Bring app to foreground or open specific window
    })

    advancedNotification.on('close', () => {
      console.log('Notification closed')
    })

    advancedNotification.on('reply', (event, reply) => {
      console.log('User reply:', reply)
    })

    advancedNotification.on('action', (event, index) => {
      console.log('Action button clicked:', index)
      if (index === 0) {
        // Handle "View File" action
      }
    })

    advancedNotification.show()
  } else {
    console.log('Notifications not supported on this system')
  }
})
```

## Menu Management

### Application and Context Menus

```javascript
const { app, Menu, BrowserWindow, MenuItem, dialog } = require('electron')

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600
  })

  // Application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: async () => {
            console.log('New file clicked')
          }
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog({
              properties: ['openFile']
            })
            if (!result.canceled) {
              console.log('Open file:', result.filePaths[0])
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => console.log('Save clicked')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: async () => {
            const result = await dialog.showSaveDialog({})
            if (!result.canceled) {
              console.log('Save as:', result.filePath)
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron')
            await shell.openExternal('https://electronjs.org')
          }
        },
        {
          label: 'Documentation',
          click: async () => {
            const { shell } = require('electron')
            await shell.openExternal('https://electronjs.org/docs')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  // Context menu
  mainWindow.webContents.on('context-menu', (event, params) => {
    const contextMenu = new Menu()

    // Add each spelling suggestion as menu item
    for (const suggestion of params.dictionarySuggestions) {
      contextMenu.append(new MenuItem({
        label: suggestion,
        click: () => mainWindow.webContents.replaceMisspelling(suggestion)
      }))
    }

    // Add separator if there are suggestions
    if (params.misspelledWord) {
      contextMenu.append(new MenuItem({ type: 'separator' }))
      contextMenu.append(new MenuItem({
        label: 'Add to dictionary',
        click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      }))
      contextMenu.append(new MenuItem({ type: 'separator' }))
    }

    // Standard context menu items
    if (params.isEditable) {
      contextMenu.append(new MenuItem({ label: 'Cut', role: 'cut' }))
      contextMenu.append(new MenuItem({ label: 'Copy', role: 'copy' }))
      contextMenu.append(new MenuItem({ label: 'Paste', role: 'paste' }))
    } else if (params.selectionText) {
      contextMenu.append(new MenuItem({ label: 'Copy', role: 'copy' }))
    }

    if (params.linkURL) {
      contextMenu.append(new MenuItem({ type: 'separator' }))
      contextMenu.append(new MenuItem({
        label: 'Copy Link',
        click: () => {
          const { clipboard } = require('electron')
          clipboard.writeText(params.linkURL)
        }
      }))
    }

    contextMenu.popup({ window: mainWindow })
  })

  mainWindow.loadFile('index.html')
}

app.whenReady().then(createWindow)
```

Electron provides a comprehensive desktop application framework that combines the flexibility of web technologies with native system capabilities. The framework's primary use cases include building cross-platform developer tools (IDEs, code editors), communication applications (chat clients, video conferencing), content creation tools (media editors, design applications), productivity software (note-taking apps, project management tools), and database administration interfaces. The multi-process architecture ensures stability and security, while the extensive API surface enables developers to access file systems, manage system dialogs, control windows, handle custom protocols, and integrate with operating system features like notifications and menus.

Integration patterns in Electron applications typically follow established architectural approaches. The IPC mechanism facilitates communication between main and renderer processes using secure channels exposed through the contextBridge API, ensuring context isolation while maintaining functionality. Session management controls browser behavior, network operations, cookies, and permissions at a granular level. Custom protocol handlers enable applications to serve local files, proxy API requests, or implement custom URL schemes. The net API provides Chromium-level networking capabilities with superior proxy support and system integration compared to Node.js HTTP modules. Applications commonly combine these APIs to create sophisticated desktop software: protocol handlers serve the application UI from local files, IPC channels enable renderer-to-main communication for native operations, session APIs manage authentication and network behavior, and native UI components (dialogs, menus, notifications) provide consistent user experiences across platforms. This architectural approach enables developers to build performant, secure, and feature-rich desktop applications using familiar web development skills.
