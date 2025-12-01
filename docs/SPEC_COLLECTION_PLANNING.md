# Motion Inspector - Spec Collection Feature

## Overview

A feature to organize multiple Motion Inspector specs into a navigable collection/project, with an index page and cross-spec navigation.

---

## Folder Structure

```
Project Name/
├── index.html              # Auto-generated index page
├── manifest.json           # (optional) List of specs and metadata
├── Native/
│   ├── AI Search/
│   │   └── Motion Inspector.html
│   ├── Global Nav - Guest/
│   │   └── Motion Inspector.html
│   └── Map Button/
│       └── Motion Inspector.html
└── Desktop/
    ├── AI Search/
    │   └── Motion Inspector.html
    └── Global Nav - Guest/
        └── Motion Inspector.html
```

---

## UI Components

### Index Page (index.html)
- **Title**: Project name at top
- **Categories**: Main sections (e.g., "Native", "Desktop")
- **Spec Lists**: Bulleted list of spec names under each category, linking to spec HTML files
- **POC Footer**: Contact info at bottom

### Spec Page Side Menu
- **Hamburger icon**: Top left, next to spec title
- **Slide-out menu** containing:
  - Link back to index.html
  - List of all specs grouped by category
  - Current spec highlighted
  - Click to navigate between specs

---

## Requirements & Decisions

| Requirement | Decision |
|-------------|----------|
| Adding specs | Incrementally over time |
| Updating | Need to replace, add, or remove specs with index/menu auto-updating |
| Categories | Custom categories, but "Native" and "Desktop" are common defaults |
| Index page content | Title, categories, spec list (names only) |
| Side menu grouping | Grouped by category |
| Reordering | Nice to have, not priority |
| Naming | Derived from folder names to stay in sync |
| Hosting | Eventually internal hosting |

---

## Technical Challenge

**Static HTML cannot read folder structures** due to browser security restrictions. The index page and side menu need to "know" what specs exist, but can't dynamically scan folders.

---

## Implementation Options

### Option 1: Build Script (Local)

**How it works:**
1. User organizes spec folders manually
2. User runs a build script (`node build.js` or double-click `.command` file)
3. Script reads folder structure
4. Generates `index.html`
5. Injects side menu navigation into each spec HTML file
6. Output is ready to upload/share

**Pros:**
- Works fully offline/locally
- No server infrastructure needed
- Simple to implement
- Full control over output

**Cons:**
- Manual step to run script after changes
- Need Node.js installed (or could be Python/bash)

**Good for:** Local workflow, preparing files for upload

---

### Option 2: Manifest File

**How it works:**
1. A `manifest.json` file lists all specs and their paths
2. Index page reads manifest on load
3. Spec pages read manifest to build side menu
4. User updates manifest when adding/removing specs (manually or via script)

```json
{
  "projectName": "Project Name",
  "categories": [
    {
      "name": "Native",
      "specs": [
        { "name": "AI Search", "path": "Native/AI Search/Motion Inspector.html" },
        { "name": "Global Nav", "path": "Native/Global Nav/Motion Inspector.html" }
      ]
    }
  ]
}
```

**Pros:**
- Single source of truth
- Could be manually edited or script-generated
- Flexible metadata (could add descriptions, thumbnails later)

**Cons:**
- Still requires updating manifest (manually or via script)
- Requires hosting that serves JSON (won't work with `file://` protocol)

**Good for:** Hosted environments, structured metadata

---

### Option 3: Server-Side Dynamic

**How it works:**
1. Server has an API endpoint that reads folder structure
2. Index page calls API on load to get spec list
3. Spec pages call API to build side menu
4. Folder changes automatically reflected

**Pros:**
- Truly dynamic - add/remove folders, UI updates automatically
- No manual steps after folder changes
- Best user experience

**Cons:**
- Requires server infrastructure
- Need eng support to set up
- More complex deployment

**Good for:** Internal hosted solution, multiple users/projects

---

### Option 4: Hybrid Approach

**How it works:**
1. Use build script locally during development
2. Deploy to server that can optionally regenerate on folder changes
3. Or: deploy hook that runs build script when files are uploaded

**Pros:**
- Works locally without server
- Can upgrade to dynamic later
- Gradual complexity

**Cons:**
- Two modes to maintain

**Good for:** Starting simple, scaling up later

---

## Recommended Path

### Phase 1: Build Script (Now)
- Create a simple Node.js build script
- Run after adding/removing specs
- Generates static files ready to share or upload

### Phase 2: Internal Hosting (Later)
- Talk to eng about hosting options
- Could be: simple file server + API endpoint, or deploy hooks
- Migrate build script logic to server-side if needed

---

## Questions for Engineering

1. What's the simplest way to host a folder of static HTML files internally?
2. Can we have an endpoint that lists files in a directory?
3. Is there a deploy hook system we could use to regenerate index on upload?
4. Any existing internal tools for hosting documentation/specs?

---

## Open Questions / Future Ideas

- [ ] Thumbnails/previews on index page?
- [ ] Search functionality across specs?
- [ ] Spec metadata (description, author, date)?
- [ ] Version history for specs?
- [ ] Drag-and-drop reordering on index page?
- [ ] Export entire collection as ZIP?
