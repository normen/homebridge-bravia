# homebridge-bravia [![NPM Version](https://img.shields.io/npm/v/homebridge-bravia.svg)](https://www.npmjs.com/package/homebridge-bravia) [![Donate](https://img.shields.io/badge/donate-paypal-yellowgreen.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=QKRPFAVB6WRW2&source=url)

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

** Note for users of versions before 2.0: Updating to 2.0+ will force you to set up the TV (including all HomeKit automation) again **

## Installation
1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-bravia
3. Configure config.json or configure settings though web UI
4. Set "Remote start" to ON in your TV Settings->Network->Remote Start
5. Turn on the TV
6. Restart Homebridge
7. The TV will display a PIN
8. Enter the PIN at `http://homebridge-server:8999`
  - Replace `homebridge-server` with the IP or name of your homebridge server
9. Your TV should appear in HomeKit as soon as all channels have been scanned

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
        "applications": false,
        "sources": [
          "extInput:hdmi",
          "extInput:component",
          "extInput:scart",
          "extInput:cec",
          "extInput:widi"
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

Optional options (all inside one TV entry):
  - `sources` is an array of sources to display in HomeKit, default `["extInput:hdmi", "extInput:component", "extInput:scart", "extInput:cec", "extInput:widi"]`
  - `tvsource` is your preferred TV source, can be `tv:dvbt`, `tv:dvbc` or `tv:dvbs`, default none (no TV channels listed as inputs)
  - `applications` can be used to enable listing applications in the input list, default `false`
  -- Providing an array of objects with application titles will only add applications whose names contain the titles to the input list:
    ```
    "applications": [
                        {
                            "title": "Netflix"
                        },
                        {
                            "title": "Plex"
                        },
                    ]
    ```
  - `soundoutput` is your preferred TV sound output, can be `speaker` or `headphone`, default `speaker`
  - `cookiepath` file (!) name to store the cookie file to, default `"[user home]/.homebridge/sonycookie"`
  - `port` is the IP port of your TV, default 80
  - `mac` is the MAC address of your TV, set it to use WOL instead of HTTP to wake up the TV, default none

## Usage
### Basic functions
#### ON/OFF
You can turn your TV on and off through Siri and Apples Home app.
#### Inputs and Applications
All Channels, Inputs and Applications can be selected in the HomeKit inputs selector
#### TV Remote
The TV registers as a TV remote device in HomeKit and allows to use basic function keys and set the volume through the Apple Remote app or iOS configuration screen. Use your phones volume knobs to set the TV volume!

## Notes
Thanks go out to "lombi" for his sony bravia homebridge plugin, which this plugin is heavily based on.
