import { expect } from 'vitest'

// Mock jQuery for tests
global.$ = (selector) => {
  if (typeof selector === 'string') {
    // Simple DOM query
    const elements = document.querySelectorAll(selector)
    const jqueryLike = Array.from(elements)
    jqueryLike.jquery = '3.6.0' // Mark as jQuery object
    return jqueryLike
  } else if (selector && selector.nodeType) {
    // Wrap DOM element
    const jqueryLike = [selector]
    jqueryLike.jquery = '3.6.0'
    return jqueryLike
  }
  // Empty jQuery object
  const jqueryLike = []
  jqueryLike.jquery = '3.6.0'
  return jqueryLike
}

// Custom matchers for Vitest (replacing Jasmine matchers)
expect.extend({
  toHaveLength(received, expected) {
    const pass = received.length === expected
    return {
      pass,
      message: () =>
        pass
          ? `Expected length not to be ${expected}`
          : `Expected length to be ${expected}, but got ${received.length}`
    }
  },

  toHaveBeenCalledWithContext(received, expectedContext) {
    if (!received.mock) {
      throw new Error(
        'toHaveBeenCalledWithContext must be used with a spy/mock function'
      )
    }

    const pass = received.mock.contexts.some(
      (context) => context === expectedContext
    )
    return {
      pass,
      message: () =>
        pass
          ? `Expected function not to have been called with context ${expectedContext}`
          : `Expected function to have been called with context ${expectedContext}`
    }
  },

  toHaveItems(received, expected) {
    if (!Array.isArray(received) || !Array.isArray(expected)) {
      return {
        pass: false,
        message: () => 'Both received and expected must be arrays'
      }
    }

    if (received.length !== expected.length) {
      return {
        pass: false,
        message: () =>
          `Expected array length ${expected.length}, but got ${received.length}`
      }
    }

    const pass = received.every((item) =>
      expected.some(
        (expectedItem) => JSON.stringify(item) === JSON.stringify(expectedItem)
      )
    )

    return {
      pass,
      message: () =>
        pass
          ? 'Expected arrays not to have the same items'
          : `Expected arrays to have the same items.\nReceived: ${JSON.stringify(
              received,
              null,
              2
            )}\nExpected: ${JSON.stringify(expected, null, 2)}`
    }
  },

  toBeInstanceOf(received, expected) {
    const pass = received instanceof expected
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be instance of ${expected.name}`
          : `Expected ${received} to be instance of ${expected.name}`
    }
  },

  toBeAPromise(received) {
    const pass = received && typeof received.then === 'function'
    return {
      pass,
      message: () =>
        pass
          ? 'Expected value not to be a promise'
          : 'Expected value to be a promise'
    }
  },

  toBeANumber(received) {
    const pass = typeof received === 'number' && !isNaN(received)
    return {
      pass,
      message: () =>
        pass
          ? 'Expected value not to be a number'
          : 'Expected value to be a number'
    }
  }
})

// Mock console for tests
const originalConsole = global.console
global.console = {
  ...originalConsole,
  warn: vi.fn(),
  error: vi.fn()
}
