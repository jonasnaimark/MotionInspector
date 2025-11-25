# Editable Fields Feature Plan

## Overview

Allow users to edit animation properties directly in the info box. When a field is edited, the changes should:
1. Update the underlying `specData`
2. Automatically refresh in all views (timeline, table view)
3. Persist when exported

## Goals

- Make the info box interactive, not just read-only
- Allow quick edits without re-importing from After Effects
- Keep timeline bars and table data in sync with edited values
- Simple, fast implementation - avoid over-engineering validation

## Editable Fields

### Text Fields (No Validation)
- **Section Header** - Layer name (e.g., "Container"), appears in "Container > Opacity" title
- **Parameter** - Animation property name (e.g., "Opacity", "Position"), appears in "Container > Opacity" title
- **Description** - Free text, custom description that overrides auto-generated one
- **Start Value** - Display text for starting value
- **End Value** - Display text for ending value
- **Easing (Cubic-Bezier)** - Allow pasting any cubic-bezier string
- **Easing (Spring)** - Allow pasting any spring parameter values

### Numeric Fields (Light Validation)
- **Delay** - Must be valid number for timeline bar positioning
- **Duration** - Must be valid number for timeline bar width

### Validation Strategy

**Philosophy**: "Garbage in, garbage out" - trust users to input correct data, but prevent crashes.

#### Delay & Duration Validation
- Parse as float: `parseFloat(value)`
- If `isNaN()`, default to 0 or previous value
- Ensures timeline bars can always render correctly
- Invalid values won't break the display

#### All Other Fields
- **No validation** - accept any text input
- Users are responsible for correct formatting
- Makes implementation much simpler
- Appropriate for developer/designer tool

## Architecture

### Current Data Flow (Read-Only)
```
specData → renderTimeline() → Timeline bars + Info box
specData → renderTableView() → Table rows
```

### New Data Flow (Editable)
```
User edits input
  ↓
Update specData
  ↓
refreshActiveView()
  ↓
renderTimeline() OR renderTableView()
  ↓
All views show updated data
```

### Key Functions to Create

```javascript
// Update an animation field and refresh views
function updateAnimationField(animIndex, fieldName, newValue) {
  // 1. Validate if needed (delay/duration only)
  // 2. Update specData.layers[x].animations[y][fieldName]
  // 3. Refresh current view
}

// Update a layer field and refresh views
function updateLayerField(layerIndex, fieldName, newValue) {
  // 1. Update specData.layers[layerIndex][fieldName]
  // 2. Refresh current view
  // Note: All animations in this layer automatically show updated value
}

// Refresh whatever view is active
function refreshActiveView() {
  if (viewMode === 'table') {
    renderTableView();
  } else {
    renderTimeline();
  }
}

// Validation helpers
function validateNumeric(value, fallback) {
  const num = parseFloat(value);
  return isNaN(num) ? fallback : num;
}
```

## Special Considerations

### Section Header Updates

**Data Structure**:
```javascript
specData.layers[layerIndex].layerName // Section header
specData.layers[layerIndex].animations[animIndex].property // Parameter
```

**When Section Header is edited**:
1. Update `specData.layers[layerIndex].layerName`
2. Call `refreshActiveView()`
3. **Automatic cascade**: All animations in that layer automatically show the new section name because they all reference the same `layer.layerName`

**Where it appears**:
- Info box title: "Container > Opacity" (left side of >)
- Timeline left column: Layer header (`.timeline-label.layer-header`)
- Table view: Layer header row

**You get the multi-update behavior for FREE** ✅ because:
- All animations reference the same `layer` object
- When you re-render, they all read from the updated `layer.layerName`
- No need to loop through animations or update multiple places

### Parameter Updates

**When Parameter is edited**:
1. Update `specData.layers[layerIndex].animations[animIndex].property`
2. Call `refreshActiveView()`

**Where it appears**:
- Info box title: "Container > Opacity" (right side of >)
- Timeline left column: Animation label (`.timeline-label.indented`)
- Table view: Animation label row

**Single animation only** - doesn't affect other animations

## Implementation Approach

### Phase 1: Description Field (Proof of Concept)
**Goal**: Establish the pattern and get styling right

**Why Description First?**
- Simplest field (just text, no parsing)
- Already displayed in timeline and table
- Tests the full update → render cycle
- Quick win to validate approach

**Tasks**:
1. Add `anim.customDescription` to specData structure
2. Convert description text to `<input>` or `<textarea>` in info box
3. Style input to match existing design
4. Handle input change event
5. Update specData.customDescription
6. Call refreshActiveView()
7. Update `getAnimationDescription()` to check for customDescription first

**Decision Point**: Determine:
- Input vs textarea (multiline?)
- When to trigger update (blur, enter, keystroke?)
- Input styling that fits info box design

### Phase 2: Numeric Fields (Delay & Duration)
**Goal**: Add validation and test with timeline bar updates

**Tasks**:
1. Convert delay/duration to `<input type="text">`
2. Strip "ms" suffix for editing
3. Add validation on change
4. Update specData.timing.delay and .duration
5. Refresh views to see timeline bars reposition/resize

### Phase 3: Title & Value Fields
**Goal**: Make remaining text fields editable

**Tasks**:
1. **Section Header** (layer name)
   - Convert to input in info box title
   - Use `updateLayerField(layerIndex, 'layerName', newValue)`
   - Refresh view - all animations in layer automatically update
2. **Parameter** (property name)
   - Convert to input in info box title
   - Use `updateAnimationField(animIndex, 'property', newValue)`
   - Updates single animation only
3. **Start/End values**
   - Same pattern as Description, no validation

### Phase 4: Easing Fields (Most Complex)
**Goal**: Allow editing cubic-bezier and spring values

**Tasks**:
1. Cubic-bezier: Single input for pasting values
2. Spring: Multiple inputs (stiffness, damping, ratio, mass) or single textarea
3. No validation, just store and display

## Prep Work Needed

### 1. Refactor Duplicate Formatting Code (HIGH PRIORITY)

**Problem**: Spring and cubic-bezier formatting duplicated in info box and table view.

**Solution**: Extract into shared utility functions:

```javascript
function formatSpringDisplay(spring) {
  if (isPreset) {
    return `<a href="${link}">${spring.preset}</a>`;
  } else {
    return `<strong>Stiffness:</strong> ${spring.custom.stiffness}, ...`;
  }
}

function formatCubicBezierDisplay(bezier) {
  // Extract just numbers: (0.33, 0.00, 0.67, 0.00)
  return bezier.replace('cubic-bezier', '');
}

function getAnimationDescription(anim) {
  // Check for custom description first
  if (anim.customDescription) {
    return anim.customDescription;
  }
  // Otherwise generate from property data
  return /* auto-generated description */;
}
```

Both info box and table view use these functions.

### 2. Add Custom Description Field

Update specData structure:
```javascript
anim.customDescription = null; // Optional, overrides auto-generated
```

### 3. Centralize View Refresh

Create single function to refresh active view instead of calling renderTimeline/renderTableView directly.

## UX Considerations

### Input Behavior
- **On Focus**: Select all text for easy replacement
- **On Blur**: Save changes and refresh views
- **On Enter**: Save changes and refresh views (optional: move to next field)
- **On Escape**: Revert to original value (optional)

### Visual Feedback
- Inputs should visually blend with existing info box styling
- Slight border/background on hover to indicate editability
- Consider showing "edited" indicator if value was customized

### Error Handling
- Invalid delay/duration: Show warning or just default to 0
- Don't block saving invalid values for non-validated fields
- Maybe show red outline for invalid numeric fields

## Export Behavior

All edited values stored in specData, which gets embedded in exported HTML:
```javascript
const EMBEDDED_SPEC_DATA = ${specDataJson};
```

So edits automatically persist in exported files. ✅

## Technical Notes

### Why This Works Well

1. **Single source of truth**: All views read from specData
2. **Already have update pattern**: Dragging timeline bars already updates specData and re-renders
3. **No complex state management needed**: Direct DOM manipulation is fine
4. **Export is simple**: Already serializing specData to JSON

### Potential Issues

1. **Performance**: Re-rendering entire timeline/table on every keystroke could be slow
   - Solution: Only update on blur/enter, not every keystroke

2. **Undo/Redo**: No history tracking
   - Solution: Not needed for v1, users can re-export to save states

3. **Input validation UX**: How to show validation errors?
   - Solution: For delay/duration, just silently fix invalid values

## Success Criteria

- ✅ Can edit section header and see it update everywhere (timeline layer header, all info boxes in that layer, table view)
- ✅ Can edit parameter name and see it update in timeline label, info box, and table view
- ✅ Can edit description and see it update in timeline info box and table view
- ✅ Can edit delay/duration and see timeline bars move/resize
- ✅ Can edit start/end values and see them display correctly
- ✅ Can edit easing values and see them display correctly
- ✅ Invalid delay/duration don't crash timeline rendering
- ✅ Edited values persist in exported files
- ✅ All edits work in both edit mode and exported read-only mode

## Future Enhancements (Not in Scope)

- Undo/Redo history
- Validation error messages/warnings
- Preset dropdowns for common easing curves
- Visual cubic-bezier curve editor
- Spring physics preview
- Bulk edit multiple animations
- Import edited values back to After Effects

## Timeline Estimate

- Phase 1 (Description): 2-3 hours
- Phase 2 (Delay/Duration): 1-2 hours
- Phase 3 (Section Header/Parameter/Values): 2-3 hours
- Phase 4 (Easing): 2-3 hours
- Prep work (refactoring): 2-3 hours

**Total: ~9-14 hours of work**

Note: Section Header is slightly more complex due to title UI (two inputs with ">" between them), but the cascading update behavior comes for free.
