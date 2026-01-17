#!/usr/bin/env node
/**
 * KnowShowGo Debug Daemon
 * 
 * Runs continuous health checks and tests against mock and live backends.
 * Logs all results for debugging and monitoring.
 * 
 * Usage:
 *   node scripts/debug-daemon.js                    # Mock mode only
 *   node scripts/debug-daemon.js --live             # Include live tests
 *   node scripts/debug-daemon.js --once             # Run once and exit
 *   node scripts/debug-daemon.js --interval 30000  # Custom interval (ms)
 * 
 * Logs written to: logs/debug-daemon.log
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT_DIR, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'debug-daemon.log');
const HEALTH_LOG = path.join(LOG_DIR, 'health-checks.log');
const TEST_LOG = path.join(LOG_DIR, 'test-results.log');

// Parse CLI args
const args = process.argv.slice(2);
const LIVE_MODE = args.includes('--live');
const ONCE_MODE = args.includes('--once');
const intervalIdx = args.indexOf('--interval');
const INTERVAL = intervalIdx >= 0 ? parseInt(args[intervalIdx + 1], 10) : 60000;

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function timestamp() {
  return new Date().toISOString();
}

function log(message, file = LOG_FILE) {
  const line = `[${timestamp()}] ${message}`;
  console.log(line);
  fs.appendFileSync(file, line + '\n');
}

function logJson(data, file) {
  const line = `[${timestamp()}] ${JSON.stringify(data)}`;
  fs.appendFileSync(file, line + '\n');
}

/**
 * Check health of local server
 */
async function checkHealth(baseUrl = 'http://localhost:3000') {
  const result = {
    timestamp: timestamp(),
    url: baseUrl,
    status: 'unknown',
    response: null,
    latencyMs: 0,
    error: null
  };

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    
    result.latencyMs = Date.now() - start;
    result.status = res.ok ? 'healthy' : 'unhealthy';
    result.response = await res.json();
  } catch (err) {
    result.latencyMs = Date.now() - start;
    result.status = 'unreachable';
    result.error = err.message;
  }

  logJson(result, HEALTH_LOG);
  return result;
}

/**
 * Run tests and capture output
 */
function runTests(testLive = false) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    if (testLive) {
      env.TEST_LIVE = 'true';
    }

    const result = {
      timestamp: timestamp(),
      mode: testLive ? 'live' : 'mock',
      passed: 0,
      failed: 0,
      total: 0,
      duration: 0,
      output: '',
      error: null
    };

    const start = Date.now();
    const child = spawn('npm', ['test', '--', '--testPathPattern=tests/integration'], {
      cwd: ROOT_DIR,
      env,
      shell: true
    });

    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    child.stderr.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      result.duration = Date.now() - start;
      result.output = output;
      
      // Parse test results
      const passMatch = output.match(/Tests:\s+(\d+)\s+passed/);
      const failMatch = output.match(/(\d+)\s+failed/);
      const totalMatch = output.match(/Tests:\s+(?:\d+\s+\w+,\s+)*(\d+)\s+total/);
      
      if (passMatch) result.passed = parseInt(passMatch[1], 10);
      if (failMatch) result.failed = parseInt(failMatch[1], 10);
      if (totalMatch) result.total = parseInt(totalMatch[1], 10);
      
      if (code !== 0 && result.failed === 0) {
        result.error = `Process exited with code ${code}`;
      }

      // Log summary (not full output)
      const summary = {
        ...result,
        output: `[${result.output.length} chars - see full log]`
      };
      logJson(summary, TEST_LOG);
      
      resolve(result);
    });
  });
}

/**
 * Run a single iteration of checks
 */
async function runIteration() {
  log('=== Starting debug iteration ===');

  // Health check
  log('Checking health...');
  const health = await checkHealth();
  log(`Health: ${health.status} (${health.latencyMs}ms)`);

  // Mock tests
  log('Running mock tests...');
  const mockResults = await runTests(false);
  log(`Mock tests: ${mockResults.passed}/${mockResults.total} passed (${mockResults.duration}ms)`);

  if (mockResults.failed > 0) {
    log(`WARNING: ${mockResults.failed} mock tests failed!`, LOG_FILE);
  }

  // Live tests (if enabled)
  if (LIVE_MODE) {
    log('Running live tests...');
    const liveResults = await runTests(true);
    log(`Live tests: ${liveResults.passed}/${liveResults.total} passed (${liveResults.duration}ms)`);
    
    if (liveResults.failed > 0) {
      log(`WARNING: ${liveResults.failed} live tests failed!`, LOG_FILE);
    }
  }

  log('=== Iteration complete ===\n');

  return {
    health,
    mockPassed: mockResults.passed,
    mockFailed: mockResults.failed,
    livePassed: LIVE_MODE ? mockResults.passed : null,
    liveFailed: LIVE_MODE ? mockResults.failed : null
  };
}

/**
 * Main daemon loop
 */
async function main() {
  log('========================================');
  log('KnowShowGo Debug Daemon Starting');
  log(`Mode: ${LIVE_MODE ? 'Mock + Live' : 'Mock only'}`);
  log(`Interval: ${ONCE_MODE ? 'Single run' : `${INTERVAL}ms`}`);
  log(`Logs: ${LOG_DIR}`);
  log('========================================\n');

  if (ONCE_MODE) {
    await runIteration();
    log('Single run complete. Exiting.');
    process.exit(0);
  }

  // Initial run
  await runIteration();

  // Schedule periodic runs
  setInterval(async () => {
    await runIteration();
  }, INTERVAL);

  log(`Daemon running. Press Ctrl+C to stop.`);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\nShutting down debug daemon...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\nShutting down debug daemon...');
  process.exit(0);
});

main().catch((err) => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
