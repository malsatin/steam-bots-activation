const LIB_DIR = __dirname + "/lib";
const CONFIG_FILE = __dirname + "/config.json";

const fs = require("fs");
const config = require("json5").parse(fs.readFileSync(CONFIG_FILE, "utf-8"));

const mysql = require("mysql").createConnection(config.mysql);
const readline = require("readline");

const Activator = require(LIB_DIR + "/Activator.js");
const Bot = require(LIB_DIR + "/Bot.js");

// Script entry point:

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

mysql.query("SELECT MIN(id) min_id, MAX(id) max_id FROM bots", (err, rows) => {
    if(err) throw err;

    let botData = rows[0];

    rl.question(`What bot you want to activate?[${botData.min_id}, ${botData.max_id}]: `, (answer) => {
        let botId = Number(answer);

        if(botId < botData.min_id || botId > botData.max_id) {
            throw new RangeError("Bot ID out of range");
        }

        handleBot(botId).then(() => {
            console.log("The end");

            rl.close();
            process.stdin.destroy();
        });
    });
});

function handleBot(id) {
    return new Promise((res, rej) => {
        mysql.query("SELECT * FROM bots_steam WHERE bot_id = ? LIMIT 1", [id], async(err, rows) => {
            if(err) throw err;

            if(rows.length > 0) {
                console.log("Bot id is valid");

                let activator = new Activator(mysql, config.phoneNumber, new Bot(rows[0]), rl);
                await activator.perform();
            } else {
                console.error("Bot not found");

                mysql.end();
            }
        });
    });
}
