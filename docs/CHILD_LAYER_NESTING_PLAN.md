# Child Layer Nesting Feature Plan

## Overview

Visually nest child (parented) layers under their parent sections with a tree-line connector, making the parent-child relationship immediately clear.

---

## Current Behavior

Child layers render as separate sections with divider lines:

```
Container
    Position
    Scale
────────────────────────────────────── ← divider
Icon
    Inherits: position, scale
```

**Problems:**
- Not immediately clear that Icon is a child of Container
- Visual separation (divider) implies they're unrelated sections
- Relationship only visible in the description text

---

## New Design

Child layers nest under their parent with a visual tree connector:

```
Container
│   Position
│   Scale
│   Opacity
└ Icon
    Inherits: position, scale
    Opacity
```

### Multiple Children

```
Container
│   Position
│   Scale
├ Icon
│   Inherits: position, scale
│   Opacity
└ Button
    Inherits: position
```

### Visual Hierarchy

| Element | Indent | Notes |
|---------|--------|-------|
| Parent layer header | 0px | No change |
| Parent's parameters | ~140px | Normal indent, no change |
| Child layer header | ~16px | Tiny nudge for connector only |
| Child's parameters | ~140px | Same indent as parent's params |

### Connector Symbols

- `│` - Vertical line (runs from parent through all children)
- `├` - Branch (child with more siblings below)
- `└` - End branch (last child)

---

## Design Decisions

### 1. No divider line between parent and children
Children are visually part of the parent's section.

### 2. Child layer headers stay at "layer" level, not "parameter" level
Only indented ~16px for the connector, not the full parameter indent. This keeps the layer/parameter visual distinction clear.

### 3. Tree connector line shows relationship
The vertical line from parent to children makes hierarchy immediately visible.

### 4. Children with their own animations
A child layer can have both:
- Inherited properties from parent (shown as "Inherits: position, scale")
- Its own animations (shown as normal parameter rows)

```
Container
│   Position
│   Scale
└ Icon
    Inherits: position, scale      ← inherited from parent
    Opacity                        ← Icon's own animation
```

### 5. Drag behavior
- Parent sections can be dragged/reordered (existing behavior)
- Children move with their parent automatically
- Children cannot be independently reordered (simple version)
- No drag constraints needed - children render based on `parenting.parentName`, so they naturally follow their parent

### 6. Works in both Table and Timeline views
Same visual structure in both views.

---

## Technical Implementation

### Phase 1: Rendering Changes

**Goal:** Group children under parents during render, skip children as standalone sections.

1. During layer iteration, identify parent layers (layers that have children referencing them)
2. After rendering a parent's animations, find all children where `layer.parenting.parentName === parentLayer.layerName`
3. Render children immediately after parent (no divider)
4. Skip children when iterating as standalone sections

**Functions to modify:**
- `renderTableView()` - Table view rendering
- `renderTimeline()` - Timeline view rendering

**Logic change:**
```javascript
// Current: treat as child only if no animations
const isParentedLayer = layer.parenting && layer.animations.length === 0;

// New: treat as child if has parenting (regardless of own animations)
const isChildLayer = layer.parenting != null;
```

### Phase 2: Visual Connectors (CSS)

**Goal:** Add tree-line connectors.

1. Add CSS classes for connector lines:
   - `.child-layer-header` - Child layer with connector
   - `.has-children` - Parent layer (starts vertical line)
   - `.child-branch` - Uses `├` connector
   - `.child-branch-last` - Uses `└` connector
   - `.child-continues` - Rows under non-last children (continue `│`)

2. Use `::before` pseudo-elements for connector symbols

3. Use left border or pseudo-element for vertical line

**CSS approach:**
```css
/* Vertical line on parent and its content */
.has-children .timeline-label.indented {
  border-left: 1px solid #666;
  margin-left: 8px;
}

/* Child layer header with connector */
.child-layer-header::before {
  content: '└';
  position: absolute;
  left: 0;
  color: #666;
}

.child-branch::before {
  content: '├';
}
```

### Phase 3: Edge Cases

1. **Parent doesn't exist** - Child references a parent name that's not in the spec
   - Render as standalone section (fallback to current behavior)

2. **Multiple children** - Several layers reference the same parent
   - Render all under the parent
   - Use `├` for all except last, `└` for last child

3. **Orphaned children** - Parent is deleted
   - Children become standalone sections
   - Or: delete children with parent (with confirmation)

4. **Child reordering** - Not supported in simple version
   - Children appear in order they exist in `specData.layers`

---

## Data Structure

No changes needed. Current structure supports this:

```json
{
  "layerName": "Icon",
  "animations": [
    { "property": "Opacity", ... }
  ],
  "parenting": {
    "parentName": "Container",
    "animatingProperties": ["position", "rotation", "scale"]
  }
}
```

A layer with `parenting` is a child. It can have:
- Zero animations (just inherits)
- Its own animations (inherits + own)

---

## Files to Modify

1. **MotionInspector.html**
   - `renderTableView()` - Table rendering loop
   - `renderTimeline()` - Timeline rendering loop
   - CSS section - Add connector styles

2. **docs/TROUBLESHOOTING.md**
   - Document any new edge cases discovered

---

## Testing Checklist

- [ ] Single child under parent renders correctly
- [ ] Multiple children render with correct connectors (├ and └)
- [ ] Child with own animations shows both inherited and own rows
- [ ] Dragging parent moves children with it
- [ ] Table view matches timeline view
- [ ] No divider line between parent and children
- [ ] Vertical line extends from parent through all children
- [ ] Deleting parent handles children appropriately
- [ ] Child referencing non-existent parent renders as standalone

---

## Future Enhancements (Not in Scope)

- Child reordering within parent (drag/drop)
- Collapsible parent sections
- Visual indicator on parent showing it has children
- Nested children (child of a child)

---

*Created: Nov 29, 2025*
