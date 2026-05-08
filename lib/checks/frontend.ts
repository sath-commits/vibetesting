/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Check } from './types'

export const frontendChecks: Check[] = [
  {
    id: 'fe-001',
    slug: 'empty-state-missing',
    category: 'FRONTEND',
    name: 'Empty state missing',
    description: 'Navigates to collection pages and checks for empty state UI.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const emptyContainers = await page.evaluate(() => {
        const containers = document.querySelectorAll('[class*="list"], [class*="grid"], [class*="table"], ul, ol')
        const empty = Array.from(containers).filter((c) => c.children.length === 0)
        return empty.length
      })
      if (emptyContainers > 0) {
        const hasEmptyState = await page.$('[class*="empty"], [class*="placeholder"], [class*="no-data"], [class*="no-results"]')
        if (!hasEmptyState) {
          return { status: 'WARN', message: 'Empty container found without empty state component', fixSuggestion: 'Add an empty state with an icon, message, and CTA for all list views.' }
        }
      }
      return { status: 'PASS', message: 'Empty states appear handled' }
    },
  },
  {
    id: 'fe-002',
    slug: 'error-state-missing',
    category: 'FRONTEND',
    name: 'Error state missing',
    description: 'Checks for error boundary and error state components.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const source = await page.content()
      const hasErrorBoundary = source.includes('ErrorBoundary') || source.includes('error-boundary') || source.includes('onError')
      const consoleErrors = ctx.consoleErrors.filter((e) => e.toLowerCase().includes('error'))
      if (consoleErrors.length > 0 && !hasErrorBoundary) {
        return { status: 'WARN', message: 'Console errors present without error boundary detected', fixSuggestion: 'Add React ErrorBoundary components to prevent blank screens on component errors.' }
      }
      return { status: 'PASS', message: 'Error handling appears present' }
    },
  },
  {
    id: 'fe-003',
    slug: 'loading-state-missing',
    category: 'FRONTEND',
    name: 'Loading state missing',
    description: 'Checks for skeleton screens or spinner elements.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const hasLoader = await page.evaluate(() => {
        const html = document.documentElement.innerHTML
        return (
          html.includes('animate-pulse') ||
          html.includes('skeleton') ||
          html.includes('spinner') ||
          html.includes('loading') ||
          !!document.querySelector('[aria-busy]')
        )
      })
      if (!hasLoader) {
        return { status: 'WARN', message: 'No loading state indicators detected', fixSuggestion: 'Add skeleton screens or spinners for asynchronous data sections.' }
      }
      return { status: 'PASS', message: 'Loading indicators detected' }
    },
  },
  {
    id: 'fe-004',
    slug: 'form-double-submit',
    category: 'FRONTEND',
    name: 'Form double-submit possible',
    description: 'Checks if form submit buttons are disabled after first click.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const forms = await page.$$('form')
      if (forms.length === 0) return { status: 'SKIP', message: 'No forms found' }
      for (const form of forms.slice(0, 3)) {
        const submit = await form.$('button[type="submit"], input[type="submit"]')
        if (!submit) continue
        const hasDisabledLogic = await page.evaluate((el) => {
          const html = document.documentElement.innerHTML
          return html.includes('disabled') && (html.includes('isLoading') || html.includes('isSubmitting') || html.includes('isPending'))
        }, submit)
        if (!hasDisabledLogic) {
          return { status: 'WARN', message: 'Submit button may not disable during submission — double-submit possible', fixSuggestion: 'Disable the submit button immediately on click and re-enable on completion/error.' }
        }
      }
      return { status: 'PASS', message: 'Submit buttons appear to handle double-submit' }
    },
  },
  {
    id: 'fe-005',
    slug: 'success-message-too-short',
    category: 'FRONTEND',
    name: 'Success message timeout too short',
    description: 'Checks if success toasts/alerts auto-dismiss too quickly.',
    severity: 'LOW',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const source = await page.content()
      const match = source.match(/setTimeout[^)]*?(\d{3,4})\s*\)/)
      if (match) {
        const ms = parseInt(match[1])
        if (ms < 2000) {
          return { status: 'WARN', message: `Success message dismisses in ${ms}ms — too fast`, fixSuggestion: 'Show success messages for at least 3-4 seconds to ensure users see them.' }
        }
      }
      return { status: 'PASS', message: 'Toast timing appears reasonable' }
    },
  },
  {
    id: 'fe-006',
    slug: 'no-char-limit-inputs',
    category: 'FRONTEND',
    name: 'No character limit on text inputs',
    description: 'Checks for maxlength attributes on text inputs and textareas.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const inputs = await page.$$('input[type="text"], input[type="email"], textarea')
      if (inputs.length === 0) return { status: 'SKIP', message: 'No text inputs found' }
      let unlimitedCount = 0
      for (const input of inputs.slice(0, 10)) {
        const maxLength = await input.getAttribute('maxlength')
        const maxLen = await input.getAttribute('maxLength')
        if (!maxLength && !maxLen) unlimitedCount++
      }
      if (unlimitedCount > inputs.length / 2) {
        return { status: 'WARN', message: `${unlimitedCount} inputs without maxlength restriction`, fixSuggestion: 'Add maxlength attributes or character counters to prevent oversized submissions.' }
      }
      return { status: 'PASS', message: 'Most inputs have length restrictions' }
    },
  },
  {
    id: 'fe-007',
    slug: 'date-not-localized',
    category: 'FRONTEND',
    name: 'Date format not localized',
    description: 'Checks if dates use hardcoded format instead of locale-aware formatting.',
    severity: 'LOW',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const source = await page.content()
      const hasLocaleDate = source.includes('toLocaleDateString') || source.includes('Intl.DateTimeFormat') || source.includes('format(')
      const hasHardcodedDate = /\d{4}-\d{2}-\d{2}/.test(await page.evaluate(() => document.body.innerText))
      if (hasHardcodedDate && !hasLocaleDate) {
        return { status: 'WARN', message: 'Dates appear hardcoded without localization', fixSuggestion: 'Use toLocaleDateString() or Intl.DateTimeFormat for locale-aware date display.' }
      }
      return { status: 'PASS', message: 'Date formatting appears locale-aware' }
    },
  },
  {
    id: 'fe-008',
    slug: 'number-not-localized',
    category: 'FRONTEND',
    name: 'Number format not localized',
    description: 'Checks if large numbers use locale-appropriate formatting.',
    severity: 'LOW',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const source = await page.content()
      const hasLocaleNum = source.includes('toLocaleString') || source.includes('Intl.NumberFormat')
      const bodyText = await page.evaluate(() => document.body.innerText)
      const hasLargeNumbers = /\d{4,}/.test(bodyText)
      if (hasLargeNumbers && !hasLocaleNum) {
        return { status: 'WARN', message: 'Large numbers without locale formatting detected', fixSuggestion: 'Use toLocaleString() or Intl.NumberFormat for currency and large number display.' }
      }
      return { status: 'PASS', message: 'Number formatting appears adequate' }
    },
  },
  {
    id: 'fe-009',
    slug: 'toast-stack-unlimited',
    category: 'FRONTEND',
    name: 'Toast notifications stack without limit',
    description: 'Checks if toast system has a maximum display count.',
    severity: 'LOW',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const source = await page.content()
      const hasToastLimit = source.includes('maxToasts') || source.includes('limit') || source.includes('MAX_TOASTS')
      const toastContainers = await page.$$('[class*="toast"], [role="status"], [aria-live]')
      if (toastContainers.length > 5) {
        return { status: 'WARN', message: `${toastContainers.length} toast containers — check for stack limit`, fixSuggestion: 'Limit toast notifications to 3-5 at a time and auto-dismiss older ones.' }
      }
      return { status: 'PASS', message: 'Toast count appears reasonable' }
    },
  },
  {
    id: 'fe-010',
    slug: 'modal-no-escape',
    category: 'FRONTEND',
    name: 'Modal does not close on Escape',
    description: 'Checks if modals/dialogs handle the Escape key.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const modal = await page.$('[role="dialog"], [role="alertdialog"]')
      if (!modal) return { status: 'SKIP', message: 'No modals found on page' }
      const source = await page.content()
      const hasEscapeHandler = source.includes('Escape') || source.includes('keydown') || source.includes('onKeyDown')
      if (!hasEscapeHandler) {
        return { status: 'WARN', message: 'Modal present without detected Escape key handler', fixSuggestion: 'Add keydown event listener for Escape to close modals.' }
      }
      return { status: 'PASS', message: 'Escape key handling detected for modals' }
    },
  },
  {
    id: 'fe-011',
    slug: 'clipboard-no-https',
    category: 'FRONTEND',
    name: 'Copy-to-clipboard on non-HTTPS',
    description: 'Checks if clipboard API is used on pages not served over HTTPS.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const source = await page.content()
      const hasClipboard = source.includes('clipboard') || source.includes('copy')
      if (hasClipboard && !url.startsWith('https://')) {
        return { status: 'FAIL', message: 'Clipboard API used on non-HTTPS page (will fail in most browsers)', fixSuggestion: 'Clipboard API requires HTTPS. Serve your app over HTTPS.' }
      }
      return { status: 'PASS', message: 'Clipboard usage compatible with HTTPS' }
    },
  },
  {
    id: 'fe-012',
    slug: 'delete-no-confirm',
    category: 'FRONTEND',
    name: 'Delete action with no confirmation',
    description: 'Checks if delete buttons trigger immediate action without confirmation.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const deleteButtons = await page.$$('button:has-text("Delete"), button:has-text("Remove"), [aria-label*="delete"]')
      if (deleteButtons.length === 0) return { status: 'SKIP', message: 'No delete buttons found' }
      const hasConfirm = await page.$('[role="dialog"], [role="alertdialog"], [class*="confirm"]')
      if (!hasConfirm) {
        return { status: 'WARN', message: 'Delete buttons found without confirmation dialog', fixSuggestion: 'Always confirm destructive actions with a modal or popover.' }
      }
      return { status: 'PASS', message: 'Delete actions have confirmation' }
    },
  },
  {
    id: 'fe-013',
    slug: 'back-button-breaks-state',
    category: 'FRONTEND',
    name: 'Back button breaks state',
    description: 'Checks if browser history is managed correctly for multi-step flows.',
    severity: 'MEDIUM',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const source = await page.content()
      const hasHistoryManagement = source.includes('useRouter') || source.includes('history.push') || source.includes('window.history') || source.includes('popstate')
      if (!hasHistoryManagement) {
        return { status: 'WARN', message: 'No browser history management detected', fixSuggestion: 'Use Next.js router.push() and handle the popstate event for multi-step flows.' }
      }
      return { status: 'PASS', message: 'History management detected' }
    },
  },
  {
    id: 'fe-014',
    slug: 'console-errors-on-load',
    category: 'FRONTEND',
    name: 'Console errors present on page load',
    description: 'Reports any console errors captured during page load.',
    severity: 'HIGH',
    stacks: ['all'],
    run: async (page, url, ctx) => {
      const errors = ctx.consoleErrors.filter((e) => !e.includes('favicon') && !e.includes('third-party'))
      if (errors.length > 0) {
        return {
          status: 'FAIL',
          message: `${errors.length} console error(s) on page load`,
          detail: errors.slice(0, 5).join('\n'),
          fixSuggestion: 'Fix all console errors. They indicate runtime issues visible to users in dev tools.',
        }
      }
      return { status: 'PASS', message: 'No console errors on page load' }
    },
  },
]