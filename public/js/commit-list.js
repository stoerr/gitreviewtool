/**
 * Commit list component
 * Handles displaying, filtering, and selecting commits
 */

(function(window) {
  'use strict';

  const commitListEl = document.getElementById('commit-list');
  const filterInput = document.getElementById('filter-input');
  const showFilteredOnlyCheckbox = document.getElementById('show-filtered-only');

  let debounceTimeout = null;

  /**
   * Fetch commits from API
   */
  async function fetchCommits() {
    try {
      const response = await fetch('/api/commits');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const commits = await response.json();
      AppState.setCommits(commits);
    } catch (error) {
      console.error('Error fetching commits:', error);
      showError('Failed to load commits: ' + error.message);
    }
  }

  /**
   * Render the commit list
   */
  function renderCommitList() {
    const state = AppState.getState();
    const { commits, selectedCommits, filterPattern, showFilteredOnly } = state;

    if (!commits || commits.length === 0) {
      commitListEl.innerHTML = '<div class="text-center text-muted p-3">No commits found</div>';
      return;
    }

    // Get filtered commits
    const filteredHashes = filterPattern ? AppState.getFilteredCommits() : [];
    const filteredSet = new Set(filteredHashes);

    let html = '';

    commits.forEach(commit => {
      const isSelected = selectedCommits.includes(commit.hash);
      const isFiltered = filteredSet.has(commit.hash);
      const shouldShow = !showFilteredOnly || isFiltered || filterPattern === '';

      const classes = ['commit-item'];
      if (isSelected) classes.push('selected');
      if (isFiltered) classes.push('filtered');
      if (!shouldShow) classes.push('hidden');

      const date = formatDate(commit.timestamp);

      html += `
        <div class="${classes.join(' ')}" data-hash="${commit.hash}">
          <div class="d-flex align-items-start">
            <input
              type="checkbox"
              class="commit-checkbox"
              data-hash="${commit.hash}"
              ${isSelected ? 'checked' : ''}>
            <div class="flex-grow-1">
              <div class="d-flex justify-content-between align-items-start">
                <span class="commit-hash">${commit.shortHash}</span>
                <span class="commit-date">${date}</span>
              </div>
              <div class="commit-author">${escapeHtml(commit.author)}</div>
              <div class="commit-message">${escapeHtml(commit.message)}</div>
            </div>
          </div>
        </div>
      `;
    });

    commitListEl.innerHTML = html;
    attachEventListeners();
  }

  /**
   * Attach event listeners to commit items
   */
  function attachEventListeners() {
    // Checkbox change events
    const checkboxes = commitListEl.querySelectorAll('.commit-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const hash = e.target.dataset.hash;
        AppState.toggleCommit(hash);
      });
    });

    // Commit item click events (toggle checkbox)
    const items = commitListEl.querySelectorAll('.commit-item');
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('commit-checkbox')) {
          return; // Already handled by checkbox listener
        }
        const hash = item.dataset.hash;
        const checkbox = item.querySelector('.commit-checkbox');
        checkbox.checked = !checkbox.checked;
        AppState.toggleCommit(hash);
      });
    });
  }

  /**
   * Show error message
   */
  function showError(message) {
    commitListEl.innerHTML = `
      <div class="error">
        <strong>Error:</strong> ${escapeHtml(message)}
      </div>
    `;
  }

  /**
   * Format Unix timestamp to readable date
   */
  function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now - date;

    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      if (hours === 0) {
        const minutes = Math.floor(diff / (60 * 1000));
        return minutes <= 1 ? 'just now' : `${minutes}m ago`;
      }
      return `${hours}h ago`;
    }

    // Less than 7 days
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days}d ago`;
    }

    // Format as date
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
   * Handle filter input with debouncing
   */
  function handleFilterInput() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      const pattern = filterInput.value.trim();
      AppState.setFilterPattern(pattern);

      // Auto-select filtered commits if filter is applied
      if (pattern) {
        const filteredCommits = AppState.getFilteredCommits();
        AppState.setSelectedCommits(filteredCommits);
      }
    }, 300);
  }

  /**
   * Handle show filtered only checkbox
   */
  function handleShowFilteredOnly() {
    AppState.setShowFilteredOnly(showFilteredOnlyCheckbox.checked);
  }

  /**
   * Initialize the component
   */
  function init() {
    // Set up input listeners
    filterInput.addEventListener('input', handleFilterInput);
    showFilteredOnlyCheckbox.addEventListener('change', handleShowFilteredOnly);

    // Listen to state changes
    AppState.on('commits-loaded', renderCommitList);
    AppState.on('filter-changed', renderCommitList);
    AppState.on('show-filtered-changed', renderCommitList);
    AppState.on('selection-changed', renderCommitList);

    // Fetch commits
    fetchCommits();
  }

  // Expose public API
  window.CommitList = {
    init
  };

})(window);
