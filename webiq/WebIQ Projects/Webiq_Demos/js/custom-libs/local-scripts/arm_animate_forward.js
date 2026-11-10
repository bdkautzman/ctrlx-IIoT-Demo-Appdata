(function() {
    /**
     * replace module name with a custom name for the local-script.
     *
     * All local-script should be attached to the "custom.ls" package.
     * If more than one script is required for an application, a common root package
     * should be created (e.g. "custom.ls.customerName.*").
     */

    const MODULE_NAME = "arm_animate_forward",
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
     * Convert degrees to radians
     *
     * @param {number} degrees degrees
     * @returns {number} radians
     */
    function deg_to_rad(degrees) {
        return degrees * (Math.PI/180);
    }

    /**
     * Update the arm with the rotation of both angles
     *
     * @param {number} angle1 first arm angle
     * @param {number} angle2 second arm angle
     * @param {object} arm1 reference to arm widget
     * @param {object} arm2 reference to arm widget
     */
    function updateArm(angle1, angle2, arm1, arm2) {
        const xOffs = 300, // center position
            yOffs = 250,
            arm1Len = 142, // length of the arm
            imgOffs = { // image offset
                x: -35,
                y: -33
            };

        const eoa_x = Math.cos(deg_to_rad(angle1)) * arm1Len,
            eoa_y = Math.sin(deg_to_rad(angle1)) * arm1Len;

        // set the position of our first arm
        arm1.element.style.setProperty("left", xOffs + imgOffs.x + "px", "important");
        arm1.element.style.setProperty("top", yOffs + imgOffs.y + "px", "important");

        // apply transform-origin to rotate properly
        arm1.element.style["transform-origin"] = "17.9% 51%";

        // apply the new rotation
        arm1.element.style.transform = `rotate(${angle1}deg)`;

        // set the position of our second arm
        arm2.element.style.setProperty("left", xOffs + eoa_x + imgOffs.x + "px", "important");
        arm2.element.style.setProperty("top", yOffs + eoa_y + imgOffs.y + "px", "important");

        // apply transform-origin to rotate properly
        arm2.element.style["transform-origin"] = "17.9% 51%";

        // apply the new rotation
        arm2.element.style.transform = `rotate(${angle2}deg)`;
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
        let angle1 = null, angle2 = null;

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
                arm1: ".arm1",
                arm2: ".arm2"
            }
        }, function(resolved) {
            // subscribe item
            self.vars.token = im.subscribe(["virtual:armAngle1", "virtual:armAngle2"], function(name, val, type) {
                // This callback function is called automatically, whenever the value of one of the specified items changes
                // check for name of subscribed item
                if (name === "virtual:armAngle1") {
                    angle1 = val;
                } else {
                    angle2 = val;
                }

                // check for value of subscribed item and update arm
                if (typeof angle1 === "number" && typeof angle2 === "number") {
                    updateArm(angle1, angle2, resolved.controls.arm1, resolved.controls.arm2);
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
