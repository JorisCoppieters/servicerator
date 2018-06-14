'use strict'; // JS: ES6

// ******************************
// Functions:
// ******************************

function unsetMaskOnObject (in_mask, in_destinationObject) {
    let destinationObject = in_destinationObject;

    if (isObjectOrArray(in_mask)) { // If mask is an Object or Array

        if (isArray(in_mask)) { // If mask is an Array
            if (!isArray(destinationObject)) { // If destinationObject isn't an Array, we should leave it
                return destinationObject;
            } else {
                destinationObject = destinationObject.slice(0); // Othewise make a clone of the destination object (array)
            }
        } else { // If mask is an Object
            if (!isObject(destinationObject)) { // If destinationObject isn't an Object, we should leave it
                return destinationObject;
            } else {
                destinationObject = Object.assign({}, destinationObject); // Othewise make a clone of the destination object (object)
            }
        }

        Object.keys(in_mask).forEach(k => {
            let v = in_mask[k];
            if (isUndefined(destinationObject[k])) { // If destinationObject is already unset, we are done
                return;
            }

            if (isObjectOrArray(v)) { // If mask is an Object or Array, recurse
                destinationObject[k] = unsetMaskOnObject(v, destinationObject[k]);
                return;
            }

            delete destinationObject[k]; // Otherwise remove from destinationObject
            if (isArray(destinationObject)) {
                destinationObject = destinationObject.filter(Boolean); // Filter out undefined
            }
        });

        return destinationObject;

    } else if (isUndefined(in_mask)) { // If mask isn't set leave destinationObject alone
        return destinationObject;

    } else {
        return undefined; // Otherwise remove destinationObject value

    }
}

// ******************************

function setMaskOnObject (in_mask, in_destinationObject) {
    let destinationObject = in_destinationObject;

    if (isObjectOrArray(in_mask)) { // If mask is an Object or Array

        if (isArray(in_mask)) { // If mask is an Array
            if (!isArray(destinationObject)) { // If destinationObject isn't an Array, make it one
                destinationObject = [];
            } else {
                destinationObject = destinationObject.slice(0); // Othewise make a clone of the destination object (array)
            }
        } else { // If mask is an Object
            if (!isObject(destinationObject)) { // If destinationObject isn't an Object, make it one
                destinationObject = {};
            } else {
                destinationObject = Object.assign({}, destinationObject); // Othewise make a clone of the destination object (object)
            }
        }

        Object.keys(in_mask).forEach(k => {
            let v = in_mask[k];
            if (isObjectOrArray(v)) { // If mask value is an Object or Array, recurse
                destinationObject[k] = setMaskOnObject(v, destinationObject[k]);
                if (isArray(destinationObject)) {
                    destinationObject = destinationObject.filter(Boolean); // Filter out undefined
                }
                return;
            }

            destinationObject[k] = v; // Otherwise set mask value on destinationObject
            if (isArray(destinationObject)) {
                destinationObject = destinationObject.filter(Boolean); // Filter out undefined
            }
        });

        return destinationObject;

    } else if (isUndefined(in_mask)) { // If mask isn't set leave destinationObject alone
        return destinationObject;

    } else {
        return in_mask; // Otherwise return mask value
    }
}

// ******************************

function setIfNotSet (in_object, in_field, in_value) {
    in_object[in_field] = in_object[in_field] || in_value;
}

// ******************************

function isUndefined (in_object) {
    return typeof(in_object) === 'undefined';
}

// ******************************

function isArray (in_object) {
    return Array.isArray(in_object);
}

// ******************************

function isObject (in_object) {
    return typeof(in_object) === 'object' && in_object !== null && in_object.constructor === Object;
}

// ******************************

function isObjectOrArray (in_object) {
    return typeof(in_object) === 'object' && in_object !== null;
}

// ******************************

function isEmpty (in_object) {
    return typeof(in_object) === 'object' && in_object !== null && Object.keys(in_object).length === 0 && in_object.constructor === Object;
}

// ******************************
// Exports:
// ******************************

module.exports['unsetMask'] = unsetMaskOnObject;
module.exports['setMask'] = setMaskOnObject;
module.exports['setIfNotSet'] = setIfNotSet;
module.exports['isUndefined'] = isUndefined;
module.exports['isEmpty'] = isEmpty;
module.exports['isArray'] = isArray;
module.exports['isObject'] = isObject;
module.exports['isObjectOrArray'] = isObjectOrArray;

// ******************************
