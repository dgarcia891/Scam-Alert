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
            const manifestPath = resolve(rootDir, 'manifest.json');
            const distManifestPath = resolve(rootDir, 'dist/manifest.json');

            if (fs.existsSync(manifestPath)) {
                let manifest = fs.readFileSync(manifestPath, 'utf8');
                // Strip "dist/" from paths for the distribution manifest
                manifest = manifest.replace(/"dist\//g, '"');
                fs.writeFileSync(distManifestPath, manifest);
                console.log(' ✅ Manifest transformed and copied to dist/');
            }

            // Copy icons if they exist
            if (fs.existsSync(resolve(rootDir, 'icons'))) {
                fs.cpSync(resolve(rootDir, 'icons'), resolve(rootDir, 'dist/icons'), { recursive: true });
            }
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
        modulePreload: { polyfill: false }, // BUG-135: Reduce polyfill injection (post-build strips remainder)
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
