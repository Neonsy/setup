import assert from 'node:assert/strict'
import test from 'node:test'
import { getCacheKeyPrefix, getPrimaryCacheKey } from './keys.ts'

test('moving runtime selectors use the resolved version in the primary key', () => {
  const prefix = getCacheKeyPrefix('Linux', 'x64', [{ name: 'node', version: 'lts' }])
  const previousKey = getPrimaryCacheKey(prefix, 'lockfile-hash', [{ name: 'node', version: '22.22.0' }])
  const currentKey = getPrimaryCacheKey(prefix, 'lockfile-hash', [{ name: 'node', version: '24.13.0' }])

  assert.notEqual(previousKey, currentKey)
  assert.ok(previousKey.startsWith(prefix))
  assert.ok(currentKey.startsWith(prefix))
})

test('the provisional restore key is never a key a runtime run saves under', () => {
  const prefix = getCacheKeyPrefix('Linux', 'x64', [{ name: 'node', version: '24.19.0' }])
  const provisional = getPrimaryCacheKey(prefix, 'lockfile-hash')
  const final = getPrimaryCacheKey(prefix, 'lockfile-hash', [{ name: 'node', version: '24.19.0' }])

  // An exact hit on the provisional key would stop the restore falling back
  // to the prefix search that finds the versioned caches.
  assert.notEqual(provisional, final)
})

test('without a runtime the provisional key is the final key', () => {
  const prefix = getCacheKeyPrefix('Linux', 'x64', [])

  assert.equal(getPrimaryCacheKey(prefix, 'lockfile-hash'), getPrimaryCacheKey(prefix, 'lockfile-hash', []))
})

test('every requested runtime contributes to the key prefix', () => {
  const single = getCacheKeyPrefix('Linux', 'x64', [{ name: 'node', version: '24' }])
  const both = getCacheKeyPrefix('Linux', 'x64', [
    { name: 'node', version: '24' },
    { name: 'bun', version: '1.3.13' },
  ])

  assert.notEqual(single, both)
})

test('declaration order does not change the key', () => {
  const nodeFirst = getCacheKeyPrefix('Linux', 'x64', [
    { name: 'node', version: '24' },
    { name: 'bun', version: '1.3.13' },
  ])
  const bunFirst = getCacheKeyPrefix('Linux', 'x64', [
    { name: 'bun', version: '1.3.13' },
    { name: 'node', version: '24' },
  ])

  // The same set of runtimes produces the same store, so it should share a cache.
  assert.equal(nodeFirst, bunFirst)
})

test('a version change in any runtime changes the primary key', () => {
  const prefix = getCacheKeyPrefix('Linux', 'x64', [
    { name: 'node', version: 'lts' },
    { name: 'bun', version: 'latest' },
  ])
  const before = getPrimaryCacheKey(prefix, 'lockfile-hash', [
    { name: 'node', version: '24.19.0' },
    { name: 'bun', version: '1.3.13' },
  ])
  const after = getPrimaryCacheKey(prefix, 'lockfile-hash', [
    { name: 'node', version: '24.19.0' },
    { name: 'bun', version: '1.3.14' },
  ])

  assert.notEqual(before, after)
})
