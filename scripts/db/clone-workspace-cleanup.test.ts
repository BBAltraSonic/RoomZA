import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { removeRunWorkspaces } from './clone-workspace-cleanup.mjs'

const TAG = 'pinpoint-release-0123abcd-4567-89ab-cdef-0123456789ab'
const OTHER_TAG = 'pinpoint-release-ffffffff-4567-89ab-cdef-0123456789ab'

describe('removeRunWorkspaces', () => {
  let root: string
  let sharedModules: string

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'clone-cleanup-test-'))
    mkdirSync(path.join(root, '.cache'))
    // Stands in for the checkout's real node_modules that each app copy links to.
    sharedModules = path.join(root, 'node_modules')
    mkdirSync(path.join(sharedModules, 'next'), { recursive: true })
    writeFileSync(path.join(sharedModules, 'next', 'package.json'), '{"name":"next"}')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function makeAppCopy(name: string) {
    const appRoot = path.join(root, '.cache', name)
    mkdirSync(path.join(appRoot, 'src'), { recursive: true })
    writeFileSync(path.join(appRoot, 'src', 'page.tsx'), 'export default null')
    symlinkSync(sharedModules, path.join(appRoot, 'node_modules'), 'junction')
    return appRoot
  }

  it('should_remove_every_cache_folder_created_for_the_run', () => {
    const first = makeAppCopy(`${TAG}-db-app`)
    const second = makeAppCopy(`${TAG}-db-messaging-browser-app`)

    const removed = removeRunWorkspaces(root, TAG)

    expect(existsSync(first)).toBe(false)
    expect(existsSync(second)).toBe(false)
    expect(removed.sort()).toEqual([`${TAG}-db-app`, `${TAG}-db-messaging-browser-app`])
  })

  it('should_leave_linked_node_modules_untouched', () => {
    makeAppCopy(`${TAG}-db-app`)

    removeRunWorkspaces(root, TAG)

    expect(readFileSync(path.join(sharedModules, 'next', 'package.json'), 'utf8')).toBe('{"name":"next"}')
  })

  it('should_keep_folders_from_other_runs_and_unrelated_cache_data', () => {
    const otherRun = makeAppCopy(`${OTHER_TAG}-db-app`)
    const kept = path.join(root, '.cache', 'national-places')
    mkdirSync(kept)
    const evidence = path.join(root, '.cache', `${TAG}.json`)
    writeFileSync(evidence, '{}')

    removeRunWorkspaces(root, TAG)

    expect(existsSync(otherRun)).toBe(true)
    expect(existsSync(kept)).toBe(true)
    expect(existsSync(evidence)).toBe(true)
  })

  it('should_return_nothing_when_the_run_made_no_folders', () => {
    expect(removeRunWorkspaces(root, TAG)).toEqual([])
  })

  it('should_return_nothing_when_there_is_no_cache_folder', () => {
    rmSync(path.join(root, '.cache'), { recursive: true })

    expect(removeRunWorkspaces(root, TAG)).toEqual([])
  })

  it.each(['', 'pinpoint-release', 'pinpoint-release-', '../pinpoint-release-0123abcd-4567-89ab-cdef-0123456789ab', 'node_modules'])(
    'should_throw_when_the_run_tag_is_not_a_clone_tag: %j',
    (tag) => {
      expect(() => removeRunWorkspaces(root, tag)).toThrow(/run tag/)
    },
  )
})
