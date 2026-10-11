import test from "node:test";
import assert from "node:assert/strict";
import {classifyBearer,canPerform} from "../src/access.ts";
const owner="o".repeat(64),ai="a".repeat(64);
test("assistant can only read and draft",()=>{
 const role=classifyBearer("Bearer "+ai,owner,ai);
 assert.equal(role,"assistant");
 assert.equal(canPerform(role,"read"),true);
 assert.equal(canPerform(role,"draft"),true);
 assert.equal(canPerform(role,"approve"),false);
 assert.equal(canPerform(role,"send"),false);
});
test("owner alone can authorize sends",()=>{
 const role=classifyBearer("Bearer "+owner,owner,ai);
 assert.equal(role,"owner");
 assert.equal(canPerform(role,"approve"),true);
 assert.equal(canPerform(role,"send"),true);
});
test("empty, unknown, and reused assistant credentials fail closed",()=>{
 assert.equal(classifyBearer(undefined,owner,ai),"none");
 assert.equal(classifyBearer("Bearer unknown",owner,ai),"none");
 assert.equal(classifyBearer("Bearer "+ai,owner,owner),"none");
 assert.equal(classifyBearer("Bearer "+owner,owner,owner),"none");
 assert.equal(canPerform("none","read"),false);
});
