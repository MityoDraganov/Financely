"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProposal = void 0;
const app_1 = require("firebase-admin/app");
/**
 * Initialize Firebase app
 */
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
var create_proposal_1 = require("./functions/create-proposal");
Object.defineProperty(exports, "createProposal", { enumerable: true, get: function () { return create_proposal_1.createProposal; } });
//# sourceMappingURL=index.js.map