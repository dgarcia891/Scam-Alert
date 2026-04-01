import { normalizeUrl } from './extension/src/lib/storage.js';
console.log('gmail:', normalizeUrl('https://mail.google.com/mail/u/0/#inbox/ABC'));
console.log('other:', normalizeUrl('https://example.com/path/#fragment'));
