describe('validators.inclusion', function () {
  const inclusion = validate.validators.inclusion.bind(validate.validators.inclusion)
  const within = ['foo', 'bar', 'baz']

  afterEach(function () {
    delete validate.validators.inclusion.message
    delete validate.validators.inclusion.message
  })

  it('allows empty values', function () {
    expect(inclusion(null, {})).not.toBeDefined()
    expect(inclusion(undefined, {})).not.toBeDefined()
  })

  it('returns nothing if the value is allowed', function () {
    const opts = { within }
    expect(inclusion('foo', opts)).not.toBeDefined()
    expect(inclusion('bar', opts)).not.toBeDefined()
    expect(inclusion('baz', opts)).not.toBeDefined()
  })

  it('returns an error if the value is not included', function () {
    const opts = { within }
    expect(inclusion('', {})).toBeDefined()
    expect(inclusion(' ', {})).toBeDefined()
    expect(inclusion('quux', opts)).toEqual('^quux is not included in the list')
    expect(inclusion(false, opts)).toEqual('^false is not included in the list')
    expect(inclusion(1, opts)).toEqual('^1 is not included in the list')
  })

  it('allows you to customize the message', function () {
    validate.validators.inclusion.message = '^Default message: %{value}'
    const opts = { within }
    expect(inclusion('quux', opts)).toEqual('^Default message: quux')

    opts.message = '^%{value} is not a valid choice'
    expect(inclusion('quux', opts)).toEqual('^quux is not a valid choice')
  })

  it('uses the keys if the within value is an object', function () {
    expect(inclusion('foo', { within: { foo: true } })).not.toBeDefined()
    expect(inclusion('bar', { within: { foo: true } })).toBeDefined()
  })

  it('uses the options as the within list if the options is an array', function () {
    expect(inclusion('foo', ['foo', 'bar'])).not.toBeDefined()
    expect(inclusion('baz', ['foo', 'bar'])).toBeDefined()
  })

  it('supports default options', function () {
    validate.validators.inclusion.options = {
      message: 'barfoo',
      within: [1, 2, 3]
    }
    const options = { message: 'foobar' }
    expect(inclusion(4, options)).toEqual('foobar')
    expect(inclusion(4, {})).toEqual('barfoo')
    expect(validate.validators.inclusion.options).toEqual({
      message: 'barfoo',
      within: [1, 2, 3]
    })
    expect(options).toEqual({ message: 'foobar' })
  })

  it('allows functions as messages', function () {
    const message = function () { return 'foo' }
    const options = { message, within: ['bar'] }
    const value = 'foo'
    expect(inclusion(value, options)).toBe(message)
  })
})
