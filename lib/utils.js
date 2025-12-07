const path = require('path');
const url = require('url');

/**
 * Sanitize and validate a file path to prevent path traversal attacks
 * @param {string} filePath - The file path to sanitize
 * @returns {string} - The sanitized path
 * @throws {Error} - If the path contains suspicious patterns
 */
function sanitizeFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path');
  }

  const normalized = path.normalize(filePath);

  // Prevent path traversal
  if (normalized.includes('..') || normalized.startsWith('/')) {
    throw new Error('Invalid file path: path traversal detected');
  }

  return normalized;
}

/**
 * Validate a Git commit hash
 * @param {string} hash - The commit hash to validate
 * @returns {string} - The validated hash
 * @throws {Error} - If the hash is invalid
 */
function sanitizeCommitHash(hash) {
  if (!hash || typeof hash !== 'string') {
    throw new Error('Invalid commit hash');
  }

  // Git commit hashes are 7-40 character hex strings
  if (!/^[a-f0-9]{7,40}$/i.test(hash)) {
    throw new Error('Invalid commit hash format');
  }

  return hash.toLowerCase();
}

/**
 * Validate a regex pattern
 * @param {string} pattern - The regex pattern to validate
 * @returns {string} - The validated pattern
 * @throws {Error} - If the pattern is invalid
 */
function sanitizeRegex(pattern) {
  if (typeof pattern !== 'string') {
    throw new Error('Invalid regex pattern');
  }

  try {
    new RegExp(pattern);
    return pattern;
  } catch (e) {
    throw new Error(`Invalid regex pattern: ${e.message}`);
  }
}

/**
 * Parse query string from a URL
 * @param {string} urlString - The URL to parse
 * @returns {Object} - Object containing query parameters
 */
function parseQueryString(urlString) {
  const parsedUrl = url.parse(urlString, true);
  return parsedUrl.query || {};
}

/**
 * Send a JSON response
 * @param {http.ServerResponse} res - The response object
 * @param {number} statusCode - HTTP status code
 * @param {*} data - Data to send as JSON
 */
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:3032'
  });
  res.end(JSON.stringify(data));
}

/**
 * Send an error response
 * @param {http.ServerResponse} res - The response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 */
function sendError(res, statusCode, message) {
  sendJSON(res, statusCode, { error: message });
}

/**
 * Get MIME type for a file based on extension
 * @param {string} filePath - The file path
 * @returns {string} - The MIME type
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  return mimeTypes[ext] || 'text/plain';
}

/**
 * Parse commit hashes from comma-separated string
 * @param {string} commitsParam - Comma-separated commit hashes
 * @returns {string[]} - Array of validated commit hashes
 * @throws {Error} - If any hash is invalid
 */
function parseCommitHashes(commitsParam) {
  if (!commitsParam) {
    return [];
  }

  const hashes = commitsParam.split(',').map(h => h.trim()).filter(h => h);
  return hashes.map(sanitizeCommitHash);
}

module.exports = {
  sanitizeFilePath,
  sanitizeCommitHash,
  sanitizeRegex,
  parseQueryString,
  sendJSON,
  sendError,
  getMimeType,
  parseCommitHashes
};
