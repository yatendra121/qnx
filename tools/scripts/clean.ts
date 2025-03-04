/**
 * This is a minimal script to publish your package to "npm".
 * This is meant to be used as-is or customize as you see fit.
 *
 * This script is executed on "dist/path/to/library" as "cwd" by default.
 *
 * You might need to authenticate with NPM before running this script.
 */

import { readCachedProjectGraph } from '@nx/devkit'
import { execSync } from 'child_process'
import { copyFileSync, readFileSync, writeFileSync } from 'fs'
import chalk from 'chalk'
import { resolve } from 'path'

import { rimrafSync } from 'rimraf'

function invariant(condition, message) {
    if (!condition) {
        console.error(chalk.bold.red(message))
        process.exit(1)
    }
}

// Executing publish script: node path/to/publish.ts {name} --version {version} --tag {tag}
// Default "tag" to "next" so we won't publish the "latest" tag by accident.
let [, , name, version, tag = 'latest'] = process.argv

if (version == 'affected') version = ''

// A simple SemVer validation to validate the version
const validVersion = /^\d+\.\d+\.\d+(-\w+\.\d+)?/
if (version)
    invariant(
        version && validVersion.test(version),
        `No version provided or version did not match Semantic Versioning, expected: #.#.#-tag.# or #.#.#, got ${version}.`
    )

const graph = readCachedProjectGraph()
const project = graph.nodes[name]

invariant(
    project,
    `Could not find project "${name}" in the workspace. Is the project.json configured correctly?`
)

const outputPath = project.data?.targets?.build?.options?.cwd
invariant(
    outputPath,
    `Could not find "build.options.outputPath" of project "${name}". Is project.json configured  correctly?`
)

process.chdir(outputPath)

console.log(outputPath + '/dist')

rimrafSync(outputPath + '/dist')
console.log(chalk.bold.green(`${name} package published with version ${version}`))
