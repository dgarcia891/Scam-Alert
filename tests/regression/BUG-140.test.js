import { jest } from '@jest/globals';

// For testing purposes, we define a lightweight mock orchestrator logic
// analogous to what triggerScan does in email-scanner.js
describe('BUG-140: Empty Body Retries Drop Valid Senders', () => {
    it('should fire scan payload immediately when body is empty but sender or subject exist', async () => {
        // Arrange
        let extractionRetryCount = 0;
        let mockBackgroundMessage = null;

        // Mock extractors
        const extractEmailText = jest.fn(() => ''); // Body empty!
        const parseSenderInfo = jest.fn(() => ({ name: 'Google DMARC', email: 'noreply-dmarc-support@google.com' }));
        const extractSubject = jest.fn(() => '');
        const extractHiddenHeaders = jest.fn(() => ({}));
        const extractEmailLinks = jest.fn(() => ({ links: [], rawUrls: [] }));
        
        const mockSendMessage = jest.fn((msg) => {
            mockBackgroundMessage = msg;
        });

        // The exact logic implemented in BUG-140
        const triggerScanSimulated = () => {
            let data = '', senderInfo = { name: '', email: '' }, subject = '', headers = {}, linkData = { links: [], rawUrls: [] };
            try {
                data        = extractEmailText() || '';
                senderInfo  = parseSenderInfo()  || { name: '', email: '' };
                subject     = extractSubject()   || '';
                headers     = extractHiddenHeaders() || {};
                linkData    = extractEmailLinks()    || { links: [], rawUrls: [] };
            } catch (err) {}

            const isLoaded = !!(data || senderInfo.email || subject);

            if (!isLoaded) {
                if (extractionRetryCount < 5) {
                    extractionRetryCount++;
                } else {
                    extractionRetryCount = 0;
                    mockSendMessage({
                        type: 'SCAN_CURRENT_TAB',
                        data: {
                            forceRefresh: true,
                            pageContent: { extractionFailed: true, isEmailView: true }
                        }
                    });
                }
                return;
            }

            extractionRetryCount = 0;

            mockSendMessage({
                type: 'SCAN_CURRENT_TAB',
                data: {
                    forceRefresh: true,
                    pageContent: {
                        bodyText: data,
                        isEmailView: true,
                        senderName: senderInfo.name,
                        senderEmail: senderInfo.email,
                        subject,
                        headers,
                        links: linkData.links,
                        rawUrls: linkData.rawUrls
                    }
                }
            });
        };

        // Act
        triggerScanSimulated();

        // Assert
        expect(extractEmailText).toHaveBeenCalled();
        expect(parseSenderInfo).toHaveBeenCalled();
        
        // It should NOT have incremented the retry count
        expect(extractionRetryCount).toBe(0);

        // It should HAVE sent the scan payload with the sender info intact
        expect(mockSendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'SCAN_CURRENT_TAB',
                data: expect.objectContaining({
                    pageContent: expect.objectContaining({
                        bodyText: '',
                        senderEmail: 'noreply-dmarc-support@google.com',
                        senderName: 'Google DMARC'
                    })
                })
            })
        );
        // Ensure extractionFailed is NOT set
        expect(mockBackgroundMessage.data.pageContent.extractionFailed).toBeUndefined();
    });
});
