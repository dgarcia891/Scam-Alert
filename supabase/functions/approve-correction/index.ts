import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Get request body
        const { correctionId, adminUserId } = await req.json();

        if (!correctionId || !adminUserId) {
            throw new Error('Missing required parameters: correctionId and adminUserId');
        }

        // Initialize Supabase client with service role key (bypasses RLS)
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase environment variables');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Verify admin has permission (check az_user_roles)
        const { data: adminCheck, error: adminError } = await supabase
            .from('az_user_roles')
            .select('role')
            .eq('user_id', adminUserId)
            .single();

        if (adminError || adminCheck?.role !== 'admin') {
            return new Response(
                JSON.stringify({ error: 'Unauthorized: Admin access required' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 2. Fetch the correction
        const { data: correction, error: correctionError } = await supabase
            .from('sa_corrections')
            .select('*')
            .eq('id', correctionId)
            .single();

        if (correctionError) {
            throw new Error(`Failed to fetch correction: ${correctionError.message}`);
        }

        if (!correction) {
            throw new Error('Correction not found');
        }

        if (correction.review_status !== 'pending') {
            throw new Error('Correction has already been reviewed');
        }

        // 3. Determine pattern adjustment amount
        let adjustmentAmount = 0;

        if (correction.user_label === 'FALSE_POSITIVE') {
            // User says it's safe but we flagged it → reduce confidence
            adjustmentAmount = -10;
        } else if (correction.user_label === 'CONFIRMED_THREAT') {
            // User says it's a threat → increase confidence
            adjustmentAmount = +10;
        } else {
            // User is unsure → no adjustment, just mark as reviewed
            adjustmentAmount = 0;
        }

        // 4. Update patterns mentioned in matched_patterns
        const adjustmentLogs = [];

        if (correction.matched_patterns && Array.isArray(correction.matched_patterns) && adjustmentAmount !== 0) {
            for (const pattern of correction.matched_patterns) {
                if (pattern.id) {
                    // Fetch current pattern
                    const { data: phraseData, error: phraseError } = await supabase
                        .from('phrase')
                        .select('severity_weight')
                        .eq('id', pattern.id)
                        .single();

                    if (phraseError) {
                        console.error(`Failed to fetch phrase ${pattern.id}:`, phraseError);
                        continue; // Skip this pattern but continue processing others
                    }

                    if (phraseData) {
                        const oldWeight = phraseData.severity_weight;
                        // Clamp new weight between 10 and 100
                        const newWeight = Math.max(10, Math.min(100, oldWeight + adjustmentAmount));

                        // Only update if weight actually changed
                        if (newWeight !== oldWeight) {
                            // Update pattern
                            const { error: updateError } = await supabase
                                .from('phrase')
                                .update({ severity_weight: newWeight })
                                .eq('id', pattern.id);

                            if (updateError) {
                                console.error(`Failed to update phrase ${pattern.id}:`, updateError);
                                continue;
                            }

                            // Log adjustment
                            const { error: logError } = await supabase
                                .from('pattern_adjustments')
                                .insert({
                                    phrase_id: pattern.id,
                                    correction_id: correctionId,
                                    old_weight: oldWeight,
                                    new_weight: newWeight,
                                    adjustment_reason: `Admin approved correction: ${correction.user_label}. ${correction.user_comment || ''}`,
                                    adjusted_by: adminUserId
                                });

                            if (logError) {
                                console.error(`Failed to log adjustment for phrase ${pattern.id}:`, logError);
                            } else {
                                adjustmentLogs.push({
                                    phrase_id: pattern.id,
                                    phrase: pattern.phrase,
                                    old_weight: oldWeight,
                                    new_weight: newWeight
                                });
                            }
                        }
                    }
                }
            }
        }

        // 5. Mark correction as approved
        const { error: approveError } = await supabase
            .from('sa_corrections')
            .update({
                review_status: 'approved',
                reviewed_by: adminUserId,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', correctionId);

        if (approveError) {
            throw new Error(`Failed to update correction status: ${approveError.message}`);
        }

        // 6. Return success response
        return new Response(
            JSON.stringify({
                success: true,
                message: 'Pattern adjusted successfully',
                adjustments: adjustmentLogs,
                adjustment_count: adjustmentLogs.length
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );

    } catch (error) {
        console.error('Error in approve-correction function:', error);

        return new Response(
            JSON.stringify({
                error: error.message || 'Internal server error',
                details: error.toString()
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});
