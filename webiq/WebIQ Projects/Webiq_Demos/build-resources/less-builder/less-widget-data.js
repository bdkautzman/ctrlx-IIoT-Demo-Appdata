const appData = require('./less-app-data.js'),
    lessPaths = require('./less-paths.js'),
    path = require("path");

/**
 * load widget sizing & theming data from json files
 *
 * @param {object} widgetObject widget info
 * @param {boolean} isSystem `true` for system, `false` for custom widget
 * @returns {Promise<object>} promise resolving to widget sizing & theming data
 */
async function getWidgetData(widgetObject, isSystem) {
    const controlPath = isSystem ? lessPaths.paths.controls.system : lessPaths.paths.controls.custom;

    const [
        sizes,
        themes
    ] = await Promise.all([
        Promise.all(widgetObject.sizes.map((filename) =>
            appData.readFile([controlPath, widgetObject.name].join(path.sep), 'sizes', `${filename}.json`)
        )).then((results) => Object.assign({}, ...results)),
        Promise.all(widgetObject.themes.map((filename) =>
            appData.readFile([controlPath, widgetObject.name].join(path.sep), 'theming', `${filename}.json`)
        )).then((results) => Object.assign({}, ...results))
    ]);

    return { sizes, themes };
}

exports.getWidgetData = getWidgetData;
