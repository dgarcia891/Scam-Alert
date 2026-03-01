
import { jest } from '@jest/globals';

// Define mocks first
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();

// Silence console error for clean test runs (Expected in error tests)
jest.spyOn(console, 'error').mockImplementation(() => { });


const mockFrom = jest.fn(() => ({
    insert: mockInsert,
    select: mockSelect
}));

// Mock chaining setup
mockSelect.mockReturnValue({
    eq: mockEq
});
mockEq.mockReturnValue({
    order: mockOrder
});
mockOrder.mockReturnValue({
    limit: mockLimit
});

// ESM Mocking must happen before import
jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: () => ({
        from: mockFrom
    })
}));

describe('Supabase Service', () => {
    let submitReport;

    beforeAll(async () => {
        // Dynamic import after mock is established
        const module = await import('../../extension/src/lib/supabase.js');
        submitReport = module.submitReport;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('submitReport', () => {
        it('should submit a report successfully', async () => {
            const mockData = [{ id: '123' }];

            // Adjust mock for: .insert -> returns object with .select
            // The client code does: await supabase.from(...).insert(...).select()
            const mockBuilder = {
                select: jest.fn().mockResolvedValue({ data: mockData, error: null })
            };
            mockInsert.mockReturnValue(mockBuilder);

            const result = await submitReport('https://scam.com', 'phishing', 'Bad site');

            // Verify table name
            expect(mockFrom).toHaveBeenCalledWith('reported_scams');

            // Verify payload
            // Note: We check that the first argument to insert contains our data
            expect(mockInsert).toHaveBeenCalledWith([expect.objectContaining({
                url: 'https://scam.com',
                scam_type: 'phishing',
                description: 'Bad site',
                status: 'pending'
            })]);

            // Verify function return
            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockData);
        });

        it('should handle submission errors', async () => {
            const mockBuilder = {
                select: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } })
            };
            mockInsert.mockReturnValue(mockBuilder);

            const result = await submitReport('https://scam.com', 'phishing');

            expect(result.success).toBe(false);
            expect(result.error).toBe('DB Error');
        });
    });
});
