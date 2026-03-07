import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: process.env.VITE_ENTRY,
            name: 'HydraGuardContent',
            formats: ['iife'],
            fileName: () => `assets/${process.env.VITE_OUT}.js`
        },
        outDir: 'dist',
        emptyOutDir: false,
    },
});
