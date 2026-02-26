const SENSITIVE_KEYS = [
  'authorization',
  'cookie',
  'token',
  'secret',
  'password',
  'apiKey',
  'clientSecret',
];

function sanitizeValue(key, value) {
  const normalized = String(key || '').toLowerCase();
  const isSensitive = SENSITIVE_KEYS.some((k) => normalized.includes(k.toLowerCase()));

  if (!isSensitive) return value;
  if (value === undefined || value === null) return value;

  return '[REDACTED]';
}

function sanitizeObject(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeObject(item));
  }

  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (value && typeof value === 'object') {
      acc[key] = sanitizeObject(value);
      return acc;
    }

    acc[key] = sanitizeValue(key, value);
    return acc;
  }, {});
}

function safeLog(level, message, payload = {}) {
  const event = {
    level,
    message,
    payload: sanitizeObject(payload),
    timestamp: new Date().toISOString(),
  };

  // Never log process.env or secret file paths.
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

module.exports = {
  safeLog,
  sanitizeObject,
};
