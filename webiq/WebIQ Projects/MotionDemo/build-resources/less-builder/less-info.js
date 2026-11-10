/* Constants */
const lessPaths = require('./less-paths.js'),
    fs = require('fs-extra'),
    path = require("path");

/**
 * Gets all relevant dirs
 * @param {string} dirPath
 * @return {array}
 */
async function getSubdirs(dirPath) {
    try {
        const dirContents = await fs.promises.readdir(dirPath, {
            withFileTypes: true
        });

        // Only return files and strip the extensions from filenames.
        return dirContents.
            filter((entry) => entry.isDirectory()).
            map((entry) => entry.name);
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
 * Get all `.json` and `.less` files in specified directory
 *
 * @param {string} filePath
 * @return {array}
 */
async function getJsonFiles(filePath) {
    try {
        const dirContents = await fs.promises.readdir(filePath, {
            withFileTypes: true
        });

        // Only return files and strip the extensions from filenames.
        return dirContents.
            filter((entry) => entry.isFile()).
            filter((entry) => entry.name.endsWith(".json") || entry.name.endsWith(".less")).
            map((entry) => entry.name.replace(/\.[^.]+$/, ""));
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
 * load control information on installed themes, sizes & stylesheets
 *
 * @param {string} controlName control name
 * @param {string} basePath base path
 */
async function getControlInfo(controlName, basePath) {
    const controlPath = [basePath, controlName].join(path.sep);

    const [
        controlSizes,
        controlThemes,
        controlStylesheet
    ] = await Promise.all([
        getJsonFiles([controlPath, 'sizes'].join(path.sep)),
        getJsonFiles([controlPath, 'theming'].join(path.sep)),
        getJsonFiles(controlPath)
    ]);

    return {
        'name': controlName,
        'sizes': controlSizes,
        'themes': controlThemes,
        'stylesheets': controlStylesheet
    };
}

/**
 * load information on installed styling resources of app
 *
 * @returns {object} app info
 */
async function getLessInfo() {
    const [
        themesSystem,
        themesCustom,
        controlsSystem,
        controlsCustom
    ] = await Promise.all([
        getSubdirs(lessPaths.paths.themes.system),
        getSubdirs(lessPaths.paths.themes.custom),
        getSubdirs(lessPaths.paths.controls.system).then((controlNames) => Promise.all(
            controlNames.map((controlName) => getControlInfo(controlName, lessPaths.paths.controls.system))
        )),
        getSubdirs(lessPaths.paths.controls.custom).then((controlNames) => Promise.all(
            controlNames.map((controlName) => getControlInfo(controlName, lessPaths.paths.controls.custom))
        ))
    ]);

    return {
        themes: {
            system: themesSystem,
            custom: themesCustom
        },
        controls: {
            system: controlsSystem,
            custom: controlsCustom
        }
    };
}

exports.getLessInfo = getLessInfo;
