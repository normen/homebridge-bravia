"use strict";
var ping = require('ping');
var http = require('http');
var inherits = require('util').inherits;
var prompt = require('prompt');
var base64 = require('base-64');
var debug = false;

var Service;
var Characteristic;
var ChannelCharacteristic;

function isNull(object) {
    return object == undefined || null;
}

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerPlatform("homebridge-bravia", "BraviaPlatform", BraviaPlatform);
}

function BraviaPlatform(log, config){
    this.log = log;
    this.config = config;
}

BraviaPlatform.prototype.accessories = function(callback) {
    var that = this;
    that.accessories = [];
    that.config.tvs.forEach(function(tv) {
        that.accessories.push(new SonyTV(that.log, tv));
    });
    callback(that.accessories);
}

function SonyTV(log, config) {
    this.log = log;
    this.config = config;
    this.name = config.name;
    this.ip = config.ip;
    this.port = config.port;
    this.tvsource = config.tvsource;
    this.soundoutput = config.soundoutput;
    this.listapplications = config.listapplications;
    this.maxchannels = config.maxchannels;
    this.cookiepath = config.cookiepath;
    this.updaterate = config.updaterate;
    this.starttimeout = config.starttimeout;
    this.comp = config.compatibilitymode;
    this.apps = config.apps;

    this.channeltouri = [];
    this.cookie = null;
    this.pwd = null;
    this.authok = false;
    this.registercheck = false;
    this.appslisted = false;
    this.commandCanTurnTvOn = true;

    this.port = this.port ? this.port : "80";
    this.cookiepath = this.cookiepath ? this.cookiepath : "~/.homebridge/sonycookie";
    this.maxchannels = this.maxchannels ? this.maxchannels : 1000;
    this.updaterate = this.updaterate ? this.updaterate : 5000;
    this.starttimeout = this.starttimeout ? this.starttimeout : 5000;
    this.apps = this.apps ? this.apps : [];

    this.cookie = this.loadCookie();
    this.pwd = this.loadPin();

    this.makeChannelCharacteristic();

    this._service = new Service.Switch(this.name);
    this._service.getCharacteristic(Characteristic.On)
        .on('set', this.setPowerState.bind(this))
        .on('get', this.getPowerState.bind(this));
    this._service.addCharacteristic(ChannelCharacteristic)
        .on('get', this.getChannel.bind(this))
        .on('set', this.setChannel.bind(this));

    this._speaker_service = new Service.Speaker(this.name);
    this._speaker_service.getCharacteristic(Characteristic.Mute)
        .on('get', this.getMuted.bind(this))
        .on('set', this.setMuted.bind(this));
    this._speaker_service.getCharacteristic(Characteristic.Volume)
        .on('get', this.getVolume.bind(this))
        .on('set', this.setVolume.bind(this));

    setTimeout(this.updateStatus.bind(this), this.updaterate);
}

SonyTV.prototype.getServices = function() {
    var informationService = new Service.AccessoryInformation();
    informationService
    .setCharacteristic(Characteristic.Manufacturer, "Sony")
    .setCharacteristic(Characteristic.Model, "Android TV")
    .setCharacteristic(Characteristic.SerialNumber, "12345");
    return [informationService, this._service, this._speaker_service];
}

SonyTV.prototype.makeChannelCharacteristic = function() {
    var that = this;
    ChannelCharacteristic = function() {
        Characteristic.call(this, 'Channel', '19E1CF82-E0EE-410D-A23C-E80020354C14');
        this.setProps({
            format: Characteristic.Formats.INT,
            unit: Characteristic.Units.NONE,
            maxValue: that.maxchannels + that.apps.length,
            minValue: 0,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(ChannelCharacteristic, Characteristic);
}

SonyTV.prototype.saveCookie = function(cookie) {
    if (cookie != undefined && cookie != null && cookie.length > 0)
    var fs = require('fs');
    var stream = fs.createWriteStream(this.cookiepath);
    stream.once('open', function(fd) {
        stream.write(cookie);
        stream.end();
    });
}

SonyTV.prototype.loadCookie = function() {
    var that = this;
    var fs = require('fs');
    fs.readFile(this.cookiepath, function(err, data) {
        if (err) {
            return;
        }
        that.cookie = data.toString();
    });
}

SonyTV.prototype.savePin = function(pin) {
    if (pin != undefined && pin != null && pin.length > 0)
    var fs = require('fs');
    var stream = fs.createWriteStream(this.cookiepath + "pin");
    stream.once('open', function(fd) {
        stream.write(pin);
        stream.end();
    });
}

SonyTV.prototype.loadPin = function() {
    var that = this;
    var fs = require('fs');
    fs.readFile(this.cookiepath + "pin", function(err, data) {
        if (err) return;
        that.pwd = data.toString();
    });
}

SonyTV.prototype.setCookie = function(headers) {
    var that = this;
    var setcookie = null;
    try {
        setcookie = headers["set-cookie"];
    } catch (e) {
        setcookie = null;
    }
    if (setcookie != null && setcookie != undefined) {
        setcookie.forEach( function(cookiestr) {
            try {
                that.cookie = cookiestr.toString().split(";")[0];
                that.saveCookie(that.cookie);
            } catch (e) {}
        });
    }
}

//Check if device is up and do registration check, get channel uris
//and do status check every 5 seconds.
SonyTV.prototype.updateStatus = function() {
    var that = this;
    setTimeout(function() {
        that.getPowerState(null);
        if (!that.authok && that.power && !that.registercheck) {
            that.checkRegistration();
        }
        if (that.power && that.authok && that.channeltouri.length == 0) {
            that.getChannelUris(0);
            if(that.listapplications) that.listApplications();
        }
        that.updateStatus();
    }, this.updaterate);
}

SonyTV.prototype.makeHttpRequest = function(errcallback, resultcallback, url, post_data, canTurnTvOn) {
    var that = this;
    var data = "";
    if (isNull(canTurnTvOn))
    canTurnTvOn = false;
    if (!that.power && canTurnTvOn){
        that.setPowerState(true,null);
        var timeout = that.starttimeout;
        setTimeout(function() {
            that.makeHttpRequest(errcallback,resultcallback,url,post_data,false);
        },timeout);
        return;
    }
    var post_options = that.getPostOptions(url);
    var post_req = http.request(post_options, function(res) {
        that.setCookie(res.headers);
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
            data += chunk;
        });
        res.on('end', function() {
            if (!isNull(resultcallback)) {
                resultcallback(data);
            }
        });
    });
    try {
        post_req.on('error', function(err) {
            if (!isNull(errcallback)) {
                errcallback(err);
            }
            return;
        });
        post_req.write(post_data);
        post_req.end();
    } catch (e) {
        if (!isNull(errcallback)) {
            errcallback(e);
        }
    }
}

SonyTV.prototype.getChannelUris = function(next50from) {
    var that = this;
    if (this.next50from == undefined) {
        this.next50from = 0;
        this.channeltouri = [];
    }
    var post_data = '{"id":13,"method":"getContentList","version":"1.0","params":[{ "source":"' + this.tvsource + '","stIdx": ' + this.next50from + '}]}';
    var onError = function(err) {
        if(debug) that.log("Error: ",err);
        return;
    };
    var onSucces = function(data) {
        if(data.indexOf("error")>=0){
            if(debug) that.log("Error? ",data)
            return;
        }
        try {
            var result = JSON.parse(data).result[0];
            var nextchannel = that.maxchannels;
            result.forEach(function(channelblock) {
                that.channeltouri[Number(channelblock.dispNum).toString()] = channelblock.uri;
                nextchannel = channelblock.index + 1;
            });
            if (nextchannel < that.maxchannels) that.getChannelUris(nextchannel);
        } catch (e) {
            return;
        }
    };
    this.makeHttpRequest(onError, onSucces, "/sony/avContent/", post_data,false);
}

//Check if Device is Registered
//Prompt in Console for PIN for First Registration
SonyTV.prototype.checkRegistration = function() {
    var that = this;
    this.registercheck = true;
    var post_data = '{"id":8,"method":"actRegister","version":"1.0","params":[{"clientid":"HomeBridge:34c48639-af3d-40e7-b1b2-74091375368c","nickname":"homebridge"},[{"clientid":"HomeBridge:34c48639-af3d-40e7-b1b2-74091375368c","value":"yes","nickname":"homebridge","function":"WOL"}]]}';
    var onError = function(err) {
        if(debug) that.log("Error: ",err);
        return false;
    };
    var onSucces = function(chunk) {
        if(chunk.indexOf("error")>=0){if(debug) that.log("Error? ",chunk)}
        if (chunk.indexOf("[]") < 0) {
            prompt.start();
            prompt.get(['pin'], function(err, result) {
                if (err) return;
                that.savePin(result.pin);
                that.pwd = result.pin;
                that.checkRegistration();
            });
        } else {
            that.authok = true;
        }
    };
    that.makeHttpRequest(onError, onSucces, "/sony/accessControl/", post_data,false);
}

SonyTV.prototype.listApplications = function() {
    var that = this;
    var post_data = '{"id":13,"method":"getApplicationList","version":"1.0","params":[]}';
    var onError = function(err) {
        if(debug) that.log("Error: ",err);
        callback(null, 0);
    };
    var onSucces = function(data) {
        if (data.indexOf("error") < 0){
            var jayons = JSON.parse(data);
            var reslt = jayons.result[0];
            that.log("TV Application List for "+that.name);
            reslt.forEach(function(app){
                that.log(app.title +" ("+app.uri+")");
            });
        }
    };
    that.makeHttpRequest(onError, onSucces, "/sony/appControl", post_data,false);
}

SonyTV.prototype.startApplication = function(name, channel, callback) {
    var that = this;
    var post_data = '{"id":13,"method":"setActiveApp","version":"1.0","params":[{"uri":"'+name+'"}]}';
    var onError = function(err) {
        if(debug) that.log("Error: ",err);
        callback(null, 0);
    };
    var onSucces = function(data) {
        if (data.indexOf("error") < 0){
            callback(null, channel);
        }
        else {
            callback(null, 0);
        }
    };
    that.makeHttpRequest(onError, onSucces, "/sony/appControl", post_data, this.commandCanTurnTvOn);
}

SonyTV.prototype.getChannel = function(callback) {
    var that = this;
    if (!that.power) {
        callback(null, 0);
        return;
    }
    var post_data = '{"id":13,"method":"getPlayingContentInfo","version":"1.0","params":[]}';
    var onError = function(err) {
        if(debug) that.log("Error: ",err);
        if (!isNull(callback)) callback(null, 0);
    };
    var onSucces = function(chunk) {
        if(chunk.indexOf("error")>=0){
            if(debug) that.log("Error? ",chunk)
            if (!isNull(callback)) callback(null, 0);
        }
        else{
            try {
                var jason = JSON.parse(chunk);
                if(!isNull(jason)){
                    var result = jason.result[0];
                    var channel = Number(result.dispNum);
                    if (!isNull(callback)) callback(null, channel);
                }
                else{
                    if (!isNull(callback)) callback(null, 0);
                }
            } catch (e) {
                that.log("Exception! ",e);
                if (!isNull(callback)) callback(null, 0);
            }
        }
    };
    that.makeHttpRequest(onError, onSucces, "/sony/avContent/", post_data, false);
}

SonyTV.prototype.setChannel = function(channel, callback) {
    var that = this;
    if (!that.power && !this.commandCanTurnTvOn) {
        callback(null, 0);
        return;
    }
    if (channel > this.maxchannels) {
        var name = that.apps[channel-this.maxchannels-1];
        that.startApplication(name, channel, callback);
        return;
    }
    else if (channel == 0) {
        that.getChannel(callback);
        return;
    }
    var uri = this.channeltouri[channel.toString()];
    if (isNull(uri)) {
        that.getChannel(callback);
        return;
    }
    var post_data = '{"id":13,"method":"setPlayContent","version":"1.0","params":[{ "uri": "' + uri + '" }]}';
    var onError = function(err) {
        if(debug) that.log("Error: ",err);
        if (!isNull(callback)) callback(null, 0);
    };
    var onSucces = function(chunk) {
        if (chunk.indexOf("error") <= 0) {
            callback(null, 0);
        } else {
            that.getChannel(callback);
        }
    };
    that.makeHttpRequest(onError, onSucces, "/sony/avContent/", post_data, this.commandCanTurnTvOn);
}

SonyTV.prototype.setMuted = function(muted, callback) {
    var that = this;
    if (!that.power) {
        callback(null, 0);
        return;
    }
    var merterd = muted?"true":"false";
    var post_data = '{"id":13,"method":"setAudioMute","version":"1.0","params":[{"status":' + merterd + '}]}';
    var onError = function(err) {
        if(debug) that.log("Error: ",err);
        if (!isNull(callback)) callback(null, 0);
    };
    var onSucces = function(chunk) {
        if(chunk.indexOf("error")>=0){that.log("Error? ",chunk)}
        callback(null, muted);
    };
    that.makeHttpRequest(onError, onSucces, "/sony/audio/", post_data,false);
}

SonyTV.prototype.getMuted = function(callback) {
    var that = this;
    if (!that.power) {
        callback(null, 0);
        return;
    }
    var post_data = '{"id":4,"method":"getVolumeInformation","version":"1.0","params":[]}';
    var onError = function(err) {
        if(debug) that.log("Error: ",err);
        if (!isNull(callback)) callback(null, false);
    };
    var onSucces = function(chunk) {
        if(chunk.indexOf("error")>=0){
            if(debug) that.log("Error? ",chunk);
            if (!isNull(callback)) callback(null, false);
            return;
        }
        var _json = null;
        try {
            _json = JSON.parse(chunk);
        } catch (e) {
            if (!isNull(callback)) callback(null, false);
            return;
        }
        if(isNull(_json.result)) {
            if(!isNull(callback)) callback(null, false);
            return;
        }
        for (var i = 0; i < _json.result[0].length; i++) {
            var volume = _json.result[0][i].volume;
            var typ = _json.result[0][i].target;
            if (typ === that.soundoutput) {
                if (!isNull(callback)) callback(null, _json.result[0][i].mute);
                return;
            }
        }
        if (!isNull(callback)) callback(null, false);
    };
    that.makeHttpRequest(onError, onSucces, "/sony/audio/", post_data, false);
}

SonyTV.prototype.setVolume = function(volume, callback) {
    var that = this;
    if (!that.power) {
        callback(null, 0);
        return;
    }
    var post_data = '{"id":13,"method":"setAudioVolume","version":"1.0","params":[{"target":"' + that.soundoutput + '","volume":"' + volume + '"}]}';
    var onError = function(err) {
        if(debug) that.log("Error: ",err);
        if (!isNull(callback)) callback(null, 0);
    };
    var onSucces = function(chunk) {
        callback(null, volume);
    };
    that.makeHttpRequest(onError, onSucces, "/sony/audio/", post_data,false);
}

SonyTV.prototype.getVolume = function(callback) {
    var that = this;
    if (!that.power) {
        callback(null, 0);
        return;
    }
    var post_data = '{"id":4,"method":"getVolumeInformation","version":"1.0","params":[]}';
    var onError = function(err) {
        if(debug) that.log("Error: ",err);
        if (!isNull(callback)) callback(null, 0);
    };
    var onSucces = function(chunk) {
        if(chunk.indexOf("error")>=0){
            if(debug) that.log("Error? ",chunk)
            if (!isNull(callback)) callback(null, 0);
            return;
        }
        var _json = null;
        try {
            _json = JSON.parse(chunk);
        } catch (e) {
            if (!isNull(callback)) callback(null, 0);
            return;
        }
        if(isNull(_json.result)) {
            if(!isNull(callback)) callback(null,0);
            return;
        }
        for (var i = 0; i < _json.result[0].length; i++) {
            var volume = _json.result[0][i].volume;
            var typ = _json.result[0][i].target;
            if (typ === that.soundoutput) {
                if (!isNull(callback)) callback(null, volume);
                return;
            }
        }
        if (!isNull(callback)) callback(null, 0);
    };
    that.makeHttpRequest(onError, onSucces, "/sony/audio/", post_data, false);
}

SonyTV.prototype.getPowerState = function(callback) {
    var that = this;
    var onError = function(err) {
        if(debug) that.log("Error: ",err);
        if (!isNull(callback)) callback(null, false);
        that.power = false;
    };
    var onSucces = function(chunk) {
        var _json = null;
        try {
            _json = JSON.parse(chunk);
            if (!isNull(_json) && !isNull(_json.result[0]) && _json.result[0].status === "active") {
                that.power = true;
                if (!isNull(callback)) callback(null, true);
            } else {
                that.power = false;
                if (!isNull(callback)) callback(null, false);
            }
        } catch (e) {
            if (!isNull(callback)) callback(e, false);
            that.power = false;
        }
    };
    try {
        ping.sys.probe(that.ip, function(isAlive) {
            if (isAlive) {
                var post_data = '{"id":2,"method":"getPowerStatus","version":"1.0","params":[]}';
                that.makeHttpRequest(onError, onSucces, "/sony/system/", post_data,false);
            } else {
                that.power = false;
                if (!isNull(callback)) callback(null, isAlive);
            }
        });
    } catch (globalExcp) {
        that.power = false;
        if (!isNull(callback)) callback(null, false);
    }
}

SonyTV.prototype.setPowerState = function(state, callback) {
    var that = this;
    var onError = function(err) {
        if(debug) that.log("Error: ",err);
        that.getPowerState(callback);
    };
    var onSucces = function(chunk) {
        that.getPowerState(callback);
    };
    if (state) {
        var post_data = '{"id":2,"method":"setPowerStatus","version":"1.0","params":[{"status":true}]}';
        that.makeHttpRequest(onError, onSucces, "/sony/system/", post_data,false);
    } else {
        var post_data = '{"id":2,"method":"setPowerStatus","version":"1.0","params":[{"status":false}]}';
        that.makeHttpRequest(onError, onSucces, "/sony/system/", post_data,false);
    }
}

SonyTV.prototype.createIRRC = function(command) {
    return "<?xml version=\"1.0\" encoding=\"utf-8\"?><s:Envelope xmlns:s=\"http:\/\/schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http:\/\/schemas.xmlsoap.org/soap/encoding/\"><s:Body><u:X_SendIRCC xmlns:u=\"urn:schemas-sony-com:service:IRCC:1\"><IRCCCode>" + command + "</IRCCCode></u:X_SendIRCC></s:Body></s:Envelope>";
}

SonyTV.prototype.getPostOptions = function(url) {
    var that = this;
    if (url == "") url = "/sony/IRCC";
    var post_options = null;
    if (that.comp == "true") {
        post_options = {
            host: 'closure-compiler.appspot.com',
            port: '80',
            path: url,
            method: 'POST',
            headers: {}
        };
    } else {
        post_options = {
            host: that.ip,
            port: that.port,
            path: url,
            method: 'POST',
            headers: {}
        };
    }
    if (!isNull(this.cookie)) {
        post_options.headers.Cookie = this.cookie; // = { 'Cookie': cookie };
    }
    if (!isNull(this.pwd)) {
        var encpin = 'Basic ' + base64.encode(":" + this.pwd);
        post_options.headers.Authorization = encpin; //{':  encpin  };
    }
    return post_options;
}
