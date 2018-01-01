'use strict'; // JS: ES6

// ******************************
// Functions:
// ******************************

const k_SCHEMA_VERSION = 3.2;

// ******************************

function getServiceSchema () {
    return require( '../../schemas/servicerator-schema-v' + k_SCHEMA_VERSION + '.json' );
}

// ******************************

function getServiceSchemaUrl () {
    return 'https://raw.githubusercontent.com/JorisCoppieters/servicerator/master/schemas/servicerator-schema-v' + k_SCHEMA_VERSION + '.json';
}

// ******************************
// Exports:
// ******************************

module.exports['get'] = getServiceSchema;
module.exports['getUrl'] = getServiceSchemaUrl;
module.exports['k_SCHEMA_VERSION'] = k_SCHEMA_VERSION;

// ******************************
