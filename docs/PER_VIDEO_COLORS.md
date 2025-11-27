# Per-Video Color System

This feature allows timeline bar colors to be set independently for each video in a tab. When you switch between videos, the colors update to show the colors you set for that specific video.

## How It Works

### Data Structure

**Videos** now have unique IDs:
```javascript
{
  id: "v_1234567890_abc123def",  // Unique ID (persists through export/import)
  src: "./video.mp4",
  file: File,
  description: ""
}
```

**Animation colors** are stored per-video:
```javascript
anim.customColorPerVideo = {
  "v_1234567890_abc123def": "#045c7d",  // Color for video 1
  "v_9876543210_xyz789ghi": "#a82929"   // Color for video 2
}
```

### Key Functions

Located near the top of the `<script>` section (~lines 2257-2310):

- `generateVideoId()` - Creates unique video IDs
- `getCurrentVideoId()` - Returns the current video's ID
- `getAnimationColorForVideo(anim, videoId)` - Gets color for a specific video
- `setAnimationColorForVideo(anim, videoId, color)` - Sets color for a specific video
- `copyColorsToVideo(specData, fromVideoId, toVideoId)` - Copies all colors from one video to another

### Behavior

1. **Setting colors**: When you pick a color, it's stored for the current video only
2. **Switching videos**: Timeline/table re-renders to show that video's colors
3. **Adding a new video**: Colors are copied from the current video as defaults
4. **Export**: Video IDs and per-video colors are preserved in exported files

## Files Modified

All changes are in `MotionInspector.html`:

1. **Helper functions** (~lines 2257-2310): Color get/set logic
2. **Video creation** (4 locations): Added `id: generateVideoId()`
3. **Color picker** (~line 8114): Uses `setAnimationColorForVideo()`
4. **Timeline render** (~line 6571): Uses `getAnimationColorForVideo()`
5. **Detail panel** (~line 8171): Uses `getAnimationColorForVideo()`
6. **Video switch** (~line 2492): Calls `refreshActiveView()` to update colors
7. **Export** (~line 5637): Includes video ID in export

## How to Update

### Change color storage location
Modify `setAnimationColorForVideo()` and `getAnimationColorForVideo()`

### Change video ID format
Modify `generateVideoId()`

### Change color copy behavior
Modify `copyColorsToVideo()` and where it's called in `addAnotherVideo` (~line 2612)

## How to Remove

1. **Remove helper functions**: Delete `generateVideoId()`, `getCurrentVideoId()`, `getAnimationColorForVideo()`, `setAnimationColorForVideo()`, `copyColorsToVideo()` (~lines 2257-2310)

2. **Revert video creation**: Remove `id: generateVideoId()` from 4 video creation locations:
   - ~line 2400
   - ~line 2412
   - ~line 2610
   - ~line 3432

3. **Revert color setter** (~line 8114): Change back to:
   ```javascript
   targetAnim.customColor = color;
   ```

4. **Revert timeline render** (~line 6571): Change back to:
   ```javascript
   if (anim.customColor) {
     // ... use anim.customColor
   }
   ```

5. **Revert detail panel** (~line 8171): Change back to:
   ```javascript
   const barColor = anim.customColor || defaultBarColor;
   ```

6. **Remove video switch re-render** (~line 2492): Remove `refreshActiveView();` call

7. **Remove export ID** (~line 5637): Remove `id: video.id || generateVideoId(),`

8. **Migration** (optional): To migrate existing per-video colors back to single colors, pick one video's colors or implement a migration that selects the first video's colors for each animation.