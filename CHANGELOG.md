# Changelog

All notable changes to Motion Inspector will be documented in this file.

## [Unreleased] - 2025-11-25

### Added
- **Table mode with editable fields**: All animation properties can now be edited directly in table view
  - Click any cell to edit description, delay, duration, or easing values
  - Changes automatically sync to timeline view and persist in exports
  - 5px drag threshold prevents accidental edits when trying to drag rows
  - Smooth contenteditable experience with focus/blur handlers
- **Editable page title**: Main title in top-left is now editable
  - Click to edit, Enter to save, Escape to cancel
  - Syncs with document title and spec data
  - Outline only visible on hover for clean UI
  - Auto-updates when loading new spec data
- **Table bottom divider**: Extends across entire table width
  - Matches left column divider for visual consistency
  - Proper cell border handling to avoid extra vertical lines
- **Add parameter and section buttons in table mode**: Circular + buttons work in both timeline and table views
  - Consistent hover zones and button positioning
  - Auto-opens info box for new items with field selection

### Changed
- **Table text styling**: Body text uses subtle grey (#c0c0c0) instead of white
  - Improves readability and visual hierarchy
  - Left column labels and header row remain white
  - Consistent across description, delay, duration, and easing columns
- **Text selection behavior**: Clicking outside editable fields now properly deselects text
  - Improved UX for page title editing
  - Document-level listener clears selection when clicking elsewhere

### Fixed
- **Spring parameter spacing in table mode**: Fixed whitespace collapse in edit mode
  - HTML `<strong>` tags caused spacing issues in contenteditable cells
  - Now uses plain text in edit mode, HTML formatting in read mode
  - Preserves proper spacing between Stiffness, Damping, Damping Ratio, and Mass
- **Duration deletion persistence**: Clearing duration field now properly refreshes view
  - Removed premature return that prevented table re-render
  - Springs maintain dash display, other animations show updated values

### Technical Details
- Contenteditable cells use `data-field` attributes for field identification
- Conditional rendering of spring parameters based on `isEditMode` flag
- Selection management via `window.getSelection()` API
- Page title editing syncs to `specData.compName` and `document.title`

## [Previous] - 2025-11-21

### Added
- **Timeline zoom controls**: +/- buttons in top-right to adjust visible timeline duration
  - Zoom in/out by 100ms increments
  - Minimum zoom: 100ms, maximum: spec's total duration
  - All durations snap to 100ms increments for clean ruler marks
  - Playhead position and drag calculations account for zoom level
- **Timeline bar resize functionality**: Drag left/right edges of bars to adjust timing
  - Left edge: adjusts delay (start time) while maintaining end time
  - Right edge: adjusts duration (end time)
  - Spring animations: left edge only (no end time)
  - Snaps to 25ms increments
  - Real-time info box updates during drag
  - Hover shows resize handles on bar edges
- **Timeline bar dragging**: Drag bars horizontally or vertically
  - Horizontal drag: moves bar position in time (25ms increments)
  - Vertical drag: reorders parameter row
  - Direction determined after 5px threshold
  - Entire bar surface draggable (except resize handle edges)
  - Grab/grabbing cursor indicates draggable state
- **Cross-section parameter moving**: Parameters can now be moved between sections
  - Removed constraint that kept parameters within their own section
  - Drag from left column or color bars to any row in any section
  - Works consistently whether dragging labels or bars
- **Add parameter and section buttons**: Circular + buttons on hover
  - Right-aligned buttons on parameter rows near divider lines
  - Center-aligned buttons on section dividers
  - Bottom divider with centered button to add sections at end
  - Hover zone: 50% above to 50% below divider lines
  - Closest button detection prevents overlapping buttons
  - Auto-opens info box for new parameters with selection
- **Bottom section divider line**: Extends across entire timeline width
  - Matches styling of other section dividers
  - Provides visual consistency
- **Color picker for parameters**: Clickable dot in info box title opens color selection panel
  - 8 color options: blue, teal, green, purple, pink, red, orange, dark grey
  - Colors sorted from cool to warm
  - Popover panel with darker background (#1a1a1a)
  - Caret points to color dot below
  - Selected color shows outline stroke
  - Custom colors apply to timeline bars and info box border
  - Colors stored in animation's customColor property
  - Spring animations maintain gradient fade with custom colors

### Changed
- **Drag indicator visibility**: Blue hint line now spans full timeline width
  - Previously only visible in left column
  - Makes drop position easier to see
- **Delete button behavior**: Deletes individual parameter rows instead of entire sections
  - Last parameter deletion also removes section header
  - Updated confirmation dialogs reflect new behavior
- **Smart drag-drop hint**: Blue line only shows when position would actually change
  - Prevents confusion when dragging to same position
- **Parameter defaults**: New parameters use sensible defaults
  - Bar color: pink (#a82968)
  - Title: "Add parameter"
  - Description: "Add description"
  - Delay: 0ms
  - Duration: 300ms
  - Easing: "-"
  - Values: "-"

### Fixed
- **Playhead detachment on scroll**: Added scroll event listeners
  - Updates playhead position on window scroll
  - Updates on timeline container scroll
  - Playhead stays properly aligned when page is scrolled
- **Playhead position with zoom**: Calculations now use current view duration
  - Fixed mismatch between playhead position and timeline ruler marks when zoomed
  - Drag calculations account for zoom level
- **Paste spec functionality**: Reset zoom level when pasting new spec
  - Prevents zoom state from persisting across different specs
- **Info box persistence during resize drag**: Maintains state throughout operation
  - If showing before drag, stays visible
  - If hidden, stays hidden
  - No flash on mouseup
- **Hover state during resize**: Bar maintains hover brightness during drag
  - Added `.dragging-resize` class
  - Prevents flashing when dragging near edges
- **Duplicate event listeners**: Added safeguard in playhead setup
  - Prevents multiple scroll/resize listeners from being added

### Technical Details
- Timeline rendering now uses `viewDuration` for zoom calculations
- Bar positioning calculated as percentage of current view duration
- Resize handles: 8px invisible zones on left/right edges with `ew-resize` cursor
- Drag direction determined by comparing `deltaX` vs `deltaY` after 5px threshold
- Custom description support: animations can override auto-generated descriptions
- Section and parameter move operations handle cross-layer transfers
- Optimized resize dragging: updates bar styles directly, full re-render only on mouseup

## [Previous] - 2025-11-21

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
