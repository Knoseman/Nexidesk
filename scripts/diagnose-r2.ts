import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { r2Configured, r2Put } from "../src/lib/r2";

async function diagnose() {
  console.log("--- R2 Diagnosis ---");
  console.log("R2_ACCOUNT_ID:", process.env.R2_ACCOUNT_ID ? "SET" : "MISSING");
  console.log(
    "R2_ACCESS_KEY_ID:",
    process.env.R2_ACCESS_KEY_ID ? "SET" : "MISSING",
  );
  console.log(
    "R2_SECRET_ACCESS_KEY:",
    process.env.R2_SECRET_ACCESS_KEY ? "SET" : "MISSING",
  );
  console.log("R2_BUCKET:", process.env.R2_BUCKET ? "SET" : "MISSING");
  console.log("R2_ENDPOINT:", process.env.R2_ENDPOINT ? "SET" : "MISSING");

  const configured = !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  );
  console.log("Configured (inline check):", configured);
  console.log("r2Configured() from lib:", r2Configured());

  if (!configured) {
    console.log("Error: R2 is not fully configured in .env.local.");
    return;
  }

  console.log("\nAttempting test upload to R2...");
  try {
    const testKey = `test-${Date.now()}.txt`;
    const testBody = Buffer.from("Nexidesk R2 Connection Test");
    await r2Put(testKey, testBody, "text/plain");
    console.log("SUCCESS: Test upload completed!");
    console.log("Key:", testKey);
  } catch (err: any) {
    console.log("FAILURE: Test upload failed.");
    if (err.name) console.log("Error Name:", err.name);
    if (err.message) console.log("Error Message:", err.message);
    if (err.$metadata)
      console.log("Status Code:", err.$metadata.httpStatusCode);
    console.error(err);
  }
}

diagnose();
