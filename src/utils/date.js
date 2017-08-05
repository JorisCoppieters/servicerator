'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

// ******************************
// Functions:
// ******************************

function getDateTag (in_date) {
    let d = in_date || new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice (-2) + '-' + ('0' + d.getDate()).slice (-2);
}

// ******************************

function getTimestamp (in_date) {
    let d = in_date || new Date();
    return d.getTime();
}

// ******************************

function getTimestampTag (in_date) {
    let d = in_date || new Date();
    return getDateTag(d) + '-' + getTimestamp(d);
}

// ******************************
// Exports:
// ******************************

module.exports['getTag'] = getDateTag;
module.exports['getTimestamp'] = getTimestamp;
module.exports['getTimestampTag'] = getTimestampTag;

// ******************************
