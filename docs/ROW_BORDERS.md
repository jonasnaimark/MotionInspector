# Row Border Styling

This document explains how horizontal row borders work in Motion Inspector and how to adjust them.

## Current Color

All row borders use: `#222222`

## Quick Change

To change all row borders at once, search and replace:
```
1px solid #222222
```
Replace with your desired color (e.g., `1px solid #2a2a2a` for lighter).

**Do NOT change** the `#555` color used for section dividers unless you want those to change too.

## Where Borders Are Defined

### Timeline Mode

**Left Column (Labels)**

| Selector | Property | Line ~|
|----------|----------|-------|
| `.timeline-label` | `border-bottom` | 1706 |
| `.timeline-label.layer-header` | `border-bottom` | 1658 |
| `.timeline-label.child-layer-header.first-child-layer` | `border-top` | 1929 |

**Right Column (Tracks)**

| Selector | Property | Line ~|
|----------|----------|-------|
| `.timeline-track` | `border-bottom` | 2077 |
| `.timeline-track.layer-header` | `border-bottom` | 1665 |
| `.timeline-track.child-layer-header.first-child-layer:not(.table-row)` | `border-top` | 1949 |

### Table Mode

**Vertical borders between columns:**

| Selector | Property | Line ~|
|----------|----------|-------|
| `.table-cell--desc` | `border-right` | 2147 |
| `.table-cell--delay, .table-cell--duration` | `border-right` | 2168 |
| `.table-row--header .table-cell--desc/delay/duration` | `border-right` | 2201 |
| `.table-row--layer .table-cell` | `border-right` | 2207 |

**First child layer in table mode:**

| Selector | Property | Line ~|
|----------|----------|-------|
| `body.table-view-active .timeline-label.child-layer-header.first-child-layer` | `border-top` | 1959 |
| `body.table-view-active .timeline-track.child-layer-header.table-row.first-child-layer` | `border-top` | 1959 |

## Section Dividers (Different Color)

Section dividers between layer groups use a brighter color (`#555`):

```css
.timeline-label.layer-header.has-divider,
.timeline-track.layer-header.has-divider {
  border-top: 1px solid #555;
}
```

## Background Colors

Layer headers and child layer headers have **no background color** by default (uniform with other rows).

Hover states use subtle highlights:
- `.timeline-label.child-layer-header:hover` → `rgba(255, 255, 255, 0.05)`

## Color Reference

| Hex Code | Description |
|----------|-------------|
| `#1a1a1a` | Very dark (almost invisible) |
| `#202020` | Dark |
| `#222222` | **Current row borders** |
| `#2a2a2a` | Slightly lighter |
| `#333333` | Medium |
| `#555555` | Section dividers |

## Tips

- Darker colors make borders more subtle
- Lighter colors make the grid more visible
- Keep left column (labels) and right column (tracks) borders the same color for alignment
- The first child layer has both `border-top` and inherits `border-bottom` from `.timeline-label`
