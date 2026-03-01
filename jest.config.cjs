module.exports = {
  testEnvironment: 'jsdom',
  transform: {},
  extensionsToTreatAsEsm: [],
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: [
    'extension/src/**/*.js',
    '!extension/src/**/*.test.js'
  ]
};
