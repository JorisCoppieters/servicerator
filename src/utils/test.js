'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let print = require('./print');

// ******************************
// Constants:
// ******************************

// ******************************
// Functions:
// ******************************

function assertEquals (in_testName, in_expected, in_received) {
    let expected = _toString(in_expected);
    let received = _toString(in_received);

    if (expected === received) {
        print.out(cprint.toGreen('✔ ' + in_testName) + '\n');
    } else {
        print.out(cprint.toRed('✘ ' + in_testName) + '\n' + cprint.toRed('Expected: ') + cprint.toYellow(expected) + '\n' + cprint.toRed('Received: ') + cprint.toYellow(received) + '\n');
    }
}

// ******************************

function assertMatch (in_testName, in_expectedMatch, in_received) {
    let expectedRe = new RegExp(in_expectedMatch);
    let received = _toString(in_received);

    if (received.match(expectedRe)) {
        print.out(cprint.toGreen('✔ ' + in_testName) + '\n');
    } else {
        print.out(cprint.toRed('✘ ' + in_testName) + '\n' + cprint.toRed('Expected Match: ') + cprint.toYellow(expectedRe) + '\n' + cprint.toRed('Received: ') + cprint.toYellow(received) + '\n');
    }
}

// ******************************

function _toString (in_obj) {
    let str = in_obj;

    if (typeof(in_obj) === 'undefined') {
        str = '';
    } else if (typeof(in_obj) !== 'string') {
        str = JSON.stringify(in_obj);
    }

    str = str.trim();
    return str;
}

// ******************************
// Exports:
// ******************************

module.exports['assertEquals'] = assertEquals;
module.exports['xassertEquals'] = () => {};
module.exports['assertMatch'] = assertMatch;
module.exports['xassertMatch'] = () => {};

// ******************************
