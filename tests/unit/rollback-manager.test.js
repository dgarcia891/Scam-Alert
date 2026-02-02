import { shouldSuspendPattern, isProtectedDomain, detectAnomalies } from '../../src/lib/rollback-manager.js';

describe('Rollback Manager', () => {
    test('shouldSuspendPattern identifies high dismissal counts', () => {
        const metrics = { dismissalCount: 5, warningCount: 10, timeWindowMs: 30 * 60 * 1000 };
        expect(shouldSuspendPattern(metrics)).toBe(true);
    });

    test('shouldSuspendPattern identifies high dismissal rates', () => {
        const metrics = { dismissalCount: 7, warningCount: 20, timeWindowMs: 2 * 60 * 60 * 1000 };
        // 7/20 = 0.35 > 0.3
        expect(shouldSuspendPattern(metrics)).toBe(true);
    });

    test('isProtectedDomain identifies top domains', () => {
        expect(isProtectedDomain('www.google.com')).toBe(true);
        expect(isProtectedDomain('sub.amazon.com')).toBe(true);
        expect(isProtectedDomain('scamsite.com')).toBe(false);
    });

    test('detectAnomalies triggers rollbacks for protected domains', () => {
        const events = [
            { type: 'WARNING', timestamp: Date.now(), patternId: 'p1', domain: 'google.com' }
        ];
        expect(detectAnomalies(events)).toContain('p1');
    });

    test('detectAnomalies triggers rollbacks for high dismissal rates', () => {
        const now = Date.now();
        const events = [];
        for (let i = 0; i < 20; i++) events.push({ type: 'WARNING', timestamp: now, patternId: 'p2', domain: 'other.com' });
        for (let i = 0; i < 10; i++) events.push({ type: 'DISMISSAL', timestamp: now, patternId: 'p2', domain: 'other.com' });

        expect(detectAnomalies(events)).toContain('p2');
    });
});
