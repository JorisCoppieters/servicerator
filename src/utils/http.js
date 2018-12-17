'use strict'; // JS: ES6

// ******************************
// Functions:
// ******************************

function getRequest (in_url, in_requestData, in_options, in_onSuccess, in_onError) {
    let url = in_url;
    let requestData = in_requestData || [];
    if (requestData.length) {
        let qs = require('querystring');
        url += '?' + qs.stringify(requestData);
    }

    // cprint.cyan('Sending GET request to: ' + url);

    let request = require('request');

    let requestOptions = Object.assign({
        uri: url,
        method: 'GET',
        timeout: 30000,
        json: true,
        followAllRedirects: true,
        rejectUnauthorized: false,
        requestCert: true,
        agent: false
    }, in_options);

    request(requestOptions, (error, response, body) => {
        if (error) {
            if (in_onError) {
                in_onError(error);
            }
            return;
        }
        if (in_onSuccess) {
            let setCookie = response.headers['set-cookie'];
            let cookieValues = {};
            if (setCookie) {
                cookieValues = _parseCookieValues(setCookie);
            }
            in_onSuccess(body, cookieValues);
        }
        return;
    });
}

// ******************************

function getRequestSync (in_url, in_requestData, in_options) {
    var done = false;
    var data = null;
    getRequest(in_url, in_requestData, in_options, (body, cookieValues) => {
        done = true;
        data = {
            body,
            cookieValues
        };
    }, (error) => {
        done = true;
        data = {
            error
        };
    });
    while(!done) {require('deasync').sleep(100);}
    return data;
}

// ******************************

function postRequest (in_url, in_requestData, in_options, in_onSuccess, in_onError) {
    let requestData = in_requestData || {};

    // cprint.cyan('Sending POST request to: ' + url);

    let requestOptions = Object.assign({
        uri: in_url,
        json: requestData,
        method: 'POST',
        timeout: 30000,
        followAllRedirects: true,
        rejectUnauthorized: false,
        requestCert: true,
        agent: false
    }, in_options);

    let request = require('request');

    request(requestOptions, (error, response, body) => {
        if (error) {
            if (in_onError) {
                in_onError(error);
            }
            return;
        }
        if (in_onSuccess) {
            let setCookie = response.headers['set-cookie'];
            let cookieValues = {};
            if (setCookie) {
                cookieValues = _parseCookieValues(setCookie);
            }
            in_onSuccess(body, cookieValues);
        }
        return;
    });
}

// ******************************

function postRequestSync (in_url, in_requestData, in_options) {
    var done = false;
    var data = null;
    postRequest(in_url, in_requestData, in_options, (body, cookieValues) => {
        done = true;
        data = {
            body,
            cookieValues
        };
    }, (error) => {
        done = true;
        data = {
            error
        };
    });
    while(!done) {require('deasync').sleep(100);}
    return data;
}

// ******************************

function _parseCookieValues (in_cookieValues) {
    let cookieValues = in_cookieValues
        .join(';')
        .split(';')
        .reduce((dict, cookieVal) => {
            let key = cookieVal.split('=')[0];
            let val = cookieVal.split('=')[1];
            dict[key] = val;
            return dict;
        }, {});

    return cookieValues;
}

// ******************************
// Exports:
// ******************************

module.exports['get'] = getRequest;
module.exports['getSync'] = getRequestSync;
module.exports['post'] = postRequest;
module.exports['postSync'] = postRequestSync;

// ******************************
