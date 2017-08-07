'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');
let Promise = require('bluebird');
let qs = require('querystring');
let request = require('request');

// ******************************
// Functions:
// ******************************

function getRequest (in_url, in_requestData) {
    return new Promise((resolve, reject) => {
        let url = in_url;
        let requestData = in_requestData || [];
        if (requestData.length) {
            url += '?' + qs.stringify(requestData);
        }

        // cprint.cyan('Sending GET request to: ' + url);

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
                return reject(error);
            }
            return resolve(body);
        });
    });
}

// ******************************

function postRequest (in_url, in_requestData) {
    return new Promise((resolve, reject) => {
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

        request(requestOptions, (error, response, body) => {
            if (error) {
                return reject(error);
            }
            return resolve(body);
        });
    });


    let requestOptions;
}

// ******************************
// Exports:
// ******************************

module.exports['get'] = getRequest;
module.exports['post'] = postRequest;

// ******************************
