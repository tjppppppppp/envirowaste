import test from "node:test"; import assert from "node:assert";
import { gateTotalWeight, gateAttribution, gateTrend, gateCount } from "./quality.ts";
const full = { n: 100, withWeight: 100, withDate: 100, attributed: 80, demo: false, historical: 0, weeks: 12 };
test("complete", () => { assert.equal(gateTotalWeight(full).basis, "recorded"); assert.equal(gateTrend(full).ok, true); });
test("missing", () => { assert.equal(gateTotalWeight({ ...full, withWeight: 10 }).ok, false); assert.equal(gateTotalWeight({ ...full, n: 0, withWeight: 0, withDate: 0 }).ok, false); assert.equal(gateCount({ ...full, n: 0 }).ok, false); assert.equal(gateTrend({ ...full, weeks: 3 }).ok, false); });
test("historical", () => { assert.equal(gateTotalWeight({ ...full, historical: 100 }).basis, "historical"); });
test("inferred and demo", () => { assert.equal(gateAttribution(full).basis, "inferred"); assert.equal(gateAttribution({ ...full, demo: true }).basis, "demo"); });
