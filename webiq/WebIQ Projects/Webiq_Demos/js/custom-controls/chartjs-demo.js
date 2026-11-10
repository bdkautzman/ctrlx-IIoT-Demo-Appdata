/**
 * Chartjs Demo
 *
 * Configuration options (default):
 *
 * {
 *     "class-name": "chartjs-demo",
 *     "name": null,
 *     "template": "custom/chartjs-demo",
 *     "items": ["DRandBool2", "DSaw1", "DSaw2", "SInt", "DSin1"],
 *     "tension": 0,
 *     "chartType": "polarArea",
 *     "chartTitle": "Data",
 *     "chartLabelY": "",
 * }
 *
 * Explanation of configuration options:
 *
 * class-name {string}: Sets default css class applied on control root element
 * name {string}: Name of control set to data-name attribute
 * template {string}: Path to template file
 * items {Array}: Displayed Items from Connect-Items
 * tension {Number}: Amount of Interpolation on Line-chart (0 to 1)
 * chartType {string}: Type of displayed chart (bar, pie, polarArea, doughnut (, line, radar))
 * chartTitle {string}: Title of chart
 * chartLabelY {string}: Axis label if bar or line chart selected
 */
(function() {
    'use strict';

    //variables for reference in control definition
    let className = "ChartjsDemo", //control name in camel-case
        uiType = "chartjs-demo", //control keyword (data-ui)
        isContainer = false;

    //example - default configuration
    let defConfig = {
        "class-name": uiType,
        "name": null,
        "template": "custom/controls/chartjs-demo",
        "label": uiType,
        "items": ["DRandBool", "DSaw", "SInt", "DSin"],
        "tension": 0,
        "chartType": "polarArea", // bar, pie, polarArea, doughnut (, line, radar)
        "chartTitle": "Data",
        "chartLabelY": ""
    };

    // Setup module-logger
    let ENABLE_LOGGING = true,
        RECORD_LOG = false,
        logger = shmi.requires("visuals.tools.logging").createLogger(uiType, ENABLE_LOGGING, RECORD_LOG),
        log = logger.log;

    //declare private functions - START

    /**
     * update diagram by resetting chart data with item values and use Chart.js .update()-function
     * @param {object} self
     */
    function updateDiagram(self) {
        var data = [];
        self.config.items.forEach(function(item) {
            data.push(self.vars.chartData[item]);
        });
        self.vars.currentChart.data.datasets[0].data = data;
        self.vars.currentChart.update();
    }

    /**
     * Fetches all item info - this is req'd here as we need to know all labels before being able to initialize the chart (as we cannot update labels without recreating the chart)
     *
     * @param self
     * @param callback
     */
    function fetchItemInfo(self, callback) {
        var im = shmi.requires("visuals.session.ItemManager"),
            tsk = shmi.requires("visuals.task"),
            tasks = [],
            items = {},
            count = 0,
            tl = null;

        self.vars.templateItems.forEach(function(itm) {
            var t = tsk.createTask("fetch item data");
            t.run = function run() {
                var tok = null,
                    propertiesSet = false,
                    h = im.getItemHandler();
                h.setLabel = function setLabel(label) {
                    // called 1st, ...
                    itm.label = label;
                };
                h.setUnitText = function setUnitText(unitText) {
                    // called 2nd, ...
                    itm.unit = unitText;
                };
                h.setProperties = function setProperties(min, max, step, name, type) {
                    var item = im.getItem(itm.name);
                    if (type !== null && !propertiesSet) { //when type is `null`, the subscription request has not yet been answered
                        // called 3rd during item subscription
                        if (item) {
                            itm.adapter = item.adapter;
                            itm.unitClass = item.unitClass;
                            itm.type = item.type;
                            itm.digits = item.digits;
                            itm.write = item.writable;
                            itm.min = item.min;
                            itm.max = item.max;
                            itm.read = item.initialized && item.type !== -1;
                            if (!item.initialized) itm.error = true;
                        }
                        propertiesSet = true;
                        shmi.decouple(function() {
                            if (tok) {
                                tok.unlisten();
                                tok = null;
                                if (item.initialized) {
                                    delete items[itm.name];
                                    count--;
                                }
                                t.complete();
                            }
                        });
                    }
                };
                tok = im.subscribeItem(itm.name, h);
            };
            tasks.push(t);
            items[itm.name] = true;
            count++; // Counting subscribed items
        });
        if (tasks.length > 0) {
            tl = tsk.createTaskList(tasks, false);
            tl.onComplete = function() {
                if (count) {
                    console.error("Missing items:");
                    for (let key in items) {
                        console.error(key);
                    }
                }
                callback(null);
            }.bind(null, null);
            tl.run();
        } else {
            callback(null);
        }
    }

    //declare private functions - END

    //definition of new control extending BaseControl - START
    var definition = {
        className: className,
        uiType: uiType,
        isContainer: isContainer,
        /* default configuration settings - all available options have to be initialized! */
        config: defConfig,
        /* schema of configuration object for validation according to json-schema v4
         * (http://json-schema.org/draft-04/schema#)
         */
        configSchema: null,
        /* instance variables */
        vars: {
            subscriptionIds: {},
            chartData: {},
            chartLabels: [],
            chartInitialized: false,
            canvasElement: null,
            chartConfig: {},
            currentChart: null,
            enabled: false,
            chartBackgroundColor: [
                'rgba(255,99,132,1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)'
            ],
            enableTimer: null,
            maxY: null
        },

        /* imports added at runtime */
        imports: {
            im: "visuals.session.ItemManager",
            dgm: "visuals.session.DataGridManager"
        },

        /* functions to extend or override the BaseControl prototype */
        prototypeExtensions: {

            /* called when config-file (optional) is loaded and template (optional) is inserted into base element */
            onInit: function() {
                var self = this;
                // Check if external library is included, depending on the used library
                if (!Chart) { // eslint-disable-line no-undef
                    log('Chart.js library is missing');
                    return;
                }

                // Get HTML element by 'data-ui'-tag
                self.vars.canvasElement = shmi.getUiElement('chart-canvas', self.element);

                // Check if canvas element is available
                if (!self.vars.canvasElement) {
                    log('Canvas Element is missing');
                    return;
                }

                self.vars.templateItems = [];
                for (let i = 0; i < self.config.items.length; i++) {
                    self.vars.templateItems.push({ name: self.config.items[i] });
                }
            },

            initChart: function() {
                var self = this;
                // internal function of ChartJS to generate a chart
                self.vars.currentChart = new Chart(self.vars.canvasElement, self.vars.chartConfig); // eslint-disable-line no-undef

                // subscribe all items for data
                self.config.items.forEach(function(item) {
                    var itemHandler = self.imports.im.getItemHandler();
                    itemHandler.setValue = function(value, type, name) {
                        if (self.vars.chartInitialized) {
                            self.vars.chartData[name] = value;
                            updateDiagram(self);
                        }
                    };
                    self.vars.subscriptionIds[item] = self.imports.im.subscribeItem(item, itemHandler);
                });
            },

            initChart2: function() {
                const self = this;

                self.vars.chartLabels = [];
                fetchItemInfo(self, function(data3) {
                    self.vars.templateItems.forEach(function(item) {
                        if (item.label) {
                            self.vars.chartLabels.push(shmi.localize(item.label));
                        } else {
                            self.vars.chartLabels.push(item.name);
                        }
                    });

                    // Chart.js config for the chart to be created (editable as wished)
                    self.vars.chartConfig = {
                        type: self.config.chartType,
                        data: {
                            labels: self.vars.chartLabels,
                            datasets: [{
                                data: data3,
                                backgroundColor: self.vars.chartBackgroundColor,
                                label: ""
                            }]
                        },

                        options: {
                            plugins: {
                                title: {
                                    display: !!self.config.chartTitle,
                                    text: self.config.chartTitle === null ? '' : shmi.localize(self.config.chartTitle)
                                },
                                legend: {
                                    display: self.config.chartType !== "bar" && self.config.chartType !== "line" // Do not show "legend" which is this case only shows information on the dataset!
                                }
                            },
                            maintainAspectRatio: false,
                            tooltips: {
                                callbacks: {
                                    label: function(tooltipItem, data2) {
                                        const itm = self.vars.templateItems[tooltipItem.index],
                                            realValue = data2.datasets[tooltipItem.datasetIndex].data[tooltipItem.index],
                                            customValue = realValue.toFixed(itm.digits).toString() + (itm.unit ? itm.unit : ''),
                                            label = shmi.localize(data2.labels[tooltipItem.index]) + ':';
                                        return label + customValue;
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    ticks: {
                                        min: 0
                                    }
                                }
                            },

                            // Disable tooltips
                            hover: {
                                mode: false
                            },
                            events: []
                        }
                    };

                    // additional config for bar- and line-chart
                    if (self.config.chartType === "bar" || self.config.chartType === "line") {
                        self.vars.chartConfig.options.scales = {
                            y: {
                                title: {
                                    text: self.config.chartLabelY === null ? '' : shmi.localize(self.config.chartLabelY),
                                    display: !!self.config.chartLabelY
                                },
                                ticks: {
                                    beginAtZero: true,
                                    min: 0
                                }
                            }
                        };
                    }

                    if (self.vars.maxY && self.vars.chartConfig.options.scales && self.vars.chartConfig.options.scales.y) {
                        self.vars.chartConfig.options.scales.y.max = self.vars.maxY;
                        self.vars.chartConfig.options.scales.y.ticks.max = self.vars.maxY;
                    }

                    if (self.config.chartType === "radar" || self.config.chartType === "line") {
                        self.vars.chartConfig.options.elements = {
                            line: {
                                tension: self.config.tension
                            }
                        };
                    }

                    self.vars.chartInitialized = true;
                });
            },

            setupChart: function() {
                let self = this;

                // Read the Y axis max value only once from the item
                if (self.config.maxyitem) {
                    self.imports.im.readDirect([self.config.maxyitem], function(status, data) {
                        if (typeof data !== 'undefined') {
                            self.vars.maxY = data[self.config.maxyitem];
                        } else {
                            console.error('Unable to read item "' + self.config.maxyitem + '", reverting to auto Y axis');
                        }

                        self.initChart2();
                    });
                } else {
                    self.initChart2();
                }
            },

            /* called when control is enabled */
            onEnable: function() {
                var self = this;
                self.vars.enabled = true;

                self.setupChart();

                // Wait for it to be initialized
                if (self.vars.chartInitialized) {
                    self.initChart();
                } else {
                    self.vars.enableTimer = window.setInterval(function() {
                        if (self.vars.chartInitialized) {
                            clearInterval(self.vars.enableTimer);
                            self.initChart();
                        }
                    }, 100);
                }
            },

            /* called when control is disabled */
            onDisable: function() {
                var self = this;
                if (self.vars.enableTimer) {
                    clearInterval(self.vars.enableTimer);
                }

                self.vars.enabled = false;

                // delete Chart for disabling all connected listeners of ChartJS
                if (self.vars.currentChart) {
                    self.vars.currentChart.destroy();
                }

                // unsubscribe items
                let keys = Object.keys(self.vars.subscriptionIds);
                if (keys.length !== 0) {
                    keys.forEach(function(id) {
                        self.vars.subscriptionIds[id].unlisten();
                    });
                    self.vars.subscriptionIds = {};
                }

                self.vars.chartInitialized = false;
            },

            /* called when control is locked - disable mouse- and touch-listeners */
            onLock: function() {

            },

            /* called when control is unlocked - enable mouse- and touch-listeners */
            onUnlock: function() {

            },

            /* called by ItemManager when subscribed item changes and once on initial subscription */
            onSetValue: function(value, type, name) {

            },

            /** Sets min & max values and stepping of subscribed variable **/
            onSetProperties: function(min, max, step) {

            }
        }
    };

    //definition of new control extending BaseControl - END

    //generate control constructor & prototype using the control-generator tool
    var cg = shmi.requires("visuals.tools.control-generator");
    cg.generate(definition);
})();
