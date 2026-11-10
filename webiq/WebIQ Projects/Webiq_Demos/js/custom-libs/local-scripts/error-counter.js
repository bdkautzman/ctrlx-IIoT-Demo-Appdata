(function () {

    /**
     * replace module name with a custom name for the local-script.
     *
     * All local-script should be attached to the "custom.ls" package.
     * If more than one script is required for an application, a common root package
     * should be created (e.g. "custom.ls.customerName.*").
     */

    var MODULE_NAME = "error-counter",
        ENABLE_LOGGING = false,
        RECORD_LOG = false,
        logger = shmi.requires("visuals.tools.logging").createLogger(MODULE_NAME, ENABLE_LOGGING, RECORD_LOG),
        fLog = logger.fLog,
        log = logger.log,
        module = shmi.pkg( MODULE_NAME );

    // MODULE CODE - START

    /* private variables */
    let i = 0;

    /* private functions */

    /**
     * Implements local-script run function.
     *
     * This function will be called each time a local-script will be enabled.
     *
     * @param {LocalScript} self instance reference of local-script control
     */
    module.run = function (self) {
        const im = shmi.visuals.session.ItemManager,
            itemHandler = im.getItemHandler(),
            thicknessItem = im.subscribeItem('production.act-thickness', itemHandler);

        shmi.onReady({
            items: {
                thickness: "production.act-thickness",
                errorCount: "virtual:production.thickness-error-counter"
            }
        }, function (resolved) {
            const thickness = resolved.items.thickness,
                errorCount = resolved.items.errorCount; 

            itemHandler.setValue = function(value) {
                if (value <= thickness.warnmin || value >= thickness.warnmax) {
                    i += 1; 
                    im.writeValue('virtual:production.thickness-error-state', 1);
                    im.writeValue('virtual:production.thickness-error-counter', i);
                } else {
                    im.writeValue('virtual:production.thickness-error-state', 0);
                }

                if (errorCount.value === 50) {
                    im.writeValue('virtual:production.thickness-error-state', 0);
                    im.writeValue('virtual:production.thickness-error-counter', 0);
                    i = 0;
                }
            }
        });


        /* called when this local-script is disabled */
        self.onDisable = function () {
            im.unsubscribeItem('production.act-thickness', itemHandler);
            token = [];
            self.run = false; /* from original .onDisable function of LocalScript control */
        };
    };


    // MODULE CODE - END

    fLog("module loaded");
})();
