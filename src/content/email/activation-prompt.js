/**
 * Activation Prompt UI
 */
export function showActivationPrompt(triggerScan) {
    const PROMPT_ID = 'scam-alert-activation-prompt';
    if (document.getElementById(PROMPT_ID)) return;

    const container = document.createElement('div');
    container.id = PROMPT_ID;
    const shadow = container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        :host {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 2147483647;
            font-family: system-ui, -apple-system, sans-serif;
        }
        .card {
            background: #1e293b;
            color: #f8fafc;
            padding: 24px;
            border-radius: 16px;
            width: 340px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
            border: 1px solid #334155;
            animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp {
            from { transform: translateY(100px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .icon { background: rgba(99, 102, 241, 0.1); color: #818cf8; padding: 8px; border-radius: 10px; }
        .title { font-weight: 700; font-size: 16px; color: #f1f5f9; }
        .message { font-size: 13px; line-height: 1.5; color: #94a3b8; margin-bottom: 20px; }
        .actions { display: flex; flex-direction: column; gap: 8px; }
        button { padding: 10px 16px; font-size: 13px; font-weight: 600; border-radius: 8px; cursor: pointer; transition: all 0.2s; border: none; text-align: center; }
        .btn-primary { background: #6366f1; color: white; }
        .btn-primary:hover { background: #4f46e5; }
        .btn-secondary { background: #334155; color: #cbd5e1; }
        .btn-secondary:hover { background: #475569; color: white; }
        .btn-ghost { background: transparent; color: #64748b; font-size: 12px; margin-top: 4px; }
        .btn-ghost:hover { color: #94a3b8; text-decoration: underline; }
    `;
    shadow.appendChild(style);

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <div class="header">
            <div class="icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div class="title">Email Protection Off</div>
        </div>
        <div class="message">
            Real-time scanning for phishing and gift card scams is currently disabled. Would you like to turn it on for your safety?
        </div>
        <div class="actions">
            <button class="btn-primary" id="btn-on">Turn On Protection</button>
            <button class="btn-secondary" id="btn-later">Remind Me Later</button>
            <button class="btn-ghost" id="btn-never">Never ask me again</button>
        </div>
    `;

    shadow.appendChild(card);

    shadow.getElementById('btn-on').onclick = async () => {
        chrome.storage.local.get(['settings'], (result) => {
            const settings = result.settings || {};
            settings.emailScanningEnabled = true;
            chrome.storage.local.set({ settings }, () => {
                container.remove();
                triggerScan();
            });
        });
    };

    shadow.getElementById('btn-later').onclick = () => {
        chrome.storage.local.set({ emailPromptSessionDismissed: true }, () => {
            container.remove();
        });
    };

    shadow.getElementById('btn-never').onclick = () => {
        chrome.storage.local.get(['settings'], (result) => {
            const settings = result.settings || {};
            settings.emailPromptDisabled = true;
            chrome.storage.local.set({ settings }, () => {
                container.remove();
            });
        });
    };

    document.body.appendChild(container);
}
