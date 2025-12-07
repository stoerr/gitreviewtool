/**
 * Diff viewer component
 * Handles displaying diffs in two modes: "My Changes Only" and "Full File"
 */

(function(window) {
  'use strict';

  const diffViewerEl = document.getElementById('diff-viewer');
  const diffFileNameEl = document.getElementById('diff-file-name');
  const btnMyChanges = document.getElementById('btn-my-changes');
  const btnFullFile = document.getElementById('btn-full-file');
  const wrapLinesCheckbox = document.getElementById('wrap-lines');

  /**
   * Fetch diff data for current file and selected commits
   */
  async function fetchDiff() {
    const state = AppState.getState();
    const { currentFile, selectedCommits } = state;

    if (!currentFile || selectedCommits.length === 0) {
      AppState.setDiffData(null);
      return;
    }

    try {
      showLoading();

      const commitsParam = selectedCommits.join(',');
      const fileParam = encodeURIComponent(currentFile);
      const response = await fetch(`/api/diff?file=${fileParam}&commits=${commitsParam}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const diffData = await response.json();
      AppState.setDiffData(diffData);
    } catch (error) {
      console.error('Error fetching diff:', error);
      showError('Failed to load diff: ' + error.message);
    }
  }

  /**
   * Render the diff viewer
   */
  function renderDiff() {
    const state = AppState.getState();
    const { currentFile, diffData, diffMode } = state;

    // Update file name in header
    if (currentFile) {
      diffFileNameEl.textContent = currentFile;
    } else {
      diffFileNameEl.textContent = 'Diff Viewer';
    }

    // Update active button
    updateActiveButton(diffMode);

    // Show empty state if no file selected
    if (!currentFile) {
      diffViewerEl.innerHTML = `
        <div class="empty-state">
          <small>Select a file to view changes</small>
        </div>
      `;
      return;
    }

    // Show empty state if no diff data
    if (!diffData) {
      diffViewerEl.innerHTML = `
        <div class="empty-state">
          <small>No changes to display</small>
        </div>
      `;
      return;
    }

    // Render based on mode
    if (diffMode === 'my-changes') {
      renderMyChangesView(diffData.myChangesOnly);
    } else {
      renderFullFileView(diffData.fullFileMarked);
    }
  }

  /**
   * Render "My Changes Only" view
   */
  function renderMyChangesView(data) {
    if (!data || !data.hunks || data.hunks.length === 0) {
      diffViewerEl.innerHTML = `
        <div class="empty-state">
          <small>No changes in selected commits</small>
        </div>
      `;
      return;
    }

    let html = '<div class="diff-container">';

    data.hunks.forEach(hunk => {
      const commitMessage = hunk.commitMessage || '';
      const infoIcon = commitMessage ? '<span class="info-icon">i</span>' : '';
      const popup = commitMessage ? `<div class="commit-popup">${escapeHtml(commitMessage)}</div>` : '';

      html += '<div class="diff-hunk">';
      html += `<div class="diff-hunk-header">${infoIcon}<span>@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@</span>${popup}</div>`;

      let oldLineNum = hunk.oldStart;
      let newLineNum = hunk.newStart;

      hunk.lines.forEach(line => {
        const type = line.type;
        let lineNumText = '';

        if (type === 'remove') {
          lineNumText = oldLineNum.toString();
          oldLineNum++;
        } else if (type === 'add') {
          lineNumText = newLineNum.toString();
          newLineNum++;
        } else {
          lineNumText = newLineNum.toString();
          oldLineNum++;
          newLineNum++;
        }

        const wrapClass = wrapLinesCheckbox.checked ? ' wrap-lines' : '';
        html += `<div class="diff-line diff-${type}${wrapClass}"><span class="diff-line-num">${lineNumText}</span><span class="diff-line-content">${escapeHtml(line.content)}</span></div>`;
      });

      html += '</div>';
    });

    html += '</div>';
    diffViewerEl.innerHTML = html;
  }

  /**
   * Render "Full File with Marked Changes" view
   */
  function renderFullFileView(data) {
    if (!data || !data.content) {
      diffViewerEl.innerHTML = `
        <div class="empty-state">
          <small>File content not available</small>
        </div>
      `;
      return;
    }

    const lines = data.content.split('\n');
    const changeMap = new Map();

    // Build change map
    if (data.changes) {
      data.changes.forEach(change => {
        changeMap.set(change.lineNumber, change.type);
      });
    }

    let html = '<div class="diff-container">';

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const changeType = changeMap.get(lineNum);
      const classes = ['full-file-line'];

      if (changeType === 'add') {
        classes.push('added');
      } else if (changeType === 'remove-before') {
        classes.push('removed-before');
      } else if (changeType) {
        classes.push('changed');
      }

      if (wrapLinesCheckbox.checked) {
        classes.push('wrap-lines');
      }

      html += `<div class="${classes.join(' ')}"><span class="diff-line-num">${lineNum}</span><span class="diff-line-content">${escapeHtml(line)}</span></div>`;
    });

    html += '</div>';
    diffViewerEl.innerHTML = html;
  }

  /**
   * Update active button styling
   */
  function updateActiveButton(mode) {
    btnMyChanges.classList.remove('active');
    btnFullFile.classList.remove('active');

    if (mode === 'my-changes') {
      btnMyChanges.classList.add('active');
    } else {
      btnFullFile.classList.add('active');
    }
  }

  /**
   * Show loading state
   */
  function showLoading() {
    diffViewerEl.innerHTML = `
      <div class="loading">
        <div class="spinner-border spinner-border-sm text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div class="mt-2">Loading diff...</div>
      </div>
    `;
  }

  /**
   * Show error message
   */
  function showError(message) {
    diffViewerEl.innerHTML = `
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
   * Handle mode button clicks
   */
  function handleModeChange(e) {
    const mode = e.target.dataset.mode;
    if (mode) {
      AppState.setDiffMode(mode);
    }
  }

  /**
   * Handle wrap lines toggle
   */
  function handleWrapLinesChange() {
    renderDiff();
  }

  /**
   * Initialize the component
   */
  function init() {
    // Set up button listeners
    btnMyChanges.addEventListener('click', handleModeChange);
    btnFullFile.addEventListener('click', handleModeChange);
    wrapLinesCheckbox.addEventListener('change', handleWrapLinesChange);

    // Listen to state changes
    AppState.on('file-changed', fetchDiff);
    AppState.on('selection-changed', () => {
      const state = AppState.getState();
      if (state.currentFile) {
        fetchDiff();
      }
    });
    AppState.on('diff-data-changed', renderDiff);
    AppState.on('mode-changed', renderDiff);

    // Initial render
    renderDiff();
  }

  // Expose public API
  window.DiffViewer = {
    init
  };

})(window);
