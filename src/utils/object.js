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
// Exports:
// ******************************

module.exports['setIfNotSet'] = setIfNotSet;

// ******************************
