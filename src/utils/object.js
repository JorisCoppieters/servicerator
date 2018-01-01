'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

// ******************************
// Functions:
// ******************************

function setIfNotSet (in_object, in_field, in_value) {
    in_object[in_field] = in_object[in_field] || in_value;
}

// ******************************

function isEmpty (in_object) {
    return Object.keys(in_object).length === 0 && in_object.constructor === Object
}

// ******************************
// Exports:
// ******************************

module.exports['setIfNotSet'] = setIfNotSet;
module.exports['isEmpty'] = isEmpty;

// ******************************
