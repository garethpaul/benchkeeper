import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { posix } from 'node:path';
export default defineConfig({
  plugins: [
    {
      name: 'deny-private-work-paths',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          let path = (request.url ?? '/').split('?')[0];
          try {
            // Reject before Vite's asset/import transforms, including encoded
            // separators and ?import module wrappers that fs.deny doesn't reject.
            path = decodeURIComponent(decodeURIComponent(path));
          } catch {
            response.statusCode = 400;
            response.end('Invalid URL');
            return;
          }
          path = posix.normalize(path.replaceAll('\\', '/'));
          if (
            path === '/work' ||
            path.startsWith('/work/') ||
            (path.startsWith('/@fs/') && path.includes('/work/'))
          ) {
            response.statusCode = 403;
            response.end('Private project work files are not served.');
            return;
          }
          next();
        });
      }
    },
    react()
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Vite otherwise serves arbitrary files below its project root. The work
    // directory includes intentionally private material and must never be HTTP
    // accessible, even to a loopback browser or through /@fs/ paths.
    fs: {
      strict: true,
      allow: [process.cwd()],
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/work/**']
    }
  },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true }
});
