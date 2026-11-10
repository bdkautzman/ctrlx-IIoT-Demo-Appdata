exports.workerStates = {
    INITIALIZING: 0,
    READY: 1,
    ASSIGNED: 2,
    BUSY: 3,
    ERROR: 4,
    TERMINATING: 5
};
exports.LOG_WORKER_MESSAGES = false; //log messages from workers to master
exports.LOG_MASTER_MESSAGES = false; //log messages from master to workers