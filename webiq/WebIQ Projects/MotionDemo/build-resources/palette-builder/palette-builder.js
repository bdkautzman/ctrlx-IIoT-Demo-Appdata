/**
 * Palette Builder
 *
 * Generates CSS defining variables from JSON configuration files located in 'json/themes' sub-directory.
 */

const fs = require('fs-extra'),
    p = require('path');

/**
 * get selector for variable declarations
 *
 * @param {string} theme theme name
 * @param {string} subset theme subset, either 'light', 'dark' or 'auto'
 * @param {object} themeConfig theme configuration
 * @param {number} [padding=0] indentation padding to apply
 * @returns {string} generated selector
 */
function getSelector(theme, subset, themeConfig, padding = 0) {
    return `${getIndentation(padding)}:root${theme === "default" ? "" : ".iqtheme-" + theme}${subset === themeConfig.default ? "" : ".iqcm-" + subset}`;
}

/**
 * get media query selector
 *
 * @param {string} subset theme subset, either 'light' or 'dark'
 * @returns {string} media query selector
 */
function getMediaQuery(subset) {
    return `@media (prefers-color-scheme: ${subset})`;
}

/**
 * get indentation
 *
 * @param {number} count levels of indentation padding to apply
 * @return {string} indentation
 */
function getIndentation(count) {
    return "    ".repeat(count);
}

/**
 * get RGB value string from hex color values
 *
 * @param {string} hexValue color value in hex format
 * @return {string} separated RGB value string
 */
function getRgbValue(hexValue) {
    const tmpHexValue = hexValue.slice(1, 7);
    return `${parseInt(tmpHexValue.slice(0, 2), 16)} ${parseInt(tmpHexValue.slice(2, 4), 16)} ${parseInt(tmpHexValue.slice(4, 6), 16)}`;
}

/**
 * get variable definitions from variable data config
 *
 * @param {object} variableData variable data configuration
 * @param {number} [padding=0] indentation padding to apply
 * @return {string} variable definition string
 */
function getVariables(variableData, padding = 0) {
    return Object.entries(variableData).map(([key, value]) => `${getIndentation(padding)}--${key}: ${value};\n`).join("");
}

/**
 * color variable definitions from variable data config.
 *
 * this defines 2 CSS variables per variable configuration. An additional variable with suffix "-rgb" is created for each color to hold
 * a separated RGB color value for each color.
 *
 * @param {object} variableData variable data configuration
 * @param {number} [padding=0] indentation padding to apply
 * @return {string} variable definition string
 */
function getColorVariables(variableData, padding = 0) {
    return Object.entries(variableData).map(([key, value]) => `${getIndentation(padding)}--${key}: ${value};\n${getIndentation(padding)}--${key}-rgb: ${getRgbValue(value)};\n`).join("");
}

/**
 * generate CSS stylesheet for specified theme
 *
 * @param {string} theme theme name
 * @param {object} themeConfig theme configuration
 * @return {string} CSS stylesheet text
 */
function generateCSS(theme, themeConfig) {
    let cssText = `/* Theme: ${theme} */\n\n`;
    cssText += `/* Colors */\n`;
    if (themeConfig.default === "light") {
        cssText += `${getSelector(theme, "light", themeConfig, 0)} {\n${getColorVariables(themeConfig.colors.light, 1)}}\n\n`;
        cssText += `${getSelector(theme, "dark", themeConfig, 0)} {\n${getColorVariables(themeConfig.colors.dark, 1)}}\n\n`;
        cssText += `${getMediaQuery("dark")} {\n${getSelector(theme, "auto", themeConfig, 1)} {\n${getColorVariables(themeConfig.colors.dark, 2)}${getIndentation(1)}}\n}\n\n`;
    } else {
        cssText += `${getSelector(theme, "dark", themeConfig, 0)} {\n${getColorVariables(themeConfig.colors.dark, 1)}}\n\n`;
        cssText += `${getSelector(theme, "light", themeConfig, 0)} {\n${getColorVariables(themeConfig.colors.light, 1)}}\n\n`;
        cssText += `${getMediaQuery("light")} {\n${getSelector(theme, "auto", themeConfig, 1)} {\n${getColorVariables(themeConfig.colors.light, 2)}${getIndentation(1)}}\n}\n\n`;
    }

    cssText += `/* Fonts */\n`;
    cssText += `:root${theme === "default" ? "" : ".iqtheme-" + theme} {\n${getVariables(themeConfig.fonts, 1)}}\n\n`;

    return cssText;
}

/**
 * load all available theme configurations from 'json/themes' sub-directory
 *
 * @param {string} [basePath=null] application base path
 * @return {object[]} theme configurations
 */
async function loadPalettes(basePath = null) {
    try {
        const configPath = [basePath, "json", "themes"].join(p.sep),
            dirContent = await fs.readdir(`${configPath}`, { withFileTypes: true }),
            configFiles = dirContent.filter((entry) => entry.isFile() && entry.name.endsWith(".json")),
            themeConfigs = [];
        let defaultIndex = -1;

        await Promise.all(configFiles.map(async (entry, idx) => {
            try {
                const themeConfig = {
                    name: entry.name.replace(/\.json$/, ""),
                    config: await fs.readJSON(`${configPath}${p.sep}${entry.name}`)
                };
                themeConfigs.push(themeConfig);
            } catch (exc) {
                console.error(`Error reading theme configuration '${entry.name}':`, exc);
            }
        }));

        defaultIndex = themeConfigs.findIndex((themeConfig) => themeConfig.name === "default");

        //move default theme to first index
        if (defaultIndex > 0) {
            const defaultConfig = themeConfigs[defaultIndex];
            themeConfigs[defaultIndex] = themeConfigs[0];
            themeConfigs[0] = defaultConfig;
        }

        return themeConfigs;
    } catch (exc) {
        console.error("Error reading theme config folder:", exc);
    }

    return [];
}

/**
 * load app config file
 *
 * @param {string} [basePath=null] application base path
 * @returns {object} app config
 */
function loadAppConfig(basePath = null) {
    const configPath = [basePath, "json", "project.json"].join(p.sep);

    return fs.readJSON(configPath);
}

/**
 * save app config to file
 *
 * @param {string} [basePath=null] application base path
 * @param {object} configData app config
 */
function saveAppConfig(basePath = null, configData) {
    const configPath = [basePath, "json", "project.json"].join(p.sep);
    return fs.outputJSON(configPath, configData, { spaces: 4 });
}

/**
 * build theme palette stylesheet
 *
 * @param {string} [basePath=null] application base path
 * @param {string} [outputPath=`css${p.sep}palette.css`] stylesheet output path relative to `basePath`
 */
async function buildPalette(basePath = null, outputPath = `css${p.sep}palette.css`) {
    const [themeConfigs, appConfig] = await Promise.all([loadPalettes(basePath), loadAppConfig(basePath)]);

    appConfig.themes = themeConfigs;

    await Promise.all([
        fs.outputFile(`${basePath}${p.sep}${outputPath}`, themeConfigs.map((themeConfig) => generateCSS(themeConfig.name, themeConfig.config)).join("\n\n")),
        saveAppConfig(basePath, appConfig)
    ]);
}

exports.buildPalette = buildPalette;