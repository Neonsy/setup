import { setFailed, saveState, getState } from '@actions/core'
import restoreCache, { finalizeCache } from './cache-restore'
import saveCache from './cache-save'
import getInputs, { Inputs } from './inputs'
import installPnpm from './install-pnpm'
import {
  getInstalledRuntimeVersions,
  resolveRuntimeRequests,
  installRuntime,
  InstalledRuntime,
  keepInstalledRuntimesAuthoritative,
  logSkippedRuntime,
} from './install-runtime'
import setOutputs from './outputs'
import pnpmInstall from './pnpm-install'
import pruneStore from './pnpm-store-prune'

async function main() {
  if (getState('is_post') === 'true') {
    await runPost()
  } else {
    await runMain()
  }
}

async function runMain() {
  const inputs = getInputs()
  saveState('inputs', inputs)
  saveState('is_post', 'true')

  const result = await installPnpm(inputs)
  console.log('Installation Completed!')

  const requests = resolveRuntimeRequests(inputs)
  const restoredCache = await restoreCache(inputs, requests)

  const runtimes: InstalledRuntime[] = []
  for (const request of requests) {
    const runtime = await installRuntime(request, result.binDest)
    if (runtime === undefined) return
    runtimes.push(runtime)
  }
  if (runtimes.length > 0) {
    keepInstalledRuntimesAuthoritative(runtimes)
  } else {
    logSkippedRuntime()
  }

  // `pnpm runtime set` takes a selector, so `runtimes` holds what was asked
  // for — `node@lts`, `node@24`. Both the outputs and the cache key promise
  // the version that actually landed, so read it back once and use it for
  // both. Falling back to the selector also keeps the final cache key
  // distinct from the provisional key the restore probed with; that key must
  // never be written to, or later runs would match it exactly and stop
  // falling back to the prefix search that finds the versioned caches.
  const installedVersions = await getInstalledRuntimeVersions(
    runtimes.map(runtime => runtime.name),
    result.binDest,
  )
  const installed = runtimes.map(runtime => ({
    name: runtime.name,
    version: installedVersions.get(runtime.name) ?? runtime.version,
  }))

  if (restoredCache) {
    finalizeCache(restoredCache, installed)
  }

  setOutputs(inputs, result.binDest, installed)

  if (inputs.install) {
    pnpmInstall(inputs, runtimes.length > 0)
  }
}

async function runPost() {
  const inputs = JSON.parse(getState('inputs')) as Inputs
  pruneStore(inputs)
  await saveCache(inputs)
}

main().catch(error => {
  console.error(error)
  setFailed(error)
})
