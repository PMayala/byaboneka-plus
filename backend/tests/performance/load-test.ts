// ============================================
// PERFORMANCE / LOAD TEST
// Run: npx ts-node tests/performance/load-test.ts
//
// Tests the API against the NFR requirement:
//   "Page load under 3 seconds on 3G connection"
//   "Support 100+ simultaneous users"
// ============================================

const BASE_URL = process.env.API_URL || 'http://localhost:4000/api/v1';

interface TestResult {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  success: boolean;
}

interface LoadTestSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  requestsPerSecond: number;
  passesNFR: boolean;
}

async function makeRequest(
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<TestResult> {
  const url = `${BASE_URL}${path}`;
  const start = performance.now();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const elapsed = performance.now() - start;

    return {
      endpoint: `${method} ${path}`,
      method,
      statusCode: response.status,
      responseTime: elapsed,
      success: response.status < 500,
    };
  } catch (error: any) {
    const elapsed = performance.now() - start;
    return {
      endpoint: `${method} ${path}`,
      method,
      statusCode: 0,
      responseTime: elapsed,
      success: false,
    };
  }
}

function calculateSummary(results: TestResult[], durationMs: number): LoadTestSummary {
  const responseTimes = results.map(r => r.responseTime).sort((a, b) => a - b);
  const successful = results.filter(r => r.success).length;
  const p95Index = Math.floor(responseTimes.length * 0.95);

  return {
    totalRequests: results.length,
    successfulRequests: successful,
    failedRequests: results.length - successful,
    avgResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
    p95ResponseTime: Math.round(responseTimes[p95Index] || 0),
    maxResponseTime: Math.round(responseTimes[responseTimes.length - 1] || 0),
    minResponseTime: Math.round(responseTimes[0] || 0),
    requestsPerSecond: Math.round((results.length / durationMs) * 1000 * 10) / 10,
    passesNFR: responseTimes[p95Index] < 3000, // NFR: under 3 seconds
  };
}

// ============================================
// TEST SCENARIOS
// ============================================

async function testHealthEndpoint(): Promise<TestResult[]> {
  console.log('\n📡 Test 1: Health endpoint baseline...');
  const results: TestResult[] = [];

  for (let i = 0; i < 20; i++) {
    results.push(await makeRequest('GET', '/health'));
  }

  return results;
}

async function testPublicEndpoints(): Promise<TestResult[]> {
  console.log('🔍 Test 2: Public search endpoints (no auth)...');
  const results: TestResult[] = [];
  const endpoints = [
    '/lost-items?page=1&limit=10',
    '/found-items?page=1&limit=10',
    '/lost-items?category=PHONE&page=1',
    '/found-items?location_area=Kigali&page=1',
    '/lost-items?keyword=phone&page=1',
  ];

  for (const endpoint of endpoints) {
    for (let i = 0; i < 10; i++) {
      results.push(await makeRequest('GET', endpoint));
    }
  }

  return results;
}

async function testConcurrentLoad(concurrency: number): Promise<TestResult[]> {
  console.log(`⚡ Test 3: Concurrent load (${concurrency} simultaneous requests)...`);

  const promises: Promise<TestResult>[] = [];
  for (let i = 0; i < concurrency; i++) {
    const endpoint = i % 2 === 0 ? '/lost-items?page=1&limit=10' : '/found-items?page=1&limit=10';
    promises.push(makeRequest('GET', endpoint));
  }

  return Promise.all(promises);
}

async function testAuthFlow(): Promise<TestResult[]> {
  console.log('🔐 Test 4: Authentication flow...');
  const results: TestResult[] = [];

  // Register (will fail if user exists, that's fine — we test response time)
  for (let i = 0; i < 5; i++) {
    results.push(
      await makeRequest('POST', '/auth/login', {
        email: `loadtest${i}@test.com`,
        password: 'TestPassword123!',
      })
    );
  }

  return results;
}

async function testSearchWithFilters(): Promise<TestResult[]> {
  console.log('🔎 Test 5: Search with various filter combinations...');
  const results: TestResult[] = [];
  const categories = ['PHONE', 'ID', 'WALLET', 'BAG', 'KEYS', 'OTHER'];
  const locations = ['Kigali', 'Nyabugogo', 'Kimironko', 'Remera', 'Kicukiro'];

  for (const cat of categories) {
    results.push(await makeRequest('GET', `/lost-items?category=${cat}&page=1&limit=10`));
    results.push(await makeRequest('GET', `/found-items?category=${cat}&page=1&limit=10`));
  }

  for (const loc of locations) {
    results.push(await makeRequest('GET', `/lost-items?location_area=${loc}&page=1`));
  }

  return results;
}

// ============================================
// MAIN EXECUTION
// ============================================

async function runLoadTest() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   Byaboneka+ Performance / Load Test         ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log(`Target: ${BASE_URL}`);
  console.log(`NFR requirement: p95 response time < 3000ms`);

  const allResults: TestResult[] = [];
  const startTime = performance.now();

  // Run test suites
  allResults.push(...await testHealthEndpoint());
  allResults.push(...await testPublicEndpoints());
  allResults.push(...await testConcurrentLoad(50));
  allResults.push(...await testConcurrentLoad(100));
  allResults.push(...await testAuthFlow());
  allResults.push(...await testSearchWithFilters());

  const totalDuration = performance.now() - startTime;
  const summary = calculateSummary(allResults, totalDuration);

  // Print results
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   RESULTS                                     ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log(`  Total requests:      ${summary.totalRequests}`);
  console.log(`  Successful:          ${summary.successfulRequests} (${Math.round(summary.successfulRequests / summary.totalRequests * 100)}%)`);
  console.log(`  Failed:              ${summary.failedRequests}`);
  console.log(`  Avg response time:   ${summary.avgResponseTime}ms`);
  console.log(`  P95 response time:   ${summary.p95ResponseTime}ms`);
  console.log(`  Min response time:   ${summary.minResponseTime}ms`);
  console.log(`  Max response time:   ${summary.maxResponseTime}ms`);
  console.log(`  Requests/sec:        ${summary.requestsPerSecond}`);
  console.log(`  Total duration:      ${Math.round(totalDuration)}ms`);
  console.log('');
  console.log(`  NFR (p95 < 3000ms):  ${summary.passesNFR ? '✅ PASS' : '❌ FAIL'}`);

  // Per-endpoint breakdown
  console.log('\n  Per-endpoint breakdown:');
  const byEndpoint = new Map<string, number[]>();
  for (const r of allResults) {
    const key = r.endpoint.split('?')[0];
    if (!byEndpoint.has(key)) byEndpoint.set(key, []);
    byEndpoint.get(key)!.push(r.responseTime);
  }
  for (const [endpoint, times] of byEndpoint) {
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const max = Math.round(Math.max(...times));
    console.log(`    ${endpoint.padEnd(40)} avg: ${avg}ms  max: ${max}ms  n: ${times.length}`);
  }

  // Exit code
  process.exit(summary.passesNFR ? 0 : 1);
}

runLoadTest().catch((err) => {
  console.error('Load test crashed:', err);
  process.exit(1);
});
