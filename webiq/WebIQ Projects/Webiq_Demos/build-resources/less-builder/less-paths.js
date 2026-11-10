const path = require("path");

//less source paths for system/custom themes and controls
const paths = {
    themes: {
        system: ['less', 'system', 'themes'].join(path.sep),
        custom: ['less', 'custom', 'themes'].join(path.sep)
    },
    controls: {
        system: ['less', 'system', 'controls'].join(path.sep),
        custom: ['less', 'custom', 'controls'].join(path.sep)
    }
};

exports.paths = paths;
