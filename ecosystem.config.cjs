const apps = []
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

apps.push({
    name: `${config.networkName}-nft-scraper`,
    script: "./dist/main.js"
})

module.exports = { apps }
