# Row Height Guide

To change the row height in MotionInspector, update **all 7** of these CSS properties to the same value:

## Timeline Mode

1. **`.timeline-row`** (~line 1647)
   ```css
   min-height: 34px;
   ```

2. **`.timeline-label.layer-header`** (~line 1681)
   ```css
   height: 34px;
   ```

3. **`.timeline-track.layer-header`** (~line 1688)
   ```css
   height: 34px;
   ```

4. **`.timeline-label`** (~line 1734)
   ```css
   height: 34px;
   ```

5. **`.timeline-track`** (~line 2211)
   ```css
   height: 34px;
   ```

## Table Mode

6. **`body.table-view-active .timeline-label`** (~line 2404)
   ```css
   height: 34px;
   ```

7. **`body.table-view-active .timeline-track.table-row`** (~line 2433)
   ```css
   height: 34px;
   ```

## Quick Find & Replace

Search for these exact values and replace with your new height:
- `min-height: 34px` (1 occurrence in .timeline-row)
- `height: 34px` (6 occurrences in the selectors listed above)

**Note:** Line numbers are approximate and may shift as the file is edited.
