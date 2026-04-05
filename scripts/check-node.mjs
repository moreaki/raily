const [majorString] = process.versions.node.split(".");
const major = Number(majorString);

if (!Number.isFinite(major)) {
  console.error("Unable to determine the current Node.js version.");
  process.exit(1);
}

if (major < 22 || major >= 25) {
  console.error(
    [
      `Unsupported Node.js version: ${process.versions.node}.`,
      "This project uses Yarn 4 Plug'n'Play and currently expects Node >=22 and <25.",
      "Please switch to Node 24.x, for example via `nvm use`.",
    ].join("\n"),
  );
  process.exit(1);
}
