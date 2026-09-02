import { getEnv } from '../../config/env.js'

export function getBoardsConfig() {
  const env = getEnv()
  return {
    containerFolderId: env.boardsContainerFolderId,
    sessionSecret: env.boardsSessionSecret,
  }
}

export function boardsFeatureConfigured(): boolean {
  const { containerFolderId, sessionSecret } = getBoardsConfig()
  return Boolean(containerFolderId && sessionSecret)
}
