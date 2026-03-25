import assert from 'assert';

console.log('Running BUG-138 regression test...');

function createMockHandler(responsesToSimulate) {
    let callCount = 0;
    
    return {
        sendMessageToTab: async (tabId, msg) => {
            if (msg.type !== 'GET_EMAIL_CONTEXT') return null;
            const response = responsesToSimulate[callCount] || { success: false, error: 'timeout' };
            callCount++;
            return response;
        },
        getCallCount: () => callCount
    };
}

// Inline mocked fetchEmailContextWithRetry
async function fetchEmailContextWithRetry(sendMessageToTab, tabId, maxAttempts = 3) {
    let lastSuccessRes = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Fast test execution, ignore actual delays
        const res = await sendMessageToTab(tabId, { type: 'GET_EMAIL_CONTEXT' }).catch(e => ({ success: false, error: e.message }));

        if (res?.success && res.context) {
            lastSuccessRes = res;
        }

        if (res?.success && (res.context?.snippet?.length ?? 0) > 50) {
            return res; // Body is ready and has content
        }

        if (attempt < maxAttempts) {
            await new Promise(r => setImmediate(r)); // yield event loop
        }
    }
    return lastSuccessRes;
}

// ── Test 1: Fetch retries when body is empty and succeeds ────────────────────────
(async () => {
    const mock = createMockHandler([
        { success: true, bodyReady: false, context: { snippet: '' } },
        { success: true, bodyReady: false, context: { snippet: 'short' } }, // < 50 chars
        { success: true, bodyReady: true, context: { snippet: 'A real email body this is definitely more than fifty characters long.' } }
    ]);

    const result = await fetchEmailContextWithRetry(mock.sendMessageToTab, 1);
    
    assert.strictEqual(mock.getCallCount(), 3, '❌ Should have retried 3 times');
    assert.ok(result, '❌ Result should not be null');
    assert.strictEqual(result.context.snippet.length > 50, true, '❌ Extracted snippet should have > 50 length');
    console.log('  ✅ Retries successfully when body is initially empty until body is ready');
})().catch(e => { console.error(e); process.exit(1); });

// ── Test 2: Fetch exhausts retries and returns LAST SUCCESSFUL response ───────────
(async () => {
    const mock = createMockHandler([
        { success: true, bodyReady: false, context: { snippet: 'Initial' } },
        { success: true, bodyReady: false, context: { snippet: 'Retried' } },
        { success: true, bodyReady: false, context: { snippet: 'Exhausted' } },
        { success: true, bodyReady: true, context: { snippet: 'Ready too late.' } }
    ]);

    const result = await fetchEmailContextWithRetry(mock.sendMessageToTab, 1);
    
    assert.strictEqual(mock.getCallCount(), 3, '❌ Should have only retried up to maxAttempts (3)');
    assert.ok(result, '❌ Result should not be null on exhaustion if some RPCs succeeded');
    assert.strictEqual(result.context.snippet, 'Exhausted', '❌ Should return the last successful response');
    console.log('  ✅ Returns last successful response after max attempts are exhausted');
})().catch(e => { console.error(e); process.exit(1); });

// ── Test 3: Fetch fails on error but continues retry ─────────────────────────────
(async () => {
    const mock = createMockHandler([
        { success: false, error: 'disconnected' },
        { success: true, bodyReady: true, context: { snippet: 'A real email body this is definitely more than fifty characters long.' } }
    ]);

    const result = await fetchEmailContextWithRetry(mock.sendMessageToTab, 1);
    
    assert.strictEqual(mock.getCallCount(), 2, '❌ Should have retried after error');
    assert.ok(result, '❌ Result should not be null');
    assert.strictEqual(result.context.snippet.includes('real email'), true, '❌ Extracted snippet should match');
    console.log('  ✅ Retries successfully after a failure/throw');
})().catch(e => { console.error(e); process.exit(1); });

// ── Test 4: Fetch exhausts with TOTAL error returns null ─────────────────────────
(async () => {
    const mock = createMockHandler([
        { success: false, error: 'timeout' },
        { success: false, error: 'timeout' },
        { success: false, error: 'timeout' }
    ]);

    const result = await fetchEmailContextWithRetry(mock.sendMessageToTab, 1);
    
    assert.strictEqual(mock.getCallCount(), 3, '❌ Should have retried 3 times');
    assert.strictEqual(result, null, '❌ Result should be null if NO success was captured');
    console.log('  ✅ Returns null if all attempts fail/timeout');
})().then(() => {
    console.log('✅ BUG-138 regression tests all passed!');
}).catch(e => { console.error(e); process.exit(1); });
