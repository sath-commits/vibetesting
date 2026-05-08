/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Check } from './types'

export const performanceChecks: Check[] = [
  {
    id: 'perf-001',
    slug: 'no-image-optimization',
    category: 'PERFORMANCE',
    name: 'No image optimization (large uncompressed images)',
    description: 'Checks for large unoptimized images loaded on the page.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const largeImages = await page.evaluate(() => {
        const imgs = Array.from(document.images)
        return imgs
          .filter((img) => img.naturalWidth > 0)
          .map((img) => ({
            src: img.src.substring(0, 80),
            naturalW: img.naturalWidth,
            naturalH: img.naturalHeight,
            displayW: img.offsetWidth,
            displayH: img.offsetHeight,
          }))
          .filter((img) => img.naturalW > img.displayW * 2.5 && img.displayW > 0)
          .slice(0, 5)
      })
      if (largeImages.length > 0) {
        return {
          status: 'WARN',
          message: `${largeImages.length} oversized image(s) detected`,
          detail: largeImages.map((i) => `${i.src} (${i.naturalW}x${i.naturalH} displayed at ${i.displayW}x${i.displayH})`).join('\n'),
          fixSuggestion: 'Use next/image with appropriate sizes prop, or serve responsive images with srcset.',
        }
      }
      return { status: 'PASS', message: 'Images appear appropriately sized' }
    },
  },
  {
    id: 'perf-002',
    slug: 'no-lazy-loading',
    category: 'PERFORMANCE',
    name: 'No lazy loading on below-fold images',
    description: 'Checks if below-fold images have loading="lazy" attribute.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      const belowFoldImages = await page.evaluate(() => {
        const viewportHeight = window.innerHeight
        const imgs = Array.from(document.images)
        const belowFold = imgs.filter((img) => {
          const rect = img.getBoundingClientRect()
          return rect.top > viewportHeight && rect.width > 0
        })
        const noLazy = belowFold.filter((img) => img.loading !== 'lazy')
        return { total: belowFold.length, noLazy: noLazy.length }
      })
      if (belowFoldImages.noLazy > 3) {
        return { status: 'WARN', message: `${belowFoldImages.noLazy}/${belowFoldImages.total} below-fold images missing loading="lazy"`, fixSuggestion: 'Add loading="lazy" to all images below the fold. Next.js Image does this automatically.' }
      }
      return { status: 'PASS', message: 'Below-fold images use lazy loading' }
    },
  },
  {
    id: 'perf-003',
    slug: 'unminified-js',
    category: 'PERFORMANCE',
    name: 'Unminified JS detected',
    description: 'Checks script sizes and content for minification.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const scripts = await page.$$eval('script[src]', (els) =>
        els.map((el) => (el as HTMLScriptElement).src).filter((src) => !src.includes('analytics') && !src.includes('gtag'))
      )
      for (const src of scripts.slice(0, 5)) {
        try {
          const res = await page.request.get(src, { timeout: 8000 })
          const text = await res.text()
          const lines = text.split('\n')
          const avgLineLength = text.length / lines.length
          if (text.length > 10000 && avgLineLength < 100) {
            return { status: 'WARN', message: `Potentially unminified JS: ${src.substring(0, 80)} (avg line: ${Math.round(avgLineLength)} chars)`, fixSuggestion: 'Ensure all JS is minified in production. Next.js does this automatically for .js files.' }
          }
        } catch {}
      }
      return { status: 'PASS', message: 'Scripts appear minified' }
    },
  },
  {
    id: 'perf-004',
    slug: 'no-caching-headers',
    category: 'PERFORMANCE',
    name: 'No caching headers on static assets',
    description: 'Checks Cache-Control headers on JS, CSS, and image assets.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const staticAssets = ctx.networkRequests.filter((r) =>
        /\.(js|css|png|jpg|jpeg|webp|svg|woff2)(\?|$)/.test(r.url)
      )
      if (staticAssets.length === 0) return { status: 'SKIP', message: 'No static assets detected' }
      const noCacheAssets = staticAssets.filter((r) => {
        const cc = r.headers['cache-control']
        return !cc || cc.includes('no-cache') || cc.includes('no-store')
      })
      if (noCacheAssets.length > staticAssets.length / 2) {
        return { status: 'WARN', message: `${noCacheAssets.length}/${staticAssets.length} static assets have no cache headers`, fixSuggestion: 'Set Cache-Control: public, max-age=31536000, immutable on versioned static assets.' }
      }
      return { status: 'PASS', message: 'Static assets have caching headers' }
    },
  },
  {
    id: 'perf-005',
    slug: 'bundle-too-large',
    category: 'PERFORMANCE',
    name: 'Bundle size above 1MB',
    description: 'Estimates total JavaScript bundle size from network requests.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const jsAssets = ctx.networkRequests.filter((r) => r.url.endsWith('.js') || r.url.includes('.js?'))
      let totalSize = 0
      for (const asset of jsAssets.slice(0, 20)) {
        try {
          const res = await page.request.get(asset.url, { timeout: 8000 })
          const buffer = await res.body()
          totalSize += buffer.length
        } catch {}
      }
      const totalMB = totalSize / 1024 / 1024
      if (totalMB > 2) {
        return { status: 'FAIL', message: `Total JS bundle ~${totalMB.toFixed(1)}MB — very large`, fixSuggestion: 'Use dynamic imports, tree-shake dependencies, and analyze bundle with next/bundle-analyzer.' }
      }
      if (totalMB > 1) {
        return { status: 'WARN', message: `Total JS bundle ~${totalMB.toFixed(1)}MB — above 1MB target`, fixSuggestion: 'Split code with dynamic imports and remove unused dependencies.' }
      }
      return { status: 'PASS', message: `Total JS bundle ~${totalMB.toFixed(1)}MB` }
    },
  },
  {
    id: 'perf-006',
    slug: 'high-ttfb',
    category: 'PERFORMANCE',
    name: 'Time to first byte above 800ms',
    description: 'Measures TTFB using Navigation Timing API.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const ttfb = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        if (!nav) return null
        return nav.responseStart - nav.requestStart
      })
      if (ttfb === null) return { status: 'SKIP', message: 'Navigation timing not available' }
      if (ttfb > 1500) {
        return { status: 'FAIL', message: `TTFB: ${Math.round(ttfb)}ms — poor (>1500ms)`, fixSuggestion: 'Optimize server response time. Consider edge deployment, caching, or server-side optimization.' }
      }
      if (ttfb > 800) {
        return { status: 'WARN', message: `TTFB: ${Math.round(ttfb)}ms — needs improvement (>800ms)`, fixSuggestion: 'Enable CDN caching, optimize database queries, and consider edge functions.' }
      }
      return { status: 'PASS', message: `TTFB: ${Math.round(ttfb)}ms — good` }
    },
  },
  {
    id: 'perf-007',
    slug: 'high-lcp',
    category: 'PERFORMANCE',
    name: 'Largest contentful paint above 2.5s',
    description: 'Measures LCP using PerformanceObserver.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const lcp = await page.evaluate(async () => {
        return new Promise<number>((resolve) => {
          let lcpValue = 0
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries()
            if (entries.length > 0) {
              lcpValue = entries[entries.length - 1].startTime
            }
          })
          try {
            observer.observe({ type: 'largest-contentful-paint', buffered: true })
          } catch {}
          setTimeout(() => { observer.disconnect(); resolve(lcpValue) }, 5000)
        })
      })
      if (lcp > 4000) {
        return { status: 'FAIL', message: `LCP: ${(lcp / 1000).toFixed(2)}s — poor (>4s)`, fixSuggestion: 'Optimize your hero image/content: preload, use WebP, reduce server response time.' }
      }
      if (lcp > 2500) {
        return { status: 'WARN', message: `LCP: ${(lcp / 1000).toFixed(2)}s — needs improvement (>2.5s)`, fixSuggestion: 'Preload your LCP element, reduce render-blocking resources, and optimize images.' }
      }
      if (lcp === 0) return { status: 'SKIP', message: 'LCP measurement unavailable' }
      return { status: 'PASS', message: `LCP: ${(lcp / 1000).toFixed(2)}s — good` }
    },
  },
  {
    id: 'perf-008',
    slug: 'no-skeleton-loading',
    category: 'PERFORMANCE',
    name: 'No skeleton/loading UI on data-dependent sections',
    description: 'Checks for skeleton screens on sections that load async data.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const hasSkeleton = await page.evaluate(() => {
        const html = document.documentElement.innerHTML
        return (
          html.includes('skeleton') ||
          html.includes('animate-pulse') ||
          html.includes('Skeleton') ||
          !!document.querySelector('[aria-busy="true"]')
        )
      })
      if (!hasSkeleton) {
        return { status: 'WARN', message: 'No skeleton loading UI detected', fixSuggestion: 'Add skeleton screens using Tailwind animate-pulse or a skeleton component library.' }
      }
      return { status: 'PASS', message: 'Skeleton loading UI detected' }
    },
  },
]