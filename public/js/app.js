/**
 * Main application controller
 * Initializes and coordinates all components
 */

(function(window) {
  'use strict';

  /**
   * Initialize the application
   */
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
      initializeApp();
    }
  }

  /**
   * Initialize all components
   */
  function initializeApp() {
    console.log('Initializing Git Ticket Change Viewer...');

    try {
      // Initialize components
      CommitList.init();
      FileList.init();
      DiffViewer.init();

      // Set initial diff mode
      AppState.setDiffMode('my-changes');

      // Set up commit panel toggle
      setupCommitPanelToggle();

      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Error initializing application:', error);
      showFatalError('Failed to initialize application: ' + error.message);
    }

    // Set up global error handler
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
  }

  /**
   * Set up commit panel toggle functionality
   */
  function setupCommitPanelToggle() {
    const commitPanel = document.getElementById('commit-panel');
    const toggleBtn = document.getElementById('toggle-commits');

    if (!commitPanel || !toggleBtn) {
      return;
    }

    toggleBtn.addEventListener('click', () => {
      commitPanel.classList.toggle('collapsed');
      toggleBtn.textContent = commitPanel.classList.contains('collapsed') ? '›' : '‹';
    });
  }

  /**
   * Show fatal error to user
   */
  function showFatalError(message) {
    document.body.innerHTML = `
      <div class="container mt-5">
        <div class="alert alert-danger" role="alert">
          <h4 class="alert-heading">Application Error</h4>
          <p>${escapeHtml(message)}</p>
          <hr>
          <p class="mb-0">Please check the console for more details and refresh the page to try again.</p>
        </div>
      </div>
    `;
  }

  /**
   * Handle global errors
   */
  function handleGlobalError(event) {
    console.error('Global error:', event.error);
  }

  /**
   * Handle unhandled promise rejections
   */
  function handleUnhandledRejection(event) {
    console.error('Unhandled promise rejection:', event.reason);
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Start the application
  init();

})(window);
