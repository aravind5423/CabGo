// server/router.js
// URL pattern dispatcher — replaces Express Router
// Matches method + pathname against registered routes

'use strict';

const url = require('url');

class Router {
  constructor() {
    this._routes = []; // { method, pattern, keys, handler }
  }

  // Register a route: pattern can include :param segments
  _add(method, pattern, handler) {
    const keys   = [];
    const regStr = pattern
      .replace(/\//g, '\\/')
      .replace(/:([a-zA-Z_]+)/g, (_, key) => { keys.push(key); return '([^\\/]+)'; });
    const regex = new RegExp(`^${regStr}$`);
    this._routes.push({ method, regex, keys, handler });
  }

  get(pattern, handler)    { this._add('GET',    pattern, handler); }
  post(pattern, handler)   { this._add('POST',   pattern, handler); }
  put(pattern, handler)    { this._add('PUT',    pattern, handler); }
  delete(pattern, handler) { this._add('DELETE', pattern, handler); }

  /**
   * Match an incoming request.
   * Returns { handler, params } or null.
   */
  match(req) {
    const parsed   = url.parse(req.url, true);
    const pathname = parsed.pathname;
    try { req.query = parsed.query; } catch (_) { try { Object.assign(req.query, parsed.query); } catch (__) {} }

    for (const route of this._routes) {
      if (req.method !== route.method) continue;
      const m = pathname.match(route.regex);
      if (!m) continue;
      const params = {};
      route.keys.forEach((key, i) => { params[key] = decodeURIComponent(m[i + 1]); });
      req.params = params;
      return { handler: route.handler };
    }
    return null;
  }
}

module.exports = Router;
