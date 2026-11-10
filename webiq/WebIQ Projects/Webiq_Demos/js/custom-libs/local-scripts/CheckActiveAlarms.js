(function() {
    /**
     * replace module name with a custom name for the local-script.
     *
     * All local-script should be attached to the "custom.ls" package.
     * If more than one script is required for an application, a common root package
     * should be created (e.g. "custom.ls.customerName.*").
     */

    const MODULE_NAME = "CheckActiveAlarms",
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
     * Implements local-script run function.
     *
     * This function will be called each time a local-script will be enabled.
     *
     * @param {LocalScript} self instance reference of local-script control
     */
    module.run = function(self) {

        setInterval(checkAlarmCount, 500);

        /* called when this local-script is disabled */
        self.onDisable = function() {
            self.run = false; /* from original .onDisable function of LocalScript control */
        };
    };

    function checkAlarmCount() {
        const im = shmi.visuals.session.ItemManager;
        const am = shmi.visuals.session.AlarmManager;

        let liveAlarms = am.getLiveAlarms((t,s)=>{
            if (s.length > 0 ){
                im.writeValue('virtual:AlarmActive', 1);
            } else {
                im.writeValue('virtual:AlarmActive', 0);
            }
            
        });
    }

    // MODULE CODE - END

    fLog("module loaded");
})();
