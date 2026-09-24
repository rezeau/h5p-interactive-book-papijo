'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function matchesVersion(library, expected) {
  return library.machineName === expected.machineName &&
    library.majorVersion === expected.majorVersion &&
    library.minorVersion === expected.minorVersion &&
    (expected.patchVersion === undefined || library.patchVersion === expected.patchVersion);
}

function findLibrary(candidates, expected, requiredFiles = []) {
  return candidates.find((candidate) => {
    if (!candidate) {
      return false;
    }

    const files = ['library.json', ...requiredFiles];
    if (!files.every((file) => fs.existsSync(path.join(candidate, file)))) {
      return false;
    }

    try {
      const library = JSON.parse(fs.readFileSync(path.join(candidate, 'library.json'), 'utf8'));
      return matchesVersion(library, expected);
    }
    catch (error) {
      return false;
    }
  });
}

function materializeGitLibrary(candidates, revision, expected, requiredFiles = []) {
  for (const repository of candidates) {
    if (!repository || !fs.existsSync(path.join(repository, '.git'))) {
      continue;
    }

    try {
      const readGitFile = (file) => execFileSync(
        'git',
        ['-c', `safe.directory=${repository}`, '-C', repository, 'show', `${revision}:${file}`],
        { encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const library = JSON.parse(readGitFile('library.json').toString('utf8'));
      if (!matchesVersion(library, expected)) {
        continue;
      }

      const files = ['library.json', ...requiredFiles];
      const payload = new Map(files.map((file) => [file, readGitFile(file)]));
      const snapshotPath = fs.mkdtempSync(path.join(os.tmpdir(), 'h5p-historical-library-'));
      for (const [file, contents] of payload) {
        const destination = path.join(snapshotPath, file);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, contents);
      }

      return {
        path: snapshotPath,
        source: `${repository}@${revision}`,
        cleanup() {
          const resolvedSnapshot = path.resolve(snapshotPath);
          const tempPrefix = `${path.resolve(os.tmpdir())}${path.sep}`;
          if (!resolvedSnapshot.startsWith(tempPrefix)) {
            throw new Error(`Refusing to remove non-temporary library snapshot: ${resolvedSnapshot}`);
          }
          fs.rmSync(resolvedSnapshot, { force: true, recursive: true });
        },
      };
    }
    catch (error) {
      continue;
    }
  }

  return undefined;
}

module.exports = { findLibrary, materializeGitLibrary };
