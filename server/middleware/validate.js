// server/middleware/validate.js
// Zod validation middleware factory
// Usage: router.post('/api/...', validate(mySchema), async (req, res) => { ... })

'use strict';

/**
 * Returns an Express-compatible middleware that validates req.body against a Zod schema.
 * On failure → 400 JSON with field-level error details.
 * On success → attaches req.validated (parsed, coerced, stripped data) and calls next().
 *
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} [source='body'] - which part of req to validate
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        field:   e.path.join('.'),
        message: e.message,
      }));
      // Use req.sendJSON shim if available (raw HTTP server compat), else use express res.json
      if (typeof req.sendJSON === 'function') {
        return req.sendJSON(400, {
          success: false,
          message: errors[0]?.message || 'Validation failed',
          errors,
        });
      }
      res.status(400).json({
        success: false,
        message: errors[0]?.message || 'Validation failed',
        errors,
      });
      return;
    }
    req.validated = result.data;
    next();
  };
}

module.exports = validate;

