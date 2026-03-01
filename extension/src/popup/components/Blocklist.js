export class BlocklistComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.blocklist = [];
        this.init();
    }

    async init() {
        this.render();
        this.bindEvents();
        await this.loadBlocklist();
    }

    async loadBlocklist() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'get_blocklist' });
            if (response && response.success) {
                // response.data if using createMessageHandler wrapper, or just response depending on implementation
                // Looking at message-dispatcher.js: return getBlocklist() -> returns array directly?
                // Wait, createMessageHandler wraps it in { success: true, data: result }
                this.blocklist = response.data || [];
            } else if (Array.isArray(response)) {
                this.blocklist = response;
            }
            this.updateListUI();
        } catch (e) {
            console.error('Failed to load blocklist', e);
        }
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="blocklist-section">
                <h3>Blocked Domains</h3>
                <div class="add-block-form">
                    <input type="text" id="blockInput" placeholder="example.com" />
                    <button id="addBlockBtn" class="action-btn">Block</button>
                </div>
                <ul id="blocklistItems" class="domain-list"></ul>
            </div>
        `;
    }

    bindEvents() {
        const addBtn = this.container.querySelector('#addBlockBtn');
        const input = this.container.querySelector('#blockInput');

        addBtn?.addEventListener('click', () => this.addDomain());
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addDomain();
        });

        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-btn')) {
                const domain = e.target.dataset.domain;
                this.removeDomain(domain);
            }
        });
    }

    async addDomain() {
        const input = this.container.querySelector('#blockInput');
        const domain = input.value.trim();

        if (!domain) return;

        try {
            await chrome.runtime.sendMessage({
                type: 'add_to_blocklist',
                data: { domain }
            });
            input.value = '';
            await this.loadBlocklist();
        } catch (e) {
            console.error('Failed to add to blocklist', e);
        }
    }

    async removeDomain(domain) {
        if (!confirm(`Unblock ${domain}?`)) return;

        try {
            await chrome.runtime.sendMessage({
                type: 'remove_from_blocklist',
                data: { domain }
            });
            await this.loadBlocklist();
        } catch (e) {
            console.error('Failed to remove from blocklist', e);
        }
    }

    updateListUI() {
        const list = this.container.querySelector('#blocklistItems');
        if (!list) return;

        if (this.blocklist.length === 0) {
            list.innerHTML = '<li class="empty-state">No blocked domains</li>';
            return;
        }

        list.innerHTML = this.blocklist.map(domain => `
            <li class="domain-item">
                <span class="domain-name">${domain}</span>
                <button class="remove-btn" data-domain="${domain}">×</button>
            </li>
        `).join('');
    }
}
