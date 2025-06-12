# neovalidate

Modernized fork of Validate.js, a declarative validation library.

<a href="https://github.com/pokeghosst/neovalidate/blob/main/LICENSE">
  <img src="https://badgen.now.sh/github/license/pokeghosst/neovalidate" alt="license" />
</a>
<a href="https://npmjs.org/package/neovalidate">
  <img src="https://badgen.now.sh/npm/v/neovalidate" alt="version" />
</a>
<a href="https://npmjs.org/package/neovalidate">
  <img src="https://badgen.now.sh/npm/dm/neovalidate" alt="downloads" />
</a>

## Installing

```
npm install neovalidate
```

## Usage

Toy example:

```js
import Validator from './src/validator'

const validator = new Validator()

const constraints = {
  username: {
    presence: true
  },
  password: {
    presence: true,
    length: {
      minimum: 8,
      message: 'must be at least 8 characters'
    }
  }
}

const result = validator.validate({ password: 'qwerty' }, constraints)
console.log(result)
/*
{
  username: [ "Username can't be blank" ],
  password: [ "Password must be at least 8 characters" ],
}
*/
```

See https://validatejs.org/ for full docs.

## Contributing

If you'd like to contribute, please fork the repository and use a feature branch. Pull requests are warmly welcome.

For bugs and feature requests, don't hesitate to open issues!

## License & Attribution

neovalidate is distributed under MIT license. See LICENSE.txt for details.

This project is a derivative work of [validate.js](https://github.com/ansman/validate.js) by Nicklas Ansman.
