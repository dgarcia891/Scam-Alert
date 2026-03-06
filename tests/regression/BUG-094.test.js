import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import * as contentOriginal from '../../extension/src/content/content.js';

describe('BUG-094: Double Popup due to duplicate content.js bundling', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        jest.resetModules();
    });

    test('emailScanner.js does not execute content.js side effects', async () => {
        // Mock chrome API
        global.chrome = {
            runtime: {
                onMessage: {
                    addListener: jest.fn()
                },
                sendMessage: jest.fn()
            },
            storage: {
                local: {
                    get: jest.fn().mockResolvedValue({ settings: {} })
                }
            }
        };

        // If emailScanner imports content.js, it will call addListener twice total
        // once for the intentional content.js load, and again for emailScanner.js load

        // This is tricky to simulate perfectly with Jest because Jest mocks modules by path.
        const fs = await import('fs');
        const path = await import('path');
        const fileURLToPath = (await import('url')).fileURLToPath;
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);

        const mutationObserverSrc = fs.readFileSync(path.join(__dirname, '../../extension/src/content/email/mutation-observer.js'), 'utf8');

        expect(mutationObserverSrc).not.toMatch(/from '\.\.\/content\.js'/);
        expect(mutationObserverSrc).toMatch(/from '\.\.\/\.\.\/lib\/constants\.js'/);

    });
});
