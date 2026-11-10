const loggerName = "less-worker",
    logger = require("./logger").getLogger(loggerName, true);

/**
 * wrap theme stylesheet text in CSS selector
 *
 * @param {string} themeName theme name
 * @param {boolean} isDefault `true` if theme is default, `false` else
 * @param {string} sheetText stylesheet text
 * @returns {string} wrapped stylesheet text
 */
function wrapThemeData(themeName, isDefault, sheetText) {
    if (isDefault) {
        return sheetText;
    }

    return `.${themeName}-theme {\n${sheetText}\n}`;
}

/**
 * create LESS source to define variable values
 *
 * @param {object} variablesDefinition key value map of variables
 * @param {boolean} [logInvalidDefault=false] `true` to create logs for values that contain variables or LESS functions
 * @returns {string} LESS source defining variables
 */
function getVariableDeclarations(variablesDefinition, logInvalidDefault = false) {
    if (typeof variablesDefinition === "undefined") {
        logger.error("-- undefined variable definition");
        return "";
    } else if (variablesDefinition === null) {
        logger.warn("-- null variable definition");
        return "";
    }
    return Object.entries(variablesDefinition).map(([key, value]) => {
        if (logInvalidDefault) {
            if (value.includes("@")) {
                logger.warn(`Variable '${key}' is missing actual value '${value}'`);
            } else if (value.includes("fadeout(") || value.includes("lighten(") || value.includes("darken(")) {
                logger.warn(`Variable '${key}' contains LESS function '${value}'`);
            }
        }
        return `@${key}: ${value};`;
    }).join('\n');
}

/**
 * create less/css source to define all variables starting with 'iq-' as CSS variables
 *
 * @param {object} palette key value map of theme palette
 * @returns {string} less/css source defining CSS variables
 */
function getIqVariables(palette) {
    return Object.entries(palette).filter(([key, value]) => key.startsWith('iq-')).map(([key, value]) => `--${key}: ${value};`).join('\n');
}

/**
 * create CSS iq-variables stylesheet
 *
 * @param {object} palette key value map of theme palette
 * @param {string} themeName theme name
 * @param {true} isDefault `true` if theme is default
 * @returns {string|null} stylesheet data or `null` when no iq-variables defined
 */
function getIqSheet(palette, themeName, isDefault) {
    const iqVars = getIqVariables(palette);

    if (iqVars.length === 0) {
        return null;
    }

    if (isDefault) {
        return `:root {\n${iqVars}\n}`;
    } else {
        return `.${themeName}-theme {\n${iqVars}\n}`;
    }
}

/**
 * create log message for widget style sizes
 *
 * @param {string} sheetName stylesheet name
 * @param {object} sizeVariables key value map of size variables
 */
function logSizes(sheetName, sizeVariables) {
    logger.log(`- generate stylesheet '${sheetName}' for sizes: ${Object.keys(sizeVariables).join(", ")}`);
}

/**
 * create log message for widget style themes
 *
 * @param {string} sheetName stylesheet name
 * @param {object} palettes key value map of theme palettes
 */
function logThemes(sheetName, palettes) {
    logger.log(`- generate stylesheet '${sheetName}' for themes: ${Object.keys(palettes).join(", ")}`);
}
/**
 * get app sizing stylesheet text
 *
 * @param {object} systemVariables system variables
 * @param {object} customVariables custom variables
 * @returns {string} stylesheet text
 */
function getAppSizing(systemVariables, customVariables) {
    logger.log("* generate app sizing stylesheet");
    return `//global imports
        @import (reference) 'less/system/basics/mix-ins.less';
        @import (reference) 'less/custom/basics/mix-ins.less';
        
        //system variables
        ${getVariableDeclarations(systemVariables)}
        
        //custom variables
        ${getVariableDeclarations(customVariables)}
        
        //app sizing styles
        @import (once) 'less/system/basics/basic-definitions.less';
        @import (once) 'less/system/basics/frequent-modifiers.less';
        @import (once) 'less/system/basics/global.less';
        @import (once) 'less/custom/custom-dimensions.less';`;
}

/**
 * create app theming stylesheet text for single theme
 *
 * @param {string} themeName theme name
 * @param {object} palette theme palette definition
 * @param {object} sysAssignments system variable assignments
 * @param {object} appAssignments app variable assignments
 * @param {boolean} [isDefault=false] `true` for default theme (generated without theme-selector)
 * @returns {string} stylesheet text
 */
function getAppThemeSheet(themeName, palette, sysAssignments, appAssignments, isDefault = false) {
    logger.log(`* generate app stylesheet for theme: ${themeName}`);
    const iqSheet = getIqSheet(palette, themeName, isDefault);
    return `${iqSheet ? iqSheet : "/* no iq-sheet */"}\n\n` + wrapThemeData(themeName, isDefault,
        `//theme palette
        ${getVariableDeclarations(palette, true)}
        
        //system assignments
        ${getVariableDeclarations(sysAssignments)}
        
        //app assignments
        ${getVariableDeclarations(appAssignments)}
        
        //system app styles
        @import (multiple) 'less/system/basics/global-colors.less';

        //custom app styles
        @import (multiple) 'less/custom/custom-colors.less';`
    );
}

/**
 * create app stylesheets for each theme
 *
 * @param {object} palettes key value map of palettes
 * @param {object} assignments system & app variable assignments
 * @param {string} defaultTheme name of default theme
 * @returns {string} stylesheet source
 */
function getAppThemeSheets(palettes, assignments, defaultTheme) {
    return Object.keys(palettes).map(
        (themeName) => getAppThemeSheet(themeName, palettes[themeName], assignments.system[themeName], assignments.app[themeName], themeName === defaultTheme)
    ).join("\n\n");
}

/**
 * create entrypoint to compile theme dependent styles of app
 *
 * @param {object} palettes key value map of palettes
 * @param {object} assignments system & app variable assignments
 * @param {string} [defaultTheme="xenon-moonstone"] name of default theme
 * @returns {string} stylesheet source
 */
function getAppTheming(palettes, assignments, defaultTheme = "xenon-moonstone") {
    return `// global imports
        @import (reference) 'less/system/basics/mix-ins.less';
        @import (reference) 'less/custom/basics/mix-ins.less';
        ${getAppThemeSheets(palettes, assignments, defaultTheme)}\n`;
}

/**
 * wrap control stylesheet in CSS selector
 *
 * @param {string} name selector name
 * @param {string} sheetText stylesheet content
 * @returns {string} stylesheet source
 */
function wrapControlData(name, sheetText) {
    return `.${name} {\n${sheetText}\n}\n`;
}

/**
 * create widget sizing stylesheet for single size
 *
 * @param {string} sizeName size name
 * @param {object} variables key value map of size variables
 * @returns {string} stylesheet source
 */
function getSizeSheet(sizeName, variables) {
    return `${sizeName === "default" ? "&" : "&." + sizeName} {
        //size '${sizeName}' variable values
        ${getVariableDeclarations(variables, sizeName === "default")}
        .control-dimensions();
    }\n`;
}

/**
 * create source for all defined widget sizes
 *
 * @param {object} sizeVariables key value map of size variables
 * @returns {string} stylesheet source
 */
function getSizeSheets(sizeVariables) {
    return Object.keys(sizeVariables).map((sizeName) => {
        if (sizeName === "default") {
            return getSizeSheet(sizeName, sizeVariables[sizeName]);
        } else {
            //merge non-default size definitions into default to create fallback
            return getSizeSheet(sizeName, Object.assign({}, sizeVariables.default, sizeVariables[sizeName]));
        }
    }).join("\n");
}

/**
 * get path to LESS stylesheet source
 *
 * @param {string} controlName control name
 * @param {string} sheetName stylesheet name
 * @param {boolean} isSystemControl `true` for system, `false` for custom controls
 * @returns {string} path to stylesheet source
 */
function getControlSheetPath(controlName, sheetName, isSystemControl) {
    return `less/${isSystemControl ? "system" : "custom"}/controls/${controlName}/${sheetName}.less`;
}

/**
 * create entrypoint to compile size dependent widget styles
 *
 * @param {string} name control name
 * @param {object} sizeVariables key value map of size variables
 * @param {boolean} isSystemControl `true` for system, `false` for custom controls
 * @returns {string} stylesheet source
 */
function getControlSizing(name, sizeVariables, isSystemControl) {
    const sheetName = "dimensions";

    logSizes(sheetName, sizeVariables);

    return wrapControlData(name,
        `// global imports
        @import (reference) 'less/system/basics/mix-ins.less';
        @import (reference) 'less/custom/basics/mix-ins.less';

        //import dimensions styles (size variable dependent)
        @import (reference) '${getControlSheetPath(name, sheetName, isSystemControl)}';
        ${getSizeSheets(sizeVariables)}`
    );
}

/**
 * create stylesheet for common/static widget styles
 *
 * @param {string} name control name
 * @param {boolean} isSystemControl `true` for system, `false` for custom controls
 * @returns {string} styleheet source
 */
function getControlCommon(name, isSystemControl) {
    const sheetName = "common";

    logger.log(`- generate stylesheet '${sheetName}'`);

    return wrapControlData(name,
        `// global imports
        @import (reference) 'less/system/basics/mix-ins.less';
        @import (reference) 'less/custom/basics/mix-ins.less';
        
        //import common styles (static, no variables)
        @import (once) '${getControlSheetPath(name, sheetName, isSystemControl)}';`
    );
}

/**
 * create stylesheet for general widget styles (modern widgets)
 *
 * @param {string} name control name
 * @param {boolean} isSystemControl `true` for system, `false` for custom controls
 * @returns {string} styleheet source
 */
function getWidgetSheet(name, isSystemControl) {
    const sheetName = "widget";

    logger.log(`- generate stylesheet '${sheetName}'`);

    return wrapControlData(name,
        `//import widget styles (static, no variables)
        @import (once) '${getControlSheetPath(name, sheetName, isSystemControl)}';`
    );
}

/**
 * create widget theming stylesheet for single theme
 *
 * @param {string} controlName control name
 * @param {string} themeName theme name
 * @param {object} palette key value map of theme variables
 * @param {object} defaultVariables key value map of control default values
 * @param {object} themeVariables key value map of theme specific variable to palette mappings
 * @param {object} systemAssignments app system assignment variable values
 * @param {boolean} [isDefault=false] `true` if building default theme, `false` else
 * @param {boolean} [isSystemControl=false] `true` for system, `false` for custom controls
 * @returns {string} stylesheet source
 */
function getControlThemeSheet(controlName, themeName, palette, defaultVariables, themeVariables, systemAssignments, isDefault = false, isSystemControl = false) {
    return `${isDefault ? "&" : `.${themeName}-theme &`} {
        //theme palette
        ${getVariableDeclarations(palette)}

        //system assignments
        ${getVariableDeclarations(systemAssignments)}

        //control variable definition
        ${getVariableDeclarations(Object.assign({}, defaultVariables, themeVariables))}

        //import themable styles (theme variable dependent)
        @import (reference, multiple) '${getControlSheetPath(controlName, "style", isSystemControl)}';

        .control-style();
    }`;
}

/**
 * create widget theming stylesheets for all themes
 *
 * @param {string} controlName control name
 * @param {object} palettes key value map of theme palettes
 * @param {object} themingVariables widget theming mappings for all themes
 * @param {object} systemAssignments app system assignment variable values for all themes
 * @param {string} defaultTheme name of default theme
 * @param {boolean} isSystemControl `true` for system, `false` for custom controls
 * @returns {string} stylesheet source
 */
function getControlThemeSheets(controlName, palettes, themingVariables, systemAssignments, defaultTheme, isSystemControl) {
    return Object.keys(palettes).map(
        (themeName) => getControlThemeSheet(controlName, themeName, palettes[themeName], themingVariables.default, themingVariables[themeName], systemAssignments[themeName], themeName === defaultTheme, isSystemControl)
    ).join("\n");
}

/**
 * create entrypoint to compile theme dependent widget styles
 *
 * @param {string} controlName control name
 * @param {object} palettes key value map of theme palettes
 * @param {object} themingVariables widget theming mappings for all themes
 * @param {object} systemAssignments app system assignment variable values for all themes
 * @param {boolean} isSystemControl `true` for system, `false` for custom controls
 * @param {string} [defaultTheme="xenon-moonstone"] name of default theme
 * @returns {string} stylesheet source
 */
function getControlTheming(controlName, palettes, themingVariables, systemAssignments, isSystemControl, defaultTheme = "xenon-moonstone") {
    const sheetName = "style";

    logThemes(sheetName, palettes);

    return wrapControlData(controlName,
        `// global imports
        @import (reference) 'less/system/basics/mix-ins.less';
        @import (reference) 'less/custom/basics/mix-ins.less';
        
        //apply theme styling
        ${getControlThemeSheets(controlName, palettes, themingVariables, systemAssignments, defaultTheme, isSystemControl)}\n`
    );
}

exports.getAppSizing = getAppSizing;
exports.getAppTheming = getAppTheming;
exports.getIqSheet = getIqSheet;
exports.getControlTheming = getControlTheming;
exports.getControlSizing = getControlSizing;
exports.getControlCommon = getControlCommon;
exports.getWidgetSheet = getWidgetSheet;