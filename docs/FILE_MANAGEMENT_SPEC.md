# Spectrum Editor - File Management Feature

A simple file management system for browsing, creating, and organizing motion specs.

---

## Page Structure

### 1. Index Page (`/`)

The landing page showing all projects.

**Layout:**
- Card grid (3 columns desktop, 2 tablet, 1 mobile)
- Generous padding and gaps for an airy feel
- FAB button to add new spec

**Each project card contains:**
- Project name (prominent)
- Spec count
- Last updated timestamp

**Sorting:**
- Sorted by last updated (most recent first)
- Active projects naturally float to top
- Optional: "Archived" section for projects with no updates in 6-12 months

**Example card:**
```
┌────────────────────────┐
│                        │
│  Calendar 2.0          │
│                        │
│  8 specs · Updated 2d  │
│                        │
└────────────────────────┘
```

---

### 2. Project Page (`/projects/[project-name]`)

Shows all specs within a project. This is the main entry point for external visitors (linked from other docs).

**Layout:**
- Project name as header
- List of specs (larger rows to fill space)
- Drag handles for reordering
- Add Spec button at bottom

**Each spec row contains:**
- Spec name
- Last updated timestamp
- Overflow menu (⋯)

**Interactions:**
- Click row → opens spec
- Drag handle (⋮⋮) → reorder specs
- Overflow menu → Delete, Copy link

**Example layout:**
```
Project: Calendar 2.0
───────────────────────────────────────────
⋮⋮  Tab nav                Updated 3d    ⋯
⋮⋮  Search transitions     Updated 1w    ⋯
⋮⋮  Hover & press states   Updated 2w    ⋯

+ Add Spec
```

**Notes:**
- Spec order is manually controlled (drag to reorder), not auto-sorted by date
- Same view for creators and viewers (just hide edit controls for viewers)

---

### 3. Spec Page (`/projects/[project-name]/[spec-name]`)

The actual editor/viewer (existing Spectrum Editor).

**Additions:**
- Hamburger menu (☰) in top left
- Opens drawer showing all specs in current project
- Quick navigation between specs without returning to project page

**Drawer contents:**
```
┌─────────────────────┐
│ Calendar 2.0        │  ← Project name
│ ─────────────────── │
│ • Tab nav        ←  │  ← Current spec highlighted
│   Search transitions│
│   Hover & press     │
│                     │
│ + Add Spec          │
└─────────────────────┘
```

---

## URL Structure

| Page | URL | Example |
|------|-----|---------|
| Index | `/` | `/` |
| Project | `/projects/[name]` | `/projects/calendar-2.0` |
| Spec | `/projects/[name]/[spec]` | `/projects/calendar-2.0/tab-nav` |

---

## Creating Specs & Projects

**How it works:**
- Projects are created implicitly based on the Project field in a spec
- No separate "create project" action
- First spec with a new project name creates that project

**From Index page:**
- Click FAB → opens blank editor
- Fill in Project field → creates/adds-to that project on save
- Fill in Spec name → becomes URL slug

**From Project page:**
- Click "Add Spec" → opens editor with Project field pre-filled

---

## Key Interactions

| Action | How |
|--------|-----|
| Create spec | FAB on index, or "Add Spec" on project page |
| Open spec | Click row on project page |
| Reorder specs | Drag handle on project page |
| Delete spec | Overflow menu → Delete |
| Copy link | Overflow menu → Copy link |
| Navigate between specs | Hamburger drawer on spec page |
| Delete project | Overflow menu on index (deletes all specs) |

---

## Design Notes

**Overall feel:**
- Simple, minimal, clean
- Airy/spacious - generous padding and whitespace
- Consistent with Spectrum Editor's dark theme (or light for management pages?)

**Index page cards:**
- Subtle border or shadow
- Project name is the focus
- Metadata (spec count, date) in lighter/smaller text
- Comfortable padding so cards feel spacious even with little content
- Grid gaps generous

**Project page list:**
- Larger row height to fill space
- Drag handle appears on hover
- Current order is the canonical order (not auto-sorted)

**Typography:**
- Project/spec names prominent
- Metadata subtle (lighter color, smaller size)

---

## Platform Handling

Instead of adding a "platform" field to specs:
- Native and Desktop versions are separate projects
- e.g., "PDP Native" and "PDP Desktop"
- Keeps the data model simple

---

## Stretch Goals

1. **Hamburger drawer** - Quick navigation between specs in a project
2. **Search** - Find specs/projects by name
3. **Archive toggle** - Show/hide old projects on index

---

## Open Questions

1. Light or dark theme for index/project pages?
2. Should project cards show a thumbnail/preview?
3. Confirmation dialog for delete, or undo toast?
4. Should "Copy link" copy the spec URL or project URL?

---

## For Prototyping

When building a prototype, focus on:

1. **Index page layout** - Card grid that feels full even with few items
2. **Project page layout** - List that feels substantial with few specs
3. **Card/row sizing** - Get the padding and spacing right
4. **Hover states** - Drag handles, overflow menus appearing
5. **Hamburger drawer** - Slide-in navigation

Doesn't need real data - use placeholder project/spec names to test the layout at different content amounts (2 projects vs 20, 3 specs vs 15).
