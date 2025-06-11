/*
neovalidate - ES6+ fork of Validate.js, a declarative validation library
(c) 2025 pokeghost
Licensed under MIT License

Based on validate.js 0.13.1
http://validatejs.org/
(c) 2013-2019 Nicklas Ansman, 2013 Wrapp
*/

'use strict'

export default class Validator {
  #options

  static Promise = typeof Promise !== 'undefined' ? Promise : null
  static EMPTY_STRING_REGEXP = /^\s*$/

  constructor(options = {}) {
    this.#options = {
      format: 'grouped',
      fullMessages: true,
      cleanAttributes: true,
      ...options
    }
  }

  validate(attributes, constraints, options = {}) {
    const opts = { ...this.#options, ...options }
    const results = Validator.#runValidations(attributes, constraints, opts)

    if (results.some((r) => Validator.isPromise(r.error))) {
      throw new Error('Use validate.async if you want support for promises')
    }
    return Validator.#processValidationResults(results, opts)
  }

  async validateAsync(attributes, constraints, options = {}) {
    const opts = { ...this.#options, ...options }
    const WrapErrors = opts.wrapErrors || ((errors) => errors)

    if (opts.cleanAttributes) {
      attributes = Validator.#cleanAttributes(attributes, constraints)
    }

    const results = Validator.#runValidations(attributes, constraints, opts)

    await Validator.#waitForResults(results)
    const errors = Validator.#processValidationResults(results, opts)

    if (errors) {
      throw new WrapErrors(errors, opts, attributes, constraints)
    }

    return attributes
  }

  single(value, constraints, options = {}) {
    const opts = {
      ...this.#options,
      ...options,
      format: 'flat',
      fullMessages: false
    }
    return this.validate({ single: value }, { single: constraints }, opts)
  }

  static #runValidations(attributes, constraints, options) {
    const results = []

    if (
      Validator.isDomElement(attributes) ||
      Validator.isJqueryElement(attributes)
    ) {
      attributes = Validator.collectFormValues(attributes)
    }

    for (const attr in constraints) {
      const value = Validator.getDeepObjectValue(attributes, attr)
      const validators = Validator.result(
        constraints[attr],
        value,
        attributes,
        attr,
        options,
        constraints
      )

      for (const validatorName in validators) {
        const validator = Validator.validators[validatorName]

        if (!validator) {
          throw new Error(
            Validator.format('Unknown validator %{name}', {
              name: validatorName
            })
          )
        }

        let validatorOptions = validators[validatorName]
        validatorOptions = Validator.result(
          validatorOptions,
          value,
          attributes,
          attr,
          options,
          constraints
        )

        if (!validatorOptions) continue

        results.push({
          attribute: attr,
          value,
          validator: validatorName,
          globalOptions: options,
          attributes,
          options: validatorOptions,
          error: validator.call(
            validator,
            value,
            validatorOptions,
            attr,
            attributes,
            options
          )
        })
      }
    }

    return results
  }

  static #processValidationResults(errors, options) {
    errors = Validator.pruneEmptyErrors(errors)
    errors = Validator.expandMultipleErrors(errors)
    errors = Validator.convertErrorMessages(errors, options)

    const format = options.format || 'grouped'
    const formatter = Validator.formatters[format]

    if (typeof formatter === 'function') {
      errors = formatter(errors)
    } else {
      throw new Error(Validator.format('Unknown format %{format}', options))
    }

    return Validator.isEmpty(errors) ? undefined : errors
  }

  static #waitForResults(results) {
    return results.reduce((memo, result) => {
      if (!Validator.isPromise(result.error)) return memo

      return memo.then(() =>
        result.error.then((error) => {
          result.error = error || null
        })
      )
    }, new Validator.Promise((r) => r()))
  }

  static #cleanAttributes(attributes, whitelist) {
    const whitelistCreator = (obj, key, last) => {
      if (Validator.isObject(obj[key])) return obj[key]
      return (obj[key] = last ? true : {})
    }

    const buildObjectWhitelist = (whitelist) => {
      const ow = {}
      for (const attr in whitelist) {
        if (whitelist[attr]) {
          Validator.forEachKeyInKeypath(ow, attr, whitelistCreator)
        }
      }
      return ow
    }

    const cleanRecursive = (attributes, whitelist) => {
      if (!Validator.isObject(attributes)) return attributes

      const ret = { ...attributes }

      for (const attribute in attributes) {
        const w = whitelist[attribute]
        if (Validator.isObject(w)) {
          ret[attribute] = cleanRecursive(ret[attribute], w)
        } else if (!w) {
          delete ret[attribute]
        }
      }

      return ret
    }

    if (!Validator.isObject(whitelist) || !Validator.isObject(attributes)) {
      return {}
    }

    whitelist = buildObjectWhitelist(whitelist)
    return cleanRecursive(attributes, whitelist)
  }

  static extend(obj, ...sources) {
    sources.forEach((source) => {
      for (const attr in source) {
        obj[attr] = source[attr]
      }
    })
    return obj
  }

  static result(value, ...args) {
    return typeof value === 'function' ? value(...args) : value
  }

  static isNumber(value) {
    return typeof value === 'number' && !isNaN(value)
  }

  static isFunction(value) {
    return typeof value === 'function'
  }

  static isInteger(value) {
    return Validator.isNumber(value) && value % 1 === 0
  }

  static isBoolean(value) {
    return typeof value === 'boolean'
  }

  static isObject(obj) {
    return obj === Object(obj)
  }

  static isDate(obj) {
    return obj instanceof Date
  }

  static isDefined(obj) {
    return obj !== null && obj !== undefined
  }

  static isPromise(p) {
    return !!p && Validator.isFunction(p.then)
  }

  static isJqueryElement(o) {
    return o && Validator.isString(o.jquery)
  }

  static isDomElement(o) {
    if (!o) return false
    if (!o.querySelectorAll || !o.querySelector) return false
    if (Validator.isObject(document) && o === document) return true

    if (typeof HTMLElement === 'object') {
      return o instanceof HTMLElement
    } else {
      return (
        o &&
        typeof o === 'object' &&
        o !== null &&
        o.nodeType === 1 &&
        typeof o.nodeName === 'string'
      )
    }
  }

  static isEmpty(value) {
    if (!Validator.isDefined(value)) return true
    if (Validator.isFunction(value)) return false
    if (Validator.isString(value))
      return Validator.EMPTY_STRING_REGEXP.test(value)
    if (Validator.isArray(value)) return value.length === 0
    if (Validator.isDate(value)) return false

    if (Validator.isObject(value)) {
      return Object.keys(value).length === 0
    }

    return false
  }

  static format = Object.assign(
    (str, vals) => {
      if (!Validator.isString(str)) return str
      return str.replace(Validator.format.FORMAT_REGEXP, (_, m1, m2) =>
        m1 === '%' ? `%{${m2}}` : String(vals[m2])
      )
    },
    {
      FORMAT_REGEXP: /(%?)%\{([^\}]+)\}/g
    }
  )

  static prettify(str) {
    if (Validator.isNumber(str)) {
      return (str * 100) % 1 === 0
        ? String(str)
        : parseFloat(Math.round(str * 100) / 100).toFixed(2)
    }

    if (Validator.isArray(str)) {
      return str.map((s) => Validator.prettify(s)).join(', ')
    }

    if (Validator.isObject(str)) {
      return !Validator.isDefined(str.toString)
        ? JSON.stringify(str)
        : str.toString()
    }

    return String(str)
      .replace(/([^\s])\.([^\s])/g, '$1 $2')
      .replace(/\\+/g, '')
      .replace(/[_-]/g, ' ')
      .replace(/([a-z])([A-Z])/g, (m0, m1, m2) => `${m1} ${m2.toLowerCase()}`)
      .toLowerCase()
  }

  static stringifyValue(value, options) {
    const prettify = options?.prettify || Validator.prettify
    return prettify(value)
  }

  static isString(value) {
    return typeof value === 'string'
  }

  static isArray(value) {
    return {}.toString.call(value) === '[object Array]'
  }

  static isHash(value) {
    return (
      Validator.isObject(value) &&
      !Validator.isArray(value) &&
      !Validator.isFunction(value)
    )
  }

  static contains(obj, value) {
    if (!Validator.isDefined(obj)) return false
    if (Validator.isArray(obj)) return obj.indexOf(value) !== -1
    return value in obj
  }

  static unique(array) {
    if (!Validator.isArray(array)) return array
    return array.filter((el, index, arr) => arr.indexOf(el) === index)
  }

  static forEachKeyInKeypath(object, keypath, callback) {
    if (!Validator.isString(keypath)) return undefined

    let key = ''
    let escape = false

    for (let i = 0; i < keypath.length; ++i) {
      switch (keypath[i]) {
        case '.':
          if (escape) {
            escape = false
            key += '.'
          } else {
            object = callback(object, key, false)
            key = ''
          }
          break
        case '\\':
          if (escape) {
            escape = false
            key += '\\'
          } else {
            escape = true
          }
          break
        default:
          escape = false
          key += keypath[i]
          break
      }
    }

    return callback(object, key, true)
  }

  static getDeepObjectValue(obj, keypath) {
    if (!Validator.isObject(obj)) return undefined
    return Validator.forEachKeyInKeypath(obj, keypath, (obj, key) =>
      Validator.isObject(obj) ? obj[key] : undefined
    )
  }

  static collectFormValues(form, options = {}) {
    const values = {}

    if (Validator.isJqueryElement(form)) form = form[0]
    if (!form) return values

    const inputs = form.querySelectorAll('input[name], textarea[name]')
    for (let i = 0; i < inputs.length; ++i) {
      const input = inputs.item(i)
      if (Validator.isDefined(input.getAttribute('data-ignored'))) continue

      const name = input.name.replace(/\./g, '\\\\.')
      let value = Validator.sanitizeFormValue(input.value, options)

      if (input.type === 'number') {
        value = value ? +value : null
      } else if (input.type === 'checkbox') {
        value = input.attributes.value
          ? input.checked
            ? value
            : values[name] || null
          : input.checked
      } else if (input.type === 'radio' && !input.checked) {
        value = values[name] || null
      }

      values[name] = value
    }

    const selects = form.querySelectorAll('select[name]')
    for (let i = 0; i < selects.length; ++i) {
      const input = selects.item(i)
      if (Validator.isDefined(input.getAttribute('data-ignored'))) continue

      let value
      if (input.multiple) {
        value = []
        for (const j in input.options) {
          const option = input.options[j]
          if (option?.selected) {
            value.push(Validator.sanitizeFormValue(option.value, options))
          }
        }
      } else {
        const selectedValue = input.options[input.selectedIndex]?.value || ''
        value = Validator.sanitizeFormValue(selectedValue, options)
      }

      values[input.name] = value
    }

    return values
  }

  static sanitizeFormValue(value, options) {
    if (options.trim && Validator.isString(value)) {
      value = value.trim()
    }
    return options.nullify !== false && value === '' ? null : value
  }

  static capitalize(str) {
    return !Validator.isString(str) ? str : str[0].toUpperCase() + str.slice(1)
  }

  static pruneEmptyErrors(errors) {
    return errors.filter((error) => !Validator.isEmpty(error.error))
  }

  static expandMultipleErrors(errors) {
    const ret = []
    errors.forEach((error) => {
      if (Validator.isArray(error.error)) {
        error.error.forEach((msg) => {
          ret.push({ ...error, error: msg })
        })
      } else {
        ret.push(error)
      }
    })
    return ret
  }

  static convertErrorMessages(errors, options = {}) {
    const ret = []
    const prettify = options.prettify || Validator.prettify

    errors.forEach((errorInfo) => {
      let error = Validator.result(
        errorInfo.error,
        errorInfo.value,
        errorInfo.attribute,
        errorInfo.options,
        errorInfo.attributes,
        errorInfo.globalOptions
      )

      if (!Validator.isString(error)) {
        ret.push(errorInfo)
        return
      }

      if (error[0] === '^') {
        error = error.slice(1)
      } else if (options.fullMessages !== false) {
        error = `${Validator.capitalize(
          prettify(errorInfo.attribute)
        )} ${error}`
      }

      error = error.replace(/\\\^/g, '^')
      error = Validator.format(error, {
        value: Validator.stringifyValue(errorInfo.value, options)
      })

      ret.push({ ...errorInfo, error })
    })

    return ret
  }

  static groupErrorsByAttribute(errors) {
    const ret = {}
    errors.forEach((error) => {
      const list = ret[error.attribute]
      if (list) {
        list.push(error)
      } else {
        ret[error.attribute] = [error]
      }
    })
    return ret
  }

  static flattenErrorsToArray(errors) {
    return errors
      .map((error) => error.error)
      .filter((value, index, self) => self.indexOf(value) === index)
  }

  static warn(msg) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`[validate.js] ${msg}`)
    }
  }

  static error(msg) {
    if (typeof console !== 'undefined' && console.error) {
      console.error(`[validate.js] ${msg}`)
    }
  }

  static validators = {
    presence(value, options) {
      const opts = { ...this.options, ...options }
      const isEmpty =
        opts.allowEmpty !== false
          ? !Validator.isDefined(value)
          : Validator.isEmpty(value)
      return isEmpty
        ? opts.message || this.message || "can't be blank"
        : undefined
    },

    length(value, options) {
      if (!Validator.isDefined(value)) return

      const opts = { ...this.options, ...options }
      const { is, maximum, minimum } = opts
      const tokenizer = opts.tokenizer || ((val) => val)
      const errors = []

      value = tokenizer(value)
      const length = value.length

      if (!Validator.isNumber(length)) {
        return opts.message || this.notValid || 'has an incorrect length'
      }

      if (Validator.isNumber(is) && length !== is) {
        const err =
          opts.wrongLength ||
          this.wrongLength ||
          'is the wrong length (should be %{count} characters)'
        errors.push(Validator.format(err, { count: is }))
      }

      if (Validator.isNumber(minimum) && length < minimum) {
        const err =
          opts.tooShort ||
          this.tooShort ||
          'is too short (minimum is %{count} characters)'
        errors.push(Validator.format(err, { count: minimum }))
      }

      if (Validator.isNumber(maximum) && length > maximum) {
        const err =
          opts.tooLong ||
          this.tooLong ||
          'is too long (maximum is %{count} characters)'
        errors.push(Validator.format(err, { count: maximum }))
      }

      return errors.length > 0 ? opts.message || errors : undefined
    },

    numericality(value, options, attribute, attributes, globalOptions) {
      if (!Validator.isDefined(value)) return

      const opts = { ...this.options, ...options }
      const errors = []
      const checks = {
        greaterThan: (v, c) => v > c,
        greaterThanOrEqualTo: (v, c) => v >= c,
        equalTo: (v, c) => v === c,
        lessThan: (v, c) => v < c,
        lessThanOrEqualTo: (v, c) => v <= c,
        divisibleBy: (v, c) => v % c === 0
      }
      const prettify =
        opts.prettify || globalOptions?.prettify || Validator.prettify

      if (Validator.isString(value) && opts.strict) {
        const pattern = `^-?(0|[1-9]\\d*)${
          !opts.onlyInteger ? '(\\.\\d+)?' : ''
        }$`
        if (!new RegExp(pattern).test(value)) {
          return (
            opts.message ||
            opts.notValid ||
            this.notValid ||
            this.message ||
            'must be a valid number'
          )
        }
      }

      if (
        opts.noStrings !== true &&
        Validator.isString(value) &&
        !Validator.isEmpty(value)
      ) {
        value = +value
      }

      if (!Validator.isNumber(value)) {
        return (
          opts.message ||
          opts.notValid ||
          this.notValid ||
          this.message ||
          'is not a number'
        )
      }

      if (opts.onlyInteger && !Validator.isInteger(value)) {
        return (
          opts.message ||
          opts.notInteger ||
          this.notInteger ||
          this.message ||
          'must be an integer'
        )
      }

      for (const [name, check] of Object.entries(checks)) {
        const count = opts[name]
        if (Validator.isNumber(count) && !check(value, count)) {
          const key = `not${Validator.capitalize(name)}`
          const msg =
            opts[key] || this[key] || this.message || `must be %{type} %{count}`
          errors.push(Validator.format(msg, { count, type: prettify(name) }))
        }
      }

      if (opts.odd && value % 2 !== 1) {
        errors.push(opts.notOdd || this.notOdd || this.message || 'must be odd')
      }

      if (opts.even && value % 2 !== 0) {
        errors.push(
          opts.notEven || this.notEven || this.message || 'must be even'
        )
      }

      return errors.length ? opts.message || errors : undefined
    },

    datetime: Object.assign(
      function (value, options) {
        if (
          !Validator.isFunction(this.parse) ||
          !Validator.isFunction(this.format)
        ) {
          throw new Error(
            'Both the parse and format functions needs to be set to use the datetime/date validator'
          )
        }

        if (!Validator.isDefined(value)) return

        const opts = { ...this.options, ...options }
        const errors = []
        const earliest = opts.earliest ? this.parse(opts.earliest, opts) : NaN
        const latest = opts.latest ? this.parse(opts.latest, opts) : NaN

        value = this.parse(value, opts)

        if (isNaN(value) || (opts.dateOnly && value % 86400000 !== 0)) {
          const err =
            opts.notValid ||
            opts.message ||
            this.notValid ||
            'must be a valid date'
          return Validator.format(err, { value: arguments[0] })
        }

        if (!isNaN(earliest) && value < earliest) {
          const err =
            opts.tooEarly ||
            opts.message ||
            this.tooEarly ||
            'must be no earlier than %{date}'
          errors.push(
            Validator.format(err, {
              value: this.format(value, opts),
              date: this.format(earliest, opts)
            })
          )
        }

        if (!isNaN(latest) && value > latest) {
          const err =
            opts.tooLate ||
            opts.message ||
            this.tooLate ||
            'must be no later than %{date}'
          errors.push(
            Validator.format(err, {
              date: this.format(latest, opts),
              value: this.format(value, opts)
            })
          )
        }

        return errors.length ? Validator.unique(errors) : undefined
      },
      {
        parse: null,
        format: null
      }
    ),

    date(value, options) {
      const opts = { ...options, dateOnly: true }
      return Validator.validators.datetime.call(
        Validator.validators.datetime,
        value,
        opts
      )
    },

    format(value, options) {
      if (Validator.isString(options) || options instanceof RegExp) {
        options = { pattern: options }
      }

      const opts = { ...this.options, ...options }
      const message = opts.message || this.message || 'is invalid'
      let { pattern } = opts

      if (!Validator.isDefined(value)) return
      if (!Validator.isString(value)) return message

      if (Validator.isString(pattern)) {
        pattern = new RegExp(opts.pattern, opts.flags)
      }

      const match = pattern.exec(value)
      return !match || match[0].length !== value.length ? message : undefined
    },

    inclusion(value, options) {
      if (!Validator.isDefined(value)) return

      if (Validator.isArray(options)) {
        options = { within: options }
      }

      const opts = { ...this.options, ...options }

      if (Validator.contains(opts.within, value)) return

      const message =
        opts.message || this.message || '^%{value} is not included in the list'
      return Validator.format(message, { value })
    },

    exclusion(value, options) {
      if (!Validator.isDefined(value)) return

      if (Validator.isArray(options)) {
        options = { within: options }
      }

      const opts = { ...this.options, ...options }

      if (!Validator.contains(opts.within, value)) return

      let message = opts.message || this.message || '^%{value} is restricted'
      if (Validator.isString(opts.within[value])) {
        value = opts.within[value]
      }
      return Validator.format(message, { value })
    },

    email: Object.assign(
      function (value, options) {
        const opts = { ...this.options, ...options }
        const message = opts.message || this.message || 'is not a valid email'

        if (!Validator.isDefined(value)) return
        if (!Validator.isString(value)) return message

        return !this.PATTERN.exec(value) ? message : undefined
      },
      {
        PATTERN:
          /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i
      }
    ),

    equality(value, options, attribute, attributes, globalOptions) {
      if (!Validator.isDefined(value)) return

      if (Validator.isString(options)) {
        options = { attribute: options }
      }

      const opts = { ...this.options, ...options }
      const message =
        opts.message || this.message || 'is not equal to %{attribute}'

      if (
        Validator.isEmpty(opts.attribute) ||
        !Validator.isString(opts.attribute)
      ) {
        throw new Error('The attribute must be a non empty string')
      }

      const otherValue = Validator.getDeepObjectValue(
        attributes,
        opts.attribute
      )
      const comparator = opts.comparator || ((v1, v2) => v1 === v2)
      const prettify =
        opts.prettify || globalOptions?.prettify || Validator.prettify

      return !comparator(value, otherValue, opts, attribute, attributes)
        ? Validator.format(message, { attribute: prettify(opts.attribute) })
        : undefined
    },

    url(value, options) {
      if (!Validator.isDefined(value)) return

      const opts = { ...this.options, ...options }
      const message = opts.message || this.message || 'is not a valid url'
      const schemes = opts.schemes || this.schemes || ['http', 'https']
      const allowLocal = opts.allowLocal || this.allowLocal || false
      const allowDataUrl = opts.allowDataUrl || this.allowDataUrl || false

      if (!Validator.isString(value)) return message

      let regex =
        '^' + `(?:(?:${schemes.join('|')})://)` + '(?:\\S+(?::\\S*)?@)?' + '(?:'

      let tld = '(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))'

      if (allowLocal) {
        tld += '?'
      } else {
        regex +=
          '(?!(?:10|127)(?:\\.\\d{1,3}){3})' +
          '(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})' +
          '(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})'
      }

      regex +=
        '(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])' +
        '(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}' +
        '(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))' +
        '|' +
        '(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)' +
        '(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*' +
        tld +
        ')' +
        '(?::\\d{2,5})?' +
        '(?:[/?#]\\S*)?' +
        '$'

      if (allowDataUrl) {
        const mediaType = '\\w+\\/[-+.\\w]+(?:;[\\w=]+)*'
        const urlchar = "[A-Za-z0-9-_.!~\\*'();\\/?:@&=+$,%]*"
        const dataurl = `data:(?:${mediaType})?(?:;base64)?,${urlchar}`
        regex = `(?:${regex})|(?:^${dataurl}$)`
      }

      const PATTERN = new RegExp(regex, 'i')
      return !PATTERN.exec(value) ? message : undefined
    },

    type: Object.assign(
      function (value, originalOptions, attribute, attributes, globalOptions) {
        if (Validator.isString(originalOptions)) {
          originalOptions = { type: originalOptions }
        }

        if (!Validator.isDefined(value)) return

        const options = { ...this.options, ...originalOptions }
        const { type } = options

        if (!Validator.isDefined(type)) {
          throw new Error('No type was specified')
        }

        const check = Validator.isFunction(type) ? type : this.types[type]

        if (!Validator.isFunction(check)) {
          throw new Error(
            `validate.validators.type.types.${type} must be a function.`
          )
        }

        if (!check(value, options, attribute, attributes, globalOptions)) {
          let message =
            originalOptions.message ||
            this.messages[type] ||
            this.message ||
            options.message ||
            (Validator.isFunction(type)
              ? 'must be of the correct type'
              : 'must be of type %{type}')

          if (Validator.isFunction(message)) {
            message = message(
              value,
              originalOptions,
              attribute,
              attributes,
              globalOptions
            )
          }

          return Validator.format(message, {
            attribute: Validator.prettify(attribute),
            type
          })
        }
      },
      {
        types: {
          object: (value) =>
            Validator.isObject(value) && !Validator.isArray(value),
          array: Validator.isArray,
          integer: Validator.isInteger,
          number: Validator.isNumber,
          string: Validator.isString,
          date: Validator.isDate,
          boolean: Validator.isBoolean
        },
        messages: {}
      }
    )
  }

  static formatters = {
    detailed: (errors) => errors,
    flat: Validator.flattenErrorsToArray,
    grouped(errors) {
      const grouped = Validator.groupErrorsByAttribute(errors)
      for (const attr in grouped) {
        grouped[attr] = Validator.flattenErrorsToArray(grouped[attr])
      }
      return grouped
    },
    constraint(errors) {
      const grouped = Validator.groupErrorsByAttribute(errors)
      for (const attr in grouped) {
        grouped[attr] = grouped[attr].map((result) => result.validator).sort()
      }
      return grouped
    }
  }
}
