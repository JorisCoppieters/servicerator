'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

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
        console.log(cprint.toGreen('✔ ' + in_testName));
    } else {
        console.log(cprint.toRed('✘ ' + in_testName) + '\n' + cprint.toRed('Expected: ') + cprint.toYellow(expected) + '\n' + cprint.toRed('Received: ') + cprint.toYellow(received));
    }
}

// ******************************

function assertMatch (in_testName, in_expectedMatch, in_received) {
    let expectedRe = new RegExp(in_expectedMatch);
    let received = _toString(in_received);

    if (received.match(expectedRe)) {
        console.log(cprint.toGreen('✔ ' + in_testName));
    } else {
        console.log(cprint.toRed('✘ ' + in_testName) + '\n' + cprint.toRed('Expected Match: ') + cprint.toYellow(expectedRe) + '\n' + cprint.toRed('Received: ') + cprint.toYellow(received));
    }
}

// ******************************

function _toString (in_obj) {
    let str = in_obj;
    if (typeof(in_obj) !== 'string') {
        str = JSON.stringify(in_obj);
    }

    str = str.trim();
    return str;
}

// ******************************
// Exports:
// ******************************

module.exports['assertEquals'] = assertEquals;
module.exports['assertMatch'] = assertMatch;

// ******************************
