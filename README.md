# Git Ticket Change Viewer

A lightweight, dependency-free Node.js tool for reviewing changes across multiple commits in a Git repository. Perfect for reviewing all changes made for a specific ticket or feature branch.

## Overview

Git Ticket Change Viewer provides a simple web-based interface to:
- Filter commits by regex patterns (e.g., ticket numbers like `JIRA-1234`)
- View all files changed across selected commits
- See consolidated diffs showing only your ticket's changes
- Navigate through changes without the noise of unrelated commits

Built with zero npm dependencies - just Node.js built-in modules and Bootstrap from CDN.

## Usage

### Starting the Server

Navigate to your Git repository and start the server:

```bash
cd /path/to/your/git/repo
node /path/to/gitreviewtool/server.js
```

The server will start on `http://localhost:3032` (or another port if 3032 is busy).

### Workflow

1. **Filter Commits**
   - Enter a regex pattern in the filter field (e.g., `JIRA-1234` or `feature/.*login`)
   - The commit list will highlight matching commits
   - Toggle "Show only filtered commits" to hide unmatched commits
   - Each commit displays: short hash, author, date, and full message

2. **Review Changed Files**
   - Filtered commits are automatically selected
   - The file list shows all files modified in selected commits, sorted alphabetically
   - Click on any file to view its changes

3. **View Changes**
   - **My Changes Only**: Shows only the lines added/removed by selected commits (consolidated view)
   - **Full File with Marked Changes**: Shows the entire current file with selected commits' changes highlighted
   - Toggle between views using the buttons at the top of the diff view
   - Multiple changes to the same line are consolidated to show only the net effect of your selected commits

### Example Use Case

You're working on ticket `PROJ-456` with multiple commits over several days. Other developers have also committed to the same files. Use this tool to:

1. Filter for `PROJ-456`
2. See only the 8 commits related to your ticket
3. Review all 23 files you changed
4. For each file, see exactly what YOUR ticket changed, ignoring unrelated modifications by others

## Implementation Details

### Architecture

**Backend (Node.js)**
- Pure Node.js with built-in modules only (`http`, `child_process`, `fs`, `path`, `url`)
- RESTful API serving JSON responses
- Git operations executed via `child_process.exec()` and `child_process.spawn()`
- Single-file server implementation for simplicity

**Frontend (HTML/CSS/JS)**
- Vanilla JavaScript (no frameworks)
- Bootstrap 5.3 from CDN for UI components
- Single-page application with client-side routing/state management
- Responsive design for desktop use

### API Endpoints

- `GET /api/commits` - Returns all commits with metadata (hash, author, date, message)
- `GET /api/files?commits=hash1,hash2,...` - Returns files changed in specified commits
- `GET /api/diff?file=path&commits=hash1,hash2,...` - Returns diff data for a file across commits
- `GET /` - Serves the main HTML interface
- `GET /static/*` - Serves static assets (CSS/JS if needed)

### Git Operations

All Git data is retrieved using command-line git:
- `git log --all --format=...` for commit list
- `git diff --name-only commit1 commit2...` for file lists
- `git log -p -- <file>` for file history
- `git show commit:path` for file contents
- `git blame` for line-level attribution (optional)

### Diff Consolidation Logic

When showing "My Changes Only":
1. Get the current state of the file
2. For each selected commit, extract the changes (additions/deletions)
3. Consolidate multiple changes to the same line, keeping only the net effect
4. Display as a unified diff showing before/after for selected commits only

This filters out changes made by other commits between your selected commits.

### Security Considerations

- Server only accepts connections from localhost
- No file system writes (read-only Git operations)
- Input sanitization for regex patterns and file paths
- Git operations executed in the repository directory only

### Browser Compatibility

Modern browsers with ES6+ support:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### Limitations

- Works only with local Git repositories
- Designed for single-user local use (not production deployment)
- No authentication/authorization
- Performance may degrade with very large repositories (1000+ commits in view)
