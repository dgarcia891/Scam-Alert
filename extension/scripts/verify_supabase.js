
import { createClient } from '@supabase/supabase-js';
import { submitReport } from '../src/lib/supabase.js';

console.log('🔍 verifying Supabase Connection...');

async function verify() {
    try {
        console.log('Attempting to submit a test report...');
        const result = await submitReport('https://test-verification.com', 'test_verification', 'Automated verification test');

        if (result.success) {
            console.log('✅ Connection Successful! The "reported_scams" table exists and accepts inserts.');
        } else {
            console.error('❌ Submission Failed.');
            console.error('Error:', result.error);

            if (result.error && result.error.message && result.error.message.includes('relation "reported_scams" does not exist')) {
                console.log('\n👉 DIAGNOSIS: The table "reported_scams" has not been created yet.');
                console.log('   Action: Run the SQL script from implementation_plan.md in your Supabase Dashboard.');
            } else if (result.error && result.error.message && result.error.message.includes('violates row-level security')) {
                console.log('\n👉 DIAGNOSIS: The table exists, but the RLS policy is blocking inserts.');
                console.log('   Action: invalid RLS policy. Make sure anonymous inserts are allowed.');
            }
        }
    } catch (e) {
        console.error('❌ Unexpected Error:', e);
    }
}

verify();
