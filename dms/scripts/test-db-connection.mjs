import { Pool } from "@neondatabase/serverless";

async function testConnection(label, envVarName) {
  const connectionString = process.env[envVarName];
  if (!connectionString) {
    console.error(`❌ ${label}: ${envVarName} is not set in .env`);
    return false;
  }

  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query("SELECT NOW() AS current_time");
    console.log(`✅ ${label}: Connected! Database says the time is:`, result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error(`❌ ${label}: Connection failed:`, error.message);
    return false;
  } finally {
    await pool.end();
  }
}

const pooledOk = await testConnection("DATABASE_URL (pooled)", "DATABASE_URL");
const directOk = await testConnection("DIRECT_DATABASE_URL (direct, used by migrations)", "DIRECT_DATABASE_URL");

if (!pooledOk || !directOk) {
  process.exit(1);
}