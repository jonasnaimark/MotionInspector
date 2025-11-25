# Motion Spec Processing Guide

**Complete Reference for Porting Natural Language Generation Logic**

*Last Updated: November 24, 2025*

---

## Table of Contents

1. [Overview](#overview)
2. [Data Pipeline Architecture](#data-pipeline-architecture)
3. [JSON Data Structure](#json-data-structure)
4. [Resolution Scaling System](#resolution-scaling-system)
5. [Natural Language Templates](#natural-language-templates)
6. [Data Processing Rules](#data-processing-rules)
7. [Easing System](#easing-system)
8. [Special Cases & Edge Cases](#special-cases--edge-cases)
9. [Table Generation Logic](#table-generation-logic)
10. [Implementation Reference](#implementation-reference)
11. [Porting Checklist](#porting-checklist)

---

## Overview

The Motion Spec Tools system (branded as "Spectrum") transforms After Effects animation data into natural language motion specifications. This document provides a complete reference for replicating this processing logic in other platforms.

### System Purpose

- **Input**: Keyframe animation data from After Effects
- **Output**: Human-readable motion specifications with descriptions like "Moves 100px from the left"
- **Key Feature**: Intelligent grouping, resolution scaling, and contextual natural language generation

---

## Data Pipeline Architecture

### Three-Stage Processing

```
┌─────────────────────┐
│  After Effects      │  Stage 1: Raw Data Extraction
│  (ExtendScript)     │  - Keyframe detection
│                     │  - Property value extraction
│  Output: JSON file  │  - Spring marker parsing
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Swift Desktop App  │  Stage 2: Data Transformation
│  (Bridge Server)    │  - Position array splitting
│                     │  - Data structure normalization
│  Output: HTTP JSON  │  - Type coercion
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Figma Plugin       │  Stage 3: Rendering & Display
│  (TypeScript)       │  - Natural language generation
│                     │  - Animation grouping
│  Output: Tables     │  - Table creation
└─────────────────────┘
```

### File Locations

- **AE Extraction**: `Motion_Spec_Desktop_Export.jsx` (1872 lines)
- **Swift Bridge**: `MotionSpecApp/Sources/Spectrum/BridgeServer.swift` (1167 lines)
- **Figma Plugin**: `packages/figma-plugin/src/code.ts` (2000+ lines)
- **Natural Language**: `packages/shared/src/motionDescriptions.ts` (607 lines)
- **Type Definitions**: `packages/shared/src/types.ts` (152 lines)

---

## JSON Data Structure

### Top-Level Structure

```json
{
  "compName": "Button Animation",
  "workArea": {
    "start": 0,
    "duration": 2000
  },
  "layers": [
    {
      "layerName": "Button",
      "layerType": "shape",
      "animations": [...],
      "parenting": {...},
      "expressionLinks": [...],
      "isFitToShape": false
    }
  ],
  "metadata": {
    "version": "2.0.0",
    "timestamp": "2025-11-24T10:30:00Z",
    "composition": {
      "width": 750,
      "height": 1334,
      "detectedMultiplier": 2,
      "scaleFactor": 0.5
    }
  }
}
```

### Animation Property Structure

```json
{
  "property": "Position X",
  "easing": {
    "type": "spring",
    "spring": {
      "preset": "Standard Spring",
      "custom": {
        "stiffness": 175,
        "damping": 26.46,
        "dampingRatio": 1,
        "mass": 1
      }
    },
    "cubicBezier": null,
    "cubicBezierPreset": null,
    "source": "marker"
  },
  "values": {
    "startValue": -371,
    "endValue": 129,
    "change": 500,
    "type": "position",
    "formatted": {
      "startValue": "-371px",
      "endValue": "129px",
      "change": "+500px"
    }
  },
  "timing": {
    "delay": 0,
    "duration": 1683
  }
}
```

**Key Fields Explained**:

- `property`: Property name from AE (e.g., "Position X", "Scale", "Opacity")
- `easing.type`: One of `"spring"`, `"cubic-bezier"`, or `"linear"`
- `easing.source`: How easing was detected (`"marker"`, `"baked"`, `"bezier"`, `"linear"`)
- `values.change`: Calculated difference (endValue - startValue)
- `timing.delay`: Milliseconds from workArea start to first keyframe
- `timing.duration`: Milliseconds between first and last keyframe

### Layer Types

```json
{
  "layerType": "shape" | "precomp" | "text" | "null" | "solid" | "camera" | "light"
}
```

### Parenting Structure

```json
{
  "parenting": {
    "parentName": "Container",
    "animatingProperties": ["position", "rotation", "scale"]
  }
}
```

### Expression Links Structure

```json
{
  "expressionLinks": [
    {
      "property": "Opacity",
      "sourceLayer": "Box",
      "sourceProperty": "opacity"
    }
  ]
}
```

### Fit to Shape Structure

```json
{
  "fitToShape": {
    "containerLayerName": "Image Container",
    "alignment": 1,
    "scaleTo": 1
  },
  "isFitToShape": true
}
```

**Fit to Shape Values**:
- `alignment`: 1-11 (maps to 9-point grid positions)
- `scaleTo`: 1=Width, 2=Height, 3=Stretch, 4=None

---

## Resolution Scaling System

### Detection Logic

**File**: `Motion_Spec_Desktop_Export.jsx` lines 369-406

The system automatically detects device resolution multipliers by matching composition dimensions against known device screen sizes.

```javascript
// Common iOS device dimensions
var deviceDimensions = [
  // 1x devices
  { multiplier: 1, widths: [375, 390, 414, 428, 430], heights: [667, 844, 896, 926] },

  // 2x devices
  { multiplier: 2, widths: [750, 780, 828, 856, 860], heights: [1334, 1688, 1792, 1852] },

  // 3x devices
  { multiplier: 3, widths: [1125, 1170, 1242, 1284, 1290], heights: [2001, 2532, 2688, 2778] }
];
```

**Detection Process**:
1. Get composition width and height
2. Match against device dimension database
3. If match found, set `detectedMultiplier` and `scaleFactor`
4. If no match, default to 1x (no scaling)

### Scaling Application Rules

**Properties that ARE scaled**:
- Position X and Y values
- Corner radius (all types: unified, per-corner, IndieCorners)
- Dimensional properties: Width, Height, Size, Distance, Softness, Corner Smoothing

**Properties that are NOT scaled**:
- Scale percentages (already relative)
- Rotation degrees (absolute units)
- Opacity percentages (0-100 scale)
- Color values

**Example Calculations**:

```javascript
// 2x composition (iPhone 13)
// Raw AE value: 750px
// Scaled value: 750 ÷ 2 = 375px

// 3x composition (iPhone 13 Pro)
// Raw AE value: 1170px
// Scaled value: 1170 ÷ 3 = 390px
```

**Implementation** (`Motion_Spec_Desktop_Export.jsx` lines 561-608):

```javascript
function extractPropertyValues(prop, multiplier) {
  var startValue = prop.keyValue(1);
  var endValue = prop.keyValue(prop.numKeys);

  // Check if property should be scaled
  var isPositional = (propName.indexOf("Position") !== -1);
  var isCornerProperty = isDimensionalProperty(propName);

  if (isPositional || isCornerProperty) {
    if (Array.isArray(startValue)) {
      // Scale array values (Position)
      startValue = [startValue[0] / multiplier, startValue[1] / multiplier];
      endValue = [endValue[0] / multiplier, endValue[1] / multiplier];
    } else {
      // Scale single values (Corner Radius, Width, etc.)
      startValue = startValue / multiplier;
      endValue = endValue / multiplier;
    }
  }
}
```

### Corner Property Detection

**File**: `Motion_Spec_Desktop_Export.jsx` lines 639-655

```javascript
function isCornerProperty(propName) {
  var lower = propName.toLowerCase();
  return (
    lower === "tl" || lower === "tr" || lower === "bl" || lower === "br" ||
    lower.indexOf("corner") !== -1 ||
    lower.indexOf("radius") !== -1 ||
    lower === "unified radius" ||
    lower === "unified corners"
  );
}
```

### Dimensional Property Detection

```javascript
function isDimensionalProperty(propName) {
  var lower = propName.toLowerCase();
  return (
    lower.indexOf("width") !== -1 ||
    lower.indexOf("height") !== -1 ||
    lower.indexOf("size") !== -1 ||
    lower.indexOf("distance") !== -1 ||
    lower.indexOf("softness") !== -1 ||
    lower.indexOf("corner smoothing") !== -1
  );
}
```

---

## Natural Language Templates

### Template System Architecture

**File**: `packages/shared/src/motionDescriptions.ts`

The system uses a **priority-ordered template array** where each template can "claim" properties it knows how to describe.

```typescript
const TEMPLATES: PropertyTemplate[] = [
  fitToShapeTemplate,      // Highest priority - AirBoard plugin effect
  cornerRadiusTemplate,    // IndieCorners and Squircle plugins
  alphaTemplate,           // Opacity animations
  scaleTemplate,           // Scale animations
  positionTemplate,        // Position X and Y
  rotationTemplate,        // Rotation animations
  genericTemplate          // Fallback for unknown properties
];
```

### Position Template

**File**: Lines 302-373

**Patterns Matched**: "Position X", "position x", "X Position", "POSITION_X"

```typescript
// Position X descriptions
if (change > 0) {
  return `Moves ${Math.abs(change)}px from the left`;
}
if (change < 0) {
  return `Moves ${Math.abs(change)}px from the right`;
}
if (change === 0) {
  return `Position X stays at ${startValue}px`;
}

// Position Y descriptions
if (change < 0) {
  return `Moves up ${Math.abs(change)}px`;
}
if (change > 0) {
  return `Moves down ${change}px`;
}
if (change === 0) {
  return `Position Y stays at ${startValue}px`;
}
```

**Examples**:
- `{startValue: 0, endValue: 100, change: 100}` → "Moves 100px from the left"
- `{startValue: 100, endValue: 20, change: -80}` → "Moves 80px from the right"
- `{startValue: 500, endValue: 200, change: -300}` → "Moves up 300px"

### Alpha/Opacity Template

**File**: Lines 234-260

**Patterns Matched**: "Opacity", "opacity", "Alpha", "OPACITY"

```typescript
// Special cases (common patterns)
if (startValue === 0 && endValue === 100) {
  return "Alpha animates from 0% – 100%";
}
if (startValue === 100 && endValue === 0) {
  return "Alpha animates from 100% – 0%";
}

// Fade in patterns
if (startValue === 0) {
  return `Fades in to ${endPercent}`;
}

// Fade out patterns
if (endValue === 0) {
  return `Fades out from ${startPercent}`;
}

// Default
return `Alpha animates from ${startPercent} – ${endPercent}`;
```

**Important Note**: After Effects opacity comes as 0-100, not 0-1. No multiplication needed.

**Examples**:
- `{startValue: 0, endValue: 100}` → "Alpha animates from 0% – 100%"
- `{startValue: 0, endValue: 75}` → "Fades in to 75%"
- `{startValue: 50, endValue: 0}` → "Fades out from 50%"

### Scale Template

**File**: Lines 265-297

**Patterns Matched**: "Scale", "scale", "SCALE"

```typescript
// Uniform scaling (both X and Y are same)
if (Array.isArray(startValue) && startValue[0] === startValue[1] &&
    Array.isArray(endValue) && endValue[0] === endValue[1]) {
  return `Scale animates from ${Math.round(startValue[0])}% – ${Math.round(endValue[0])}%`;
}

// Non-uniform scaling
if (Array.isArray(startValue) && Array.isArray(endValue)) {
  const startX = Math.round(startValue[0]);
  const startY = Math.round(startValue[1]);
  const endX = Math.round(endValue[0]);
  const endY = Math.round(endValue[1]);
  return `Scale animates from ${startX}%, ${startY}% – ${endX}%, ${endY}%`;
}

// Single-value scale (rare)
return `Scale animates from ${Math.round(startValue)}% – ${Math.round(endValue)}%`;
```

**Examples**:
- `{startValue: [0, 0], endValue: [100, 100]}` → "Scale animates from 0% – 100%"
- `{startValue: [100, 50], endValue: [150, 75]}` → "Scale animates from 100%, 50% – 150%, 75%"

### Rotation Template

**File**: Lines 378-410

**Patterns Matched**: "Rotation", "rotation", "X Rotation", "Y Rotation", "Z Rotation"

```typescript
// Convert from revolutions to degrees
const degrees = Math.abs(Math.round(change));

// Determine direction
const direction = change > 0 ? 'clockwise' : 'counterclockwise';

// Determine axis (if specified)
const propLower = property.toLowerCase();
const axis = propLower.includes('x') ? 'X ' :
             propLower.includes('y') ? 'Y ' :
             propLower.includes('z') ? 'Z ' : '';

return `Rotates ${axis}${degrees}° ${direction}`;
```

**Examples**:
- `{property: "Rotation", change: 180}` → "Rotates 180° clockwise"
- `{property: "Rotation", change: -90}` → "Rotates 90° counterclockwise"
- `{property: "X Rotation", change: 45}` → "Rotates X 45° clockwise"

### Corner Radius Template

**File**: Lines 415-470

**Patterns Matched**:
- IndieCorners: "tl", "tr", "bl", "br"
- Squircle: "Unified Radius", "Top Left", "Top Right", "Bottom Left", "Bottom Right"
- Generic: Any property containing "corner", "radius", "border radius"

```typescript
// Special case: Sharp to rounded
if (startRounded === 0 && endRounded > 0) {
  return `Corner radius animates from sharp (0px) – rounded (${endRounded}px)`;
}

// Special case: Rounded to sharp
if (startRounded > 0 && endRounded === 0) {
  return `Corner radius animates from rounded (${startRounded}px) – sharp (0px)`;
}

// Default
return `Corner radius animates from ${startRounded}px – ${endRounded}px`;
```

**Key Feature**: All corner property names are transformed to "Corner Radius" in the Property column for consistency.

**Examples**:
- `{property: "tl", startValue: 0, endValue: 24}` → "Corner radius animates from sharp (0px) – rounded (24px)"
- `{property: "Unified Radius", startValue: 16, endValue: 32}` → "Corner radius animates from 16px – 32px"

### Fit to Shape Template

**File**: Lines 213-229, 475-492

**Patterns Matched**: Layers with `fitToShape` object present

```typescript
function generateFitToShapeDescription(fitToShape) {
  const { containerLayerName, alignment, scaleTo } = fitToShape;

  // Format alignment (1-11 dropdown value to text)
  const alignText = formatFitToShapeAlignment(alignment);

  // Format scale mode
  if (scaleTo === 4) {
    return `Positioned within "${containerLayerName}" — no scaling — aligned ${alignText}`;
  } else if (scaleTo === 3) {
    return `Stretches to fill "${containerLayerName}" — aligned ${alignText}`;
  } else {
    const scaleText = formatFitToShapeScaleMode(scaleTo);
    return `Scales to ${scaleText} of "${containerLayerName}" — aligned ${alignText}`;
  }
}
```

**Alignment Map** (Lines 176-187):
```typescript
const FIT_TO_SHAPE_ALIGNMENT: { [key: number]: string } = {
  1: 'center',
  2: 'center left',
  3: 'center right',
  5: 'top center',
  6: 'top left',
  7: 'top right',
  9: 'bottom center',
  10: 'bottom left',
  11: 'bottom right'
};
```

**Scale Mode Map** (Lines 192-197):
```typescript
function formatFitToShapeScaleMode(scaleTo: number): string {
  if (scaleTo === 1) return 'fit width';
  if (scaleTo === 2) return 'fit height';
  if (scaleTo === 3) return 'stretch';
  return 'no scaling';
}
```

**Examples**:
- `{containerLayerName: "Container", alignment: 1, scaleTo: 1}` → "Scales to fit width of \"Container\" — aligned center"
- `{containerLayerName: "Box", alignment: 6, scaleTo: 3}` → "Stretches to fill \"Box\" — aligned top left"

### Generic Template (Fallback)

**File**: Lines 497-560

For properties not matched by specific templates:

```typescript
function generateGenericDescription(property, values) {
  const { startValue, endValue } = values;

  // Handle arrays (2D properties)
  if (Array.isArray(startValue) && Array.isArray(endValue)) {
    return `${property} animates from [${startValue.join(', ')}] – [${endValue.join(', ')}]`;
  }

  // Single values
  return `${property} animates from ${startValue} – ${endValue}`;
}
```

---

## Data Processing Rules

### Position Array Splitting

**File**: `BridgeServer.swift` lines 843-907

The Swift bridge server splits combined Position arrays into separate Position X and Position Y animations.

**Logic**:

```swift
func processAnimations(_ animationsData: [[String: Any]]) -> [AnimationProperty] {
  for animationData in animationsData {
    let property = animationData["property"] as? String ?? ""

    // Check if this is a Position property with array values
    if property.lowercased() == "position" &&
       let values = animationData["values"] as? [String: Any],
       let startValue = values["startValue"] as? [Double],
       let endValue = values["endValue"] as? [Double],
       startValue.count == 2, endValue.count == 2 {

      // Calculate individual changes
      let changeX = endValue[0] - startValue[0]
      let changeY = endValue[1] - startValue[1]

      // Only create animation if change is significant (> 0.5px)
      if abs(changeX) > 0.5 {
        // Create Position X animation
        let posXAnimation = AnimationProperty(
          property: "Position X",
          values: PropertyValues(
            startValue: .number(startValue[0]),
            endValue: .number(endValue[0]),
            change: changeX
          ),
          // ... copy timing and easing
        )
        animations.append(posXAnimation)
      }

      if abs(changeY) > 0.5 {
        // Create Position Y animation (similar structure)
        animations.append(posYAnimation)
      }
    }
  }
}
```

**Key Rules**:
- **Threshold**: Only creates X or Y animation if `abs(change) > 0.5` pixels
- **Preserves Timing**: Delay and duration copied to both X and Y
- **Preserves Easing**: Same easing applied to both axes
- **Filters Static Axes**: If layer only moves horizontally, only Position X is created

### Position Re-Grouping

**File**: `packages/figma-plugin/src/code.ts` lines 1577-1616

After splitting, the Figma plugin intelligently re-groups Position X and Y if they share the same timing and easing.

**Logic**:

```typescript
function groupPositionAnimations(animations: AnimationProperty[]): (AnimationProperty | AnimationProperty[])[] {
  const posX = animations.find(a => a.property === 'Position X');
  const posY = animations.find(a => a.property === 'Position Y');

  // If both exist and match timing/easing, group them
  if (posX && posY &&
      posX.timing.delay === posY.timing.delay &&
      easingsMatch(posX.easing, posY.easing)) {

    // Return grouped array
    return [[posX, posY], ...otherAnimations];
  }

  // Otherwise keep separate
  return animations;
}
```

**Easing Comparison** (Lines 1542-1575):

```typescript
function easingsMatch(a: Easing, b: Easing): boolean {
  const epsilon = 0.01; // Floating point tolerance

  if (a.type !== b.type) return false;

  if (a.type === 'spring' && b.type === 'spring') {
    // Compare spring parameters with tolerance
    const aCustom = a.spring?.custom;
    const bCustom = b.spring?.custom;

    if (aCustom && bCustom) {
      return Math.abs(aCustom.stiffness - bCustom.stiffness) < epsilon &&
             Math.abs(aCustom.damping - bCustom.damping) < epsilon &&
             Math.abs(aCustom.dampingRatio - bCustom.dampingRatio) < epsilon &&
             Math.abs(aCustom.mass - bCustom.mass) < epsilon;
    }

    // If presets, compare preset names
    return a.spring?.preset === b.spring?.preset;
  }

  if (a.type === 'cubic-bezier' && b.type === 'cubic-bezier') {
    // Compare cubic-bezier strings
    return a.cubicBezier === b.cubicBezier;
  }

  return true; // Linear easings always match
}
```

**Display Format**:
- **Property Column**: "Position X & Y"
- **Notes Column**: Combined descriptions with lowercase second part
  - Example: "Moves 100px from the left, and moves down 50px"
- **Delay/Duration/Easing**: Single shared values

### Staggered Animation Detection

**File**: `packages/figma-plugin/src/code.ts` lines 1618-1743

**Purpose**: Detect 3+ layers with identical animations but offset timing (stagger effect).

**Conservative Detection Rules**:

```typescript
function detectStaggeredAnimations(layers: MotionSpecLayer[]): StaggerGroup[] {
  const groups: StaggerGroup[] = [];

  for (const layer of layers) {
    // Rule 1: Layer must have 2+ animations (skip simple fades)
    if (layer.animations.length < 2) {
      continue;
    }

    // Find candidate layers for grouping
    const candidates = layers.filter(candidate => {
      // Rule 2: Must have SAME NUMBER of animations
      if (candidate.animations.length !== layer.animations.length) {
        return false;
      }

      // Rule 3: All animations must match (property, easing, duration, values)
      return allAnimationsMatch(layer.animations, candidate.animations);
    });

    // Rule 4: Need at least 3 items to form stagger
    if (candidates.length >= 3) {
      // Calculate delay offset
      const delayOffset = candidates[1].animations[0].timing.delay -
                          candidates[0].animations[0].timing.delay;

      // Rule 5: Offset must be uniform (within 5ms tolerance)
      const uniformOffset = candidates.every((layer, i) => {
        if (i === 0) return true;
        const expectedDelay = candidates[0].animations[0].timing.delay + (delayOffset * i);
        const actualDelay = layer.animations[0].timing.delay;
        return Math.abs(expectedDelay - actualDelay) < 5;
      });

      if (uniformOffset) {
        groups.push({
          layers: candidates,
          delayOffset: delayOffset,
          referenceLayer: candidates[0]
        });
      }
    }
  }

  return groups;
}
```

**Animation Matching Rules**:
- Same property names
- Same easing type and parameters
- Same duration (within 10ms tolerance)
- Same value changes (within 5px/% tolerance)

**Group Naming** (Lines 1685-1717):

```typescript
function generateGroupName(layerNames: string[]): string {
  // Extract common prefix
  const firstName = layerNames[0];
  let commonPrefix = firstName;

  for (const name of layerNames.slice(1)) {
    while (commonPrefix.length > 0 && !name.startsWith(commonPrefix)) {
      commonPrefix = commonPrefix.slice(0, -1);
    }
  }

  // Clean up prefix (remove trailing numbers/underscores)
  commonPrefix = commonPrefix.replace(/[\d_\s]+$/, '').trim();

  // Pluralize
  return pluralize(commonPrefix);
}

function pluralize(word: string): string {
  const irregulars = {
    'child': 'children',
    'box': 'boxes',
    'item': 'items'
  };

  return irregulars[word.toLowerCase()] || (word + 's');
}
```

**Display Format**:

Creates a single "Note" row after the first item:
```
Note: Subsequent containers follow the above specs + a 50ms delay per item.
```

### Parenting Detection & Display

**File**: `Motion_Spec_Desktop_Export.jsx` lines 1069-1174

**Detection Logic**:

```javascript
function findChildLayers(parentLayer, comp, selectedLayers) {
  var children = [];

  // Get animating properties from parent
  var animatingProps = getAnimatingProperties(parentLayer);

  for (var i = 1; i <= comp.numLayers; i++) {
    var layer = comp.layer(i);

    // Check if parented to this layer
    if (layer.parent && layer.parent.index === parentLayer.index) {

      // Must be in selected layers
      if (selectedLayers.indexOf(layer.index) === -1) {
        continue;
      }

      // Don't include if it has Fit to Shape effect (handled separately)
      if (hasFitToShapeEffect(layer)) {
        continue;
      }

      children.push({
        layer: layer,
        parentName: sanitizeLayerName(parentLayer.name),
        animatingProperties: animatingProps
      });
    }
  }

  return children;
}
```

**Animating Properties Detection**:

```javascript
function getAnimatingProperties(layer) {
  var props = [];

  if (hasSelectedKeyframes(layer.position)) props.push("position");
  if (hasSelectedKeyframes(layer.rotation)) props.push("rotation");
  if (hasSelectedKeyframes(layer.scale)) props.push("scale");
  if (hasSelectedKeyframes(layer.opacity)) props.push("opacity");

  return props;
}
```

**Display** (`packages/figma-plugin/src/code.ts` lines 916-941):

```typescript
// Parented child rows show inherited properties
if (parenting && !animation.isFitToShape) {
  // Property column: Capitalize inherited properties
  const inheritedProps = parenting.animatingProperties
    .map(p => capitalize(p))
    .join(', ');

  // Notes column: Full explanation
  const notes = `Attached to ${parenting.parentName}, inherits ${parenting.animatingProperties.join(', ')}`;

  // Placeholders for timing/easing
  return {
    element: layerName,
    property: inheritedProps,  // "Position, Rotation"
    notes: notes,
    delay: '—',
    duration: '—',
    easing: '—'
  };
}
```

### Expression Link Handling

**File**: `Motion_Spec_Desktop_Export.jsx` lines 270-367

**Expression Parsing**:

```javascript
function parseExpression(expressionText) {
  // Pattern 1: thisComp.layer("Name").property
  var pattern1 = /thisComp\.layer\("([^"]+)"\)\s*\.(\w+)/g;

  // Pattern 2: thisComp.layer(index).transform.property
  var pattern2 = /thisComp\.layer\((\d+)\)\s*\.transform\.(\w+)/g;

  // Pattern 3: comp("CompName").layer("Name").property
  var pattern3 = /comp\("([^"]+)"\)\.layer\("([^"]+)"\)\.(\w+)/g;

  var match = pattern1.exec(expressionText);
  if (match) {
    return {
      type: 'layer_reference',
      sourceLayer: match[1],
      sourceProperty: match[2]
    };
  }

  // Try other patterns...
}
```

**Display** (`packages/figma-plugin/src/code.ts` lines 1094-1108):

```typescript
// Expression links shown as appended notes
if (expressionLinks && Array.isArray(expressionLinks) && expressionLinks.length > 0) {
  const expressionText = expressionLinks
    .map(link => `Expression: ${link.property} linked to ${link.sourceLayer}`)
    .join('     •    ');

  // Append with bullet separator
  notes += `     •    ${expressionText}`;
}
```

### Property Name Transformations

**File**: `packages/figma-plugin/src/code.ts` lines 10-36

```typescript
function transformPropertyName(property: string): string {
  const propLower = property.toLowerCase();

  // IndieCorners properties
  if (propLower === 'tl' || propLower === 'tr' ||
      propLower === 'bl' || propLower === 'br') {
    return 'Corner Radius';
  }

  // IndieCorners dimensions
  if (property === 'w') return 'Width';
  if (property === 'h') return 'Height';

  // Squircle plugin
  if (propLower === 'unified radius' || propLower === 'unified corners') {
    return 'Corner Radius';
  }

  // Generic corner properties
  if (propLower.includes('corner') || propLower.includes('radius')) {
    return 'Corner Radius';
  }

  // Otherwise return original
  return property;
}
```

---

## Easing System

### Spring Easing

**File**: `packages/shared/src/motionDescriptions.ts` lines 107-128

**Preset Detection**:

```typescript
const SPRING_PRESETS: { [key: string]: string } = {
  'Slow Spring': 'https://air.bb/slow-spring',
  'Standard Spring': 'https://air.bb/standard-spring',
  'Fast Spring': 'https://air.bb/fast-spring',
  'Slow Bounce Spring': 'https://air.bb/slow-bounce-spring',
  'Medium Bounce Spring': 'https://air.bb/medium-bounce-spring',
  'Fast Bounce Spring': 'https://air.bb/fast-bounce-spring'
};

function formatEasingDetailed(easing: Easing): string {
  if (easing.type === 'spring') {
    const preset = easing.spring?.preset;

    // Check if it's a known preset (with link)
    if (preset && SPRING_PRESETS[preset]) {
      return preset; // Returns preset name for display + hyperlinking
    }

    // Check for "Custom" or "Custom Spring"
    if (preset === 'Custom' || preset === 'Custom Spring') {
      const custom = easing.spring?.custom;
      if (custom) {
        return `Mass: ${custom.mass}, Stiffness: ${custom.stiffness}, Damping: ${custom.damping.toFixed(2)}, Damping Ratio: ${custom.dampingRatio}`;
      }
    }

    // Fallback
    return 'Spring';
  }
}
```

**Spring Detection in AE** (`Motion_Spec_Desktop_Export.jsx` lines 796-922):

```javascript
function findSpringForProperty(layer, matchName, timeRange) {
  // Priority 1: Find marker with exact matchName match
  for (var i = 1; i <= layer.marker.numKeys; i++) {
    var markerTime = layer.marker.keyTime(i);
    if (markerTime >= timeRange.start && markerTime <= timeRange.end) {
      var markerData = parseSpringMarker(layer.marker.keyValue(i));
      if (markerData.property === matchName) {
        return markerData.spring;
      }
    }
  }

  // Priority 2: Path-based matching (for new Sproing format)
  // Checks if marker property path ENDS with the matchName
  // Example: "4/1/2/Pseudo/85866-0002" ends with animation's matchName
  for (var i = 1; i <= layer.marker.numKeys; i++) {
    var markerData = parseSpringMarker(layer.marker.keyValue(i));
    var markerProperty = markerData.property;

    if (markerProperty && markerProperty.indexOf(matchName) !== -1) {
      return markerData.spring;
    }
  }

  // Priority 3: Fallback to any spring in range without property specified
  for (var i = 1; i <= layer.marker.numKeys; i++) {
    var markerTime = layer.marker.keyTime(i);
    if (markerTime >= timeRange.start && markerTime <= timeRange.end) {
      var markerData = parseSpringMarker(layer.marker.keyValue(i));
      if (!markerData.property) {
        return markerData.spring; // Generic spring marker
      }
    }
  }

  return null;
}
```

**Key Update (Nov 24, 2025)**: Added path-based matching to support new Sproing format that uses minimal keyframes with full property paths in markers.

### Cubic Bezier Easing

**File**: `packages/shared/src/motionDescriptions.ts` lines 130-164

**Preset Matching with Tolerance**:

```typescript
const CUBIC_BEZIER_PRESETS: { [key: string]: string } = {
  'cubic-bezier(0.2, 0, 0, 1)': 'Standard Curve',
  'cubic-bezier(0.1, 0.9, 0.2, 1)': 'Enter Curve',
  'cubic-bezier(0.4, 0, 1, 1)': 'Exit Curve'
};

function matchCubicBezierWithTolerance(cubicBezier: string): string | null {
  // First try exact match
  if (CUBIC_BEZIER_PRESETS[cubicBezier]) {
    return CUBIC_BEZIER_PRESETS[cubicBezier];
  }

  // Parse values
  const match = cubicBezier.match(/cubic-bezier\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/);
  if (!match) return null;

  const [_, x1, y1, x2, y2] = match.map(Number);

  // Check each preset with tolerance (0.15)
  const tolerance = 0.15;

  for (const [presetBezier, presetName] of Object.entries(CUBIC_BEZIER_PRESETS)) {
    const presetMatch = presetBezier.match(/cubic-bezier\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/);
    if (!presetMatch) continue;

    const [_, px1, py1, px2, py2] = presetMatch.map(Number);

    // Compare with tolerance
    if (Math.abs(x1 - px1) < tolerance &&
        Math.abs(y1 - py1) < tolerance &&
        Math.abs(x2 - px2) < tolerance &&
        Math.abs(y2 - py2) < tolerance) {
      return presetName;
    }
  }

  return null; // No match
}
```

**Why Tolerance is Needed**: After Effects quantizes vertical handles in keyframe assistant, causing values like `0.2` to become `0.15` or `0.25`. Tolerance of 0.15 accounts for this.

**Cubic Bezier Extraction** (`Motion_Spec_Desktop_Export.jsx` lines 980-1067):

```javascript
function extractCubicBezierFromSelectedKeyframes(prop, selectedRange) {
  if (prop.numKeys < 2) return null;

  // Get first and last keyframes in selected range
  var startKey = findFirstKeyInRange(prop, selectedRange);
  var endKey = findLastKeyInRange(prop, selectedRange);

  if (!startKey || !endKey) return null;

  // Get keyframe ease
  var inEase = prop.keyInTemporalEase(endKey);
  var outEase = prop.keyOutTemporalEase(startKey);

  // Convert to cubic-bezier format
  var x1 = outEase[0].influence / 100;
  var y1 = outEase[0].speed / 100;
  var x2 = 1 - (inEase[0].influence / 100);
  var y2 = 1 - (inEase[0].speed / 100);

  var cubicBezier = 'cubic-bezier(' +
    x1.toFixed(2) + ', ' + y1.toFixed(2) + ', ' +
    x2.toFixed(2) + ', ' + y2.toFixed(2) + ')';

  // Try to match to preset
  var presetName = matchCubicBezierPreset(cubicBezier);

  return {
    cubicBezier: cubicBezier,
    cubicBezierPreset: presetName  // Can be null
  };
}
```

**Display Format**:

```typescript
// If preset match
return 'Standard Curve'; // With hyperlink

// If no preset match
return 'Cubic Bezier (0.42, 0, 0.58, 1)';
```

### Easing Priority Order

**File**: `Motion_Spec_Desktop_Export.jsx` lines 1277-1356

```javascript
function detectEasingForProperty(layer, prop, selectedRange) {
  // PRIORITY 1: Spring markers (Sproing plugin)
  var spring = findSpringForProperty(layer, prop.matchName, selectedRange);
  if (spring) {
    return {
      type: 'spring',
      spring: spring,
      source: 'marker'
    };
  }

  // PRIORITY 2: Baked springs (dense keyframes)
  // Currently DISABLED - was too prone to false positives
  // var bakedSpring = detectBakedSpringInRange(prop, selectedRange);
  // if (bakedSpring.detected) { ... }

  // PRIORITY 3: Cubic-bezier (manual keyframes)
  var cubicBezier = extractCubicBezierFromSelectedKeyframes(prop, selectedRange);
  if (cubicBezier) {
    return {
      type: 'cubic-bezier',
      cubicBezier: cubicBezier.cubicBezier,
      cubicBezierPreset: cubicBezier.cubicBezierPreset,
      source: 'bezier'
    };
  }

  // PRIORITY 4: Linear (fallback)
  return {
    type: 'linear',
    source: 'linear'
  };
}
```

---

## Special Cases & Edge Cases

### Fit to Shape Priority over Parenting

**File**: `packages/figma-plugin/src/code.ts` lines 1071-1087

```typescript
// Fit to Shape SUPPRESSES normal parenting notes
if (animation.fitToShape) {
  // Show Fit to Shape description
  return generateFitToShapeDescription(
    animation.fitToShape.containerLayerName,
    animation.fitToShape.alignment,
    animation.fitToShape.scaleTo
  );
}

// Only show parenting if NOT a Fit to Shape layer
if (parenting && !animation.isFitToShape) {
  // Show parenting notes
  const inheritedProps = parenting.animatingProperties.join(', ');
  return `Attached to ${parenting.parentName}, inherits ${inheritedProps}`;
}
```

**Reasoning**: Fit to Shape layers are technically parented, but the relationship is described differently (container-based, not inheritance-based).

### Layer Name Sanitization

**File**: `Motion_Spec_Desktop_Export.jsx` lines 252-268

```javascript
function sanitizeLayerName(layerName) {
  var sanitized = layerName;

  // Remove Void plugin prefix (▣ character)
  sanitized = sanitized.replace(/^[▣\u25A3]\s+/, '');

  // Remove other problematic Unicode characters
  // Keep basic Latin (0020-007E) and Latin-1 Supplement (00A0-00FF)
  sanitized = sanitized.replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Fallback to original if sanitization resulted in empty string
  return sanitized || layerName;
}
```

**Common Issues**:
- Void plugin adds "▣ " prefix to layer names
- Some plugins add emoji or special characters
- Need to preserve readability in Figma tables

### Zero-Change Filtering

**File**: `BridgeServer.swift` lines 861-876

```swift
// Only create Position X animation if change > 0.5px
let changeX = endValue[0] - startValue[0]
if abs(changeX) > 0.5 {
  // Create animation
}

// Same for Position Y
let changeY = endValue[1] - startValue[1]
if abs(changeY) > 0.5 {
  // Create animation
}
```

**Reasoning**: Keyframes with negligible change (floating point rounding, AE quirks) should be filtered out to avoid clutter.

### Precomp Property Access

**File**: `Motion_Spec_Desktop_Export.jsx` lines 409-548

```javascript
function findPropertiesWithSelectedKeyframes(layer) {
  var properties = [];

  // Check if precomp layer
  if (isPrecompLayer(layer)) {
    // Precomps have different property structure
    // Search both layer properties and transform properties
    searchPropertiesWithSafety(layer, 0);

    // Also check layer.transform explicitly
    if (layer.transform) {
      searchPropertiesWithSafety(layer.transform, 0);
    }
  } else {
    // Normal layers - standard search
    searchPropertiesWithSafety(layer, 0);
  }

  return properties;
}
```

### Guide Layer Handling

**File**: `Motion_Spec_Desktop_Export.jsx` lines 184-229

```javascript
// Guide layers ARE included in extraction
for (var i = 0; i < selectedLayers.length; i++) {
  var layer = comp.layer(selectedLayers[i]);

  // Log guide status but don't filter
  var isGuide = layer.isGuideLayer ? " (GUIDE)" : "";
  DEBUG.log("Processing layer: " + layer.name + isGuide);

  // Process normally
  processLayer(layer);
}
```

**Reasoning**: Guide layers may have important animation structure even if not visible in final render.

### Multiple Animations on Same Layer

**Example**: Layer with Position X, Position Y, Scale, Rotation, Opacity

**Processing Flow**:

1. **AE Extraction**: Each property becomes separate animation object
2. **Swift Transformation**: Position split if needed
3. **Figma Grouping**: Position X & Y re-grouped if they match
4. **Table Display**: One row per animation (or grouped Position row)

**Result**:
```
Button | Position X & Y | Moves 100px from the left, and moves down 50px | 0ms | 500ms | Standard Spring
Button | Scale | Scale animates from 0% – 100% | 0ms | 500ms | Standard Spring
Button | Rotation | Rotates 180° clockwise | 250ms | 750ms | Enter Curve
Button | Opacity | Alpha animates from 0% – 100% | 0ms | 500ms | Linear
```

### Color Properties (Not Implemented)

**Current Status**: Color properties are NOT currently handled by the system.

**Would Require**:
- RGB/HSL value extraction from AE
- Color difference calculation
- Natural language color descriptions
- Hex color formatting

**Example Template** (hypothetical):

```typescript
{
  matcher: (property) => property.toLowerCase().includes('color'),
  generate: (property, values) => {
    const startHex = rgbToHex(values.startValue);
    const endHex = rgbToHex(values.endValue);
    return `Color transitions from ${startHex} to ${endHex}`;
  }
}
```

---

## Table Generation Logic

### Column Structure

**File**: `packages/figma-plugin/src/code.ts` lines 69-76

```typescript
const COLUMNS: ColumnConfig[] = [
  { id: 'Element',  percentage: 12.31, pixelWidth: 160 },  // Layer name
  { id: 'Property', percentage: 13.85, pixelWidth: 180 },  // Property type
  { id: 'Notes',    percentage: 35.00, pixelWidth: 455 },  // Description
  { id: 'Delay',    percentage: 9.23,  pixelWidth: 120 },  // Timing delay
  { id: 'Duration', percentage: 9.23,  pixelWidth: 120 },  // Animation duration
  { id: 'Easing',   percentage: 20.38, pixelWidth: 265 }   // Easing curve
];
// Total: 100% = 1300px (mobile width)
```

**Column Proportions**:
- Element: 12.31% (layer/component name)
- Property: 13.85% (animation property)
- Notes: 35% (natural language description - largest)
- Delay: 9.23% (timing information)
- Duration: 9.23% (duration information)
- Easing: 20.38% (easing details with potential parameters)

### Table Width Modes

**File**: Lines 42-46

```typescript
const TABLE_WIDTHS = {
  mobile: 1300,   // Standard mobile spec width
  desktop: 1768   // Desktop spec width (1.36x multiplier)
};
```

**Toggle Functionality**: Users can switch between mobile and desktop widths. All column percentages scale proportionally.

### Density Modes

**File**: Lines 49-61

```typescript
type DensityMode = 'comfortable' | 'compact';

const DENSITY_SETTINGS: Record<DensityMode, DensitySettings> = {
  comfortable: {
    fontSize: 16,
    padding: 22,      // Top and bottom padding
    minRowHeight: 60  // Minimum row height
  },
  compact: {
    fontSize: 14,
    padding: 12,
    minRowHeight: 40  // Saves 20px per row
  }
};
```

**Usage**: For long specs (10+ animations), compact mode significantly reduces vertical space.

### Auto-Compact Logic

**File**: Lines 524-573

```typescript
async function autoCompactIfNeeded(table: FrameNode, rowCount: number) {
  const isSlides = figma.editorType === 'slides';

  // Thresholds
  const slidesThreshold = 10;  // More aggressive for slides
  const regularThreshold = 15; // More lenient for regular Figma

  const threshold = isSlides ? slidesThreshold : regularThreshold;

  if (rowCount >= threshold) {
    // Switch to compact mode
    await toggleTableDensity(table, 'compact');

    // Notify user
    figma.notify(`Switched to compact mode for better fit (${rowCount} rows)`);
  }
}
```

**Reasoning**:
- **Figma Slides**: Slides have fixed height (1080px), so tables must fit within bounds
- **Regular Figma**: Canvas is scrollable, so more lenient threshold
- **Predictive**: Uses row count rather than actual height (more reliable)

### Row Creation

**File**: Lines 709-741

```typescript
async function createDataRow(
  mode: TableMode,
  layerName: string,
  animations: AnimationProperty[],
  parenting?: ParentingInfo,
  expressionLinks?: ExpressionLink[],
  density: DensityMode = 'comfortable'
): Promise<FrameNode> {

  const dataRow = figma.createFrame();
  dataRow.name = `Row - ${layerName}`;
  dataRow.layoutMode = 'HORIZONTAL';
  dataRow.primaryAxisSizingMode = 'FIXED';
  dataRow.counterAxisSizingMode = 'AUTO';  // HUG height (expands for wrapped text)
  dataRow.layoutAlign = 'STRETCH';

  const densitySettings = DENSITY_SETTINGS[density];
  dataRow.minHeight = densitySettings.minRowHeight;

  // Calculate column widths based on table mode
  const tableWidth = mode === 'mobile' ? TABLE_WIDTHS.mobile : TABLE_WIDTHS.desktop;

  // Create cells for each column
  for (const column of COLUMNS) {
    const cellWidth = Math.round(tableWidth * (column.percentage / 100));
    const cellContent = getCellContent(column.id, layerName, animations, parenting, expressionLinks);

    const dataCell = await createDataCell(
      column.id,
      cellWidth,
      cellContent,
      parenting,
      expressionLinks,
      density
    );

    dataRow.appendChild(dataCell);
  }

  return dataRow;
}
```

**Key Features**:
- **Auto-Layout**: Uses Figma's auto-layout for responsive tables
- **HUG Height**: Rows expand vertically to fit wrapped text
- **Density Aware**: Font size and padding adjust based on mode

### Text Wrapping

**File**: Lines 900-907

```typescript
async function createDataCell(
  columnId: string,
  width: number,
  content: string,
  parenting?: ParentingInfo,
  expressionLinks?: ExpressionLink[],
  density: DensityMode = 'comfortable'
): Promise<FrameNode> {

  // ... cell creation ...

  // Enable text wrapping for specific columns
  if (columnId === 'Notes' || columnId === 'Property' || columnId === 'Easing') {
    const textWidth = width - 24; // Account for padding (12px each side)
    textNode.resizeWithoutConstraints(textWidth, 0);
    textNode.textAutoResize = 'HEIGHT'; // HUG height - expand vertically
  } else {
    // No wrapping for Element, Delay, Duration
    textNode.textAutoResize = 'WIDTH_AND_HEIGHT';
  }

  return cell;
}
```

**Columns with Wrapping**:
- **Notes**: Long descriptions may wrap to 2-3 lines
- **Property**: Combined properties like "Position, Rotation, Scale" may wrap
- **Easing**: Custom spring parameters may wrap to 2 lines

**Columns without Wrapping**:
- **Element**: Layer names kept on single line (ellipsis if too long)
- **Delay**: Short values (e.g., "250ms")
- **Duration**: Short values (e.g., "500ms")

### Hyperlinks

**File**: Lines 889-898

```typescript
// Add hyperlinks to easing presets
if (columnId === 'Easing' && animations.length > 0) {
  const easingText = formatEasingDetailed(animations[0].easing);
  const link = getEasingLink(easingText);

  if (link) {
    textNode.hyperlink = { type: 'URL', value: link };
    textNode.textDecoration = 'UNDERLINE';  // Visual indicator
  }
}

function getEasingLink(easingText: string): string | null {
  // Check if it's a spring preset
  if (SPRING_PRESETS[easingText]) {
    return SPRING_PRESETS[easingText];  // e.g., https://air.bb/standard-spring
  }

  // Check if it's a cubic-bezier preset
  // (Currently not linked - could be added)

  return null;
}
```

**Linked Presets**:
- Standard Spring → https://air.bb/standard-spring
- Fast Spring → https://air.bb/fast-spring
- Slow Spring → https://air.bb/slow-spring
- (And all bounce spring variants)

### Special Row Types

#### Note Rows (Stagger Descriptions)

**File**: Lines 743-825

```typescript
async function createNoteRow(
  mode: TableMode,
  noteText: string,
  density: DensityMode = 'comfortable'
): Promise<FrameNode> {

  const noteRow = figma.createFrame();
  noteRow.name = 'Row - Note';
  noteRow.layoutMode = 'HORIZONTAL';
  noteRow.counterAxisSizingMode = 'AUTO';

  // Single cell spanning full table width
  const tableWidth = mode === 'mobile' ? TABLE_WIDTHS.mobile : TABLE_WIDTHS.desktop;

  const noteCell = figma.createFrame();
  noteCell.resize(tableWidth, 50);
  noteCell.paddingLeft = 17;  // Match Element column padding
  noteCell.paddingTop = 12;
  noteCell.paddingBottom = 12;

  // Text with bold "Note:" prefix
  const textNode = figma.createText();
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

  textNode.characters = noteText;
  textNode.fontSize = DENSITY_SETTINGS[density].fontSize;
  textNode.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];

  // Make "Note:" prefix bold
  const noteIndex = noteText.indexOf('Note:');
  if (noteIndex !== -1) {
    textNode.setRangeFontName(noteIndex, noteIndex + 5, { family: 'Inter', style: 'Bold' });
  }

  noteCell.appendChild(textNode);
  noteRow.appendChild(noteCell);

  return noteRow;
}
```

**Usage**: Added after first item in stagger group.

**Example**:
```
Note: Subsequent containers follow the above specs + a 50ms delay per item.
```

#### Parented Child Rows

**File**: Lines 916-941

```typescript
// Special handling for parented children without animations
if (parenting && animations.length === 0) {
  return {
    element: layerName,
    property: parenting.animatingProperties.map(capitalize).join(', '),
    notes: `Attached to ${parenting.parentName}, inherits ${parenting.animatingProperties.join(', ')}`,
    delay: '—',
    duration: '—',
    easing: '—'
  };
}
```

**Display**:
```
Child Layer | Position, Rotation | Attached to Parent, inherits position, rotation | — | — | —
```

#### Fit to Shape Rows

```typescript
// Fit to Shape layers show special format
if (animation.fitToShape) {
  return {
    element: layerName,
    property: 'Fit to Shape',
    notes: generateFitToShapeDescription(animation.fitToShape),
    delay: '—',     // No delay (not animated)
    duration: '—',  // No duration (not animated)
    easing: '—'     // Inherits from parent container
  };
}
```

**Display**:
```
Icon | Fit to Shape | Scales to fit width of "Container" — aligned center | — | — | —
```

### Font Loading

**File**: Lines 38-40

```typescript
const FONT_FALLBACK_CHAIN = [
  { family: 'Airbnb Cereal VF', style: 'Book' },  // Primary
  { family: 'Inter', style: 'Regular' },          // Fallback 1
  { family: 'Roboto', style: 'Regular' }          // Fallback 2
];
```

**Loading Logic**:

```typescript
async function loadTableFont(): Promise<FontName> {
  for (const font of FONT_FALLBACK_CHAIN) {
    try {
      await figma.loadFontAsync(font);
      return font;
    } catch (e) {
      // Try next font in chain
      continue;
    }
  }

  // Ultimate fallback (should never reach)
  throw new Error('No fonts available');
}
```

**Reasoning**: Different users may have different fonts installed. Fallback chain ensures tables always render.

---

## Implementation Reference

### File Structure Overview

```
motion-spec-tools/
├── Motion_Spec_Desktop_Export.jsx          # AE extraction script (1872 lines)
├── MotionSpecApp/
│   └── Sources/Spectrum/
│       └── BridgeServer.swift              # Swift bridge server (1167 lines)
├── packages/
│   ├── shared/
│   │   └── src/
│   │       ├── types.ts                     # Type definitions (152 lines)
│   │       └── motionDescriptions.ts        # Natural language templates (607 lines)
│   └── figma-plugin/
│       └── src/
│           ├── code.ts                      # Main plugin logic (2000+ lines)
│           └── ui-inbox.html                # Plugin UI (400+ lines)
└── docs/
    └── MOTION_SPEC_PROCESSING_GUIDE.md      # This document
```

### Key Function Locations

#### After Effects Script

**File**: `Motion_Spec_Desktop_Export.jsx`

| Function | Lines | Purpose |
|----------|-------|---------|
| `detectCompositionMultiplier()` | 369-406 | Resolution scaling detection |
| `extractPropertyValues()` | 561-608 | Value extraction with scaling |
| `isCornerProperty()` | 639-655 | Corner property detection |
| `findPropertiesWithSelectedKeyframes()` | 409-548 | Property scanning |
| `findSpringForProperty()` | 796-922 | Spring marker detection |
| `detectBakedSpringInRange()` | 924-977 | Baked spring analysis |
| `extractCubicBezierFromSelectedKeyframes()` | 980-1067 | Cubic bezier extraction |
| `findChildLayers()` | 1069-1174 | Parenting detection |
| `detectFitToShapeEffect()` | 1176-1241 | Fit to Shape detection |
| `parseExpression()` | 270-367 | Expression link parsing |
| `sanitizeLayerName()` | 252-268 | Layer name cleaning |

#### Swift Bridge Server

**File**: `MotionSpecApp/Sources/Spectrum/BridgeServer.swift`

| Function | Lines | Purpose |
|----------|-------|---------|
| `processAnimations()` | 843-907 | Position array splitting |
| `parseAnimationData()` | 751-829 | JSON parsing and structure |
| `handleGetLatestBatch()` | 192-235 | HTTP endpoint for Figma |

#### Figma Plugin

**File**: `packages/figma-plugin/src/code.ts`

| Function | Lines | Purpose |
|----------|-------|---------|
| `transformPropertyName()` | 10-36 | Property name transformations |
| `groupPositionAnimations()` | 1577-1616 | Position X & Y grouping |
| `easingsMatch()` | 1542-1575 | Easing comparison with tolerance |
| `detectStaggeredAnimations()` | 1618-1743 | Stagger group detection |
| `generateGroupName()` | 1685-1717 | Stagger group naming |
| `createDataRow()` | 709-741 | Table row creation |
| `createNoteRow()` | 743-825 | Note row creation |
| `createDataCell()` | 827-913 | Cell creation with wrapping |
| `getCellContent()` | 915-1118 | Cell content generation |
| `autoCompactIfNeeded()` | 524-573 | Auto-compact logic |

#### Shared Library

**File**: `packages/shared/src/motionDescriptions.ts`

| Function | Lines | Purpose |
|----------|-------|---------|
| `formatEasingDetailed()` | 107-128 | Easing formatting |
| `matchCubicBezierWithTolerance()` | 130-164 | Cubic bezier preset matching |
| `formatFitToShapeAlignment()` | 176-187 | Fit to Shape alignment text |
| `generateFitToShapeDescription()` | 213-229 | Fit to Shape descriptions |
| `positionTemplate` | 302-373 | Position descriptions |
| `alphaTemplate` | 234-260 | Opacity descriptions |
| `scaleTemplate` | 265-297 | Scale descriptions |
| `rotationTemplate` | 378-410 | Rotation descriptions |
| `cornerRadiusTemplate` | 415-470 | Corner radius descriptions |

### Type Definitions

**File**: `packages/shared/src/types.ts`

```typescript
// Core interfaces
export interface MotionSpecBatch { /* ... */ }
export interface MotionSpecLayer { /* ... */ }
export interface AnimationProperty { /* ... */ }
export interface PropertyValues { /* ... */ }
export interface Easing { /* ... */ }
export interface SpringInfo { /* ... */ }
export interface CustomSpringParams { /* ... */ }
export interface TimingInfo { /* ... */ }
export interface ParentingInfo { /* ... */ }
export interface ExpressionLink { /* ... */ }
export interface FitToShapeInfo { /* ... */ }
```

---

## Porting Checklist

### Core Requirements

- [ ] **Resolution Scaling Detection**
  - Match composition dimensions against device database
  - Apply scaling to position, corners, dimensions
  - Don't scale rotation, scale percentages, opacity

- [ ] **Position Array Handling**
  - Split combined Position into X and Y
  - Filter axes with <0.5px change
  - Re-group if timing/easing match

- [ ] **Natural Language Templates**
  - Implement priority-ordered template system
  - Handle Position, Scale, Rotation, Opacity, Corner Radius
  - Add Fit to Shape if using AirBoard plugin
  - Implement generic fallback

- [ ] **Easing System**
  - Detect spring markers (if using Sproing)
  - Extract cubic-bezier from keyframes
  - Match presets with tolerance
  - Format custom spring parameters
  - Provide fallback to linear

- [ ] **Animation Grouping**
  - Group Position X & Y when appropriate
  - Detect stagger patterns (3+ layers, uniform offset)
  - Generate group names from layer patterns

- [ ] **Special Cases**
  - Handle parented layers
  - Parse expression links
  - Sanitize layer names (remove plugin prefixes)
  - Filter zero-change animations

### Platform-Specific Considerations

#### For Sketch

- Export to JSON using Sketch scripting
- Implement table generation with Sketch API
- Use Text Styles for consistent formatting
- Consider Sketch Runner integration for activation

#### For Adobe XD

- Use XD plugin API for keyframe data access
- Implement panel UI using XD design system
- Export to XD design specs format
- Consider integration with XD's built-in prototyping

#### For Web-Based Tools (Framer, etc.)

- Export JSON via plugin API
- Render tables using HTML/CSS
- Provide JSON download option
- Consider Markdown export for documentation

### Testing Checklist

- [ ] Simple position animation (X only, Y only, both)
- [ ] Scale animation (uniform and non-uniform)
- [ ] Rotation animation (positive and negative)
- [ ] Opacity fade (in, out, partial)
- [ ] Corner radius animation (IndieCorners, Squircle, generic)
- [ ] Spring easing (standard presets and custom parameters)
- [ ] Cubic bezier easing (preset matching with tolerance)
- [ ] Parented layers (with multiple animating properties)
- [ ] Expression-linked layers
- [ ] Fit to Shape effect (all alignment and scale modes)
- [ ] Staggered animations (3+ layers with uniform offset)
- [ ] Mixed animations (same layer with multiple properties)
- [ ] Resolution scaling (1x, 2x, 3x compositions)
- [ ] Zero-change filtering (static axes)
- [ ] Long specs (auto-compact trigger)
- [ ] Text wrapping (long descriptions)
- [ ] Unicode characters in layer names
- [ ] Guide layers

### Documentation Recommendations

When porting, document:

1. **Platform-specific adaptations** (API differences, limitations)
2. **Modified detection logic** (if platform has different keyframe structure)
3. **Additional templates** (for properties not in this system)
4. **Known issues** (edge cases, platform quirks)
5. **User instructions** (how to use the tool, common workflows)

---

## Conclusion

This guide provides a complete reference for replicating the Motion Spec Tools natural language generation and processing logic. The system's three-stage architecture (Extraction → Transformation → Rendering) is designed to be portable across design tools while maintaining consistent output quality.

**Key Principles**:
- **Separation of Concerns**: Keep extraction, transformation, and rendering separate
- **Template-Based**: Use extensible template system for natural language
- **Conservative Detection**: Prefer false negatives over false positives in grouping
- **Resolution-Aware**: Always account for device scaling
- **User-Friendly**: Prioritize readability and familiar terminology

**For Questions or Contributions**:
Refer to the DEVLOG.md for implementation history and troubleshooting examples.

---

*This document is maintained as part of the Motion Spec Tools project.*
*Last major update: November 24, 2025 (Sproing compatibility and sandbox mode updates)*
