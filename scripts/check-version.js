#!/usr/bin/env node
// Fails the build if package.json and package-lock.json disagree on the version.
// These drift when the version is bumped by hand instead of with `npm version`,
// because the lockfile's own version field only updates on an install.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));

const lockVersions = [lock.version, lock.packages && lock.packages[""] && lock.packages[""].version];
const mismatched = lockVersions.filter(v => v !== undefined && v !== pkg.version);

if (mismatched.length > 0) {
  console.error(
    `\nVersion mismatch:\n` +
    `  package.json       ${pkg.version}\n` +
    `  package-lock.json  ${lockVersions.join(", ")}\n\n` +
    `Fix with:  npm run sync-version\n` +
    `Avoid it by releasing with \`npm version patch|minor|major\`, which bumps both.\n`
  );
  process.exit(1);
}

console.log(`version ok: ${pkg.version}`);
