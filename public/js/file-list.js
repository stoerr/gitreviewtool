/**
 * File list component
 * Handles displaying and selecting files changed in selected commits
 */

(function(window) {
  'use strict';

  const fileListEl = document.getElementById('file-list');
  const fileCountEl = document.getElementById('file-count');

  /**
   * Fetch files changed in selected commits
   */
  async function fetchFiles() {
    const state = AppState.getState();
    const { selectedCommits } = state;

    if (selectedCommits.length === 0) {
      AppState.setFiles([]);
      AppState.setCurrentFile(null);
      return;
    }

    try {
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          commits: selectedCommits
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const files = await response.json();
      AppState.setFiles(files);

      // If current file is not in the new list, clear it
      if (state.currentFile && !files.includes(state.currentFile)) {
        AppState.setCurrentFile(null);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      showError('Failed to load files: ' + error.message);
    }
  }

  /**
   * Render the file list
   */
  function renderFileList() {
    const state = AppState.getState();
    const { files, currentFile, selectedCommits } = state;

    // Update file count
    if (selectedCommits.length === 0) {
      fileCountEl.textContent = 'Select commits to see files';
    } else {
      fileCountEl.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
    }

    // Show empty state if no files
    if (files.length === 0) {
      if (selectedCommits.length === 0) {
        fileListEl.innerHTML = `
          <div class="empty-state">
            <small>No commits selected</small>
          </div>
        `;
      } else {
        fileListEl.innerHTML = `
          <div class="empty-state">
            <small>No files changed in selected commits</small>
          </div>
        `;
      }
      return;
    }

    // Render file list
    let html = '';
    files.forEach(file => {
      const isActive = file === currentFile;
      const classes = ['file-item'];
      if (isActive) classes.push('active');

      html += `
        <div class="${classes.join(' ')}" data-file="${escapeHtml(file)}">
          ${escapeHtml(file)}
        </div>
      `;
    });

    fileListEl.innerHTML = html;
    attachEventListeners();
  }

  /**
   * Attach event listeners to file items
   */
  function attachEventListeners() {
    const items = fileListEl.querySelectorAll('.file-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const file = item.dataset.file;
        AppState.setCurrentFile(file);
      });
    });
  }

  /**
   * Show error message
   */
  function showError(message) {
    fileListEl.innerHTML = `
      <div class="error">
        <strong>Error:</strong> ${escapeHtml(message)}
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Initialize the component
   */
  function init() {
    // Listen to state changes
    AppState.on('selection-changed', fetchFiles);
    AppState.on('files-changed', renderFileList);
    AppState.on('file-changed', renderFileList);

    // Initial render
    renderFileList();
  }

  // Expose public API
  window.FileList = {
    init
  };

})(window);
