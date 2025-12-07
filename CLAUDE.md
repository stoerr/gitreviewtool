# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Git Change Review Helper** is a lightweight, dependency-free Node.js tool for reviewing changes across multiple commits in a Git repository. It provides a web interface to filter commits by regex patterns (e.g., ticket numbers) and view consolidated diffs showing only the selected commits' changes.

**Key Constraint:** This project uses **zero npm dependencies** - only Node.js built-in modules (`http`, `child_process`, `fs`, `path`, `url`).

## Development Commands

### Running the Server

**Recommended:** Use the `gitreviewtool` script:
```bash
# From any git repository you want to analyze
/path/to/gitreviewtool/gitreviewtool
```

**Or symlink it to your PATH:**
```bash
ln -s /path/to/gitreviewtool/gitreviewtool ~/bin/gitreviewtool
# Then run from any git repository:
gitreviewtool
```

The script follows symlinks to find the actual code, so it works from anywhere.

The server runs on `http://localhost:3032` (auto-adjusts if port is busy).

### Project Structure
```
gitreviewtool/
├── server.js                    # Main HTTP server entry point
├── gitreviewtool               # Startup script (symlink-friendly)
├── lib/
│   ├── utils.js                # Input sanitization and helpers
│   ├── git.js                  # Git command execution
│   ├── router.js               # HTTP routing and API endpoints
│   └── diff-consolidator.js   # Core diff merging algorithm
├── public/
│   ├── index.html              # Main SPA interface
│   ├── css/app.css             # Custom styles
│   └── js/
│       ├── state.js            # Event-driven state management
│       ├── commit-list.js      # Commit list component
│       ├── file-list.js        # File list component
│       ├── diff-viewer.js      # Diff viewer component
│       └── app.js              # Main application controller
├── README.md
└── CLAUDE.md
```

## Architecture

### Backend
- **Pure Node.js** - no external dependencies allowed
- Modular architecture with `lib/` directory for organization
- Git operations via `child_process.exec()` and `child_process.spawn()`
- RESTful JSON API with these endpoints:
  - `GET /api/commits` - All commits with metadata (hash, author, date, message)
  - `GET /api/files?commits=hash1,hash2,...` - Files changed in specified commits
  - `GET /api/diff?file=path&commits=hash1,hash2,...` - Diff data for a file across commits
  - `GET /` - Main HTML interface
  - `GET /static/*` - Static assets

### Frontend
- **Vanilla JavaScript** (no frameworks - no React, Vue, etc.)
- **Bootstrap 5.3** from CDN (only external resource allowed)
- Single-page application with event-driven state management
- Component-based architecture without a framework
- Two diff view modes:
  - "My Changes Only" - consolidated view of selected commits
  - "Full File with Marked Changes" - entire file with highlighted changes

### Git Integration
The tool executes Git commands to extract data:
- `git log --all --format=...` - commit list
- `git diff --name-only commit1 commit2...` - file lists
- `git log -p -- <file>` - file history
- `git show commit:path` - file contents at specific commit
- `git blame` - line-level attribution (optional)

### Diff Consolidation Algorithm
The core feature is consolidating changes from multiple commits:
1. Get current file state
2. Extract additions/deletions from each selected commit
3. Merge multiple changes to the same line, showing net effect
4. Filter out changes from non-selected commits between selected ones

This allows users to see "what did MY ticket change" even when others modified the same files.

## Security Requirements
- Server only accepts localhost connections
- Read-only Git operations (no file system writes)
- Input sanitization for regex patterns and file paths
- Git operations restricted to repository directory only

## Browser Compatibility
Target modern browsers with ES6+ support (Chrome/Edge 90+, Firefox 88+, Safari 14+).

## Key Implementation Principles
- **No dependencies:** Do not suggest npm packages or third-party libraries. Use Node.js built-in modules only.
- **Single-user tool:** Designed for local development use, not production deployment.
- **No authentication:** Localhost-only, no auth/authorization needed.
- **Simplicity:** Single-file backend implementation preferred.
