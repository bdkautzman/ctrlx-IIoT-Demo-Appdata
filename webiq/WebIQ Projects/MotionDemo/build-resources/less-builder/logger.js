const loggers = {};

/**
 * create logging function for specified type & logger
 *
 * @param {string} type log type
 * @param {object} logger logger reference
 * @returns {function} logging function
 */
function getLogFunction(type, logger) {
    return (...args) => {
        if (logger.console) {
            switch (type) {
            case "warn":
                console.warn(...args);
                logger.warnings += 1;
                break;
            case "error":
                console.error(...args);
                logger.errors += 1;
                break;
            default:
                console.log(...args);
            }
        }
        logger.addLog({
            type: type,
            time: Date.now(),
            msg: args.join(" ")
        });
    };
}

/**
 * create new logger
 *
 * @param {string} name logger name
 * @param {boolean} [consoleEnabled=true] `true` to also log to console
 * @returns {object} logger reference
 */
function createLogger(name, consoleEnabled = true) {
    let logs = [];

    const logger = {
        name: name,
        console: consoleEnabled,
        log: null,
        warn: null,
        error: null,
        clear: null,
        addLog: null,
        addLogs: null,
        getLogs: null,
        warnings: 0,
        errors: 0
    };

    logger.log = getLogFunction("notice", logger);
    logger.warn = getLogFunction("warn", logger);
    logger.error = getLogFunction("error", logger);

    logger.clear = () => {
        logs = [];
        logger.warnings = 0;
        logger.errors = 0;
    };

    logger.addLog = (log) => {
        logs.push(log);
        if (log.type === "warn") {
            logger.warnings += 1;
        } else if (log.type === "error") {
            logger.errors += 1;
        }
    };

    logger.addLogs = (moreLogs) => {
        logs = logs.concat(moreLogs);
        moreLogs.forEach((log) => {
            if (log.type === "warn") {
                logger.warnings += 1;
            } else if (log.type === "error") {
                logger.errors += 1;
            }
        });
    };

    logger.getLogs = () => logs.slice();

    return logger;
}

/**
 * get logger reference by name. creates new logger if none found
 *
 * @param {string} name logger name
 * @param {boolean} [consoleEnabled=true] `true` to also log to console (only when new logger is created)
 * @returns {object} logger reference
 */
function getLogger(name, consoleEnabled = true) {
    if (!loggers[name]) {
        loggers[name] = createLogger(name, consoleEnabled);
    }

    return loggers[name];
}

/**
 * remove logger of specified name
 *
 * @param {string} name logger name
 */
function removeLogger(name) {
    delete loggers[name];
}

exports.getLogger = getLogger;
exports.removeLogger = removeLogger;