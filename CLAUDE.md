# iso-game — Project Instructions for Claude

## Documentation Rules

Every batch of changes **must** update the following files before the session ends.
No exceptions — even single-line fixes count.

### 1. `CHANGELOG.md`

Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

- Add a new `## [x.y.z] - YYYY-MM-DD` section at the top (below the header).
- Group changes under `### Added`, `### Fixed`, `### Changed`, or `### Removed`.
- Be specific: name the feature, the key behaviour, and the control/shortcut if relevant.

### 2. `docs/dev-log.md`

- Add a new `## Stage N — <Title>` section at the bottom of the file.
- Match the existing style: Goal paragraph → subsections per feature → fenced code blocks
  highlighting the most important code.
- Update the **Table of Contents** at the top.
- Update the **Project Structure** listing at the bottom if new files were added.

### 3. `version.txt`

Bump the version using **semantic versioning** (`MAJOR.MINOR.PATCH`):

| Change type | Bump |
|---|---|
| New user-visible feature | **MINOR** (`0.x.0`) |
| Bug fix or internal refactor | **PATCH** (`0.x.y`) |
| Breaking change to save format / API | **MAJOR** |

The version in `version.txt` must match the new entry in `CHANGELOG.md`.

---

## Docker — Required After Every Batch of Changes

Claude **cannot** run Docker commands directly (the daemon is on the Windows host, not in the sandbox). After every session that touches any project file, Claude must:

1. Tell Nicky to run the rebuild before closing the session.
2. Include the exact command in the chat summary.

Nicky can rebuild by running either of these from `G:\Source\v\iso-game\`:

```powershell
# PowerShell / Terminal
docker compose down && docker compose up --build -d
```

```bat
REM Or double-click rebuild.bat in the project root
```

### Which files need a rebuild vs. a browser refresh

| Changed file | Action needed |
|---|---|
| `game.js`, `style.css`, `index.html`, `version.txt` | **Browser refresh only** (volume-mounted) |
| Any other file (`CHANGELOG.md`, `docs/`, etc.) | No action (not served by nginx) |
| New file added to the project root | **Rebuild** (must also add to `volumes:` in `docker-compose.yml`) |
| `Dockerfile`, `nginx.conf`, `docker-compose.yml` | **Rebuild** |

> For simplicity, running a rebuild after every session is always safe.

### Keeping `version.txt` in sync

`version.txt` must appear in **both**:
- `Dockerfile` — `COPY version.txt /usr/share/nginx/html/`
- `docker-compose.yml` — under `volumes:`

---

## File Access

All reads/writes stay within `G:\Source\v\iso-game\`.
See the workspace-level `G:\Source\v\CLAUDE.md` for broader rules.
