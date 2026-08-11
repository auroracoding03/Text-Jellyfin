const path = require("node:path");

const serverRoot = path.resolve(process.argv[2] || process.cwd());
if (Number(process.versions.node.split(".")[0]) !== 24) {
  throw new Error(`Service runtime must be Node 24, received ${process.versions.node}.`);
}

const modulePath = require.resolve("better-sqlite3", { paths: [serverRoot] });
const Database = require(modulePath);
const database = new Database(":memory:");
database.exec("CREATE TABLE runtime_check (value TEXT NOT NULL)");
database.prepare("INSERT INTO runtime_check (value) VALUES (?)").run("ok");
const result = database.prepare("SELECT value FROM runtime_check").get();
database.close();

if (result.value !== "ok") throw new Error("better-sqlite3 runtime query failed.");
console.log(
  JSON.stringify({
    node: process.versions.node,
    modules: process.versions.modules,
    betterSqlite3: modulePath,
    status: "ok",
  }),
);
