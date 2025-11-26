# Troubleshooting Guide

This document tracks common bug patterns, their solutions, and debugging strategies to prevent similar issues in the future.

---

## Bug: Delete Buttons Not Working in Timeline Mode (Nov 2025)

### Symptoms
- Only the first parameter row's delete button (red ×) worked in timeline mode
- All other rows' delete buttons appeared to do nothing
- Table mode delete buttons worked fine
- Delete button in info panel worked fine

### Root Cause
**Data attribute confusion between global and local animation indices.**

Each animation row in the DOM has two data attributes:
- `data-anim-index`: Global index across ALL animations (0, 1, 2, 3...)
- `data-anim-in-layer`: Local index within THAT layer (0, 0, 0, 1, 0...)

The delete button click handler was using the wrong attribute to calculate the global index.

### The Bug
Located in `setupParamActionButtonHoverHandlers()` function (~line 3665):

```javascript
// WRONG - Used animIndex instead of animInLayer
const animInLayer = parseInt(row.dataset.animIndex || row.dataset.animInLayer);
```

### Why It Failed
Consider this structure:
```
Section 1
  ├─ Param 1  (animIndex=0, animInLayer=0)
Section 2
  └─ Param 1  (animIndex=1, animInLayer=0)
```

**Correct calculation:**
```javascript
globalIndex = (animations in layers before) + animInLayer
globalIndex = 1 + 0 = 1 ✓ CORRECT
```

**Buggy calculation:**
```javascript
globalIndex = (animations in layers before) + animIndex
globalIndex = 1 + 1 = 2 ✗ WRONG (no animation at index 2!)
```

### The Fix
```javascript
// CORRECT - Always use animInLayer for local index
const animInLayer = parseInt(row.dataset.animInLayer);
```

### How to Debug Similar Issues

1. **Add extensive console logging** to trace data flow:
   ```javascript
   console.log('[DELETE] Called with animIndex:', animIndex);
   console.log('[DELETE] row.dataset:', row.dataset);
   console.log('[DELETE] Calculated globalIndex:', globalIndex);
   ```

2. **Compare working vs broken paths:**
   - Table mode worked → check what it does differently
   - Info panel button worked → trace which index it uses

3. **Inspect DOM attributes** in DevTools:
   - Right-click element → Inspect
   - Check all `data-*` attributes
   - Verify which one should be used

4. **Test with multiple sections:**
   - Single section bugs often work
   - Multi-section reveals index calculation errors

### Prevention

**Rule: When calculating global animation index from a row element:**

✅ **DO use:** `row.dataset.animInLayer` (local index within layer)
❌ **DON'T use:** `row.dataset.animIndex` (already global, don't add to it)

**Pattern to follow:**
```javascript
const layerIndex = parseInt(row.dataset.layerIndex);
const animInLayer = parseInt(row.dataset.animInLayer); // ← Local index

let globalIndex = 0;
// Add all animations from previous layers
for (let i = 0; i < layerIndex; i++) {
  globalIndex += specData.layers[i].animations.length;
}
// Then add the local index
globalIndex += animInLayer;
```

### Related Code Locations

Search for these patterns to find potential similar bugs:
- `row.dataset.animIndex` - Check if it should be `animInLayer`
- `parseInt(row.dataset.animIndex || row.dataset.animInLayer)` - Usually wrong
- Global index calculations in click handlers

### Commit Reference
- **Fix commit:** `dc22b05` - "Fix delete button bug in timeline mode"
- **File:** `MotionInspector.html` line ~3665
- **Date:** Nov 26, 2025

---

## Debugging Best Practices

### When Event Handlers Don't Fire

1. **Check if handler is actually attached:**
   ```javascript
   console.log('[SETUP] Attaching handler to:', element);
   ```

2. **Log inside the handler immediately:**
   ```javascript
   element.addEventListener('click', (e) => {
     console.log('[CLICK] Handler fired!', e.target);
     // ... rest of code
   });
   ```

3. **Check event propagation:**
   - Is `stopPropagation()` blocking it?
   - Is a parent element catching the event first?

### When Functions Work in One Mode But Not Another

1. **Compare the two code paths side by side**
2. **Check if they use different data sources**
3. **Verify rendering differences** (different HTML structure?)
4. **Test in both modes** with identical data

### When Indices Don't Match

1. **Log the index at every step:**
   - When rendering: what index is assigned?
   - When clicking: what index is read?
   - When processing: what index is used?

2. **Check for off-by-one errors**
3. **Verify zero-based vs one-based indexing**
4. **Look for global vs local index confusion**

---

## Common Gotchas

### 1. Multiple Data Attributes with Similar Names
❌ Can lead to using the wrong one
✅ Document clearly which attribute is for what purpose
✅ Use distinctive names (e.g., `globalIndex` vs `localIndex`)

### 2. Inline onclick vs addEventListener
❌ Inline onclick has different scope, debugging is harder
✅ Use `addEventListener` for better debugging and event control

### 3. Cached References After Re-render
❌ Event handlers attached to old DOM elements won't work after re-render
✅ Re-attach handlers after each render (or use event delegation)

### 4. Fallback Operators Hiding Issues
```javascript
// This can hide bugs:
const value = a || b || c;  // Which one was actually used?

// Better for debugging:
const value = a !== undefined ? a : (b !== undefined ? b : c);
```

---

## Quick Debug Checklist

When a feature "doesn't work":

- [ ] Does the console show any errors?
- [ ] Is the event handler actually being called? (Add log at top of handler)
- [ ] Are the data attributes what you expect? (Inspect element in DevTools)
- [ ] Does it work in a simpler case? (e.g., single section vs multiple)
- [ ] Does it work in other modes? (table vs timeline)
- [ ] Are indices being calculated correctly? (Log each step)
- [ ] Has the data synced properly? (Check both tab data and legacy variables)
- [ ] Is the DOM up to date? (Did re-render happen?)

---

*Last updated: Nov 26, 2025*
