# Container Padding & Video Sizing Guide

## Overview
This guide explains how to adjust the padding/margins around the video and timeline containers while keeping everything properly sized and aligned.

## Key Concept
The video height is calculated in **TWO places** that must stay in sync:
1. **CSS** - Sets the max-height constraint
2. **JavaScript** - Dynamically sizes the video wrapper on load

If these don't match, the video will briefly show at the correct size then "snap" to a different size.

---

## The Core Calculation

### Base Values
- **Top bar height**: `96px` (header + controls)
- **Container padding**: `2 × padding value` (top + bottom)

### Formula
```
Available height for content = window.innerHeight - top bar height - container padding
                            = window.innerHeight - 96px - (2 × padding)
```

**Example**: With `10px` padding:
```
Available height = window.innerHeight - 96px - 20px
                = window.innerHeight - 116px
```

---

## How to Change Container Padding

Let's say you want to change the padding from `10px` to `16px`.

### Step 1: Update Container Padding (CSS)

**File**: `MotionInspector.html`

**Video container** (~line 238):
```css
.video-section {
  background: #242424;
  border-radius: 8px;
  padding: 16px;  /* ← Change this */
  /* ... */
}
```

**Timeline container** (~line 391):
```css
.timeline-section {
  background: #242424;
  border-radius: 8px;
  padding: 16px;  /* ← Change this */
  /* ... */
}
```

### Step 2: Calculate New Value
```
New value = 96 + (2 × new padding)
         = 96 + (2 × 16)
         = 96 + 32
         = 128
```

### Step 3: Update CSS max-height (~line 286)
```css
video {
  display: block;
  width: 100%;
  height: 100%;
  max-height: calc(100vh - 128px);  /* ← Update this */
  /* ... */
}
```

### Step 4: Update JavaScript height calculation (~line 2508)
```javascript
const viewportMaxHeight = Math.max(0, window.innerHeight - 128);  // ← Update this
```

### Step 5: Update Tab Alignment (~line 691)
The tabs need to align with the timeline content, so adjust their left padding to match:
```css
.tabs-bar {
  /* ... */
  padding-left: 20px;  /* ← Adjust to align with new container padding */
}
```

**Rule of thumb**: Tab padding should be `container padding + 4px` to account for borders.
- Container padding `10px` → Tab padding `14px`
- Container padding `16px` → Tab padding `20px`

---

## Quick Reference Table

| Container Padding | Calculation | CSS max-height | JS viewportMaxHeight | Tab padding-left |
|-------------------|-------------|----------------|----------------------|------------------|
| `10px` | 96 + 20 = 116 | `calc(100vh - 116px)` | `window.innerHeight - 116` | `14px` |
| `12px` | 96 + 24 = 120 | `calc(100vh - 120px)` | `window.innerHeight - 120` | `16px` |
| `16px` | 96 + 32 = 128 | `calc(100vh - 128px)` | `window.innerHeight - 128` | `20px` |
| `20px` | 96 + 40 = 136 | `calc(100vh - 136px)` | `window.innerHeight - 136` | `24px` |

---

## Locations in Code

### CSS (in `<style>` block)
1. **Video section padding**: ~line 241
2. **Timeline section padding**: ~line 394
3. **Video max-height**: ~line 286
4. **Tabs alignment**: ~line 691

### JavaScript (in `<script>` block)
1. **Video height calculation**: ~line 2508
   - Search for: `viewportMaxHeight = Math.max(0, window.innerHeight`

---

## Verification Checklist

After making changes, verify:
- [ ] Video section padding matches timeline section padding
- [ ] CSS `max-height` uses correct calculation
- [ ] JavaScript `viewportMaxHeight` uses same number as CSS
- [ ] Tabs are aligned with timeline content (padding-left adjusted)
- [ ] Video loads at correct size without "snapping"
- [ ] Top/bottom gaps around video match timeline gaps

---

## Why This Matters

**Problem**: The video dimensions are set dynamically by JavaScript when the video loads. If the JavaScript calculation doesn't match the CSS max-height, the video will:
1. Initially render at the CSS max-height (correct)
2. Then JavaScript runs and recalculates (incorrect)
3. Video "snaps" to the wrong size

**Solution**: Keep CSS and JavaScript in sync using the same calculated value.

---

## Common Mistakes

❌ **Only updating CSS max-height**
- Video will snap to wrong size after loading

❌ **Using different padding for video vs timeline**
- Visual inconsistency, uneven spacing

❌ **Forgetting to update tab alignment**
- Tabs won't align with timeline content

❌ **Math error in calculation**
- Remember: `2 × padding` for top + bottom

✅ **Update all 4 locations with correct calculated values**

---

## Example: Changing from 10px to 16px

```css
/* 1. Video section */
.video-section {
  padding: 16px;  /* was: 10px */
}

/* 2. Timeline section */
.timeline-section {
  padding: 16px;  /* was: 10px */
}

/* 3. Video max-height (96 + 32 = 128) */
video {
  max-height: calc(100vh - 128px);  /* was: calc(100vh - 116px) */
}

/* 4. Tab alignment */
.tabs-bar {
  padding-left: 20px;  /* was: 14px */
}
```

```javascript
// 5. JavaScript video height
const viewportMaxHeight = Math.max(0, window.innerHeight - 128);  // was: 116
```

Done! All values are now in sync.
