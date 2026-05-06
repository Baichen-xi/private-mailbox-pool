import { pbkdf2Sync, randomBytes } from "node:crypto";

function main() {
  const password = process.argv[2];

  if (!password) {
    console.error("Usage: npm run hash:password -- \"your-password\"");
    process.exit(1);
  }

  const iterations = 100000;
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const serialized = [
    "pbkdf2_sha256",
    iterations,
    salt.toString("base64"),
    hash.toString("base64")
  ].join("$");

  console.log(serialized);
}

main();
