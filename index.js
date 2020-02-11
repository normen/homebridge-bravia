"use strict";
var ping = require('ping');
var http = require('http');
var inherits = require('util').inherits;
var prompt = require('prompt');
var base64 = require('base-64');
var wol = require("wake_on_lan");
const os = require('os');
var debug = false;

var Service;
var Characteristic;

function BraviaPlatform(log, config){
  this.log = log;
  this.config = config;
  this.accesoryCallback = null;
  debug = config.debug;
}

BraviaPlatform.prototype.accessories = function(callback) {
  let that = this;
  that.accessories = [];
  that.config.tvs.forEach(function(tv) {
    that.accessories.push(new SonyTV(that.log, tv));
  });
  that.accesoryCallback = callback;
  that.checkAccessoryCallback();
}

BraviaPlatform.prototype.checkAccessoryCallback = function() {
  let that = this;
  var ready = true;
  //do accessory callback if all TVs are ready
  that.accessories.forEach(function(sonyTV) {
    if(!sonyTV.statusCheck()){
      ready = false;
    }
  });
  if(!ready){
    setTimeout(function(){
      that.checkAccessoryCallback();
    },500);
  }
  else{
    if(!isNull(that.accesoryCallback))
      that.accesoryCallback(that.accessories);
  }
}

function SonyTV(log, config) {
  this.log = log;
  this.config = config;
  this.name = config.name;
  this.ip = config.ip;
  this.mac = config.mac || null;
  this.port = config.port || "80";
  this.tvsource = config.tvsource || null;
  this.soundoutput = config.soundoutput || "speaker";
  this.cookiepath = config.cookiepath || os.homedir()+"/.homebridge/sonycookie";
  this.updaterate = config.updaterate || 5000;
  this.starttimeout = config.starttimeout || 5000;
  this.comp = config.compatibilitymode;
  this.sources = config.sources || ["extInput:hdmi", "extInput:component", "extInput:scart", "extInput:cec", "extInput:widi"];
  this.useApps = (isNull(config.applications)) ? false : (config.applications instanceof Array == true ? config.applications.length > 0 : config.applications);
  this.applications = (isNull(config.applications) || (config.applications instanceof Array != true)) ? [] : config.applications;

  this.cookie = null;
  this.pwd = config.pwd || null;
  this.registercheck = false;
  this.authok = false;
  this.appsLoaded = false;
  if(!this.useApps) this.appsLoaded = true;

  this.power = false;

  this.inputSourceList = [];
  this.inputSources = [];

  this.currentUri = null;
  this.currentMediaState = Characteristic.TargetMediaState.STOP; //TODO
  this.inputSourceCount = 1;
  this.uriToInputSource = [];

  let that = this;
  this.sources.forEach(function(sourceName){
    that.inputSourceList.push(new InputSource(sourceName, getSourceType(sourceName)));
  });
  if(!isNull(this.tvsource)){
    this.inputSourceList.push(new InputSource(this.tvsource, getSourceType(this.tvsource)));
  }

  this.loadCookie();

  this.services = [];

  this.tvService = new Service.Television(this.name);
  this.tvService.setCharacteristic(Characteristic.ConfiguredName, this.name);
  this.tvService
    .setCharacteristic(
      Characteristic.SleepDiscoveryMode,
      Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE
    );
  this.tvService
    .getCharacteristic(Characteristic.Active)
    .on('set', this.setPowerState.bind(this))
    .on('get', this.getPowerState.bind(this));

  this.tvService.setCharacteristic(Characteristic.ActiveIdentifier, 0);
  this.tvService
    .getCharacteristic(Characteristic.ActiveIdentifier)
    .on('set', this.setActiveIdentifier.bind(this))
    .on('get', this.getActiveIdentifier.bind(this));

  this.tvService
    .getCharacteristic(Characteristic.RemoteKey)
    .on('set', this.setRemoteKey.bind(this));
  this.services.push(this.tvService);

  this.speakerService = new Service.TelevisionSpeaker();
  this.speakerService
    .setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE);
  this.speakerService
    .setCharacteristic(Characteristic.Name, this.soundoutput);
  this.speakerService
	  .setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.ABSOLUTE);
  this.speakerService
    .getCharacteristic(Characteristic.VolumeSelector) //increase/decrease volume
    .on('set', this.setVolumeSelector.bind(this));
  this.speakerService
	  .getCharacteristic(Characteristic.Mute)
    .on('get', this.getMuted.bind(this))
    .on('set', this.setMuted.bind(this));
	this.speakerService.getCharacteristic(Characteristic.Volume)
    .on('get', this.getVolume.bind(this))
    .on('set', this.setVolume.bind(this));
  this.services.push(this.speakerService);

  this.checkRegistration();
  this.updateStatus();
}

SonyTV.prototype.getServices = function() {
  ///sony/system/
  //["getSystemInformation",[],["{\"product\":\"string\", \"region\":\"string\", \"language\":\"string\", \"model\":\"string\", \"serial\":\"string\", \"macAddr\":\"string\", \"name\":\"string\", \"generation\":\"string\", \"area\":\"string\", \"cid\":\"string\"}"],"1.0"]
  var informationService = new Service.AccessoryInformation();
  informationService
  .setCharacteristic(Characteristic.Manufacturer, "Sony")
  .setCharacteristic(Characteristic.Model, "Android TV")
  .setCharacteristic(Characteristic.SerialNumber, "12345");
  this.services.push(informationService);
  return this.services;
}

SonyTV.prototype.statusCheck = function() {
  if(!this.registercheck) return false; // reg check not started
  if(!this.authok) return false; // auth not yet succeeded
  if(this.inputSourceList.length > 0) return false; // inputs not yet loaded
  if(!this.appsLoaded) return false; // apps not yet loaded
  return true;
}

//Do status check every 5 seconds
SonyTV.prototype.updateStatus = function() {
  var that = this;
  setTimeout(function() {
    that.getPowerState(null);
    that.pollPlayContent();
    that.updateStatus();
  }, this.updaterate);
}

//Check if Device is Registered
//Prompt in Console for PIN for First Registration
SonyTV.prototype.checkRegistration = function() {
  var that = this;
  this.registercheck = true;
  var post_data = '{"id":8,"method":"actRegister","version":"1.0","params":[{"clientid":"HomeBridge:34c48639-af3d-40e7-b1b2-74091375368c","nickname":"homebridge"},[{"clientid":"HomeBridge:34c48639-af3d-40e7-b1b2-74091375368c","value":"yes","nickname":"homebridge","function":"WOL"}]]}';
  var onError = function(err) {
    that.log("Error: ", err);
    return false;
  };
  var onSucces = function(chunk) {
    if(chunk.indexOf("error")>=0){if(debug) that.log("Error? ",chunk)}
    if (chunk.indexOf("[]") < 0) {
      that.log("Need to authenticate with TV!");
      that.log("Please enter the PIN that should appear on your TV or add \"pwd\":\"PIN_HERE\" to your config.json and restart HomeBridge, then remove that line for the next restart.")
      console.log("Enter PIN:");
      prompt.start();
      prompt.get(['pin'], function(err, result) {
        if (err) return;
        that.pwd = result.pin;
        that.checkRegistration();
      });
    } else {
      that.authok = true;
      that.receiveNextSources();
    }
  };
  that.makeHttpRequest(onError, onSucces, "/sony/accessControl/", post_data,false);
}

SonyTV.prototype.receiveNextSources = function() {
  let that = this;
  if(this.inputSourceList.length == 0){
    if(this.useApps && !this.appsLoaded) this.receiveApplications();
    return;
  }
  var source = this.inputSourceList.shift();
  if(!isNull(source)){
    this.receiveSources(source.name, source.type);
  }
}

SonyTV.prototype.receiveSources = function(sourceName, sourceType) {
  let that = this;
  var onError = function(err) {
    that.log("Error loading sources for " + sourceName);
    that.log(err);
    that.receiveNextSources();
  };
  var onSucces = function(data) {
    try{
      if (data.indexOf("error") < 0){
        var jayons = JSON.parse(data);
        var reslt = jayons.result[0];
        reslt.forEach(function(source){
          that.addInputSource(source.title, source.uri, sourceType);
        });
      }else{
        that.log("Error loading sources for " + sourceName);
      }
    }catch(e){
      that.log(e);
    }
    that.receiveNextSources();
  };
  var post_data = '{"id":13,"method":"getContentList","version":"1.0","params":[{ "source":"'+sourceName+'","stIdx": 0}]}';
  that.makeHttpRequest(onError, onSucces, "/sony/avContent", post_data,false);
}

SonyTV.prototype.addInputSource = function(name, uri, type) {
  let that = this;
  var inputSource = new Service.InputSource(name, uri); //displayname, subtype?
  inputSource.setCharacteristic(Characteristic.Identifier, that.inputSourceCount)
 	  .setCharacteristic(Characteristic.ConfiguredName, name)
 	  .setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.SHOWN)
    .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
 	  .setCharacteristic(Characteristic.InputSourceType, type);
  inputSource.uri = uri;
  inputSource.type = type;
  inputSource.id = that.inputSourceCount;
  this.services.push(inputSource);
  this.tvService.addLinkedService(inputSource);
  this.inputSources[this.inputSourceCount] = inputSource;
  this.uriToInputSource[uri] = inputSource;
  this.inputSourceCount++;
  this.log("Added input "+name);//+" with URI "+uri);
}

SonyTV.prototype.receiveApplications = function() {
  let that = this;
  var onError = function(err) {
    that.log("Error loading applications:");
    that.log(err);
    that.appsLoaded = true;
  };
  var onSucces = function(data) {
    try{
      if (data.indexOf("error") < 0){
        var jayons = JSON.parse(data);
        var reslt = jayons.result[0];
        reslt.sort(source => source.title).forEach(function(source){
          if (that.applications.length == 0 || that.applications.map(app => app.title).filter(title => source.title.includes(title)).length > 0) {
            that.addInputSource(source.title, source.uri, Characteristic.InputSourceType.APPLICATION);
          }
          else{
            that.log("Ignoring application: " + source.title);
          }
        });
      }else{
        that.log("Error loading applications");
      }
    }catch(e){
      that.log(e);
    }
    that.appsLoaded = true;
  };
  var post_data = '{"id":13,"method":"getApplicationList","version":"1.0","params":[]}';
  that.makeHttpRequest(onError, onSucces, "/sony/appControl", post_data, false);
}

SonyTV.prototype.pollPlayContent = function() {
  //TODO: check app list if no play content for currentUri
  let that = this;
  var post_data = '{"id":13,"method":"getPlayingContentInfo","version":"1.0","params":[]}';
  var onError = function(err) {
    if(debug) that.log("Error: ",err);
    if(!isNull(that.currentUri)){
      that.currentUri = null;
      that.tvService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(0);
    }
  };
  var onSucces = function(chunk) {
    if(chunk.indexOf("error")>=0){
      //happens when TV display is off
      if(!isNull(that.currentUri)){
        that.currentUri = null;
        that.tvService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(0);
      }
    }
    else{
      try {
        var jason = JSON.parse(chunk);
        if(!isNull(jason)){
          var result = jason.result[0];
          var uri = result.uri
          if(that.currentUri != uri){
            that.currentUri = uri;
            var inputSource = that.uriToInputSource[uri];
            if(!isNull(inputSource)){
              that.tvService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(inputSource.id);
            }
          }
        }
      } catch (e) {
        that.log("Exception! ",e);
      }
    }
  };
  that.makeHttpRequest(onError, onSucces, "/sony/avContent/", post_data, false);
}

SonyTV.prototype.setPlayContent = function(uri){
  let that = this;
  var post_data = '{"id":13,"method":"setPlayContent","version":"1.0","params":[{ "uri": "' + uri + '" }]}';
  var onError = function(err) {
    that.log("Error setting play content: ", err);
  };
  var onSucces = function(chunk) {
  };
  that.makeHttpRequest(onError, onSucces, "/sony/avContent/", post_data, true);
}

SonyTV.prototype.setActiveApp = function(uri) {
  let that = this;
  var post_data = '{"id":13,"method":"setActiveApp","version":"1.0","params":[{"uri":"'+uri+'"}]}';
  var onError = function(err) {
    that.log("Error setting active app: ", err);
  };
  var onSucces = function(data) {
  };
  that.makeHttpRequest(onError, onSucces, "/sony/appControl", post_data, true);
}

SonyTV.prototype.getActiveIdentifier = function(callback){
  var uri = this.currentUri;
  if(!isNull(uri)){
    var inputSource = this.uriToInputSource[uri];
    if(!isNull(inputSource)){
      if(!isNull(callback)) callback(null, inputSource.id);
      return;
    }
  }
  if(!isNull(callback)) callback(null, 0);
}

SonyTV.prototype.setActiveIdentifier = function(identifier, callback){
  var inputSource = this.inputSources[identifier];
  if(!isNull(inputSource)){
    if(inputSource.type == Characteristic.InputSourceType.APPLICATION)
      this.setActiveApp(inputSource.uri);
    else
      this.setPlayContent(inputSource.uri);
  }
  if(!isNull(callback)) callback(null, identifier);
}

SonyTV.prototype.setVolumeSelector = function(key, callback){
  let that = this;
  var value = "";
  var onError = function(err) {
    that.log(err);
    if (!isNull(callback)) callback(null);
  };
  var onSucces = function(data) {
    if (!isNull(callback)) callback(null);
  };
  switch(key){
    case Characteristic.VolumeSelector.INCREMENT: //Volume up
    value="AAAAAQAAAAEAAAASAw==";
    break;
    case Characteristic.VolumeSelector.DECREMENT: //Volume down
    value="AAAAAQAAAAEAAAATAw==";
    break;
  }
  var post_data = that.createIRCC(value);
  that.makeHttpRequest(onError, onSucces, "", post_data,false);
}

SonyTV.prototype.setRemoteKey = function(key, callback){
  var value = "";
  var that = this;
  var onError = function(err) {
    that.log(err);
    if (!isNull(callback)) callback(null);
  };
  var onSucces = function(data) {
    if (!isNull(callback)) callback(null);
  };
  //https://gist.github.com/joshluongo/51dcfbe5a44ee723dd32
  switch(key){
    case Characteristic.RemoteKey.REWIND:
    value="AAAAAgAAAJcAAAAbAw==";
    break;
    case Characteristic.RemoteKey.FAST_FORWARD:
    value="AAAAAgAAAJcAAAAcAw==";
    break;
    case Characteristic.RemoteKey.NEXT_TRACK:
    value="AAAAAgAAAJcAAAA9Aw==";
    break;
    case Characteristic.RemoteKey.PREVIOUS_TRACK:
    value="AAAAAgAAAJcAAAB5Aw==";
    break;
    case Characteristic.RemoteKey.ARROW_UP:
    value="AAAAAQAAAAEAAAB0Aw==";
    break;
    case Characteristic.RemoteKey.ARROW_DOWN:
    value="AAAAAQAAAAEAAAB1Aw==";
    break;
    case Characteristic.RemoteKey.ARROW_LEFT:
    value="AAAAAQAAAAEAAAA0Aw==";
    break;
    case Characteristic.RemoteKey.ARROW_RIGHT:
    value="AAAAAQAAAAEAAAAzAw==";
    break;
    case Characteristic.RemoteKey.SELECT:
    value="AAAAAQAAAAEAAABlAw==";
    break;
    case Characteristic.RemoteKey.BACK:
    value="AAAAAgAAAJcAAAAjAw==";
    break;
    case Characteristic.RemoteKey.EXIT:
    value="AAAAAQAAAAEAAABjAw==";
    break;
    case Characteristic.RemoteKey.PLAY_PAUSE:
    value="AAAAAgAAAJcAAAAaAw==";
    break;
    case Characteristic.RemoteKey.INFORMATION:
    value="AAAAAQAAAAEAAAA6Aw==";
    break;
  }
  var post_data = that.createIRCC(value);
  that.makeHttpRequest(onError, onSucces, "", post_data,false);
}

SonyTV.prototype.getMuted = function(callback) {
  var that = this;
  if (!that.power) {
    if (!isNull(callback)) callback(null, 0);
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

SonyTV.prototype.setMuted = function(muted, callback) {
  var that = this;
  if (!that.power) {
    if (!isNull(callback)) callback(null, 0);
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
    if (!isNull(callback)) callback(null, muted);
  };
  that.makeHttpRequest(onError, onSucces, "/sony/audio/", post_data,false);
}

SonyTV.prototype.getVolume = function(callback) {
  var that = this;
  if (!that.power) {
    if (!isNull(callback)) callback(null, 0);
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

SonyTV.prototype.setVolume = function(volume, callback) {
  var that = this;
  if (!that.power) {
    if (!isNull(callback)) callback(null, 0);
    return;
  }
  var post_data = '{"id":13,"method":"setAudioVolume","version":"1.0","params":[{"target":"' + that.soundoutput + '","volume":"' + volume + '"}]}';
  var onError = function(err) {
    if (debug) that.log("Error: ",err);
    if (!isNull(callback)) callback(null, 0);
  };
  var onSucces = function(chunk) {
    if (!isNull(callback)) callback(null, volume);
  };
  that.makeHttpRequest(onError, onSucces, "/sony/audio/", post_data,false);
}

SonyTV.prototype.getPowerState = function(callback) {
  var that = this;
  var onError = function(err) {
    if(debug) that.log("Error: ",err);
    if (!isNull(callback)) callback(null, false);
    that.updatePowerState(false);
  };
  var onSucces = function(chunk) {
    var _json = null;
    try {
      _json = JSON.parse(chunk);
      if (!isNull(_json) && !isNull(_json.result[0]) && _json.result[0].status === "active") {
        that.updatePowerState(true);
        if (!isNull(callback)) callback(null, true);
      } else {
        that.updatePowerState(false);
        if (!isNull(callback)) callback(null, false);
      }
    } catch (e) {
      if(debug) console.log(e);
      that.updatePowerState(false);
      if (!isNull(callback)) callback(null, false);
    }
  };
  try {
    /*ping.sys.probe(that.ip, function(isAlive) {
      if (isAlive) {*/
        var post_data = '{"id":2,"method":"getPowerStatus","version":"1.0","params":[]}';
        that.makeHttpRequest(onError, onSucces, "/sony/system/", post_data,false);
      /*} else {
        that.updatePowerState(false);
        if (!isNull(callback)) callback(null, false);
      }
    });*/
  } catch (globalExcp) {
    if(debug) console.log(globalExcp);
    that.updatePowerState(false);
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
  var onWol = function(error) {
    if (error) that.log("Error when sending WOL packets", error);
    that.getPowerState(callback);
  };
  if (state) {
    if(!isNull(this.mac)){
      wol.wake(this.mac, onWol);
    }else{
      var post_data = '{"id":2,"method":"setPowerStatus","version":"1.0","params":[{"status":true}]}';
      that.makeHttpRequest(onError, onSucces, "/sony/system/", post_data,false);
    }
  } else {
    if(!isNull(this.mac)){
      var post_data = this.createIRCC("AAAAAQAAAAEAAAAvAw==");
      this.makeHttpRequest(onError, onSucces, "", post_data, false);
    }else{
      var post_data = '{"id":2,"method":"setPowerStatus","version":"1.0","params":[{"status":false}]}';
      that.makeHttpRequest(onError, onSucces, "/sony/system/", post_data,false);
    }
  }
}

SonyTV.prototype.updatePowerState = function(state) {
  if(this.power != state){
    this.power = state;
    this.tvService.getCharacteristic(Characteristic.Active).updateValue(this.power);
  }
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

SonyTV.prototype.createIRCC = function(command) {
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
  if(url == "/sony/IRCC"){
    post_options.headers['Content-Type'] = 'text/xml';
    post_options.headers.SOAPACTION = '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"';
  }
  return post_options;
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

SonyTV.prototype.saveCookie = function(cookie) {
  let that = this;
  if (cookie != undefined && cookie != null && cookie.length > 0)
  var fs = require('fs');
  var stream = fs.createWriteStream(this.cookiepath);
  stream.on('error', function(err) {
    that.log("Error writing cookie file to " + this.cookiepath + ". Add a cookiepath parameter to config.json to specify the path. Note that you specify the FILE path, not the folder.");
    process.exit(1);
  });
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
      if(debug) that.log("No cookie file found at " + that.cookiepath + ":",err);
      return;
    }
    if(debug) that.log("Loaded cookie file from " + that.cookiepath);
    that.cookie = data.toString();
  });
}

function isNull(object) {
  return object == undefined || null;
}

function InputSource(name, type) {
    this.name = name;
    this.type = type;
}

function getSourceType(name) {
  if(name.indexOf("hdmi") !== -1){
    return Characteristic.InputSourceType.HDMI;
  } else if(name.indexOf("component") !== -1){
    return Characteristic.InputSourceType.COMPONENT_VIDEO;
  } else if(name.indexOf("scart") !== -1){
    return Characteristic.InputSourceType.S_VIDEO;
  } else if(name.indexOf("cec") !== -1){
    return Characteristic.InputSourceType.OTHER;
  } else if(name.indexOf("widi") !== -1){
    return Characteristic.InputSourceType.AIRPLAY;
  } else if(name.indexOf("dvb") !== -1){
    return Characteristic.InputSourceType.TUNER;
  } else if(name.indexOf("app") !== -1){
    return Characteristic.InputSourceType.APPLICATION;
  } else {
    return Characteristic.InputSourceType.OTHER;
  }
}

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerPlatform("homebridge-bravia", "BraviaPlatform", BraviaPlatform);
}
