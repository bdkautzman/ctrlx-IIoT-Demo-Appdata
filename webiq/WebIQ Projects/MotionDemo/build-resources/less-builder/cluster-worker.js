const cluster = require('cluster'),
    constants = require("./builder-constants"),
    states = constants.workerStates,
    { getLessInfo } = require('./less-info'),
    { getAppData } = require('./less-app-data'),
    { getAppSizing, getAppTheming, getControlTheming, getControlSizing, getControlCommon, getWidgetSheet } = require('./sheet-generator'),
    widgetData = require('./less-widget-data'),
    widgetVariables = require('./less-build-widget.js'),
    buildApp = require('./less-build-app'),
    loggerName = "less-worker",
    logger = require("./logger").getLogger(loggerName, false),
    less = require('less'),
    buildOptions = {
        sourceMap: {},
        compress: false,
        plugins: []
    };

let supportedBrowsers = ["chrome 78", "firefox 72"]; // Will be overwritten later by our custom config

/**
 * create build options LESS plugin configuration
 *
 * @returns {object[]} plugin configuration
 */
function getPluginConfig() {
    return [
        new (require('less-plugin-autoprefix'))({
            browsers: supportedBrowsers
        }),
        new (require('less-plugin-clean-css'))({
            advanced: true,
            keepBreaks: true
        })
    ];
}

/**
 * Result of LESS -> CSS render
 * @typedef {object} LessRenderResult
 * @property {string} code generated CSS code
 * @property {error|null} err error information
 */

/**
 * render CSS from LESS sources
 *
 * @param {string} lessCode LESS source code
 * @param {string} controlName control name
 * @param {string} sheetName stylesheet name
 * @returns {Promise<LessRenderResult>} promise resolving to render result
 */
function renderLess(lessCode, controlName, sheetName) {
    return less.render(lessCode, buildOptions).then((result) => ({
        code: `/* ${controlName} - ${sheetName} */\n ${result.css}`,
        err: null
    })).catch((err) => {
        logger.error(`- Error compiling '${controlName}', sheet '${sheetName}': ${err.message}`);
        return {
            code: `/* ${controlName} - ${sheetName}, compile error: ${err.message} */\n`,
            err: err
        };
    });
}

/**
 * build separate stylesheets for widget
 *
 * @param {object} wInfo widget LESS info
 * @param {object} palettes key value map of theme palettes
 * @param {object} assignments app variable assignments
 * @param {string} defaultTheme default theme name
 * @param {boolean} isSystemControl `true` for system, `false` for custom control
 * @returns {Promise<String>} promise resolving to widget CSS stylesheet text
 */
function buildWidgetSheets(wInfo, palettes, assignments, defaultTheme, isSystemControl) {
    const sheetPromises = [];
    if (wInfo.info.stylesheets.includes("common")) {
        sheetPromises.push(renderLess(getControlCommon(wInfo.name, isSystemControl), wInfo.name, "common"));
    }
    if (wInfo.info.stylesheets.includes("style")) {
        sheetPromises.push(renderLess(getControlTheming(wInfo.name, palettes, wInfo.themes, assignments.system, isSystemControl, defaultTheme), wInfo.name, "style"));
    }
    if (wInfo.info.stylesheets.includes("dimensions")) {
        sheetPromises.push(renderLess(getControlSizing(wInfo.name, wInfo.sizes, isSystemControl), wInfo.name, "dimensions"));
    }
    if (wInfo.info.stylesheets.includes("widget")) {
        sheetPromises.push(renderLess(getWidgetSheet(wInfo.name, isSystemControl), wInfo.name, "widget"));
    }
    return Promise.all(sheetPromises).then((renderResults) => renderResults.map((result) => result.code).join("\n\n"));
}

/**
 * build widget style
 *
 * @param {object} widgetInfo widget LESS info
 * @param {object} palettes key value map of theme palettes
 * @param {object} assignments app variable assignments
 * @param {boolean} isSystemControl `true` for system, `false` for custom control
 * @param {string} defaultTheme default theme name
 * @param {object} [extensions=null] custom extension data (for system controls)
 * @returns {Promise<String>} promise resolving to widget CSS stylesheet text
 */
async function buildWidget(widgetInfo, palettes, assignments, isSystemControl, defaultTheme, extensions = null) {
    let mainWidgetVariables = null,
        extensionWidgetVariables = null,
        extensionsParam = null;

    logger.log(`* building widget style: ${widgetInfo.name}`);

    if (isSystemControl && extensions) {
        const sizes = extensions.sizes.filter((size) => size !== "default" && !widgetInfo.sizes.includes(size));
        const themes = extensions.themes.filter((theme) => theme !== "default" && !widgetInfo.themes.includes(theme));

        if (sizes.length || themes.length) {
            extensionsParam = {
                name: widgetInfo.name,
                stylesheets: [],
                sizes: sizes,
                themes: themes
            };
        }
    }

    if (extensionsParam) {
        [
            extensionWidgetVariables,
            mainWidgetVariables
        ] = await Promise.all([
            widgetData.getWidgetData(extensionsParam, false).then((wData) => widgetVariables.getWidgetVariables(wData)),
            widgetData.getWidgetData(widgetInfo, isSystemControl).then((wData) => widgetVariables.getWidgetVariables(wData))
        ]);
    } else {
        mainWidgetVariables = widgetVariables.getWidgetVariables(await widgetData.getWidgetData(widgetInfo, isSystemControl));
    }
    mainWidgetVariables.name = widgetInfo.name;
    mainWidgetVariables.info = widgetInfo;

    if (extensionWidgetVariables) {
        if (extensionWidgetVariables.sizes) {
            mainWidgetVariables.sizes = Object.assign({}, mainWidgetVariables.sizes, extensionWidgetVariables.sizes);
        }

        if (extensionWidgetVariables.themes) {
            mainWidgetVariables.themes = Object.assign({}, mainWidgetVariables.themes, extensionWidgetVariables.themes);
        }
    }

    return buildWidgetSheets(mainWidgetVariables, palettes, assignments, defaultTheme, isSystemControl);
}

/**
 * create palettes from system & custom theme data
 *
 * @param {object} systemThemeData key value map for system theme data
 * @param {object} customThemeData  key value map for custom theme data
 * @returns {object} key value map for theme palettes
 */
function getPalettes(systemThemeData, customThemeData) {
    const palettes = {};

    Object.keys(systemThemeData).forEach((themeName) => {
        if (!systemThemeData[themeName].palette && !(customThemeData[themeName] && customThemeData[themeName].palette)) {
            logger.error("System theme missing palette data:", themeName);
        } else if (systemThemeData[themeName].palette) {
            palettes[themeName] = systemThemeData[themeName].palette;
        }
    });

    Object.keys(customThemeData).forEach((themeName) => {
        if (customThemeData[themeName].palette) {
            if (systemThemeData[themeName] && systemThemeData[themeName].palette) {
                palettes[themeName] = Object.assign({}, systemThemeData[themeName].palette, customThemeData[themeName].palette);
            } else {
                palettes[themeName] = customThemeData[themeName].palette;
            }
        }
    });

    return palettes;
}

/**
 * create app & system assignments from system & custom theme data
 *
 * @param {object} systemThemeData key value map for system theme data
 * @param {object} customThemeData  key value map for custom theme data
 * @returns {object} app & system assignments
 */
function getAssignments(systemThemeData, customThemeData) {
    const assignments = {
            app: {},
            system: {}
        },
        themes = new Set(Object.keys(systemThemeData).concat(Object.keys(customThemeData)));

    themes.forEach((themeName) => {
        assignments.system[themeName] = Object.assign({}, systemThemeData[themeName]['system-assignments'], customThemeData[themeName]['system-assignments']);
        assignments.app[themeName] = Object.assign({}, systemThemeData[themeName]['app-assignments'], customThemeData[themeName]['app-assignments']);
    });

    return assignments;
}

/**
 * build app styles
 *
 * @param {object} appData app styling data
 * @returns {string} app CSS stylesheet text
 */
function buildApplication(appData) {
    const {
            vars: appVariables,
            palettes,
            assignments,
            defaultTheme
        } = appData,
        themingSheet = getAppTheming(palettes, assignments, defaultTheme),
        sizingSheet = getAppSizing(appVariables.sizingVariables["system-variables"], appVariables.sizingVariables["custom-variables"]),
        baseStyleSheet =
        `//optional base style sheet included with base-widgets package
        @import (once, optional) 'less/system/base-styles.less';`;

    return Promise.all([
        renderLess(sizingSheet, "WEBIQ_APP", "sizing"),
        renderLess(themingSheet, "WEBIQ_APP", "theming"),
        renderLess(baseStyleSheet, "WEBIQ_APP", "base-styles")
    ]).then((results) => results.map((result) => {
        if (!result.err) {
            return result.code;
        } else {
            logger.error("error generating app stylesheet:", result.err);
            return `/* compile error: ${result.err.message} */\n`;
        }
    }).join("\n"));
}

/**
 * update state of build worker
 *
 * @param {object} workerState worker state data
 * @param {number} newState new worker state
 */
function updateWorkerState(workerState, newState) {
    workerState.state = newState;
    process.send({
        cmd: "state",
        data: {
            state: workerState.state
        }
    });
}

/**
 * deliver result of worker task
 *
 * @param {*} result worker task result
 * @param {number} id task id
 */
function deliverResult(result, id) {
    process.send({
        cmd: "result",
        id: id,
        data: result
    });
}

/**
 * throw error if worker is not in READY state
 *
 * @param {object} workerState worker state data
 */
function errorNotReady(workerState) {
    if (workerState.state !== states.READY) {
        throw new Error("Worker not ready.");
    }
}

/**
 * handler for messages from master
 *
 * @param {object} workerState worker state data
 * @param {object} message message data
 */
function handleMasterMessage(workerState, message) {
    if (constants.LOG_MASTER_MESSAGES) {
        logger.log(`[master] -> [worker:${workerState.worker.id}] - ${JSON.stringify(message)}`);
    }

    if (message && typeof message === "object" && message.cmd) {
        const msgData = message.data;
        switch (message.cmd) {
        case "base-path":
            process.chdir(message.data);
            break;
        case "supported-browsers":
            supportedBrowsers = message.data;
            buildOptions.plugins = getPluginConfig();
            break;
        case "less-info":
            errorNotReady(workerState);
            updateWorkerState(workerState, states.BUSY);
            logger.clear();
            getLessInfo().then((result) => {
                deliverResult({ result, logs: logger.getLogs() }, message.id);
                updateWorkerState(workerState, states.READY);
            });
            break;
        case "app-data":
            errorNotReady(workerState);
            updateWorkerState(workerState, states.BUSY);
            logger.clear();
            getAppData(message.data).then((result) => {
                const appVariables = buildApp.getAppVariables(result);
                const palettes = getPalettes(appVariables.themeSystemVariables, appVariables.themeCustomVariables);
                const assignments = getAssignments(appVariables.themeSystemVariables, appVariables.themeCustomVariables);

                deliverResult({
                    result: {
                        app: result,
                        vars: appVariables,
                        palettes,
                        assignments
                    },
                    logs: logger.getLogs()
                }, message.id);
                updateWorkerState(workerState, states.READY);
            });
            break;
        case "build-app":
            errorNotReady(workerState);
            updateWorkerState(workerState, states.BUSY);
            logger.clear();
            buildApplication(message.data).then((result) => {
                deliverResult({ result, logs: logger.getLogs() }, message.id);
                updateWorkerState(workerState, states.READY);
            });
            break;
        case "build-widget":
            errorNotReady(workerState);
            updateWorkerState(workerState, states.BUSY);
            logger.clear();
            buildWidget(msgData.info, msgData.palettes, msgData.assignments, msgData.isSystemControl, msgData.defaultTheme, msgData.extensions).then((result) => {
                deliverResult({ result, logs: logger.getLogs() }, message.id);
                updateWorkerState(workerState, states.READY);
            });
            break;
        default:
        }
    }
}

//init worker state data
const workerState = {
    worker: cluster.worker,
    state: states.INITIALIZING
};

//setup message handler
process.on('message', (message) => handleMasterMessage(workerState, message));

// worker init complete
updateWorkerState(workerState, states.READY);