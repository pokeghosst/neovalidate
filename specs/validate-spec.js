describe('validate', function () {
  const validators = validate.validators
  let fail
  let fail2
  let pass
  let pass2

  beforeEach(function () {
    fail = jasmine.createSpy('failValidator').and.returnValue('my error')
    fail2 = jasmine.createSpy('failValidator2').and.returnValue('my error')
    pass = jasmine.createSpy('passValidator')
    pass2 = jasmine.createSpy('passValidator2')
    validators.pass = pass
    validators.pass2 = pass2
    validators.fail = fail
    validators.fail2 = fail2
  })

  afterEach(function () {
    delete validators.fail
    delete validators.fail2
    delete validators.pass
    delete validators.pass2
    delete validate.options
  })

  it('raises an error if a promise is returned', function () {
    fail.and.returnValue(new validate.Promise(function () {}))
    const constraints = { name: { fail: true } }
    expect(function () {
      validate({}, constraints)
    }).toThrow()
  })

  it("doesn't fail if the value is a promise", function () {
    const constraints = { name: { pass: true } }
    expect(
      validate({ name: Promise.resolve() }, constraints)
    ).not.toBeDefined()
  })

  it('runs as expected', function () {
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

    fail.and.returnValue('must be a valid email address')
    fail2.and.returnValue('is simply not good enough')

    expect(validate(attributes, constraints)).toEqual({
      email: [
        'Email must be a valid email address',
        'Email is simply not good enough'
      ],
      'addresses.work.street': [
        'Addresses work street is simply not good enough'
      ]
    })

    expect(validate(attributes, constraints, { format: 'flat' })).toEqual([
      'Email must be a valid email address',
      'Email is simply not good enough',
      'Addresses work street is simply not good enough'
    ])
  })

  it('works with nested objects set to null', function () {
    const constraints = {
      'foo.bar': {
        presence: true
      }
    }
    expect(validate({ foo: null }, constraints)).toBeDefined()
  })

  describe('runValidations', function () {
    it('throws an error when the validator is not found', function () {
      expect(function () {
        validate.runValidations({}, { name: { foobar: true } }, {})
      }).toThrow(new Error('Unknown validator foobar'))
    })

    it('calls the validator with the validator itself as context', function () {
      validate.runValidations({}, { name: { pass: true } }, {})
      expect(pass).toHaveBeenCalledWithContext(pass)
    })

    it('calls the validator with the val, opts, key, attributes and global options', function () {
      const options = { someOption: true }
      const attributes = { someAttribute: 'some value' }
      const constraints = { someAttribute: { pass: options } }
      const globalOptions = { someOption: 'some value' }
      validate.runValidations(attributes, constraints, globalOptions)
      expect(pass).toHaveBeenCalledWith(
        'some value',
        options,
        'someAttribute',
        attributes,
        globalOptions
      )
    })

    it('returns an array of results', function () {
      fail.and.returnValue('foobar')
      fail2.and.returnValue(['foo', 'bar'])
      pass.and.returnValue(null)

      const options = { someOption: true }
      const globalOptions = { globalOption: 'globalValue' }
      const constraints = { name: { fail: options, fail2: true, pass: true } }
      const attributes = { name: 'test' }
      const result = validate.runValidations(
        attributes,
        constraints,
        globalOptions
      )

      expect(result).toHaveItems([
        {
          attribute: 'name',
          value: 'test',
          validator: 'fail',
          options,
          attributes,
          globalOptions,
          error: 'foobar'
        },
        {
          attribute: 'name',
          value: 'test',
          validator: 'fail2',
          options: true,
          attributes,
          globalOptions,
          error: ['foo', 'bar']
        },
        {
          attribute: 'name',
          value: 'test',
          validator: 'pass',
          options: true,
          attributes,
          globalOptions,
          error: null
        }
      ])
    })

    it('validates all attributes', function () {
      fail.and.returnValue('error')
      const constraints = {
        attr1: { pass: { foo: 'bar' } },
        attr2: { fail: true },
        attr3: { fail: true }
      }
      expect(validate.runValidations({}, constraints, {})).toHaveItems([
        {
          attribute: 'attr1',
          value: undefined,
          validator: 'pass',
          options: { foo: 'bar' },
          attributes: {},
          globalOptions: {},
          error: undefined
        },
        {
          attribute: 'attr2',
          value: undefined,
          validator: 'fail',
          options: true,
          attributes: {},
          globalOptions: {},
          error: 'error'
        },
        {
          attribute: 'attr3',
          value: undefined,
          validator: 'fail',
          options: true,
          attributes: {},
          globalOptions: {},
          error: 'error'
        }
      ])
    })

    it('allows the options for an attribute to be a function', function () {
      const options = { pass: { option1: 'value1' } }
      const attrs = { name: 'Nicklas' }
      const spy = jasmine.createSpy('options').and.returnValue(options)
      const constraints = { name: spy }
      const globalOptions = { foo: 'bar' }
      validate.runValidations(attrs, constraints, globalOptions)
      expect(spy).toHaveBeenCalledWith(
        'Nicklas',
        attrs,
        'name',
        globalOptions,
        constraints
      )
      expect(pass).toHaveBeenCalledWith(
        'Nicklas',
        options.pass,
        'name',
        attrs,
        globalOptions
      )
    })

    it('allows the options for a validator to be a function', function () {
      const options = { option1: 'value1' }
      const attrs = { name: 'Nicklas' }
      const spy = jasmine.createSpy('options').and.returnValue(options)
      const constraints = { name: { pass: spy } }
      const globalOptions = { foo: 'bar' }
      validate.runValidations(attrs, constraints, globalOptions)
      expect(spy).toHaveBeenCalledWith(
        'Nicklas',
        attrs,
        'name',
        globalOptions,
        constraints
      )
      expect(pass).toHaveBeenCalledWith(
        'Nicklas',
        options,
        'name',
        attrs,
        globalOptions
      )
    })

    it('doesnt run the validations if the options are falsy', function () {
      validate.runValidations(
        {},
        { name: { pass: false }, email: { pass: null } },
        {}
      )
      expect(pass).not.toHaveBeenCalled()
    })

    it('calls collectFormValues if the attributes is a DOM or jQuery element', function () {
      const form = document.createElement('div')
      const $form = $(form)
      form.innerHTML = '<input type="text" name="foo" value="bar">'
      spyOn(validate, 'collectFormValues').and.callThrough()
      spyOn(validate.validators, 'presence').and.callThrough()
      const constraints = { foo: { presence: true } }

      validate(form, constraints)

      expect(validate.collectFormValues).toHaveBeenCalledWith(form)
      expect(validate.validators.presence).toHaveBeenCalledWith(
        'bar',
        true,
        'foo',
        { foo: 'bar' },
        {}
      )

      validate($form, constraints)
      expect(validate.collectFormValues).toHaveBeenCalledWith($form)
      expect(validate.validators.presence).toHaveBeenCalledWith(
        'bar',
        true,
        'foo',
        { foo: 'bar' },
        {}
      )
    })

    it('calls custom prettify in global options', function () {
      const constraints = { foo: { presence: true } }
      const options = { format: 'flat', prettify: function () {} }
      spyOn(options, 'prettify').and.returnValue('foobar')
      spyOn(validate, 'prettify').and.returnValue('baz')
      expect(validate({}, constraints, options)).toEqual([
        "Foobar can't be blank"
      ])
      expect(options.prettify).toHaveBeenCalledWith('foo')
      expect(validate.prettify).not.toHaveBeenCalled()
    })

    it('calls custom prettify in global options inside numericality validator', function () {
      const constraints = { foo: { numericality: { greaterThan: 0 } } }
      const options = { format: 'flat', prettify: function () {} }
      spyOn(options, 'prettify').and.returnValue('foobar')
      spyOn(validate, 'prettify').and.returnValue('baz')
      expect(validate({ foo: 0 }, constraints, options)).toEqual([
        'Foobar must be foobar 0'
      ])
      const args = options.prettify.calls.allArgs()
      expect(args).toContain(['foo'])
      expect(args).toContain(['greaterThan'])
      expect(validate.prettify).not.toHaveBeenCalled()
    })

    it('calls custom prettify in global options inside equality validator', function () {
      const constraints = { bar: { equality: { attribute: 'foo' } } }
      const options = { format: 'flat', prettify: function () {} }
      spyOn(options, 'prettify').and.returnValue('foobar')
      spyOn(validate, 'prettify').and.returnValue('baz')
      expect(validate({ foo: 'a', bar: 'b' }, constraints, options)).toEqual([
        'Foobar is not equal to foobar'
      ])
      expect(options.prettify.calls.allArgs()).toContain(['bar'])
      expect(validate.prettify).not.toHaveBeenCalled()
    })

    it('calls custom prettify in numericality options', function () {
      const constraints = {
        foo: { numericality: { greaterThan: 0, prettify: function () {} } }
      }
      const options = { format: 'flat', prettify: function () {} }
      spyOn(options, 'prettify').and.returnValue('foobar')
      spyOn(constraints.foo.numericality, 'prettify').and.returnValue(
        'grooter than'
      )
      spyOn(validate, 'prettify').and.returnValue('baz')
      expect(validate({ foo: 0 }, constraints, options)).toEqual([
        'Foobar must be grooter than 0'
      ])
      expect(options.prettify).toHaveBeenCalledWith('foo')
      expect(constraints.foo.numericality.prettify).toHaveBeenCalledWith(
        'greaterThan'
      )
      expect(validate.prettify).not.toHaveBeenCalled()
    })

    it('calls custom prettify in equality options', function () {
      const constraints = {
        bar: { equality: { attribute: 'foo', prettify: function () {} } }
      }
      const options = { format: 'flat', prettify: function () {} }
      spyOn(options, 'prettify').and.returnValue('foobar')
      spyOn(constraints.bar.equality, 'prettify').and.returnValue('qux')
      spyOn(validate, 'prettify').and.returnValue('baz')
      expect(validate({ foo: 'a', bar: 'b' }, constraints, options)).toEqual([
        'Foobar is not equal to qux'
      ])
      expect(options.prettify.calls.allArgs()).toContain(['bar'])
      expect(constraints.bar.equality.prettify).toHaveBeenCalledWith('foo')
      expect(validate.prettify).not.toHaveBeenCalled()
    })
  })

  describe('format', function () {
    describe('flat', function () {
      it('returns a flat list of errors', function () {
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
        expect(validate({ foo: 'bar' }, c, { format: 'flat' })).toHaveItems([
          'Foo some error',
          'Foo is not a number'
        ])
      })

      it('fullMessages = false', function () {
        const constraints = { foo: { presence: true } }
        const options = { format: 'flat', fullMessages: false }
        expect(validate({}, constraints, options)).toEqual(["can't be blank"])
      })

      it('deduplicates errors', function () {
        const c = {
          foo: {
            numericality: {
              message: 'some error'
            },
            length: {
              is: 23,
              wrongLength: 'some error'
            }
          }
        }
        expect(validate({ foo: 'bar' }, c, { format: 'flat' })).toHaveItems([
          'Foo some error'
        ])
      })
    })

    describe('grouped', function () {
      it('deduplicates errors', function () {
        const c = {
          foo: {
            numericality: {
              message: 'some error'
            },
            length: {
              is: 23,
              wrongLength: 'some error'
            }
          }
        }
        expect(validate({ foo: 'bar' }, c)).toEqual({
          foo: ['Foo some error']
        })
      })
    })

    describe('detailedErrors', function () {
      it('allows you to get more info about the errors', function () {
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
        expect(validate(attributes, c, options)).toHaveItems([
          {
            attribute: 'foo',
            value: 'foo',
            validator: 'length',
            options: {
              is: 15,
              message: '^foobar',
              someOption: 'someValue'
            },
            attributes,
            globalOptions: options,
            error: 'foobar'
          },
          {
            attribute: 'bar',
            value: 10,
            validator: 'numericality',
            options: {
              lessThan: 5,
              greaterThan: 15
            },
            attributes,
            globalOptions: options,
            error: 'Bar must be greater than 15'
          },
          {
            attribute: 'bar',
            value: 10,
            validator: 'numericality',
            options: {
              lessThan: 5,
              greaterThan: 15
            },
            attributes,
            globalOptions: options,
            error: 'Bar must be less than 5'
          }
        ])
      })
    })
    describe('constraint', function () {
      it('returns constraint names', function () {
        const c = {
          foo: {
            numericality: true,
            length: {
              is: 23
            }
          }
        }
        expect(validate({ foo: 'bar' }, c, { format: 'constraint' })).toEqual({
          foo: ['length', 'numericality']
        })
      })
      it('sorts constraint names', function () {
        const c = {
          foo: {
            numericality: true,
            length: {
              is: 23
            }
          }
        }
        expect(validate({ foo: 'bar' }, c, { format: 'constraint' })).toEqual({
          foo: ['length', 'numericality']
        })
      })
    })
  })

  it('allows validators to return functions as messages', function () {
    const message = jasmine.createSpy('message').and.returnValue('some message')
    const validatorOptions = { validatorOption: 'validatorValue' }
    const options = { option: 'value' }
    const constraints = { foo: { fail: validatorOptions } }
    const attributes = { foo: 'bar' }
    fail.and.returnValue(message)
    expect(validate(attributes, constraints, options)).toEqual({
      foo: ['Foo some message']
    })
    expect(message).toHaveBeenCalledWith(
      'bar',
      'foo',
      validatorOptions,
      attributes,
      options
    )
  })

  it('allows validators to return objects as messages', function () {
    const message = { foo: 'bar' }
    fail.and.returnValue(message)
    expect(validate({}, { foo: { fail: true } })).toEqual({
      foo: [message]
    })
  })

  it('allows default options', function () {
    const constraints = { foo: { presence: true } }
    const options = { foo: 'bar' }
    validate.options = { format: 'flat' }
    expect(validate({}, constraints, options)).toEqual(["Foo can't be blank"])
    expect(options).toEqual({ foo: 'bar' })
    expect(validate.options).toEqual({ format: 'flat' })
  })

  describe('single', function () {
    it('validates the single property', function () {
      const validators = {
        presence: {
          message: 'example message'
        },
        length: {
          is: 6,
          message: '^It needs to be 6 characters long'
        }
      }

      expect(validate.single(null, validators)).toEqual(['example message'])
      expect(validate.single('foo', validators)).toEqual([
        'It needs to be 6 characters long'
      ])
      expect(validate.single('foobar', validators)).not.toBeDefined()
    })

    it("doesn't support the format and fullMessages options", function () {
      const validators = { presence: true }
      const options = { format: 'detailed', fullMessages: true }

      expect(validate.single(null, validators, options)).toEqual([
        "can't be blank"
      ])
    })
  })

  describe('version', function () {
    const metadata = validate.version.metadata

    beforeEach(function () {
      validate.version.metadata = null
    })

    afterEach(function () {
      validate.version.metadata = metadata
    })

    it('contains major, minor and patch version', function () {
      expect(validate.version.major).toBeANumber()
      expect(validate.version.minor).toBeANumber()
      expect(validate.version.patch).toBeANumber()
    })

    it('can be converted to a string', function () {
      const version =
        validate.version.major +
        '.' +
        validate.version.minor +
        '.' +
        validate.version.patch

      expect('' + validate.version).toEqual(version)
    })

    it('the string version can have metadata', function () {
      const version =
        validate.version.major +
        '.' +
        validate.version.minor +
        '.' +
        validate.version.patch +
        '+foobar'

      validate.version.metadata = 'foobar'

      expect('' + validate.version).toEqual(version)
    })
  })
})
