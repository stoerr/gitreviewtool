# Git Change Review Helper

A lightweight, dependency-free Node.js tool for reviewing changes across multiple commits in a Git repository.
Nice for reviewing all changes made for a specific ticket.

CAUTION: This is vibe-coded in about 3h with Anthropics' Claude. Vibe-coded in the sense of not code-inspected at all, 
just manually tested and used. Use at your own risk. 
Still, I found it very useful. I didn't check the code because I didn't need to - it just worked as intended.

## Overview

Git Change Review Helper provides a simple web-based interface to:
- Filter commits by regex patterns (e.g., ticket numbers like `JIRA-1234`)
- View all files changed across selected commits
- See consolidated diffs showing only your ticket's changes
- Navigate through changes without the noise of unrelated commits

Built with zero npm dependencies - just Node.js built-in modules and Bootstrap from CDN.

## Installation

### Quick Setup (Recommended)

Create a symlink to the `gitreviewtool` script in your PATH:

```bash
# Option 1: Symlink to ~/bin (if it's in your PATH)
ln -s /path/to/gitreviewtool/gitreviewtool ~/bin/gitreviewtool

# Option 2: Symlink to /usr/local/bin (requires sudo)
sudo ln -s /path/to/gitreviewtool/gitreviewtool /usr/local/bin/gitreviewtool
```

The script follows symlinks to find the actual code, so you can install it anywhere and run it from any Git repository.

## Usage

### Starting the Server

**If you created a symlink (recommended):**

```bash
cd /path/to/your/git/repo
gitreviewtool
```

**Without symlink:**

```bash
cd /path/to/your/git/repo
/path/to/gitreviewtool/gitreviewtool
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
