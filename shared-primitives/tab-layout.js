/* Shared, dependency-free service-tab geometry. The profile is supplied by
 * layout.json, not copied here. Browser: BCTabLayout; Node: require(this file).
 * Text remains a single native SVG textPath. No glyphs are stretched. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BCTabLayout = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const RAD = Math.PI / 180;
  const MAX_HALF_SPAN = 80;
  function finite(name, value, min = -Infinity, max = Infinity) {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(name + ' must be finite and within ' + min + '..' + max);
    }
    return value;
  }
  function validate(profile, side, half, depth) {
    if (!profile || !Array.isArray(profile.oval) || profile.oval.length !== 4) {
      throw new TypeError('A tab profile with a four-number oval is required');
    }
    profile.oval.forEach((n, i) => finite('oval[' + i + ']', n, i > 1 ? 1 : -Infinity));
    if (side !== 'upper' && side !== 'lower') throw new TypeError('Unknown tab side');
    finite('halfSpan', half, 5, MAX_HALF_SPAN);
    finite('depth', depth, 1, 600);
    finite('border', profile.border, 0, 40);
    finite('inset', profile.inset, 0, Math.min(profile.oval[2], profile.oval[3]) / 4);
    finite('tilt', profile.tilt, 0, 40);
    finite('side angle', profile[side]);
  }
  function construction(profile, side, half, depth) {
    validate(profile, side, half, depth);
    const [cx, cy, rx, ry] = profile.oval;
    const c = profile[side] * RAD, tilt = profile.tilt * RAD;
    const normal = t => {
      const x = Math.cos(t) / rx, y = Math.sin(t) / ry, n = Math.hypot(x, y);
      return [x / n, y / n];
    };
    const at = (t, distance) => {
      const [nx, ny] = normal(t);
      return [cx + rx * Math.cos(t) + distance * nx,
        cy + ry * Math.sin(t) + distance * ny];
    };
    const end = (sign, shift) => {
      const t = c + sign * half * RAD, [nx, ny] = normal(t), a = -sign * tilt;
      const dx = nx * Math.cos(a) - ny * Math.sin(a);
      const dy = nx * Math.sin(a) + ny * Math.cos(a);
      const [px, py] = at(t, 0);
      return { q: [px + dy * sign * shift, py - dx * sign * shift], d: [dx, dy] };
    };
    const meet = (line, distance, sign) => {
      const cross = t => {
        const p = at(t, distance);
        return (p[0] - line.q[0]) * line.d[1] - (p[1] - line.q[1]) * line.d[0];
      };
      let lo = c, hi = c + sign * (half + 40) * RAD;
      if ((cross(lo) > 0) === (cross(hi) > 0)) {
        throw new RangeError('Tab end does not intersect the requested offset curve');
      }
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if ((cross(mid) > 0) === (cross(lo) > 0)) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    };
    const arc = (a, b, distance) => {
      const n = Math.max(8, Math.ceil(Math.abs(b - a) / RAD * 2));
      return Array.from({ length: n + 1 }, (_, i) => at(a + (b - a) * i / n, distance));
    };
    return { at, end, meet, arc, c };
  }
  const path = (points, closed = false) => 'M ' + points.map(p =>
    p.map(v => v.toFixed(2)).join(' ')).join(' L ') + (closed ? ' Z' : '');
  function bounds(points) {
    let x = Infinity, y = Infinity, right = -Infinity, bottom = -Infinity;
    for (const [px, py] of points) {
      x = Math.min(x, px); y = Math.min(y, py);
      right = Math.max(right, px); bottom = Math.max(bottom, py);
    }
    return { x, y, w: right - x, h: bottom - y };
  }
  /** Same default band construction as site/src/tab.ts, with adjustable depth. */
  function tabBands(profile, side, half = profile.halfSpan, depth = profile.depth) {
    const g = construction(profile, side, half, depth), all = [];
    const band = (d0, d1, shift) => {
      const left = g.end(-1, shift), right = g.end(1, shift);
      const a0 = g.meet(left, d1, -1), a1 = g.meet(right, d1, 1);
      const b0 = g.meet(left, d0, -1), b1 = g.meet(right, d0, 1);
      // Keep the existing default vertex count, including the inner arc.
      const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / RAD * 2));
      const pts = [
        ...Array.from({ length: n + 1 }, (_, i) => g.at(a0 + (a1 - a0) * i / n, d1)),
        ...Array.from({ length: n + 1 }, (_, i) => g.at(b1 + (b0 - b1) * i / n, d0)),
      ];
      all.push(...pts);
      return path(pts, true);
    };
    const border = band(-profile.inset, depth + profile.border, 0);
    const face = band(0, depth, profile.border);
    return { border, face, points: all, bounds: bounds(all) };
  }
  function baseline(profile, side, half, depth, offset) {
    const g = construction(profile, side, half, depth);
    let a = g.meet(g.end(-1, profile.border), offset, -1);
    let b = g.meet(g.end(1, profile.border), offset, 1);
    if (side === 'lower') [a, b] = [b, a]; // Both sides read left to right.
    const points = g.arc(a, b, offset);
    // Length uses the same rounded vertices that the browser receives.
    const rounded = points.map(p => p.map(v => +v.toFixed(2)));
    let length = 0;
    for (let i = 1; i < rounded.length; i++) {
      length += Math.hypot(rounded[i][0] - rounded[i - 1][0], rounded[i][1] - rounded[i - 1][1]);
    }
    return { d: path(points), length, span: Math.abs(b - a) / RAD,
      side: side === 'upper' ? 'top' : 'bottom', rx: null, ry: null };
  }
  /**
   * A single layout for the holder, baseline, and lettering.
   * metrics are measured per 1px font size by the browser. Explicit tracking is
   * preserved. Grow span first, then shrink uniformly and report that decision.
   */
  function resolve(options) {
    const { profile, side, metrics: m } = options;
    if (!m) throw new TypeError('Browser text metrics are required');
    const requestedCap = finite('capHeight', options.capHeight, 1, 150);
    const referenceCap = finite('referenceCap', options.referenceCap, 1, 150);
    const minCap = finite('minCap', options.minCap, 1, 150);
    const trackingEm = finite('trackingEm', options.trackingEm, 0, 1);
    const count = finite('count', options.count, 0, 1000);
    const endPad = finite('endPad', options.endPad, 0, 200);
    const maxHalf = options.maxHalfSpan ?? MAX_HALF_SPAN;
    const minHalf = profile.halfSpan;
    finite('maxHalfSpan', maxHalf, minHalf, MAX_HALF_SPAN);
    for (const k of ['width', 'ascent', 'descent']) finite('metrics.' + k, m[k], 0);
    finite('metrics.cap', m.cap, 0.01, 3);
    finite('reference depth', profile.depth, 1, 600);
    const paddingRatio = Math.max(0.15, (profile.depth - referenceCap) / (2 * referenceCap));
    const candidate = (cap, half) => {
      const size = cap / m.cap;
      const ascent = Math.max(cap, m.ascent * size), descent = m.descent * size;
      const padding = Math.max(profile.border / 2, paddingRatio * cap);
      const depth = ascent + descent + 2 * padding;
      const offset = padding + (side === 'upper' ? descent : ascent);
      const curve = baseline(profile, side, half, depth, offset);
      // Reserve tangential clearance for an upright glyph next to a tilted cut.
      const overhang = Math.max(0, m.left || 0, (m.right || 0) - m.width) * size;
      const edge = Math.max(endPad, (ascent + descent) * Math.tan(profile.tilt * RAD) + padding / 2 + overhang);
      const width = (m.width + count * trackingEm) * size;
      const available = Math.max(0, curve.length - 2 * edge);
      return { cap, size, ascent, descent, padding, depth, offset, halfSpan: half,
        curve, width, available, endPadding: edge, fits: width <= available - 0.05 };
    };
    let result = candidate(requestedCap, minHalf), status = 'fits', stage = 'natural';
    if (!result.fits) {
      const largest = candidate(requestedCap, maxHalf);
      if (largest.fits) {
        let lo = minHalf, hi = maxHalf;
        for (let i = 0; i < 25; i++) {
          const mid = (lo + hi) / 2;
          if (candidate(requestedCap, mid).fits) hi = mid; else lo = mid;
        }
        result = candidate(requestedCap, hi); stage = 'arc-expanded';
      } else {
        let lo = 0.01, hi = requestedCap;
        if (!candidate(lo, maxHalf).fits) throw new RangeError('No feasible service-tab layout');
        for (let i = 0; i < 30; i++) {
          const mid = (lo + hi) / 2;
          if (candidate(mid, maxHalf).fits) lo = mid; else hi = mid;
        }
        result = candidate(lo, maxHalf); status = 'text-reduced'; stage = 'uniform-shrink';
      }
    }
    const geometry = tabBands(profile, side, result.halfSpan, result.depth);
    return { ...result, geometry, requestedCap, trackingEm, tracking: trackingEm * result.size,
      status, stage, tooSmall: result.cap < minCap, minimum: minCap };
  }
  return Object.freeze({ MAX_HALF_SPAN, tabBands, resolve });
});
