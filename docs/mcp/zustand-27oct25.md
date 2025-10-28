# Zustand - State Management for React

Zustand is a small, fast, and scalable state-management solution using simplified flux principles. It provides a comfortable API based on hooks without boilerplate or opinions. The library handles React's challenging edge cases including the zombie child problem, React concurrency, and context loss between mixed renderers, making it one of the most robust state managers in the React ecosystem.

The core philosophy is simplicity: no context providers, no reducers requirement, and hooks as the primary means of consuming state. Zustand works seamlessly with React 18+ and supports both React and framework-agnostic vanilla JavaScript usage. The middleware system enables composable enhancements for persistence, devtools integration, and immutable updates with Immer.

## create - React Store Hook

Creates a React hook for state management with automatic re-rendering on state changes. The hook can be called with or without a selector, and exposes utility methods for external state access.

```typescript
import { create } from 'zustand'

// Basic store with state and actions
const useBearStore = create((set) => ({
  bears: 0,
  increasePopulation: () => set((state) => ({ bears: state.bears + 1 })),
  removeAllBears: () => set({ bears: 0 }),
}))

// Using in components
function BearCounter() {
  const bears = useBearStore((state) => state.bears)
  return <h1>{bears} around here...</h1>
}

function Controls() {
  const increasePopulation = useBearStore((state) => state.increasePopulation)
  return <button onClick={increasePopulation}>one up</button>
}

// External state access (outside React components)
const currentBears = useBearStore.getState().bears
useBearStore.setState({ bears: 10 })
const unsub = useBearStore.subscribe((state) => console.log(state))
```

## createStore - Vanilla Store

Creates a framework-agnostic store without React dependencies. Returns API utilities directly instead of a hook, suitable for use in any JavaScript environment.

```typescript
import { createStore } from 'zustand/vanilla'

// Create vanilla store
const store = createStore((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}))

// Access store methods
const { getState, setState, subscribe, getInitialState } = store

console.log(getState().count) // 0
setState({ count: 5 })
const unsub = subscribe((state, prevState) => {
  console.log('State changed from', prevState.count, 'to', state.count)
})

// Use vanilla store in React with useStore hook
import { useStore } from 'zustand'

const useCountStore = (selector) => useStore(store, selector)
const count = useCountStore((state) => state.count)
```

## useShallow - Prevent Unnecessary Re-renders

Hook that wraps selectors with shallow comparison to prevent re-renders when the selected output hasn't changed at the top level.

```typescript
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

const useBearStore = create((set) => ({
  nuts: 0,
  honey: 0,
  treats: { cookies: 5, cake: 3 },
  addNut: () => set((state) => ({ nuts: state.nuts + 1 })),
}))

function BearFood() {
  // Object destructuring - only re-renders when nuts or honey change
  const { nuts, honey } = useBearStore(
    useShallow((state) => ({ nuts: state.nuts, honey: state.honey }))
  )

  // Array destructuring - same behavior
  const [nuts2, honey2] = useBearStore(
    useShallow((state) => [state.nuts, state.honey])
  )

  // Derived values - re-renders when treat keys/order change
  const treatNames = useBearStore(
    useShallow((state) => Object.keys(state.treats))
  )

  return <div>Nuts: {nuts}, Honey: {honey}</div>
}
```

## persist - Persistence Middleware

Middleware that persists store state to storage (localStorage, sessionStorage, or custom storage implementations) with support for versioning, migration, and selective persistence.

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const useFishStore = create(
  persist(
    (set, get) => ({
      fishes: 0,
      addAFish: () => set({ fishes: get().fishes + 1 }),
    }),
    {
      name: 'food-storage', // unique storage key (required)
      storage: createJSONStorage(() => sessionStorage), // default is localStorage
      partialize: (state) => ({ fishes: state.fishes }), // select what to persist
      version: 1, // state schema version
      migrate: (persistedState, version) => {
        // Handle version migrations
        if (version === 0) {
          return { fishes: persistedState.fishes * 2 }
        }
        return persistedState
      },
      onRehydrateStorage: (state) => {
        console.log('Hydration starts')
        return (state, error) => {
          if (error) console.error('Hydration failed', error)
          else console.log('Hydration finished', state)
        }
      },
    }
  )
)

// Access persist API
useFishStore.persist.clearStorage() // Clear persisted data
useFishStore.persist.rehydrate() // Manually rehydrate
const hasHydrated = useFishStore.persist.hasHydrated() // Check hydration status
const unsub = useFishStore.persist.onFinishHydration((state) => {
  console.log('Hydration complete with state:', state)
})
```

## devtools - Redux DevTools Integration

Middleware that connects stores to Redux DevTools extension for time-travel debugging and action logging.

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

const useBearStore = create(
  devtools(
    (set) => ({
      bears: 0,
      fishes: 0,
      increase: () => set(
        (state) => ({ bears: state.bears + 1 }),
        undefined,
        'bear/increase' // Action name
      ),
      addFishes: (count) => set(
        (prev) => ({ fishes: prev.fishes + count }),
        undefined,
        { type: 'bear/addFishes', count } // Action with payload
      ),
    }),
    {
      name: 'BearStore', // Store name in devtools
      enabled: process.env.NODE_ENV !== 'production', // Disable in production
      anonymousActionType: 'unknown', // Default action name
      store: 'store1', // Group multiple stores
    }
  )
)

// Actions will appear in Redux DevTools with proper naming
// Use devtools.cleanup() if needed
useBearStore.devtools.cleanup()
```

## immer - Immutable Updates with Mutable Syntax

Middleware that enables Immer for immutable state updates using mutable-style syntax, simplifying nested state modifications.

```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

const useBeeStore = create(
  immer((set) => ({
    bees: 0,
    nested: {
      value: { deep: { count: 0 } }
    },
    addBees: (by) => set((state) => {
      state.bees += by // Direct mutation (Immer converts to immutable)
    }),
    incrementDeep: () => set((state) => {
      state.nested.value.deep.count += 1 // Easy nested updates
    }),
  }))
)

// Alternative: Use Immer directly without middleware
import { produce } from 'immer'

const useLushStore = create((set) => ({
  lush: { forest: { contains: { a: 'bear' } } },
  clearForest: () =>
    set(
      produce((state) => {
        state.lush.forest.contains = null
      })
    ),
}))
```

## subscribeWithSelector - Selective Subscriptions

Middleware that extends the subscribe method to support selector-based subscriptions with custom equality functions and immediate firing.

```typescript
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { shallow } from 'zustand/vanilla/shallow'

const useDogStore = create(
  subscribeWithSelector(() => ({
    paw: true,
    snout: true,
    fur: true,
    age: 5,
  }))
)

// Subscribe to specific property changes
const unsub1 = useDogStore.subscribe(
  (state) => state.paw,
  (paw, previousPaw) => console.log('Paw changed:', previousPaw, '->', paw)
)

// Subscribe with custom equality function
const unsub2 = useDogStore.subscribe(
  (state) => [state.paw, state.fur],
  (value) => console.log('Paw or fur changed', value),
  { equalityFn: shallow }
)

// Subscribe and fire immediately
const unsub3 = useDogStore.subscribe(
  (state) => state.age,
  (age) => console.log('Current age:', age),
  { fireImmediately: true }
)

// Regular subscription still works
const unsub4 = useDogStore.subscribe((state) => console.log('Any change', state))
```

## redux - Redux Pattern Middleware

Middleware that enables Redux-style reducer patterns with action dispatching.

```typescript
import { create } from 'zustand'
import { redux } from 'zustand/middleware'

const types = { increase: 'INCREASE', decrease: 'DECREASE' }

const reducer = (state, action) => {
  switch (action.type) {
    case types.increase:
      return { grumpiness: state.grumpiness + (action.by || 1) }
    case types.decrease:
      return { grumpiness: state.grumpiness - (action.by || 1) }
    default:
      return state
  }
}

const useGrumpyStore = create(redux(reducer, { grumpiness: 0 }))

// Dispatch actions
useGrumpyStore.dispatch({ type: types.increase, by: 2 })
useGrumpyStore.dispatch({ type: types.decrease })

// Use in components
function GrumpyComponent() {
  const grumpiness = useGrumpyStore((state) => state.grumpiness)
  const dispatch = useGrumpyStore((state) => state.dispatch)

  return (
    <button onClick={() => dispatch({ type: types.increase })}>
      Grumpiness: {grumpiness}
    </button>
  )
}
```

## combine - Initial State and Creator

Middleware that separates initial state from action creators for cleaner code organization.

```typescript
import { create } from 'zustand'
import { combine } from 'zustand/middleware'

const useStore = create(
  combine(
    // Initial state
    { count: 0, text: 'hello' },
    // Action creators
    (set) => ({
      inc: () => set((state) => ({ count: state.count + 1 })),
      dec: () => set((state) => ({ count: state.count - 1 })),
      setText: (text) => set({ text }),
    })
  )
)

// Full TypeScript inference for both state and actions
function Counter() {
  const count = useStore((state) => state.count)
  const inc = useStore((state) => state.inc)
  return <button onClick={inc}>{count}</button>
}
```

## Async Actions

Actions can be asynchronous - just call `set` when ready. Zustand doesn't distinguish between sync and async actions.

```typescript
import { create } from 'zustand'

const useFishStore = create((set) => ({
  fishies: {},
  isLoading: false,
  error: null,
  fetch: async (pond) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(pond)
      const data = await response.json()
      set({ fishies: data, isLoading: false })
    } catch (error) {
      set({ error: error.message, isLoading: false })
    }
  },
}))

function FishComponent() {
  const { fishies, isLoading, error, fetch } = useFishStore()

  React.useEffect(() => {
    fetch('/api/pond')
  }, [fetch])

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  return <div>Fishes: {JSON.stringify(fishies)}</div>
}
```

## Reading State in Actions

Access current state within actions using the `get` parameter.

```typescript
import { create } from 'zustand'

const useSoundStore = create((set, get) => ({
  sound: 'grunt',
  volume: 5,
  action: () => {
    const currentSound = get().sound
    const currentVolume = get().volume
    console.log(`Playing ${currentSound} at volume ${currentVolume}`)
    // Use current state to compute next state
    set({ volume: currentVolume + 1 })
  },
  reset: () => {
    const initialState = get()
    set({ sound: 'silence', volume: 0 })
  },
}))
```

## Overwriting State

Use the second parameter of `set` to replace state entirely instead of merging.

```typescript
import { create } from 'zustand'

const useFishStore = create((set) => ({
  salmon: 1,
  tuna: 2,
  // Merge by default (false)
  updateSalmon: () => set({ salmon: 10 }), // tuna remains
  // Replace entire state (true)
  deleteEverything: () => set({}, true), // clears everything including actions!
  // Replace but keep actions
  deleteTuna: () => set(({ tuna, ...rest }) => rest, true),
}))
```

## Transient Updates (No Re-render)

Subscribe to state changes without triggering re-renders for performance-critical updates.

```typescript
import { create } from 'zustand'
import { useEffect, useRef } from 'react'

const useScratchStore = create((set) => ({
  scratches: 0,
  scent: 'pine',
  scratchMore: () => set((state) => ({ scratches: state.scratches + 1 })),
}))

function Component() {
  const scratchRef = useRef(useScratchStore.getState().scratches)

  // Subscribe without re-rendering
  useEffect(() => {
    const unsub = useScratchStore.subscribe((state) => {
      scratchRef.current = state.scratches
      // Update DOM directly for performance
      document.getElementById('scratch-count').textContent = state.scratches
    })
    return unsub
  }, [])

  return <div id="scratch-count">{scratchRef.current}</div>
}
```

## React Context Integration

Use vanilla stores with React Context for dependency injection or prop-based initialization.

```typescript
import { createContext, useContext } from 'react'
import { createStore, useStore } from 'zustand'

// Create vanilla store
const createBearStore = (initialBears = 0) => createStore((set) => ({
  bears: initialBears,
  increase: () => set((state) => ({ bears: state.bears + 1 })),
}))

// Context
const BearStoreContext = createContext(null)

function App() {
  const store = createBearStore(5) // Initialize with props
  return (
    <BearStoreContext.Provider value={store}>
      <BearCounter />
    </BearStoreContext.Provider>
  )
}

function BearCounter() {
  const store = useContext(BearStoreContext)
  const bears = useStore(store, (state) => state.bears)
  const increase = useStore(store, (state) => state.increase)

  return <button onClick={increase}>Bears: {bears}</button>
}
```

## TypeScript Usage

TypeScript requires the double function call syntax `create<Type>()((set) => ...)` for proper type inference with middleware.

```typescript
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type {} from '@redux-devtools/extension'

interface BearState {
  bears: number
  increase: (by: number) => void
}

const useBearStore = create<BearState>()(
  devtools(
    persist(
      (set) => ({
        bears: 0,
        increase: (by) => set((state) => ({ bears: state.bears + by })),
      }),
      { name: 'bear-storage' }
    )
  )
)

// Vanilla store with TypeScript
import { createStore } from 'zustand/vanilla'

interface CountState {
  count: number
  increment: () => void
}

const countStore = createStore<CountState>()((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}))
```

## Middleware Composition

Chain multiple middleware together for combined functionality. Order matters - outer middleware wraps inner middleware.

```typescript
import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

interface State {
  nested: { count: number }
  increment: () => void
}

const useStore = create<State>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set) => ({
          nested: { count: 0 },
          increment: () => set((state) => {
            state.nested.count += 1
          }),
        }))
      ),
      { name: 'app-storage' }
    ),
    { name: 'AppStore' }
  )
)

// Now you have: Immer mutations, selector subscriptions, persistence, and devtools
const unsub = useStore.subscribe(
  (state) => state.nested.count,
  (count) => console.log('Count changed:', count)
)
```

## Summary

Zustand excels in scenarios requiring simple, performant state management without the ceremony of Redux or the limitations of React Context. Its primary use cases include global application state, shared component state, and real-time data synchronization where selective re-rendering is critical. The library's 1KB size and zero-dependency core make it ideal for both small projects and large-scale applications.

Integration patterns range from basic hook usage for simple state sharing to sophisticated compositions involving persistence, time-travel debugging, and immutable updates. The vanilla store API enables framework-agnostic usage in Node.js, web workers, or non-React environments, while the React bindings leverage `useSyncExternalStore` for optimal React 18+ compatibility. Zustand's unopinionated design allows gradual adoption - start with a simple store and add middleware as needs evolve, without refactoring existing code.
