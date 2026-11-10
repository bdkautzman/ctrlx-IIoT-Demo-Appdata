/**
 * Get an object of variables and flatten the Object
 * @param {object} varObj object of variables
 * @returns {object} flattened object
 */
function getSizingVariables(varObj) {
    for (let size in varObj) {
        varObj[size] = flattenObject(varObj[size].data);
    }

    return varObj;
}

/**
 * flatten an object
 * @param {*} obj object of variables
 * @returns {object} flattened object
 */
function flattenObject(obj) {
    const flattened = {};

    Object.keys(obj).forEach((key) => {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            Object.assign(flattened, flattenObject(obj[key]));
        } else {
            flattened[key] = obj[key];
        }
    });

    return flattened;
}

/**
 * create theme variables from loaded data
 *
 * @param {object} themesObj theme data
 * @param {boolean} isSystem `true` for system, `false` for custom theme data
 * @returns {object} theme variable data
 */
function getThemingData(themesObj, isSystem) {
    for (let theme in themesObj) {
        if (themesObj[theme].palette) {
            themesObj[theme].palette = flattenObject(themesObj[theme].palette.data);
        }
        if (!isSystem) {
            themesObj[theme]['app-assignments'] = themesObj[theme]['app-assignments'] ? flattenObject(themesObj[theme]['app-assignments'].data) : null;
        }
        themesObj[theme]['system-assignments'] = themesObj[theme]['system-assignments'] ? flattenObject(themesObj[theme]['system-assignments'].data) : null;
    }

    return themesObj;
}

/**
 * create app variables from loaded data
 *
 * @param {object} appData loaded app data
 * @returns {object} app variables
 */
function getAppVariables(appData) {
    const themeSystemVariables = getThemingData(appData.themes.system, true),
        themeCustomVariables = getThemingData(appData.themes.custom, false),
        sizingVariables = Object.assign(
            getSizingVariables(appData.sizing.system),
            getSizingVariables(appData.sizing.custom)
        );

    return {
        sizingVariables,
        themeSystemVariables,
        themeCustomVariables
    };
}

exports.getAppVariables = getAppVariables;
exports.flattenObject = flattenObject;
