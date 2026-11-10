(function () {

    /**
     * replace module name with a custom name for the local-script.
     *
     * All local-script should be attached to the "custom.ls" package.
     * If more than one script is required for an application, a common root package
     * should be created (e.g. "custom.ls.customerName.*").
     */

    var MODULE_NAME = "QR_Code_Gen",
        ENABLE_LOGGING = false,
        RECORD_LOG = false,
        logger = shmi.requires("visuals.tools.logging").createLogger(MODULE_NAME, ENABLE_LOGGING, RECORD_LOG),
        fLog = logger.fLog,
        log = logger.log,
        module = shmi.pkg( MODULE_NAME );

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
    module.run = function (self) {
        var im = shmi.requires("visuals.session.ItemManager"),
        itemHandler = im.getItemHandler(),
        tok = null;

        var qrcode = new QRCode(document.getElementById("qrcode"), {
	        text: "",
	        width: 250,
	        height: 250,
	        colorDark : "#000000",
	        colorLight : "#ffffff"
            });

        itemHandler.setValue = function(v) {
            qrcode.clear();
            qrcode.makeCode(v);
        };
        
        tok = im.subscribeItem( "virtual:sQrText", itemHandler);

        /* called when this local-script is disabled */
        self.onDisable = function () {
            self.run = false; /* from original .onDisable function of LocalScript control */
            im.unsubscribeItem(tok);
        };
    };


    // MODULE CODE - END

    fLog("module loaded");
})();