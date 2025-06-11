/*
neovalidate - ES6+ fork of Validate.js, a declarative validation library
(c) 2025 pokeghost
Licensed under MIT License

Based on validate.js 0.13.1
http://validatejs.org/
(c) 2013-2019 Nicklas Ansman, 2013 Wrapp
*/

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { beforeAll, afterAll } from 'vitest'
import { JSDOM } from 'jsdom'
import Validator from '../src/validator.js'

const createJQueryMock = (element) => {
  if (typeof element === 'string') {
    return [document.querySelector(element)]
  }
  // Mock jQuery-like object
  return {
    0: element,
    length: element ? 1 : 0,
    jquery: '3.6.0'
  }
}

beforeAll(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
  })

  global.document = dom.window.document
  global.window = dom.window
  global.HTMLElement = dom.window.HTMLElement
})

afterAll(() => {
  delete global.document
  delete global.window
  delete global.HTMLElement
})

expect.extend({
  toHaveLength(received, expected) {
    const pass = received.length === expected
    return {
      message: () => `expected ${received} to have length ${expected}`,
      pass
    }
  },
  toHaveBeenCalledWithContext(received, expected) {
    const pass = received.mock.instances.some(
      (instance) => instance === expected
    )
    return {
      message: () =>
        `expected function to have been called with context ${expected}`,
      pass
    }
  },
  toHaveItems(received, expected) {
    if (received.length !== expected.length) {
      return { pass: false, message: () => 'Arrays have different lengths' }
    }

    const pass = received.every((a) =>
      expected.some((e) => JSON.stringify(a) === JSON.stringify(e))
    )

    return {
      message: () =>
        `expected ${JSON.stringify(received)} to contain items ${JSON.stringify(
          expected
        )}`,
      pass
    }
  },
  toBeInstanceOf(received, expected) {
    return {
      message: () => `expected ${received} to be instance of ${expected}`,
      pass: received instanceof expected
    }
  },
  toBeAPromise(received) {
    return {
      message: () => `expected ${received} to be a promise`,
      pass: received && typeof received.then === 'function'
    }
  },
  toBeANumber(received) {
    return {
      message: () => `expected ${received} to be a number`,
      pass: typeof received === 'number' && !isNaN(received)
    }
  }
})

describe('Validator', () => {
  let validator

  beforeEach(() => {
    validator = new Validator()
  })

  describe('basic validation', () => {
    let fail, fail2, pass, pass2

    beforeEach(() => {
      fail = vi.fn().mockReturnValue('my error')
      fail2 = vi.fn().mockReturnValue('my error')
      pass = vi.fn()
      pass2 = vi.fn()
      Validator.validators.pass = pass
      Validator.validators.pass2 = pass2
      Validator.validators.fail = fail
      Validator.validators.fail2 = fail2
    })

    afterEach(() => {
      delete Validator.validators.fail
      delete Validator.validators.fail2
      delete Validator.validators.pass
      delete Validator.validators.pass2
    })

    it('raises an error if a promise is returned', () => {
      fail.mockReturnValue(new Promise(() => {}))
      const constraints = { name: { fail: true } }
      expect(() => {
        validator.validate({}, constraints)
      }).toThrow()
    })

    it("doesn't fail if the value is a promise", () => {
      const constraints = { name: { pass: true } }
      expect(
        validator.validate({ name: Promise.resolve() }, constraints)
      ).toBeUndefined()
    })

    it('runs as expected', () => {
      const attributes = {
        name: 'Nicklas Ansman',
        email: 'nicklas@ansman.se',
        addresses: {
          work: {
            street: 'Drottninggatan 98',
            city: 'Stockholm'
          }
        }
      }
      const constraints = {
        name: {
          pass: true
        },
        email: {
          pass: true,
          fail: true,
          fail2: true
        },
        'addresses.work.street': {
          pass: true,
          fail2: true
        },
        'addresses.work.city': {
          pass: true
        }
      }

      fail.mockReturnValue('must be a valid email address')
      fail2.mockReturnValue('is simply not good enough')

      expect(validator.validate(attributes, constraints)).toEqual({
        email: [
          'Email must be a valid email address',
          'Email is simply not good enough'
        ],
        'addresses.work.street': [
          'Addresses work street is simply not good enough'
        ]
      })

      expect(
        validator.validate(attributes, constraints, { format: 'flat' })
      ).toEqual([
        'Email must be a valid email address',
        'Email is simply not good enough',
        'Addresses work street is simply not good enough'
      ])
    })

    it('works with nested objects set to null', () => {
      const constraints = {
        'foo.bar': {
          presence: true
        }
      }
      expect(validator.validate({ foo: null }, constraints)).toBeDefined()
    })
  })

  describe('async validation', () => {
    let originalPromise

    beforeEach(() => {
      originalPromise = Validator.Promise

      Validator.validators.asyncFailReject = function () {
        return new Promise(function (_, reject) {
          setTimeout(function () {
            reject('failz')
          }, 1)
        })
      }

      Validator.validators.asyncFail = function () {
        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve('failz')
          }, 1)
        })
      }

      Validator.validators.asyncSuccess = function () {
        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve()
          }, 1)
        })
      }
    })

    afterEach(() => {
      delete Validator.validators.asyncFailReject
      delete Validator.validators.asyncFail
      delete Validator.validators.asyncSuccess
      delete Validator.validators.asyncError
      Validator.Promise = originalPromise
    })

    it('makes validateAsync return a promise', async () => {
      const promise = validator.validateAsync({}, {})
      expect(promise).toBeAPromise()
      await promise
    })

    it('throws an error if no promise is found', async () => {
      Validator.Promise = null
      await expect(async () => {
        await validator.validateAsync({}, {})
      }).rejects.toThrow('Promise support is required for async validation')
    })

    it('resolves the promise if all constraints pass', async () => {
      const attrs = { foo: 'bar' }
      const constraints = { foo: { presence: true } }
      const result = await validator.validateAsync(attrs, constraints)
      expect(result).toEqual(attrs)
    })

    it('rejects the promise if any constraint fails', async () => {
      const c = { name: { presence: true } }
      await expect(validator.validateAsync({}, c)).rejects.toBeDefined()
    })

    it('handles validators returning a promise', async () => {
      const c = {
        name: {
          asyncFail: true,
          asyncSuccess: true
        }
      }
      await expect(validator.validateAsync({}, c)).rejects.toEqual({
        name: ['Name failz']
      })
    })

    it('supports fullMessages: false', async () => {
      const c = { name: { presence: true } }
      await expect(
        validator.validateAsync({}, c, { fullMessages: false })
      ).rejects.toEqual({
        name: ["can't be blank"]
      })
    })
  })

  describe('helper functions', () => {
    describe('extend', () => {
      it('extends the first argument with the remaining arguments', () => {
        const obj = {}
        Validator.extend(obj, { foo: 'foo' }, { bar: 'bar' })
        expect(obj).toEqual({ foo: 'foo', bar: 'bar' })
      })

      it('returns the first argument', () => {
        const obj = {}
        expect(Validator.extend(obj)).toBe(obj)
      })

      it('extends with the seconds argument first', () => {
        const actual = Validator.extend({}, { foo: 'foo' }, { foo: 'bar' })
        expect(actual).toEqual({ foo: 'bar' })
      })
    })

    describe('result', () => {
      it("returns the first argument if it's not a function", () => {
        const obj = {}
        expect(Validator.result(obj)).toBe(obj)
      })

      it("calls the argument if it's a function and returns the result", () => {
        const obj = vi.fn().mockReturnValue('some return value')
        expect(Validator.result(obj)).toEqual('some return value')
      })

      it('accepts additional arguments as arguments to the function', () => {
        const obj = vi.fn()
        Validator.result(obj, 'foo', 'bar', 'baz')
        expect(obj).toHaveBeenCalledWith('foo', 'bar', 'baz')
      })
    })

    describe('isNumber', () => {
      it('returns true for numbers', () => {
        expect(Validator.isNumber(0)).toBe(true)
        expect(Validator.isNumber(1)).toBe(true)
        expect(Validator.isNumber(Math.PI)).toBe(true)
      })

      it('returns false for non numbers', () => {
        expect(Validator.isNumber(null)).toBe(false)
        expect(Validator.isNumber(true)).toBe(false)
        expect(Validator.isNumber('1')).toBe(false)
      })
    })

    describe('isInteger', () => {
      it('returns true for integers', () => {
        expect(Validator.isInteger(0)).toBe(true)
        expect(Validator.isInteger(1)).toBe(true)
      })

      it('returns false for floats and other types', () => {
        expect(Validator.isInteger(Math.PI)).toBe(false)
        expect(Validator.isInteger(null)).toBe(false)
        expect(Validator.isInteger('1')).toBe(false)
      })
    })

    describe('isBoolean', () => {
      it('returns true for booleans', () => {
        expect(Validator.isBoolean(true)).toBe(true)
        expect(Validator.isBoolean(false)).toBe(true)
      })

      it('returns false for non booleans', () => {
        expect(Validator.isBoolean(null)).toBe(false)
        expect(Validator.isBoolean({})).toBe(false)
        expect(Validator.isBoolean({ foo: 'bar' })).toBe(false)
        expect(Validator.isBoolean([])).toBe(false)
        expect(Validator.isBoolean('')).toBe(false)
        expect(Validator.isBoolean(function () {})).toBe(false)
      })
    })

    describe('isObject', () => {
      it('returns true for objects', () => {
        expect(Validator.isObject({})).toBe(true)
        expect(Validator.isObject({ foo: 'bar' })).toBe(true)
        expect(Validator.isObject([])).toBe(true)
        expect(Validator.isObject(function () {})).toBe(true)
      })

      it('returns false for non objects', () => {
        expect(Validator.isObject(null)).toBe(false)
        expect(Validator.isObject(1)).toBe(false)
        expect(Validator.isObject('')).toBe(false)
        expect(Validator.isObject(false)).toBe(false)
      })
    })

    describe('isDefined', () => {
      it('returns false for null and undefined', () => {
        expect(Validator.isDefined(null)).toBe(false)
        expect(Validator.isDefined(undefined)).toBe(false)
      })

      it('returns true for other values', () => {
        expect(Validator.isDefined(true)).toBe(true)
        expect(Validator.isDefined(0)).toBe(true)
        expect(Validator.isDefined('')).toBe(true)
      })
    })

    describe('isPromise', () => {
      it('returns false for null and undefined', () => {
        expect(Validator.isPromise(null)).toBe(false)
        expect(Validator.isPromise(undefined)).toBe(false)
      })

      it('returns false for objects', () => {
        expect(Validator.isPromise({})).toBe(false)
      })

      it('returns true for objects with a then function', () => {
        expect(Validator.isPromise({ then: 'that' })).toBe(false)
        expect(Validator.isPromise({ then: function () {} })).toBe(true)
      })
    })

    describe('format', () => {
      it('replaces %{...} with the correct value', () => {
        const actual = Validator.format('Foo is %{foo}, bar is %{bar}', {
          foo: 'foo',
          bar: 'bar'
        })
        expect(actual).toEqual('Foo is foo, bar is bar')
      })

      it('can replace the same value multiple times', () => {
        const actual = Validator.format('%{foo} %{foo}', { foo: 'foo' })
        expect(actual).toEqual('foo foo')
      })

      it('supports escaping %', () => {
        const actual = Validator.format('Foo is %%{foo}', { foo: 'foo' })
        expect(actual).toEqual('Foo is %{foo}')
      })

      it('handles non strings as the message', () => {
        const obj = { foo: 'bar' }
        expect(Validator.format(obj, { attr: 'value' })).toBe(obj)
      })
    })

    describe('prettify', () => {
      it('lower cases the entire string', () => {
        expect(Validator.prettify('FOO BAR')).toEqual('foo bar')
      })

      it('replaces underscores with spaces', () => {
        expect(Validator.prettify('foo_bar_baz')).toEqual('foo bar baz')
      })

      it('replaces dashes with spaces', () => {
        expect(Validator.prettify('foo-bar-baz')).toEqual('foo bar baz')
      })

      it('splits camel cased words', () => {
        expect(Validator.prettify('fooBar')).toEqual('foo bar')
      })

      it('replaces periods with spaces if no space follows', () => {
        expect(Validator.prettify('foo.bar.baz')).toEqual('foo bar baz')
        expect(Validator.prettify('foo. bar')).toEqual('foo. bar')
        expect(Validator.prettify('foo .bar')).toEqual('foo .bar')
        expect(Validator.prettify('foo.bar.')).toEqual('foo bar.')
      })

      it('replaces backslashes with nothing', () => {
        expect(Validator.prettify('foo\\.bar\\.baz')).toEqual('foo bar baz')
        expect(Validator.prettify('foo\\\\.bar')).toEqual('foo bar')
      })

      it("doesn't allow too many decimals", () => {
        expect(Validator.prettify(4711)).toEqual('4711')
        expect(Validator.prettify(4711.2)).toEqual('4711.2')
        expect(Validator.prettify(4711.255555)).toEqual('4711.26')
      })

      it('handles arrays', () => {
        const array = ['foo', 'bar_baz']
        expect(Validator.prettify(array)).toEqual('foo, bar baz')
      })
    })

    describe('isEmpty', () => {
      it('considers null and undefined values empty', () => {
        expect(Validator.isEmpty(null)).toBe(true)
        expect(Validator.isEmpty(undefined)).toBe(true)
      })

      it('considers functions non empty', () => {
        expect(Validator.isEmpty(function () {})).toBe(false)
      })

      it('considers whitespace only strings empty', () => {
        expect(Validator.isEmpty('')).toBe(true)
        expect(Validator.isEmpty(' ')).toBe(true)
        expect(Validator.isEmpty('         ')).toBe(true)
        expect(Validator.isEmpty('foo')).toBe(false)
      })

      it('considers empty arrays empty', () => {
        expect(Validator.isEmpty([])).toBe(true)
        expect(Validator.isEmpty([1])).toBe(false)
      })

      it('considers empty objects empty', () => {
        expect(Validator.isEmpty({})).toBe(true)
        expect(Validator.isEmpty({ foo: 'bar' })).toBe(false)
      })

      it('considers false and 0 non empty', () => {
        expect(Validator.isEmpty(false)).toBe(false)
        expect(Validator.isEmpty(0)).toBe(false)
      })

      it('considers date non empty', () => {
        expect(Validator.isEmpty(new Date())).toBe(false)
      })
    })

    describe('getDeepObjectValue', () => {
      it('supports multiple keys separated using a period', () => {
        const attributes = {
          foo: {
            bar: {
              baz: 3
            }
          }
        }

        expect(Validator.getDeepObjectValue(attributes, 'foo.bar.baz')).toBe(3)
      })

      it('returns undefined if any key is not found', () => {
        const attributes = {
          foo: {
            bar: {
              baz: 3
            }
          }
        }

        expect(Validator.getDeepObjectValue(attributes, 'bar.foo')).toBe(
          undefined
        )
        expect(Validator.getDeepObjectValue(attributes, 'foo.baz')).toBe(
          undefined
        )
      })

      it('handles the object being non objects', () => {
        expect(Validator.getDeepObjectValue(null, 'foo')).toBe(undefined)
        expect(Validator.getDeepObjectValue('foo', 'foo')).toBe(undefined)
        expect(Validator.getDeepObjectValue(3, 'foo')).toBe(undefined)
        expect(Validator.getDeepObjectValue([], 'foo')).toBe(undefined)
        expect(Validator.getDeepObjectValue(true, 'foo')).toBe(undefined)
      })

      it('handles the keypath being non strings', () => {
        expect(Validator.getDeepObjectValue({}, null)).toBe(undefined)
        expect(Validator.getDeepObjectValue({}, 3)).toBe(undefined)
        expect(Validator.getDeepObjectValue({}, {})).toBe(undefined)
        expect(Validator.getDeepObjectValue({}, [])).toBe(undefined)
        expect(Validator.getDeepObjectValue({}, true)).toBe(undefined)
      })

      it('handles escapes properly', () => {
        const attributes = {
          'foo.bar': {
            baz: 3
          },
          'foo\\': {
            bar: {
              baz: 5
            }
          }
        }

        expect(Validator.getDeepObjectValue(attributes, 'foo.bar.baz')).toBe(
          undefined
        )

        expect(Validator.getDeepObjectValue(attributes, 'foo\\.bar.baz')).toBe(
          3
        )

        expect(
          Validator.getDeepObjectValue(attributes, 'foo\\\\.bar.baz')
        ).toBe(5)

        expect(
          Validator.getDeepObjectValue(attributes, '\\foo\\\\.bar.baz')
        ).toBe(5)
      })
    })
  })

  describe('single validation', () => {
    it('validates the single property', () => {
      const validators = {
        presence: {
          message: 'example message'
        },
        length: {
          is: 6,
          message: '^It needs to be 6 characters long'
        }
      }

      expect(validator.single(null, validators)).toEqual(['example message'])
      expect(validator.single('foo', validators)).toEqual([
        'It needs to be 6 characters long'
      ])
      expect(validator.single('foobar', validators)).toBeUndefined()
    })

    it("doesn't support the format and fullMessages options", () => {
      const validators = { presence: true }
      const options = { format: 'detailed', fullMessages: true }

      expect(validator.single(null, validators, options)).toEqual([
        "can't be blank"
      ])
    })
  })

  describe('validators', () => {
    describe('presence', () => {
      const presence = Validator.validators.presence.bind(
        Validator.validators.presence
      )

      afterEach(() => {
        delete Validator.validators.presence.message
        delete Validator.validators.presence.options
      })

      it("doesn't allow undefined values", () => {
        expect(presence(null, {})).toBeDefined()
        expect(presence(undefined, {})).toBeDefined()
      })

      it('allows non empty values', () => {
        expect(presence('foo', {})).toBeUndefined()
        expect(presence(0, {})).toBeUndefined()
        expect(presence(false, {})).toBeUndefined()
        expect(presence([null], {})).toBeUndefined()
        expect(presence({ foo: null }, {})).toBeUndefined()
        expect(
          presence(function () {
            return null
          }, {})
        ).toBeUndefined()
        expect(presence('', {})).toBeUndefined()
        expect(presence('  ', {})).toBeUndefined()
        expect(presence([], {})).toBeUndefined()
        expect(presence({}, {})).toBeUndefined()
      })

      it('has a nice default message', () => {
        const msg = presence(null, {})
        expect(msg).toEqual("can't be blank")
      })

      it('has an option for not allowing empty values', () => {
        expect(presence('', { allowEmpty: false })).toBeDefined()
        expect(presence('  ', { allowEmpty: false })).toBeDefined()
        expect(presence([], { allowEmpty: false })).toBeDefined()
        expect(presence({}, { allowEmpty: false })).toBeDefined()
      })

      it('also allows to specify your own nice message', () => {
        Validator.validators.presence.message = 'default message'
        expect(presence(null, {})).toEqual('default message')
        expect(presence(null, { message: 'my message' })).toEqual('my message')
      })
    })

    describe('length', () => {
      const length = Validator.validators.length.bind(
        Validator.validators.length
      )

      afterEach(() => {
        delete Validator.validators.length.notValid
        delete Validator.validators.length.tooLong
        delete Validator.validators.length.tooShort
        delete Validator.validators.length.wrongLength
        delete Validator.validators.length.options
      })

      describe('is', () => {
        it('allows you to specify a fixed length the object has to be', () => {
          const value = { length: 10 }
          const options = { is: 10 }
          expect(length(value, options)).toBeUndefined()

          options.is = 11
          const expected = ['is the wrong length (should be 11 characters)']
          expect(length(value, options)).toEqual(expected)
        })
      })

      describe('minimum', () => {
        it('allows you to specify a minimum value', () => {
          const value = { length: 10 }
          const options = { minimum: 10 }
          expect(length(value, options)).toBeUndefined()

          options.minimum = 11
          const expected = ['is too short (minimum is 11 characters)']
          expect(length(value, options)).toEqual(expected)
        })
      })

      describe('maximum', () => {
        it('allows you to specify a maximum value', () => {
          const value = { length: 11 }
          const options = { maximum: 11 }
          expect(length(value, options)).toBeUndefined()

          options.maximum = 10
          const expected = ['is too long (maximum is 10 characters)']
          expect(length(value, options)).toEqual(expected)
        })
      })

      it('allows empty values', () => {
        const options = { is: 10, minimum: 20, maximum: 5 }
        expect(length(null, options)).toBeUndefined()
        expect(length(undefined, options)).toBeUndefined()
      })

      it('refuses values without a numeric length property', () => {
        const options = { is: 10, minimum: 10, maximum: 20 }
        expect(length(3.1415, options)).toBeDefined()
        expect(length(-3.1415, options)).toBeDefined()
        expect(length(0, options)).toBeDefined()
        expect(length({ foo: 'bar' }, options)).toBeDefined()
        expect(length({ lengthi: 10 }, options)).toBeDefined()
        expect(length({ length: 'foo' }, options)).toBeDefined()
        expect(length(3, {})).toBeDefined()
      })
    })

    describe('numericality', () => {
      const numericality = Validator.validators.numericality.bind(
        Validator.validators.numericality
      )

      afterEach(() => {
        const n = Validator.validators.numericality
        delete n.message
        delete n.notValid
        delete n.notInteger
        delete n.notOdd
        delete n.notEven
        delete n.notGreaterThan
        delete n.notGreaterThanOrEqualTo
        delete n.notEqualTo
        delete n.notLessThan
        delete n.notLessThanOrEqualTo
        delete n.notDivisibleBy
        delete n.options
      })

      it('allows empty values', () => {
        expect(numericality(null, {})).toBeUndefined()
        expect(numericality(undefined, {})).toBeUndefined()
      })

      it('allows numbers', () => {
        expect(numericality(3.14, {})).toBeUndefined()
        expect(numericality('3.14', {})).toBeUndefined()
      })

      it("doesn't allow non numbers", () => {
        const e = 'is not a number'
        expect(numericality('', {})).toEqual(e)
        expect(numericality('  ', {})).toEqual(e)
        expect(numericality('foo', {})).toEqual(e)
        expect(numericality(NaN, {})).toEqual(e)
        expect(numericality(false, {})).toEqual(e)
        expect(numericality([1], {})).toEqual(e)
        expect(numericality({ foo: 'bar' }, {})).toEqual(e)
      })

      it("doesn't allow strings if noStrings is true", () => {
        expect(numericality('3.14', { noStrings: true })).toBeDefined()
      })

      describe('onlyInteger', () => {
        it('allows integers', () => {
          expect(numericality(1, { onlyInteger: true })).toBeUndefined()
        })

        it("doesn't allow real numbers", () => {
          const expected = 'must be an integer'
          expect(numericality(3.14, { onlyInteger: true })).toEqual(expected)
        })
      })

      describe('greaterThan', () => {
        it('allows numbers that are greater than', () => {
          expect(numericality(3.14, { greaterThan: 2.72 })).toBeUndefined()
        })

        it("doesn't allow numbers that are smaller than or equal to", () => {
          const expected = ['must be greater than 3.14']
          expect(numericality(3.14, { greaterThan: 3.14 })).toEqual(expected)
          expect(numericality(2.72, { greaterThan: 3.14 })).toEqual(expected)
        })
      })

      describe('strict', () => {
        it('disallows prefixed zeros', () => {
          expect(numericality('01.0', { strict: true })).toEqual(
            'must be a valid number'
          )
          expect(numericality('0001.0000000', { strict: true })).toEqual(
            'must be a valid number'
          )
          expect(numericality('020', { strict: true })).toEqual(
            'must be a valid number'
          )

          expect(numericality('1.00', { strict: true })).toBeUndefined()
          expect(numericality('1.0', { strict: true })).toBeUndefined()
          expect(numericality(10, { strict: true })).toBeUndefined()
          expect(numericality('10', { strict: true })).toBeUndefined()
          expect(numericality('0.1', { strict: true })).toBeUndefined()
          expect(numericality('0', { strict: true })).toBeUndefined()
          expect(numericality('-3', { strict: true })).toBeUndefined()
        })
      })
    })

    describe('email', () => {
      const email = Validator.validators.email.bind(Validator.validators.email)

      afterEach(() => {
        delete Validator.validators.email.message
        delete Validator.validators.email.options
      })

      it('allows undefined values', () => {
        expect(email(null, {})).toBeUndefined()
        expect(email(undefined, {})).toBeUndefined()
      })

      it("doesn't allow non strings", () => {
        expect(email(3.14, {})).toBeDefined()
        expect(email(true, {})).toBeDefined()
      })

      it('allows valid emails', () => {
        expect(email('nicklas@ansman.se', {})).toBeUndefined()
        expect(email('NiCkLaS@AnSmAn.Se', {})).toBeUndefined()
        expect(email('niceandsimple@example.com', {})).toBeUndefined()
        expect(email('very.common@example.com', {})).toBeUndefined()
        expect(
          email('a.little.lengthy.but.fine@dept.example.com', {})
        ).toBeUndefined()
        expect(
          email('disposable.style.email.with+symbol@example.com', {})
        ).toBeUndefined()
        expect(email('other.email-with-dash@example.com', {})).toBeUndefined()
        expect(email('foo@some.customtld', {})).toBeUndefined()
      })

      it("doesn't allow 'invalid' emails", () => {
        const expected = 'is not a valid email'
        expect(email('', {})).toEqual(expected)
        expect(email(' ', {})).toEqual(expected)
        expect(email('foobar', {})).toEqual(expected)
        expect(email('foo@bar', {})).toEqual(expected)
        expect(email('üñîçøðé@example.com', {})).toEqual(expected)
        expect(email('abc.example.com', {})).toEqual(expected)
        expect(email('a@b@c@example.com', {})).toEqual(expected)
      })
    })

    describe('equality', () => {
      const equality = Validator.validators.equality.bind(
        Validator.validators.equality
      )

      afterEach(() => {
        delete Validator.validators.equality.message
        delete Validator.validators.equality.options
      })

      it('allows empty values', () => {
        expect(equality(null, 'bar', 'foo', {})).toBeUndefined()
        expect(equality(undefined, 'bar', 'foo', {})).toBeUndefined()
      })

      it('supports equality with another attribute', () => {
        expect(equality('', 'bar', 'foo', { foo: 'foo' })).toBeDefined()
        expect(equality('  ', 'bar', 'foo', { foo: 'foo' })).toBeDefined()
        expect(equality('foo', 'bar', 'foo', { foo: 'foo' })).toBeDefined()
        expect(
          equality('foo', 'bar', 'foo', { foo: 'foo', bar: 'bar' })
        ).toBeDefined()
        expect(
          equality('foo', 'bar', 'foo', { foo: 'foo', bar: 'foo' })
        ).toBeUndefined()

        expect(equality(1, 'bar', 'foo', { foo: 1 })).toBeDefined()
        expect(equality(1, 'bar', 'foo', { foo: 1, bar: 2 })).toBeDefined()
        expect(equality(1, 'bar', 'foo', { foo: 1, bar: 1 })).toBeUndefined()
      })

      it('has a nice default message', () => {
        expect(equality('foo', 'fooBar', 'foo', { foo: 'foo' })).toEqual(
          'is not equal to foo bar'
        )
      })

      it('supports nested objects', () => {
        expect(equality('foo', 'bar.baz', 'foo', { foo: 'foo' })).toBeDefined()
        expect(
          equality('foo', 'bar.baz', 'foo', { foo: 'foo', bar: { baz: 'baz' } })
        ).toBeDefined()
        expect(
          equality('foo', 'bar.baz', 'foo', { foo: 'foo', bar: { baz: 'foo' } })
        ).toBeUndefined()
      })

      it("throws an error if the attribute option isn't provided", () => {
        expect(() => equality('foo', {}, 'foo', { foo: 'foo' })).toThrow()
        expect(() =>
          equality('foo', { attribute: null }, 'foo', { foo: 'foo' })
        ).toThrow()
        expect(() =>
          equality('foo', { attribute: 4711 }, 'foo', { foo: 'foo' })
        ).toThrow()
        expect(() =>
          equality('foo', { attribute: false }, 'foo', { foo: 'foo' })
        ).toThrow()
        expect(() =>
          equality('foo', { attribute: undefined }, 'foo', { foo: 'foo' })
        ).toThrow()
        expect(() =>
          equality('foo', { attribute: '' }, 'foo', { foo: 'foo' })
        ).toThrow()
      })
    })

    describe('inclusion', () => {
      const inclusion = Validator.validators.inclusion.bind(
        Validator.validators.inclusion
      )
      const within = ['foo', 'bar', 'baz']

      afterEach(() => {
        delete Validator.validators.inclusion.message
        delete Validator.validators.inclusion.options
      })

      it('allows empty values', () => {
        expect(inclusion(null, {})).toBeUndefined()
        expect(inclusion(undefined, {})).toBeUndefined()
      })

      it('returns nothing if the value is allowed', () => {
        const opts = { within }
        expect(inclusion('foo', opts)).toBeUndefined()
        expect(inclusion('bar', opts)).toBeUndefined()
        expect(inclusion('baz', opts)).toBeUndefined()
      })

      it('returns an error if the value is not included', () => {
        const opts = { within }
        expect(inclusion('', {})).toBeDefined()
        expect(inclusion(' ', {})).toBeDefined()
        expect(inclusion('quux', opts)).toEqual(
          '^quux is not included in the list'
        )
        expect(inclusion(false, opts)).toEqual(
          '^false is not included in the list'
        )
        expect(inclusion(1, opts)).toEqual('^1 is not included in the list')
      })

      it('uses the keys if the within value is an object', () => {
        expect(inclusion('foo', { within: { foo: true } })).toBeUndefined()
        expect(inclusion('bar', { within: { foo: true } })).toBeDefined()
      })

      it('uses the options as the within list if the options is an array', () => {
        expect(inclusion('foo', ['foo', 'bar'])).toBeUndefined()
        expect(inclusion('baz', ['foo', 'bar'])).toBeDefined()
      })
    })

    describe('exclusion', () => {
      const exclusion = Validator.validators.exclusion.bind(
        Validator.validators.exclusion
      )
      const within = ['foo', 'bar', 'baz']

      afterEach(() => {
        delete Validator.validators.exclusion.message
        delete Validator.validators.exclusion.options
      })

      it('allows undefined values', () => {
        expect(exclusion(null, {})).toBeUndefined()
        expect(exclusion(undefined, {})).toBeUndefined()
      })

      it('returns nothing if the value is allowed', () => {
        const opts = { within }
        expect(exclusion('', {})).toBeUndefined()
        expect(exclusion(' ', {})).toBeUndefined()
        expect(exclusion('quux', opts)).toBeUndefined()
        expect(exclusion(false, opts)).toBeUndefined()
        expect(exclusion(1, opts)).toBeUndefined()
      })

      it('returns an error if the value is not allowed', () => {
        const opts = { within }
        expect(exclusion('foo', opts)).toEqual('^foo is restricted')
        expect(exclusion('bar', opts)).toEqual('^bar is restricted')
        expect(exclusion('baz', opts)).toEqual('^baz is restricted')
      })

      it('uses the keys if the within value is an object', () => {
        expect(exclusion('foo', { within: { foo: true } })).toBeDefined()
        expect(exclusion('bar', { within: { foo: true } })).toBeUndefined()
      })

      it('uses the options as the within list if the options is an array', () => {
        expect(exclusion('foo', ['foo', 'bar'])).toBeDefined()
        expect(exclusion('baz', ['foo', 'bar'])).toBeUndefined()
      })
    })

    describe('format', () => {
      const format = Validator.validators.format.bind(
        Validator.validators.format
      )
      const options1 = { pattern: /^foobar$/i }
      const options2 = { pattern: '^foobar$', flags: 'i' }

      afterEach(() => {
        delete Validator.validators.format.message
        delete Validator.validators.format.options
      })

      it('allows undefined values', () => {
        expect(format(null, options1)).toBeUndefined()
        expect(format(null, options2)).toBeUndefined()
        expect(format(undefined, options1)).toBeUndefined()
        expect(format(undefined, options2)).toBeUndefined()
      })

      it('allows values that matches the pattern', () => {
        expect(format('fooBAR', options1)).toBeUndefined()
        expect(format('fooBAR', options2)).toBeUndefined()
      })

      it("doesn't allow values that doesn't matches the pattern", () => {
        expect(format('', options1)).toBeDefined()
        expect(format('', options2)).toBeDefined()
        expect(format(' ', options1)).toBeDefined()
        expect(format(' ', options2)).toBeDefined()
        expect(format('barfoo', options1)).toEqual('is invalid')
        expect(format('barfoo', options2)).toEqual('is invalid')
      })

      it('supports the options being the pattern', () => {
        expect(format('barfoo', options1.pattern)).toBeDefined()
        expect(format('barfoo', options2.pattern)).toBeDefined()
      })
    })

    describe('url', () => {
      const url = Validator.validators.url.bind(Validator.validators.url)

      afterEach(() => {
        delete Validator.validators.url.message
        delete Validator.validators.url.options
      })

      it('allows empty values', () => {
        expect(url(null, {})).toBeUndefined()
        expect(url(undefined, {})).toBeUndefined()
      })

      it("doesn't allow non strings", () => {
        expect(url(3.14, {})).toBeDefined()
        expect(url(true, {})).toBeDefined()
        expect(url({ key: "i'm a string" }, {})).toBeDefined()
      })

      it('allows valid urls', () => {
        expect(url('http://foo.com', {})).toBeUndefined()
        expect(url('http://foo.com/', {})).toBeUndefined()
        expect(url('http://foo.com/blah_blah', {})).toBeUndefined()
        expect(url('http://foo.com/blah_blah/', {})).toBeUndefined()
        expect(
          url('https://www.example.com/foo/?bar=baz&inga=42&quux', {})
        ).toBeUndefined()
        expect(
          url('http://userid:password@example.com:8080', {})
        ).toBeUndefined()
        expect(url('http://142.42.1.1/', {})).toBeUndefined()
        expect(url('http://142.42.1.1:8080/', {})).toBeUndefined()
      })

      it("doesn't allow 'invalid' urls", () => {
        expect(url('', {})).toBeDefined()
        expect(url(' ', {})).toBeDefined()
        expect(url('http://', {})).toBeDefined()
        expect(url('http://.', {})).toBeDefined()
        expect(url('http://..', {})).toBeDefined()
        expect(url('foo.com', {})).toBeDefined()
        expect(url('http://localhost', {})).toBeDefined()
      })

      it('allows local url and private networks if option is set', () => {
        expect(url('http://10.1.1.1', { allowLocal: true })).toBeUndefined()
        expect(url('http://172.16.1.123', { allowLocal: true })).toBeUndefined()
        expect(
          url('http://192.168.1.123', { allowLocal: true })
        ).toBeUndefined()
        expect(
          url('http://localhost/foo', { allowLocal: true })
        ).toBeUndefined()
        expect(
          url('http://localhost:4711/foo', { allowLocal: true })
        ).toBeUndefined()
      })

      it('allows data urls', () => {
        expect(
          url('data:,Hello%2C%20World!', { allowDataUrl: true })
        ).toBeUndefined()
        expect(
          url('data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D', {
            allowDataUrl: true
          })
        ).toBeUndefined()
        expect(
          url('data:text/html,%3Ch1%3EHello%2C%20World!%3C%2Fh1%3E', {
            allowDataUrl: true
          })
        ).toBeUndefined()
      })

      it('fails data urls without the option', () => {
        expect(
          url('data:,Hello%2C%20World!', { allowDataUrl: false })
        ).toBeDefined()
        expect(
          url('data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D', {
            allowDataUrl: false
          })
        ).toBeDefined()
        expect(
          url('data:text/html,%3Ch1%3EHello%2C%20World!%3C%2Fh1%3E', {
            allowDataUrl: false
          })
        ).toBeDefined()
      })

      it('allows custom schemes option is set', () => {
        const options = { schemes: ['ftp', 'jdbc'] }
        expect(url('ftp://foo.bar.com', options)).toBeUndefined()
        expect(url('jdbc://foo.bar.com', options)).toBeUndefined()
        expect(url('http://foo.bar.com', options)).toBeDefined()
      })
    })

    describe('type', () => {
      const type = Validator.validators.type.bind(Validator.validators.type)

      afterEach(() => {
        delete Validator.validators.type.message
        delete Validator.validators.type.options
        delete Validator.validators.type.types.custom
      })

      it('allows empty values', () => {
        expect(type(null, 'string', 'foo', {})).toBeUndefined()
        expect(type(undefined, 'string', 'foo', {})).toBeUndefined()
      })

      it('allows the correct type', () => {
        expect(type('', { type: 'string' }, 'foo', {})).toBeUndefined()
        expect(type({}, { type: 'object' }, 'foo', {})).toBeUndefined()
        expect(type([], { type: 'array' }, 'foo', {})).toBeUndefined()
        expect(type(1, { type: 'number' }, 'foo', {})).toBeUndefined()
        expect(type(1.1, { type: 'number' }, 'foo', {})).toBeUndefined()
        expect(type(1, { type: 'integer' }, 'foo', {})).toBeUndefined()
        expect(type(true, { type: 'boolean' }, 'foo', {})).toBeUndefined()
        expect(type(new Date(), { type: 'date' }, 'foo', {})).toBeUndefined()
      })

      it("doesn't allow the incorrect type", () => {
        expect(type(new Date(), { type: 'string' }, 'foo', {})).toBeDefined()
        expect(type('', { type: 'object' }, 'foo', {})).toBeDefined()
        expect(type([], { type: 'object' }, 'foo', {})).toBeDefined()
        expect(type({}, { type: 'array' }, 'foo', {})).toBeDefined()
        expect(type([], { type: 'number' }, 'foo', {})).toBeDefined()
        expect(type(1.1, { type: 'integer' }, 'foo', {})).toBeDefined()
        expect(type(1, { type: 'boolean' }, 'foo', {})).toBeDefined()
        expect(type(true, { type: 'date' }, 'foo', {})).toBeDefined()
      })

      it('has a nice default message', () => {
        expect(type(new Date(), { type: 'string' }, 'foo', {})).toBe(
          'must be of type string'
        )
        expect(type('', { type: 'object' }, 'foo', {})).toBe(
          'must be of type object'
        )
        expect(type({}, { type: 'array' }, 'foo', {})).toBe(
          'must be of type array'
        )
        expect(type([], { type: 'number' }, 'foo', {})).toBe(
          'must be of type number'
        )
        expect(type(1.1, { type: 'integer' }, 'foo', {})).toBe(
          'must be of type integer'
        )
        expect(type(1, { type: 'boolean' }, 'foo', {})).toBe(
          'must be of type boolean'
        )
        expect(type(true, { type: 'date' }, 'foo', {})).toBe(
          'must be of type date'
        )
      })

      it("throws if the type isn't valid", () => {
        expect(() => type('', {}, 'foo', {})).toThrow()
        expect(() => type('', 'invalid', 'foo', {})).toThrow()
      })
    })

    describe('datetime', () => {
      const datetime = Validator.validators.datetime.bind(
        Validator.validators.datetime
      )

      beforeEach(() => {
        Validator.validators.datetime.parse = function (value) {
          return Date.parse(value)
        }
        Validator.validators.datetime.format = function (value, options) {
          const date = new Date(value)
          if (options && options.dateOnly) {
            return date.toISOString().split('T')[0]
          }
          return date.toISOString()
        }
      })

      afterEach(() => {
        delete Validator.validators.datetime.notValid
        delete Validator.validators.datetime.tooEarly
        delete Validator.validators.datetime.tooLate
        delete Validator.validators.datetime.options
        Validator.validators.datetime.parse = null
        Validator.validators.datetime.format = null
      })

      it("throws an exception if format and parse isn't set", () => {
        const p = Validator.validators.datetime.parse
        const f = Validator.validators.datetime.format
        Validator.validators.datetime.parse = null
        Validator.validators.datetime.format = null

        expect(() => datetime(null, {})).toThrow()

        Validator.validators.datetime.parse = p
        expect(() => datetime(null, {})).toThrow()

        Validator.validators.datetime.parse = null
        Validator.validators.datetime.format = f
        expect(() => datetime(null, {})).toThrow()

        Validator.validators.datetime.parse = p
        expect(() => datetime(null, {})).not.toThrow()
      })

      it('allows undefined values', () => {
        const parseSpy = vi.spyOn(Validator.validators.datetime, 'parse')
        const formatSpy = vi.spyOn(Validator.validators.datetime, 'format')
        expect(datetime(null, {})).toBeUndefined()
        expect(datetime(undefined, {})).toBeUndefined()
        expect(parseSpy).not.toHaveBeenCalled()
        expect(formatSpy).not.toHaveBeenCalled()
      })

      it('allows valid dates', () => {
        expect(datetime('2013-10-26T13:47:00Z', {})).toBeUndefined()
      })

      it("doesn't allow invalid dates", () => {
        const expected = 'must be a valid date'
        expect(datetime('foobar', {})).toEqual(expected)
        expect(datetime('', {})).toEqual(expected)
        expect(datetime('  ', {})).toEqual(expected)
      })
    })
  })

  describe('formatters', () => {
    describe('flat', () => {
      it('returns a flat list of errors', () => {
        const c = {
          foo: {
            presence: true,
            numericality: true,
            length: {
              is: 23,
              wrongLength: 'some error'
            }
          }
        }
        const result = validator.validate({ foo: 'bar' }, c, { format: 'flat' })
        expect(result).toContain('Foo some error')
        expect(result).toContain('Foo is not a number')
      })

      it('fullMessages = false', () => {
        const constraints = { foo: { presence: true } }
        const options = { format: 'flat', fullMessages: false }
        expect(validator.validate({}, constraints, options)).toEqual([
          "can't be blank"
        ])
      })
    })

    describe('grouped', () => {
      it('groups errors by attribute', () => {
        const c = {
          foo: {
            presence: true
          }
        }
        expect(validator.validate({}, c)).toEqual({
          foo: ["Foo can't be blank"]
        })
      })
    })

    describe('detailed', () => {
      it('allows you to get more info about the errors', () => {
        const attributes = {
          foo: 'foo',
          bar: 10
        }
        const c = {
          foo: {
            presence: true,
            length: {
              is: 15,
              message: '^foobar',
              someOption: 'someValue'
            }
          },
          bar: {
            numericality: {
              lessThan: 5,
              greaterThan: 15
            }
          }
        }
        const options = { format: 'detailed' }
        const result = validator.validate(attributes, c, options)
        expect(result).toBeDefined()
        expect(Array.isArray(result)).toBe(true)
        expect(result.some((r) => r.attribute === 'foo')).toBe(true)
        expect(result.some((r) => r.attribute === 'bar')).toBe(true)
      })
    })

    describe('constraint', () => {
      it('returns constraint names', () => {
        const c = {
          foo: {
            numericality: true,
            length: {
              is: 23
            }
          }
        }
        expect(
          validator.validate({ foo: 'bar' }, c, { format: 'constraint' })
        ).toEqual({
          foo: ['length', 'numericality']
        })
      })
    })
  })

  describe('form collection', () => {
    describe('collectFormValues', () => {
      it('handles empty input', () => {
        expect(Validator.collectFormValues()).toEqual({})
      })

      it('handles simple forms', () => {
        const form = document.createElement('form')
        form.innerHTML =
          '' +
          '<input type="text" name="text" value="example text">' +
          '<input type="text" name="empty-text">' +
          '<input type="email" name="email" value="example@email.com">' +
          '<input type="password" name="password" value="password!">' +
          '<input type="checkbox" name="selected-checkbox" value="checkbox" checked>' +
          '<input type="checkbox" name="deselected-checkbox" value="checkbox">' +
          '<input type="date" name="date" value="2015-03-08">' +
          '<input type="hidden" name="hidden" value="hidden">' +
          '<input type="number" name="number" value="4711">' +
          '<input type="url" name="url" value="http://validatejs.org">' +
          '<input type="radio" name="single-checked-radio" value="radio" checked>' +
          '<input type="radio" name="single-unchecked-radio" value="radio">' +
          '<radiogroup>' +
          '  <input type="radio" name="checked-radio" value="radio1">' +
          '  <input type="radio" name="checked-radio" value="radio2" checked>' +
          '  <input type="radio" name="checked-radio" value="radio3">' +
          '</radiogroup>' +
          '<radiogroup>' +
          '  <input type="radio" name="unchecked-radio" value="radio1">' +
          '  <input type="radio" name="unchecked-radio" value="radio2">' +
          '  <input type="radio" name="unchecked-radio" value="radio3">' +
          '</radiogroup>' +
          '<select name="selected-dropdown">' +
          '  <option></option>' +
          '  <option value="option1"></option>' +
          '  <option value="option2" selected></option>' +
          '</select>' +
          '<select name="unselected-dropdown">' +
          '  <option></option>' +
          '  <option value="option1"></option>' +
          '  <option value="option2"></option>' +
          '</select>' +
          '<textarea name="textarea-ignored" data-ignored>the textarea</textarea>' +
          '<textarea name="textarea">the textarea</textarea>'

        expect(Validator.collectFormValues(form)).toEqual({
          text: 'example text',
          'empty-text': null,
          email: 'example@email.com',
          password: 'password!',
          'selected-checkbox': 'checkbox',
          'deselected-checkbox': null,
          date: '2015-03-08',
          hidden: 'hidden',
          number: 4711,
          url: 'http://validatejs.org',
          'single-checked-radio': 'radio',
          'single-unchecked-radio': null,
          'checked-radio': 'radio2',
          'unchecked-radio': null,
          'selected-dropdown': 'option2',
          'unselected-dropdown': null,
          textarea: 'the textarea'
        })
      })

      it('has an option to nullify empty and trim strings', () => {
        const form = document.createElement('form')
        form.innerHTML =
          '' +
          '<input type="text" name="normal" value="normal">' +
          '<input type="text" name="empty">' +
          '<input type="text" name="whitespace" value=" ">' +
          '<input type="text" name="trimmed" value=" foo ">'

        let options = { nullify: false }
        expect(Validator.collectFormValues(form, options)).toEqual({
          normal: 'normal',
          empty: '',
          whitespace: ' ',
          trimmed: ' foo '
        })

        options = { nullify: true }
        expect(Validator.collectFormValues(form, options)).toEqual({
          normal: 'normal',
          empty: null,
          whitespace: ' ',
          trimmed: ' foo '
        })

        options = { trim: true }
        expect(Validator.collectFormValues(form, options)).toEqual({
          normal: 'normal',
          empty: null,
          whitespace: null,
          trimmed: 'foo'
        })
      })

      it('has a way to ignore elements', () => {
        const form = document.createElement('form')
        form.innerHTML =
          '' +
          '<input type="text" name="ignored" value="ignored" data-ignored>' +
          '<select name="ignored-select" data-ignored>' +
          '  <option value="select" selected>Select</option>' +
          '</select>'
        expect(Validator.collectFormValues(form)).toEqual({})
      })

      it('uses true/false for checkboxes without a value', () => {
        const form = document.createElement('form')
        form.innerHTML =
          '' +
          '<input type="checkbox" name="checked" checked>' +
          '<input type="checkbox" name="unchecked">'

        expect(Validator.collectFormValues(form)).toEqual({
          checked: true,
          unchecked: false
        })
      })

      it('accepts jquery elements', () => {
        const form = document.createElement('form')
        form.innerHTML = '<input value="foobar" name="input" />'
        const $form = createJQueryMock(form)
        expect(Validator.collectFormValues($form)).toEqual({
          input: 'foobar'
        })
      })

      it('empty jquery collections return empty objects', () => {
        const emptyJQuery = {
          0: null,
          length: 0,
          jquery: '3.6.0'
        }
        expect(Validator.collectFormValues(emptyJQuery)).toEqual({})
      })

      it('handles empty and invalid numeric inputs', () => {
        const form = document.createElement('form')
        form.innerHTML =
          '' +
          '<input type="number" name="emptyNumber">' +
          '<input type="number" name="invalidNumber" value="abc">'

        expect(Validator.collectFormValues(form)).toEqual({
          emptyNumber: null,
          invalidNumber: null
        })
      })

      it("handles select tags with 'multiple'", () => {
        const form = document.createElement('form')
        form.innerHTML =
          '' +
          '<select name="selected-dropdown" multiple>' +
          '  <option></option>' +
          '  <option value="option1"></option>' +
          '  <option value="option2" selected></option>' +
          '  <option value="option3"></option>' +
          '  <option value="option4" selected></option>' +
          '</select>' +
          '<select name="unselected-dropdown" multiple>' +
          '  <option></option>' +
          '  <option value="option1"></option>' +
          '  <option value="option2"></option>' +
          '  <option value="option3"></option>' +
          '  <option value="option4"></option>' +
          '</select>' +
          '<select name="empty-value" multiple>' +
          '  <option selected></option>' +
          '</select>'

        expect(Validator.collectFormValues(form)).toEqual({
          'selected-dropdown': ['option2', 'option4'],
          'unselected-dropdown': [],
          'empty-value': [null]
        })
      })

      it('escapes periods', () => {
        const form = document.createElement('form')
        form.innerHTML = '<input type="text" name="foo.bar.baz" value="quux" />'

        expect(Validator.collectFormValues(form)).toEqual({
          'foo\\\\.bar\\\\.baz': 'quux'
        })
      })
    })

    describe('isDomElement', () => {
      it('returns true of DOM elements', () => {
        const form = document.createElement('form')
        const div = document.createElement('div')
        const a = document.createElement('a')

        expect(Validator.isDomElement(form)).toBe(true)
        expect(Validator.isDomElement(div)).toBe(true)
        expect(Validator.isDomElement(a)).toBe(true)
        expect(Validator.isDomElement(document)).toBe(true)
      })

      it('returns false for other objects', () => {
        expect(Validator.isDomElement({})).toBe(false)
        expect(Validator.isDomElement(0)).toBe(false)
        expect(Validator.isDomElement(true)).toBe(false)
        expect(Validator.isDomElement('foo')).toBe(false)
        expect(Validator.isDomElement('')).toBe(false)
        expect(Validator.isDomElement([])).toBe(false)
      })
    })

    describe('sanitizeFormValue', () => {
      it('trims strings when trim option is true', () => {
        expect(Validator.sanitizeFormValue('  test  ', { trim: true })).toBe(
          'test'
        )
        expect(Validator.sanitizeFormValue(' foo ', { trim: true })).toBe('foo')
        expect(Validator.sanitizeFormValue('   ', { trim: true })).toBe(null)
      })

      it('does not trim when trim option is false', () => {
        expect(Validator.sanitizeFormValue('  test  ', { trim: false })).toBe(
          '  test  '
        )
        expect(Validator.sanitizeFormValue(' foo ', {})).toBe(' foo ')
      })

      it('can trim without nullifying by setting nullify to false', () => {
        expect(
          Validator.sanitizeFormValue('   ', { trim: true, nullify: false })
        ).toBe('')
        expect(
          Validator.sanitizeFormValue('  test  ', {
            trim: true,
            nullify: false
          })
        ).toBe('test')
      })

      it('nullifies empty strings when nullify is true', () => {
        expect(Validator.sanitizeFormValue('', { nullify: true })).toBe(null)
        expect(Validator.sanitizeFormValue('', { nullify: false })).toBe('')
        expect(Validator.sanitizeFormValue('', {})).toBe(null)
      })

      it('handles non-string values', () => {
        expect(Validator.sanitizeFormValue(123, { trim: true })).toBe(123)
        expect(Validator.sanitizeFormValue(null, { trim: true })).toBe(null)
        expect(Validator.sanitizeFormValue(undefined, { trim: true })).toBe(
          undefined
        )
      })

      it('combines trim and nullify options', () => {
        expect(
          Validator.sanitizeFormValue('  ', { trim: true, nullify: true })
        ).toBe(null)
        expect(
          Validator.sanitizeFormValue('  ', { trim: true, nullify: false })
        ).toBe('')
        expect(
          Validator.sanitizeFormValue(' test ', { trim: true, nullify: true })
        ).toBe('test')
        expect(
          Validator.sanitizeFormValue(' test ', { trim: true, nullify: false })
        ).toBe('test')
      })
    })

    describe('form validation integration', () => {
      it('validates form elements directly', () => {
        const form = document.createElement('form')
        form.innerHTML =
          '' +
          '<input type="text" name="name" value="">' +
          '<input type="email" name="email" value="invalid-email">'

        const constraints = {
          name: { presence: true },
          email: { email: true }
        }

        const result = validator.validate(form, constraints)
        expect(result).toBeDefined()
        expect(result.name).toContain("Name can't be blank")
        expect(result.email).toContain('Email is not a valid email')
      })

      it('works with jQuery-like elements', () => {
        const form = document.createElement('form')
        form.innerHTML = '<input type="text" name="test" value="valid">'

        const $form = createJQueryMock(form)
        const constraints = { test: { presence: true } }

        const result = validator.validate($form, constraints)
        expect(result).toBeUndefined()
      })
    })
  })

  describe('cleaning attributes', () => {
    it('handles null for both inputs', () => {
      expect(Validator.cleanAttributes(null, {})).toEqual({})
      expect(Validator.cleanAttributes({}, null)).toEqual({})
      expect(Validator.cleanAttributes(null, null)).toEqual({})
    })

    it('always returns a copy', () => {
      const obj = {}
      expect(Validator.cleanAttributes(obj, {})).not.toBe(obj)
    })

    it('returns a copy of the attributes with only the whitelisted attributes', () => {
      const input = {
        foo: 'foo',
        bar: 'bar',
        baz: 'baz'
      }

      expect(Validator.cleanAttributes(input, {})).toEqual({})
      expect(Validator.cleanAttributes(input, { foo: true })).toEqual({
        foo: 'foo'
      })
      expect(
        Validator.cleanAttributes(input, { foo: true, bar: true })
      ).toEqual({
        foo: 'foo',
        bar: 'bar'
      })
      expect(
        Validator.cleanAttributes(input, { foo: true, bar: true, baz: true })
      ).toEqual({
        foo: 'foo',
        bar: 'bar',
        baz: 'baz'
      })
      expect(Validator.cleanAttributes(input, { foo: false })).toEqual({})
    })

    it('works with constraints', () => {
      const attributes = {
        name: 'Test',
        description: 'Yaay',
        createdAt: 'omgomg',
        address: {
          street: 'Some street',
          postal: '47 111'
        }
      }

      const constraints = {
        name: {
          presence: true
        },
        description: {},
        'address.street': {},
        'address.postal': {},
        'address.country': {}
      }

      expect(Validator.cleanAttributes(attributes, constraints)).not.toBe(
        attributes
      )
      expect(Validator.cleanAttributes(attributes, constraints)).toEqual({
        name: 'Test',
        description: 'Yaay',
        address: {
          street: 'Some street',
          postal: '47 111'
        }
      })
    })
  })
})
