"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceHost = void 0;
const logger_service_1 = require("./logger-service");
const database_service_1 = require("./database-service");
exports.serviceHost = {
    getLoggerService() {
        return logger_service_1.loggerService;
    },
    getDatabaseService() {
        return database_service_1.databaseService;
    },
};
//# sourceMappingURL=index.js.map