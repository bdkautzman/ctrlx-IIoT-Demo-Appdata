(function() {
    /**
     * replace module name with a custom name for the local-script.
     *
     * All local-script should be attached to the "custom.ls" package.
     * If more than one script is required for an application, a common root package
     * should be created (e.g. "custom.ls.customerName.*").
     */

    const MODULE_NAME = "arm_animate_inverse",
        ENABLE_LOGGING = false,
        RECORD_LOG = false,
        logger = shmi.requires("visuals.tools.logging").createLogger(MODULE_NAME, ENABLE_LOGGING, RECORD_LOG),
        fLog = logger.fLog,
        log = logger.log,
        module = shmi.pkg(MODULE_NAME);

    // MODULE CODE - START

    /* private variables */

    // start definition of our robot arm
    const shoulder = {
        x: 0,
        y: 0
    };

    let elbow = {
        x: 142,
        y: 0,
        angle: 0,
        angle2: 0
    };

    let oldElbow = {
        x: NaN,
        y: NaN,
        angle: NaN,
        angle2: NaN
    };

    const hand = {
        x: 142,
        y: 142
    };

    const upperArm = dist(shoulder.x, shoulder.y, elbow.x, elbow.y),
        foreArm = dist(elbow.x, elbow.y, hand.x, hand.y);

    /* private functions */

    /**
     * Convert radians to degrees
     *
     * @param {number} radians radians
     * @returns {number} degrees
     */
    function rad_to_deg(radians) {
        return radians * (180/Math.PI);
    }

    /**
     * Calculate the distance between two points
     *
     * @param {number} x1 x1
     * @param {number} y1 y1
     * @param {number} x2 x2
     * @param {number} y2 y2
     * @returns {number} distance
     */
    function dist(x1, y1, x2, y2) {
        const a = x1 - x2,
            b = y1 - y2;
        return Math.sqrt(a*a + b*b);
    }

    /**
     * Calculate the position for the robot arm elbow using inverse kinematics
     *
     * @param {object} a shoulder position
     * @param {object} b hand position
     * @param {object} A forearm
     * @param {object} B upperarm
     * @param {object} C distance between shoulder position and target position
     * @returns {object} elbow
     */
    function ik(a, b, A, B, C) {
        let th = Math.acos((B**2 + C**2 - A**2) / (2*B*C)),
            phi = Math.atan2(-(b.y - a.y), b.x - a.x);
        if (C > upperArm + foreArm) {
            const newSX = a.x + B*Math.cos(-phi),
                newSY = a.y + B*Math.sin(-phi);
            hand.x = newSX + foreArm*Math.cos(-phi);
            hand.y = newSY + foreArm*Math.sin(-phi);
            return {
                x: newSX,
                y: newSY,
                angle: -1 * rad_to_deg(phi),
                angle2: rad_to_deg(-phi)
            };
        } else {
            return {
                x: a.x + B*Math.cos(th + phi),
                y: a.y - B*Math.sin(th + phi),
                angle: -1 * rad_to_deg(phi) - rad_to_deg(th),
                angle2: rad_to_deg(th - phi)
            };
        }
    }

    /**
     * Update the arm using the target x and y position
     *
     * @param {number} x target x position
     * @param {number} y target y position
     * @param {object} arm1 reference to arm widget
     * @param {object} arm2 reference to arm widget
     */
    function updateArmIK(x, y, arm1, arm2) {
        const imgoffs = { // image offset
            x: -35,
            y: -33
        };

        const xoffs = 300, // center position
            yoffs = 250;

        hand.x = x;
        hand.y = y;
        elbow = ik(shoulder, hand, foreArm, upperArm, dist(shoulder.x, shoulder.y, x, y));

        if (x === 0 && y === 0) {
            if (isNaN(oldElbow.x) || isNaN(oldElbow.y) || oldElbow.x === null || oldElbow.y === null) {
                elbow.x = 142;
                elbow.y = 0;
            }
            if (isNaN(oldElbow.angle) || oldElbow.angle === null) {
                elbow.angle = 0;
                elbow.angle2 = 180;
            } else {
                elbow.angle2 = 180 + oldElbow.angle;
            }
        }

        // set the position of our first arm
        arm1.element.style.setProperty("left", xoffs + imgoffs.x + "px", "important");
        arm1.element.style.setProperty("top", yoffs + imgoffs.y + "px", "important");

        // apply transform-origin to rotate properly
        arm1.element.style["transform-origin"] = "17.9% 51%";

        // apply the new rotation
        arm1.element.style.transform = `rotate(${elbow.angle}deg)`;

        // set the position of our second arm
        arm2.element.style.setProperty("left", xoffs + elbow.x + imgoffs.x + "px", "important");
        arm2.element.style.setProperty("top", yoffs + elbow.y + imgoffs.y + "px", "important");

        // apply transform-origin to rotate properly
        arm2.element.style["transform-origin"] = "17.9% 51%";

        // apply the new rotation
        arm2.element.style.transform = `rotate(${elbow.angle2}deg)`;

        oldElbow = shmi.cloneObject(elbow);
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
        let xPos = 0, yPos = 0;

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
            self.vars.token = im.subscribe(["virtual:armX", "virtual:armY"], function(name, val, type) {
                // This callback function is called automatically, whenever the value of one of the items changes
                if (name === "virtual:armX") {
                    xPos = val;
                } else {
                    yPos = val;
                }
                updateArmIK(xPos, yPos, resolved.controls.arm1, resolved.controls.arm2);
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
