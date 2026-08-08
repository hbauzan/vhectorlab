/**
 * Canonical GROUP_it_core corpus for Galaxy VIEW (exactly 100 unique EN IT tokens).
 * Do not silently grow — tests assert length + uniqueness.
 */

/** @type {readonly string[]} */
export const IT_CORE_TOKENS = Object.freeze([
  'server', 'client', 'api', 'endpoint', 'database', 'sql', 'nosql', 'cache', 'redis', 'kafka',
  'queue', 'microservice', 'container', 'docker', 'kubernetes', 'devops', 'cicd', 'pipeline',
  'repository', 'git', 'commit', 'branch', 'merge', 'frontend', 'backend', 'javascript',
  'typescript', 'python', 'rust', 'golang', 'java', 'react', 'vue', 'angular', 'nodejs',
  'fastapi', 'django', 'flask', 'graphql', 'rest', 'json', 'protobuf', 'grpc', 'websocket',
  'http', 'https', 'oauth', 'jwt', 'auth', 'latency', 'throughput', 'loadbalancer', 'nginx',
  'cdn', 'dns', 'ssl', 'tls', 'certificate', 'firewall', 'vpn', 'cloud', 'aws', 'gcp', 'azure',
  'lambda', 'serverless', 'terraform', 'ansible', 'monitoring', 'logging', 'metrics',
  'tracing', 'prometheus', 'grafana', 'opentelemetry', 'unittest', 'integration', 'e2e',
  'agile', 'scrum', 'sprint', 'backlog', 'kanban', 'architecture', 'modularity', 'refactor',
  'debugging', 'profiling', 'optimization', 'concurrency', 'async', 'thread', 'process',
  'memory', 'cpu', 'gpu', 'storage', 'network', 'protocol', 'encryption',
]);

export const IT_CORE_GROUP_ID = 'GROUP_it_core';

/**
 * Textarea line for the IT galactic core group.
 * @returns {string}
 */
export function formatItCoreGroupLine() {
  return `${IT_CORE_GROUP_ID} = "${IT_CORE_TOKENS.join(', ')}"`;
}

/**
 * @returns {{ length: number, unique: boolean, tokens: readonly string[] }}
 */
export function assertItCoreCorpus() {
  const length = IT_CORE_TOKENS.length;
  const unique = new Set(IT_CORE_TOKENS).size === length;
  return { length, unique, tokens: IT_CORE_TOKENS };
}
