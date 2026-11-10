/* Constants */
const lessPaths = require('./less-paths.js'),
    fs = require('fs-extra'),
    path = require("path");

/**
 * Gets an array of files
 * @param {string} basePath
 * @param {string} subDir
 * @return {array}
 */
async function getFileNames(basePath, subDir) {
    try {
        const fileNames = await fs.promises.readdir([basePath, subDir].join(path.sep), {
            withFileTypes: true
        });

        return fileNames.
            filter((file) => file.isFile()).
            map((file) => file.name);
    } catch (err) {
        switch (err.code) {
        case 'ENOENT':
            return [];
        default:
            throw err;
        }
    }
}

/**
 * Reads json files and returns an object with filename and content of the file
 * @param {string} basePath
 * @param {string} subDir
 * @param {string} filename
 * @return {object}
 */
async function readFile(basePath, subDir, filename) {
    let fileInfo = {};
    try {
        const obj = await fs.readJson([basePath, subDir, filename].join(path.sep), {
            throws: false
        });

        fileInfo = {
            [removeExtension(filename)]: {
                filename: filename,
                data: obj
            }
        };
    } catch (err) {
        fileInfo = {
            [removeExtension(filename)]: {
                filename: filename,
                error: err.code
            }
        };
    }
    return fileInfo;
}

/**
 * remove extension from filename
 *
 * @param {string} filename filename with extension
 * @returns {string} filename without extension
 */
function removeExtension(filename) {
    if (typeof filename !== "string") {
        throw new TypeError("filename parameter not a string");
    }
    const nameParts = filename.split(".");
    if (nameParts.length === 1) {
        return filename;
    } else if (nameParts.length === 2 && nameParts[0].length === 0) {
        return filename;
    } else {
        return nameParts.slice(0, -1).join(".");
    }
}

/**
 * load app sizing & theming data
 *
 * @param {object} lessList app configuration
 * @returns {object} app sizing, theming data
 */
async function getAppData(lessList) {
    const [
        themesSystemFiles,
        themesCustomFiles,
        systemSettingsFiles,
        customSettingsFiles
    ] = await Promise.all([
        Promise.all(lessList.themes.system.map((dirName) =>
            getFileNames(lessPaths.paths.themes.system, dirName).
                then((files) => Promise.all((files.
                    map((file) => readFile(lessPaths.paths.themes.system, dirName, file)))).
                    then((values) => Object.assign({}, ...values)).
                    then((value) => ({ [dirName]: value }))))
        ).then((values) => Object.assign({}, ...values)),
        Promise.all(lessList.themes.custom.map((dirName) =>
            getFileNames(lessPaths.paths.themes.custom, dirName).
                then((files) => Promise.all((files.
                    map((file) => readFile(lessPaths.paths.themes.custom, dirName, file)))).
                    then((values) => Object.assign({}, ...values)).
                    then((value) => ({ [dirName]: value }))))
        ).then((values) => Object.assign({}, ...values)),
        readFile(['less', 'system'].join(path.sep), 'settings', 'system-variables.json').
            then((result) => (result)),
        Promise.all([
            readFile(['less', 'custom'].join(path.sep), 'settings', 'custom-variables.json'),
            readFile(['less', 'custom'].join(path.sep), 'settings', 'system-variables.json')
        ]).then((results) => Object.assign({}, ...results))
    ]);

    return {
        themes: {
            system: themesSystemFiles,
            custom: themesCustomFiles
        },
        sizing: {
            system: systemSettingsFiles,
            custom: customSettingsFiles
        }
    };
}

exports.getAppData = getAppData;
exports.readFile = readFile;
