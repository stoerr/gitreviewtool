/**
 * State management for the Git Change Review Helper
 * Simple event-driven state management without frameworks
 */

(function(window) {
  'use strict';

  // Application state
  const state = {
    commits: [],              // All commits from API
    filterPattern: '',        // Current regex filter
    showFilteredOnly: false,  // Whether to hide non-filtered commits
    selectedCommits: new Set(), // Set of selected commit hashes
    files: [],                // Files changed in selected commits
    currentFile: null,        // Currently viewed file
    diffMode: 'my-changes',   // 'my-changes' | 'full-file'
    diffData: null,           // Current diff data
    commitsWithCurrentFile: new Set() // Commits that change the current file
  };

  // Event listeners
  const listeners = {};

  /**
   * Register an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  function on(event, callback) {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event].push(callback);
  }

  /**
   * Emit an event to all listeners
   * @param {string} event - Event name
   * @param {*} data - Data to pass to listeners
   */
  function emit(event, data) {
    if (listeners[event]) {
      listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Set commits
   * @param {Array} commits - Array of commit objects
   */
  function setCommits(commits) {
    state.commits = commits;
    emit('commits-loaded', commits);
  }

  /**
   * Set filter pattern
   * @param {string} pattern - Regex pattern
   */
  function setFilterPattern(pattern) {
    state.filterPattern = pattern;
    emit('filter-changed', pattern);
  }

  /**
   * Set show filtered only flag
   * @param {boolean} value - Whether to show only filtered commits
   */
  function setShowFilteredOnly(value) {
    state.showFilteredOnly = value;
    emit('show-filtered-changed', value);
  }

  /**
   * Toggle a commit selection
   * @param {string} commitHash - Commit hash
   */
  function toggleCommit(commitHash) {
    if (state.selectedCommits.has(commitHash)) {
      state.selectedCommits.delete(commitHash);
    } else {
      state.selectedCommits.add(commitHash);
    }
    emit('selection-changed', Array.from(state.selectedCommits));
  }

  /**
   * Set selected commits
   * @param {Array|Set} commits - Array or Set of commit hashes
   */
  function setSelectedCommits(commits) {
    state.selectedCommits = new Set(commits);
    emit('selection-changed', Array.from(state.selectedCommits));
  }

  /**
   * Clear all selected commits
   */
  function clearSelectedCommits() {
    state.selectedCommits.clear();
    emit('selection-changed', []);
  }

  /**
   * Set files
   * @param {Array} files - Array of file paths
   */
  function setFiles(files) {
    state.files = files;
    emit('files-changed', files);
  }

  /**
   * Set current file
   * @param {string} file - File path
   */
  function setCurrentFile(file) {
    state.currentFile = file;
    emit('file-changed', file);
  }

  /**
   * Set diff mode
   * @param {string} mode - 'my-changes' or 'full-file'
   */
  function setDiffMode(mode) {
    if (mode !== 'my-changes' && mode !== 'full-file') {
      console.error('Invalid diff mode:', mode);
      return;
    }
    state.diffMode = mode;
    emit('mode-changed', mode);
  }

  /**
   * Set diff data
   * @param {Object} data - Diff data from API
   */
  function setDiffData(data) {
    state.diffData = data;

    // Extract commits that have changes in this file
    const commitsWithChanges = new Set();
    if (data && data.myChangesOnly && data.myChangesOnly.hunks) {
      data.myChangesOnly.hunks.forEach(hunk => {
        if (hunk.commitHash) {
          commitsWithChanges.add(hunk.commitHash);
        }
      });
    }
    state.commitsWithCurrentFile = commitsWithChanges;

    emit('diff-data-changed', data);
  }

  /**
   * Get current state (read-only)
   */
  function getState() {
    return {
      commits: state.commits,
      filterPattern: state.filterPattern,
      showFilteredOnly: state.showFilteredOnly,
      selectedCommits: Array.from(state.selectedCommits),
      files: state.files,
      currentFile: state.currentFile,
      diffMode: state.diffMode,
      diffData: state.diffData,
      commitsWithCurrentFile: Array.from(state.commitsWithCurrentFile)
    };
  }

  /**
   * Get filtered commits based on current filter pattern
   * @returns {Array} - Array of commit hashes that match the filter
   */
  function getFilteredCommits() {
    if (!state.filterPattern) {
      return [];
    }

    try {
      const regex = new RegExp(state.filterPattern, 'i');
      return state.commits
        .filter(commit => regex.test(commit.message) || regex.test(commit.hash))
        .map(commit => commit.hash);
    } catch (error) {
      console.error('Invalid regex pattern:', error);
      return [];
    }
  }

  // Expose public API
  window.AppState = {
    on,
    emit,
    setCommits,
    setFilterPattern,
    setShowFilteredOnly,
    toggleCommit,
    setSelectedCommits,
    clearSelectedCommits,
    setFiles,
    setCurrentFile,
    setDiffMode,
    setDiffData,
    getState,
    getFilteredCommits
  };

})(window);
