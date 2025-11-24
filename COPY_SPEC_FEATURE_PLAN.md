# Copy Spec JSON Feature Plan

## Problem Statement

Users want to edit already-exported spec files without rebuilding them from scratch. Attempts to make exported HTML files self-modifying have failed due to:
- DOM serialization issues (outerHTML captures live page state)
- XMLSerializer encoding breaking JavaScript code
- Complexity of keeping export functions in exported files

## Solution: Extract → Edit → Re-export Workflow

Instead of making files save themselves, we provide an easy way to extract spec data from exported files and load it back into the main editor.

## Implementation

### 1. Add "Copy Spec JSON" Button to Exported Files

**Location**: Exported HTML files (read-only mode)

**Button**:
```html
<button class="btn btn-secondary" onclick="copySpecJson()">
  <span class="btn-emoji">📋</span>&nbsp;&nbsp;Copy Spec JSON
</button>
```

**Function**:
```javascript
async function copySpecJson() {
  try {
    const jsonString = JSON.stringify(specData, null, 2);
    await navigator.clipboard.writeText(jsonString);
    alert('Spec JSON copied to clipboard!\n\nYou can now paste this into the main MotionInspector.html file to continue editing.');
  } catch (err) {
    alert('Failed to copy to clipboard: ' + err.message);
    console.error(err);
  }
}
```

**Technical Details**:
- The spec data is already fully stored in exported files as `const EMBEDDED_SPEC_DATA = {...}`
- `specData` contains ALL edits: layers, animations, timing, reordering, etc.
- Copying is trivial: just `JSON.stringify(specData, null, 2)`
- No serialization issues because we're only copying data, not HTML/JavaScript

### 2. Use Existing "Paste Spec" Button

**No changes needed!** The existing "Paste Spec" button in the main file already handles:
- After Effects extracted JSON
- Exported spec JSON (identical format)

## User Workflow

1. **Open exported file** (read-only)
2. **Click "Copy Spec JSON"** → Spec data copied to clipboard
3. **Open main MotionInspector.html**
4. **Click "Paste Spec"** → Spec loads into editable timeline
5. **Click "Add Video"** → Re-select video file from exported zip folder
6. **Make edits** (add rows, change timing, reorder sections, etc.)
7. **Click "Export Zip"** → Creates new exported file with all changes

## What Gets Copied

All spec data including:
- ✅ All layers (sections)
- ✅ All animations (rows)
- ✅ Layer/animation order
- ✅ Timing (delay, duration)
- ✅ Easing settings
- ✅ Property names and descriptions
- ✅ Value data
- ✅ Work area duration

## What Doesn't Get Copied

- ❌ Video file (user must re-select from exported zip folder)
  - **Why**: Clipboard can only hold text (JSON), not binary files
  - **Impact**: One extra click to re-add video
- ❌ Video section width
  - **Why**: Not stored in specData, only in exported file's CSS
  - **Impact**: Minor - user can resize if needed

## Trade-offs

### Pros
- ✅ Simple and reliable (no serialization issues)
- ✅ Uses existing "Paste Spec" functionality
- ✅ All edit data is preserved
- ✅ No complex self-modifying HTML
- ✅ ~10 lines of code to implement

### Cons
- ⚠️ Requires re-selecting video file (1 extra click)
- ⚠️ Video section width not preserved
- ⚠️ Multi-step workflow (not single "Edit & Save")

## Why This Works

The key insight: **`specData` is the single source of truth**. All UI edits write back to `specData`:
- Adding/deleting layers: `specData.layers.splice(...)`
- Changing timing: `targetAnim.timing.delay = newDelay`
- Reordering: Array manipulation of `specData.layers`

When exported, this full `specData` object is embedded in the HTML as JSON, making extraction trivial.

## Alternative Considered (and Why It Failed)

**Direct file save with File System Access API**:
- Attempted to use `showSaveFilePicker()` to let users save edited files
- Failed because capturing live document state breaks JavaScript:
  - `outerHTML` captures rendered timeline HTML
  - `XMLSerializer` encodes entities (`<` → `&lt;`), breaking code
  - Cloning document loses event listeners and breaks functionality
- Too fragile and complex to maintain

## Recommendation

Implement this feature. The video re-selection step is a small price to pay for a reliable, simple solution that preserves all spec edits.
