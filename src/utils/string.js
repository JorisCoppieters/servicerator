'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

// ******************************
// Functions:
// ******************************

function indentContents (in_contents, in_indent) {
    let indent = in_indent || '  ';
    let contents = '';

    if (typeof(in_contents) !== 'string') {
        in_contents = in_contents.toString();
    }

    in_contents
        .split(/(\n|\r\n?)/)
        .forEach(c => {
            if (!c.trim()) {
                return;
            }
            contents += indent + c + '\n';
        })

    contents = contents
        .replace(/\n$/,'');

    return contents;
}

// ******************************

function toTitleCase (in_contents) {
    return in_contents
        .replace(/\w\S*/g, (txt) => {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
}

// ******************************
// Exports:
// ******************************

module.exports['indentContents'] = indentContents;
module.exports['toTitleCase'] = toTitleCase;

// ******************************
