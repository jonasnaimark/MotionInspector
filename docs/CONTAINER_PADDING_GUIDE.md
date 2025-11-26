# Container Padding & Spacing Guide

## Overview
This guide explains how to quickly adjust the top/bottom spacing around the video and timeline containers.

---

## Current Configuration

**Top spacing (header to containers):** Controlled by header padding-top + margin-bottom
- Current: `4px` (padding-top) + `28px` (margin-bottom) = `32px` total
- Location: `.header-section` (~line 40, 44)

**Bottom spacing (containers to viewport bottom):** Controlled by container height calculations
- Current value: `110px` (in 7 locations)

**Side padding (inside containers):** `16px`
- Video section padding: `16px`
- Timeline section padding: `16px`

---

## Quick Adjustments

### Adjust Top Spacing

**To increase/decrease the gap between header and containers:**

Change `.header-section` padding-top and/or margin-bottom (~line 40, 44)
```css
.header-section {
  padding: 4px 20px 0 20px;  /* padding-top affects vertical centering */
  margin-bottom: 28px;        /* margin-bottom affects gap to containers */
}
```

**Example:** Want header centered in 40px total space?
- Change to: `padding: 10px 20px 0 20px` and `margin-bottom: 30px`

---

### Adjust Bottom Spacing

**To increase/decrease the gap at the bottom of the viewport:**

Change the height calculation value in **7 locations**. Current value: `110px`

**🔑 KEY RULE (Think "subtract from viewport"):**
- **SMALLER number** (e.g., 100px) → Containers grow TALLER → SMALLER bottom gap
- **LARGER number** (e.g., 120px) → Containers stay SHORTER → LARGER bottom gap

**Examples:**
- Want **LESS bottom gap** (containers closer to bottom)? Change `110px` → `105px` (subtract 5)
- Want **MORE bottom gap** (more space at bottom)? Change `110px` → `115px` (add 5)

---

## All Locations to Update (Search & Replace)

When adjusting bottom spacing, update these **6 locations**:

### CSS (in `<style>` block)

**1. Video section height** (~line 247)
```css
height: calc(100vh - 114px);
```

**2. Video section max-height** (~line 248)
```css
max-height: calc(100vh - 114px);
```

**3. Video section empty state min-height** (~line 252)
```css
min-height: calc(100vh - 114px);
```

**4. Video element max-height** (~line 286)
```css
max-height: calc(100vh - 114px);
```

**5. Timeline wrapper height** (~line 386)
```css
height: calc(100vh - 114px + 25px);
```

**6. Timeline section empty state min-height** (~line 406)
```css
min-height: calc(100vh - 114px);
```

### JavaScript (in `<script>` block)

**7. Video height calculation** (~line 2540)
```javascript
const viewportMaxHeight = Math.max(0, window.innerHeight - 114);
```

---

## Search & Replace Method (Fastest!)

To change bottom spacing from `114px` to a new value (e.g., `120px`):

1. **CSS:** Search `100vh - 114` → Replace with `100vh - 120`
2. **JavaScript:** Search `innerHeight - 114` → Replace with `innerHeight - 120`

This updates all locations at once!

---

## Common Adjustments

| Goal | Top Spacing | Bottom Value | Notes |
|------|-------------|--------------|-------|
| **Current setup** | `36px` | `114px` | Balanced, 16px-ish gaps |
| More space at top | `46px` | `114px` | Adds 10px to top |
| Less space at top | `26px` | `114px` | Removes 10px from top |
| Larger bottom gap | `36px` | `104px` | Adds ~10px to bottom |
| Smaller bottom gap | `36px` | `124px` | Removes ~10px from bottom |
| Original tight spacing | `20px` | `128px` | Pre-adjustment state |

---

## Why These Numbers?

The `114px` calculation accounts for:
- Header height + original margin: ~96px
- Extra margin added to top: ~16px (36px - 20px)
- Fine-tuned adjustment: ~2px

Total removed from viewport: 114px
Remaining space = containers can grow to fill (100vh - 114px)

---

## Verification Checklist

After making changes:
- [ ] All 6 CSS locations use same value
- [ ] JavaScript calculation matches CSS value
- [ ] Video loads at correct size without "snapping"
- [ ] Top gap looks right
- [ ] Bottom gap matches side gaps (visually)
- [ ] Containers don't touch viewport edges

---

## Pro Tip

If video "snaps" or jumps after loading, CSS and JavaScript values are out of sync. Check line ~2540 in JavaScript matches your CSS values.
