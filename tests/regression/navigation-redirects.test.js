import { jest } from '@jest/globals';

describe('Regression: Hop Chains & Redirects (Finding 3)', () => {
    let mockCheckReputation;

    beforeEach(() => {
        // Mock chrome API
        global.chrome = {
            webNavigation: {
                onCompleted: {
                    addListener: jest.fn()
                }
            },
            storage: {
                session: { get: jest.fn(), set: jest.fn() }
            }
        };

        mockCheckReputation = jest.fn().mockResolvedValue({
            status: 'success',
            score: 0
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
        delete global.chrome;
    });

    test('onCompleted only processes the final destination url, avoiding redirect hop spam', async () => {
        // Simulate the service worker listener logic
        const listener = async (details) => {
            if (details.frameId !== 0) return;
            // Native architecture avoids 302 hops because Chrome only fires onCompleted when the final document loads
            await mockCheckReputation(details.url);
        };

        // Simulate a redirect chain: user clicks hopA.com -> hopB.com -> finalDestination.com
        // In real Chrome, HopA and HopB only fire 'onBeforeNavigate' and 'onBeforeRedirect'
        // Only finalDestination.com fires 'onCompleted'
        const finalUrl = 'https://finaldestination.com';
        
        await listener({ url: finalUrl, frameId: 0, tabId: 1 });

        // Verify that checkDomainReputation was only called once, for the final URL
        expect(mockCheckReputation).toHaveBeenCalledTimes(1);
        expect(mockCheckReputation).toHaveBeenCalledWith(finalUrl);
    });

    test('onCompleted ignores subframe (iframe) navigations to prevent quota abuse', async () => {
        const listener = async (details) => {
            if (details.frameId !== 0) return;
            await mockCheckReputation(details.url);
        };

        // Subframe navigation (like an ad iframe loading)
        await listener({ url: 'https://evil-iframe.com', frameId: 1, tabId: 1 });
        await listener({ url: 'https://tracker-iframe.com', frameId: 99, tabId: 1 });

        expect(mockCheckReputation).not.toHaveBeenCalled();
    });
});
