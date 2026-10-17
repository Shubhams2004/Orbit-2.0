import fs from 'fs';
import path from 'path';

interface CheckResult {
  category: string;
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  message: string;
}

const results: CheckResult[] = [];

function record(category: string, name: string, status: 'PASS' | 'WARN' | 'FAIL', message: string) {
  results.push({ category, name, status, message });
}

console.log('='.repeat(70));
console.log('  ORBIT 2.0 - CLOUDFLARE WORKERS DEPLOYMENT READINESS CHECK');
console.log('='.repeat(70));

// 1. Check wrangler.jsonc
const wranglerPath = path.resolve('wrangler.jsonc');
if (!fs.existsSync(wranglerPath)) {
  record('Configuration', 'wrangler.jsonc exists', 'FAIL', 'wrangler.jsonc not found in root.');
} else {
  record('Configuration', 'wrangler.jsonc exists', 'PASS', 'Configuration file found.');
  try {
    const rawContent = fs.readFileSync(wranglerPath, 'utf8');
    // Strip comments for JSON parsing
    const cleanJson = rawContent
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');
    const config = JSON.parse(cleanJson);

    // Verify main worker entry
    if (config.main === 'worker/index.ts') {
      record('Configuration', 'Worker Entry Point', 'PASS', 'main points to worker/index.ts');
    } else {
      record('Configuration', 'Worker Entry Point', 'WARN', `main is set to ${config.main}`);
    }

    // Verify Static Assets configuration
    if (config.assets && config.assets.directory === './dist') {
      record('Configuration', 'Static Assets Binding', 'PASS', 'assets configured with directory ./dist');
    } else {
      record('Configuration', 'Static Assets Binding', 'FAIL', 'Missing or misconfigured assets.directory in wrangler.jsonc');
    }

    if (config.assets && config.assets.not_found_handling === 'single-page-application') {
      record('Configuration', 'SPA Fallback Routing', 'PASS', 'not_found_handling set to single-page-application');
    } else {
      record('Configuration', 'SPA Fallback Routing', 'WARN', 'Consider setting not_found_handling: "single-page-application"');
    }

    // Verify D1 binding
    const d1List = config.d1_databases || [];
    const mainDb = d1List.find((db: { binding: string }) => db.binding === 'DB');
    if (!mainDb) {
      record(
        'Database',
        'D1 Binding "DB"',
        'WARN',
        'd1_databases entry is not currently active in wrangler.jsonc. Bind "DB" via Cloudflare Dashboard (Settings > Bindings > D1) or uncomment in wrangler.jsonc after running "npm run db:create".'
      );
    } else {
      record('Database', 'D1 Binding "DB"', 'PASS', `Found D1 binding '${mainDb.binding}' (${mainDb.database_name})`);
      if (mainDb.database_id.includes('<YOUR_') || mainDb.database_id === '00000000-0000-0000-0000-000000000000') {
        record(
          'Database',
          'Production D1 Database ID',
          'WARN',
          `database_id has placeholder (${mainDb.database_id}). Run 'npm run db:create' and update wrangler.jsonc before live production deploy.`
        );
      } else {
        record('Database', 'Production D1 Database ID', 'PASS', `Configured with ID: ${mainDb.database_id}`);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    record('Configuration', 'Parse wrangler.jsonc', 'FAIL', `Failed to parse wrangler.jsonc: ${msg}`);
  }
}

// 2. Check Migrations
const migrationsDir = path.resolve('migrations');
if (!fs.existsSync(migrationsDir)) {
  record('Database', 'Migrations Directory', 'FAIL', 'Directory /migrations does not exist.');
} else {
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    record('Database', 'Migration Files', 'FAIL', 'No .sql migration files found.');
  } else {
    record('Database', 'Migration Files', 'PASS', `Found ${files.length} migration(s): ${files.join(', ')}`);
    // Check initial schema tables
    const initSql = fs.readFileSync(path.join(migrationsDir, files[0]), 'utf8');
    const hasUsers = initSql.includes('CREATE TABLE IF NOT EXISTS users');
    const hasTasks = initSql.includes('CREATE TABLE IF NOT EXISTS tasks');
    const hasProjects = initSql.includes('CREATE TABLE IF NOT EXISTS projects');
    const hasConversations = initSql.includes('CREATE TABLE IF NOT EXISTS conversations');
    if (hasUsers && hasTasks && hasProjects && hasConversations) {
      record('Database', 'Schema Integrity', 'PASS', 'Schema contains users, tasks, projects, conversations, messages, agent_runs');
    } else {
      record('Database', 'Schema Integrity', 'WARN', 'Initial migration missing expected core tables');
    }
  }
}

// 3. Check Frontend Build Output
const distPath = path.resolve('dist');
if (fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'))) {
  record('Frontend', 'Production Assets (dist)', 'PASS', 'dist/ and dist/index.html are present');
} else {
  record('Frontend', 'Production Assets (dist)', 'WARN', 'dist/ not built yet. Run "npm run build" before deploying.');
}

// 4. Print Summary
console.log('');
let passCount = 0;
let warnCount = 0;
let failCount = 0;

results.forEach(r => {
  const icon = r.status === 'PASS' ? '✅ PASS' : r.status === 'WARN' ? '⚠️  WARN' : '❌ FAIL';
  console.log(`[${r.category}] ${icon} - ${r.name}: ${r.message}`);
  if (r.status === 'PASS') passCount++;
  if (r.status === 'WARN') warnCount++;
  if (r.status === 'FAIL') failCount++;
});

console.log('');
console.log('-'.repeat(70));
console.log(`Summary: ${passCount} Passed, ${warnCount} Warnings, ${failCount} Failed`);
console.log('-'.repeat(70));

if (failCount > 0) {
  console.error('\nDeployment readiness check failed. Please resolve the errors above.');
  process.exit(1);
} else {
  console.log('\nReady for deployment! Follow the steps in DEPLOYMENT.md.');
  process.exit(0);
}
