import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

// Helper to copy manifest.json
const copyManifest = () => {
    return {
        name: 'copy-manifest',
        closeBundle: () => {
            const rootDir = __dirname;
            fs.copyFileSync(resolve(rootDir, 'manifest.json'), resolve(rootDir, 'dist/manifest.json'));
            // Copy icons if they exist
            if (fs.existsSync(resolve(rootDir, 'icons'))) {
                fs.cpSync(resolve(rootDir, 'icons'), resolve(rootDir, 'dist/icons'), { recursive: true });
            }
            // Copy Core Extension Scripts (Background, Content, Libs)
            // Manifest and icons are handled below.
            // Core scripts are now bundled via rollupOptions.input.
            // Copy services/libs that might be needed by background script if not bundled
            // But for now, we assume background script is handled separately or we bundle it here?
            // The current project has a 'node build/build.js' which does manual bundling.
            // We should probably rely on this vite config to replace that eventualy, 
            // OR make this vite config ONLY for the UI parts (popup/options).
            // Let's make this ONLY for UI parts to start, and keep existing build process for background if needed,
            // OR migrate everything. The plan said "specialized build for extension".
        }
    };
};

export default defineConfig({
    plugins: [react(), copyManifest()],
    define: {
        '__APP_VERSION__': JSON.stringify(process.env.npm_package_version),
    },
    base: './',
    root: 'src/ui',
    build: {
        outDir: '../../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                popup: resolve(__dirname, 'src/ui/popup/index.html'),
                options: resolve(__dirname, 'src/ui/options/index.html'),
                serviceWorker: resolve(__dirname, 'src/background/service-worker.js')
            },
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]',
                format: 'es'
            },
        },
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src/ui'),
        },
    },
});
