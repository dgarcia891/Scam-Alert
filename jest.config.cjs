module.exports = {
  testEnvironment: 'jsdom',
  transform: {},
  extensionsToTreatAsEsm: [],
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js'
  ]
};
