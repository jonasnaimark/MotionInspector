# Tabs Feature Implementation Plan

## Overview
Add Chrome-style tabs above the timeline container to support multiple specs on the same page (e.g., Enter/Exit, Open/Close animations).

## User Requirements

### Visual Design
- Chrome-style browser tabs above timeline container
- Trapezoid tab shape with active state highlighting
- Tab text is editable (click to rename)
- Close button (×) on each tab like Chrome
- \+ button to add new tabs (appears at right edge after first tab created)

### Behavior
- First tab contains existing spec, named "Tab 1" by default
- Click + to create additional tabs (up to 6 max)
- New tabs start with blank/default spec
- Each tab has independent video upload
- Paste Spec always pastes into current active tab
- Close button deletes tab with confirmation alert
- Switching tabs shows that tab's spec

## Feature Decisions

### 1. Tab Switching Behavior
**Decision**: Reset to defaults on switch
- Playhead resets to 0
- Zoom level resets
- View mode preserved per tab (timeline/table)
- Info box closes

### 2. Video Handling
**Decision**: Independent per tab
- Each tab stores its own `videoSrc`
- Video upload applies to current tab only

### 3. New Tab Defaults
**Decision**: Completely empty/blank spec
- Default blank spec structure
- No video
- Named "Tab N" sequentially

### 4. Maximum Tabs
**Decision**: 6 tabs maximum
- Hide + button when limit reached
- Show message if user tries to add more

### 5. Export Behavior
**Decision**: Current tab only
- Copy Spec JSON exports only the active tab's data
- Does not export tabs array structure

### 6. Info Box on Switch
**Decision**: Close the info box
- Clear `selectedAnimation`
- Remove selected classes from bars/labels

## Technical Implementation

### Phase 1: Data Structure Refactor

#### Current State
```javascript
let specData = { compName: "...", workArea: {...}, layers: [...] };
let viewMode = 'timeline';
```

#### New State
```javascript
let tabs = [
  {
    id: 1,                    // Unique ID for tracking
    name: "Tab 1",            // User-editable name
    specData: {...},          // Existing spec structure
    videoSrc: null,           // Video file path
    viewMode: 'timeline'      // 'timeline' or 'table'
  }
];
let currentTabIndex = 0;      // Active tab index
let nextTabId = 2;            // Counter for unique IDs
const MAX_TABS = 6;           // Maximum allowed tabs
```

#### Helper Functions
```javascript
// Get current active tab object
function getCurrentTab() {
  return tabs[currentTabIndex];
}

// Get current spec data (convenience wrapper)
function getCurrentSpecData() {
  return tabs[currentTabIndex].specData;
}

// Get current video source
function getCurrentVideoSrc() {
  return tabs[currentTabIndex].videoSrc;
}

// Get current view mode
function getCurrentViewMode() {
  return tabs[currentTabIndex].viewMode;
}
```

#### Code Refactor Required
- Find/replace ~50-100 instances of `specData` → `getCurrentSpecData()`
- Update `viewMode` references to use `getCurrentViewMode()`
- Update video references to use `getCurrentVideoSrc()`

### Phase 2: Tab Management Functions

#### Create New Tab
```javascript
function createNewTab() {
  if (tabs.length >= MAX_TABS) {
    alert(`Maximum of ${MAX_TABS} tabs allowed`);
    return;
  }

  const newTab = {
    id: nextTabId++,
    name: `Tab ${tabs.length + 1}`,
    specData: createDefaultSpec(), // Helper to create blank spec
    videoSrc: null,
    viewMode: 'timeline'
  };

  tabs.push(newTab);
  switchTab(tabs.length - 1); // Switch to new tab
  renderTabs();
}
```

#### Delete Tab
```javascript
function deleteTab(index) {
  if (tabs.length === 1) {
    alert("Cannot delete the last tab");
    return;
  }

  const tab = tabs[index];
  if (!confirm(`Delete "${tab.name}"?`)) {
    return;
  }

  tabs.splice(index, 1);

  // If deleting current tab, switch to first tab
  if (index === currentTabIndex) {
    currentTabIndex = 0;
    switchTab(0);
  } else if (index < currentTabIndex) {
    // Adjust current index if tab before it was deleted
    currentTabIndex--;
  }

  renderTabs();
}
```

#### Switch Tab
```javascript
function switchTab(index) {
  if (index === currentTabIndex) return;

  // Close info box
  const detailPanel = document.getElementById('detailPanel');
  if (detailPanel) {
    detailPanel.innerHTML = '';
  }
  selectedAnimation = null;
  document.querySelectorAll('.timeline-bar').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.timeline-label.indented').forEach(l => l.classList.remove('selected'));

  // Switch tab
  currentTabIndex = index;

  // Reset playhead to 0
  currentTime = 0;

  // Re-render view
  refreshActiveView();
  renderTabs();

  // Update playhead position
  updatePlayhead();
}
```

#### Rename Tab
```javascript
function renameTab(index, newName) {
  if (newName.trim() === '') return;
  tabs[index].name = newName.trim();
  renderTabs();
}
```

#### Create Default Spec
```javascript
function createDefaultSpec() {
  return {
    compName: "Motion Inspector",
    workArea: {
      duration: 2000
    },
    layers: [
      {
        layerName: "Section 1",
        animations: [
          {
            property: "Add parameter",
            customDescription: "Add description",
            timing: {
              delay: 0,
              duration: 300
            },
            customEasing: "-",
            values: {
              startValue: "-",
              endValue: "-"
            },
            customColor: "#ff40a3"
          }
        ]
      }
    ]
  };
}
```

### Phase 3: UI Components

#### Tab Bar HTML Structure
```html
<div class="tabs-container">
  <div class="tabs-bar">
    <!-- Tabs rendered here -->
    <div class="tab active" data-tab-index="0">
      <span class="tab-name" contenteditable="true">Tab 1</span>
      <button class="tab-close">×</button>
    </div>
    <button class="tab-add-btn">+</button>
  </div>
</div>
```

#### Tab Rendering Function
```javascript
function renderTabs() {
  const tabsBar = document.querySelector('.tabs-bar');
  if (!tabsBar) return;

  let html = '';

  // Render existing tabs
  tabs.forEach((tab, index) => {
    const isActive = index === currentTabIndex;
    html += `
      <div class="tab ${isActive ? 'active' : ''}" data-tab-index="${index}">
        <span class="tab-name" contenteditable="true"
              onblur="renameTab(${index}, this.textContent)"
              onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }"
              onfocus="this.select()">${tab.name}</span>
        <button class="tab-close" onclick="deleteTab(${index})">×</button>
      </div>
    `;
  });

  // Add + button if under limit
  if (tabs.length < MAX_TABS) {
    html += `<button class="tab-add-btn" onclick="createNewTab()">+</button>`;
  }

  tabsBar.innerHTML = html;

  // Add click listeners for tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    const tabIndex = parseInt(tab.dataset.tabIndex);
    tab.addEventListener('click', (e) => {
      // Don't switch if clicking close button or editing name
      if (e.target.classList.contains('tab-close') ||
          e.target.classList.contains('tab-name')) {
        return;
      }
      switchTab(tabIndex);
    });
  });
}
```

#### CSS Styling (~60 lines)
```css
.tabs-container {
  position: relative;
  margin-bottom: -1px; /* Overlap with timeline container */
}

.tabs-bar {
  display: flex;
  gap: 2px;
  padding-left: 8px;
  background: #1a1a1a;
  border-bottom: 1px solid #2a2a2a;
}

.tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 16px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  transition: background 0.15s ease;
  min-width: 100px;
  max-width: 200px;
}

/* Trapezoid shape using clip-path */
.tab::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 0;
  bottom: 0;
  width: 8px;
  background: inherit;
  border: inherit;
  border-right: none;
  transform: skewX(-20deg);
}

.tab::after {
  content: '';
  position: absolute;
  right: -8px;
  top: 0;
  bottom: 0;
  width: 8px;
  background: inherit;
  border: inherit;
  border-left: none;
  transform: skewX(20deg);
}

.tab.active {
  background: #0a0a0a;
  border-color: #4a4a4a;
  z-index: 1;
}

.tab:hover:not(.active) {
  background: #333;
}

.tab-name {
  flex: 1;
  color: #e0e0e0;
  font-size: 13px;
  outline: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: text;
}

.tab.active .tab-name {
  color: #ffffff;
}

.tab-close {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  background: transparent;
  border: none;
  color: #888;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  padding: 0;
}

.tab-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.tab-add-btn {
  padding: 8px 12px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  color: #888;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-add-btn:hover {
  background: #333;
  color: #fff;
}
```

### Phase 4: Integration Points

#### Paste Spec
```javascript
function pasteSpec() {
  // ... existing clipboard logic ...

  // Update current tab's spec
  tabs[currentTabIndex].specData = parsedSpec;

  // Reset zoom
  viewDuration = parsedSpec.workArea.duration;

  // Re-render
  refreshActiveView();
}
```

#### Video Upload
```javascript
videoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const videoURL = URL.createObjectURL(file);

    // Update current tab's video
    tabs[currentTabIndex].videoSrc = videoURL;

    // Update video element
    const videoElement = document.getElementById('referenceVideo');
    if (videoElement) {
      videoElement.src = videoURL;
    }
  }
});
```

#### Copy Spec JSON
```javascript
function copySpecJson() {
  // Export only current tab's spec
  const json = JSON.stringify(getCurrentSpecData(), null, 2);
  // ... copy to clipboard ...
}
```

#### View Mode Persistence
```javascript
function switchToView(view) {
  // Update current tab's view mode
  tabs[currentTabIndex].viewMode = view;

  // ... rest of switching logic ...
}
```

## Edge Cases & Error Handling

### 1. Can't Delete Last Tab
```javascript
if (tabs.length === 1) {
  alert("Cannot delete the last tab");
  return;
}
```

### 2. Deleting Current Tab
- Switch to tab 0
- Re-render everything

### 3. Maximum Tab Limit
- Hide + button when limit reached
- Show alert if user somehow triggers add

### 4. Tab Name Validation
- Trim whitespace
- Prevent empty names (revert to previous)
- Optional: Check for duplicates

### 5. Switching During Playback
- Pause video on current tab
- Reset playhead to 0 on new tab

### 6. Info Box Open
- Always close when switching tabs
- Clear selected state

## Testing Checklist

- [ ] Create first tab (+ button appears)
- [ ] Create multiple tabs (up to 6)
- [ ] Maximum tab limit works
- [ ] Switch between tabs
- [ ] Rename tabs (inline editing)
- [ ] Delete tabs (with confirmation)
- [ ] Can't delete last tab
- [ ] Deleting current tab switches correctly
- [ ] Paste spec goes to current tab
- [ ] Video upload applies to current tab
- [ ] Copy spec exports current tab only
- [ ] View mode (timeline/table) persists per tab
- [ ] Playhead resets on switch
- [ ] Info box closes on switch
- [ ] Close button styling/behavior
- [ ] Active tab highlighting
- [ ] Tab hover states

## Estimated Impact

- **Lines Changed**: ~150-200
- **New Lines**: ~200-250
- **New Functions**: ~8-10
- **CSS Lines**: ~60-80
- **Time to Implement**: 30-45 minutes
- **Risk Level**: Medium (significant refactor but contained)

## Future Enhancements (Out of Scope)

- Drag to reorder tabs
- Duplicate tab functionality
- Save/load all tabs to file
- Keyboard shortcuts (Cmd+T, Cmd+W, etc.)
- Tab overflow scrolling (if >6 needed)
- Persist tabs to localStorage
