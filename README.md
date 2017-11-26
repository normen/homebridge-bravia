# homebridge-bravia
[![NPM Version](https://img.shields.io/npm/v/homebridge-bravia.svg)](https://www.npmjs.com/package/homebridge-bravia)

HomeBridge plugin for Sony Bravia TVs (AndroidTV based ones and possibly others).

## Introduction
Supports the following functions
  - Turning TV on/off
  - Turning sound on/off
  - Setting volume
  - Setting channel
  - Starting apps

## Installation
1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-bravia
3. Set "Remote start" to ON in your TV Settings->Network->Remote Start

### Configure config.json
Example config:

```
"platforms":[
  {
    "platform": "BraviaPlatform",
    "tvs": [
      {
        "name": "TV",
        "ip": "192.168.1.10",
        "tvsource": "tv:dvbs",
        "soundoutput": "speaker",
        "maxchannels": 200,
        "listapplications": 1,
        "apps":[
          "com.sony.dtv.com.edgeway.cozyfireplacehd.com.unity3d.player.UnityPlayerActivity",
          "com.sony.dtv.com.amazon.aiv.eu.com.amazon.blasthtml5android.MainActivity",
          "com.sony.dtv.com.google.android.youtube.tv.com.google.android.apps.youtube.tv.activity.TvGuideActivity",
          "com.sony.dtv.ceb-4472"
        ]
      }
    ]
  }
]
```

Required options:
  - `tvs` is the list of Sony TVs in your home
  - `name` is the name of your TV as it appears in HomeKit
  - `ip` is the IP address of your TV, find it out through your router or set it in the TV
  - `tvsource` is your preferred TV source, can be `tv:dvbt`, `tv:dvbc` or `tv:dvbs`
  - `soundoutput` is your preferred TV sound output, can be `speaker` or `headphone`

Optional options (all inside one TV entry):
  - `maxchannels` number of normal TV channels that can be accessed before the special "app channels" start (see below), default `1000`
  - `listapplications` lists the names and URIs of all applications installed on the TV in the homebridge log when set to 1, default `0`
  - `cookiepath` file name to store the cookie file to, default `"/home/pi/.homebridge/sonycookie"`
  - `updaterate` rate at which the TV is polled for its state in milliseconds, default `5000`
  - `starttimeout` time the plugin waits after starting the TV before sending the command (when starting the TV by sending a command), default `5000`
  - `apps` a list of URIs for applications that are started when the special "app channels" are set, default empty
  - `port` is the IP port of your TV, default 80

### First run + registration
When you run the plugin for the first time you will have to run homebridge directly from command line as the plugin prompts you for a PIN that the TV will give you. This way the TV doesn't have to be set to the unsafe "Basic" login mode.

## Usage
### Basic functions
Some functions like setting the channel or volume are only supported in certain apps like the Elgato Eve app (free) or MyHome (free), not in Apples Home app. You can however create scenes with certain channels or apps and use them in the Home app. So you can for example start the fireplace app with a scene called "Start the fireplace" or mute the TV with a scene called "Mute the TV".
#### ON/OFF
You can turn your TV on and off through Siri and Apples Home app.
#### Sound
The TV registers as a "Speaker" device in HomeKit and allows to set the volume and the mute state. These functions are however not yet available through Siri or Apples Home app.
#### Channels
The TV shows a custom parameter called "Channels" with a number from 0 to [maxchannels] + [number of apps]. Channels 1 to [maxchannels] are normal TV channels. The channels above [maxchannels] open the configured apps.
#### Applications
To open applications you add their URIs to the list of apps in your config.json file. To see a list of applications on the TV in the homebridge log set the `listapplications` option to 1. The channel setting of the TV will open these apps, all channel numbers above the `maxchannels` value represent the apps in the order you entered them in the config.json file.

So to open for example youtube with a scene, add its URI to the list of apps as the first entry and with a `maxchannels` setting of 200 create a scene
that sets the Channel setting of the TV to 201.

## Notes
Thanks go out to "lombi" for his sony bravia homebridge plugin (https://www.npmjs.com/package/homebridge-sonytvremote), which this plugin is heavily based on.
