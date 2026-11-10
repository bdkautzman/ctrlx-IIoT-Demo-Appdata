const buildApp = require('./less-build-app');

/**
 * extract variables from loaded data
 *
 * @param {object} widgetObj loaded widget data
 * @returns {object} variable data
 */
function getVariables(widgetObj) {
    for (let entry in widgetObj) {
        widgetObj[entry] = buildApp.flattenObject(widgetObj[entry].data);
    }

    return widgetObj;
}

/**
 * create widget size & theming variables from loaded data
 *
 * @param {object} widgetData loaded widget data
 * @returns {object} widget variables
 */
function getWidgetVariables(widgetData) {
    const [
        widgetSizing,
        widgetTheming
    ] = [
        getVariables(widgetData.sizes),
        getVariables(widgetData.themes)
    ];

    return {
        sizes: widgetSizing,
        themes: widgetTheming
    };
}

exports.getWidgetVariables = getWidgetVariables;
