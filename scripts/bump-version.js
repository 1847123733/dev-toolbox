const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function getLatestTag() {
  try {
    const output = execSync('git tag --list "v*" --sort=-v:refname', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
    if (!output) return 'v0.0.0'
    return output.split(/\r?\n/)[0].trim()
  } catch {
    return 'v0.0.0'
  }
}

function parseVersion(tag) {
  const raw = tag.startsWith('v') ? tag.slice(1) : tag
  const parts = raw.split('.')
  if (parts.length !== 3) {
    throw new Error(`Invalid tag format: ${tag}`)
  }
  const [major, minor, patch] = parts.map((part) => Number(part))
  if ([major, minor, patch].some((num) => !Number.isInteger(num) || num < 0)) {
    throw new Error(`Invalid tag numbers: ${tag}`)
  }
  return { major, minor, patch }
}

function bumpVersion(version) {
  // 规则：
  // 1. patch >= 10 且 minor >= 9 时，升级 major 并重置 minor 和 patch
  //    例如：0.9.10 → 1.0.0，1.9.10 → 2.0.0
  // 2. patch >= 10 时，升级 minor 并重置 patch 为 1
  //    例如：0.2.10 → 0.3.1，0.3.10 → 0.4.1
  // 3. 否则正常升级 patch
  if (version.patch >= 10 && version.minor >= 9) {
    return `${version.major + 1}.0.0`
  }
  if (version.patch >= 10) {
    return `${version.major}.${version.minor + 1}.1`
  }
  return `${version.major}.${version.minor}.${version.patch + 1}`
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

const latestTag = getLatestTag()
const version = parseVersion(latestTag)
const nextVersion = bumpVersion(version)

const packageJsonPath = path.join(process.cwd(), 'package.json')
const packageLockPath = path.join(process.cwd(), 'package-lock.json')

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
packageJson.version = nextVersion
writeJson(packageJsonPath, packageJson)

if (fs.existsSync(packageLockPath)) {
  const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'))
  packageLock.version = nextVersion
  if (packageLock.packages && packageLock.packages['']) {
    packageLock.packages[''].version = nextVersion
  }
  writeJson(packageLockPath, packageLock)
}

console.log(`Bumped version from ${latestTag} to v${nextVersion}`)
