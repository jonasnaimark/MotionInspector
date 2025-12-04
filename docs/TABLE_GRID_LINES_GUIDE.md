# Table Grid Lines Guide

To change the grid line colors in table mode (data area only, not header row or left column), update these CSS properties to the same value:

## Current Color: `#252525`

---

## Vertical Borders (border-right)

1. **`.table-cell--desc`** (~line 2283)
   ```css
   border-right: 1px solid #252525;
   ```

2. **`.table-cell--delay, .table-cell--duration`** (~line 2304)
   ```css
   border-right: 1px solid #252525;
   ```

3. **`.table-row--layer .table-cell`** (~line 2344)
   ```css
   border-right: 1px solid #252525;
   ```

4. **`.table-gap-row .table-cell`** (~line 2463)
   ```css
   border-right: 1px solid #252525;
   ```

---

## Horizontal Borders (border-bottom)

5. **`body.table-view-active .timeline-track.table-row:not(.table-row--header)`** (~line 2438)
   ```css
   border-bottom-color: #252525;
   ```

---

## Child Layer Header Borders

6. **`body.table-view-active .timeline-track.child-layer-header.table-row`** (~line 1993)
   ```css
   border-top: 1px solid #252525;
   ```

7. **`body.table-view-active .timeline-track.child-layer-header.table-row::before`** (~lines 2005-2017)
   - This is a gradient that draws vertical lines in the gap above child sections
   - Replace all 6 instances of the color in the gradient

---

## Gap Row Borders

8. **`.table-gap-row`** (~line 2457)
   ```css
   border-top: 1px solid #252525;
   ```

---

## Quick Find & Replace

Search for `#252525` in the table-related CSS sections and replace with your new color.

**Note:** The header row uses `#222222` and section dividers use `#555` - these are intentionally different and should not be changed with the data grid lines.

**Note:** Line numbers are approximate and may shift as the file is edited.
