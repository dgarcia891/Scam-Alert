/**
 * Background Auth Service (v19.2 Refactored)
 */
import { isPro } from '../../lib/storage.js';

export async function checkProStatus() {
    try {
        return await isPro();
    } catch (err) {
        console.warn('[Scam Alert] Pro status check failed:', err);
        return false;
    }
}
