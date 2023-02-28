import {Pool} from "pg";
import sharp from 'sharp';
import got from 'got';
import fs from "fs";
import {ScraperConfig} from "./types/configs.js";
import {createLogger} from "./util/logger.js";

const logger = createLogger('Scraper');

const gateways = [
    "https://gateway.pinata.cloud/ipfs/"
]

export default class Scraper {
    private readonly targetPath: string;
    private cacheUrl: string;
    private imageProperty: string;

    constructor(private pool: Pool, private nft: NFT, private config: ScraperConfig) {
        this.targetPath = `${this.config.rootDir}/${this.nft.contract}/${this.nft.token_id}`
        this.cacheUrl = `${config.rootUrl}/${this.nft.contract}/${this.nft.token_id}`
        this.imageProperty = this.getImageUrl()
    }

    async scrapeAndResize() {
        try {
            await this.scrapePromise();
            await this.updateRowSuccess();
        } catch (e: Error | any) {
            logger.error(`Failure scraping nft: ${this.nft.contract}:${this.nft.token_id} from url: ${this.imageProperty}: ${e.message}`)
            await this.updateRowFailure();
        }
    }

    private getImageUrl(): string {
        let imageProperty
        if (this.nft.metadata.image) {
            imageProperty = this.nft.metadata.image.trim()
        } else {
            logger.error(`No image found for NFT: ${this.nft.contract}:${this.nft.token_id} from metdata: ${JSON.stringify(this.nft.metadata)}`);
            throw new Error(`No image found!!`)
        }

        if (imageProperty.startsWith("ipfs://"))
            imageProperty = imageProperty.replace("ipfs://", `${this.config.ipfsGateway}/`)

        for (const gatewayUrl of gateways)
            if (imageProperty.startsWith(gatewayUrl))
                imageProperty = imageProperty.replace(gatewayUrl, `${this.config.ipfsGateway}/`)

        return imageProperty;
    }

    private async updateRowSuccess() {
        const updateSql = `UPDATE nfts
                           SET image_cache = $1
                           WHERE contract = $2
                             AND token_id = $3`;
        const updateValues = [this.cacheUrl, this.nft.contract, this.nft.token_id];
        await this.pool.query(updateSql, updateValues);
    }

    private async updateRowFailure() {
        const updateSql = `UPDATE nfts
                           SET scrub_count = scrub_count + 1,
                               scrub_last  = now()
                           WHERE contract = $1
                             AND token_id = $2`;
        const updateValues = [this.nft.contract, this.nft.token_id];
        await this.pool.query(updateSql, updateValues);
    }

    private scrapePromise() {
        return new Promise((resolve, reject) => {
            try {
                logger.debug(`Starting resize for ${this.imageProperty}`)
                if (this.imageProperty.endsWith("mp4")) {
                    reject(new Error(`Unsupported file type: ${this.imageProperty}`))
                    return
                }

                if (!fs.existsSync(this.targetPath))
                    fs.mkdirSync(this.targetPath, {recursive: true});

                const promises = [];
                const sharpStream = sharp();

                promises.push(
                    sharpStream
                        .clone()
                        .resize({width: 280})
                        .webp()
                        .on('error', reject)
                        .toFile(`${this.targetPath}/280.webp`)
                )

                promises.push(
                    sharpStream
                        .clone()
                        .resize({width: 1440})
                        .webp()
                        .on('error', reject)
                        .toFile(`${this.targetPath}/1440.webp`)
                )


                got.stream(this.imageProperty, {
                    timeout: {
                        lookup: 1000,
                        connect: 5000,
                        secureConnect: 5000,
                        socket: 1000,
                        send: 10000,
                        response: 10000
                    }
                })
                    .on('error', reject)
                    .pipe(sharpStream);

                Promise.all(promises)
                    .catch(reject)
                    .then(resolve);

            } catch (e) {
                logger.error(`Error doing resize for image: ${this.imageProperty}`, e)
            }
        });
    }
}
