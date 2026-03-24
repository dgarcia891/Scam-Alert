/** @type {import('jest').Config} */
export default {
    // Use Node's experimental ESM support
    transform: {},
    testMatch: [
        '**/tests/**/*.test.js',
    ],
    // Needed for chrome.* API mocks  
    testEnvironment: 'node',
};
