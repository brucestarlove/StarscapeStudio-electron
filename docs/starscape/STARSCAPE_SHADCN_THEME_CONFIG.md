# Starscape + shadcn/ui Theme Configuration
*Technical Implementation Guide for Tailwind CSS + shadcn/ui Integration*

## Overview

This document provides the complete technical configuration for integrating Starscape's design system with shadcn/ui components and Tailwind CSS. It includes conflict resolution strategies to ensure Starscape's cosmic aesthetic takes precedence over shadcn's defaults while maintaining component functionality.

---

## Table of Contents

1. [Tailwind Config Setup](#tailwind-config-setup)
2. [CSS Custom Properties](#css-custom-properties)
3. [Shadcn Component Overrides](#shadcn-component-overrides)
4. [Gradient Utilities](#gradient-utilities)
5. [Conflict Resolution](#conflict-resolution)
6. [Component-Specific Styling](#component-specific-styling)
7. [Animation Utilities](#animation-utilities)

---

## Tailwind Config Setup

### Complete tailwind.config.js

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // ===========================
      // STARSCAPE COLOR SYSTEM
      // ===========================
      colors: {
        // Starscape primary colors
        'dark-navy': '#1a1a2e',
        'mid-navy': '#16213e',
        'deep-blue': '#0f3460',
        'light-blue': '#a8c0ff',
        
        // Semantic colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        
        // Starscape semantic extensions
        success: '#4ade80',
        warning: '#fbbf24',
        error: '#f87171',
        info: '#60a5fa',
        purple: '#a855f7',
      },
      
      // ===========================
      // STARSCAPE GRADIENTS
      // ===========================
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        
        // Starscape signature gradients
        'gradient-cyan-purple': 'linear-gradient(135deg, #06B6D4, #3B82F6, #8B5CF6)',
        'gradient-purple-blue': 'linear-gradient(135deg, #9333ea, #3b82f6, #8b5cf6)',
        'gradient-pink-purple': 'linear-gradient(135deg, #ec4899, #8b5cf6, #6366f1)',
        'gradient-cyan-vibrant': 'linear-gradient(135deg, #00c4ff, #00ffff, #00aaff, #00e0ff, #00c4ff)',
        'gradient-cosmic': 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        'gradient-cosmic-hover': 'linear-gradient(135deg, #1f2233 0%, #1a2a47 50%, #0f3c6e 100%)',
        
        // Starscape starfield pattern
        'starfield': 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
      },
      
      // ===========================
      // SPACING (Starscape Scale)
      // ===========================
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        '2xl': '48px',
        '3xl': '64px',
        '4xl': '96px',
      },
      
      // ===========================
      // BORDER RADIUS
      // ===========================
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        
        // Starscape specific
        'xs': '4px',
        'xl': '16px',
        '2xl': '24px',
      },
      
      // ===========================
      // TYPOGRAPHY
      // ===========================
      fontSize: {
        'hero': ['56px', { lineHeight: '56px', fontWeight: '700' }],
        'h1': ['48px', { lineHeight: '52.8px', fontWeight: '700' }],
        'h2': ['36px', { lineHeight: '43.2px', fontWeight: '600' }],
        'h3': ['24px', { lineHeight: '31.2px', fontWeight: '600' }],
        'body-large': ['18px', { lineHeight: '28.8px', fontWeight: '400' }],
        'body': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-small': ['14px', { lineHeight: '21px', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '16.8px', fontWeight: '400' }],
        'button': ['16px', { lineHeight: '16px', fontWeight: '600' }],
      },
      
      // ===========================
      // BOX SHADOWS
      // ===========================
      boxShadow: {
        // Shadcn defaults
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'DEFAULT': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        
        // Starscape shadows
        'subtle': '0 2px 4px rgba(0, 0, 0, 0.1)',
        'default': '0 4px 12px rgba(0, 0, 0, 0.15)',
        'elevated': '0 8px 25px rgba(15, 52, 96, 0.3)',
        'deep': '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.2) inset',
        'glow': '0 0 20px rgba(255, 255, 255, 0.4)',
        'glow-blue': '0 0 15px rgba(168, 192, 255, 0.5)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.5)',
      },
      
      // ===========================
      // ANIMATIONS
      // ===========================
      keyframes: {
        // Shadcn defaults
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        
        // Starscape animations
        "pulse": {
          "0%, 100%": { 
            transform: "scale(1)", 
            opacity: "1" 
          },
          "50%": { 
            transform: "scale(1.05)", 
            opacity: "0.9" 
          },
        },
        "move-stars": {
          "from": { transform: "translate(0, 0)" },
          "to": { transform: "translate(50px, 50px)" },
        },
        "glow": {
          "0%, 100%": { 
            boxShadow: "0 0 20px rgba(168, 192, 255, 0.3)" 
          },
          "50%": { 
            boxShadow: "0 0 40px rgba(168, 192, 255, 0.6)" 
          },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "fade-in": {
          "from": { 
            opacity: "0", 
            transform: "translateY(20px)" 
          },
          "to": { 
            opacity: "1", 
            transform: "translateY(0)" 
          },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse": "pulse 3s ease-in-out infinite",
        "move-stars": "move-stars 30s linear infinite",
        "glow": "glow 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "fade-in": "fade-in 0.8s ease-out",
        "shimmer": "shimmer 2s linear infinite",
      },
      
      // ===========================
      // BACKDROP BLUR
      // ===========================
      backdropBlur: {
        'xs': '2px',
        'glass': '10px',
        'glass-strong': '20px',
      },
      
      // ===========================
      // Z-INDEX SCALE
      // ===========================
      zIndex: {
        'base': '0',
        'panels': '10',
        'toolbar': '20',
        'header': '30',
        'modal-backdrop': '40',
        'modal': '50',
        'tooltip': '60',
        'notification': '70',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    
    // Custom plugin for glass morphism utilities
    function({ addUtilities }) {
      const glassMorphism = {
        '.glass-white': {
          'background': 'rgba(255, 255, 255, 0.98)',
          'backdrop-filter': 'blur(10px)',
          '-webkit-backdrop-filter': 'blur(10px)',
        },
        '.glass-dark': {
          'background': 'rgba(26, 26, 46, 0.85)',
          'backdrop-filter': 'blur(20px)',
          '-webkit-backdrop-filter': 'blur(20px)',
        },
        '.glass-light': {
          'background': 'rgba(249, 249, 249, 0.1)',
          'backdrop-filter': 'blur(10px)',
          '-webkit-backdrop-filter': 'blur(10px)',
        },
      }
      
      const gradientText = {
        '.gradient-text': {
          'background': 'linear-gradient(135deg, #fff 0%, #a8c0ff 100%)',
          '-webkit-background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
          'background-clip': 'text',
        },
        '.gradient-text-cyan': {
          'background': 'linear-gradient(135deg, #00c4ff, #00ffff, #00aaff, #00e0ff, #00c4ff)',
          '-webkit-background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
          'background-clip': 'text',
        },
      }
      
      const cosmicBackground = {
        '.cosmic-bg': {
          'background': 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          'position': 'relative',
          'overflow': 'hidden',
        },
        '.cosmic-bg::before': {
          'content': '""',
          'position': 'absolute',
          'width': '100%',
          'height': '100%',
          'background-image': 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
          'background-size': '50px 50px',
          'animation': 'move-stars 30s linear infinite',
          'pointer-events': 'none',
        },
      }
      
      addUtilities({
        ...glassMorphism,
        ...gradientText,
        ...cosmicBackground,
      })
    },
  ],
}
```

---

## CSS Custom Properties

### globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ================================================
   STARSCAPE CSS CUSTOM PROPERTIES
   ================================================ */

@layer base {
  :root {
    /* ===========================
       SHADCN BASE VARIABLES
       (Adapted for Starscape)
       =========================== */
    
    --background: 210 24% 16%;        /* #1a1a2e - dark-navy */
    --foreground: 0 0% 100%;          /* white */

    --card: 217 30% 18%;              /* #16213e - mid-navy */
    --card-foreground: 0 0% 100%;     /* white */

    --popover: 217 30% 18%;           /* #16213e - mid-navy */
    --popover-foreground: 0 0% 100%;  /* white */

    --primary: 218 50% 25%;           /* #0f3460 - deep-blue */
    --primary-foreground: 0 0% 100%;  /* white */

    --secondary: 217 30% 18%;         /* #16213e - mid-navy */
    --secondary-foreground: 0 0% 100%; /* white */

    --muted: 217 20% 22%;             /* slightly lighter navy */
    --muted-foreground: 217 30% 70%;  /* light-blue variant */

    --accent: 225 80% 80%;            /* #a8c0ff - light-blue */
    --accent-foreground: 210 24% 16%; /* dark-navy */

    --destructive: 0 84% 70%;         /* #f87171 - error */
    --destructive-foreground: 0 0% 100%; /* white */

    --border: 225 50% 70% / 0.2;      /* light-blue with opacity */
    --input: 225 50% 70% / 0.1;       /* light-blue with more opacity */
    --ring: 225 80% 80%;              /* light-blue for focus */

    --radius: 12px;                   /* Default border radius */
    
    /* ===========================
       STARSCAPE SPECIFIC VARIABLES
       =========================== */
    
    /* Core colors */
    --starscape-dark-navy: #1a1a2e;
    --starscape-mid-navy: #16213e;
    --starscape-deep-blue: #0f3460;
    --starscape-light-blue: #a8c0ff;
    
    /* Glass effects */
    --starscape-glass-white: rgba(255, 255, 255, 0.98);
    --starscape-glass-dark: rgba(26, 26, 46, 0.85);
    --starscape-glass-light: rgba(249, 249, 249, 0.1);
    --starscape-overlay-dark: rgba(0, 0, 0, 0.4);
    
    /* Borders */
    --starscape-border-light: rgba(255, 255, 255, 0.1);
    --starscape-border-blue: rgba(168, 192, 255, 0.2);
    
    /* Semantic colors */
    --starscape-success: #4ade80;
    --starscape-warning: #fbbf24;
    --starscape-error: #f87171;
    --starscape-info: #60a5fa;
    --starscape-purple: #a855f7;
    
    /* Spacing scale */
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 16px;
    --spacing-lg: 24px;
    --spacing-xl: 32px;
    --spacing-2xl: 48px;
    --spacing-3xl: 64px;
    --spacing-4xl: 96px;
    
    /* Shadow definitions */
    --shadow-subtle: 0 2px 4px rgba(0, 0, 0, 0.1);
    --shadow-default: 0 4px 12px rgba(0, 0, 0, 0.15);
    --shadow-elevated: 0 8px 25px rgba(15, 52, 96, 0.3);
    --shadow-deep: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.2) inset;
    
    /* Typography scale */
    --font-hero: 56px;
    --font-h1: 48px;
    --font-h2: 36px;
    --font-h3: 24px;
    --font-body-large: 18px;
    --font-body: 16px;
    --font-body-small: 14px;
    --font-caption: 12px;
    --font-button: 16px;
    
    /* Animation durations */
    --duration-fast: 150ms;
    --duration-default: 300ms;
    --duration-slow: 500ms;
    --duration-slower: 800ms;
  }

  /* Dark mode - Starscape is dark-first, so this is minimal */
  .dark {
    --background: 210 24% 16%;
    --foreground: 0 0% 100%;
    /* Other values remain the same */
  }
}

/* ================================================
   BASE STYLES
   ================================================ */

@layer base {
  * {
    @apply border-border;
  }
  
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
  
  /* Starscape body defaults */
  body {
    background-color: var(--starscape-dark-navy);
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
}

/* ================================================
   COMPONENT OVERRIDES
   ================================================ */

@layer components {
  
  /* ===========================
     BUTTONS - Starscape Style
     =========================== */
  
  .btn-primary {
    @apply bg-gradient-cosmic text-white rounded-md px-7 py-3.5 
           font-semibold text-button shadow-default
           transition-all duration-200 ease-in-out
           hover:bg-gradient-cosmic-hover hover:-translate-y-0.5 hover:shadow-elevated
           active:translate-y-0;
  }
  
  .btn-secondary {
    @apply bg-transparent text-light-blue border-2 border-light-blue rounded-md 
           px-6 py-3 font-semibold text-button
           transition-all duration-200 ease-in-out
           hover:bg-light-blue hover:text-dark-navy;
  }
  
  .btn-gradient {
    @apply bg-gradient-cyan-vibrant text-white rounded-md px-7 py-3.5 
           font-semibold text-button shadow-elevated
           transition-all duration-200 ease-in-out
           hover:scale-105 hover:shadow-glow-cyan
           active:scale-95;
  }
  
  .btn-icon {
    @apply w-10 h-10 flex items-center justify-center rounded-md
           text-white bg-transparent transition-all duration-200
           hover:bg-light-blue/20 active:bg-light-blue/30;
  }
  
  /* ===========================
     CARDS - Starscape Glass
     =========================== */
  
  .card-glass {
    @apply glass-white rounded-xl border border-white/10 p-lg shadow-deep;
  }
  
  .card-dark-glass {
    @apply glass-dark rounded-xl border border-blue-light/20 p-lg shadow-elevated;
  }
  
  .card-gradient {
    @apply bg-gradient-purple-blue rounded-xl p-lg shadow-elevated text-white;
  }
  
  /* ===========================
     INPUTS - Starscape Style
     =========================== */
  
  .input-starscape {
    @apply w-full px-4 py-3 rounded-md
           bg-white/10 border-2 border-white/10 text-white
           placeholder:text-white/50
           transition-all duration-200
           focus:bg-white focus:text-dark-navy focus:border-deep-blue focus:shadow-subtle
           focus:outline-none;
  }
  
  /* ===========================
     MODALS - Starscape Overlay
     =========================== */
  
  .modal-backdrop {
    @apply fixed inset-0 bg-black/40 backdrop-blur-sm z-modal-backdrop;
  }
  
  .modal-content {
    @apply glass-dark rounded-xl border border-blue-light/20 
           p-xl shadow-elevated max-w-[90vw] max-h-[90vh] overflow-auto;
  }
  
  /* ===========================
     TIMELINE COMPONENTS
     =========================== */
  
  .timeline-track {
    @apply bg-mid-navy rounded-xs border border-white/10 p-sm mb-xs
           transition-all duration-200;
  }
  
  .timeline-track.active {
    @apply bg-gradient-cyan-purple border-light-blue shadow-default;
  }
  
  .timeline-clip {
    @apply bg-gradient-purple-blue rounded-xs px-sm py-xs
           text-white text-caption cursor-pointer
           transition-all duration-200
           hover:scale-105 hover:shadow-subtle;
  }
  
  .timeline-clip.selected {
    @apply border-2 border-light-blue shadow-default;
  }
  
  /* ===========================
     PROGRESS BARS
     =========================== */
  
  .progress-container {
    @apply bg-mid-navy rounded-full h-2 overflow-hidden;
  }
  
  .progress-bar {
    @apply bg-gradient-cyan-vibrant h-full transition-all duration-300 rounded-full;
  }
  
  /* ===========================
     TOOLTIPS
     =========================== */
  
  .tooltip {
    @apply glass-dark rounded-full px-3 py-1.5 text-caption text-white
           border border-white/10 shadow-default z-tooltip;
  }
}

/* ================================================
   UTILITY OVERRIDES
   ================================================ */

@layer utilities {
  
  /* Focus visible override for Starscape */
  .focus-starscape:focus-visible {
    @apply outline-none ring-2 ring-light-blue ring-offset-2 ring-offset-dark-navy;
  }
  
  /* Scrollbar styling */
  .scrollbar-starscape::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  .scrollbar-starscape::-webkit-scrollbar-track {
    background: var(--starscape-mid-navy);
    border-radius: 4px;
  }
  
  .scrollbar-starscape::-webkit-scrollbar-thumb {
    background: var(--starscape-light-blue);
    border-radius: 4px;
  }
  
  .scrollbar-starscape::-webkit-scrollbar-thumb:hover {
    background: var(--starscape-deep-blue);
  }
  
  /* Text gradient utilities */
  .text-gradient-starscape {
    @apply gradient-text;
  }
  
  .text-gradient-cyan {
    @apply gradient-text-cyan;
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

---

## Shadcn Component Overrides

### Strategy for Component Customization

Shadcn components can be customized in two ways:
1. **Via `components.json` configuration** (global defaults)
2. **Per-component override files** (specific customizations)

### components.json Configuration

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

---

## Component-Specific Overrides

### Button Component Override

**File:** `components/ui/button.tsx`

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-button font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-light-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Starscape primary button
        default: "bg-gradient-cosmic text-white shadow-default hover:bg-gradient-cosmic-hover hover:-translate-y-0.5 hover:shadow-elevated active:translate-y-0",
        
        // Starscape destructive button
        destructive: "bg-error text-white shadow-default hover:bg-error/90",
        
        // Starscape outline button (secondary)
        outline: "border-2 border-light-blue bg-transparent text-light-blue hover:bg-light-blue hover:text-dark-navy",
        
        // Starscape secondary variant
        secondary: "bg-mid-navy text-white shadow-subtle hover:bg-deep-blue",
        
        // Starscape ghost button
        ghost: "hover:bg-light-blue/20 hover:text-light-blue",
        
        // Starscape link button
        link: "text-light-blue underline-offset-4 hover:underline",
        
        // Starscape gradient button
        gradient: "bg-gradient-cyan-vibrant text-white shadow-elevated hover:scale-105 hover:shadow-glow-cyan active:scale-95",
      },
      size: {
        default: "h-10 px-7 py-3.5",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

---

### Card Component Override

**File:** `components/ui/card.tsx`

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: 'glass' | 'dark-glass' | 'gradient' | 'default' }
>(({ className, variant = 'default', ...props }, ref) => {
  const variantClasses = {
    glass: "glass-white border border-white/10 shadow-deep",
    'dark-glass': "glass-dark border border-blue-light/20 shadow-elevated",
    gradient: "bg-gradient-purple-blue shadow-elevated text-white",
    default: "bg-card text-card-foreground shadow-default",
  }
  
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl p-lg",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
})
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-md border-b border-white/10", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-h3 font-semibold leading-none tracking-tight text-light-blue", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-body-small text-white/70", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pt-md", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-md border-t border-white/10", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

---

### Input Component Override

**File:** `components/ui/input.tsx`

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Starscape input styling
          "flex h-10 w-full rounded-md px-4 py-3",
          "bg-white/10 border-2 border-white/10",
          "text-white placeholder:text-white/50",
          "transition-all duration-200",
          "focus-visible:bg-white focus-visible:text-dark-navy",
          "focus-visible:border-deep-blue focus-visible:shadow-subtle",
          "focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
```

---

### Dialog (Modal) Component Override

**File:** `components/ui/dialog.tsx`

```tsx
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // Starscape overlay styling
      "fixed inset-0 z-modal-backdrop bg-black/40 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Starscape modal content styling
        "fixed left-[50%] top-[50%] z-modal",
        "translate-x-[-50%] translate-y-[-50%]",
        "glass-dark rounded-xl border border-blue-light/20",
        "p-xl shadow-elevated",
        "w-full max-w-[90vw] max-h-[90vh] overflow-auto",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
        "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        "duration-200",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-light-blue focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4 text-white" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left pb-md border-b border-white/10",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-md border-t border-white/10",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-h3 font-semibold leading-none tracking-tight gradient-text",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-body-small text-white/70", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
```

---

## Gradient Utilities

### React Component for Gradient Backgrounds

**File:** `components/starscape/GradientButton.tsx`

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  gradient?: 'cyan-purple' | 'purple-blue' | 'pink-purple' | 'cyan-vibrant' | 'cosmic';
  children: React.ReactNode;
}

export const GradientButton: React.FC<GradientButtonProps> = ({
  gradient = 'cosmic',
  children,
  className,
  ...props
}) => {
  const gradientClasses = {
    'cyan-purple': 'bg-gradient-cyan-purple',
    'purple-blue': 'bg-gradient-purple-blue',
    'pink-purple': 'bg-gradient-pink-purple',
    'cyan-vibrant': 'bg-gradient-cyan-vibrant',
    'cosmic': 'bg-gradient-cosmic hover:bg-gradient-cosmic-hover',
  };

  return (
    <button
      className={cn(
        'px-7 py-3.5 rounded-md text-white font-semibold text-button',
        'shadow-default transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-elevated active:translate-y-0',
        gradientClasses[gradient],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
```

---

## Conflict Resolution

### Common shadcn/Tailwind Conflicts & Solutions

#### 1. Background Colors

**Problem:** Shadcn defaults to light backgrounds
**Solution:** CSS variables override in `globals.css`

```css
:root {
  --background: 210 24% 16%;  /* Starscape dark-navy */
  --card: 217 30% 18%;         /* Starscape mid-navy */
}
```

#### 2. Border Radius

**Problem:** Shadcn uses `--radius` variable
**Solution:** Set `--radius: 12px` to match Starscape's `lg` radius

#### 3. Focus Rings

**Problem:** Shadcn uses default blue focus rings
**Solution:** Override with Starscape light-blue

```css
.focus-visible\:ring-ring:focus-visible {
  --tw-ring-color: hsl(225 80% 80%);  /* light-blue */
}
```

#### 4. Shadow Defaults

**Problem:** Shadcn shadows too subtle for dark backgrounds
**Solution:** Use Starscape shadow scale (subtle, default, elevated, deep)

```js
// In tailwind.config.js
boxShadow: {
  'default': '0 4px 12px rgba(0, 0, 0, 0.15)',  // Override shadcn
  'elevated': '0 8px 25px rgba(15, 52, 96, 0.3)',
  'deep': '0 20px 60px rgba(0, 0, 0, 0.4)',
}
```

#### 5. Text Colors

**Problem:** Shadcn uses muted text colors
**Solution:** Set foreground colors to white, use light-blue for accents

```css
:root {
  --foreground: 0 0% 100%;          /* white */
  --accent: 225 80% 80%;            /* light-blue */
}
```

---

## Animation Utilities

### Custom Animation Classes

```css
/* Starscape-specific animation utilities */

.animate-pulse-slow {
  animation: pulse 3s ease-in-out infinite;
}

.animate-glow {
  animation: glow 2s ease-in-out infinite;
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}

.animate-shimmer {
  animation: shimmer 2s linear infinite;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
}

/* Hover animations */
.hover-lift {
  @apply transition-transform duration-200 hover:-translate-y-1;
}

.hover-scale {
  @apply transition-transform duration-200 hover:scale-105;
}

.hover-glow {
  @apply transition-shadow duration-200 hover:shadow-glow-blue;
}
```

---

## Usage Examples

### Complete Page Example

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function VideoEditorPage() {
  return (
    <div className="min-h-screen cosmic-bg">
      {/* Header */}
      <header className="bg-dark-navy border-b border-blue-light/20 p-lg shadow-default z-header">
        <div className="flex items-center justify-between">
          <h1 className="text-h3 gradient-text">Starscape Video Editor</h1>
          <Button variant="gradient">Export</Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-xl">
        <div className="grid grid-cols-12 gap-lg">
          {/* Media Library */}
          <aside className="col-span-3">
            <Card variant="dark-glass">
              <CardHeader>
                <CardTitle>Media Library</CardTitle>
              </CardHeader>
              <CardContent>
                <Input placeholder="Search media..." className="mb-md" />
                {/* Media thumbnails */}
              </CardContent>
            </Card>
          </aside>

          {/* Canvas */}
          <section className="col-span-6">
            <div className="bg-mid-navy rounded-xl p-xl shadow-elevated">
              {/* Video preview */}
            </div>
          </section>

          {/* Properties Panel */}
          <aside className="col-span-3">
            <Card variant="dark-glass">
              <CardHeader>
                <CardTitle>Properties</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Property controls */}
              </CardContent>
            </Card>
          </aside>
        </div>

        {/* Timeline */}
        <section className="mt-xl">
          <div className="timeline-track">
            <div className="timeline-clip">Video Clip 1</div>
          </div>
        </section>
      </main>
    </div>
  );
}
```

---

## Testing & Validation

### Visual Regression Testing

Ensure Starscape theme persists across shadcn updates:

1. **Screenshot testing**: Capture component states
2. **Color validation**: Verify CSS variables resolve correctly
3. **Gradient rendering**: Test across browsers (Safari backdrop-filter support)
4. **Animation performance**: Profile with Chrome DevTools

### Browser Support

- **Chrome/Edge**: Full support including backdrop-filter
- **Firefox**: Full support
- **Safari**: Full support (requires `-webkit-backdrop-filter`)

---

## Maintenance Guidelines

### When Updating shadcn Components

1. **Check CSS variable dependencies**: Ensure Starscape values preserved
2. **Test dark mode**: Verify theme consistency
3. **Review animation changes**: Maintain Starscape timing
4. **Validate gradients**: Confirm custom gradients still apply

### Adding New Components

1. Start with shadcn base component
2. Apply Starscape color system via CSS variables
3. Add glass morphism if floating/overlay component
4. Use Starscape spacing scale
5. Apply appropriate shadow from Starscape scale
6. Test against existing components for visual consistency

---

## Performance Optimization

### Glass Morphism Performance

```css
/* Optimize backdrop-filter for large elements */
.glass-optimized {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  /* Use transform for animations to enable GPU acceleration */
  will-change: transform;
  transform: translateZ(0);
}
```

### Gradient Performance

```css
/* Cache gradient backgrounds */
.gradient-cached {
  background-image: var(--cached-gradient);
  /* Set in inline style or CSS variable */
}
```

---

## Troubleshooting

### Issue: Glass effect not visible
**Solution:** Ensure backdrop-filter support and non-transparent background behind glass element

### Issue: Gradients not applying
**Solution:** Check `backgroundImage` in Tailwind config, verify class names match

### Issue: Animations janky
**Solution:** Use `transform` and `opacity` for animations, add `will-change` sparingly

### Issue: Focus rings invisible
**Solution:** Verify `--ring` CSS variable set to light-blue HSL value

---

## Credits

**Starscape Design System** by Starlove  
**shadcn/ui Integration** adapted for Starscape theme  
**Tailwind CSS** customized with Starscape tokens

This configuration ensures Starscape's cosmic aesthetic seamlessly integrates with shadcn/ui's component library while maintaining visual consistency and preventing style conflicts.
