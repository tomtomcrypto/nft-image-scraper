export interface ScraperConfig {
    dbHost: string
    dbPort: number
    dbName: string
    dbUser: string
    dbPass: string
    ipfsGateway: string
    querySize: number
    queueConcurrency: number
    rootDir: string
    rootUrl: string
}
