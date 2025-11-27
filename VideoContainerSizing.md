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

## Pitfall Warning

If you only update the JavaScript, the **initial page load** will still use the CSS values. The JS function is only called when:
- Dragging the resize handle
- Window resize events
- Switching to table view

Always update all 4 locations to keep them in sync.
