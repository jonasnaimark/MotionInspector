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

## Bug: Bar Jumps After Editing Text (Nov 2025)

### Symptoms
- Edit text in a color bar by clicking it
- After editing, click elsewhere on the timeline
- The color bar instantly jumps/moves to where you clicked

### Root Cause
**Event listener timing issue: document-level drag handlers fire before edit mode flag is set.**

The bar dragging system works like this:
1. Bar's `mousedown` sets up document-level `mousemove` and `mouseup` listeners
2. These document listeners track mouse movement to detect horizontal/vertical dragging
3. On `mouseup`, the drag completes and moves the bar

The text editing system works like this:
1. Text's `mousedown` tracks click start position
2. Text's `mousemove` detects if mouse moved (dragging vs clicking)
3. Text's `mouseup` determines if it was a click, then enters edit mode

**The problem:** When you click text to edit:
1. Bar's `mousedown` fires → sets up document listeners for dragging
2. Mouse moves slightly → bar's `mousemove` might set drag direction
3. Text's `mouseup` fires → enters edit mode → sets flag `isBarTextBeingEdited = true`
4. User clicks elsewhere after editing
5. Document's `mouseup` fires → drag completes → **bar moves!**

By the time the flag was set, the bar had already determined it was dragging.

### The Bug
Located in `setupBarTextEditing()` function (~line 6820-6860):

```javascript
// WRONG - Flag set too late, after text's mouseup
textEl.addEventListener('mouseup', (e) => {
  if (!isDragging && clickDuration < 300) {
    e.stopPropagation();
    e.preventDefault();
    enterEditMode(textEl); // Flag set inside here, too late!
  }
});

function enterEditMode(element) {
  isBarTextBeingEdited = true; // ← Set AFTER document mouseup might have fired
  // ...
}
```

And in the blur handler:
```javascript
// WRONG - Flag cleared too early with setTimeout
setTimeout(() => {
  isBarTextBeingEdited = false;
}, 100); // Cleared before document mouseup could check it
```

### Why It Failed

**Event firing order when clicking text:**
```
1. Bar mousedown (document)    → Sets up document listeners
2. Text mousedown (element)    → Tracks click position
3. [mouse moves slightly]
4. Text mouseup (element)      → Determines it's a click
5. enterEditMode()             → Sets flag = true (TOO LATE)
6. [user types and clicks elsewhere]
7. Document mouseup            → Checks flag, but might be cleared already
8. → Bar moves to clicked location
```

**The timing race condition:**
- Document-level listeners fire AFTER element-level listeners
- But by the time document's mouseup checks the flag, the blur event may have cleared it via setTimeout

### The Fix

**Part 1: Set flag EARLIER in text's mouseup (before document handlers run):**

```javascript
// CORRECT - Set flag immediately in text's mouseup
textEl.addEventListener('mouseup', (e) => {
  if (!isDragging && clickDuration < 300) {
    // Set flag FIRST, before document mouseup can fire
    isBarTextBeingEdited = true;
    console.log('[TEXT EDIT] Set global flag BEFORE entering edit mode');

    e.stopPropagation();
    e.preventDefault();
    enterEditMode(textEl);
  }
});
```

**Part 2: Clear flag LATER (after all mouseup events complete):**

```javascript
// CORRECT - Clear on next mousedown instead of setTimeout
const clearFlagOnNextMouseDown = () => {
  isBarTextBeingEdited = false;
  console.log('[TEXT EDIT] Cleared global isBarTextBeingEdited flag on next mousedown');
  document.removeEventListener('mousedown', clearFlagOnNextMouseDown, true);
};
document.addEventListener('mousedown', clearFlagOnNextMouseDown, true);
```

**Part 3: Check flag in bar's mouseup:**

```javascript
// In setupBarDragging() onMouseUp handler
function onMouseUp(upEvent) {
  // If text editing was initiated, abort the drag operation
  if (isBarTextBeingEdited) {
    console.log('[BAR DRAG] onMouseUp detected text editing, aborting drag');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    return;
  }
  // ... rest of drag completion
}
```

### How to Debug Similar Issues

1. **Log event firing order with timestamps:**
   ```javascript
   console.log('[BAR DRAG] mousedown', Date.now());
   console.log('[TEXT EDIT] mouseup', Date.now());
   console.log('[BAR DRAG] document mouseup', Date.now());
   ```

2. **Track flag state at each step:**
   ```javascript
   console.log('[FLAG] Set to true at', Date.now());
   console.log('[FLAG] Checked, value is:', isBarTextBeingEdited);
   console.log('[FLAG] Cleared at', Date.now());
   ```

3. **Use event capturing to understand order:**
   ```javascript
   document.addEventListener('mouseup', (e) => {
     console.log('[DOCUMENT CAPTURE] mouseup fired');
   }, true); // Capture phase
   ```

4. **Check if setTimeout is causing race conditions:**
   - Replace with event-based clearing (next mousedown/click)
   - Or use much longer delays to test if timing is the issue

### Prevention

**Rule: When coordinating between element-level and document-level event handlers:**

✅ **DO:** Set coordination flags in element-level handlers BEFORE propagation
✅ **DO:** Clear flags on the next user interaction (click/mousedown), not setTimeout
✅ **DO:** Check flags at the START of document-level handlers
❌ **DON'T:** Rely on setTimeout for event coordination (race conditions)
❌ **DON'T:** Set flags inside functions called by event handlers (might be too late)

**Pattern to follow:**
```javascript
// Element-level handler (fires first)
element.addEventListener('mouseup', (e) => {
  if (shouldPreventDocumentHandler) {
    globalFlag = true; // ← Set flag IMMEDIATELY
    e.stopPropagation(); // Try to stop propagation
    doSomething();
  }
});

// Document-level handler (fires second)
document.addEventListener('mouseup', (e) => {
  if (globalFlag) {
    console.log('Detected flag, aborting');
    return; // ← Check flag at START
  }
  // Normal handling
});

// Clear flag on next user action (not setTimeout)
document.addEventListener('mousedown', () => {
  globalFlag = false;
}, true); // Capture phase to run first
```

### Related Code Locations

Search for these patterns to find potential similar bugs:
- Document-level event listeners that coordinate with element-level handlers
- Flags set inside functions called by event handlers
- `setTimeout` used to coordinate event handlers
- Drag detection systems that interfere with click detection

### Commit Reference
- **Fix commit:** TBD - "Fix bar jumping after text editing"
- **Files:** `MotionInspector.html` lines ~6834, ~6927, ~6661
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

*Last updated: Nov 26, 2025 - Added bar jumping after text editing bug*
