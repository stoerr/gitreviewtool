const { exec, spawn } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

/**
 * Execute a git command and return stdout
 * @param {string} command - The git command to execute
 * @param {string} cwd - Working directory (defaults to process.cwd())
 * @returns {Promise<string>} - Command output
 */
async function executeGitCommand(command, cwd = process.cwd()) {
  try {
    const { stdout, stderr } = await execPromise(command, {
      cwd,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large outputs
    });

    if (stderr && !stderr.includes('warning')) {
      console.error('Git stderr:', stderr);
    }

    return stdout;
  } catch (error) {
    throw new Error(`Git command failed: ${error.message}`);
  }
}

/**
 * Get all commits from the repository
 * @param {string} cwd - Repository directory
 * @returns {Promise<Array>} - Array of commit objects
 */
async function getCommits(cwd = process.cwd()) {
  // Use a special separator that won't appear in commit messages
  const separator = '|||COMMIT_SEP|||';
  const format = `%H|%an|%ae|%at${separator}%B${separator}`;
  const command = `git log --all --max-count=1000 --format="${format}"`;

  const output = await executeGitCommand(command, cwd);

  if (!output.trim()) {
    return [];
  }

  // Split by separator and process pairs (metadata + message)
  const parts = output.split(separator);
  const commits = [];

  for (let i = 0; i < parts.length - 1; i += 2) {
    const metadataLine = parts[i].trim();
    const message = parts[i + 1] ? parts[i + 1].trim() : '';

    if (!metadataLine) continue;

    // The first line contains the metadata
    const lines = metadataLine.split('\n');
    const [hash, author, email, timestamp] = lines[0].split('|');

    commits.push({
      hash,
      shortHash: hash.substring(0, 7),
      author,
      email,
      timestamp: parseInt(timestamp),
      message
    });
  }

  return commits;
}

/**
 * Get list of files changed in the specified commits
 * @param {string[]} commitHashes - Array of commit hashes
 * @param {string} cwd - Repository directory
 * @returns {Promise<string[]>} - Array of file paths
 */
async function getChangedFiles(commitHashes, cwd = process.cwd()) {
  if (!commitHashes || commitHashes.length === 0) {
    return [];
  }

  // Get files changed in each commit and combine
  const filesSet = new Set();

  for (const hash of commitHashes) {
    const command = `git diff-tree --no-commit-id --name-only -r ${hash}`;
    const output = await executeGitCommand(command, cwd);

    output.trim().split('\n').forEach(file => {
      if (file) {
        filesSet.add(file);
      }
    });
  }

  return Array.from(filesSet).sort();
}

/**
 * Get the content of a file at a specific commit
 * @param {string} commitHash - The commit hash
 * @param {string} filePath - Path to the file
 * @param {string} cwd - Repository directory
 * @returns {Promise<string>} - File content
 */
async function getFileContent(commitHash, filePath, cwd = process.cwd()) {
  try {
    const command = `git show ${commitHash}:"${filePath}"`;
    return await executeGitCommand(command, cwd);
  } catch (error) {
    // File might not exist at this commit
    if (error.message.includes('does not exist') || error.message.includes('exists on disk')) {
      return null;
    }
    throw error;
  }
}

/**
 * Get the current content of a file (HEAD)
 * @param {string} filePath - Path to the file
 * @param {string} cwd - Repository directory
 * @returns {Promise<string>} - File content
 */
async function getCurrentFileContent(filePath, cwd = process.cwd()) {
  return getFileContent('HEAD', filePath, cwd);
}

/**
 * Get the diff for a specific file in a specific commit
 * @param {string} commitHash - The commit hash
 * @param {string} filePath - Path to the file
 * @param {string} cwd - Repository directory
 * @returns {Promise<string>} - Unified diff output
 */
async function getFileDiff(commitHash, filePath, cwd = process.cwd()) {
  try {
    // Get the diff for this specific commit
    const command = `git show ${commitHash} -- "${filePath}"`;
    const output = await executeGitCommand(command, cwd);
    return output;
  } catch (error) {
    // File might not exist in this commit
    return '';
  }
}

/**
 * Get diffs for a file across multiple commits
 * @param {string} filePath - Path to the file
 * @param {string[]} commitHashes - Array of commit hashes
 * @param {string} cwd - Repository directory
 * @returns {Promise<Array>} - Array of {commitHash, diff} objects
 */
async function getFileDiffsForCommits(filePath, commitHashes, cwd = process.cwd()) {
  const diffs = [];

  for (const hash of commitHashes) {
    const diff = await getFileDiff(hash, filePath, cwd);
    if (diff) {
      diffs.push({
        commitHash: hash,
        diff
      });
    }
  }

  return diffs;
}

/**
 * Get the parent commit hash for a given commit
 * @param {string} commitHash - The commit hash
 * @param {string} cwd - Repository directory
 * @returns {Promise<string|null>} - Parent commit hash or null if no parent
 */
async function getParentCommit(commitHash, cwd = process.cwd()) {
  try {
    const command = `git rev-parse ${commitHash}^`;
    const output = await executeGitCommand(command, cwd);
    return output.trim();
  } catch (error) {
    // No parent (root commit)
    return null;
  }
}

/**
 * Get file content before the first commit in a list
 * @param {string} filePath - Path to the file
 * @param {string[]} commitHashes - Array of commit hashes (sorted chronologically)
 * @param {string} cwd - Repository directory
 * @returns {Promise<string|null>} - File content before first commit, or null
 */
async function getFileContentBeforeCommits(filePath, commitHashes, cwd = process.cwd()) {
  if (!commitHashes || commitHashes.length === 0) {
    return null;
  }

  // Get the oldest commit
  const oldestCommit = commitHashes[commitHashes.length - 1];
  const parentCommit = await getParentCommit(oldestCommit, cwd);

  if (!parentCommit) {
    return null;
  }

  return getFileContent(parentCommit, filePath, cwd);
}

/**
 * Check if the current directory is a Git repository
 * @param {string} cwd - Directory to check
 * @returns {Promise<boolean>} - True if it's a Git repo
 */
async function isGitRepository(cwd = process.cwd()) {
  try {
    await executeGitCommand('git rev-parse --git-dir', cwd);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get commit information by hash
 * @param {string} commitHash - The commit hash
 * @param {string} cwd - Repository directory
 * @returns {Promise<Object>} - Commit object
 */
async function getCommitInfo(commitHash, cwd = process.cwd()) {
  const separator = '|||MSG_SEP|||';
  const format = `%H|%an|%ae|%at${separator}%B`;
  const command = `git show -s --format="${format}" ${commitHash}`;

  const output = await executeGitCommand(command, cwd);
  const parts = output.trim().split(separator);
  const [hash, author, email, timestamp] = parts[0].split('|');
  const message = parts[1] ? parts[1].trim() : '';

  return {
    hash,
    shortHash: hash.substring(0, 7),
    author,
    email,
    timestamp: parseInt(timestamp),
    message
  };
}

/**
 * Get the timestamp of a commit
 * @param {string} commitHash - The commit hash
 * @param {string} cwd - Repository directory
 * @returns {Promise<number>} - Unix timestamp
 */
async function getCommitTimestamp(commitHash, cwd = process.cwd()) {
  const command = `git show -s --format=%at ${commitHash}`;
  const output = await executeGitCommand(command, cwd);
  return parseInt(output.trim());
}

module.exports = {
  executeGitCommand,
  getCommits,
  getChangedFiles,
  getFileContent,
  getCurrentFileContent,
  getFileDiff,
  getFileDiffsForCommits,
  getParentCommit,
  getFileContentBeforeCommits,
  isGitRepository,
  getCommitInfo,
  getCommitTimestamp
};
