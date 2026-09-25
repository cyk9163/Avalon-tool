import test from "node:test";
import assert from "node:assert/strict";
import { isSoloHost, soloDeviceOverride } from "../lib/solo.ts";

test("solo hosts are only the local machine or a private LAN address", () => {
  assert.equal(isSoloHost("localhost"), true);
  assert.equal(isSoloHost("127.0.0.1"), true);
  assert.equal(isSoloHost("s1.localhost"), true);
  assert.equal(isSoloHost("s10.localhost"), true);
  assert.equal(isSoloHost("192.168.1.20"), true);
  assert.equal(isSoloHost("10.0.0.8"), true);
  assert.equal(isSoloHost("172.16.0.4"), true);
  assert.equal(isSoloHost("172.31.255.255"), true);
  assert.equal(isSoloHost("172.32.0.1"), false);
  assert.equal(isSoloHost("8.8.8.8"), false);
  assert.equal(isSoloHost("avalon-roundtable.yunkangchen2017.workers.dev"), false);
  assert.equal(isSoloHost("evil.localhost.example.com"), false);
  assert.equal(isSoloHost("localhost.attacker.com"), false);
});

test("a solo device header is ignored away from the local machine", () => {
  const device = "ab".repeat(32);
  const local = new Request("http://127.0.0.1:5173/api/room", { headers: { "x-avalon-solo": device } });
  const remote = new Request("https://avalon-roundtable.yunkangchen2017.workers.dev/api/room", { headers: { "x-avalon-solo": device } });
  const bad = new Request("http://127.0.0.1:5173/api/room", { headers: { "x-avalon-solo": "not-a-device" } });
  const lan = new Request("http://192.168.1.20:5173/api/room", { headers: { "x-avalon-solo": device } });
  const publicAddress = new Request("http://8.8.8.8:5173/api/room", { headers: { "x-avalon-solo": device } });
  assert.equal(soloDeviceOverride(local), device);
  assert.equal(soloDeviceOverride(lan), device);
  assert.equal(soloDeviceOverride(publicAddress), null);
  assert.equal(soloDeviceOverride(remote), null);
  assert.equal(soloDeviceOverride(bad), null);
});
