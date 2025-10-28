# Vite - Next Generation Frontend Tooling

Vite is a modern build tool that provides lightning-fast development experience through native ES modules and highly optimized production builds via Rollup. It consists of two major components: a development server with instant server start and Hot Module Replacement (HMR), and a build command that bundles code for production. Vite's dev server serves source files over native ES modules, eliminating the need for bundling during development and enabling sub-second server startup regardless of application size.

The framework-agnostic architecture makes Vite extensible through a powerful plugin system compatible with Rollup plugins, offering full TypeScript support throughout its JavaScript API and plugin interface. Vite supports all major frontend frameworks including Vue, React, Svelte, and Solid, while providing rich built-in features like TypeScript transpilation, JSX support, CSS preprocessing, and asset handling out of the box.

## APIs and Key Functions

### Create Development Server

Programmatically create and start a Vite development server with custom configuration.

```js
import { createServer } from 'vite'

// Create development server with custom configuration
const server = await createServer({
  root: process.cwd(),
  server: {
    port: 3000,
    strictPort: true,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  plugins: [],
  optimizeDeps: {
    include: ['lodash-es']
  }
})

// Start listening on the configured port
await server.listen()

// Print server URLs to console
server.printUrls()

// Bind keyboard shortcuts for CLI interaction
server.bindCLIShortcuts({ print: true })

// Transform a URL programmatically (bypassing HTTP pipeline)
const result = await server.transformRequest('/src/main.js')
console.log(result.code) // Transformed JavaScript code

// Trigger HMR for a specific module
const module = server.moduleGraph.getModuleById('/src/components/App.vue')
if (module) {
  await server.reloadModule(module)
}

// Cleanup: close server when done
await server.close()
```

### Build for Production

Execute production build with custom configuration and output options.

```js
import { build } from 'vite'
import path from 'node:path'

// Single build configuration
const output = await build({
  root: path.resolve(__dirname, './src'),
  base: '/my-app/',
  build: {
    outDir: path.resolve(__dirname, './dist'),
    assetsDir: 'static',
    sourcemap: true,
    minify: 'terser',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        admin: path.resolve(__dirname, 'admin.html')
      },
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router']
        }
      }
    },
    terserOptions: {
      compress: {
        drop_console: true
      }
    }
  }
})

// Multi-build for different environments (client + SSR)
const clientBuild = build({
  build: {
    outDir: 'dist/client',
    manifest: true
  }
})

const ssrBuild = build({
  build: {
    outDir: 'dist/server',
    ssr: 'src/entry-server.js',
    rollupOptions: {
      output: {
        format: 'esm'
      }
    }
  }
})

await Promise.all([clientBuild, ssrBuild])
```

### Preview Production Build

Start a local server to preview production build output.

```js
import { preview } from 'vite'

const previewServer = await preview({
  preview: {
    port: 8080,
    open: true,
    strictPort: false,
    cors: true,
    headers: {
      'Cache-Control': 'public, max-age=3600'
    },
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  build: {
    outDir: 'dist'
  }
})

previewServer.printUrls()
previewServer.bindCLIShortcuts({ print: true })

// Preview server runs until manually closed
// Access at http://localhost:8080
```

### Define Configuration

Create type-safe Vite configuration with IntelliSense support.

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './'),
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`
      }
    },
    modules: {
      localsConvention: 'camelCase'
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: {
      overlay: true
    }
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1000
  }
})

// Conditional configuration based on command and mode
export default defineConfig(({ command, mode }) => {
  if (command === 'serve') {
    return {
      plugins: [vue()],
      server: { port: 3000 }
    }
  } else {
    return {
      plugins: [react()],
      build: { minify: 'terser' }
    }
  }
})
```

### Load Environment Variables

Load environment variables from .env files for use in configuration.

```js
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Load all env variables (not just VITE_ prefixed)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    define: {
      __APP_VERSION__: JSON.stringify(env.APP_VERSION),
      __API_URL__: JSON.stringify(env.API_URL),
    },
    server: {
      port: env.PORT ? Number(env.PORT) : 5173,
      proxy: {
        '/api': {
          target: env.API_BASE_URL,
          changeOrigin: true
        }
      }
    }
  }
})

// In application code, VITE_ prefixed vars are auto-loaded
// .env.local:
// VITE_API_KEY=abc123
// VITE_FEATURE_FLAG=true

// src/main.js:
console.log(import.meta.env.VITE_API_KEY) // 'abc123'
console.log(import.meta.env.MODE) // 'development' or 'production'
```

### Create Custom Plugin

Author Vite plugins to extend build and dev server functionality.

```js
import { Plugin } from 'vite'

// Simple transform plugin
export function myPlugin(): Plugin {
  return {
    name: 'my-plugin',

    // Transform custom file types
    transform(code, id) {
      if (id.endsWith('.custom')) {
        return {
          code: `export default ${JSON.stringify(code)}`,
          map: null
        }
      }
    }
  }
}

// Virtual module plugin
export function virtualModulePlugin(): Plugin {
  const virtualModuleId = 'virtual:my-config'
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  return {
    name: 'virtual-module',

    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId
      }
    },

    load(id) {
      if (id === resolvedVirtualModuleId) {
        return `export const config = { apiUrl: 'https://api.example.com' }`
      }
    }
  }
}

// HMR plugin with custom handling
export function hmrPlugin(): Plugin {
  return {
    name: 'custom-hmr',

    handleHotUpdate({ file, server, modules }) {
      if (file.endsWith('.data.json')) {
        console.log('Data file updated:', file)

        // Send custom event to client
        server.ws.send({
          type: 'custom',
          event: 'data-update',
          data: { file }
        })

        // Prevent default HMR
        return []
      }
    }
  }
}

// Usage in vite.config.js
import { defineConfig } from 'vite'
import { myPlugin, virtualModulePlugin, hmrPlugin } from './plugins'

export default defineConfig({
  plugins: [
    myPlugin(),
    virtualModulePlugin(),
    hmrPlugin()
  ]
})
```

### Middleware Mode Integration

Integrate Vite dev server into existing Node.js servers (Express, Koa, etc).

```js
import express from 'express'
import { createServer as createViteServer } from 'vite'

const app = express()

// Create Vite server in middleware mode
const vite = await createViteServer({
  server: {
    middlewareMode: true
  },
  appType: 'custom'
})

// Use vite's connect middleware
app.use(vite.middlewares)

// Custom API routes
app.get('/api/users', async (req, res) => {
  res.json({ users: ['Alice', 'Bob'] })
})

// SSR route handler
app.use('*', async (req, res, next) => {
  const url = req.originalUrl

  try {
    // Transform index.html
    let template = fs.readFileSync(
      path.resolve(__dirname, 'index.html'),
      'utf-8'
    )
    template = await vite.transformIndexHtml(url, template)

    // Load and render app
    const { render } = await vite.ssrLoadModule('/src/entry-server.js')
    const appHtml = await render(url)

    const html = template.replace(`<!--ssr-outlet-->`, appHtml)
    res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
  } catch (e) {
    vite.ssrFixStacktrace(e)
    next(e)
  }
})

app.listen(5173)
```

### Resolve Configuration

Programmatically resolve Vite configuration with all defaults applied.

```js
import { resolveConfig } from 'vite'

// Resolve config for development
const devConfig = await resolveConfig(
  {
    configFile: './vite.config.js',
    mode: 'development'
  },
  'serve',
  'development',
  'development'
)

console.log(devConfig.root) // Resolved project root
console.log(devConfig.server.port) // Resolved port number
console.log(devConfig.plugins) // All resolved plugins

// Check if an ID is considered an asset
const isAsset = devConfig.assetsInclude('/images/logo.png')
console.log(isAsset) // true

// Resolve config for production build
const buildConfig = await resolveConfig(
  { mode: 'production' },
  'build',
  'production',
  'production'
)

console.log(buildConfig.build.outDir) // 'dist'
console.log(buildConfig.build.minify) // 'esbuild' or 'terser'
```

### Command Line Interface

Vite CLI commands for development, build, and preview workflows.

```bash
# Start dev server on default port (5173)
vite

# Start dev server on custom port with CORS enabled
vite --port 3000 --host 0.0.0.0 --cors --open

# Force re-optimize dependencies
vite --force

# Start with custom config file
vite --config vite.custom.config.js --mode staging

# Build for production
vite build

# Build with source maps and custom output directory
vite build --sourcemap --outDir build --base /my-app/

# Build for SSR
vite build --ssr src/entry-server.js

# Build in watch mode for development
vite build --watch

# Preview production build
vite preview

# Preview on custom port
vite preview --port 8080 --open

# Show debug logs for specific features
vite --debug hmr,transform

# Enable profiling for performance analysis
vite build --profile
```

### Merge Configurations

Deep merge multiple Vite configuration objects.

```js
import { defineConfig, mergeConfig } from 'vite'

// Base configuration
const baseConfig = defineConfig({
  plugins: [],
  server: { port: 3000 },
  build: { outDir: 'dist' }
})

// Environment-specific overrides
const prodConfig = {
  build: {
    minify: 'terser',
    sourcemap: false
  }
}

// Merge configurations
export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    return mergeConfig(baseConfig, prodConfig)
  }
  return baseConfig
})

// Merge with callback config
export default defineConfig((configEnv) => {
  const baseConfigResolved = typeof baseConfig === 'function'
    ? baseConfig(configEnv)
    : baseConfig

  return mergeConfig(baseConfigResolved, {
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString())
    }
  })
})
```

### CSS Preprocessing

Transform CSS with preprocessors and extract CSS modules.

```js
import { preprocessCSS } from 'vite'

// Preprocess SCSS file
const result = await preprocessCSS(
  `$primary: #3498db;
   .button { background: $primary; }`,
  'styles.scss',
  resolvedConfig
)

console.log(result.code) // Compiled CSS
console.log(result.map) // Source map
console.log(result.deps) // Set of dependency file paths

// CSS Modules processing
const moduleResult = await preprocessCSS(
  `.title { color: red; }`,
  'component.module.css',
  resolvedConfig
)

console.log(moduleResult.modules) // { title: '_title_abc123' }
console.log(moduleResult.code) // ._title_abc123 { color: red; }

// Usage in vite.config.js for custom CSS processing
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "./src/variables.scss";`,
        api: 'modern-compiler'
      },
      less: {
        math: 'always'
      }
    },
    modules: {
      localsConvention: 'camelCaseOnly',
      generateScopedName: '[name]__[local]___[hash:base64:5]'
    },
    postcss: {
      plugins: [
        require('autoprefixer'),
        require('postcss-nested')
      ]
    }
  }
})
```

### Transform with esbuild

Transform JavaScript/TypeScript code using esbuild for fast transpilation.

```js
import { transformWithEsbuild } from 'vite'

// Transform TypeScript to JavaScript
const tsCode = `
  interface User {
    name: string;
    age: number;
  }

  const user: User = { name: 'Alice', age: 30 };
  export default user;
`

const result = await transformWithEsbuild(
  tsCode,
  'user.ts',
  {
    loader: 'ts',
    target: 'es2020',
    jsxFactory: 'h',
    jsxFragment: 'Fragment'
  }
)

console.log(result.code) // Transpiled JavaScript
console.log(result.map) // Source map

// Transform JSX with custom pragma
const jsxCode = `
  export const App = () => <div className="app">Hello</div>
`

const jsxResult = await transformWithEsbuild(
  jsxCode,
  'App.jsx',
  {
    loader: 'jsx',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment'
  }
)

console.log(jsxResult.code) // React.createElement('div', ...)
```

## Use Cases and Integration

Vite excels in modern frontend development workflows across single-page applications, multi-page applications, libraries, and server-side rendering scenarios. The instant server start makes it ideal for large-scale applications where traditional bundlers struggle with slow startup times. During development, Vite's native ESM approach means modules are transformed on-demand only when requested by the browser, enabling sub-100ms HMR regardless of application size. The plugin system allows seamless integration with any framework through official plugins (@vitejs/plugin-vue, @vitejs/plugin-react, @vitejs/plugin-svelte) while maintaining compatibility with the vast Rollup plugin ecosystem.

Production builds leverage Rollup's mature optimization capabilities including tree-shaking, code splitting, and asset optimization to generate highly efficient bundles. Vite's library mode enables building reusable component libraries with multiple output formats (ES modules, CommonJS, UMD), while the SSR support provides first-class integration with meta-frameworks like Nuxt, SvelteKit, and Astro. The middleware mode facilitates custom server integration for projects requiring backend logic alongside the dev server, and the JavaScript API enables programmatic control for advanced use cases like testing, custom build pipelines, and tooling integration. Environment variable handling, TypeScript support, and CSS preprocessing work out of the box, reducing configuration overhead while maintaining full customization options for complex requirements.

