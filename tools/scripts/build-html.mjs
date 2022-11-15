// *******************************************************************************************************
// This script is to generate a HTML file that imports all the built vanilla JS files in the dist folder. 
// Importing it, and console.log the result
// Usage: node tools/scripts/build-html.mjs
// *******************************************************************************************************
import fs from 'fs';
import { exit } from "process";
import { writeFile, getFiles, greenLog, createDirs, wait, runCommand } from "./utils.mjs";
import { GEN_STYLE, GEN_FOOTER_SCRIPTS, getConsoleTemplate } from './gen-utils.mjs';

// ------ Config ------
const TARGET_DIR = 'dist/apps/html/';
const TARGET_FILE = 'index.html';
const HTML_FILE = TARGET_DIR + TARGET_FILE;
const DIST_DIR = 'dist/packages/';
const globalVarPrefix = 'LitJsSdk_';
const LAST_UPDATED = new Date().toUTCString();
const banner = `(HTML) THIS FILE IS AUTOMATICALLY GENERATED FROM tools/scripts/gen-html.mjs ${LAST_UPDATED}`;
const URL = (pkg) => `https://cdn.jsdelivr.net/npm/@lit-protocol/${pkg}-vanilla/${pkg}.js`;
const TEMPLATE = {
    HEADER: `<!-- (DO NOT EDIT!) ${banner}  -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>(HTML): Lit Protocol - Testing imports of bundled SDKs</title>
    ${GEN_STYLE} 
</head>
<body>
    `,
    BODY: '',
    FOOTER: `
    <div id="root"></div>
    <pre><code id="result"></code></pre>
    ${GEN_FOOTER_SCRIPTS}
    </body>
</html>
`
}

const files = (await getFiles(DIST_DIR))
    .filter((file) => file.includes('vanilla'))
    .map((file) => URL(file.split('/').pop().replace('-vanilla', '')));

// -- script tags to import libs
const scriptTags = files.map((file) => `<script src="${file}"></script>`)
const scriptTagsHTML = scriptTags.map((tag) => `    ${tag}`).join('\n');

// -- console logs to check if libs are loaded
const consoleLogs = files.map((file, i) => {

    let varName = file.split('/').pop().replace('.js', '');

    // replace hyphens with underscores and capitalize the first letter
    varName = globalVarPrefix + varName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

    return getConsoleTemplate(varName, i, globalVarPrefix);
})
const consoleLogsHTML = consoleLogs.join('\n');

// -- append to body
TEMPLATE.BODY = `${banner}

    <!-- ==================== ALL EXPORTED VANILLA LIBRARIES ==================== -->
${scriptTagsHTML}

    <!-- ================== ALL CONSOE LOGS =================== -->
${consoleLogsHTML}
`;

// create folder if it doesn't exist
var dir = './dist/apps/html';

if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

await writeFile(HTML_FILE, TEMPLATE.HEADER + TEMPLATE.BODY + TEMPLATE.FOOTER);

greenLog(`Updated ${HTML_FILE}`);

// const res = await runCommand('cd dist/apps/html && vercel');
// console.log(res);
exit();