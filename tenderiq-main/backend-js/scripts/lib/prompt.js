"use strict";
/** Terminal prompts for the admin scripts (hidden password entry). */

// Piped input (non-interactive): read all lines once, hand them out in order
let pipedLines = null;
async function nextPipedLine() {
    if (!pipedLines) {
        let data = '';
        for await (const chunk of process.stdin) data += chunk;
        pipedLines = data.split(/\r?\n/);
    }
    return pipedLines.length ? pipedLines.shift() : '';
}

/** Read one line without echoing it (falls back to plain stdin when piped). */
function askHidden(question) {
    process.stdout.write(question);
    if (!process.stdin.isTTY) {
        return nextPipedLine().then((line) => {
            process.stdout.write('\n');
            return line;
        });
    }
    return new Promise((resolve) => {
        const stdin = process.stdin;
        let value = '';
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        const onKey = (key) => {
            for (const ch of key) {
                if (ch === '\r' || ch === '\n') {
                    stdin.setRawMode(false);
                    stdin.pause();
                    stdin.removeListener('data', onKey);
                    process.stdout.write('\n');
                    resolve(value);
                    return;
                }
                if (ch === '\u0003') { // Ctrl+C
                    process.stdout.write('\n');
                    process.exit(1);
                }
                if (ch === '\u0008' || ch === '\u007f') { // Backspace
                    if (value.length) {
                        value = value.slice(0, -1);
                        process.stdout.write('\b \b');
                    }
                    continue;
                }
                value += ch;
                process.stdout.write('*');
            }
        };
        stdin.on('data', onKey);
    });
}

/** Read one visible line (e.g. a name). */
function askLine(question) {
    process.stdout.write(question);
    if (!process.stdin.isTTY) {
        return nextPipedLine().then((l) => {
            process.stdout.write('\n');
            return l;
        });
    }
    return new Promise((resolve) => {
        const rl = require('readline').createInterface({ input: process.stdin, terminal: false });
        rl.once('line', (line) => { rl.close(); resolve(line); });
    });
}

/** Password rules shared by the scripts (same as the sign-up page). */
function passwordProblem(pw) {
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw))
        return 'Password must be at least 8 characters and include a letter and a number.';
    return null;
}

module.exports = { askHidden, askLine, passwordProblem };
