import {Pool} from "pg";
import sharp from 'sharp';
import got from 'got';
import fs from "fs";
import {ScraperConfig} from "./types/configs.js";
import {createLogger} from "./util/logger.js";

const logger = createLogger('Scraper');

export default class Scraper {
    private readonly targetPath: string;
    private cacheUrl: string;

    constructor(private pool: Pool, private nft: NFT, private config: ScraperConfig) {
        this.targetPath = `${this.config.rootDir}/${this.nft.contract}/${this.nft.token_id}`
        this.cacheUrl = `${config.rootUrl}/${this.nft.contract}/${this.nft.token_id}`
    }

    async scrapeAndResize() {
        try {
            await this.scrapePromise();
            await this.updateRow();
        } catch (e: Error | any) {
            logger.error(`Failure scraping nft: ${this.nft.contract}:${this.nft.token_id}: ${e.message}`)
        }
    }

    private async updateRow() {
        const updateSql = `UPDATE nfts
                           SET image_cache = $1
                           WHERE contract = $2
                             AND token_id = $3`;
        const updateValues = [this.cacheUrl, this.nft.contract, this.nft.token_id];
        await this.pool.query(updateSql, updateValues);
    }

    private scrapePromise() {
        return new Promise((resolve, reject) => {
            let imageProperty: string = '';
            try {
                if (this.nft.metadata.image) {
                    imageProperty = this.nft.metadata.image.trim()
                } else {
                    logger.info(`No image found`);
                    return;
                }

                if (imageProperty.startsWith("ipfs://"))
                    imageProperty = imageProperty.replace("ipfs://", `${this.config.ipfsGateway}/`)

                logger.info(`Starting resize for ${imageProperty}`)
                if (!fs.existsSync(this.targetPath))
                    fs.mkdirSync(this.targetPath, {recursive: true});

                const promises = [];
                const sharpStream = sharp();

                promises.push(
                    sharpStream
                        .clone()
                        .resize({width: 280})
                        .jpeg()
                        .on('error', reject)
                        .toFile(`${this.targetPath}/280.jpeg`)
                )

                promises.push(
                    sharpStream
                        .clone()
                        .resize({width: 1440})
                        .jpeg()
                        .on('error', reject)
                        .toFile(`${this.targetPath}/1440.jpeg`)
                )


                got.stream(imageProperty, {
                    timeout: {
                        //lookup: 100,
                        //connect: 500,
                        //secureConnect: 500,
                        //socket: 1000,
                        //send: 10000,
                        response: 10000
                    }
                })
                    .on('error', reject)
                    .pipe(sharpStream);

                /*
                for (const p of promises) {
                    try {
                        await p;
                    } catch (e) {
                        logger.error(`Failed awaiting a promise`, 3);
                    }
                }
                 */

                Promise.all(promises)
                    .catch(reject)
                    .then(resolve);

            } catch (e) {
                logger.error(`Error doing resize for image: ${imageProperty}`, e)
            }
        });
    }
}
