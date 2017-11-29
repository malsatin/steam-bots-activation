module.exports = Activator;

const SteamCommunity = require("steamcommunity");
const SteamStore = require("steamstore");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

/**
 * Bot activation class
 *
 * @param {Connection} mysql
 * @param {Bot} bot
 */
function Activator(mysql, phoneNumber, bot) {
    this.db = mysql;
    this.bot = bot;
    this.community = null;
    this.loginCookies = null;
    this.store = null;

    this.phoneNumber = phoneNumber;
}

Activator.prototype.perform = async function() {
    console.log("\nLogging in");
    await this.logOn();

    console.log("\nAdding phone");
    await this.addPhone(this.phoneNumber);

    console.log("\nActivationg 2FA");
    await this.activateGuard();
};

Activator.prototype.logOn = function() {
    let self = this;

    let details = {
        accountName: self.bot.login,
        password: self.bot.password,
        authCode: "",
        captcha: "",
    };
    self.community = new SteamCommunity();
    let community = self.community;

    return new Promise((res, rej) => {
        function doLogin() {
            community.login(details, function(err, sessionID, cookies, steamguard) {
                if(err) {
                    if(err.message === "SteamGuardMobile") {
                        console.log("This account already has two-factor authentication enabled.");
                        process.exit();
                        return;
                    }

                    if(err.message === "SteamGuard") {
                        console.log("An email has been sent to your address at " + err.emaildomain);
                        rl.question("Steam Guard Code: ", function(code) {
                            details.authCode = code;

                            doLogin();
                        });

                        return;
                    }

                    if(err.message === "CAPTCHA") {
                        console.log("Check captcha at " + err.captchaurl);
                        rl.question("CAPTCHA: ", function(captchaInput) {
                            details.captcha = captchaInput;

                            doLogin();
                        });

                        return;
                    }

                    console.log(err);
                    process.exit();
                    return;
                }

                self.loginCookies = cookies;

                console.log("Logged on!");
                res();
            });
        }

        doLogin();
    });
};

Activator.prototype.addPhone = async function(phoneNo) {
    let self = this;

    self.store = new SteamStore();
    let store = self.store;

    return new Promise((res, rej) => {
        store.setCookies(self.loginCookies);
        store.hasPhone(function(err, hasPhone, lastDigits) {
            if(err) rej(err);

            if(hasPhone) {
                console.log("Account already has assigned phone number: *********" + lastDigits);
                res();
            } else {
                store.addPhoneNumber(phoneNo, function(err) {
                    if(err) throw new Error(err);

                    console.log("Verifying phone, code sent to " + phoneNo);
                    rl.question("SMS Code: ", function(smsCode) {
                        store.verifyPhoneNumber(smsCode, function(err) {
                            if(err) throw new Error(err);

                            console.log("Phone number verified!");
                            res();
                        });
                    });
                });
            }
        });
    });
};

/**
 *
 */
Activator.prototype.activateGuard = async function() {
    let self = this;
    let community = self.community;

    return new Promise((res, rej) => {
        function promptActivationCode(response) {
            console.log("Confirm 2FA activation");
            rl.question("SMS Code: ", function(smsCode) {
                community.finalizeTwoFactor(response.shared_secret, smsCode, function(err) {
                    if(err) {
                        if(err.message === "Invalid activation code") {
                            console.log(err);
                            promptActivationCode(response);
                            return;
                        }

                        console.log(err);
                    } else {
                        console.log("Two-factor authentication enabled!");
                    }

                    end(self);
                    process.exit();

                    res();
                });
            });
        }

        community.enableTwoFactor(function(err, response) {
            if(err) {
                if(err.eresult === 2) {
                    console.log("Error: Failed to enable two-factor authentication. Do you have a phone number attached to your account?");
                    process.exit();
                    return;
                }

                if(err.eresult === 84) {
                    console.log("Error: RateLimitExceeded. Try again later.");
                    process.exit();
                    return;
                }

                console.log(err);
                process.exit();
                return;
            }

            if(response.status !== 1) {
                console.log("Error: Status " + response.status);
                process.exit();
                return;
            }

            console.log("Revocation code: " + response.revocation_code);

            console.log("Writing secrets to database");
            self.bot.setSecrets(response);
            self.bot.steam_id = community.steamID.getSteamID64();
            updateBot(self.db, self.bot);

            promptActivationCode(response);
        });
    });
};

/**
 * @param {Connection} conn
 * @param {Bot} bot
 */
function updateBot(conn, bot) {
    let updatingData = {
        steam_id: bot.steam_id,
        shared_secret: bot.shared_secret,
        identity_secret: bot.identity_secret,
        revocation_code: bot.revocation_code,
    };

    return new Promise((res, rej) => {
        conn.query("UPDATE bots_steam SET ? WHERE bot_id = ?", [updatingData, bot.id], function(err, rows) {
            if(err) rej(err);

            res();
        });
    });
}

/**
 * @param {Activator} activator
 */
function end(activator) {
    activator.db.end();
}