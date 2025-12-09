#!/usr/bin/env node

const http = require('http');
const path = require('path');
const git = require('./lib/git');
const { handleRequest } = require('./lib/router');
const child_process = require('child_process');

const DEFAULT_PORT = 3032;
const MAX_PORT_ATTEMPTS = 10;

/**
 * Find an available port starting from the default
 * @param {number} startPort - Port to start checking from
 * @param {number} attempts - Number of ports to try
 * @returns {Promise<number>} - Available port number
 */
function findAvailablePort(startPort, attempts = MAX_PORT_ATTEMPTS) {
  return new Promise((resolve, reject) => {
    const testServer = http.createServer();

    testServer.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        if (attempts > 1) {
          resolve(findAvailablePort(startPort + 1, attempts - 1));
        } else {
          reject(new Error(`No available ports found starting from ${startPort}`));
        }
      } else {
        reject(err);
      }
    });

    testServer.once('listening', () => {
      testServer.close(() => {
        resolve(startPort);
      });
    });

    testServer.listen(startPort, '127.0.0.1');
  });
}

/**
 * Start the HTTP server
 */
async function startServer() {
  // Check if we're in a Git repository
  const cwd = process.cwd();
  const isGitRepo = await git.isGitRepository(cwd);

  if (!isGitRepo) {
    console.error('Error: Current directory is not a Git repository');
    console.error('Please run this server from within a Git repository');
    process.exit(1);
  }

  // Parse CLI args for port
  const argv = process.argv.slice(2);
  let requestedPort = undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-p' || a === '--port') {
      const val = argv[i + 1];
      if (!val) {
        console.error('Error: --port requires a value');
        process.exit(1);
      }
      const parsed = parseInt(val, 10);
      if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
        console.error('Error: Invalid port number. Must be an integer between 1 and 65535');
        process.exit(1);
      }
      requestedPort = parsed;
      i++; // skip value
    }
  }

  // Find an available port starting from requested or default
  const startPort = requestedPort || DEFAULT_PORT;

  let port;
  try {
    port = await findAvailablePort(startPort);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  // Create HTTP server
  const server = http.createServer((req, res) => {
    handleRequest(req, res, cwd);
  });

  // Start listening
  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}`;
    console.log(`Git Change Review Helper running at ${url}`);
    console.log(`Repository: ${cwd}`);
    console.log('Press Ctrl+C to stop');

    // If the system 'open' command exists, try to open the page in the default browser
    try {
      const which = child_process.spawnSync('which', ['open']);
      if (which.status === 0 && which.stdout && which.stdout.toString().trim()) {
        // spawn detached so it doesn't block the main process
        try {
          child_process.spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
          console.log('Opened browser with system "open" command');
        } catch (err) {
          // Non-fatal: just report
          console.error('Could not open browser automatically:', err && err.message ? err.message : err);
        }
      }
    } catch (err) {
      // ignore any errors when checking for 'open'
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\nShutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    server.close(() => {
      process.exit(1);
    });
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
  });
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
