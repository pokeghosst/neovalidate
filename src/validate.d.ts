declare module 'neovalidate' {
  type Primitive = string | number | boolean | null | undefined
  type AttributeValue = Primitive | Date | Primitive[] | { [key: string]: any }
  type Attributes = { [key: string]: AttributeValue }

  type ConstraintFunction<T = any> = (
    value: T,
    attributes: Attributes,
    attributeName: string,
    options: ValidatorOptions,
    constraints: Constraints
  ) => any

  type ConstraintValue<T = any> = T | ConstraintFunction<T>

  interface PresenceOptions {
    allowEmpty?: boolean
    message?: string
  }

  interface LengthOptions {
    is?: number
    minimum?: number
    maximum?: number
    tokenizer?: (value: any) => any
    message?: string
    wrongLength?: string
    tooShort?: string
    tooLong?: string
    notValid?: string
  }

  interface NumericalityOptions {
    strict?: boolean
    onlyInteger?: boolean
    noStrings?: boolean
    greaterThan?: number
    greaterThanOrEqualTo?: number
    equalTo?: number
    lessThan?: number
    lessThanOrEqualTo?: number
    divisibleBy?: number
    odd?: boolean
    even?: boolean
    message?: string
    notValid?: string
    notInteger?: string
    notGreaterThan?: string
    notGreaterThanOrEqualTo?: string
    notEqualTo?: string
    notLessThan?: string
    notLessThanOrEqualTo?: string
    notDivisibleBy?: string
    notOdd?: string
    notEven?: string
    prettify?: (value: any) => string
  }

  interface DatetimeOptions {
    earliest?: any
    latest?: any
    dateOnly?: boolean
    message?: string
    notValid?: string
    tooEarly?: string
    tooLate?: string
  }

  interface FormatOptions {
    pattern: string | RegExp
    flags?: string
    message?: string
  }

  interface InclusionOptions {
    within: any[]
    message?: string
  }

  interface ExclusionOptions {
    within: any[]
    message?: string
  }

  interface EmailOptions {
    message?: string
  }

  interface EqualityOptions {
    attribute: string
    comparator?: (
      v1: any,
      v2: any,
      options: EqualityOptions,
      attribute: string,
      attributes: Attributes
    ) => boolean
    message?: string
    prettify?: (value: any) => string
  }

  interface UrlOptions {
    schemes?: string[]
    allowLocal?: boolean
    allowDataUrl?: boolean
    message?: string
  }

  interface TypeOptions {
    type:
      | string
      | ((
          value: any,
          options: TypeOptions,
          attribute: string,
          attributes: Attributes,
          globalOptions: ValidatorOptions
        ) => boolean)
    message?:
      | string
      | ((
          value: any,
          options: TypeOptions,
          attribute: string,
          attributes: Attributes,
          globalOptions: ValidatorOptions
        ) => string)
  }

  interface ValidatorConstraints {
    presence?: ConstraintValue<PresenceOptions | boolean>
    length?: ConstraintValue<LengthOptions>
    numericality?: ConstraintValue<NumericalityOptions | boolean>
    datetime?: ConstraintValue<DatetimeOptions>
    date?: ConstraintValue<DatetimeOptions>
    format?: ConstraintValue<FormatOptions | string | RegExp>
    inclusion?: ConstraintValue<InclusionOptions | any[]>
    exclusion?: ConstraintValue<ExclusionOptions | any[]>
    email?: ConstraintValue<EmailOptions | boolean>
    equality?: ConstraintValue<EqualityOptions | string>
    url?: ConstraintValue<UrlOptions>
    type?: ConstraintValue<TypeOptions | string>
    [validatorName: string]: any
  }

  type Constraints = {
    [attributeName: string]: ValidatorConstraints | ConstraintFunction
  }

  interface ValidatorOptions {
    format?: 'grouped' | 'flat' | 'detailed' | 'constraint'
    fullMessages?: boolean
    cleanAttributes?: boolean
    nullify?: boolean
    prettify?: (value: any) => string
    wrapErrors?: new (
      errors: any,
      options: ValidatorOptions,
      attributes: Attributes,
      constraints: Constraints
    ) => Error
  }

  interface FormCollectionOptions {
    trim?: boolean
    nullify?: boolean
  }

  interface ValidationError {
    attribute: string
    value: any
    validator: string
    globalOptions: ValidatorOptions
    attributes: Attributes
    options: any
    error: string
  }

  type ValidationResult =
    | undefined
    | string[]
    | { [attribute: string]: string[] }
    | ValidationError[]

  type ValidatorFunction = (
    value: any,
    options: any,
    attribute?: string,
    attributes?: Attributes,
    globalOptions?: ValidatorOptions
  ) => string | string[] | undefined

  interface TypeCheckers {
    object: (value: any) => boolean
    array: (value: any) => boolean
    integer: (value: any) => boolean
    number: (value: any) => boolean
    string: (value: any) => boolean
    date: (value: any) => boolean
    boolean: (value: any) => boolean
    [typeName: string]: (value: any) => boolean
  }

  interface DatetimeValidator extends ValidatorFunction {
    parse: ((value: any, options: any) => number) | null
    format: ((value: number, options: any) => string) | null
  }

  interface EmailValidator extends ValidatorFunction {
    PATTERN: RegExp
  }

  interface TypeValidator extends ValidatorFunction {
    types: TypeCheckers
    messages: { [typeName: string]: string }
  }

  interface UrlValidator extends ValidatorFunction {
    schemes: string[]
    allowLocal: boolean
    allowDataUrl: boolean
  }

  interface Validators {
    presence: ValidatorFunction
    length: ValidatorFunction
    numericality: ValidatorFunction
    datetime: DatetimeValidator
    date: ValidatorFunction
    format: ValidatorFunction
    inclusion: ValidatorFunction
    exclusion: ValidatorFunction
    email: EmailValidator
    equality: ValidatorFunction
    url: UrlValidator
    type: TypeValidator
    [validatorName: string]: ValidatorFunction
  }

  type FormatterFunction = (errors: ValidationError[]) => any

  interface Formatters {
    detailed: FormatterFunction
    flat: FormatterFunction
    grouped: FormatterFunction
    constraint: FormatterFunction
    [formatterName: string]: FormatterFunction
  }

  export default class Validator {
    constructor(options?: ValidatorOptions)

    validate(
      attributes: Attributes,
      constraints: Constraints,
      options?: ValidatorOptions
    ): ValidationResult
    validateAsync(
      attributes: Attributes,
      constraints: Constraints,
      options?: ValidatorOptions
    ): Promise<Attributes>
    single(
      value: any,
      constraints: ValidatorConstraints,
      options?: ValidatorOptions
    ): ValidationResult

    static Promise: typeof Promise | null
    static EMPTY_STRING_REGEXP: RegExp
    static validators: Validators
    static formatters: Formatters

    static validate(
      attributes: Attributes,
      constraints: Constraints,
      options?: ValidatorOptions
    ): ValidationResult
    static validateAsync(
      attributes: Attributes,
      constraints: Constraints,
      options?: ValidatorOptions
    ): Promise<Attributes>
    static single(
      value: any,
      constraints: ValidatorConstraints,
      options?: ValidatorOptions
    ): ValidationResult

    static cleanAttributes(
      attributes: Attributes,
      whitelist: Constraints
    ): Attributes
    static extend<T extends object>(obj: T, ...sources: Partial<T>[]): T
    static result<T>(value: T | ((...args: any[]) => T), ...args: any[]): T

    static isNumber(value: any): value is number
    static isFunction(value: any): value is Function
    static isInteger(value: any): value is number
    static isBoolean(value: any): value is boolean
    static isObject(value: any): value is object
    static isDate(value: any): value is Date
    static isDefined(value: any): boolean
    static isPromise(value: any): value is Promise<any>
    static isJqueryElement(value: any): boolean
    static isDomElement(value: any): value is Element
    static isEmpty(value: any): boolean
    static isString(value: any): value is string
    static isArray(value: any): value is any[]
    static isHash(value: any): value is object

    static format(str: string, vals: { [key: string]: any }): string
    static prettify(str: any): string
    static stringifyValue(
      value: any,
      options?: { prettify?: (value: any) => string }
    ): string
    static capitalize(str: string): string

    static contains(obj: any, value: any): boolean
    static unique<T>(array: T[]): T[]
    static collectFormValues(
      form: Element | any,
      options?: FormCollectionOptions
    ): Attributes
    static sanitizeFormValue(
      value: string,
      options: FormCollectionOptions
    ): string | null

    static forEachKeyInKeypath(
      object: any,
      keypath: string,
      callback: (obj: any, key: string, last: boolean) => any
    ): any
    static getDeepObjectValue(obj: any, keypath: string): any

    static pruneEmptyErrors(errors: ValidationError[]): ValidationError[]
    static expandMultipleErrors(errors: ValidationError[]): ValidationError[]
    static convertErrorMessages(
      errors: ValidationError[],
      options?: ValidatorOptions
    ): ValidationError[]
    static groupErrorsByAttribute(errors: ValidationError[]): {
      [attribute: string]: ValidationError[]
    }
    static flattenErrorsToArray(errors: ValidationError[]): string[]

    static warn(msg: string): void
    static error(msg: string): void
  }
}
