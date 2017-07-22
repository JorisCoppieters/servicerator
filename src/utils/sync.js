'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

// ******************************
// Functions:
// ******************************

function runGenerator (generatorFunction) {
    let next = function (err, arg) {
        if (err) return it.throw(err);

        let result = it.next(arg);
        if (result.done) return;

        if (result.value && result.value.then) {
            result.value
            .then((resolveResult) => {
                next(null, resolveResult);
            })
            .catch((rejectResult) => {
                next(rejectResult, null);
            });
        } else {
            next(null, result.value);
        }
    }

    let it = generatorFunction();
    return next();
}


// ******************************

function runTasks(tasks) {
    var result = Promise.resolve();
    tasks.forEach(task => {
        result = result.then(() => task());
    });
    return result;
}

// ******************************
// Exports:
// ******************************

module.exports['runGenerator'] = runGenerator;
module.exports['runTasks'] = runTasks;

// ******************************