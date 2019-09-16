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

## Installation
1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-bravia
3. Set "Remote start" to ON in your TV Settings->Network->Remote Start
4. Use one of the methods outlined below to authenticate with your TV

### Secure Auth through command line
When you run the plugin for the first time the easiest way is to run the homebridge process directly from command line as the plugin prompts you for a PIN that the TV will give you. This way the TV doesn't have to be set to the unsafe "Basic" login mode.

1. Stop the homebridge server (e.g. `sudo systemctl stop homebridge`)
2. Run server from command line (e.g. enter `homebridge` on command line directly)
3. TV shows PIN
4. Enter PIN on command line
5. The plugin should now log in successfully
6. Press Ctrl-C to stop the homebridge process
7. Restart homebridge server as a service again (e.g. `sudo systemctl start homebridge`)

### Secure Auth through config.json
If for some reason you can't run the HomeBridge executable directly on command line you will have to run the server once, then add an entry "pwd":"PIN_HERE" with the PIN that appears on your TV to your config.json and restart the server, then after the first successful login remove the pwd entry again from config.json.

1. Run server with homebridge plugin enabled
2. TV shows PIN
3. Add "pwd":"PIN_HERE" in config.json (with your PIN of course)
4. Restart the homebridge server
5. The plugin should now log in successfully
6. Remove "pwd" entry from config.json
7. Restart homebridge server again

### Basic Auth login (not recommended!)
If you want to use Basic login mode set the TV to Basic login mode (TV settings / PSK) and add a "pwd" entry with your password to config.json, no PIN entry is needed.

Note that this is not recommended, it can easily be used to hack your TV and though it your whole network.

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
        "pwd": "12345",
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
    ```
  - `soundoutput` is your preferred TV sound output, can be `speaker` or `headphone`, default `speaker`
  - `cookiepath` file (!) name to store the cookie file to, default `"[user home]/.homebridge/sonycookie"`
  - `port` is the IP port of your TV, default 80
  - `mac` is the MAC address of your TV, set it to use WOL instead of HTTP to wake up the TV, default none
  - `pwd` set password to use Basic login - only recommended for PIN entry!

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
