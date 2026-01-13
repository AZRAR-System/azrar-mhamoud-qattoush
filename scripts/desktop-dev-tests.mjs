import { spawn } from 'node:child_process';

// Runs Desktop dev mode with integration-test data enabled.
// This avoids relying on shell-specific env syntax (cmd/powershell).

const env = {
  ...process.env,
  VITE_ENABLE_INTEGRATION_TEST_DATA: 'true',
};

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node scripts/desktop-dev-tests.mjs [--print]');
  console.log('Runs: npm run desktop:dev with VITE_ENABLE_INTEGRATION_TEST_DATA=true');
  console.log('Options:');
  console.log('  --autorun   Automatically open System Maintenance and run tests');
  process.exit(0);
}

if (args.includes('--print')) {
  console.log('Will run: npm run desktop:dev');
  console.log('With env: VITE_ENABLE_INTEGRATION_TEST_DATA=true');
  if (args.includes('--autorun')) {
    console.log('Plus env: VITE_AUTORUN_SYSTEM_TESTS=true');
  }
  process.exit(0);
}

if (args.includes('--autorun')) {
  env.VITE_AUTORUN_SYSTEM_TESTS = 'true';
}

const child = spawn('npm run desktop:dev', {
  stdio: 'inherit',
  env,
  shell: true,
});

child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
