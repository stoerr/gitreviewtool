/**
 * Commit list component
 * Handles displaying, filtering, and selecting commits
 */

(function(window) {
  'use strict';

  const commitListEl = document.getElementById('commit-list');
  const filterInput = document.getElementById('filter-input');
  const showFilteredOnlyCheckbox = document.getElementById('show-filtered-only');
  const multiSelectCheckbox = document.getElementById('multi-select');
  const selectAllButton = document.getElementById('select-all-commits');

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
    const { commits, selectedCommits, filterPattern, showFilteredOnly, commitsWithCurrentFile } = state;

    if (!commits || commits.length === 0) {
      commitListEl.innerHTML = '<div class="text-center text-muted p-3">No commits found</div>';
      return;
    }

    // Get filtered commits
    const filteredHashes = filterPattern ? AppState.getFilteredCommits() : [];
    const filteredSet = new Set(filteredHashes);
    const fileChangesSet = new Set(commitsWithCurrentFile);

    let html = '';

    commits.forEach(commit => {
      const isSelected = selectedCommits.includes(commit.hash);
      const isFiltered = filteredSet.has(commit.hash);
      const hasFileChanges = fileChangesSet.has(commit.hash);
      const shouldShow = !showFilteredOnly || isFiltered || filterPattern === '';

      const classes = ['commit-item'];
      if (isSelected) classes.push('selected');
      if (isFiltered) classes.push('filtered');
      if (hasFileChanges) classes.push('has-file-changes');
      if (!shouldShow) classes.push('hidden');

      const date = formatDate(commit.timestamp);

      // Extract first line and check if there's more
      const messageLines = commit.message.split('\n').filter(l => l.trim());
      const firstLine = messageLines[0] || '';
      const hasMore = messageLines.length > 1;
      const messageClass = hasMore ? 'commit-message has-more' : 'commit-message';
      const fullMessage = escapeHtml(commit.message);

      html += `
        <div class="${classes.join(' ')}" data-hash="${commit.hash}" title="${fullMessage}">
          <div class="d-flex align-items-start">
            <input
              type="checkbox"
              class="commit-checkbox"
              data-hash="${commit.hash}"
              ${isSelected ? 'checked' : ''}>
            <div class="flex-grow-1">
              <div class="commit-header">
                <span class="commit-hash">${commit.shortHash}</span>
                <span class="commit-author">${escapeHtml(commit.author)}</span>
                <span class="commit-date">${date}</span>
              </div>
              <div class="${messageClass}">${escapeHtml(firstLine)}</div>
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
        handleCommitToggle(hash);
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
        handleCommitToggle(hash);
      });
    });
  }

  /**
   * Handle commit toggle with multi-select support
   */
  function handleCommitToggle(hash) {
    const multiSelect = multiSelectCheckbox.checked;

    if (multiSelect) {
      // Multi-select mode: toggle this commit
      AppState.toggleCommit(hash);
    } else {
      // Single-select mode: select only this commit
      const state = AppState.getState();
      const isCurrentlySelected = state.selectedCommits.includes(hash);

      if (isCurrentlySelected && state.selectedCommits.length === 1) {
        // If clicking the only selected commit, deselect it
        AppState.clearSelectedCommits();
      } else {
        // Select only this commit
        AppState.setSelectedCommits([hash]);
      }
    }
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

      // Only proceed with auto-enable/selection when the pattern is non-empty
      // and is a valid regular expression. This prevents toggling UI state
      // for user typos like unmatched parentheses.
      if (pattern) {
        let regexValid = true;
        try {
          // Attempt to construct the regex in a case-insensitive manner
          new RegExp(pattern, 'i');
        } catch (err) {
          regexValid = false;
        }

        if (regexValid) {
          // Update the checkboxes' visual state
          showFilteredOnlyCheckbox.checked = true;
          multiSelectCheckbox.checked = true;

          // Update AppState for showing filtered only
          AppState.setShowFilteredOnly(true);

          // Select exactly the filtered commits (deselect others)
          const filteredCommits = AppState.getFilteredCommits();
          AppState.setSelectedCommits(filteredCommits);
        } else {
          // Invalid regex: don't change checkboxes or selection. Let the
          // AppState.getFilteredCommits() handle this case (it will return []).
          // Optionally we could provide UI feedback here in the future.
        }
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
   * Handle select all button
   */
  function handleSelectAll() {
    const state = AppState.getState();
    const { commits, selectedCommits, filterPattern, showFilteredOnly } = state;

    // Determine which commits to select
    let commitsToSelect;

    if (filterPattern && showFilteredOnly) {
      // If filtering and showing only filtered, select filtered commits
      commitsToSelect = AppState.getFilteredCommits();
    } else if (filterPattern) {
      // If filtering but showing all, select filtered commits
      commitsToSelect = AppState.getFilteredCommits();
    } else {
      // No filter, select all commits
      commitsToSelect = commits.map(c => c.hash);
    }

    // Check if all target commits are already selected
    const allSelected = commitsToSelect.every(hash => selectedCommits.includes(hash));

    if (allSelected) {
      // Deselect all
      AppState.clearSelectedCommits();
      selectAllButton.textContent = 'Select All';
    } else {
      // Select all
      AppState.setSelectedCommits(commitsToSelect);
      selectAllButton.textContent = 'Deselect All';
    }
  }

  /**
   * Update select all button text
   */
  function updateSelectAllButton() {
    const state = AppState.getState();
    const { commits, selectedCommits, filterPattern } = state;

    let targetCommits;
    if (filterPattern) {
      targetCommits = AppState.getFilteredCommits();
    } else {
      targetCommits = commits.map(c => c.hash);
    }

    const allSelected = targetCommits.length > 0 &&
                       targetCommits.every(hash => selectedCommits.includes(hash));

    selectAllButton.textContent = allSelected ? 'Deselect All' : 'Select All';
  }

  /**
   * Initialize the component
   */
  function init() {
    // Set up input listeners
    filterInput.addEventListener('input', handleFilterInput);
    showFilteredOnlyCheckbox.addEventListener('change', handleShowFilteredOnly);
    selectAllButton.addEventListener('click', handleSelectAll);

    // Listen to state changes
    AppState.on('commits-loaded', () => {
      renderCommitList();
      updateSelectAllButton();
    });
    AppState.on('filter-changed', () => {
      renderCommitList();
      updateSelectAllButton();
    });
    AppState.on('show-filtered-changed', renderCommitList);
    AppState.on('selection-changed', () => {
      renderCommitList();
      updateSelectAllButton();
    });
    AppState.on('diff-data-changed', renderCommitList);

    // Fetch commits
    fetchCommits();
  }

  // Expose public API
  window.CommitList = {
    init
  };

})(window);
