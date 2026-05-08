/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Check } from './types'

export const mobileChecks: Check[] = [
  {
    id: 'mob-001',
    slug: 'layout-breaks-375px',
    category: 'MOBILE',
    name: 'Layout breaks at 375px viewport',
    description: 'Resizes viewport to 375px and checks for overflow or layout issues.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      await page.setViewportSize({ width: 375, height: 812 })
      await page.reload({ waitUntil: 'networkidle' })
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth
      })
      if (hasOverflow) {
        return { status: 'FAIL', message: 'Horizontal overflow detected at 375px viewport', fixSuggestion: 'Add overflow-x: hidden to body and check all fixed-width elements for responsive breakpoints.' }
      }
      return { status: 'PASS', message: 'No overflow at 375px viewport' }
    },
  },
  {
    id: 'mob-002',
    slug: 'tap-targets-too-small',
    category: 'MOBILE',
    name: 'Tap targets below 44px',
    description: 'Checks interactive elements for minimum 44px touch target size.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      await page.setViewportSize({ width: 375, height: 812 })
      const smallTargets = await page.evaluate(() => {
        const els = document.querySelectorAll('a, button, input, select, [role="button"], [onclick]')
        const small: string[] = []
        els.forEach((el) => {
          const rect = el.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
            small.push(`${el.tagName} "${(el as HTMLElement).innerText?.substring(0, 30) || (el as HTMLElement).getAttribute('aria-label') || ''}" (${Math.round(rect.width)}x${Math.round(rect.height)})`)
          }
        })
        return small.slice(0, 5)
      })
      if (smallTargets.length > 0) {
        return {
          status: 'WARN',
          message: `${smallTargets.length} tap targets below 44px`,
          detail: smallTargets.join('\n'),
          fixSuggestion: 'Set minimum height/width of 44px on all interactive elements for touch accessibility.',
        }
      }
      return { status: 'PASS', message: 'Tap targets meet 44px minimum' }
    },
  },
  {
    id: 'mob-003',
    slug: 'horizontal-scroll-mobile',
    category: 'MOBILE',
    name: 'Horizontal scroll present on mobile',
    description: 'Checks for horizontal scrollbar at mobile viewport.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      await page.setViewportSize({ width: 375, height: 812 })
      const overflow = await page.evaluate(() => ({
        bodyScrollWidth: document.body.scrollWidth,
        windowWidth: window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth,
      }))
      if (overflow.docScrollWidth > overflow.windowWidth + 5) {
        return { status: 'FAIL', message: `Horizontal scroll at 375px: content is ${overflow.docScrollWidth}px wide`, fixSuggestion: 'Find elements wider than viewport and add max-width: 100% or responsive classes.' }
      }
      return { status: 'PASS', message: 'No horizontal scroll on mobile' }
    },
  },
  {
    id: 'mob-004',
    slug: 'input-font-too-small-ios',
    category: 'MOBILE',
    name: 'Font size below 16px on inputs (triggers iOS zoom)',
    description: 'iOS auto-zooms when input font-size is below 16px.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      await page.setViewportSize({ width: 375, height: 812 })
      const smallInputs = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input, select, textarea')
        const small: string[] = []
        inputs.forEach((input) => {
          const fs = parseFloat(window.getComputedStyle(input).fontSize)
          if (fs > 0 && fs < 16) {
            small.push(`${input.tagName}[type="${(input as HTMLInputElement).type || ''}"] font-size: ${fs}px`)
          }
        })
        return small.slice(0, 5)
      })
      if (smallInputs.length > 0) {
        return {
          status: 'WARN',
          message: `${smallInputs.length} input(s) with font-size < 16px`,
          detail: smallInputs.join('\n'),
          fixSuggestion: 'Set font-size: 16px minimum on all inputs to prevent iOS auto-zoom.',
        }
      }
      return { status: 'PASS', message: 'All inputs have 16px+ font size' }
    },
  },
  {
    id: 'mob-005',
    slug: 'images-overflow-mobile',
    category: 'MOBILE',
    name: 'Images overflow on mobile',
    description: 'Checks for images wider than their container at mobile viewport.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      await page.setViewportSize({ width: 375, height: 812 })
      const overflowImages = await page.evaluate(() => {
        const imgs = document.querySelectorAll('img')
        const overflow: string[] = []
        imgs.forEach((img) => {
          const rect = img.getBoundingClientRect()
          if (rect.right > window.innerWidth + 5) {
            overflow.push(`img[src="${img.src?.substring(0, 60)}"] overflows by ${Math.round(rect.right - window.innerWidth)}px`)
          }
        })
        return overflow.slice(0, 5)
      })
      if (overflowImages.length > 0) {
        return {
          status: 'FAIL',
          message: `${overflowImages.length} image(s) overflow viewport on mobile`,
          detail: overflowImages.join('\n'),
          fixSuggestion: 'Add max-width: 100% to all images. Use Next.js Image component for automatic sizing.',
        }
      }
      return { status: 'PASS', message: 'No image overflow on mobile' }
    },
  },
  {
    id: 'mob-006',
    slug: 'fixed-elements-behind-chrome',
    category: 'MOBILE',
    name: 'Fixed elements hidden behind browser chrome',
    description: 'Checks fixed position elements at bottom of mobile viewport.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      await page.setViewportSize({ width: 375, height: 812 })
      const fixedBottom = await page.evaluate(() => {
        const fixed = Array.from(document.querySelectorAll('*')).filter((el) => {
          const style = window.getComputedStyle(el)
          return style.position === 'fixed' && style.bottom && parseInt(style.bottom) < 20
        })
        return fixed.length
      })
      if (fixedBottom > 0) {
        return { status: 'WARN', message: `${fixedBottom} fixed-bottom element(s) may be hidden behind browser chrome`, fixSuggestion: 'Add padding-bottom: env(safe-area-inset-bottom) to fixed bottom elements.' }
      }
      return { status: 'PASS', message: 'No problematic fixed bottom elements detected' }
    },
  },
  {
    id: 'mob-007',
    slug: 'hover-only-interactions',
    category: 'MOBILE',
    name: 'Hover-only interactions present',
    description: 'Checks for CSS hover states that reveal critical UI elements.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const source = await page.content()
      const hasHoverOnly = await page.evaluate(() => {
        const sheets = Array.from(document.styleSheets)
        try {
          const rules = sheets.flatMap((s) => {
            try { return Array.from(s.cssRules) } catch { return [] }
          })
          return rules.some((r) => {
            const text = r.cssText || ''
            return text.includes(':hover') && (text.includes('display: block') || text.includes('visibility: visible') || text.includes('opacity: 1'))
          })
        } catch { return false }
      })
      if (hasHoverOnly) {
        return { status: 'WARN', message: 'CSS hover-reveal patterns detected — may not work on touch devices', fixSuggestion: 'Replace hover-only interactions with click/tap alternatives. Use @media (hover: hover) to scope hover styles.' }
      }
      return { status: 'PASS', message: 'No hover-only interaction issues detected' }
    },
  },
  {
    id: 'mob-008',
    slug: 'no-touch-drag-alternative',
    category: 'MOBILE',
    name: 'No touch-friendly alternatives to drag interactions',
    description: 'Checks for drag-and-drop without touch alternatives.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const hasDrag = await page.evaluate(() => {
        const html = document.documentElement.innerHTML
        return html.includes('draggable="true"') || html.includes('ondragstart') || html.includes('react-dnd') || html.includes('dnd-kit')
      })
      if (hasDrag) {
        const hasTouch = await page.evaluate(() => {
          const html = document.documentElement.innerHTML
          return html.includes('onTouchStart') || html.includes('touchstart') || html.includes('pointerdown')
        })
        if (!hasTouch) {
          return { status: 'WARN', message: 'Drag interactions without touch event handlers', fixSuggestion: 'Use a touch-compatible drag library (like @dnd-kit) or add touch alternatives.' }
        }
      }
      return { status: 'PASS', message: 'No unhandled drag-only interactions' }
    },
  },
  {
    id: 'mob-009',
    slug: 'viewport-meta-missing',
    category: 'MOBILE',
    name: 'Mobile viewport meta tag missing or misconfigured',
    description: 'Checks for correct viewport meta tag configuration.',
    severity: 'CRITICAL',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const viewport = await page.$eval('meta[name="viewport"]', (el) => el.getAttribute('content')).catch(() => null)
      if (!viewport) {
        return { status: 'FAIL', message: 'No viewport meta tag found', fixSuggestion: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to your HTML head.' }
      }
      if (!viewport.includes('width=device-width')) {
        return { status: 'WARN', message: `Viewport meta missing width=device-width: "${viewport}"`, fixSuggestion: 'Use: content="width=device-width, initial-scale=1"' }
      }
      if (viewport.includes('user-scalable=no') || viewport.includes('maximum-scale=1')) {
        return { status: 'WARN', message: 'Viewport prevents user scaling — accessibility issue', fixSuggestion: 'Remove user-scalable=no and maximum-scale=1 to allow accessibility zoom.' }
      }
      return { status: 'PASS', message: 'Viewport meta tag correctly configured' }
    },
  },
  {
    id: 'mob-010',
    slug: 'high-cls-mobile',
    category: 'MOBILE',
    name: 'Layout shift score (CLS) above 0.1 on mobile',
    description: 'Measures Cumulative Layout Shift on mobile viewport.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      await page.setViewportSize({ width: 375, height: 812 })
      await page.reload({ waitUntil: 'networkidle' })
      const cls = await page.evaluate(async () => {
        return new Promise<number>((resolve) => {
          let clsScore = 0
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsScore += (entry as any).value
              }
            }
          })
          try {
            observer.observe({ type: 'layout-shift', buffered: true })
          } catch {}
          setTimeout(() => { observer.disconnect(); resolve(clsScore) }, 3000)
        })
      })
      if (cls > 0.25) {
        return { status: 'FAIL', message: `CLS score ${cls.toFixed(3)} — poor (>0.25)`, fixSuggestion: 'Set explicit width/height on images, avoid inserting content above existing content.' }
      }
      if (cls > 0.1) {
        return { status: 'WARN', message: `CLS score ${cls.toFixed(3)} — needs improvement (>0.1)`, fixSuggestion: 'Reduce layout shifts by reserving space for async content and images.' }
      }
      return { status: 'PASS', message: `CLS score ${cls.toFixed(3)} — good` }
    },
  },
]