(function() {
    /**
     * replace module name with a custom name for the local-script.
     *
     * All local-script should be attached to the "custom.ls" package.
     * If more than one script is required for an application, a common root package
     * should be created (e.g. "custom.ls.customerName.*").
     */

    const MODULE_NAME = "simulate_plc",
        ENABLE_LOGGING = false,
        RECORD_LOG = false,
        logger = shmi.requires("visuals.tools.logging").createLogger(MODULE_NAME, ENABLE_LOGGING, RECORD_LOG),
        fLog = logger.fLog,
        log = logger.log,
        module = shmi.pkg(MODULE_NAME);

    // MODULE CODE - START

    /* private variables */
    const updateInterval = 300, // package simulation interval in ms
        maxPackages = 15, // number of available package variables
        maxPos = [200, 140, 170, 140], // maximum allowed package position for each line
        plcItemRoot = `virtual:Conveyor.package[`; // base item root

    let plcIndex = 0;

    /* private functions */

    /**
     * Sorts a package depending on the sorter angle
     *
     * @param {object} pkg package
     * @param {LocalScript} self instance reference of local-script control
     */
    function sortPackage(pkg, self) {
        switch (self.vars.sorterAngle) {
        case -90:
            pkg.lineNo = 1;
            pkg.pos = 0;
            break;
        case 0:
            pkg.lineNo = 2;
            pkg.pos = 0;
            break;
        case 90:
            pkg.lineNo = 3;
            pkg.pos = 0;
            break;
        default:
            pkg.lineNo = 2;
            pkg.pos = 0;
            break;
        }
    }

    /**
     * Updates all package positions in the plc simulation
     *
     * @param {LocalScript} self instance reference of local-script control
     * @param {object} im item manager reference
     */
    function updatePackages(self, im) {
        // get last timestamp and compare to the current time
        if (!self.vars.lastTimestamp) self.vars.lastTimestamp = Date.now();
        const diff = Date.now() - self.vars.lastTimestamp;

        self.vars.packages.forEach(function(pkg, idx) {
            // package did not reach the end of the conveyor belt
            if (pkg.pos < maxPos[pkg.lineNo]) {
                // only continue when the conveyor is in the running state
                if (self.vars.conveyorRunning) {
                    // item is being transported on the conveyor belt
                    pkg.pos += Math.floor(6 * (diff / updateInterval));
                    // update package virtual item values
                    im.writeValue(`${plcItemRoot}${pkg.plcIndex}].lineNo`, pkg.lineNo);
                    im.writeValue(`${plcItemRoot}${pkg.plcIndex}].pos`, pkg.pos);
                }
            } else if (pkg.lineNo === 0) {
                // item is at end of line 1 and goes to the sorter / next line
                sortPackage(pkg, self);
                // update package virtual item values
                im.writeValue(`${plcItemRoot}${pkg.plcIndex}].lineNo`, pkg.lineNo);
                im.writeValue(`${plcItemRoot}${pkg.plcIndex}].pos`, pkg.pos);
            } else {
                // COUNT package and reset
                self.vars.packageCount[pkg.lineNo]++;
                self.vars.packages.shift();

                switch (pkg.lineNo) {
                case 1:
                    im.writeValue("virtual:Conveyor.binLeft", self.vars.packageCount[pkg.lineNo]);
                    break;
                case 2:
                    im.writeValue("virtual:Conveyor.binFwd", self.vars.packageCount[pkg.lineNo]);
                    break;
                case 3:
                    im.writeValue("virtual:Conveyor.binRight", self.vars.packageCount[pkg.lineNo]);
                    break;
                default:
                    break;
                }
                // update package virtual item values
                im.writeValue(`${plcItemRoot}${pkg.plcIndex}].lineNo`, 0);
                im.writeValue(`${plcItemRoot}${pkg.plcIndex}].pos`, 0);
            }
        });
        self.vars.lastTimestamp = Date.now();
    }

    /**
     * Emit a new package to the line if possible
     *
     * @param {LocalScript} self instance reference of local-script control
     */
    function emitPackage(self) {
        if (self.vars.packages.length < maxPackages && self.vars.conveyorRunning) {
            self.vars.packages.push({
                plcIndex,
                lineNo: 0,
                pos: 0
            });
            plcIndex++;
            if (plcIndex > maxPackages - 1) {
                plcIndex = 0;
            }
        }
    }

    /**
     * Implements local-script run function.
     *
     * This function will be called each time a local-script will be enabled.
     *
     * @param {LocalScript} self instance reference of local-script control
     */
    module.run = function(self) {
        const im = shmi.requires("visuals.session.ItemManager");
        self.vars = self.vars || {};
        self.vars.packages = [];
        self.vars.packageCount = [0, 0, 0, 0];
        self.vars.tokens = [];
        self.vars.conveyorRunning = false;
        self.vars.lastTimestamp = null;
        self.vars.emitInterval = null;
        self.vars.updateInterval = null;

        self.vars.updateInterval = setInterval(updatePackages.bind(null, self, im), updateInterval);

        self.vars.tokens.push(im.subscribe(["virtual:Conveyor.status"], function(name, val, type) {
            // This callback function is called automatically, whenever the value of the item changes
            if (val) {
                // set the conveyor belt var to the running state
                self.vars.conveyorRunning = true;
            } else {
                // set the conveyor belt var to the stopped state
                self.vars.conveyorRunning = false;
            }
        }));

        self.vars.tokens.push(im.subscribe(["virtual:Conveyor.packagesON"], function(name, val, type) {
            // This callback function is called automatically, whenever the value of the item changes
            if (val) {
                // val is 1, start emitting packages
                clearInterval(self.vars.emitInterval);
                self.vars.emitInterval = setInterval(emitPackage.bind(null, self), 3000);
            } else {
                // val is 0, stop emitting packages
                clearInterval(self.vars.emitInterval);
            }
        }));

        self.vars.tokens.push(im.subscribe(["virtual:Conveyor.sorterAngle"], function(name, val, type) {
            // This callback function is called automatically, whenever the value of the item changes
            // set sorter angle to item value
            self.vars.sorterAngle = val;
        }));

        /* called when this local-script is disabled */
        self.onDisable = function() {
            self.run = false; /* from original .onDisable function of LocalScript control */
            // remove intervals
            clearInterval(self.vars.updateInterval);
            clearInterval(self.vars.emitInterval);
            // unsubscribe all items
            self.vars.tokens.forEach(function(tok) {
                tok.unlisten();
            });
        };
    };

    // MODULE CODE - END

    fLog("module loaded");
})();
