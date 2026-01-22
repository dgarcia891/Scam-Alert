import { jest, beforeEach } from '@jest/globals';

// Mock chrome API
global.chrome = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn()
        }
    },
    runtime: {
        sendMessage: jest.fn(),
        onMessage: {
            addListener: jest.fn()
        },
        lastError: null
    },
    tabs: {
        query: jest.fn(),
        sendMessage: jest.fn()
    },
    action: {
        setBadgeText: jest.fn(),
        setBadgeBackgroundColor: jest.fn()
    },
    notifications: {
        create: jest.fn()
    },
    webNavigation: {
        onBeforeNavigate: {
            addListener: jest.fn()
        },
        onCompleted: {
            addListener: jest.fn()
        }
    },
    alarms: {
        create: jest.fn(),
        onAlarm: {
            addListener: jest.fn()
        }
    }
};

// Reset mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
});
