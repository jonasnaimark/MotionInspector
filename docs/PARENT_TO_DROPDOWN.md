# Parent To: Dropdown Feature

## Overview

A dropdown control in info boxes that allows moving entire layer sections between parent layers or to the top level. This enables flexible reorganization of the layer hierarchy without manual data editing.

---

## Prerequisites

**JSON format must be updated first** to support animations on parented (child) layers. Currently, child layers in `parentedLayers` only store layer name and parenting info, not their own animations.

### Current JSON Structure (Limited)
```json
{
  "layers": [
    {
      "layerName": "Container",
      "animations": [...],
      "parentedLayers": [
        {
          "layerName": "Child Layer",
          "parenting": {
            "parentName": "Container",
            "animatingProperties": ["position", "scale"]
          }
          // No animations array - child can't have its own params
        }
      ]
    }
  ]
}
```

### Required JSON Structure
```json
{
  "layers": [
    {
      "layerName": "Container",
      "animations": [
        { "property": "Position", "delay": 0, "duration": 300, ... },
        { "property": "Scale", "delay": 50, "duration": 250, ... }
      ],
      "parentedLayers": [
        {
          "layerName": "Child Layer",
          "parenting": {
            "parentName": "Container",
            "animatingProperties": ["position", "scale"]
          },
          "animations": [
            { "property": "Position", "delay": 100, "duration": 200, ... },
            { "property": "Opacity", "delay": 0, "duration": 300, ... }
          ]
        }
      ]
    }
  ]
}
```

---

## Visual Structure

When a layer is parented to a container, it appears as an indented section:

```
Container (Layer Header)
  ├── Position (param row)
  ├── Scale (param row)
  └── Child Layer (Attached to Container bar)
        ├── Position (param row, indented)
        └── Opacity (param row, indented)

Another Layer (Layer Header)
  └── Rotation (param row)
```

---

## UI: Parent To Dropdown

### Location
The "Parent to:" dropdown appears in the info box for:
- Child layer headers (Attached to Container rows)
- Param rows under child layers
- Top-level param rows (shows "None" selected)

### Dropdown Options
- **None** - Layer is top-level (not parented)
- **[Layer Name 1]** - Parent to this layer
- **[Layer Name 2]** - Parent to this layer
- ... (all available parent layers)

### Exclusions
The dropdown should exclude:
- The layer's own parent section (can't parent to yourself)
- Descendant layers (avoid circular references)

---

## Behavior

### Setting Parent from "None" to a Layer

**Before:** Top-level layer section
```
My Layer (Layer Header)
  ├── Position
  └── Opacity
```

**Action:** Set "Parent to: Container" in any param row info box

**After:** Entire section moves under Container as a child
```
Container (Layer Header)
  ├── Scale
  └── My Layer (Attached to Container)
        ├── Position
        └── Opacity
```

### Changing Parent from One Layer to Another

**Before:**
```
Container A
  └── Child Layer (Attached)
        └── Position

Container B
  └── Scale
```

**Action:** Set "Parent to: Container B" in Child Layer info box

**After:**
```
Container A
  (empty or just its own params)

Container B
  ├── Scale
  └── Child Layer (Attached)
        └── Position
```

### Setting Parent to "None"

**Before:**
```
Container
  └── Child Layer (Attached)
        ├── Position
        └── Opacity
```

**Action:** Set "Parent to: None" in Child Layer info box

**After:** Child becomes its own top-level layer
```
Container
  (its own params only)

Child Layer (Layer Header)
  ├── Position
  └── Opacity
```

---

## Key Principle: Section-Level Control

The "Parent to:" dropdown always affects the **entire child section**, not individual rows:

- Clicking dropdown in child layer header info box → moves section
- Clicking dropdown in any param row under that child → moves entire section (same behavior)

This provides convenience (access from any row) while maintaining predictable behavior.

---

## Implementation Notes

### Data Operations

**Move to parent:**
1. Remove layer from `specData.layers` array (if top-level) or from source parent's `parentedLayers`
2. Create child layer entry with `parenting` info
3. Add to target parent's `parentedLayers` array
4. Call `refreshActiveView()`

**Move to top-level (None):**
1. Remove from parent's `parentedLayers` array
2. Create new top-level layer entry
3. Add to `specData.layers` array
4. Call `refreshActiveView()`

### Inherited Properties

When creating a child layer under a parent, `parenting.animatingProperties` should be auto-populated based on which of these properties exist in the parent's animations:
- position
- scale
- rotation
- opacity

### Info Box Updates

The info box description for child layers currently shows:
```
Attached to [Parent], inherits [properties]
```

This should update automatically when the parent changes.

---

## Edge Cases

### Empty Parent Layers
A layer with no animations of its own can still be a parent (container). Child layers would show "inherits" with no properties listed, or the inherits text could be omitted.

### Moving Last Child
When moving the last child out of a parent, the parent becomes a regular layer section with just its own param rows (or empty if it has none).

### Layer Name Conflicts
If a layer is moved and its name conflicts with an existing layer at the destination level, consider:
- Auto-rename with suffix (e.g., "Layer 2")
- Show warning/confirmation
- Block the move

### Undo/Redo
Parent changes should be captured in the undo stack like other edits.

---

## Future Enhancements

- **Drag and drop** - Drag child layer header to another parent section
- **Multi-select** - Move multiple child layers at once
- **Reorder within parent** - Change order of children under the same parent
- **Visual indicator** - Show drop zones when dragging

---

## Summary

| State | Dropdown Shows | Action Result |
|-------|---------------|---------------|
| Top-level layer | None | Set parent → section becomes child of target |
| Child layer | Parent name | Change parent → section moves to new parent |
| Child layer | Parent name | Set to None → section becomes top-level |

The feature provides intuitive hierarchy management through a simple dropdown that's accessible from any row's info box within a section.
