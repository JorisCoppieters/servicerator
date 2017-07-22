'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

// ******************************
// Functions:
// ******************************

function getDateTag () {
    let d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice (-2) + '-' + ('0' + d.getDate()).slice (-2);
}

// ******************************
// Exports:
// ******************************

module.exports['getTag'] = getDateTag;

// ******************************
