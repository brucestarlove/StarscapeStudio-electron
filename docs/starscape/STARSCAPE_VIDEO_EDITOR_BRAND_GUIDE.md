# Starscape Video Editor - Brand & Component Guide
*Desktop Video Editing Application powered by Starscape Design System*

## Brand Overview

Starscape represents a premium, cosmic-inspired aesthetic that combines professional-grade functionality with an elegant, mysterious visual language. This guide describes how the Starscape brand manifests in a fully-featured desktop video editor application.

### Core Brand Values

**Mystery & Sophistication**
The interface reveals its power gradually, maintaining an air of elegance while providing professional tools. Users discover features through intuitive exploration rather than overwhelming menus.

**Cosmic Aesthetic**
Deep space themes with starfield effects, nebula-inspired gradients, and celestial color palettes create an immersive creative environment that inspires rather than distracts.

**Premium Experience**
Every interaction feels refined - from subtle animations to glass morphism effects that suggest depth and quality. The interface communicates that this is a professional tool for serious creators.

**Clarity Through Darkness**
Despite the dark theme optimized for long editing sessions, content remains crisp, readable, and actionable. The darkness serves the user, not the other way around.

---

## Design Philosophy for Video Editing

### Dark-First Interface
The primary background uses deep navy tones (`#1a1a2e`) to reduce eye strain during extended editing sessions. This isn't just "dark mode" - it's a carefully crafted environment where darkness provides contrast and visual hierarchy without sacrificing readability.

### Glass Morphism Layering
Tool panels, property inspectors, and modal dialogs employ glass morphism effects with subtle transparency and backdrop blur. This creates a sense of depth and spatial organization, helping users understand which UI elements are "in front" and which provide context behind.

### Gradient Accents for Semantic Meaning
Starscape's signature gradients (cyan-purple, purple-blue, pink-purple, cyan-vibrant) serve specific purposes:
- **Cyan-Purple**: Primary actions, active selections
- **Purple-Blue**: Secondary features, professional tools
- **Pink-Purple**: Premium effects, special features
- **Cyan-Vibrant**: Success states, brand elements, progress indicators

---

## Video Editor Interface Layout

### Main Application Structure

```
┌────────────────────────────────────────────────────────────────────┐
│ App Header - Project name, Export, Settings, Render Queue          │
├────────────────────────────────────────────────────────────────────┤
│ Toolbar - Tools organized in groups with gradient highlights       │
├────────────┬────────────────────────────────────────┬──────────────┤
│            │                                        │              │
│  Media     │        Canvas / Preview Area           │  Properties  │
│  Library   │   (Video preview with playback head)   │   Panel      │
│            │                                        │              │
│  (Tree)    │                                        │ (Selected    │
│            │                                        │  clip        │
│            │                                        │  settings)   │
├────────────┴────────────────────────────────────────┴──────────────┤
│                      Timeline Area                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Track 1: Video Layer (clips with gradient fills)             │  │
│  │ Track 2: Video Layer                                         │  │
│  │ Track 3: Audio Layer (waveforms visible)                     │  │
│  │ Track 4: Effects/Overlays                                    │  │
│  │ Track 5: Subtitles                                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  Playback Controls & Timecode                                      │
└────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Application Header

**Visual Description:**
A streamlined horizontal bar with dark navy background and subtle bottom border in light blue. Contains:
- Left: Starscape logo with subtle pulse animation
- Center: Project name (editable on click) with gradient text effect
- Right: Export button (cyan-vibrant gradient), Settings icon, Render queue icon with badge

**Behavior:**
Fixed at top, remains visible during scrolling. Project name shows hover state with light blue glow. Export button is the most prominent element, using the vibrant cyan gradient to draw attention.

---

### 2. Toolbar

**Visual Description:**
A secondary horizontal bar below the header, featuring tool groups separated by subtle dividers:
- **Import Group**: Add media, record, capture
- **Edit Group**: Trim, split, cut, copy, paste
- **Effects Group**: Transitions, filters, color grading
- **Text Group**: Titles, subtitles, annotations
- **Audio Group**: Volume, fade, audio effects
- **Export Group**: Export, render, share

Each tool appears as an icon button with the signature Starscape styling. Active tools show a cyan-purple gradient background. Tool groups use spacing to create visual separation.

**Behavior:**
Buttons show hover states with slight scale-up and light blue glow. Click feedback includes a subtle downward movement. Currently selected tool maintains the gradient background until another tool is selected.

---

### 3. Media Library Panel (Left Sidebar)

**Visual Description:**
A collapsible side panel with dark glass background, featuring:
- Tree structure for project organization (folders, bins)
- Thumbnail grid view for media assets
- Search bar at top with subtle glass styling
- Filter/sort controls

Media thumbnails appear in glass cards with rounded corners. Video thumbnails show duration badges in the bottom-right corner. Hover states reveal additional metadata and quick action buttons.

**Behavior:**
Panel can be resized by dragging the right edge. Collapse button in header minimizes to icon-only mode. Tree items expand/collapse with smooth animations. Drag-and-drop from library to timeline shows cursor preview.

---

### 4. Canvas / Preview Area (Center)

**Visual Description:**
The largest screen real estate, showcasing:
- Main video preview with dark mid-navy background
- Playback head (cyan-vibrant vertical line)
- Canvas controls overlay (visible on hover): grid, rulers, safe zones
- Zoom controls in bottom-right corner
- Playback time and framerate in bottom-left

Canvas is letterboxed when aspect ratio doesn't match viewport. The surrounding area uses the deepest navy to frame the preview.

**Behavior:**
Hovering canvas reveals overlay controls with fade-in animation. Clicking canvas focuses it for keyboard shortcuts (spacebar play/pause, arrow keys frame advance). Scrubbing shows smooth playback with no lag.

---

### 5. Properties Panel (Right Sidebar)

**Visual Description:**
Context-sensitive panel showing properties for selected timeline element:
- **When clip selected**: Transform controls, opacity, blend modes, effects stack
- **When effect selected**: Effect-specific parameters with sliders, color pickers
- **When nothing selected**: Timeline settings, project properties

Panel uses dark glass background with accordion-style sections. Each section has a header with collapse/expand arrow. Input fields use the signature Starscape input styling with glass morphism.

**Behavior:**
Panel smoothly transitions between different property sets. Sliders show gradient fills as values increase. Color pickers open in modal overlays with the same glass styling. Real-time preview updates in canvas as parameters change.

---

### 6. Timeline Area (Bottom)

**Visual Description:**
The heart of the video editor, featuring:
- **Track headers (left)**: Track name, visibility toggle, lock toggle, solo button
- **Track content area**: Horizontal representation of time with clips as rounded rectangles
- **Playback head**: Vertical cyan-vibrant line spanning all tracks with diamond handle at top
- **Zoom controls**: Timeline zoom slider in bottom-right
- **Playback controls**: Play/pause, skip forward/back, loop toggle (centered at bottom)

#### Track Styling:
- **Video tracks**: Clips filled with purple-blue gradient
- **Audio tracks**: Waveform visualization with cyan-purple gradient overlay
- **Effect tracks**: Clips with pink-purple gradient
- **Active track**: Border highlight in light blue with elevated shadow

#### Clip Styling:
Each clip appears as a rounded rectangle with:
- Gradient fill indicating type
- Thumbnail preview for video clips (multiple frames)
- Waveform overlay for audio clips
- Label text with clip name (truncated with ellipsis if too long)
- Transition indicators at edges (if transitions applied)
- Effects badges in top-right corner

**Behavior:**
- **Selection**: Clips show light blue border and elevated shadow
- **Hover**: Slight scale-up with subtle glow
- **Dragging**: Semi-transparent preview follows cursor, snaps to other clips
- **Trimming**: Hover edges shows resize cursor, dragging adjusts duration
- **Multi-select**: Shift+click or drag-select rectangle with light blue outline
- **Playback head**: Draggable with smooth animation, snaps to clip boundaries when close

---

### 7. Tool Panels & Modals

#### Export Settings Modal

**Visual Description:**
Large centered modal with dark glass background, rounded corners, and light blue border:
- Header with "Export Video" title in gradient text
- Format selection dropdown (glass styling)
- Resolution/quality presets in pill-style buttons
- Advanced settings in collapsible accordion
- Progress bar (when exporting) with cyan-vibrant gradient
- Footer with Cancel (secondary button) and Export (primary button with gradient)

**Behavior:**
Opens with scale-up and fade animation. Backdrop uses dark overlay with blur. Clicking backdrop or pressing Escape closes modal. Export button shows loading state with spinner during render.

#### Effects Browser

**Visual Description:**
Side panel or modal showing categorized effects:
- Category tabs at top (Color, Blur, Distortion, Stylize, etc.)
- Grid of effect thumbnails with preview animations
- Search bar with glass styling
- Each effect card shows name and preview thumbnail

**Behavior:**
Hovering effect shows enlarged preview with glow. Clicking adds effect to selected clip. Drag-and-drop also supported. Recently used effects appear at top.

#### Color Grading Panel

**Visual Description:**
Specialized modal for color correction:
- Preview comparison (before/after slider)
- Color wheels for shadows, midtones, highlights
- Curve editor with gradient-colored curves
- LUT selection dropdown
- Presets gallery with thumbnail previews

**Behavior:**
Real-time preview updates in canvas. Color wheels respond to drag gestures with smooth interpolation. Curves show hover tooltips with exact values.

---

## Detailed Component Descriptions

### Buttons

#### Primary Action Buttons
**Used for**: Export, Render, Save Project, Apply Effect
- Deep blue background with subtle gradient
- White text in the signature button font (16px, weight 600)
- Moderate border radius for modern but professional feel
- Default shadow for depth
- **Hover**: Shifts to light blue background with dark navy text, translates up slightly, shadow increases
- **Active**: Brief downward movement for tactile feedback

#### Secondary Action Buttons
**Used for**: Cancel, Reset, Delete, Undo
- Transparent background with light blue border
- Light blue text
- Same border radius as primary
- No shadow initially
- **Hover**: Background fills with light blue, text changes to dark navy
- **Active**: Brief scale-down for feedback

#### Icon Buttons (Toolbar)
**Used for**: Tool selection, playback controls
- Small square or circular buttons with icon
- Transparent background initially
- **Hover**: Light blue background fade-in
- **Active**: Gradient background (cyan-purple) remains until deselected
- Icon color: White initially, maintains white on active state

#### Gradient Action Buttons
**Used for**: Export, Premium features, Special effects
- Cyan-vibrant gradient background
- White text
- Elevated shadow for prominence
- **Hover**: Slight brightness increase, scale-up, glow intensifies
- **Active**: Brief scale-down

---

### Input Fields

#### Text Inputs
**Used for**: Timeline labels, project name, clip names, search bars
- Semi-transparent light background initially
- Subtle border in light color
- Rounded corners (moderate radius)
- **Focus**: Background shifts to nearly opaque white, border changes to deep blue, subtle shadow appears
- Text color adjusts from white to dark navy on focus
- Placeholder text in semi-transparent style

#### Numeric Inputs & Sliders
**Used for**: Effect parameters, timeline zoom, opacity, duration
- Slider track: Dark glass with subtle border
- Slider fill: Gradient (cyan-vibrant) showing value progress
- Slider thumb: Circular with light blue color and shadow
- **Hover**: Thumb scales up slightly
- **Dragging**: Thumb shows elevated shadow, track brightens
- Numeric value display adjacent to slider, editable on click

#### Dropdowns / Select Menus
**Used for**: Format selection, preset selection, track type
- Similar styling to text inputs initially
- Chevron icon on right indicates dropdown
- **Open**: Dropdown menu appears below with dark glass background
- Menu items: Hover shows light blue background
- Selected item: Check mark icon, light blue text

#### Color Pickers
**Used for**: Text color, background color, effect tinting
- Small circular color preview button
- **Click**: Opens larger modal color picker overlay
- Color picker uses glass card styling with gradients for saturation/brightness
- Includes hex input field and opacity slider

---

### Cards & Panels

#### Glass Cards (Standard)
**Used for**: Media thumbnails, preset previews, info boxes
- Semi-opaque white background with high transparency
- Backdrop blur effect for glass morphism
- Rounded corners (larger radius for prominent cards)
- Thin light border
- Deep shadow for elevation

#### Dark Glass Cards
**Used for**: Tool panels, timeline, property inspector
- Dark semi-transparent background (navy tones with 85% opacity)
- Backdrop blur
- Light blue border for definition
- Elevated shadow
- Content inside maintains readability with white text

#### Gradient Cards
**Used for**: Premium features, highlighted items, selected clips
- Background uses one of the signature Starscape gradients
- White text and icons for contrast
- No border needed (gradient provides definition)
- Elevated shadow
- **Hover**: Slight brightness increase, scale-up animation

---

### Progress Indicators

#### Export/Render Progress Bar
- Container: Rounded pill shape with dark mid-navy background
- Fill: Cyan-vibrant gradient that animates left-to-right
- Percentage text centered on bar
- Smooth width animation as progress increases
- Time remaining estimate below bar in caption font

#### Loading Spinners
- Circular spinner with gradient stroke (cyan-purple)
- Rotates continuously with smooth easing
- Small size for button loading states
- Large size for full-screen loading
- Optional text label below

#### Buffer/Loading States
- Skeleton placeholders with subtle shimmer animation
- Shape matches expected content (rectangles for clips, circles for avatars)
- Pulse animation (opacity variation)
- Gradient overlay that shifts for shimmer effect

---

### Timeline-Specific Components

#### Clip (Video/Audio)
- Rounded rectangle with gradient fill (type-dependent)
- Thumbnail grid for video (multiple frames across duration)
- Waveform visualization for audio (gradient overlay)
- Text label at top (truncates with ellipsis)
- Duration badge in bottom-left
- **Hover**: Scale-up, glow effect, show trim handles at edges
- **Selected**: Light blue border, elevated shadow, handles always visible

#### Transition Indicator
- Small icon or shape at clip boundaries
- Shows transition type (fade, wipe, etc.)
- Duration represented by width
- **Hover**: Enlarges with tooltip showing type and duration

#### Keyframe Marker
- Small diamond or circle on effect property
- Appears on clips that have animated parameters
- Color: Cyan for video, purple for effects
- **Click**: Opens keyframe editor overlay

#### Track Header
- Dark glass background matching timeline
- Track name editable on double-click
- Icon buttons: Visibility (eye), lock, solo, mute (audio)
- **Active track**: Light blue left border indicator

---

### Modal Dialogs & Overlays

#### Standard Modal
**Structure:**
- Dark overlay backdrop with blur
- Centered modal content in dark glass card styling
- Header with title and close button (X)
- Content area with scrolling if needed
- Footer with action buttons (Cancel + Confirm)

**Behavior:**
- Opens with scale-up + fade animation
- Close with scale-down + fade
- Backdrop click or Escape key dismisses
- Focus trapped within modal for accessibility

#### Contextual Menu / Right-Click Menu
**Structure:**
- Small dark glass panel appearing at cursor position
- List of menu items with icons
- Dividers between groups
- Submenu indicators (chevron) where applicable

**Behavior:**
- Appears with fade-in
- Menu items highlight with light blue background on hover
- Click executes action and closes menu
- Click outside closes menu

#### Tooltip
**Structure:**
- Small dark glass pill
- White text in caption font
- Arrow pointing to reference element

**Behavior:**
- Appears after brief hover delay
- Follows cursor or anchors to element
- Fades out on mouse leave

---

## Advanced Features & Premium Elements

### AI-Powered Tools
Features that use AI (auto-reframe, transcription, smart trim) are visually distinguished:
- Icons have purple accent color
- Buttons use pink-purple gradient
- Processing states show pulsing purple glow
- Results appear in special purple-bordered panels

### Collaboration Features
When multiple users are editing:
- User cursors show with colored halos (user-specific colors)
- User avatars appear in timeline when selecting clips
- Changes sync with subtle pulse animation
- Conflict states highlighted in warning color (yellow)

### Keyboard Shortcut Overlays
**Activated by**: Holding a modifier key or pressing "?"
- Semi-transparent overlay appears over interface
- Key combinations shown next to relevant tools
- Uses glass card styling
- Dismisses on key release or click

---

## Responsive Behavior

### Minimum Width Threshold (1200px)
Below this width, the interface adapts:
- Side panels collapse to icon-only mode
- Timeline tracks show scrollbars
- Toolbar wraps to second line if needed
- Canvas remains centered, scales down proportionally

### Panel Resizing
All panels support:
- Drag handles between sections
- Smooth resize animation
- Minimum/maximum constraints
- Collapsed state (icon bar only)
- State persists in user preferences

### Full-Screen Modes
- **Canvas Full-Screen**: Hides all panels except playback controls
- **Timeline Full-Screen**: Expands timeline vertically, hides canvas
- **Presentation Mode**: Shows only canvas for client review
- All modes toggle with smooth animation and keyboard shortcuts

---

## Animation Philosophy

### Micro-Interactions (0.2s)
**Used for**: Button hovers, icon state changes, tooltip appearances
- Quick enough not to slow down workflow
- Ease-in-out timing for natural feel
- Subtle scale or position changes

### Panel Transitions (0.3s)
**Used for**: Panel expand/collapse, tab switches, accordion sections
- Ease-in-out for smooth open/close
- Height/width animations with overflow handling
- Content fades in after panel expands

### Modal Animations (0.25s)
**Used for**: Dialog appearances, overlay presentations
- Scale-up from 0.95 to 1.0
- Fade backdrop simultaneously
- Ease-out for snappy appearance
- Slightly faster dismiss (0.2s)

### Timeline Scrubbing (Instant)
**Used for**: Playback head movement, clip dragging
- No animation delay - follows cursor precisely
- Smooth interpolation without lag
- Snap animations when close to edges (0.1s quick ease)

### Progress/Loading (Variable)
**Used for**: Export progress, rendering indicators
- Smooth width transitions matching actual progress
- No artificial slowing
- Gradient flow animation for visual interest

### Success/Error States (0.5s)
**Used for**: Confirmation animations, error highlights
- Brief hold time (0.3s) before auto-dismiss
- Gentle bounce or pulse for attention
- Color transition for state change

---

## Accessibility Considerations

### Color Contrast
All text meets WCAG AA standards:
- White text on dark navy: >7:1 ratio
- Light blue on dark navy: >4.5:1 ratio
- Error/success colors pass contrast requirements
- Gradients ensure readable text overlay

### Keyboard Navigation
Complete keyboard control:
- Tab order follows logical workflow (header → toolbar → canvas → timeline)
- Arrow keys navigate timeline (left/right for time, up/down for tracks)
- Spacebar for play/pause
- J/K/L for rewind/pause/fastforward (industry standard)
- Escape closes modals and deselects
- Shortcuts shown in tooltips and help overlay

### Focus Indicators
All interactive elements show clear focus:
- Light blue outline with 2px offset
- Subtle shadow for depth
- Never hidden (accessible focus always visible)

### Screen Reader Support
Semantic HTML structure:
- Proper ARIA labels for complex interactions
- Timeline described with meaningful structure
- Live regions announce state changes
- Descriptive alt text for icons

### Reduced Motion
Respects system preference:
- Animations disabled or greatly reduced
- Instant state transitions instead of animated
- Essential feedback (like loading) uses opacity instead of motion
- User can override in settings

---

## Implementation Reference

All visual specifications, color values, spacing units, typography scales, shadow definitions, and gradient configurations are defined in:

**→ See `STARSCAPE_SHADCN_THEME_CONFIG.md`**

This companion document provides the technical implementation details for integrating Starscape design system with shadcn/ui and Tailwind CSS, including:
- Complete Tailwind config setup
- Shadcn component customizations
- Conflict resolution strategies
- CSS custom properties
- Component-specific styling overrides

---

## Best Practices

### Do's ✅
- Use the cosmic gradient background for main application canvas
- Apply glass morphism to floating panels and modals
- Maintain signature Starscape gradients for semantic meaning
- Implement smooth animations that enhance without distracting
- Keep timeline interactions instant and responsive
- Test performance with large projects (100+ clips)
- Preserve user panel layouts in local storage

### Don'ts ❌
- Don't use bright colors outside the defined palette
- Avoid animation delays in timeline scrubbing (must be instant)
- Never hide keyboard focus indicators
- Don't make modals dismissible during critical operations (like exporting)
- Avoid very small clickable areas (<24px touch target)
- Don't apply heavy blur effects to large panels (performance)
- Never use pure black (#000) - always use Starscape navy tones

---

## Design System Consistency

This video editor shares DNA with all Starscape applications:
- **Starscape Chat**: Messaging interface with similar glass cards and gradients
- **Starscape Canvas**: Drawing app with same color palette and interactions
- **Starscape Dashboard**: Analytics with matching data visualization styles

Users familiar with any Starscape app will immediately recognize and understand this video editor's interface patterns.

---

## Credits

**Starscape Design System** by Starlove  
**Video Editor Brand Guide** adapted from Starscape Chat theme

This brand guide describes the *conceptual* application of Starscape's design language to professional video editing software. For technical implementation details, refer to the accompanying configuration document.
