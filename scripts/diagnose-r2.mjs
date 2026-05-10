import 'dotenv/config';
import { r2Configured, r2Put } from './src/lib/r2.js';

async function diagnose() {
  console.log('--- R2 Diagnosis ---');
  console.log('R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID ? 'SET' : 'MISSING');
  console.log('R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? 'SET' : 'MISSING');
  console.log('R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? 'SET' : 'MISSING');
  console.log('R2_BUCKET:', process.env.R2_BUCKET ? 'SET' : 'MISSING');
  console.log('R2_ENDPOINT:', process.env.R2_ENDPOINT ? 'SET' : 'MISSING');
  console.log('r2Configured():', r2Configured());

  if (!r2Configured()) {
    console.log('Error: R2 is not fully configured.');
    return;
  }

  console.log('\nAttempting test upload to R2...');
  try {
    const testKey = `test-${Date.now()}.txt`;
    const testBody = Buffer.from('Nexidesk R2 Connection Test');
    await r2Put(testKey, testBody, 'text/plain');
    console.log('SUCCESS: Test upload completed!');
    console.log('Key:', testKey);
  } catch (err) {
    console.log('FAILURE: Test upload failed.');
    console.error(err);
  }
}

diagnose();
