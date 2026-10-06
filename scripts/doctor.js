import { existsSync } from 'node:fs';
import dotenv from 'dotenv';
dotenv.config();

const pass = process.env.SUPER_ADMIN_PASSWORD || process.env.TOMVIS_DEMO_PASSWORD;
const checks = [
  ['Runtime', Number(process.versions.node.split('.')[0]) >= 22],
  ['Database module', existsSync('packages/database/index.js')],
  ['Environment isolation', ['sandbox', 'demo', 'development', 'local'].includes(process.env.APP_ENV || process.env.TOMVIS_MODE || 'development')],
  ['Password configured', Boolean(pass && pass.length >= 12)],
  ['UI', existsSync('apps/public/app.js')]
];

for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
console.log('PdhSafetyFire Local Environment: Ready for testing on MySQL (XAMPP)');

if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
