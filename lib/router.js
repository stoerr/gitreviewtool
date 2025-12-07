const url = require('url');
const path = require('path');
const fs = require('fs');
const git = require('./git');
const diffConsolidator = require('./diff-consolidator');
const {
  parseQueryString,
  sendJSON,
  sendError,
  getMimeType,
  parseCommitHashes,
  sanitizeFilePath
} = require('./utils');

/**
 * Handle incoming HTTP requests
 * @param {http.IncomingMessage} req - Request object
 * @param {http.ServerResponse} res - Response object
 * @param {string} cwd - Current working directory (Git repo)
 */
async function handleRequest(req, res, cwd) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  try {
    // API routes
    if (pathname === '/api/commits') {
      await handleGetCommits(req, res, cwd);
    } else if (pathname === '/api/files') {
      await handleGetFiles(req, res, cwd);
    } else if (pathname === '/api/diff') {
      await handleGetDiff(req, res, cwd);
    }
    // Static file serving
    else if (pathname === '/') {
      await serveStaticFile(res, path.join(__dirname, '../public/index.html'));
    } else if (pathname.startsWith('/static/')) {
      const filePath = pathname.replace('/static/', '');
      await serveStaticFile(res, path.join(__dirname, '../public', filePath));
    }
    // 404
    else {
      sendError(res, 404, 'Not found');
    }
  } catch (error) {
    console.error('Request handling error:', error);
    sendError(res, 500, error.message);
  }
}

/**
 * Handle GET /api/commits
 * Returns all commits from the repository
 */
async function handleGetCommits(req, res, cwd) {
  try {
    const commits = await git.getCommits(cwd);
    sendJSON(res, 200, commits);
  } catch (error) {
    console.error('Error getting commits:', error);
    sendError(res, 500, 'Failed to retrieve commits');
  }
}

/**
 * Handle GET /api/files?commits=hash1,hash2,...
 * Returns files changed in the specified commits
 */
async function handleGetFiles(req, res, cwd) {
  try {
    const query = parseQueryString(req.url);
    const commitHashes = parseCommitHashes(query.commits);

    if (commitHashes.length === 0) {
      sendJSON(res, 200, []);
      return;
    }

    const files = await git.getChangedFiles(commitHashes, cwd);
    sendJSON(res, 200, files);
  } catch (error) {
    console.error('Error getting files:', error);
    sendError(res, 400, error.message);
  }
}

/**
 * Handle GET /api/diff?file=path&commits=hash1,hash2,...
 * Returns consolidated diff for a file across multiple commits
 */
async function handleGetDiff(req, res, cwd) {
  try {
    const query = parseQueryString(req.url);

    if (!query.file) {
      sendError(res, 400, 'Missing file parameter');
      return;
    }

    const filePath = sanitizeFilePath(query.file);
    const commitHashes = parseCommitHashes(query.commits);

    if (commitHashes.length === 0) {
      sendError(res, 400, 'Missing commits parameter');
      return;
    }

    const result = await diffConsolidator.consolidateChanges(
      filePath,
      commitHashes,
      cwd
    );

    sendJSON(res, 200, result);
  } catch (error) {
    console.error('Error getting diff:', error);
    sendError(res, 400, error.message);
  }
}

/**
 * Serve a static file
 * @param {http.ServerResponse} res - Response object
 * @param {string} filePath - Path to the file
 */
async function serveStaticFile(res, filePath) {
  try {
    const content = await fs.promises.readFile(filePath);
    const mimeType = getMimeType(filePath);

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    } else {
      console.error('Error serving file:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
  }
}

module.exports = {
  handleRequest
};
