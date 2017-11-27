module.exports = Bot;

function Bot(data) {
    this.id = data.bot_id;
    this.email = data.email;
    this.login = data.login;
    this.password = data.password;

    this.steam_id = data.steam_id;
    this.shared_secret = data.shared_secret;
    this.identity_secret = data.identity_secret;
    this.revocation_code = data.revocation_code;

    this.trade_token = data.trade_token;
}

Bot.prototype.toString = function() {
    return this.id + ":" + this.login;
};

Bot.prototype.setSecrets = function(data) {
    this.shared_secret = data.shared_secret;
    this.identity_secret = data.identity_secret;
    this.revocation_code = data.revocation_code;
};
