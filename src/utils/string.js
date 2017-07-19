'use strict'; // JS: ES5

// ******************************
// Requries:
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
            contents += indent + c.trim() + '\n';
        })

    contents = contents
        .replace(/\n$/,'');

    return contents;
}

// ******************************
// Exports:
// ******************************

module.exports['indentContents'] = indentContents;

// ******************************
