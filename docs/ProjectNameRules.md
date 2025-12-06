# Project Name Parsing Rules

Rules for cleaning project names from JSON `metadata.projectName` field for display in the Spectrum Editor.

## Processing Order

Apply these transformations in sequence:

### 1. URL Decode
The project name may be URL-encoded (e.g., `%20` for spaces).

### 2. Remove Leading Date Prefix
Pattern: `^\d{6}_` (6 digits followed by underscore at start)
- `YYMMDD_ProjectName` → `ProjectName`
- `241205_MyProject` → `MyProject`

### 3. Remove Trailing Version/Number Patterns

**3a. Dash-number suffix (and everything after)**
Pattern: ` - \d+.*$` (space-dash-space, digits, and anything following)
- `S&D - For You - 003` → `S&D - For You`
- `M13 NUX - 008 - WebP` → `M13 NUX`
- `Trips - 001` → `Trips`

**3b. Underscore-v-number suffix**
Pattern: `_v\d+$` (underscore, "v", digits at end)
- `ProjectName_v01` → `ProjectName`
- `MyAnimation_v12` → `MyAnimation`

**3c. Underscore-number suffix**
Pattern: `_\d+$` (underscore, digits at end)
- `AirHost_01` → `AirHost`
- `Facepile_01` → `Facepile`

### 4. Replace Underscores with Spaces
- `Elvis_Icon_Animation` → `Elvis Icon Animation`
- `M13_Setup_Location_Icon` → `M13 Setup Location Icon`

### 5. Split CamelCase into Words
Insert space before each uppercase letter that follows a lowercase letter.
Pattern: `([a-z])([A-Z])` → `$1 $2`
- `ProjectName` → `Project Name`
- `AirHost` → `Air Host`
- `IconAnimation` → `Icon Animation`

Note: Preserve sequences of uppercase letters (acronyms):
- `NUXSetup` → `NUX Setup`
- `AISearch` → `AI Search`

### 6. Trim and Clean Spaces
- Remove leading/trailing whitespace
- Collapse multiple spaces into single space

## Examples

| Input | Output |
|-------|--------|
| `S&D%20-%20For%20You%20-%20003` | `S&D - For You` |
| `S&D%20AI%20Search%20-%20002` | `S&D AI Search` |
| `P2%20Weekly%20Monthly%20Tips%20-%20001` | `P2 Weekly Monthly Tips` |
| `Trips%20-%20001` | `Trips` |
| `M13%20NUX%20-%20008%20-%20WebP` | `M13 NUX` |
| `Who's%20Going%20-%20Facepile_01` | `Who's Going - Facepile` |
| `AirHost_01` | `Air Host` |
| `Elvis_Icon_Animation_01` | `Elvis Icon Animation` |
| `M13_Setup_Location_Icon_01` | `M13 Setup Location Icon` |
| `ProjectName_v01` | `Project Name` |
| `YYMMDD_ProjectName_v01` | `Project Name` |
