'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let env = require('./utils/env');
let aws_test = require('./utils/aws.test');
let docker_test = require('./utils/docker.test');
let object_test = require('./utils/object.test');
let plugins = env.getPlugins();

// ******************************
// Constants:
// ******************************

// ******************************
// Functions:
// ******************************

function runAllTests () {
    object_test.runTests();
    // aws_test.runTests();
    // docker_test.runTests();

    plugins.forEach(p => {
        if (p.runTests) {
            p.runTests();
        }
    });
}

// ******************************
// Exports:
// ******************************

module.exports['runAllTests'] = runAllTests;

// ******************************
