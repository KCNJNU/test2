import { resolve } from 'node:path';

// This file is compiled at the API dist root, so the same traversal works from
// both apps/api/src and apps/api/dist regardless of the npm working directory.
export const ROOT_ENV_FILE = resolve(__dirname, '..', '..', '..', '.env');
