(function() {
    /**
     * replace module name with a custom name for the local-script.
     *
     * All local-script should be attached to the "custom.ls" package.
     * If more than one script is required for an application, a common root package
     * should be created (e.g. "custom.ls.customerName.*").
     */

    const MODULE_NAME = "shapeScaleExample",
        ENABLE_LOGGING = false,
        RECORD_LOG = false,
        logger = shmi.requires("visuals.tools.logging").createLogger(MODULE_NAME, ENABLE_LOGGING, RECORD_LOG),
        fLog = logger.fLog,
        log = logger.log,
        module = shmi.pkg(MODULE_NAME);

    // MODULE CODE - START

    /* private variables */

    /* private functions */

    /**
     * Updates the transformation of the shape
     *
     * @param {number} val value for the transformation
     * @param {object} shape shape widget reference
     */
    function updateShape(val, shape) {
        // update shape transform and set the new scale
        shape.element.style.transform = `scale(${val})`;
    }
    /**
     * Implements local-script run function.
     *
     * This function will be called each time a local-script will be enabled.
     *
     * @param {LocalScript} self instance reference of local-script control
     */
    module.run = function(self) {
        // Get a reference to the Item Manager used for retrieving item data
        const im = shmi.requires("visuals.session.ItemManager");
        self.vars = self.vars || {};

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
                shape: ".iq-shape-scale"
            }
        }, function(resolved) {
            const shape = resolved.controls.shape;

            // subscribe item
            self.vars.token = im.subscribe(["virtual:shapeScale"], function(name, val, type) {
                // This callback function is called automatically, whenever the value of the item changes
                // check for value of subscribed item and update shape
                if (typeof val === "number") {
                    updateShape(val, shape);
                }
            });
        });

        /* called when this local-script is disabled */
        self.onDisable = function() {
            self.run = false; /* from original .onDisable function of LocalScript control */

            // unsubscribe item - this is very important - otherwise memory leaks might occur
            if (self.vars.token) {
                self.vars.token.unlisten();
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
