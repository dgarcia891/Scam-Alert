import { checkRedirectChain } from '../../extension/src/lib/analyzer/url-engine.js';
import assert from 'assert';

console.log('Running redirect-chain.js tests...');

try {
    // 1. Flags URLs with multiple @ symbols (3+)
    const multi3 = checkRedirectChain('https://x.org.uk/@/foo.co.uk/bvg@bar.com/@/baz.in.net/hello@world.net');
    assert.strictEqual(multi3.flagged, true, '3+ @ symbols should be flagged');
    assert.ok(multi3.score >= 50, '3+ @ symbols should score >= 50');
    assert.strictEqual(multi3.severity, 'CRITICAL', '3+ @ symbols should be CRITICAL');

    // 2. Flags URLs with 2 @ symbols
    const multi2 = checkRedirectChain('https://malicious.org/@/hidden.com/path@fake.net');
    assert.strictEqual(multi2.flagged, true, '2 @ symbols should be flagged');
    assert.ok(multi2.score >= 40, '2 @ symbols should score >= 40');

    // 3. Flags URLs with many domain-like path segments
    const domainChain = checkRedirectChain('https://start.com/path/a.net/b.org/c.com/d.co.uk/e.info/f.biz');
    assert.strictEqual(domainChain.flagged, true, 'Many domain segments should be flagged');
    assert.ok(domainChain.details.includes('domain-like segments'), 'Details should mention domain segments');

    // 4. Real-world phishing URL from BUG-123
    const realWorld = checkRedirectChain('https://maificaldfly.xplatinfly.org.uk/@/veuirgureatness.co.uk/bvg@masgull.comdmkn/@/pokiasen.in.net/city/@/thecoflmar.com/contac/tlager/oesa.in.net/fon/@/itsalegx.com/cfthall/malitavan.com/mavej/@wanqrport.in.net/@/chatranil.net/copan/@/cdodshruts.com/port/@/theshvora.compcty/@/galdemt.nd/rusq/@/dxslennets.net/gp3/@/woginsm.comfin/v');
    assert.strictEqual(realWorld.flagged, true, 'Real phishing URL should be flagged');
    assert.strictEqual(realWorld.severity, 'CRITICAL', 'Real phishing URL should be CRITICAL');
    assert.ok(realWorld.score >= 50, 'Real phishing URL should score >= 50');

    // 5. Does NOT flag normal URLs
    const normal = checkRedirectChain('https://www.google.com/search?q=hello+world');
    assert.strictEqual(normal.flagged, false, 'Normal URL should not be flagged');
    assert.strictEqual(normal.score, 0, 'Normal URL should score 0');

    // 6. Does NOT flag normal email client URLs
    const gmail = checkRedirectChain('https://accounts.google.com/signin/v2/challenge/password');
    assert.strictEqual(gmail.flagged, false, 'Gmail login should not be flagged');

    // 7. Handles empty/null input gracefully
    assert.strictEqual(checkRedirectChain(null).flagged, false, 'null should not crash');
    assert.strictEqual(checkRedirectChain('').flagged, false, 'empty string should not crash');
    assert.strictEqual(checkRedirectChain(undefined).flagged, false, 'undefined should not crash');

    // 8. Adds length bonus for long redirect chains
    const longUrl = 'https://x.org.uk/@/foo.co.uk/bvg@bar.com/@/baz.in.net/' + 'a'.repeat(150);
    const longResult = checkRedirectChain(longUrl);
    assert.strictEqual(longResult.flagged, true, 'Long redirect chain should be flagged');
    assert.ok(longResult.details.includes('Excessive URL length'), 'Long URL should mention length');

    console.log('✅ All redirect-chain.js tests passed!');
} catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
}
