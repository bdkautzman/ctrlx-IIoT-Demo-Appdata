const fs = require('fs-extra'),
    p = require('path'),
    loggerName = "less-build";

let logger = null;

/**
 * join two arrays of strings into array of unique entries
 *
 * @param {string[]} firstList
 * @param {string[]} secondList
 * @returns {string[]} joined list of unique entries
 */
function getCommonList(firstList, secondList) {
    return [...new Set(firstList.concat(secondList))];
}

/**
 * compare arrays of strings for changes
 *
 * @param {string[]} oldList original list
 * @param {string[]} newList modified list
 * @returns {object} change info
 */
function getListChanges(oldList, newList) {
    const added = [...new Set(newList.filter((element) => !oldList.includes(element)))],
        removed = [...new Set(oldList.filter((element) => !newList.includes(element)))];

    return {
        added,
        removed
    };
}

/**
 * create key value map of collected widget data
 *
 * @param {object} info LESS app info
 * @returns {object} key value map of widget data
 */
function getWidgetMap(info) {
    const widgetMap = {};

    info.controls.system.forEach((wInfo) => {
        widgetMap[wInfo.name] = {
            name: wInfo.name,
            themes: wInfo.themes,
            sizes: wInfo.sizes,
            isSystem: true
        };
    });

    info.controls.custom.forEach((wInfo) => {
        if (!widgetMap[wInfo.name]) {
            widgetMap[wInfo.name] = {
                name: wInfo.name,
                themes: wInfo.themes,
                sizes: wInfo.sizes,
                isSystem: false
            };
        } else {
            widgetMap[wInfo.name].themes = getCommonList(widgetMap[wInfo.name].themes, wInfo.themes);
            widgetMap[wInfo.name].sizes = getCommonList(widgetMap[wInfo.name].sizes, wInfo.sizes);
        }
    });

    return widgetMap;
}

/**
 * update LESS build configuration
 *
 * @param {object} info app LESS info
 * @param {object} localWidgetMap key value map of per-widget LESS info
 * @param {string} [basePath=null] base path to look for build configuration
 * @returns {object} app & build configuration data
 */
async function updateBuildConfig(info, localWidgetMap, basePath = null) {
    let configData = null,
        configPath = null;

    if (basePath === null) {
        basePath = process.cwd();
    }
    configPath = `${basePath}${p.sep}json${p.sep}compile-settings.json`;

    logger.log(`* updating build configuration '${configPath}'`);

    //try to load existing build configuration
    try {
        configData = await fs.readJson(configPath);
    } catch (exc) {
        logger.error("Error reading compile settings:", exc);
    }

    //initialize with defaults when no build configuration was found
    if (!configData || typeof configData !== "object") {
        configData = {
            settings: {
                "default-theme": "xenon-moonstone"
            },
            themes: {},
            controls: {}
        };
        logger.warn("- build configuration could not be loaded - using defaults");
    }

    const localThemeNames = getCommonList(info.themes.system, info.themes.custom);
    const widgetDiff = getListChanges(Object.keys(configData.controls), Object.keys(localWidgetMap));
    const themeDiff = getListChanges(Object.keys(configData.themes), localThemeNames);

    //remove old "sizes" config
    delete configData.sizes;
    //set new "supportedBrowsers" option if missing
    if (!Array.isArray(configData.supportedBrowsers)) {
        configData.supportedBrowsers = require("./default-browsers");
    }

    //remove widgets that no longer exist
    if (widgetDiff.removed.length) {
        logger.log(`- remove widget styles: ${widgetDiff.removed.join(', ')}`);
    }
    widgetDiff.removed.forEach((name) => {
        delete configData.controls[name];
    });

    //add newly found / remove no longer existing widget sizes
    Object.keys(configData.controls).forEach((name) => {
        const changes = getListChanges(
            Object.keys(configData.controls[name].sizes),
            localWidgetMap[name].sizes.filter((size) => size !== "default")
        );

        if (changes.removed.length) {
            logger.log(`- remove sizes for widget style '${name}': ${changes.removed.join(', ')}`);
        }
        changes.removed.forEach((size) => {
            delete configData.controls[name].sizes[size];
        });
        if (changes.added.length) {
            logger.log(`- add sizes for widget style '${name}': ${changes.added.join(', ')}`);
        }
        changes.added.forEach((size) => {
            configData.controls[name].sizes[size] = true;
        });
    });

    //add newly found widgets
    if (widgetDiff.added.length) {
        logger.log(`- add widget styles: ${widgetDiff.added.join(', ')}`);
    }
    widgetDiff.added.forEach((name) => {
        const sizes = localWidgetMap[name].sizes.filter((size) => size !== "default"),
            sizeConfig = {};

        sizes.forEach((size) => {
            sizeConfig[size] = true;
        });

        configData.controls[name] = {
            compile: true,
            sizes: sizeConfig
        };
    });

    //remove themes that no longer exist
    if (themeDiff.removed.length) {
        logger.log(`- remove themes: ${themeDiff.removed.join(', ')}`);
    }
    themeDiff.removed.forEach((name) => {
        delete configData.themes[name];
    });

    //add newly found themes
    if (themeDiff.added.length) {
        logger.log(`- add themes: ${themeDiff.added.join(', ')}`);
    }
    themeDiff.added.forEach((name) => {
        configData.themes[name] = true;
    });

    // check if the default theme is enabled. If it's not enabled, look for any
    // enabled theme and use that as default theme instead.
    if (configData.themes[configData.settings["default-theme"]] !== true) {
        logger.warn(`- fix invalid default-theme '${configData.settings["default-theme"]}'`);
        configData.settings["default-theme"] = Object.keys(configData.themes).find((themeName) => configData.themes[themeName] === true);
    }

    //error out when no valid default theme was found
    if (typeof configData.settings["default-theme"] !== "string") {
        throw new Error("could not determine default theme - at least one theme must be enabled.");
    }

    //write updates to build configuration
    try {
        await fs.outputJson(configPath, configData, {
            spaces: 4
        });
    } catch (exc) {
        logger.error("Error writing compile settings:", exc);
    }

    return { info: info, config: configData, map: localWidgetMap };
}

/**
 * build CSS stylesheet from LESS sources
 *
 * @param {string} [basePath=null] base path for LESS sources
 * @param {string} [workerPath=null] path to worker source
 * @returns {Promise<object[]>} promise resolving to log data from build process
 */
function buildLess(basePath = null, workerPath = null, outputPath = `css${p.sep}widgets.css`) {
    const lessBuilder = require('./less-builder').getBuilder({
            worker_count: null, //default `null` uses number of cores
            basePath: basePath
        }, workerPath),
        buildStartTime = Date.now();

    logger = lessBuilder.logger;
    //retrieve information on installed LESS sources
    return lessBuilder.runTask({
        cmd: "less-info",
        data: null
    }).then((reply) => {
        const localWidgetMap = getWidgetMap(reply.result); //create widget map for lookups
        logger.addLogs(reply.logs);
        logger.log(`* discovered themes: ${getCommonList(reply.result.themes.system, reply.result.themes.custom).join(', ')}`);
        logger.log(`* discovered ${Object.keys(localWidgetMap).length} widget styles`);
        return updateBuildConfig(reply.result, localWidgetMap, basePath); //update build configuration
    }).then((result) => {
        //modify info to select themes & widgets to build
        const configThemes = Object.keys(result.config.themes).filter((theme) => result.config.themes[theme] === true),
            disabledThemes = Object.keys(result.config.themes).filter((theme) => result.config.themes[theme] === false),
            configWidgets = Object.keys(result.config.controls).filter((name) => result.config.controls[name].compile === true),
            disabledWidgets = Object.keys(result.config.controls).filter((name) => result.config.controls[name].compile === false);

        logger.log(`* configured default theme: ${result.config.settings['default-theme']}`);
        if (disabledThemes.length) {
            logger.log(`* themes disabled in build configuration: ${disabledThemes.join(', ')}`);
        }
        if (disabledWidgets.length) {
            logger.log(`* widget styles disabled in build configuration: ${disabledWidgets.join(', ')}`);
        }

        if (Array.isArray(result.config.supportedBrowsers)) {
            lessBuilder.setSupportedBrowsers(result.config.supportedBrowsers);
        }

        //apply build configuration for themes
        result.info.themes.system = result.info.themes.custom.filter((theme) => configThemes.includes(theme));
        result.info.themes.custom = result.info.themes.custom.filter((theme) => configThemes.includes(theme));
        //apply build configuration for controls
        result.info.controls.system = result.info.controls.system.filter((wInfo) => configWidgets.includes(wInfo.name));
        result.info.controls.custom = result.info.controls.custom.filter((wInfo) => configWidgets.includes(wInfo.name));
        //apply build configuration for control sizes
        result.info.controls.system.forEach((wInfo) => {
            const wConfig = result.map[wInfo.name];
            wInfo.sizes = wInfo.sizes.filter((size) => wConfig.sizes.includes(size));
        });
        result.info.controls.custom.forEach((wInfo) => {
            const wConfig = result.map[wInfo.name];
            wInfo.sizes = wInfo.sizes.filter((size) => wConfig.sizes.includes(size));
        });

        //retrieve app & widget data for configured build options
        return lessBuilder.runTask({
            cmd: "app-data",
            data: result.info
        }).then((reply) => {
            const { result: appData } = reply;

            logger.addLogs(reply.logs);
            appData.defaultTheme = result.config.settings["default-theme"];

            //create promise to build app specific styles
            const appPromise = lessBuilder.runTask({
                cmd: "build-app",
                data: appData
            }).then((innerReply) => {
                const results = innerReply.result;

                logger.addLogs(innerReply.logs);
                return results;
            });

            const systemWidgetNames = result.info.controls.system.map((wInfo) => wInfo.name);
            const customWidgetNames = result.info.controls.custom.map((wInfo) => wInfo.name);

            //create promise to build system controls
            const systemWidgetPromise = Promise.all(result.info.controls.system.map((wInfo) => {
                let command = {
                        cmd: "build-widget",
                        data: {
                            info: wInfo,
                            palettes: appData.palettes,
                            assignments: appData.assignments,
                            isSystemControl: true,
                            defaultTheme: appData.defaultTheme
                        }
                    },
                    customIndex = customWidgetNames.indexOf(wInfo.name);

                if (customIndex !== -1) {
                    command.data.extensions = {
                        sizes: result.info.controls.custom[customIndex].sizes,
                        themes: result.info.controls.custom[customIndex].themes
                    };
                } else {
                    command.data.extensions = null;
                }

                return lessBuilder.runTask(command).then((taskResult) => {
                    logger.addLogs(taskResult.logs);
                    return taskResult;
                });
            })).then((results) => results.map((r) => (r.result)).join("\n\n"));

            //filter system widget extensions from custom widget info
            result.info.controls.custom = result.info.controls.custom.filter((wInfo) => !systemWidgetNames.includes(wInfo.name));
            //create promise to build custom controls
            const customWidgetPromise = Promise.all(result.info.controls.custom.map((wInfo) => lessBuilder.runTask({
                cmd: "build-widget",
                data: {
                    info: wInfo,
                    palettes: appData.palettes,
                    assignments: appData.assignments,
                    isSystemControl: false,
                    defaultTheme: appData.defaultTheme
                }
            }).then((taskResult) => {
                logger.addLogs(taskResult.logs);
                return taskResult;
            }))).then((results) => results.map((r) => (r.result)).join("\n\n"));

            //wait for all build promises to complete
            return Promise.all([
                appPromise,
                systemWidgetPromise,
                customWidgetPromise
            ]).then((results) => {
                lessBuilder.destroy();
                const cssOutPath = [basePath || process.cwd(), outputPath].join(p.sep);
                logger.log(`* css output path: ${cssOutPath}`);
                //output generated stylesheet
                return fs.outputFile(cssOutPath, results.join("\n\n")).then(() => {
                    logger.log(`* build completed in ${Date.now() - buildStartTime}ms (${logger.errors} errors, ${logger.warnings} warnings)`);
                    const logs = logger.getLogs();
                    require('./logger').removeLogger(loggerName);

                    return logs; //return generated logs
                });
            });
        });
    }).catch((error) => {
        logger.error("Error building less:", error);
        return Promise.reject(error);
    });
}

exports.buildLess = buildLess;