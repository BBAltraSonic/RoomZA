---
name: logging-best-practices
description: Use when implementing or improving logging in the application. Covers structured logging with Winston, request context propagation via AsyncLocalStorage, PII sanitization, log levels, and production best practices. Apply when adding new log statements, setting up a logger, debugging via logs, or auditing existing logging code for security or quality issues.
---

# Logging Best Practices

Implement secure, structured logging with proper levels and context.

## Log Levels

| Level | Use For | Production |
|-------|---------|------------|
| DEBUG | Detailed debugging | Off |
| INFO | Normal operations | On |
| WARN | Potential issues | On |
| ERROR | Errors with recovery | On |
| FATAL | Critical failures | On |

Set via `process.env.LOG_LEVEL`. Default to `'info'` in production.

## Structured Logging (Winston)

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'api-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' })
  ]
});

// Usage
logger.info('User logged in', { userId: '123', ip: '192.168.1.1' });
logger.error('Payment failed', { error: err.message, orderId: '456' });
```

## Request Context (Correlation IDs)

Use `AsyncLocalStorage` to propagate request context across async boundaries without threading it through every function:

```javascript
const { AsyncLocalStorage } = require('async_hooks');
const { v4: uuid } = require('uuid');
const storage = new AsyncLocalStorage();

// Middleware: bind context to each request
app.use((req, res, next) => {
  const context = {
    requestId: req.headers['x-request-id'] || uuid(),
    userId: req.user?.id
  };
  storage.run(context, next);
});

// Logging helper: always includes context automatically
function log(level, message, meta = {}) {
  const context = storage.getStore() || {};
  logger.log(level, message, { ...context, ...meta });
}
```

Always include `requestId` in every log entry to correlate logs across services.

## PII Sanitization

**Sanitize before logging — never after.**

```javascript
const sensitiveFields = ['password', 'ssn', 'creditCard', 'token', 'secret', 'apiKey'];

function sanitize(obj) {
  const sanitized = { ...obj };
  for (const field of sensitiveFields) {
    if (sanitized[field]) sanitized[field] = '[REDACTED]';
  }
  if (sanitized.email) {
    sanitized.email = sanitized.email.replace(/(.{2}).*@/, '$1***@');
  }
  return sanitized;
}

// Always sanitize user-provided data before logging
logger.info('Profile updated', sanitize(req.body));
```

## Best Practices

- **Use structured JSON** — never free-form strings; makes log parsing and querying reliable
- **Include correlation IDs** across all services for distributed tracing
- **Sanitize all PII** before logging — passwords, tokens, emails, SSNs, card numbers
- **Use async logging** — don't block the event loop writing logs synchronously
- **Implement log rotation** — use `winston-daily-rotate-file` or a sidecar log agent
- **Never log at DEBUG in production** — `LOG_LEVEL=info` by default

## Never Do

- Log passwords, tokens, or API keys (even hashed)
- Use `console.log` in production code — use the structured logger
- Log inside tight loops — aggregate and log summaries instead
- Include stack traces for client errors (4xx) — only for server errors (5xx)
- Log entire request/response bodies without sanitizing

## Additional Implementations

See [references/advanced-logging.md](references/advanced-logging.md) for:
- Python `structlog` setup
- Go `zap` high-performance logging
- ELK Stack integration
- AWS CloudWatch configuration
- OpenTelemetry tracing
