import { jest } from '@jest/globals';
import 'jest-chrome';

if (global.chrome && global.chrome.runtime) {
  global.chrome.runtime.getURL = jest.fn((path) => `chrome-extension://mock-id/${path}`);
}

/**
 * Global Jest Setup
 * This file is executed before every test.
 */

// Silencing expected console noise during tests
jest.spyOn(console, 'error').mockImplementation(() => { });

// Mock chrome.runtime.sendMessage for general use
if (!global.chrome) {
  global.chrome = {
    runtime: {
      getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`),
      sendMessage: jest.fn(),
      onMessage: { addListener: jest.fn() }
    },
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
        clear: jest.fn()
      }
    },
    tabs: {
      get: jest.fn(),
      sendMessage: jest.fn()
    },
    action: {
      setBadgeText: jest.fn(),
      setBadgeBackgroundColor: jest.fn()
    },
    notifications: {
      create: jest.fn()
    }
  };
}
// Ensure chrome.runtime.getURL is always available for background tests
if (!global.chrome) global.chrome = {};
if (!global.chrome.runtime) global.chrome.runtime = {};
global.chrome.runtime.getURL = jest.fn((path) => `chrome://mock-extension/${path}`);
