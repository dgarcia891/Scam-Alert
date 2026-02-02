/**
 * Scam Report Modal
 */
import { MessageTypes } from '../../lib/messaging.js';

export async function openReportWorkflow(shadow, freshData, result) {
    // Rate Limiting Check
    try {
        const storage = await chrome.storage.local.get(['dailyReportCount', 'lastReportDate']);
        const today = new Date().toDateString();
        let count = 0;
        if (storage.lastReportDate === today) count = storage.dailyReportCount || 0;
        if (count >= 5) {
            alert('Daily report limit reached (5/day).');
            return;
        }
    } catch (e) { console.error('Rate limit check failed', e); }

    const fullBodyText = freshData.bodyText || '';
    const detectForwardedSender = (text) => {
        if (!text) return null;
        const patterns = [/From:\s*.*<(.+?@.+?)>/i, /From:\s*(.+?@.+?)\s*$/im, /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/];
        const headerText = text.substring(0, 2000);
        for (const p of patterns) {
            const match = headerText.match(p);
            if (match && match[1]) return match[1];
        }
        return null;
    };

    const forwardedSender = detectForwardedSender(fullBodyText);
    const defaultSender = forwardedSender || freshData.senderEmail || freshData.senderName || result.metadata?.sender || '';
    const defaultDesc = freshData.subject || result.metadata?.subject || '';
    const bodyPreview = (fullBodyText).substring(0, 500).replace(/\n/g, ' ') + '...';

    const modalOverlay = document.createElement('div');
    Object.assign(modalOverlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.6)', zIndex: '10000', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif',
        pointerEvents: 'auto'
    });

    modalOverlay.innerHTML = `
        <div id="sa-modal-content" style="background: #1e1e1e; color: #fff; padding: 24px; border-radius: 12px; width: 450px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); border: 1px solid #333;">
            <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Report Scam Source</h3>
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 12px; color: #aaa; margin-bottom: 4px;">Scammer's Email</label>
                <input id="sa-input-sender" type="text" value="${defaultSender.replace(/"/g, '&quot;')}" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #444; background: #2a2a2a; color: #fff; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 12px; color: #aaa; margin-bottom: 4px;">Description</label>
                <input id="sa-input-desc" type="text" value="${defaultDesc.replace(/"/g, '&quot;')}" readonly style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #333; background: #1a1a1a; color: #888; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 12px;">
                <button id="sa-btn-add-notes" style="background: none; border: none; padding: 0; color: #E63946; font-size: 12px; cursor: pointer; text-decoration: underline;">+ Add additional information</button>
                <textarea id="sa-input-notes" placeholder="Any extra context?" style="display: none; width: 100%; margin-top: 8px; padding: 8px; border-radius: 6px; border: 1px solid #444; background: #2a2a2a; color: #fff; box-sizing: border-box; height: 60px;"></textarea>
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 12px; color: #aaa; margin-bottom: 4px;">Evidence Preview</label>
                <div style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #333; background: #111; color: #888; font-family: monospace; font-size: 11px; height: 80px; overflow-y: auto;">
                    ${bodyPreview.replace(/</g, '&lt;')}
                </div>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="sa-btn-cancel" style="padding: 8px 16px; border: none; background: transparent; color: #aaa; cursor: pointer;">Cancel</button>
                <button id="sa-btn-submit" style="padding: 8px 16px; border: none; background: #E63946; color: #fff; font-weight: 600; cursor: pointer; border-radius: 6px;">Submit Report</button>
            </div>
        </div>
    `;

    shadow.appendChild(modalOverlay);

    const nodes = {
        notesBtn: modalOverlay.querySelector('#sa-btn-add-notes'),
        notesArea: modalOverlay.querySelector('#sa-input-notes'),
        cancelBtn: modalOverlay.querySelector('#sa-btn-cancel'),
        submitBtn: modalOverlay.querySelector('#sa-btn-submit'),
        senderInput: modalOverlay.querySelector('#sa-input-sender'),
        subjectInput: modalOverlay.querySelector('#sa-input-desc')
    };

    nodes.notesBtn.onclick = (e) => {
        e.stopPropagation();
        nodes.notesArea.style.display = 'block';
        nodes.notesBtn.style.display = 'none';
        nodes.notesArea.focus();
    };

    const close = () => modalOverlay.remove();
    nodes.cancelBtn.onclick = close;

    nodes.submitBtn.onclick = async () => {
        const finalDesc = nodes.notesArea.value ? `${nodes.subjectInput.value}\n\nNotes: ${nodes.notesArea.value}` : nodes.subjectInput.value;
        modalOverlay.remove();

        const reportBtn = shadow.getElementById('sa-report-btn');
        if (reportBtn) { reportBtn.textContent = 'Reporting...'; reportBtn.disabled = true; }

        chrome.runtime.sendMessage({
            type: MessageTypes.REPORT_SCAM,
            data: {
                url: window.location.href, type: 'email_scam', description: finalDesc,
                metadata: {
                    subject: freshData.subject || 'Unknown',
                    sender: nodes.senderInput.value,
                    original_sender: freshData.senderEmail || freshData.senderName,
                    forwarded_sender: forwardedSender,
                    body_text: fullBodyText.substring(0, 4000),
                    severity: result.overallSeverity,
                    indicators: result.report?.indicators || []
                }
            }
        }, async (resp) => {
            if (resp && resp.success) {
                alert('Report submitted successfully!');
                if (reportBtn) {
                    reportBtn.textContent = 'Submitted Already';
                    reportBtn.disabled = true;
                }
                const { reportedSites = {} } = await chrome.storage.local.get('reportedSites');
                reportedSites[window.location.href] = Date.now();
                const { dailyReportCount = 0 } = await chrome.storage.local.get('dailyReportCount');
                await chrome.storage.local.set({ reportedSites, dailyReportCount: dailyReportCount + 1, lastReportDate: new Date().toDateString() });
            } else {
                alert('Failed to submit report.');
                if (reportBtn) { reportBtn.textContent = 'Report Detected Scam'; reportBtn.disabled = false; }
            }
        });
    };
}
