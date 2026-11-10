(function() {
    /**
     * replace module name with a custom name for the local-script.
     *
     * All local-script should be attached to the "custom.ls" package.
     * If more than one script is required for an application, a common root package
     * should be created (e.g. "custom.ls.customerName.*").
     */

    const MODULE_NAME = "update_packages",
        ENABLE_LOGGING = false,
        RECORD_LOG = false,
        logger = shmi.requires("visuals.tools.logging").createLogger(MODULE_NAME, ENABLE_LOGGING, RECORD_LOG),
        fLog = logger.fLog,
        log = logger.log,
        module = shmi.pkg(MODULE_NAME);

    // MODULE CODE - START

    /* private variables */
    const plcItemRoot = `virtual:Conveyor.package[`,
        maxPackages = 15,
        pkgConfig = {
            "class-name": "iq-shape package",
            "scale": 100,
            "polygons": [[0, 0], [1, 0], [1, 1], [0, 1]]
        };

    /* private functions */

    /**
     * Updates the sorter when the rotation angle changed
     *
     * @param {object} sorter sorter widget reference
     * @param {number} angle sorter angle
     */
    function updateSorter(sorter, angle) {
        sorter.element.style.transform = `rotate(${angle}deg)`;
    }

    /**
     * Initialize a new package widget and hide it
     *
     * @param {number} pkgNo package number
     * @param {LocalScript} self instance reference of local-script control
     */
    function initPackage(pkgNo, self) {
        const newPkg = shmi.createControl("iq-shape", self.vars.line.element, pkgConfig, "DIV", "after");
        newPkg.element.style.visibility = "hidden";
        self.vars.packages[pkgNo] = {
            lineNo: null,
            oldPos: null,
            ctrl: newPkg
        };
    }

    /**
     * Updates the package position when the subscription of the package position item returns
     *
     * @param {string} name item name
     * @param {number} val item value
     * @param {LocalScript} self instance reference of local-script control
     */
    function updatePackagePos(name, val, self) {
        const offsetLeft = 340,
            offsetCircle = 50,
            vCenter = 240;

        const pkgNo = name.split("[")[1].split("].")[0];
        if (!self.vars.packages[pkgNo]) {
            // if package is not present, initialize it
            initPackage(pkgNo, self);
        }

        const mypkg = self.vars.packages[pkgNo];
        if (typeof val === "number") {
            // check if package position moved backwards (plc item is reused)
            if (val === 0 || mypkg.oldPos > val) {
                // hide package
                shmi.removeClass(mypkg.ctrl.element, "animated");
                mypkg.ctrl.element.style.visibility = "hidden";
            } else {
                // show package
                shmi.addClass(mypkg.ctrl.element, "animated");
                mypkg.ctrl.element.style.visibility = "visible";
            }

            // set position according to the package line number
            switch (mypkg.lineNo) {
            case 0:
                // package is travelling on line 0
                mypkg.ctrl.element.style.top = vCenter + "px";
                mypkg.ctrl.element.style.left = 110 + val + "px";
                break;
            case 1:
                // package is travelling on line 1 (to the left)
                mypkg.ctrl.element.style.top = vCenter - val - offsetCircle + "px";
                mypkg.ctrl.element.style.left = offsetLeft + "px";
                break;
            case 2:
                // package is travelling on line 2 (forward)
                mypkg.ctrl.element.style.top = vCenter + "px";
                mypkg.ctrl.element.style.left = offsetLeft + offsetCircle + val + "px";
                break;
            case 3:
                // package is travelling on line 3 (to the right)
                mypkg.ctrl.element.style.top = vCenter + val + offsetCircle + "px";
                mypkg.ctrl.element.style.left = offsetLeft + "px";
                break;
            default:
                // hide package
                shmi.removeClass(mypkg.ctrl.element, "animated");
                mypkg.ctrl.element.style.visibility = "hidden";
                break;
            }
            // store old package position
            mypkg.oldPos = val;
        }
    }

    /**
     * Updates the package line when the subscription of the package line item returns
     *
     * @param {string} name item name
     * @param {number} val item value
     * @param {LocalScript} self instance reference of local-script control
     */
    function updatePackageLineNo(name, val, self) {
        const pkgNo = name.split("[")[1].split("].")[0];
        if (!self.vars.packages[pkgNo]) {
            // if package is not present, initialize it
            initPackage(pkgNo, self);
        }

        const mypkg = self.vars.packages[pkgNo];
        if (typeof val === "number") {
            // set package line number
            mypkg.lineNo = val;
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
        const subVars = {
            lineNo: [],
            pos: []
        };
        self.vars = self.vars || {};
        self.vars.packages = {};

        for (let i = 0; i < maxPackages; i++) {
            // build subscription array for position and line number
            subVars.pos.push(plcItemRoot + i + "].pos");
            subVars.lineNo.push(plcItemRoot + i + "].lineNo");
        }

        // Get a reference to the Item Manager used for retrieving item data
        const im = shmi.requires("visuals.session.ItemManager");

        // As everything in WebIQ is loaded asynchronously our LocalScript might be
        // executed before all of the widgets are available leading to errors that are hard to debug
        // where the LocalScript is working on one system, but on on another due to different timings.
        // Therefore we wait until the widgets we need are available.
        // Luckily we also get the references to them directly as well!
        self.vars.cancelable = shmi.onReady({
            // References the widgets we wait for - the structure with "controls" always has to look like this
            // You essentially set the "Control Name" from WebIQ Designer here prefixed with a dot.
            // These selectors are global selectors, i.e. the look for widgets in the complete HMI for a
            // container e.g. named ".my-widget-container". You can also specify a full path just like with CSS:
            // ".my-container .my-widget-container" would look for a widget with the name "my-widget-container"
            // which is contained inside another widget with the name "my-container"
            controls: {
                sorter: ".sorter",
                line: ".lineV"
            }
        }, function(resolved) {
            self.vars.line = resolved.controls.line;
            // subscribe item
            self.vars.token = im.subscribe(["virtual:Conveyor.sorterAngle"], function(name, val, type) {
                // This callback function is called automatically, whenever the value of the item changes
                // check for value of subscribed item and update sorter
                if (typeof val === "number") {
                    updateSorter(resolved.controls.sorter, val);
                }
            });

            // subscribe all position items
            self.vars.pkgPosToken = im.subscribe(subVars.pos, function(name, val, type) {
                // This callback function is called automatically, whenever the value of one of the items changes
                updatePackagePos(name, val, self);
            });

            // subscribe all line number items
            self.vars.pkgLineToken = im.subscribe(subVars.lineNo, function(name, val, type) {
                // This callback function is called automatically, whenever the value of one of the items changes
                updatePackageLineNo(name, val, self);
            });
        });

        /* called when this local-script is disabled */
        self.onDisable = function() {
            self.run = false; /* from original .onDisable function of LocalScript control */
            self.vars = self.vars || {};

            // unsubscribe item - this is very important - otherwise memory leaks might occur
            if (self.vars.token) {
                self.vars.token.unlisten();
            }

            // unsubscribe package position items
            if (self.vars.pkgPosToken) {
                self.vars.pkgPosToken.unlisten();
            }

            // unsubscribe package line items
            if (self.vars.pkgLineToken) {
                self.vars.pkgLineToken.unlisten();
            }

            // cancel shmi.onReady to ensure there will nothing be running in the background anymore if the widgets have not been found
            if (self.vars.cancelable) {
                self.vars.cancelable.cancel();
            }
        };
    };

    // MODULE CODE - END

    fLog("module loaded");
})();
