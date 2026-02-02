/**
 * Hydra Hub: Tab State Manager
 * Manages per-tab state in the background script.
 */

class TabStateManager {
    constructor() {
        this.tabStates = new Map();
    }

    /**
     * Get state for a specific tab
     */
    getTabState(tabId) {
        if (!this.tabStates.has(tabId)) {
            this.tabStates.set(tabId, this.createInitialState(tabId));
        }
        return this.tabStates.get(tabId);
    }

    /**
     * Create initial state for a new tab
     */
    createInitialState(tabId) {
        return {
            tabId,
            url: null,
            context: null,
            scanResults: null,
            lastScanned: null,
            scanInProgress: false,
            autoScanned: false
        };
    }

    /**
     * Update state for a tab
     */
    updateTabState(tabId, updates) {
        const currentState = this.getTabState(tabId);
        const newState = { ...currentState, ...updates };
        this.tabStates.set(tabId, newState);
        return newState;
    }

    /**
     * Handle navigation (reset results, keep context until new detection)
     */
    handleNavigation(tabId, url) {
        const currentState = this.getTabState(tabId);

        // If URL changed significantly, reset everything
        if (currentState.url !== url) {
            this.tabStates.set(tabId, {
                ...this.createInitialState(tabId),
                url
            });
        }
    }

    /**
     * Close tab (cleanup)
     */
    closeTab(tabId) {
        this.tabStates.delete(tabId);
    }
}

export const tabStateManager = new TabStateManager();
