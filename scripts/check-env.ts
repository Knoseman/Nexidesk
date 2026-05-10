import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

console.log('R2_BUCKET value:', process.env.R2_BUCKET);
console.log('R2_ENDPOINT value:', process.env.R2_ENDPOINT);
