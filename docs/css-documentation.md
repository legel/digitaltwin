# CSS Technical Documentation

## Overview
The CSS architecture provides styling for a full-screen 3D/2D visualization application with minimal UI overlay. The design philosophy emphasizes content visibility with non-intrusive controls that adapt between desktop and mobile layouts.

## Architecture

### File Organization
```
styles.css         → Core layout, containers, base styles
menu.css          → Unified control panel (buttons + dropdowns + layer controls)
GoogleMaps2D.css  → Hides default Google Maps controls
```

### Design System
- **Colors**: Ecodash brand blue (#072b2e), hover state (#0a3c46)
- **Typography**: Oxygen font family (300, 400, 700 weights)
- **Spacing**: 10px standard gap between controls
- **Borders**: 40px radius for circular buttons, 25px for dropdowns
- **Shadows**: Subtle elevation (0 2px 5px) with hover enhancement

### Z-Index Hierarchy
```
0     → 3D/2D viewer containers (base layer)
100   → Logo (top-left corner)
1000  → Control panel and navigation buttons
2000  → Message overlay (center screen)
3000  → Future modals/dialogs
```

## Unified Control Panel

### Structure
The control panel consolidates all UI elements into a cohesive unit that repositions based on viewport:
- **Desktop**: Fixed top-right (10px from edges)
- **Mobile**: Fixed bottom-center with transform centering

### Layout Implementation
```css
.control-panel {
    position: fixed;
    top: 10px;
    right: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 1000;
    pointer-events: none;  /* Click-through to 3D viewer */
}

.control-group {
    pointer-events: auto;  /* Re-enable for actual controls */
}

/* Mobile repositioning */
@media (max-width: 767px) {
    .control-panel {
        top: auto;
        bottom: 20px;
        left: 50%;
        right: auto;
        transform: translateX(-50%);
        flex-direction: column-reverse;  /* Buttons at bottom */
    }
}
```

### Button Styling
Six circular buttons (50x50px) with icon backgrounds:
```css
.control-button {
    width: 50px;
    height: 50px;
    background-color: #072b2e;
    border: none;
    border-radius: 40px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.control-button:hover {
    background-color: #0a3c46;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Icon buttons use background images */
.tilt-0-button { background-image: url('/images/down_0_degrees.png'); }
.home-button { background-image: url('/images/home.png'); }
/* Text button (2D/3D) uses same circular style */
.text-button { font-size: 18px; font-weight: bold; }
```

### Dropdown Styling
Site dropdown with 170px width (matches 3 buttons + 2 gaps):
```css
.control-item select {
    width: 170px;
    padding: 12px 20px;
    background-color: #072b2e;
    color: white;
    border: none;
    border-radius: 25px;
    font-family: 'Oxygen', sans-serif;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
}
```

### Layer Control Styling
Radio button groups with category headers:
```css
.layer-controls {
    background-color: #072b2e;
    border-radius: 10px;
    padding: 15px;
    max-height: 400px;
    overflow-y: auto;
}

.layer-category {
    margin-bottom: 15px;
}

.layer-category-header {
    color: #4CAF50;
    font-weight: bold;
    margin-bottom: 8px;
    padding-bottom: 5px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.layer-option {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    margin: 4px 0;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.layer-option:hover {
    background-color: rgba(255, 255, 255, 0.1);
}

/* Radio button custom styling */
.layer-option input[type="radio"] {
    width: 18px;
    height: 18px;
    margin-right: 10px;
    cursor: pointer;
    accent-color: #4CAF50;
}

/* Selected state */
.layer-option.selected {
    background-color: rgba(76, 175, 80, 0.2);
    border: 1px solid #4CAF50;
}

/* Zoom-to-feature animation */
@keyframes pulseOutline {
    0% { outline-width: 3px; }
    50% { outline-width: 5px; }
    100% { outline-width: 3px; }
}
```

## Visualization Colors

### Base Layer Colors
```css
/* PA/NPA default outlines */
.plantable-outline { color: white; }
.non-plantable-outline { color: #FF3333; }
```

### M1-M10 Parameter Colors
Each ecological parameter has a specific gradient representing its range:
```css
/* Color mappings match JavaScript interpolation */
M1 Moisture:   #996633 → #3366CC  (brown to blue)
M2 Light:      #CCCC33 → #33FF33  (yellow to green)
M3 pH:         #FF3333 → #3333FF  (red to blue)
M4-M6 NPK:     #8033CC → #33CC33  (purple to green)
M7 Organic:    #B3804D → #663319  (light to dark brown)
M8-M9 Risk:    #33CC33 → #FF3333  (green to red)
M10 Wind:      #B3E5FF → #1A5ACC  (light to dark blue)
```

These colors are applied dynamically when parameter layers are selected.

## Responsive Design

### Breakpoint Strategy
```
Desktop:    > 1024px  → Full-size controls, top-right position
Tablet:     768-1024px → Same as desktop
Mobile:     480-767px  → Bottom position, smaller controls (44px)
Small:      < 480px    → Further reduced (40px), tighter spacing
```

### Mobile Adaptations
- Control panel moves to bottom-center
- Buttons reduce from 50px → 44px → 40px
- Dropdowns stack vertically when space constrained
- Gaps tighten from 10px → 8px → 6px

## Key Features

### Accessibility
```css
/* Keyboard focus indicators */
:focus-visible {
    outline: 2px solid #4CAF50;
    outline-offset: 2px;
}

/* High contrast mode */
@media (prefers-contrast: high) {
    .control-button, select {
        border: 2px solid white;
    }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
    }
}
```

### Performance Optimizations
- GPU-accelerated transforms for hover states
- Fixed positioning prevents reflows
- Minimal paint operations
- No complex selectors or deep nesting

### Animations
```css
/* Entrance animation */
@keyframes fadeInDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}

.control-panel {
    animation: fadeInDown 0.3s ease-out;
}

/* Loading spinner */
.spinner {
    width: 30px;
    height: 30px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}
```

## Implementation Notes
- Control panel uses `pointer-events: none` to allow clicking through to 3D viewer
- Individual controls re-enable pointer events
- Message overlay is non-interactive by design
- Logo has subtle drop shadow for visibility on varied backgrounds
- Active button state uses green color (rgba(76, 175, 80, 0.9))
- Radio buttons use native styling with accent color customization
- Layer controls scroll when content exceeds 400px height
- Selected layers highlighted with green border and background

## Future Enhancements
1. CSS custom properties for theme management
2. Container queries for component-based responsiveness
3. Dark mode with adjusted parameter colors
4. Critical CSS extraction for performance
5. CSS-in-JS for dynamic gradient generation