'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let object = require('./object');
let test = require('./test');

// ******************************
// Functions:
// ******************************

function runTests() {
    cprint.magenta('Running object mask tests...');

    test.assertEquals('isUndefined returns true for undefined', true, object.isUndefined(undefined));
    test.assertEquals('isUndefined returns false for null', false, object.isUndefined(null));
    test.assertEquals('isUndefined returns false for true', false, object.isUndefined(true));
    test.assertEquals('isUndefined returns false for false', false, object.isUndefined(false));
    test.assertEquals('isUndefined returns false for 0', false, object.isUndefined(0));
    test.assertEquals('isUndefined returns false for number', false, object.isUndefined(123));
    test.assertEquals('isUndefined returns false for empty string', false, object.isUndefined(''));
    test.assertEquals('isUndefined returns false for string', false, object.isUndefined('some string'));
    test.assertEquals('isUndefined returns false for empty array', false, object.isUndefined([]));
    test.assertEquals('isUndefined returns false for empty object', false, object.isUndefined({}));
    test.assertEquals('isUndefined returns false for array', false, object.isUndefined([1, 2, 3]));
    test.assertEquals('isUndefined returns false for object', false, object.isUndefined({ a: 'b' }));

    test.assertEquals('isArray returns false for undefined', false, object.isArray(undefined));
    test.assertEquals('isArray returns false for null', false, object.isArray(null));
    test.assertEquals('isArray returns false for true', false, object.isArray(true));
    test.assertEquals('isArray returns false for false', false, object.isArray(false));
    test.assertEquals('isArray returns false for 0', false, object.isArray(0));
    test.assertEquals('isArray returns false for number', false, object.isArray(123));
    test.assertEquals('isArray returns false for empty string', false, object.isArray(''));
    test.assertEquals('isArray returns false for string', false, object.isArray('some string'));
    test.assertEquals('isArray returns true for empty array', true, object.isArray([]));
    test.assertEquals('isArray returns false for empty object', false, object.isArray({}));
    test.assertEquals('isArray returns true for array', true, object.isArray([1, 2, 3]));
    test.assertEquals('isArray returns false for object', false, object.isArray({ a: 'b' }));

    test.assertEquals('isObject returns false for undefined', false, object.isObject(undefined));
    test.assertEquals('isObject returns false for null', false, object.isObject(null));
    test.assertEquals('isObject returns false for true', false, object.isObject(true));
    test.assertEquals('isObject returns false for false', false, object.isObject(false));
    test.assertEquals('isObject returns false for 0', false, object.isObject(0));
    test.assertEquals('isObject returns false for number', false, object.isObject(123));
    test.assertEquals('isObject returns false for empty string', false, object.isObject(''));
    test.assertEquals('isObject returns false for string', false, object.isObject('some string'));
    test.assertEquals('isObject returns false for empty array', false, object.isObject([]));
    test.assertEquals('isObject returns true for empty object', true, object.isObject({}));
    test.assertEquals('isObject returns false for array', false, object.isObject([1, 2, 3]));
    test.assertEquals('isObject returns true for object', true, object.isObject({ a: 'b' }));

    test.assertEquals('isObjectOrArray returns false for undefined', false, object.isObjectOrArray(undefined));
    test.assertEquals('isObjectOrArray returns false for null', false, object.isObjectOrArray(null));
    test.assertEquals('isObjectOrArray returns false for true', false, object.isObjectOrArray(true));
    test.assertEquals('isObjectOrArray returns false for false', false, object.isObjectOrArray(false));
    test.assertEquals('isObjectOrArray returns false for 0', false, object.isObjectOrArray(0));
    test.assertEquals('isObjectOrArray returns false for number', false, object.isObjectOrArray(123));
    test.assertEquals('isObjectOrArray returns false for empty string', false, object.isObjectOrArray(''));
    test.assertEquals('isObjectOrArray returns false for string', false, object.isObjectOrArray('some string'));
    test.assertEquals('isObjectOrArray returns true for empty array', true, object.isObjectOrArray([]));
    test.assertEquals('isObjectOrArray returns true for empty object', true, object.isObjectOrArray({}));
    test.assertEquals('isObjectOrArray returns true for array', true, object.isObjectOrArray([1, 2, 3]));
    test.assertEquals('isObjectOrArray returns true for object', true, object.isObjectOrArray({ a: 'b' }));

    test.assertEquals('isEmpty returns false for undefined', false, object.isEmpty(undefined));
    test.assertEquals('isEmpty returns false for null', false, object.isEmpty(null));
    test.assertEquals('isEmpty returns false for true', false, object.isEmpty(true));
    test.assertEquals('isEmpty returns false for false', false, object.isEmpty(false));
    test.assertEquals('isEmpty returns false for 0', false, object.isEmpty(0));
    test.assertEquals('isEmpty returns false for number', false, object.isEmpty(123));
    test.assertEquals('isEmpty returns false for empty string', false, object.isEmpty(''));
    test.assertEquals('isEmpty returns false for string', false, object.isEmpty('some string'));
    test.assertEquals('isEmpty returns false for empty array', false, object.isEmpty([]));
    test.assertEquals('isEmpty returns true for empty object', true, object.isEmpty({}));
    test.assertEquals('isEmpty returns false for array', false, object.isEmpty([1, 2, 3]));
    test.assertEquals('isEmpty returns false for object', false, object.isEmpty({ a: 'b' }));

    test.assertEquals('undefined mask on undefined', undefined, object.setMask(undefined, undefined));
    test.assertEquals('undefined mask on null', null, object.setMask(undefined, null));
    test.assertEquals('undefined mask on false', false, object.setMask(undefined, false));
    test.assertEquals('undefined mask on number', 123, object.setMask(undefined, 123));
    test.assertEquals('undefined mask on string', '123', object.setMask(undefined, '123'));
    test.assertEquals('undefined mask on empty array', [], object.setMask(undefined, []));
    test.assertEquals('undefined mask on empty object', {}, object.setMask(undefined, {}));
    test.assertEquals('undefined mask on array', [1, 2, 3, 4], object.setMask(undefined, [1, 2, 3, 4]));
    test.assertEquals('undefined mask on object', { a: '1' }, object.setMask(undefined, { a: '1' }));
    test.assertEquals('undefined mask on array with undefined', [undefined], object.setMask(undefined, [undefined]));
    test.assertEquals('undefined mask on object with undefined', { a: undefined }, object.setMask(undefined, { a: undefined }));
    test.assertEquals('undefined mask on array with partial undefined', [undefined, 4, undefined, 5], object.setMask(undefined, [undefined, 4, undefined, 5]));
    test.assertEquals('undefined mask on object with partial undefined', { a: undefined, b: '2' }, object.setMask(undefined, { a: undefined, b: '2' }));

    test.assertEquals('null mask on undefined', null, object.setMask(null, undefined));
    test.assertEquals('null mask on null', null, object.setMask(null, null));
    test.assertEquals('null mask on false', null, object.setMask(null, false));
    test.assertEquals('null mask on number', null, object.setMask(null, 123));
    test.assertEquals('null mask on string', null, object.setMask(null, '123'));
    test.assertEquals('null mask on empty array', null, object.setMask(null, []));
    test.assertEquals('null mask on empty object', null, object.setMask(null, {}));
    test.assertEquals('null mask on array', null, object.setMask(null, [1, 2, 3, 4]));
    test.assertEquals('null mask on object', null, object.setMask(null, { a: '1' }));
    test.assertEquals('null mask on array with undefined', null, object.setMask(null, [undefined]));
    test.assertEquals('null mask on object with undefined', null, object.setMask(null, { a: undefined }));
    test.assertEquals('null mask on array with partial undefined', null, object.setMask(null, [undefined, 4, undefined, 5]));
    test.assertEquals('null mask on object with partial undefined', null, object.setMask(null, { a: undefined, b: '2' }));

    test.assertEquals('false mask on undefined', false, object.setMask(false, undefined));
    test.assertEquals('false mask on null', false, object.setMask(false, null));
    test.assertEquals('false mask on false', false, object.setMask(false, false));
    test.assertEquals('false mask on number', false, object.setMask(false, 123));
    test.assertEquals('false mask on string', false, object.setMask(false, '123'));
    test.assertEquals('false mask on empty array', false, object.setMask(false, []));
    test.assertEquals('false mask on empty object', false, object.setMask(false, {}));
    test.assertEquals('false mask on array', false, object.setMask(false, [1, 2, 3, 4]));
    test.assertEquals('false mask on object', false, object.setMask(false, { a: '1' }));
    test.assertEquals('false mask on array with undefined', false, object.setMask(false, [undefined]));
    test.assertEquals('false mask on object with undefined', false, object.setMask(false, { a: undefined }));
    test.assertEquals('false mask on array with partial undefined', false, object.setMask(false, [undefined, 4, undefined, 5]));
    test.assertEquals('false mask on object with partial undefined', false, object.setMask(false, { a: undefined, b: '2' }));

    test.assertEquals('true mask on undefined', true, object.setMask(true, undefined));
    test.assertEquals('true mask on null', true, object.setMask(true, null));
    test.assertEquals('true mask on false', true, object.setMask(true, false));
    test.assertEquals('true mask on number', true, object.setMask(true, 123));
    test.assertEquals('true mask on string', true, object.setMask(true, '123'));
    test.assertEquals('true mask on empty array', true, object.setMask(true, []));
    test.assertEquals('true mask on empty object', true, object.setMask(true, {}));
    test.assertEquals('true mask on array', true, object.setMask(true, [1, 2, 3, 4]));
    test.assertEquals('true mask on object', true, object.setMask(true, { a: '1' }));
    test.assertEquals('true mask on array with undefined', true, object.setMask(true, [undefined]));
    test.assertEquals('true mask on object with undefined', true, object.setMask(true, { a: undefined }));
    test.assertEquals('true mask on array with partial undefined', true, object.setMask(true, [undefined, 4, undefined, 5]));
    test.assertEquals('true mask on object with partial undefined', true, object.setMask(true, { a: undefined, b: '2' }));

    test.assertEquals('number mask on undefined', 12345, object.setMask(12345, undefined));
    test.assertEquals('number mask on null', 12345, object.setMask(12345, null));
    test.assertEquals('number mask on false', 12345, object.setMask(12345, false));
    test.assertEquals('number mask on number', 12345, object.setMask(12345, 123));
    test.assertEquals('number mask on string', 12345, object.setMask(12345, '123'));
    test.assertEquals('number mask on empty array', 12345, object.setMask(12345, []));
    test.assertEquals('number mask on empty object', 12345, object.setMask(12345, {}));
    test.assertEquals('number mask on array', 12345, object.setMask(12345, [1, 2, 3, 4]));
    test.assertEquals('number mask on object', 12345, object.setMask(12345, { a: '1' }));
    test.assertEquals('number mask on array with undefined', 12345, object.setMask(12345, [undefined]));
    test.assertEquals('number mask on object with undefined', 12345, object.setMask(12345, { a: undefined }));
    test.assertEquals('number mask on array with partial undefined', 12345, object.setMask(12345, [undefined, 4, undefined, 5]));
    test.assertEquals('number mask on object with partial undefined', 12345, object.setMask(12345, { a: undefined, b: '2' }));

    test.assertEquals('string mask on undefined', 'some string', object.setMask('some string', undefined));
    test.assertEquals('string mask on null', 'some string', object.setMask('some string', null));
    test.assertEquals('string mask on false', 'some string', object.setMask('some string', false));
    test.assertEquals('string mask on number', 'some string', object.setMask('some string', 123));
    test.assertEquals('string mask on string', 'some string', object.setMask('some string', '123'));
    test.assertEquals('string mask on empty array', 'some string', object.setMask('some string', []));
    test.assertEquals('string mask on empty object', 'some string', object.setMask('some string', {}));
    test.assertEquals('string mask on array', 'some string', object.setMask('some string', [1, 2, 3, 4]));
    test.assertEquals('string mask on object', 'some string', object.setMask('some string', { a: '1' }));
    test.assertEquals('string mask on array with undefined', 'some string', object.setMask('some string', [undefined]));
    test.assertEquals('string mask on object with undefined', 'some string', object.setMask('some string', { a: undefined }));
    test.assertEquals('string mask on array with partial undefined', 'some string', object.setMask('some string', [undefined, 4, undefined, 5]));
    test.assertEquals('string mask on object with partial undefined', 'some string', object.setMask('some string', { a: undefined, b: '2' }));

    test.assertEquals('object mask on undefined', { a: 1, b: 'c' }, object.setMask({ a: 1, b: 'c' }, undefined));
    test.assertEquals('object mask on null', { a: 1, b: 'c' }, object.setMask({ a: 1, b: 'c' }, null));
    test.assertEquals('object mask on false', { a: 1, b: 'c' }, object.setMask({ a: 1, b: 'c' }, false));
    test.assertEquals('object mask on number', { a: 1, b: 'c' }, object.setMask({ a: 1, b: 'c' }, 123));
    test.assertEquals('object mask on string', { a: 1, b: 'c' }, object.setMask({ a: 1, b: 'c' }, '123'));
    test.assertEquals('object mask on empty array', { a: 1, b: 'c' }, object.setMask({ a: 1, b: 'c' }, []));
    test.assertEquals('object mask on empty object', { a: 1, b: 'c' }, object.setMask({ a: 1, b: 'c' }, {}));
    test.assertEquals('object mask on array', { a: 1, b: 'c' }, object.setMask({ a: 1, b: 'c' }, [1, 2, 3, 4]));
    test.assertEquals('object mask on object', { a: 1, b: 'c' }, object.setMask({ a: 1, b: 'c' }, { a: '1' }));
    test.assertEquals('object mask on array with undefined', { a: 1, b: 'c' }, object.setMask({ a: 1, b: 'c' }, [undefined]));
    test.assertEquals('object mask on object with undefined', { a: 1, b: 'c' }, object.setMask({ a: 1, b: 'c' }, { a: undefined }));
    test.assertEquals('object mask on array with partial undefined', { a: 1, b: 'c' }, object.setMask({ a: 1, b: 'c' }, [undefined, 4, undefined, 5]));

    test.assertEquals('object mask on object matches',
        {
            a: 1,
            b: 8,
            c: {
                d: 7,
                e: 4
            }
        },
        object.setMask(
            {
                a: 1,
                c: {
                    e: 4
                }
            },
            {
                a: 9,
                b: 8,
                c: {
                    d: 7,
                    e: { f: 6 }
                }
            }
        )
    );

    test.assertEquals('object mask with array values on object matches',
        {
            aa: 9,
            b: [
                1, 2
            ],
            c: {
                dd: 7,
                e: {
                    ff: 6,
                    f: 4
                },
                d: []
            },
            a: 1
        },
        object.setMask(
            {
                a: 1,
                b: [
                    1, 2
                ],
                c: {
                    d: [],
                    e: {
                        f: 4
                    }
                }
            },
            {
                aa: 9,
                b: {
                    a: {},
                    b: [1, 2, 3]
                },
                c: {
                    dd: 7,
                    e: { ff: 6 }
                }
            }
        )
    );

    test.assertEquals('object mask with array with object value on object matches',
        {
            c: [
                {
                    b: '123',
                    e: '987'
                }
            ]
        },
        object.setMask(
            {
                c: [
                    {
                        e: '987'
                    }
                ]
            },
            {
                c: [
                    {
                        b: '123',
                        e: '456'
                    }
                ]
            }
        )
    );

    test.assertEquals('undefined unset mask on undefined', undefined, object.unsetMask(undefined, undefined));
    test.assertEquals('undefined unset mask on null', null, object.unsetMask(undefined, null));
    test.assertEquals('undefined unset mask on false', false, object.unsetMask(undefined, false));
    test.assertEquals('undefined unset mask on number', 123, object.unsetMask(undefined, 123));
    test.assertEquals('undefined unset mask on string', '123', object.unsetMask(undefined, '123'));
    test.assertEquals('undefined unset mask on empty array', [], object.unsetMask(undefined, []));
    test.assertEquals('undefined unset mask on empty object', {}, object.unsetMask(undefined, {}));
    test.assertEquals('undefined unset mask on array', [1, 2, 3, 4], object.unsetMask(undefined, [1, 2, 3, 4]));
    test.assertEquals('undefined unset mask on object', { a: '1' }, object.unsetMask(undefined, { a: '1' }));
    test.assertEquals('undefined unset mask on array with undefined', [undefined], object.unsetMask(undefined, [undefined]));
    test.assertEquals('undefined unset mask on object with undefined', { a: undefined }, object.unsetMask(undefined, { a: undefined }));
    test.assertEquals('undefined unset mask on array with partial undefined', [undefined, 4, undefined, 5], object.unsetMask(undefined, [undefined, 4, undefined, 5]));
    test.assertEquals('undefined unset mask on object with partial undefined', { a: undefined, b: '2' }, object.unsetMask(undefined, { a: undefined, b: '2' }));

    test.assertEquals('null unset mask on undefined', undefined, object.unsetMask(null, undefined));
    test.assertEquals('null unset mask on null', undefined, object.unsetMask(null, null));
    test.assertEquals('null unset mask on false', undefined, object.unsetMask(null, false));
    test.assertEquals('null unset mask on number', undefined, object.unsetMask(null, 123));
    test.assertEquals('null unset mask on string', undefined, object.unsetMask(null, '123'));
    test.assertEquals('null unset mask on empty array', undefined, object.unsetMask(null, []));
    test.assertEquals('null unset mask on empty object', undefined, object.unsetMask(null, {}));
    test.assertEquals('null unset mask on array', undefined, object.unsetMask(null, [1, 2, 3, 4]));
    test.assertEquals('null unset mask on object', undefined, object.unsetMask(null, { a: '1' }));
    test.assertEquals('null unset mask on array with undefined', undefined, object.unsetMask(null, [undefined]));
    test.assertEquals('null unset mask on object with undefined', undefined, object.unsetMask(null, { a: undefined }));
    test.assertEquals('null unset mask on array with partial undefined', undefined, object.unsetMask(null, [undefined, 4, undefined, 5]));
    test.assertEquals('null unset mask on object with partial undefined', undefined, object.unsetMask(null, { a: undefined, b: '2' }));

    test.assertEquals('false unset mask on undefined', undefined, object.unsetMask(false, undefined));
    test.assertEquals('false unset mask on null', undefined, object.unsetMask(false, null));
    test.assertEquals('false unset mask on false', undefined, object.unsetMask(false, false));
    test.assertEquals('false unset mask on number', undefined, object.unsetMask(false, 123));
    test.assertEquals('false unset mask on string', undefined, object.unsetMask(false, '123'));
    test.assertEquals('false unset mask on empty array', undefined, object.unsetMask(false, []));
    test.assertEquals('false unset mask on empty object', undefined, object.unsetMask(false, {}));
    test.assertEquals('false unset mask on array', undefined, object.unsetMask(false, [1, 2, 3, 4]));
    test.assertEquals('false unset mask on object', undefined, object.unsetMask(false, { a: '1' }));
    test.assertEquals('false unset mask on array with undefined', undefined, object.unsetMask(false, [undefined]));
    test.assertEquals('false unset mask on object with undefined', undefined, object.unsetMask(false, { a: undefined }));
    test.assertEquals('false unset mask on array with partial undefined', undefined, object.unsetMask(false, [undefined, 4, undefined, 5]));
    test.assertEquals('false unset mask on object with partial undefined', undefined, object.unsetMask(false, { a: undefined, b: '2' }));

    test.assertEquals('true unset mask on undefined', undefined, object.unsetMask(true, undefined));
    test.assertEquals('true unset mask on null', undefined, object.unsetMask(true, null));
    test.assertEquals('true unset mask on false', undefined, object.unsetMask(true, false));
    test.assertEquals('true unset mask on number', undefined, object.unsetMask(true, 123));
    test.assertEquals('true unset mask on string', undefined, object.unsetMask(true, '123'));
    test.assertEquals('true unset mask on empty array', undefined, object.unsetMask(true, []));
    test.assertEquals('true unset mask on empty object', undefined, object.unsetMask(true, {}));
    test.assertEquals('true unset mask on array', undefined, object.unsetMask(true, [1, 2, 3, 4]));
    test.assertEquals('true unset mask on object', undefined, object.unsetMask(true, { a: '1' }));
    test.assertEquals('true unset mask on array with undefined', undefined, object.unsetMask(true, [undefined]));
    test.assertEquals('true unset mask on object with undefined', undefined, object.unsetMask(true, { a: undefined }));
    test.assertEquals('true unset mask on array with partial undefined', undefined, object.unsetMask(true, [undefined, 4, undefined, 5]));
    test.assertEquals('true unset mask on object with partial undefined', undefined, object.unsetMask(true, { a: undefined, b: '2' }));

    test.assertEquals('number unset mask on undefined', undefined, object.unsetMask(12345, undefined));
    test.assertEquals('number unset mask on null', undefined, object.unsetMask(12345, null));
    test.assertEquals('number unset mask on false', undefined, object.unsetMask(12345, false));
    test.assertEquals('number unset mask on number', undefined, object.unsetMask(12345, 123));
    test.assertEquals('number unset mask on string', undefined, object.unsetMask(12345, '123'));
    test.assertEquals('number unset mask on empty array', undefined, object.unsetMask(12345, []));
    test.assertEquals('number unset mask on empty object', undefined, object.unsetMask(12345, {}));
    test.assertEquals('number unset mask on array', undefined, object.unsetMask(12345, [1, 2, 3, 4]));
    test.assertEquals('number unset mask on object', undefined, object.unsetMask(12345, { a: '1' }));
    test.assertEquals('number unset mask on array with undefined', undefined, object.unsetMask(12345, [undefined]));
    test.assertEquals('number unset mask on object with undefined', undefined, object.unsetMask(12345, { a: undefined }));
    test.assertEquals('number unset mask on array with partial undefined', undefined, object.unsetMask(12345, [undefined, 4, undefined, 5]));
    test.assertEquals('number unset mask on object with partial undefined', undefined, object.unsetMask(12345, { a: undefined, b: '2' }));

    test.assertEquals('string unset mask on undefined', undefined, object.unsetMask('some string', undefined));
    test.assertEquals('string unset mask on null', undefined, object.unsetMask('some string', null));
    test.assertEquals('string unset mask on false', undefined, object.unsetMask('some string', false));
    test.assertEquals('string unset mask on number', undefined, object.unsetMask('some string', 123));
    test.assertEquals('string unset mask on string', undefined, object.unsetMask('some string', '123'));
    test.assertEquals('string unset mask on empty array', undefined, object.unsetMask('some string', []));
    test.assertEquals('string unset mask on empty object', undefined, object.unsetMask('some string', {}));
    test.assertEquals('string unset mask on array', undefined, object.unsetMask('some string', [1, 2, 3, 4]));
    test.assertEquals('string unset mask on object', undefined, object.unsetMask('some string', { a: '1' }));
    test.assertEquals('string unset mask on array with undefined', undefined, object.unsetMask('some string', [undefined]));
    test.assertEquals('string unset mask on object with undefined', undefined, object.unsetMask('some string', { a: undefined }));
    test.assertEquals('string unset mask on array with partial undefined', undefined, object.unsetMask('some string', [undefined, 4, undefined, 5]));
    test.assertEquals('string unset mask on object with partial undefined', undefined, object.unsetMask('some string', { a: undefined, b: '2' }));

    test.assertEquals('object unset mask on undefined', undefined, object.unsetMask({ a: 1, b: 'c' }, undefined));
    test.assertEquals('object unset mask on null', null, object.unsetMask({ a: 1, b: 'c' }, null));
    test.assertEquals('object unset mask on false', false, object.unsetMask({ a: 1, b: 'c' }, false));
    test.assertEquals('object unset mask on number', 123, object.unsetMask({ a: 1, b: 'c' }, 123));
    test.assertEquals('object unset mask on string', '123', object.unsetMask({ a: 1, b: 'c' }, '123'));
    test.assertEquals('object unset mask on empty array', [], object.unsetMask({ a: 1, b: 'c' }, []));
    test.assertEquals('object unset mask on empty object', {}, object.unsetMask({ a: 1, b: 'c' }, {}));
    test.assertEquals('object unset mask on array', [1, 2, 3, 4], object.unsetMask({ a: 1, b: 'c' }, [1, 2, 3, 4]));
    test.assertEquals('object unset mask on array with undefined', [undefined], object.unsetMask({ a: 1, b: 'c' }, [undefined]));
    test.assertEquals('object unset mask on object with undefined', { a: undefined }, object.unsetMask({ a: 1, b: 'c' }, { a: undefined }));
    test.assertEquals('object unset mask on array with partial undefined', [undefined, 4, undefined, 5], object.unsetMask({ a: 1, b: 'c' }, [undefined, 4, undefined, 5]));

    test.assertEquals('object unset mask on object matches',
        {
            b: 8,
            c: {
                d: 7
            }
        },
        object.unsetMask(
            {
                a: 1,
                c: {
                    e: 4
                }
            },
            {
                a: 9,
                b: 8,
                c: {
                    d: 7,
                    e: { f: 6 }
                }
            }
        )
    );

    test.assertEquals('object unset mask with array values on object matches',
        {
            aa: 9,
            b: {
                a: {},
                b: [1, 2, 3]
            },
            c: {
                dd: 7,
                e: {
                    ff: 6
                }
            }
        },
        object.unsetMask(
            {
                a: 1,
                b: [
                    1, 2
                ],
                c: {
                    d: [],
                    e: {
                        f: 4
                    }
                }
            },
            {
                aa: 9,
                b: {
                    a: {},
                    b: [1, 2, 3]
                },
                c: {
                    dd: 7,
                    e: { f: 5, ff: 6 }
                }
            }
        )
    );

    test.assertEquals('array unset mask with null values on object matches',
        [
            { }
        ],
        object.unsetMask(
            [
                {
                    a: false
                },
                null,
            ],
            [
                {
                    a: '456'
                },
                {
                    b: '123'
                }
            ]
        )
    );
}

// ******************************
// Exports:
// ******************************

module.exports['runTests'] = runTests;

// ******************************
