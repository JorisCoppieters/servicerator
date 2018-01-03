'use strict'; // JS: ES6

// ******************************
// Functions:
// ******************************

function getRequest (in_url, in_requestData, in_onSuccess, in_onError) {
    let url = in_url;
    let requestData = in_requestData || [];
    if (requestData.length) {
        let qs = require('querystring');
        url += '?' + qs.stringify(requestData);
    }

    // cprint.cyan('Sending GET request to: ' + url);

    let request = require('request');

    let requestOptions = {
        uri: url,
        method: 'GET',
        timeout: 5000,
        json: true,
        headers: [],
        rejectUnauthorized: false,
        requestCert: true,
        agent: false
    };

    request(requestOptions, (error, response, body) => {
        if (error) {
            if (in_onError) {
                in_onError(error);
            }
            return;
        }
        if (in_onSuccess) {
            in_onSuccess(body);
        }
        return;
    });
}

// ******************************

function postRequest (in_url, in_requestData, in_onSuccess, in_onError) {
    let requestData = in_requestData || {};

    // cprint.cyan('Sending POST request to: ' + url);

    let requestOptions = {
        uri: in_url,
        method: 'POST',
        json: requestData,
        timeout: 5000,
        headers: [],
        rejectUnauthorized: false,
        requestCert: true,
        agent: false
    };

    let request = require('request');

    request(requestOptions, (error, response, body) => {
        if (error) {
            if (in_onError) {
                in_onError(error);
            }
            return;
        }
        if (in_onSuccess) {
            in_onSuccess(body);
        }
        return;
    });
}

// ******************************
// Exports:
// ******************************

module.exports['get'] = getRequest;
module.exports['post'] = postRequest;

// ******************************
