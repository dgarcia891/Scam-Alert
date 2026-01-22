import { jest, describe, beforeEach, it, expect } from '@jest/globals';

/**
 * Bug BUG-001 Regression Test
 * 
 * Issue: Service worker crashes because chrome.alarms is undefined.
 */

describe('BUG-001: Missing alarms API', () => {
    beforeEach(() => {
        // Reset chrome mock
        global.chrome = {
            runtime: {
                onInstalled: { addListener: jest.fn() },
                onMessage: { addListener: jest.fn() }
            },
            notifications: {
                create: jest.fn()
            }
            // alarms is MISSING here to simulate the bug
        };
    });

    test('should fail when attempting to use alarms if not defined', () => {
        const createAlarm = () => {
            chrome.alarms.create('test', { periodInMinutes: 60 });
        };

        expect(createAlarm).toThrow();
    });

    test('should succeed when alarms API is present', () => {
        global.chrome.alarms = {
            create: jest.fn(),
            onAlarm: { addListener: jest.fn() }
        };

        const createAlarm = () => {
            chrome.alarms.create('test', { periodInMinutes: 60 });
        };

        expect(createAlarm).not.toThrow();
        expect(global.chrome.alarms.create).toHaveBeenCalledWith('test', { periodInMinutes: 60 });
    });
});
