describe('validators.datetime', function () {
  const datetime = validate.validators.datetime.bind(validate.validators.datetime)
  const parse = validate.validators.datetime.parse
  const format = validate.validators.datetime.format

  beforeEach(function () {
    validate.validators.datetime.parse = function (value) {
      return +moment.utc(value)
    }
    validate.validators.datetime.format = function (value, options) {
      let format = 'YYYY-MM-DD'
      if (!options.dateOnly) {
        format += ' HH:mm:ss'
      }
      return moment.utc(value).format(format)
    }
  })

  afterEach(function () {
    delete validate.validators.datetime.notValid
    delete validate.validators.datetime.tooEarly
    delete validate.validators.datetime.tooLate
    delete validate.validators.datetime.options
    validate.validators.datetime.parse = parse
    validate.validators.datetime.format = parse
  })

  it("throws an exception if format and parse isn't set", function () {
    const p = validate.validators.datetime.parse
    const f = validate.validators.datetime.format
    validate.validators.datetime.parse = parse
    validate.validators.datetime.format = format

    expect(function () { datetime(null, {}) }).toThrow()

    validate.validators.datetime.parse = p
    expect(function () { datetime(null, {}) }).toThrow()

    validate.validators.datetime.parse = parse
    validate.validators.datetime.format = f
    expect(function () { datetime(null, {}) }).toThrow()

    validate.validators.datetime.parse = p
    expect(function () { datetime(null, {}) }).not.toThrow()
  })

  it('allows undefined values', function () {
    spyOn(validate.validators.datetime, 'parse')
    spyOn(validate.validators.datetime, 'format')
    expect(datetime(null, {})).not.toBeDefined()
    expect(datetime(undefined, {})).not.toBeDefined()
    expect(validate.validators.datetime.parse).not.toHaveBeenCalled()
    expect(validate.validators.datetime.format).not.toHaveBeenCalled()
  })

  it('allows valid dates', function () {
    expect(datetime('2013-10-26 13:47:00', {})).not.toBeDefined()
  })

  it("doesn't allow invalid dates", function () {
    const expected = 'must be a valid date'
    expect(datetime('foobar', {})).toEqual(expected)
    expect(datetime('', {})).toEqual(expected)
    expect(datetime('  ', {})).toEqual(expected)
  })

  it("doesn't allow h, m or s when dateOnly is true", function () {
    const expected = 'must be a valid date'
    const opts = { dateOnly: true }

    expect(datetime('2013-10-26 13:47:00', opts)).toEqual(expected)
    expect(datetime('2013-10-26', opts)).not.toBeDefined()
  })

  it('returns the message if specified for invalid dates', function () {
    validate.validators.datetime.notValid = 'notValid'
    expect(datetime('foobar', {})).toEqual('notValid')

    const opts = { message: 'my other message' }
    expect(datetime('foobar', opts)).toEqual('my other message')
  })

  it('allows tooLate, tooEarly and notValid messages', function () {
    const options = {
      tooLate: '%{value} is later than %{date}',
      tooEarly: '%{value} is earlier than %{date}',
      notValid: '%{value} is not valid',
      message: 'fail',
      earliest: '2015-01-01',
      latest: '2015-12-31',
      dateOnly: true
    }
    expect(datetime('foobar', options)).toEqual('foobar is not valid')
    expect(datetime('2014-01-01', options))
      .toEqual(['2014-01-01 is earlier than 2015-01-01'])
    expect(datetime('2016-01-01', options))
      .toEqual(['2016-01-01 is later than 2015-12-31'])
  })

  it('message overrides global messages', function () {
    const options = {
      message: 'some message',
      earliest: '2016-01-01',
      latest: '2015-12-30',
      dateOnly: true
    }
    validate.validators.datetime.notValid = 'notValid'
    validate.validators.datetime.tooEarly = 'tooEarly'
    validate.validators.datetime.tooLate = 'tooLate'
    expect(datetime('foobar', options)).toEqual('some message')
    expect(datetime('2015-12-31', options)).toEqual(['some message'])
  })

  describe('earliest', function () {
    it("doesn't allow earlier dates", function () {
      const options = { earliest: '2013-10-26 00:00:00' }
      const value = '2013-10-25 23:59:59'
      const expected = ['must be no earlier than 2013-10-26 00:00:00']

      expect(datetime(value, options)).toEqual(expected)
    })

    it('allows earlier or equal dates', function () {
      const options = { earliest: '2013-10-26 00:00:00' }
      let value = '2013-10-26 00:00:00'
      expect(datetime(value, options)).not.toBeDefined()
      value = '2013-10-27 00:00:00'
      expect(datetime(value, options)).not.toBeDefined()
    })

    it('formats the error using the format function', function () {
      const options = { earliest: '2013-10-26 00:00:00' }
      const value = '2013-10-25 00:00:00'
      const spy = spyOn(validate.validators.datetime, 'format')
        .and.returnValue('foobar')
      const expected = ['must be no earlier than foobar']
      expect(datetime(value, options)).toEqual(expected)
    })

    it('parses the earliest value using the parse function', function () {
      const options = { earliest: 'foobar' }
      const value = moment.utc().startOf('day')
      const spy = spyOn(validate.validators.datetime, 'parse').and.returnValue(value)
      datetime(value, options)
      expect(spy).toHaveBeenCalledWith('foobar', options)
    })

    it('uses the default message if available', function () {
      const options = { earliest: '2013-10-26 00:00:00' }
      const value = '2013-10-25 23:59:59'

      validate.validators.datetime.tooEarly = 'default message'
      expect(datetime(value, options)).toEqual(['default message'])

      options.message = 'overridden'
      expect(datetime(value, options)).toEqual(['overridden'])
    })
  })

  describe('latest', function () {
    it("doesn't allow later dates", function () {
      const options = { latest: '2013-10-26 00:00:00' }
      const value = '2013-10-26 00:00:01'
      const expected = ['must be no later than 2013-10-26 00:00:00']

      expect(datetime(value, options)).toEqual(expected)
    })

    it('allows later or equal dates', function () {
      const options = { latest: '2013-10-26 00:00:00' }
      let value = '2013-10-26 00:00:00'
      expect(datetime(value, options)).not.toBeDefined()
      value = '2013-10-25 00:00:00'
      expect(datetime(value, options)).not.toBeDefined()
    })

    it('formats the error using the format function', function () {
      const options = { latest: '2013-10-26 00:00:00' }
      const value = '2013-10-27 00:00:00'
      const spy = spyOn(validate.validators.datetime, 'format').and.returnValue('foobar')
      const expected = ['must be no later than foobar']
      expect(datetime(value, options)).toEqual(expected)
    })

    it('parses the latest value using the parse function', function () {
      const options = { latest: 'foobar' }
      const value = moment.utc().startOf('day')
      const spy = spyOn(validate.validators.datetime, 'parse').and.returnValue(value)
      datetime(value, options)
      expect(spy).toHaveBeenCalledWith('foobar', options)
    })

    it('uses the default message if available', function () {
      const options = { latest: '2013-10-26 00:00:00' }
      const value = '2013-10-26 00:00:01'

      validate.validators.datetime.tooLate = 'default message'
      expect(datetime(value, options)).toEqual(['default message'])

      options.message = 'overridden'
      expect(datetime(value, options)).toEqual(['overridden'])
    })
  })

  it('can return multiple errors', function () {
    const options = {
      earliest: '2013-10-26 00:00:00',
      latest: '2013-10-24 00:00:00'
    }
    const value = '2013-10-25 00:00:00'
    expect(datetime(value, options)).toHaveItems([
      'must be no later than 2013-10-24 00:00:00',
      'must be no earlier than 2013-10-26 00:00:00'
    ])
  })

  it('returns the user defined message only once', function () {
    const options = {
      earliest: '2013-10-26 00:00:00',
      latest: '2013-10-24 00:00:00',
      message: 'foobar'
    }
    const value = '2013-10-25 00:00:00'
    expect(datetime(value, options)).toEqual(['foobar'])
  })

  it('supports default options', function () {
    validate.validators.datetime.options =
      { message: 'barfoo', earliest: '2013-10-26 00:00:00' }
    const options = { message: 'foobar' }
    const value = '2013-10-25 00:00:00'
    expect(datetime(value, options)).toEqual(['foobar'])
    expect(datetime(value, {})).toEqual(['barfoo'])
    expect(validate.validators.datetime.options)
      .toEqual({ message: 'barfoo', earliest: '2013-10-26 00:00:00' })
    expect(options).toEqual({ message: 'foobar' })
  })

  it('allows functions as messages', function () {
    const message = function () { return 'foo' }
    const options = {
      earliest: '2013-10-26 00:00:00',
      latest: '2013-10-24 00:00:00',
      message
    }
    const value = '2013-10-25 00:00:00'
    expect(datetime(value, options)).toEqual([message])
  })
})

describe('validators.date', function () {
  it('calls the datetime validator with dateOnly set to true', function () {
    const errors = ['my error']
    const value = 'my value'
    const options = { foo: 'bar' }
    const spy = spyOn(validate.validators, 'datetime').and.returnValue(errors)
    expect(validate.validators.date(value, options)).toBe(errors)
    expect(spy).toHaveBeenCalledWith(value, { foo: 'bar', dateOnly: true })
  })

  it("doesn't modify the options argument", function () {
    const options = {}
    const spy = spyOn(validate.validators, 'datetime')
    validate.validators.date('value', options)
    expect(options).toEqual({})
  })

  it('calls the datetime validator with the right context', function () {
    spyOn(validate.validators, 'datetime')
    validate.validators.date('foo', {})
    expect(validate.validators.datetime).toHaveBeenCalledWithContext(validate.validators.datetime)
  })
})
