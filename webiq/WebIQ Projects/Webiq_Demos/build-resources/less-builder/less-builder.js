const constants = require("./builder-constants");
const states = constants.workerStates;
const LOG_WORKER_MESSAGES = constants.LOG_WORKER_MESSAGES;
const logger = require("./logger").getLogger("less-builder", true);

/**
 * create new worker task
 *
 * @param {object} builderState builder state
 * @param {object} options task options
 * @param {function} resolve resolve function
 * @param {function} reject reject function
 * @returns {object} worker task
 */
function createTask(builderState, options, resolve, reject) {
    let id = 0;

    while (builderState.tasks[id] !== undefined) {
        id += 1;
    }

    const task = builderState.tasks[id] = {
        id: id,
        options: options,
        worker: null,
        running: false,
        resolve: resolve,
        reject: reject
    };

    builderState.queue.push(task);
    checkQueue(builderState);
    return task;
}

/**
 * queue task for execution
 *
 * @param {object} builderState builder state
 * @returns {boolean} `true` if task could be sent to free worker, `false` else
 */
function queueTask(builderState) {
    const task = builderState.queue[0],
        freeWorker = builderState.workerRefs.find((ref) => ref.state === states.READY);

    if (freeWorker) {
        freeWorker.state = states.ASSIGNED;
        task.worker = freeWorker;
        task.running = true;
        builderState.queue.shift();
        freeWorker.worker.send({
            cmd: task.options.cmd,
            id: task.id,
            data: task.options.data
        });
        return true;
    }

    return false;
}

/**
 * run decoupled check for queued tasks
 *
 * @param {object} builderState builder state
 */
function checkQueue(builderState) {
    clearImmediate(builderState.immediateId);
    builderState.immediateId = setImmediate(() => {
        queueTasks(builderState);
    });
}

/**
 * queue tasks while free workers exist
 *
 * @param {object} builderState builder state
 */
function queueTasks(builderState) {
    while (builderState.queue.length > 0 && queueTask(builderState)) {
        /* queue tasks while available workers exist */
    }
}

/**
 * handler for messages from workers
 *
 * @param {object} builderState builder state
 * @param {object} worker worker reference
 * @param {object} message received message
 */
function handleWorkerMessage(builderState, worker, message) {
    if (LOG_WORKER_MESSAGES) {
        logger.log(`[worker:${worker.id}] -> [master] - ${JSON.stringify(message).substr(0, 79)}`);
    }

    if (message && typeof message === "object" && message.cmd) {
        let task = null;
        switch (message.cmd) {
        case "state":
            updateWorkerState(builderState, worker, message.data);
            break;
        case "result":
            task = builderState.tasks[message.id];
            if (task) {
                if (task.err) {
                    task.reject(task.err);
                } else {
                    task.resolve(message.data);
                }
                delete builderState.tasks[task.id];
                task.resolve = null;
                task.reject = null;
                task.options = null;
                task.worker = null;
            } else {
                throw new Error("invalid task id on result: " + message.id);
            }
            break;
        default:
        }
    }
}

/**
 * get state of worker by id
 *
 * @param {object} builderState builder state
 * @param {number} workerId worker id
 * @returns {object|null} state of worker
 */
function getWorkerState(builderState, workerId) {
    return builderState.workerRefs.find((workerRef) => workerRef.worker.id === workerId) || null;
}

/**
 * update worker state
 *
 * @param {object} builderState builder state
 * @param {object} worker worker reference
 * @param {object} data state data
 */
function updateWorkerState(builderState, worker, data) {
    const state = getWorkerState(builderState, worker.id);

    if (state) {
        const oldState = state.state;
        state.state = data.state;

        if (state.state !== oldState && state.state === states.READY) {
            checkQueue(builderState);
        }
    }
}

/**
 * create runTask function for builder reference
 *
 * @param {object} builderState builder state
 * @returns {function} runTask function
 */
function getRunTask(builderState) {
    return (options) => new Promise((resolve, reject) => {
        createTask(builderState, options, resolve, reject);
    });
}

/**
 * less-builder to create CSS stylesheets from LESS sources
 * @type LessBuilder
 * @property {function} runTask queue tasks for execution
 * @property {function} destroy cleanup less-builder after use
 * @property {object} logger logger reference to retrieve logs from build tasks
 */

/**
 * create new less-builder
 *
 * @param {object} [options] builder options
 * @param {number} [options.worker_count] number of workers to spawn
 * @param {string} [options.basePath] base path for LESS sources
 * @param {string} [workerPath] path to worker source
 * @returns {LessBuilder} less-builder reference
 */
exports.getBuilder = (options, workerPath) => {
    const cluster = require('cluster'),
        builderState = {
            workerRefs: [],
            tasks: {},
            queue: [],
            immediateId: 0,
            destroy: null,
            runTask: null,
            logger: logger
        };

    logger.clear();

    let numWorkers = require('os').cpus().length;

    cluster.setupMaster({
        exec: workerPath || './build-resources/less-builder/cluster-worker.js',
        args: [],
        silent: false
    });

    if (options && typeof options === "object" && typeof options.worker_count === "number") {
        numWorkers = Math.max(1, options.worker_count);
    }

    logger.log(`* setup build with ${numWorkers} workers`);

    // init cluster
    for (let i = 0; i < numWorkers; i++) {
        builderState.workerRefs.push({
            worker: cluster.fork(),
            state: states.INITIALIZING
        });
    }

    // add eventlisteners
    builderState.workerRefs.forEach((state, idx) => {
        state.worker.on('message', (message) => handleWorkerMessage(builderState, state.worker, message));
        if (options && typeof options.basePath === "string") {
            state.worker.send({
                cmd: "base-path",
                data: options.basePath
            });
        }
    });

    //add runTask function to queue tasks
    builderState.runTask = getRunTask(builderState);

    //add destroy function for cleanup
    builderState.destroy = () => {
        builderState.workerRefs.forEach((ref) => {
            ref.worker.disconnect();
        });
        builderState.workerRefs = [];
    };

    builderState.setSupportedBrowsers = (supportedBrowsers) => {
        if (Array.isArray(supportedBrowsers)) {
            builderState.workerRefs.forEach((state, idx) => {
                state.worker.send({
                    cmd: "supported-browsers",
                    data: supportedBrowsers
                });
            });
        }
    };

    logger.log(`* base path: ${options && typeof options.basePath === "string" ? options.basePath : process.cwd()}`);

    return builderState;
};