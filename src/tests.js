'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let c = require('./constants');
let env = require('./utils/env');
let aws_test = require('./utils/aws.test');
let docker_test = require('./utils/docker.test');
let gitBash_test = require('./utils/gitbash.test');
let plugins = env.getPlugins();

// ******************************
// Constants:
// ******************************

// ******************************
// Functions:
// ******************************

function runAllTests () {
    aws_test.runTests();
    docker_test.runTests();
    gitBash_test.runTests();

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
