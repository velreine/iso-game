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

## Docker Notes

`version.txt` must be listed in **both**:
- `Dockerfile` — `COPY version.txt /usr/share/nginx/html/`
- `docker-compose.yml` — under `volumes:`

After any code change, remind Nicky to run:
```bash
docker compose down && docker compose up --build -d
```
(The volume mounts mean subsequent edits only need a browser refresh.)

---

## File Access

All reads/writes stay within `G:\Source\v\iso-game\`.
See the workspace-level `G:\Source\v\CLAUDE.md` for broader rules.
