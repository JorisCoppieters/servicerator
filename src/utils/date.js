'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

// ******************************
// Functions:
// ******************************

function getNiceDateTimeStamp(in_date) {
    let dateObj = in_date || _getLocaleDate();
    let year = dateObj.getFullYear();
    let month = ('0' + (dateObj.getMonth() + 1)).slice(-2);
    let date = ('0' + dateObj.getDate()).slice(-2);

    let hours = ('0' + dateObj.getHours()).slice(-2);
    let minutes = ('0' + dateObj.getMinutes()).slice(-2);
    let seconds = ('0' + dateObj.getSeconds()).slice(-2);
    return hours + ':' + minutes + ':' + seconds + ' ' + date + '/' + month + '/' + year;
};

// ******************************

function getDateTag (in_date) {
    let d = in_date || _getLocaleDate();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice (-2) + '-' + ('0' + d.getDate()).slice (-2);
}

// ******************************

function getTimestamp (in_date) {
    let d = in_date || _getLocaleDate();
    return d.getTime();
}

// ******************************

function getTimestampTag (in_date) {
    let d = in_date || _getLocaleDate();
    return getDateTag(d) + '-' + parseInt(getTimestamp(d) / 1000);
}

// ******************************
// Helper Functions:
// ******************************

function _getLocaleDate () {
    return new Date();
}

// ******************************
// Exports:
// ******************************

module.exports['getNiceTimeStamp'] = getNiceDateTimeStamp;
module.exports['getTag'] = getDateTag;
module.exports['getTimestamp'] = getTimestamp;
module.exports['getTimestampTag'] = getTimestampTag;

// ******************************
