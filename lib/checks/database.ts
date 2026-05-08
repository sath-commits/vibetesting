/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Check } from './types'

export const databaseChecks: Check[] = [
  {
    id: 'db-001',
    slug: 'no-error-state-data-fail',
    category: 'DATABASE',
    name: 'No error state when data fails to load',
    description: 'Simulates a slow/failed network and checks for error UI.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const hasErrorUI = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase()
        return text.includes('something went wrong') || text.includes('failed to load') || text.includes('try again') || !!document.querySelector('[role="alert"]')
      })
      const hasData = await page.evaluate(() => document.body.innerText.trim().length > 100)
      if (!hasData && !hasErrorUI) {
        return { status: 'WARN', message: 'Empty page with no error state detected', fixSuggestion: 'Add an error boundary and error UI for failed data fetches.' }
      }
      return { status: 'PASS', message: 'Page renders content or error state' }
    },
  },
  {
    id: 'db-002',
    slug: 'no-pagination',
    category: 'DATABASE',
    name: 'No pagination — full table dump to UI',
    description: 'Checks for extremely long lists that suggest unbound database queries.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const listItems = await page.$$('li, tr, [class*="item"], [class*="row"], [class*="card"]')
      if (listItems.length > 100) {
        return { status: 'WARN', message: `${listItems.length} list items rendered — no pagination detected`, fixSuggestion: 'Add pagination, infinite scroll with limits, or cursor-based pagination to your data fetches.' }
      }
      const hasPagination = await page.$('[aria-label*="pagination"], [class*="pagination"], nav[class*="page"], button:has-text("Next"), button:has-text("Load more")')
      if (listItems.length > 20 && !hasPagination) {
        return { status: 'WARN', message: `${listItems.length} items without pagination controls`, fixSuggestion: 'Add LIMIT/OFFSET or cursor pagination to your queries.' }
      }
      return { status: 'PASS', message: 'List size and pagination look reasonable' }
    },
  },
  {
    id: 'db-003',
    slug: 'supabase-anon-key-no-rls',
    category: 'DATABASE',
    name: 'Supabase anon key in client with no visible RLS',
    description: 'Checks for exposed Supabase anon key alongside direct table access patterns.',
    severity: 'CRITICAL',
    stacks: ['supabase'],
    run: async (page, url, ctx) => {
      if (!ctx.detectedStack.includes('supabase')) return { status: 'SKIP', message: 'Supabase not detected' }
      const source = await page.content()
      const hasKey = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}/.test(source)
      if (hasKey) {
        return { status: 'WARN', message: 'Supabase JWT/anon key exposed in client source', fixSuggestion: 'The anon key is safe to expose IF RLS is enabled on all tables. Audit your RLS policies immediately.' }
      }
      return { status: 'PASS', message: 'No Supabase keys exposed in source' }
    },
  },
  {
    id: 'db-004',
    slug: 'no-soft-delete',
    category: 'DATABASE',
    name: 'No soft delete pattern (direct destructive actions)',
    description: 'Checks for hard delete buttons without soft-delete or trash confirmation.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const deleteButtons = await page.$$('button:has-text("Delete"), button:has-text("Remove"), [aria-label*="delete"]')
      if (deleteButtons.length === 0) return { status: 'SKIP', message: 'No delete actions found' }
      const hasConfirm = await page.$('[role="dialog"], [role="alertdialog"], [class*="modal"], [class*="confirm"]')
      if (!hasConfirm) {
        return { status: 'WARN', message: 'Delete buttons present without confirmation dialog', fixSuggestion: 'Add a confirmation step before destructive actions, or implement soft delete with undo.' }
      }
      return { status: 'PASS', message: 'Delete actions have confirmation' }
    },
  },
  {
    id: 'db-005',
    slug: 'timestamps-no-timezone',
    category: 'DATABASE',
    name: 'Timestamps without timezone handling',
    description: 'Checks if timestamps displayed on page are localized.',
    severity: 'LOW',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const timestamps = await page.$$('time, [class*="date"], [class*="time"], [class*="timestamp"]')
      if (timestamps.length === 0) return { status: 'SKIP', message: 'No timestamp elements found' }
      const hasTimezone = await page.evaluate(() => {
        const times = Array.from(document.querySelectorAll('time'))
        return times.some((t) => t.getAttribute('datetime')?.includes('Z') || t.getAttribute('datetime')?.includes('+') || t.getAttribute('datetime')?.includes('-'))
      })
      if (!hasTimezone) {
        return { status: 'WARN', message: 'Timestamps may lack timezone info', fixSuggestion: 'Store timestamps as UTC and display in user local timezone using toLocaleString().' }
      }
      return { status: 'PASS', message: 'Timestamps appear timezone-aware' }
    },
  },
  {
    id: 'db-006',
    slug: 'duplicate-data-visible',
    category: 'DATABASE',
    name: 'Missing unique constraint signals (duplicate data)',
    description: 'Scans lists for visually identical entries indicating missing DB constraints.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const items = await page.$$eval('li, tr:not(:first-child)', (els) =>
        els.map((el) => el.textContent?.trim().substring(0, 80) || '')
      )
      const seen = new Set<string>()
      const dupes = items.filter((item) => {
        if (item.length < 10) return false
        if (seen.has(item)) return true
        seen.add(item)
        return false
      })
      if (dupes.length > 2) {
        return { status: 'WARN', message: `${dupes.length} visually duplicate list entries detected`, fixSuggestion: 'Add UNIQUE constraints to your database schema and deduplicate existing data.' }
      }
      return { status: 'PASS', message: 'No obvious duplicate data detected' }
    },
  },
  {
    id: 'db-007',
    slug: 'infinite-scroll-no-end',
    category: 'DATABASE',
    name: 'Infinite scroll with no end state',
    description: 'Checks infinite scroll implementations for a "no more items" state.',
    severity: 'LOW',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const hasInfiniteScroll = await page.evaluate(() => {
        const scripts = Array.from(document.scripts).map((s) => s.textContent || '').join('')
        return scripts.includes('IntersectionObserver') || scripts.includes('infinite') || scripts.includes('loadMore')
      })
      if (!hasInfiniteScroll) return { status: 'SKIP', message: 'No infinite scroll detected' }
      const hasEndState = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase()
        return text.includes('no more') || text.includes('end of') || text.includes("you've reached")
      })
      if (!hasEndState) {
        return { status: 'WARN', message: 'Infinite scroll without visible end state', fixSuggestion: 'Show a "No more items" message when the list is exhausted.' }
      }
      return { status: 'PASS', message: 'Infinite scroll has end state' }
    },
  },
  {
    id: 'db-008',
    slug: 'no-empty-state',
    category: 'DATABASE',
    name: 'No empty state when collection is empty',
    description: 'Checks for appropriate empty state UI on list/collection pages.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const lists = await page.$$('[class*="list"], [class*="grid"], [class*="table"], ul, ol')
      if (lists.length === 0) return { status: 'SKIP', message: 'No list/grid elements found' }
      for (const list of lists) {
        const children = await list.$$(':scope > *')
        if (children.length === 0) {
          const emptyState = await list.evaluate((el) => {
            const parent = el.parentElement
            return parent?.querySelector('[class*="empty"]') || parent?.querySelector('[class*="placeholder"]')
          })
          if (!emptyState) {
            return { status: 'WARN', message: 'Empty list found without empty state UI', fixSuggestion: 'Add an empty state with a helpful message and CTA when collections are empty.' }
          }
        }
      }
      return { status: 'PASS', message: 'Lists appear to have content or empty states' }
    },
  },
  {
    id: 'db-009',
    slug: 'data-no-loading-indicator',
    category: 'DATABASE',
    name: 'Data loads without loading indicator',
    description: 'Checks if data-heavy sections show a skeleton or spinner.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const hasLoadingUI = await page.evaluate(() => {
        const html = document.documentElement.innerHTML
        return (
          html.includes('skeleton') ||
          html.includes('animate-pulse') ||
          html.includes('loading') ||
          html.includes('spinner') ||
          !!document.querySelector('[aria-busy="true"]')
        )
      })
      if (!hasLoadingUI) {
        return { status: 'WARN', message: 'No loading skeleton or spinner detected', fixSuggestion: 'Add skeleton screens or spinners for data-dependent sections.' }
      }
      return { status: 'PASS', message: 'Loading indicators detected' }
    },
  },
  {
    id: 'db-010',
    slug: 'form-no-validation-feedback',
    category: 'DATABASE',
    name: 'Form submits to DB with no validation feedback',
    description: 'Checks forms for client-side validation and error messaging.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const forms = await page.$$('form')
      if (forms.length === 0) return { status: 'SKIP', message: 'No forms found' }
      let hasValidation = false
      for (const form of forms.slice(0, 3)) {
        const hasRequired = await form.$('[required], [aria-required="true"]')
        const hasErrorMsg = await form.$('[class*="error"], [role="alert"], [aria-describedby]')
        if (hasRequired || hasErrorMsg) { hasValidation = true; break }
      }
      if (!hasValidation) {
        return { status: 'WARN', message: 'Forms lack visible validation attributes or error elements', fixSuggestion: 'Add required attributes, aria-describedby for errors, and visible error messages.' }
      }
      return { status: 'PASS', message: 'Form validation detected' }
    },
  },
]