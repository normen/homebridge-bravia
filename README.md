# homebridge-bravia [![NPM Version](https://img.shields.io/npm/v/homebridge-bravia.svg)](https://www.npmjs.com/package/homebridge-bravia) [![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins) 

HomeBridge plugin for Sony Bravia TVs (AndroidTV based ones and possibly others).

## Introduction
Supports the following functions
  - Turning TV on/off
  - Setting volume
  - Selecting inputs / channels
  - Starting apps
  - Trigger automation when turning the TV on/off
  - iOS 12.2 remote support
  - Secure connection to TV without PSK

This plugin requires iOS 12.2, to use it with previous iOS versions install version 0.96 of this plugin.

**Note for users of versions before 2.0: Updating to 2.0+ will force you to set up the TV (including all HomeKit automation) again**

## Installation
- Install homebridge (e.g. using `npm install -g homebridge`)
- Install this plugin (e.g. using `npm install -g homebridge-bravia`)
- Configure the plugin settings through config.json or web UI (see below for the options)
- Turn on the TV
- Set "Remote start" to ON in your TV Settings->Network->Remote Start (not required)
- Restart Homebridge
- The TV will display a PIN
- Enter the PIN at `http://homebridge.local:8999`
  - Replace `homebridge.local` with the IP or name of your homebridge server
  - Note that the web server is only accessible when you have to enter a PIN
- Your TV should appear in HomeKit as soon as all channels have been scanned
- For external accessory mode (see below)
  - In HomeKit, press the "+" button and select "Add Device"
  - Select "I have no code", then enter the code of your homebridge install to add the TV

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
        "soundoutput": "speaker",
        "tvsource": "tv:dvbs",
        "applications": [{"title":"Netflix"}],
        "sources": [
          "extInput:hdmi"
        ]
      }
    ]
  }
]
```

Required options:
  - `tvs` is the list of Sony TVs in your home
  - `name` is the name of your TV as it appears in HomeKit
  - `ip` is the IP address or host name of your TV, find and/or set it through your router or set it in the TV

Optional options (all inside one TV entry):
  - `sources` is an array of sources to display in HomeKit
    - default `["extInput:hdmi", "extInput:component", "extInput:scart", "extInput:cec", "extInput:widi"]`
    - these sources usually represent a type of input, so `extInput:hdmi` will show all your HDMI inputs in HomeKit
    - source strings for your TV might look different, check the web if you find the right ones for your TV/input types
  - `tvsource` is your preferred TV source, can be `tv:dvbt`, `tv:dvbc` or `tv:dvbs` (antenna, cable or sat), default none
    - effectively this is just another source like the ones above
  - `applications` can be used to enable listing applications in the input list, default `false`
    - Providing an array of objects with application titles will only add applications whose names contain the titles to the input list:
      ```
      "applications": [
                          {
                              "title": "Netflix"
                          },
                          {
                              "title": "Plex"
                          },
                          ... etc.
                      ]
      ```
  - `soundoutput` is your preferred TV sound output, can be `speaker` or `headphone`, default `speaker`
  - `port` is the HTTP port of your TV, default 80
  - `externalaccessory` if set the TV will be published as an external accessory to HomeKit
  - `mac` is the MAC address of your TV, only set it if you want to use WOL instead of HTTP to wake up the TV, default none
  - `woladdress` sets the subnet for WOL, default `255.255.255.255`
  - `serverPort` sets a different port than `8999` for the web server that allows entering the PIN number from the TV
  - `updaterate` interval in milliseconds for TV status updates (on/off etc), default `5000`
  - `channelupdaterate` interval in milliseconds for updates of the channel/input list, default `30000`

## Usage
### Basic functions
#### ON/OFF
You can turn your TV on and off through Siri and Apples Home app.
#### Inputs and Applications
All Channels, Inputs and Applications can be selected in the HomeKit inputs selector
#### TV Remote
The TV registers as a TV remote device in HomeKit and allows to use basic function keys and set the volume through the Apple Remote app or iOS configuration screen. Use your phones volume knobs to set the TV volume!
#### TV Speaker
In addition to the iOS remote the plugin also exposes the TV speaker as a HomeKit accessory however only some apps show that accessory type, Apples Home app does not.

## Development
If you want new features or improve the plugin, you're very welcome to do so. The projects `devDependencies` include homebridge and the `npm run test` command has been adapted so that you can run a test instance of homebridge during development. 
#### Setup
- clone github repo
- `npm install` in the project folder
- create `.homebridge` folder in project root
- add `config.json` with appropriate content to `.homebridge` folder
- run `npm run test` to start the homebridge instance for testing

## Notes
### Misc
Thanks go out to "lombi" for his sony bravia homebridge plugin, which this plugin is heavily based on.
