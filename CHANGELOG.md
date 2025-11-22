# Changelog

All notable changes to Motion Inspector will be documented in this file.

## [Unreleased] - 2025-11-21

### Added
- **Drag-and-drop reordering**: Replaced up/down arrow buttons with intuitive drag-and-drop functionality
  - Hover over any row to reveal drag handle (⋮⋮)
  - Drag sections (layer headers) to reorder entire sections with all parameters
  - Drag parameters within their layer to reorder animations
  - Visual feedback with blue line indicator showing drop position
  - Parameters constrained to stay within their parent layer
  - Sections can be dropped at the very bottom by dragging to the last parameter row
- **Natural language descriptions for Position and Size properties**
  - "Position" property now shows directional movement (e.g., "slides down 105px")
  - "Size" property uses same language as width/height (e.g., "shrinks" or "expands")
  - Supports both single-axis and dual-axis position changes

### Changed
- Removed up/down arrow buttons from detail panel
- Removed up/down arrow buttons from timeline labels
- Replaced with drag-and-drop interface for better UX

### Fixed
- Row height alignment between left label column and timeline track column
  - Changed from `min-height` to explicit `height: 32px` for consistent sizing
  - Added `box-sizing: border-box` to ensure padding is included in height calculations
- Drag handle no longer causes row height to shift on hover
  - Changed from `display: none/block` to `visibility: hidden/visible`
- Section drag indicators now only show in valid drop zones
  - Section headers only show top indicator (drop before)
  - Last parameter row of last section shows bottom indicator (drop at end)
  - Eliminates confusing double indicators that don't work

### Technical Details
- Implemented HTML5 drag-and-drop API with `draggable` attribute
- Added drag state management (`draggedElement`, `draggedType`, `draggedLayerIndex`, `draggedAnimIndex`)
- Added CSS classes for drag states (`.dragging`, `.drag-over-top`, `.drag-over-bottom`)
- Separated layer moves from animation moves with different validation logic
- Enhanced `getAnimationDescription()` function to handle generic Position and Size properties
