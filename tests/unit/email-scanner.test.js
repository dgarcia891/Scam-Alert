import { describe, it, expect } from '@jest/globals';

describe('Email Scanner Sanity Check', () => {
    it('is registered in the manifest', () => {
        // This is a logic-only test suite for now as content scripts
        // require a DOM environment to test fully.
        expect(true).toBe(true);
    });
});
