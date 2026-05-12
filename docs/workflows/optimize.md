---
description: Improve interface performance across loading speed, rendering, animations, and bundle size
---

Identify and fix performance issues to create faster, smoother user experiences.

## Assess Performance Issues

1. **Measure current state**: Core Web Vitals, load time, bundle size, runtime performance, network
2. **Identify bottlenecks**: What's slow? What's causing it? Who's affected?

**CRITICAL**: Measure before and after. Premature optimization wastes time.

## Optimization Strategy

### Loading Performance
- **Images**: Modern formats (WebP, AVIF), proper sizing, lazy loading, responsive images, compression
- **JavaScript**: Code splitting, tree shaking, remove unused dependencies, lazy load non-critical code
- **CSS**: Remove unused CSS, critical CSS inline
- **Fonts**: `font-display: swap`, subset fonts, preload critical fonts
- **Loading Strategy**: Preload critical assets, prefetch next pages, service worker

### Rendering Performance
- **Avoid Layout Thrashing**: Batch reads then batch writes
- **Optimize Rendering**: CSS `contain`, minimize DOM depth, `content-visibility: auto`, virtual scrolling
- **Reduce Paint**: Use `transform` and `opacity` for animations (GPU-accelerated)

### Animation Performance
- Target 16ms per frame (60fps)
- Use `requestAnimationFrame` for JS animations
- Debounce/throttle scroll handlers
- Use CSS animations when possible

### Framework Optimization
- Memoize expensive components and computations
- Virtualize long lists
- Code split routes
- Minimize re-renders

### Network Optimization
- Pagination, compression, HTTP caching, CDN
- Adaptive loading based on connection

## Core Web Vitals

- **LCP < 2.5s**: Optimize hero images, inline critical CSS, preload key resources
- **FID < 100ms / INP < 200ms**: Break up long tasks, defer non-critical JS
- **CLS < 0.1**: Set dimensions on images/videos, don't inject content above existing content

**NEVER**:
- Optimize without measuring
- Sacrifice accessibility for performance
- Use `will-change` everywhere
- Lazy load above-fold content
- Forget mobile performance

## Verify Improvements

- Before/after metrics comparison
- Test on low-end devices and slow connections
- No regressions in functionality
- Does it *feel* faster?
