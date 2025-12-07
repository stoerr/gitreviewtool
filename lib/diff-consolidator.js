const git = require('./git');

/**
 * Parse a unified diff string into structured hunks
 * @param {string} diffString - The unified diff output from git
 * @returns {Object} - { hunks: [...] }
 */
function parseDiff(diffString) {
  if (!diffString || !diffString.trim()) {
    return { hunks: [] };
  }

  const lines = diffString.split('\n');
  const hunks = [];
  let currentHunk = null;

  for (const line of lines) {
    // Parse hunk header: @@ -10,7 +10,8 @@
    const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (hunkMatch) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }

      currentHunk = {
        oldStart: parseInt(hunkMatch[1]),
        oldCount: parseInt(hunkMatch[2] || '1'),
        newStart: parseInt(hunkMatch[3]),
        newCount: parseInt(hunkMatch[4] || '1'),
        lines: []
      };
      continue;
    }

    // Skip non-hunk lines (diff headers, etc.)
    if (!currentHunk) {
      continue;
    }

    // Parse diff lines
    if (line.startsWith('-') && !line.startsWith('---')) {
      currentHunk.lines.push({ type: 'remove', content: line.substring(1) });
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      currentHunk.lines.push({ type: 'add', content: line.substring(1) });
    } else if (line.startsWith(' ')) {
      currentHunk.lines.push({ type: 'context', content: line.substring(1) });
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return { hunks };
}

/**
 * Sort commits by timestamp (oldest first)
 * @param {string[]} commitHashes - Array of commit hashes
 * @param {string} cwd - Repository directory
 * @returns {Promise<string[]>} - Sorted commit hashes
 */
async function sortCommitsByTime(commitHashes, cwd) {
  const timestamps = await Promise.all(
    commitHashes.map(async hash => ({
      hash,
      timestamp: await git.getCommitTimestamp(hash, cwd)
    }))
  );

  timestamps.sort((a, b) => a.timestamp - b.timestamp);
  return timestamps.map(t => t.hash);
}

/**
 * Consolidate changes from multiple commits for a file
 * @param {string} filePath - Path to the file
 * @param {string[]} commitHashes - Array of commit hashes
 * @param {string} cwd - Repository directory
 * @returns {Promise<Object>} - Consolidated diff data
 */
async function consolidateChanges(filePath, commitHashes, cwd = process.cwd()) {
  if (!commitHashes || commitHashes.length === 0) {
    return {
      myChangesOnly: { hunks: [] },
      fullFileMarked: { content: '', changes: [] }
    };
  }

  // Sort commits chronologically
  const sortedCommits = await sortCommitsByTime(commitHashes, cwd);

  // Get diffs for each commit
  const diffs = await git.getFileDiffsForCommits(filePath, sortedCommits, cwd);

  // Parse all diffs
  const parsedDiffs = diffs.map(d => ({
    commitHash: d.commitHash,
    ...parseDiff(d.diff)
  }));

  // Get current file content
  let currentContent;
  try {
    currentContent = await git.getCurrentFileContent(filePath, cwd);
  } catch (error) {
    currentContent = '';
  }

  // Generate consolidated views
  const myChangesOnly = generateMyChangesView(parsedDiffs);
  const fullFileMarked = generateFullFileView(currentContent, parsedDiffs);

  return {
    myChangesOnly,
    fullFileMarked
  };
}

/**
 * Generate "My Changes Only" view - consolidated diff
 * @param {Array} parsedDiffs - Array of parsed diff objects
 * @returns {Object} - { hunks: [...] }
 */
function generateMyChangesView(parsedDiffs) {
  // Combine all hunks from all diffs
  const allHunks = [];

  for (const diff of parsedDiffs) {
    for (const hunk of diff.hunks) {
      allHunks.push({
        ...hunk,
        commitHash: diff.commitHash
      });
    }
  }

  // Merge overlapping hunks
  const mergedHunks = mergeHunks(allHunks);

  return { hunks: mergedHunks };
}

/**
 * Merge overlapping or adjacent hunks
 * @param {Array} hunks - Array of hunks
 * @returns {Array} - Merged hunks
 */
function mergeHunks(hunks) {
  if (hunks.length === 0) {
    return [];
  }

  // Sort hunks by old line start
  const sorted = hunks.slice().sort((a, b) => a.oldStart - b.oldStart);

  const merged = [];
  let current = { ...sorted[0], lines: [...sorted[0].lines] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Check if hunks overlap or are adjacent
    const currentEnd = current.oldStart + current.oldCount;
    const nextStart = next.oldStart;

    if (nextStart <= currentEnd + 3) {
      // Merge hunks
      // Add context lines if there's a gap
      const gap = nextStart - currentEnd;
      for (let j = 0; j < gap; j++) {
        current.lines.push({ type: 'context', content: '' });
      }

      // Add lines from next hunk
      current.lines.push(...next.lines);
      current.oldCount = Math.max(
        current.oldCount + next.oldCount,
        nextStart + next.oldCount - current.oldStart
      );
      current.newCount = Math.max(
        current.newCount + next.newCount,
        next.newStart + next.newCount - current.newStart
      );
    } else {
      // No overlap, push current and start new
      merged.push(current);
      current = { ...next, lines: [...next.lines] };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Generate "Full File with Marked Changes" view
 * @param {string} fileContent - Current file content
 * @param {Array} parsedDiffs - Array of parsed diff objects
 * @returns {Object} - { content: string, changes: [...] }
 */
function generateFullFileView(fileContent, parsedDiffs) {
  if (!fileContent) {
    return { content: '', changes: [] };
  }

  const lines = fileContent.split('\n');
  const changes = [];

  // Build a map of line numbers to change types
  const lineChangeMap = new Map();

  for (const diff of parsedDiffs) {
    for (const hunk of diff.hunks) {
      let newLineNum = hunk.newStart;

      for (const line of hunk.lines) {
        if (line.type === 'add') {
          // Mark this line as added
          if (!lineChangeMap.has(newLineNum)) {
            lineChangeMap.set(newLineNum, 'add');
          }
          newLineNum++;
        } else if (line.type === 'remove') {
          // Removed lines don't appear in the current file
          // We'll mark the next line as having a removal before it
          if (!lineChangeMap.has(newLineNum)) {
            lineChangeMap.set(newLineNum, 'remove-before');
          }
        } else if (line.type === 'context') {
          newLineNum++;
        }
      }
    }
  }

  // Build changes array
  for (const [lineNum, changeType] of lineChangeMap.entries()) {
    changes.push({
      lineNumber: lineNum,
      type: changeType
    });
  }

  // Sort changes by line number
  changes.sort((a, b) => a.lineNumber - b.lineNumber);

  return {
    content: fileContent,
    changes
  };
}

/**
 * Simple consolidation that just combines all diffs
 * This is a simpler approach that shows all changes without
 * trying to compute the net effect
 * @param {Array} parsedDiffs - Array of parsed diff objects
 * @returns {Object} - { hunks: [...] }
 */
function simpleConsolidation(parsedDiffs) {
  const allHunks = [];

  for (const diff of parsedDiffs) {
    allHunks.push(...diff.hunks);
  }

  return { hunks: allHunks };
}

module.exports = {
  parseDiff,
  consolidateChanges,
  generateMyChangesView,
  generateFullFileView,
  mergeHunks,
  sortCommitsByTime
};
