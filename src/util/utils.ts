import {createLogger} from "./logger.js";

const logger = createLogger('utils.ts')

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}
