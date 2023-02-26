import {sleep} from "./util/utils.js";
import {createLogger} from "./util/logger.js";
import pg from 'pg';

const Pool = pg.Pool;
import PQueue from "p-queue";
import Scraper from "./scraper.js";
import {readFileSync} from 'fs'
import {ScraperConfig} from "./types/configs.js";

const configFile = new URL('../config.json', import.meta.url);
const config: ScraperConfig = JSON.parse(readFileSync(configFile, 'utf-8'))

const logger = createLogger('NFTScraper main');

const queueConcurrency = config.queueConcurrency || 16;
const queue = new PQueue({concurrency: queueConcurrency});

const pool = new Pool({
        database: config.dbName,
        user: config.dbUser,
        password: config.dbPass,
        host: config.dbHost,
        port: config.dbPort,
    })

const query = `SELECT *
                   FROM nfts
                   WHERE (image_cache = '') IS TRUE
                     AND metadata IS NOT NULL
                     AND metadata::text != '"___INVALID_METADATA___"'::text
                   ORDER BY scrub_last ASC NULLS FIRST
                   LIMIT ${config.querySize || 50} OFFSET 50`;

const fillQueue = async () => {
        const {rows} = await pool.query<NFT>(query);
        for (const row of rows) {
            try {
                logger.info(`Scraping ${row.contract}:${row.token_id}`)
                // TODO: Ensure that new NFTs will have last_scrub as NULL and set higher priority for those
                queue.add(async () => {
                    const scraper = new Scraper(pool, row, config);
                    await scraper.scrapeAndResize();
                })
                logger.info(`Scraping ${row.contract}:${row.token_id} complete`)
            } catch (e) {
                logger.error(`Exception while scraping NFT: ${JSON.stringify(row, null, 4)}`)
            }
        }
    }

;(async () => {
    logger.info("Starting scraper...");
    while (true) {
        await fillQueue();
        await sleep(5000);
        await queue.onSizeLessThan(queueConcurrency)
    }
})().catch((e) => {
    logger.error(`Error while running scraper: ${e.message}`);
})

