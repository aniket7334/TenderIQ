"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdapter = getAdapter;
exports.listAdapterTypes = listAdapterTypes;
const genericListingAdapter_1 = require("./genericListingAdapter");
const gemAdapter_1 = require("./gemAdapter");
const cpppAdapter_1 = require("./cpppAdapter");
const irepsAdapter_1 = require("./irepsAdapter");
const etendersAdapter_1 = require("./etendersAdapter");
const registry = new Map();
registry.set('generic', genericListingAdapter_1.GenericListingAdapter);
registry.set('gem', gemAdapter_1.GemAdapter);
registry.set('cppp', cpppAdapter_1.CpppAdapter);
registry.set('ireps', irepsAdapter_1.IrepsAdapter);
registry.set('etenders', etendersAdapter_1.EtendersAdapter);
function getAdapter(adapterType, baseUrl, config) {
    const Ctor = registry.get(adapterType) || genericListingAdapter_1.GenericListingAdapter;
    return new Ctor(baseUrl, config);
}
function listAdapterTypes() {
    return [...registry.keys()];
}
//# sourceMappingURL=index.js.map