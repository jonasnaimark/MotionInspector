# Drag and Drop Implementation Guide

This document details the drag and drop system in Motion Inspector. It covers architecture, common pitfalls, and lessons learned from implementing drag-to-reorder for sections, animations, and child layers.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Two Separate Implementations](#two-separate-implementations)
3. [Data Attributes](#data-attributes)
4. [Drop Indicator Lines (Blue Hints)](#drop-indicator-lines-blue-hints)
5. [Position Validation](#position-validation)
6. [Drag Types and Valid Drops](#drag-types-and-valid-drops)
7. [Child Layer Drag and Drop](#child-layer-drag-and-drop)
8. [Common Pitfalls](#common-pitfalls)
9. [Key Functions](#key-functions)
10. [CSS Classes Reference](#css-classes-reference)

---

## Architecture Overview

Motion Inspector has a two-column layout:
- **Left column**: Labels (`.timeline-label`) - layer names, animation property names
- **Right column**: Tracks (`.timeline-track`) - timeline bars or table data cells

Drag and drop works on the LEFT column labels, but indicators must show across BOTH columns for visual clarity.

### Global Drag State Variables

```javascript
let draggedElement = null;      // The DOM element being dragged
let draggedType = null;         // 'layer', 'animation', or 'child-layer'
let draggedLayerIndex = null;   // Index in specData.layers
let draggedAnimIndex = null;    // Index within the layer's animations array
let draggedParentLayer = null;  // For child-layers: index of their parent layer
```

These are set on `dragstart` and cleared on `dragend`.

---

## Two Separate Implementations

**CRITICAL**: There are TWO completely separate drag and drop implementations:

| View Mode | Setup Function | Selector Pattern |
|-----------|---------------|------------------|
| Table View | `setupTableDragAndDrop()` | `.timeline-labels-column .timeline-label[draggable="true"]` |
| Timeline View | `setupDragAndDrop()` | `.timeline-label` |

### Why Two Implementations?

1. **Different DOM structure**: Table view has explicit column containers
2. **Different row matching**: Finding corresponding right-column rows differs
3. **Called at different times**: Each render function calls its own setup

### Key Difference: Finding Corresponding Right Row

**Table View** uses `findCorrespondingRightRow()`:
```javascript
function findCorrespondingRightRow(leftLabel) {
  const rowType = leftLabel.dataset.rowType;
  const layerIndex = leftLabel.dataset.layerIndex;
  const animIndex = leftLabel.dataset.animIndex;

  let selector = `.timeline-content-column .timeline-track[data-row-type="${rowType}"][data-layer-index="${layerIndex}"]`;
  if (animIndex !== null) {
    selector += `[data-anim-index="${animIndex}"]`;
  }
  return document.querySelector(selector);
}
```

**Timeline View** uses index matching:
```javascript
const allLabels = Array.from(document.querySelectorAll('.timeline-label'));
const allTracks = Array.from(document.querySelectorAll('.timeline-track'));
const labelIndex = allLabels.indexOf(label);
if (labelIndex >= 0 && allTracks[labelIndex]) {
  allTracks[labelIndex].classList.add('drag-over-top');
}
```

---

## Data Attributes

### Left Column Labels (`.timeline-label`)

| Attribute | Description | Used By |
|-----------|-------------|---------|
| `data-drag-type` | Type of draggable: `'layer'`, `'animation'`, `'child-layer'` | Drag validation |
| `data-row-type` | Row type: `'layer'`, `'animation'`, `'child-layer'`, `'child-animation'` | Row matching |
| `data-layer-index` | Index in `specData.layers` array | All operations |
| `data-anim-index` | Global animation index (timeline view) | Timeline view |
| `data-anim-in-layer` | Animation index within its layer | Both views |
| `data-parent-layer` | Parent layer index (child layers only) | Child layer ops |
| `data-parent-name` | Parent layer name (child layers only) | Child layer ops |
| `draggable` | `"true"` or `"false"` | Browser drag API |

### Important: Attribute Differences Between Views

**Table View** child animations:
- `data-row-type="child-animation"`
- `data-anim-index` = index within layer

**Timeline View** child animations:
- Class `child-anim` (no special `data-row-type`)
- `data-anim-in-layer` = index within layer
- `data-drag-type="animation"`

This difference caused bugs when implementing child-layer drops on animation rows!

---

## Drop Indicator Lines (Blue Hints)

### How They Work

Drop indicators are CSS `::before` and `::after` pseudo-elements that appear when hovering over valid drop targets.

### CSS Classes

| Class | Pseudo-element | Position |
|-------|---------------|----------|
| `.drag-over-top` | `::before` | Top edge of row |
| `.drag-over-bottom` | `::after` | Bottom edge of row |

### Making Lines Span Both Columns

The key challenge: indicators must extend across BOTH the left label column AND the right track column.

**Left column labels** extend RIGHT:
```css
.timeline-label.drag-over-top::before {
  content: '';
  position: absolute;
  left: 0;
  right: -3000px;  /* Extend far into right column */
  top: -1px;
  height: 2px;
  background: #4a90e2;
  z-index: 1000;
}
```

**Right column tracks** extend LEFT:
```css
.timeline-track.drag-over-top::before {
  content: '';
  position: absolute;
  left: -3000px;  /* Extend far into left column */
  right: 0;
  top: -1px;
  height: 2px;
  background: #4a90e2;
  z-index: 1000;
}
```

### Avoiding Double Lines

**Problem**: Adding indicator class to BOTH label and track can create two visible lines if they don't perfectly align.

**Solution for child layers**: Only add indicator to the TRACK (right column), which extends left via `left: -3000px`. This creates a single line across both columns.

```javascript
// Child layer drops: only add indicator to track (not label) to avoid double lines
if (rightRow) rightRow.classList.add('drag-over-top');
// DON'T add: label.classList.add('drag-over-top');
```

### CSS Specificity Issues

Child layer headers use `::before` for tree connectors (└ and ├ symbols). When adding drag indicators, you must override these with higher specificity:

```css
/* Tree connector (normal state) */
.timeline-label.child-layer-header::before {
  content: '└';
  /* ... */
}

/* Drag indicator (must override tree connector) */
.timeline-label.child-layer-header.drag-over-top::before {
  content: '';  /* Clear the tree connector symbol */
  position: absolute;
  left: 0;
  right: -3000px;
  top: -1px;
  height: 2px;
  background: #4a90e2;
  /* ... */
}
```

---

## Position Validation

### The "Would Change Position" Check

**Critical**: Only show drop indicators if the drop would actually change the item's position. Otherwise users see misleading feedback.

```javascript
let wouldChangePosition = false;

// Example: Dragging layer to different position
let targetIndex = targetLayerIndex;
if (draggedLayerIndex < targetIndex) targetIndex--;
wouldChangePosition = draggedLayerIndex !== targetIndex;

if (!wouldChangePosition) return; // Don't show indicator
```

### Why the Adjustment?

When you remove an item from position X and insert at position Y:
- If X < Y, the target index shifts down by 1 after removal
- Must account for this to check if final position differs

### Drop Zone Distance Checks

For section headers and child headers, only allow drops near the TOP edge:

```javascript
const rect = label.getBoundingClientRect();
const distanceFromTop = e.clientY - rect.top;

if (distanceFromTop <= 10) {  // Only top 10px is valid drop zone
  // Allow drop
}
```

For bottom drops (after last item), check distance from bottom:

```javascript
const distanceFromBottom = rect.bottom - e.clientY;

if (distanceFromBottom <= 10) {  // Only bottom 10px is valid
  // Allow drop after this item
}
```

---

## Drag Types and Valid Drops

### Layer Drops

| Drag From | Drop On | Valid? | Position |
|-----------|---------|--------|----------|
| Layer header | Layer header (top 10px) | Yes | Before target |
| Layer header | Bottom divider | Yes | End of list |
| Layer header | Animation row | No | - |

### Animation Drops

| Drag From | Drop On | Valid? | Position |
|-----------|---------|--------|----------|
| Animation | Animation (same layer) | Yes | Before/after based on mouse |
| Animation | Animation (different layer) | Yes | Before/after based on mouse |
| Animation | Layer header | Yes | First position in that layer |

### Child Layer Drops

| Drag From | Drop On | Valid? | Position |
|-----------|---------|--------|----------|
| Child header | Child header (top 10px) | If same parent | Before target |
| Child header | Child header (bottom 10px, last child, no anims) | If same parent | After target |
| Child header | Last animation of sibling (bottom 10px) | If same parent | After that sibling |

---

## Child Layer Drag and Drop

Child layer drag-and-drop was significantly more complex than other row types. Here's why and how it works.

### Why It's Different

1. **Constrained reordering**: Children can only reorder within their parent's section
2. **Variable bottom drop targets**:
   - If child has animations → drop zone is last animation row
   - If child has no animations → drop zone is the header itself
3. **Different data attributes** between table and timeline views
4. **Tree connector CSS** interferes with drag indicators

### Parent Validation

Always verify both dragged and target children share the same parent:

```javascript
const targetParentName = targetLayer.parenting.parentName;
const draggedLayer = specData.layers[draggedLayerIndex];

if (!draggedLayer.parenting ||
    draggedLayer.parenting.parentName !== targetParentName) {
  return; // Different parents, invalid drop
}
```

### Detecting Last Child

Children without more siblings below them don't have the `has-siblings` class:

```javascript
const isLastChild = !label.classList.contains('has-siblings');
```

### Detecting Child With No Animations

```javascript
const targetLayer = specData.layers[targetLayerIndex];
const hasNoAnimations = targetLayer.animations.length === 0;
```

### The Four Drop Scenarios

1. **Top of any child header** → Insert before that child
2. **Bottom of last child header (no animations)** → Insert after that child
3. **Bottom of any child's last animation** → Insert after that child
4. **Top of first child** with dragged item already first → Invalid (no change)

### Handling Child Animation Rows

Child animation rows need special handling because:
- They have `draggable="false"` (not in main draggable selector)
- Table view: `data-row-type="child-animation"`, `data-anim-index`
- Timeline view: class `child-anim`, `data-anim-in-layer`

**Table view selector**:
```javascript
const childAnimRows = document.querySelectorAll(
  '.timeline-labels-column .timeline-label[data-row-type="child-animation"]'
);
```

**Timeline view selector**:
```javascript
const childAnimLabels = document.querySelectorAll('.timeline-label.child-anim');
```

### The stopPropagation Problem

**Problem**: Main labels loop calls `e.stopPropagation()` in drop handler. Child animation rows match `.timeline-label`, so main handler fires first and blocks custom handlers.

**Solution**: Add child-layer on child-anim handling directly IN the main drop handler:

```javascript
// In main drop handler, AFTER other conditions:
else if (draggedType === 'child-layer' && label.classList.contains('child-anim')) {
  // Handle drop on child animation row
}
```

---

## Common Pitfalls

### 1. Forgetting to Update Both Views

Any drag/drop change must be made in BOTH:
- `setupTableDragAndDrop()`
- `setupDragAndDrop()`

### 2. Data Attribute Mismatches

Table and timeline views use different attribute names for animation indices:
- Table: `data-anim-index`
- Timeline: `data-anim-in-layer`

Always check which view you're in and use the correct attribute.

### 3. Row Type Mismatches in findCorrespondingRightRow

Left column child animations have `data-row-type="child-animation"`, but right column tracks have `data-row-type="animation"`. Direct matching fails.

**Solution**: Use manual selector or index-based matching for child animation rows.

### 4. CSS Pseudo-element Conflicts

Elements that use `::before` for other purposes (tree connectors, icons) will have those replaced by drag indicators. Use high specificity selectors to override.

### 5. Not Clearing Indicators

Always clear ALL indicators before adding new ones:

```javascript
document.querySelectorAll('.timeline-label, .timeline-track').forEach(el => {
  el.classList.remove('drag-over-top', 'drag-over-bottom');
});
```

### 6. Position Validation Edge Cases

- Dragging first item to second position (before second item) = no change
- Dragging last item to before-last position = no change
- Must account for index shift after removal

### 7. stopPropagation Blocking Handlers

If you add handlers to elements that also match the main selector, the main handler's `e.stopPropagation()` will block yours. Either:
- Add your logic to the main handler
- Remove stopPropagation (may cause other issues)
- Use event capture phase

---

## Key Functions

### setupTableDragAndDrop()
Sets up all drag handlers for table view. Called by `renderTableView()`.

### setupDragAndDrop()
Sets up all drag handlers for timeline view. Called by `renderTimeline()`.

### findCorrespondingRightRow(leftLabel)
Table view only. Finds the matching track in the right column.

### performLayerMove(fromIndex, toIndex, position)
Moves a layer (section) to a new position. Handles 'before' and 'after'.

### performAnimationMove(layerIndex, fromAnimIndex, toAnimIndex, position)
Moves an animation within a layer.

### performChildLayerMove(fromIndex, toIndex, position)
Moves a child layer to a new position within its parent's children.

---

## CSS Classes Reference

### Drag State Classes

| Class | Applied To | Purpose |
|-------|-----------|---------|
| `.dragging` | Dragged element | Visual feedback (opacity) |
| `.drag-over-top` | Drop target | Show top indicator line |
| `.drag-over-bottom` | Drop target | Show bottom indicator line |

### Element Classes

| Class | Element | Notes |
|-------|---------|-------|
| `.timeline-label` | Left column rows | All label rows |
| `.timeline-track` | Right column rows | All track rows |
| `.layer-header` | Section headers | Top-level layers |
| `.child-layer-header` | Child section headers | Parented layers |
| `.child-anim` | Child animation rows | Timeline view only |
| `.indented` | Animation rows | Indented under headers |
| `.has-siblings` | Child headers | Has siblings below |
| `.first-child-layer` | First child header | First child in group |

---

## Testing Checklist

When modifying drag and drop:

- [ ] Test in Table view
- [ ] Test in Timeline view
- [ ] Drag section headers to reorder
- [ ] Drag animation rows within same section
- [ ] Drag animation rows to different section
- [ ] Drag child headers to reorder within parent
- [ ] Drop child at top of sibling (before)
- [ ] Drop child at bottom of sibling's last animation (after)
- [ ] Drop child at bottom of sibling with no animations
- [ ] Verify indicator doesn't show when drop wouldn't change position
- [ ] Verify indicator spans both columns
- [ ] Verify no double lines appear
- [ ] Test with edit mode on and off (draggable should toggle)

---

*Last updated: December 2, 2025*
