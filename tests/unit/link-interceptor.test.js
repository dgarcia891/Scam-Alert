import { jest, describe, it, expect } from '@jest/globals';
import { isRiskyLink } from '../../src/content/email/link-interceptor.js';

describe('Email Link Interceptor - isRiskyLink', () => {
    it('identifies risky file extensions', () => {
        expect(isRiskyLink('https://example.com/payload.exe')).toBe(true);
        expect(isRiskyLink('http://test.org/downloads/archive.zip')).toBe(true);
        expect(isRiskyLink('https://cdn.site.net/invoice.pdf')).toBe(true);
        expect(isRiskyLink('https://evil.com/script.vbs')).toBe(true);
        expect(isRiskyLink('https://example.com/safe.png')).toBe(false);
        expect(isRiskyLink('https://example.com/page.html')).toBe(false);
    });

    it('identifies risky cloud document domains', () => {
        expect(isRiskyLink('https://docs.google.com/document/d/123/edit')).toBe(true);
        expect(isRiskyLink('https://sheets.google.com/')).toBe(true);
        expect(isRiskyLink('https://drive.google.com/file/d/456/view')).toBe(true);
        expect(isRiskyLink('https://mycompany.sharepoint.com/SitePages/Home.aspx')).toBe(true);
        expect(isRiskyLink('https://onedrive.live.com/download')).toBe(true);
        expect(isRiskyLink('https://dropbox.com/s/789/file')).toBe(true);
    });

    it('identifies suspicious query parameters', () => {
        expect(isRiskyLink('https://drive.google.com/uc?export=download&id=123')).toBe(true);
        expect(isRiskyLink('https://firebasestorage.googleapis.com/v0/b/bucket/o/file?alt=media')).toBe(true);
    });

    it('allows benign URLs', () => {
        expect(isRiskyLink('https://www.nytimes.com')).toBe(false);
        expect(isRiskyLink('https://github.com')).toBe(false);
        expect(isRiskyLink('mailto:test@example.com')).toBe(false);
        expect(isRiskyLink('javascript:void(0)')).toBe(false);
        expect(isRiskyLink('')).toBe(false);
        expect(isRiskyLink(null)).toBe(false);
    });
});
