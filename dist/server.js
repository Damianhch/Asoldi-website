/**
 * Hostinger Express "Default" may treat `dist/` as compiled server output
 * (TypeScript preset: entry dist/server.js). The SPA lives in ../web/.
 * This file only starts the real Express app at the repo root.
 */
import '../server.js';
