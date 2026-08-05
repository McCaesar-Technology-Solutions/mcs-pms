import { startAgent } from './run.js'

startAgent().catch((err) => {
  console.error(err)
  process.exit(1)
})
