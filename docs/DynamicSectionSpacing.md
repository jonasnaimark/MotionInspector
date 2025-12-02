# Dynamic Section Spacing System

This document explains how Motion Inspector dynamically adjusts spacing between layer sections based on content height.

## Overview

The spacing system shows **16px gaps** between layer sections when content is short, and **0px gaps** when content overflows (needs scrolling). This maximizes readability for short specs while preserving space for longer ones.

## Key Components

### CSS Classes

Located around **line ~1652** in `MotionInspector.html`:

```css
/* Default: 16px section gap for short specs */
.timeline-label.layer-header.has-divider,
.timeline-track.layer-header.has-divider {
  border-top: 1px solid #555;
  margin-top: 15px;  /* 15px + 1px border = 16px total */
}

/* Compact: 0px section gap when content overflows */
.timeline-outer-wrapper.has-scroll .timeline-label.layer-header.has-divider,
.timeline-outer-wrapper.has-scroll .timeline-track.layer-header.has-divider {
  margin-top: 0;
}
```

### Global State

```javascript
let needsCompactSpacing = false;  // Shared between timeline and table modes
```

This global ensures both view modes use the same spacing state.

### Core Function: `updateSectionSpacing()`

Located around **line ~5270**. This is the main function that measures content and applies spacing.

```javascript
function updateSectionSpacing(forceRecheck = true) {
  const outerWrapper = document.querySelector('.timeline-outer-wrapper');
  const timelineSection = document.querySelector('.timeline-section');
  if (!outerWrapper || !timelineSection) return;

  if (forceRecheck) {
    // TABLE MODE: Clear explicit row heights before measuring
    // syncTableRowHeights() sets inline heights that prevent margin expansion
    const isTableMode = viewMode === 'table';
    const leftRows = isTableMode ? Array.from(document.querySelectorAll('.timeline-labels-column .timeline-label')) : [];
    const rightRows = isTableMode ? Array.from(document.querySelectorAll('.timeline-content-column .timeline-track.table-row')) : [];

    if (isTableMode) {
      leftRows.forEach(row => {
        row.style.removeProperty('height');
        row.style.removeProperty('min-height');
      });
      rightRows.forEach(row => {
        row.style.removeProperty('height');
        row.style.removeProperty('min-height');
      });
    }

    // Remove has-scroll to measure with EXPANDED spacing (16px margins)
    outerWrapper.classList.remove('has-scroll');

    // Force reflow to get accurate measurement
    void outerWrapper.offsetHeight;

    // Measure content height (includes everything inside scroll container)
    const contentHeight = outerWrapper.scrollHeight;

    // Calculate stable available height from timeline-section
    // Using timeline-section ignores the info box which changes height
    // timeline-section has 8px padding top + bottom = 16px total
    const availableHeight = timelineSection.clientHeight - 16;

    // If content would overflow, use compact spacing
    needsCompactSpacing = contentHeight > availableHeight;
  }

  // Apply the spacing class
  outerWrapper.classList.toggle('has-scroll', needsCompactSpacing);

  // TABLE MODE: Re-sync row heights after applying spacing
  if (viewMode === 'table') {
    syncTableRowHeights();
  }
}
```

## Why We Use `timeline-section` Height

Initially we used `outerWrapper.clientHeight` for available height, but the **info box** (detail panel) is a sibling that affects the scrollable area. When the info box appears/disappears, the available height changes, causing spacing to flicker.

**Solution**: Use `timelineSection.clientHeight` instead - this container's height is stable regardless of info box state.

```
┌─────────────────────────────────┐
│ .timeline-section (stable)      │ ← We measure this height
│ ┌─────────────────────────────┐ │
│ │ .timeline-outer-wrapper     │ │ ← Content measured here
│ │ (scrollable content)        │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ #detailPanel (info box)     │ │ ← This changes height
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

## Table Mode Considerations

### The Problem

`syncTableRowHeights()` sets explicit inline `height` and `min-height` on rows to keep left labels aligned with right content. These explicit heights **prevent margins from expanding** when we remove the `has-scroll` class for measurement.

### The Solution

Before measuring in table mode:
1. Clear all explicit heights from rows
2. Measure with expanded spacing
3. Apply the correct class
4. Re-run `syncTableRowHeights()` to restore alignment

### Required HTML Element

Table view **must** include the detail panel div even though we don't show info boxes in table mode:

```javascript
// In renderTableView() around line ~5972
html += `<div id="detailPanel"></div>`;
```

Without this, `showAnimationDetails()` errors out and breaks the update flow.

## All Places That Trigger Spacing Updates

### 1. Window Resize

```javascript
window.addEventListener('resize', () => {
  // ... other resize handling ...
  requestAnimationFrame(() => updateSectionSpacing(true));
});
```

### 2. View Mode Switching

In `switchToTableView()` and `switchToTimelineView()` around **lines ~5109 and ~5154**:

```javascript
// Apply class immediately to prevent flash
const outerWrapper = document.querySelector('.timeline-outer-wrapper');
if (outerWrapper && needsCompactSpacing) {
  outerWrapper.classList.add('has-scroll');
}

// Then verify after render
requestAnimationFrame(() => updateSectionSpacing(true));  // or false if just applying
```

### 3. Adding Rows/Sections

In all four add handlers (table/timeline x param/section):

```javascript
// Timeline mode handlers call showAnimationDetails() which triggers update
// Table mode handlers must explicitly call:
requestAnimationFrame(() => updateSectionSpacing(true));
```

**Important**: Table mode add handlers should NOT call `showAnimationDetails()` - info boxes only appear in timeline mode.

### 4. Deleting Rows/Sections

In `deleteAnimation()` and `deleteParentedLayer()`:

```javascript
requestAnimationFrame(() => updateSectionSpacing(true));
```

### 5. Undo/Redo

In `undo()` and `redo()` functions:

```javascript
requestAnimationFrame(() => updateSectionSpacing(true));
```

### 6. Refresh Active View

In `refreshActiveView()`:

```javascript
// Apply immediately
const outerWrapper = document.querySelector('.timeline-outer-wrapper');
if (outerWrapper && needsCompactSpacing) {
  outerWrapper.classList.add('has-scroll');
}

requestAnimationFrame(() => {
  requestAnimationFrame(() => updateSectionSpacing(false));
});
```

### 7. Scrollbar Visibility Changes

```javascript
// Called with forceRecheck=false to just apply existing state
updateSectionSpacing(false);
```

## Export Handling

The export must preserve spacing state so exported files display correctly.

### Export Template Function

`getExportTemplate()` at **line ~7019** accepts a `compactSpacing` parameter:

```javascript
function getExportTemplate(videoFileName, tabsJson, videoSectionRatio = null, compactSpacing = false) {
```

### Embedded Constant

The export embeds the spacing state:

```javascript
const EXPORT_COMPACT_SPACING = ${compactSpacing};
```

### Export Initialization

On load, the exported file applies spacing immediately then re-verifies:

```javascript
renderTimeline();

// Apply compact spacing immediately if it was compact in the editor
if (EXPORT_COMPACT_SPACING) {
  const outerWrapper = document.querySelector('.timeline-outer-wrapper');
  if (outerWrapper) {
    outerWrapper.classList.add('has-scroll');
  }
  needsCompactSpacing = true;
}

// Re-check (viewer's window may be different size)
requestAnimationFrame(() => updateSectionSpacing(true));
```

### Export Call Site

Around **line ~7394**:

```javascript
const exportHtml = getExportTemplate('', JSON.stringify(exportTabs), exportRatio, needsCompactSpacing);
```

## Common Issues & Debugging

### Spacing Not Updating

**Symptoms**: Spacing stuck in compact or expanded mode after adding/deleting rows.

**Check**:
1. Is `updateSectionSpacing(true)` being called? Add console.log to verify.
2. Is it wrapped in `requestAnimationFrame()`? DOM must be rendered first.
3. For table mode: Is `syncTableRowHeights()` setting explicit heights before measurement?

### Flash When Switching Views

**Symptoms**: Brief flash of wrong spacing when switching timeline/table.

**Fix**: Apply `has-scroll` class immediately after render, before `requestAnimationFrame`:

```javascript
if (needsCompactSpacing) {
  outerWrapper.classList.add('has-scroll');
}
```

### Table Mode Not Responding

**Symptoms**: Table mode spacing doesn't change until window resize.

**Check**:
1. Does table view HTML include `<div id="detailPanel"></div>`?
2. Are explicit row heights being cleared before measurement?
3. Is `syncTableRowHeights()` being called after applying the class?

### Export Shows Wrong Spacing

**Symptoms**: Exported file shows expanded spacing when it should be compact.

**Check**:
1. Is `needsCompactSpacing` being passed to `getExportTemplate()`?
2. Is `EXPORT_COMPACT_SPACING` embedded in the export?
3. Is the initialization code applying the class before/after `renderTimeline()`?

## Debugging Tips

Add these console.logs to `updateSectionSpacing()`:

```javascript
console.log('updateSectionSpacing', {
  forceRecheck,
  viewMode,
  contentHeight,
  availableHeight,
  needsCompactSpacing,
  hasScrollClass: outerWrapper.classList.contains('has-scroll')
});
```

## Summary of Key Lines

| What | Approximate Line |
|------|-----------------|
| CSS classes | ~1652 |
| `updateSectionSpacing()` | ~5270 |
| `switchToTimelineView()` | ~5109 |
| `switchToTableView()` | ~5154 |
| `refreshActiveView()` | ~7993 |
| `renderTableView()` detailPanel | ~5972 |
| `getExportTemplate()` | ~7019 |
| Export call site | ~7394 |
| Export initialization | ~7274 |

## Future Modifications

### To Change the Expanded Spacing Value

Edit the CSS around line ~1652:
```css
margin-top: 15px;  /* Change this (remember +1px for border) */
```

### To Change When Compact Mode Triggers

Edit the comparison in `updateSectionSpacing()`:
```javascript
needsCompactSpacing = contentHeight > availableHeight;  // Could add threshold
```

### To Add New Triggers

Follow this pattern:
```javascript
// After any DOM change that affects content height
requestAnimationFrame(() => updateSectionSpacing(true));
```

### To Debug Measurement Issues

Temporarily add visual debugging:
```javascript
console.log('Content:', contentHeight, 'Available:', availableHeight);
timelineSection.style.outline = '2px solid red';  // See what we're measuring
```

## Preserving Spacing During Re-renders

### The Problem

When `renderTimeline()` or `renderTableView()` is called (e.g., after dragging a bar, resizing, or reordering rows), the DOM is completely rebuilt. This clears the `has-scroll` class, causing the spacing to revert to expanded mode even though `needsCompactSpacing` is still true.

### The Solution

Both render functions must re-apply the spacing class at the end:

```javascript
// At the end of renderTimeline() and renderTableView()
const outerWrapper = document.querySelector('.timeline-outer-wrapper');
if (outerWrapper && needsCompactSpacing) {
  outerWrapper.classList.add('has-scroll');
}
```

### Key Locations

| Function | Approximate Line |
|----------|-----------------|
| `renderTimeline()` spacing preservation | ~9005 |
| `renderTableView()` spacing preservation | ~7005 |

### Why This Matters

Operations that call render functions without this fix would cause visual glitches:
- Dragging color bars horizontally
- Resizing bar edges (duration/delay changes)
- Reordering rows via drag and drop
- Any edit that triggers a re-render

The spacing would briefly flash to expanded mode before (potentially) being recalculated.
