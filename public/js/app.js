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
    console.log('Initializing Git Change Review Helper...');

    try {
      // Initialize components
      CommitList.init();
      FileList.init();
      DiffViewer.init();

      // Set initial diff mode
      AppState.setDiffMode('my-changes');

      // Set up commit panel toggle
      setupCommitPanelToggle();

      // Set up help dialog
      setupHelpDialog();

      // Set up column resizing
      setupColumnResize();

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
   * Set up help dialog functionality
   */
  function setupHelpDialog() {
    const helpBtn = document.querySelector('[data-bs-target="#help-modal"]');
    if (!helpBtn) {
      console.warn('Help button not found');
    }
    // Bootstrap modal works automatically with data-bs-toggle attribute
    // No additional initialization needed
  }

  /**
   * Set up column resizing functionality
   */
  function setupColumnResize() {
    const resizableElements = document.querySelectorAll('.resize-handle');

    resizableElements.forEach(element => {
      let isResizing = false;
      let startX = 0;
      let startWidth = 0;
      let nextElement = null;
      let nextStartWidth = 0;

      const onMouseDown = (e) => {
        // Only start resize if clicking near the right edge (the resize handle)
        const rect = element.getBoundingClientRect();
        const edgeSize = 6;

        if (e.clientX < rect.right - edgeSize || e.clientX > rect.right) {
          return;
        }

        isResizing = true;
        startX = e.clientX;
        startWidth = element.offsetWidth;

        // Find the next sibling panel
        nextElement = element.nextElementSibling;
        while (nextElement && !nextElement.classList.contains('panel-container')) {
          nextElement = nextElement.nextElementSibling;
        }

        if (nextElement) {
          nextStartWidth = nextElement.offsetWidth;
        }

        element.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        e.preventDefault();
      };

      const onMouseMove = (e) => {
        if (!isResizing) return;

        const diff = e.clientX - startX;
        const newWidth = startWidth + diff;
        const minWidth = parseInt(getComputedStyle(element).minWidth) || 100;

        // Update widths
        if (newWidth >= minWidth) {
          element.style.flex = `0 0 ${newWidth}px`;

          // If there's a next element, adjust it too
          if (nextElement) {
            const nextNewWidth = nextStartWidth - diff;
            const nextMinWidth = parseInt(getComputedStyle(nextElement).minWidth) || 100;

            if (nextNewWidth >= nextMinWidth) {
              nextElement.style.flex = `0 0 ${nextNewWidth}px`;
            }
          }
        }

        e.preventDefault();
      };

      const onMouseUp = () => {
        if (!isResizing) return;

        isResizing = false;
        element.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      element.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
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
