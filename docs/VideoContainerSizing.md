# Video Container Responsive Sizing

The video container's minimum width responds to both browser height and width using the formula:

```
max(280px, min(55vh, 45vw))
```

## How It Works

| Browser State | Which Value Wins | Effect |
|---------------|------------------|--------|
| Tall browser | `55vh` | Video container expands |
| Narrow browser | `45vw` | Video container shrinks |
| Very small browser | `280px` | Absolute minimum floor |

## Values to Adjust

| Value | What it controls |
|-------|------------------|
| `280px` | Absolute minimum width (never smaller than this) |
| `55vh` | How much it expands as browser gets taller |
| `45vw` | How much it shrinks as browser gets narrower |

## Locations to Update

**You must update ALL 4 locations** when making changes:

### 1. CSS: Main grid layout (edit mode)
**Line ~230**
```css
.main-content {
  display: grid;
  grid-template-columns: max(280px, min(55vh, 45vw)) 20px 1fr;
```

### 2. CSS: Video section min-width
**Line ~278**
```css
.video-section {
  min-width: max(280px, min(55vh, 45vw));
```

### 3. CSS: Read mode grid layout
**Line ~2167**
```css
body[data-mode="read"] .main-content {
  grid-template-columns: max(280px, min(55vh, 45vw)) 1fr;
```

### 4. JavaScript: Dynamic calculation
**Line ~3319**
```javascript
function getVideoSectionMinWidth() {
  return Math.max(280, Math.min(window.innerHeight * 0.55, window.innerWidth * 0.45));
}
```

## Common Adjustments

### Make video larger on tall screens
Increase the `vh` value (e.g., `55vh` → `60vh`, and `0.55` → `0.60` in JS)

### Make video smaller on narrow screens
Decrease the `vw` value (e.g., `45vw` → `40vw`, and `0.45` → `0.40` in JS)

### Change the absolute minimum
Update `280px` in CSS and `280` in JS

## Export Template (5th location)

The export template in `getExportTemplate()` (line ~5039) generates custom CSS that preserves the user's chosen layout ratio while respecting the minimum width:

```javascript
grid-template-columns: minmax(max(280px, min(55vh, 45vw)), ${videoFr}fr) ${timelineFr}fr;
```

**If you change the minimum width formula**, also update the minmax in `getExportTemplate()`.

The export captures the ratio (not pixel width) so it scales properly on different screen sizes.

## Pitfall Warnings

### 1. CSS vs JavaScript sync
If you only update the JavaScript, the **initial page load** will still use the CSS values. The JS function is only called when:
- Dragging the resize handle
- Window resize events
- Switching to table view

### 2. Export template
If you only update the 4 main locations but forget the export template, exported files will have mismatched sizing.

Always update all 5 locations to keep them in sync.

---

## How Editor vs Export Layouts Work

The editor and export use slightly different layout approaches that interact in specific ways:

### Editor (Edit Mode)
- **3-column grid**: `[video section] [20px resize handle] [timeline]`
- The 20px middle column IS the draggable resize handle element
- Uses: `grid-template-columns: max(280px, min(55vh, 45vw)) 20px 1fr`

### Export (Read Mode)
- **2-column grid + gap**: `[video section] [timeline]` with `gap: 20px`
- No resize handle (hidden in read mode)
- CSS uses `fr` units to preserve ratio: `minmax(..., Xfr) Yfr`
- **JS overrides CSS on load** with exact pixel values

### The Layered System
1. **CSS sets initial layout** (fr-based, approximate)
2. **JS overrides immediately on DOMContentLoaded** (pixel-based, exact)
3. **JS handles all window resizes** (maintains ratio with `videoSectionWidthRatio`)

This layering exists because CSS `fr` units with `minmax()` don't distribute space exactly as expected when the minimum constraint is active.

---

## Recent Bug Fixes & Lessons Learned

### Fix 1: Export Missing Gap on Resize

**Problem**: When resizing the browser in exported files, the 20px gap between video and timeline disappeared.

**Cause**: The export template's custom CSS overrode the base read-mode CSS but didn't include `gap: 20px`:
```css
/* Base CSS had gap */
body[data-mode="read"] .main-content {
  grid-template-columns: max(280px, min(55vh, 45vw)) 1fr;
  gap: 20px;  /* This was present */
}

/* Custom CSS overrode it WITHOUT gap */
body[data-mode='read'] .main-content {
  grid-template-columns: minmax(..., 51fr) 49fr;
  /* gap: 20px was MISSING */
}
```

**Fix**: Added `gap: 20px` to the custom CSS in `getExportTemplate()`.

**Lesson**: When overriding CSS rules, remember to include ALL properties you need, not just the ones you're changing.

---

### Fix 2: Resize Stops Working After Table/Timeline Toggle

**Problem**: After switching from Timeline → Table → Timeline view, window resize no longer adjusted the layout correctly.

**Cause**: Two issues in the resize handler and view switching:

1. **`videoSectionWidthRatio` not updated**: When switching back to timeline view, `savedVideoSectionWidth` was restored but `videoSectionWidthRatio` wasn't recalculated. The resize handler checks `if (videoSectionWidthRatio !== null)` and skipped updates.

2. **Table view not handled in resize**: The resize handler didn't account for table view needing to stay at `minWidth`.

**Fix**:
- In `switchToTimelineView()`: Added ratio recalculation after restoring width:
  ```javascript
  const containerWidth = mainContent.offsetWidth;
  if (containerWidth > 0) {
    videoSectionWidthRatio = savedVideoSectionWidth / containerWidth;
  }
  ```

- In resize handler: Added explicit table view handling:
  ```javascript
  if (viewMode === 'table') {
    // Always keep at minWidth in table view
    mainContent.style.gridTemplateColumns = `${minWidth}px 20px 1fr`;
  } else if (videoSectionWidthRatio !== null) {
    // Timeline view: use ratio-based sizing
  }
  ```

**Lesson**: When switching views that change inline styles, ensure any dependent state variables (like ratios) are also updated.

---

### Fix 3: Export Initial Layout Offset

**Problem**: In exported files, a 50/50 split appeared slightly off (video too wide) on initial load, but snapped to correct position on first resize.

**Cause**: CSS `fr` units with `minmax()` don't distribute space exactly as expected:
```css
grid-template-columns: minmax(max(280px, min(55vh, 45vw)), 51fr) 49fr;
```
The browser tries to split 51:49, but if the minimum width > 51% of available space, the first column grows beyond 51%.

**Fix**: Initialize with pixel values on DOMContentLoaded in exports:
```javascript
const EXPORT_VIDEO_RATIO = ${videoSectionRatio};

// In DOMContentLoaded:
const availableWidth = containerWidth - gapWidth;
let videoWidth = availableWidth * EXPORT_VIDEO_RATIO;
videoWidth = Math.max(minWidth, videoWidth);
mainContent.style.gridTemplateColumns = videoWidth + 'px 1fr';
videoSectionWidthRatio = videoWidth / containerWidth;
```

**Lesson**: Don't rely on CSS `fr` units for precise proportional layouts when `minmax()` constraints are involved. Use JS to calculate exact pixel values.

---

## Key Variables for Resize Logic

| Variable | Purpose |
|----------|---------|
| `videoSectionWidthRatio` | Stores ratio (0-1) of video width to container width. Used by resize handler to maintain proportions. |
| `savedVideoSectionWidth` | Pixel width saved when entering table view, restored when returning to timeline. |
| `viewMode` | Current view ('timeline' or 'table'). Resize handler behaves differently per mode. |
| `isEditMode` | Edit mode uses 3-column grid (with handle), read mode uses 2-column + gap. |

## Debugging Resize Issues

If resize behavior breaks:
1. Check if `videoSectionWidthRatio` is being set (log it)
2. Check if `viewMode` is correct after view switches
3. Check if inline `gridTemplateColumns` style is being applied
4. Verify both CSS and JS are using same column structure (3-col vs 2-col + gap)
