function normalizeVersion(input) {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) throw new Error("Missing version");
  return trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;
}

function updateCargoToml(text, nextVersion) {
  const lines = text.split(/\r?\n/);
  let inPackage = false;
  let changed = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*\[package\]\s*$/.test(line)) {
      inPackage = true;
      continue;
    }
    if (inPackage && /^\s*\[/.test(line)) {
      inPackage = false;
    }
    if (inPackage && /^\s*version\s*=/.test(line)) {
      lines[i] = `version = "${nextVersion}"`;
      changed = true;
      break;
    }
  }

  if (!changed) throw new Error("Failed to update src-tauri/Cargo.toml package version");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

function updateCargoLock(text, nextVersion) {
  const lines = text.split(/\r?\n/);
  let inPackage = false;
  let isMarkup = false;
  let changed = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*\[\[package\]\]\s*$/.test(line)) {
      inPackage = true;
      isMarkup = false;
      continue;
    }
    if (inPackage && /^name\s*=\s*"markup"\s*$/.test(line)) {
      isMarkup = true;
      continue;
    }
    if (inPackage && isMarkup && /^version\s*=/.test(line)) {
      lines[i] = `version = "${nextVersion}"`;
      changed = true;
      break;
    }
    if (inPackage && line.trim() === "" && isMarkup) {
      inPackage = false;
      isMarkup = false;
    }
  }

  if (!changed) throw new Error("Failed to update src-tauri/Cargo.lock package version");
  return lines.join("\n") + "\n";
}

async function main() {
  const fs = await import("node:fs");
  const path = await import("node:path");

  function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  function writeJson(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
  }

  const root = path.resolve(__dirname, "..");
  const versionFilePath = path.join(root, "version.json");
  const versionJson = readJson(versionFilePath);
  const nextVersion = normalizeVersion(versionJson.version);

  const packageJsonPath = path.join(root, "package.json");
  const packageLockPath = path.join(root, "package-lock.json");
  const tauriConfPath = path.join(root, "src-tauri", "tauri.conf.json");
  const cargoTomlPath = path.join(root, "src-tauri", "Cargo.toml");
  const cargoLockPath = path.join(root, "src-tauri", "Cargo.lock");

  const packageJson = readJson(packageJsonPath);
  packageJson.version = nextVersion;
  writeJson(packageJsonPath, packageJson);

  const packageLock = readJson(packageLockPath);
  packageLock.version = nextVersion;
  if (packageLock.packages && packageLock.packages[""]) {
    packageLock.packages[""].version = nextVersion;
  }
  writeJson(packageLockPath, packageLock);

  const tauriConf = readJson(tauriConfPath);
  tauriConf.version = nextVersion;
  writeJson(tauriConfPath, tauriConf);

  const cargoTomlText = fs.readFileSync(cargoTomlPath, "utf8");
  fs.writeFileSync(cargoTomlPath, updateCargoToml(cargoTomlText, nextVersion), "utf8");

  const cargoLockText = fs.readFileSync(cargoLockPath, "utf8");
  fs.writeFileSync(cargoLockPath, updateCargoLock(cargoLockText, nextVersion), "utf8");

  process.stdout.write(`Synced version ${nextVersion}\n`);
}

main();
