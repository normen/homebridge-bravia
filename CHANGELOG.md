# Changelog for homebridge-bravia
This is the change log for the plugin, all relevant changes will be listed here.

For documentation please see the [README](https://github.com/normen/homebridge-bravia/blob/master/README.md)

## 2.4.9
- Use proper storage folder `plugin-persist/homebridge-bravia`

## 2.4.8
- Avoid annoying warnings

## 2.4.7
- Small improvements

## 2.4.6
- Store channels for external TVs in file as the device cache in homebridge doesn't store external devices
- Improve channel update logic

## 2.4.5
- Allow enabling debug output per TV through UI
- Fix debug output not working

## 2.4.4
- Fix UUID issue causing external TVs to be added twice
- External TVs might have to be added again

## 2.4.3
- Fix adding devices in non-external mode

## 2.4.2
- Fix external accessory mode (not enabled by default)
- External accessory mode will currently need to re-scan the TV channels on each homebridge boot

## 2.4.1
- disable external accessory mode as its broken as of now

## 2.4
- make externalaccessory mode the default

## 2.3.2
- add accessory category to fix icon display

## 2.3.1
- fix removal of nonexisting accessories
- update README with new options

## 2.3
- add option to register TV as external accessory,
  this allows multiple TVs to appear in the remote app

## 2.2.3
- hide more warnings

## 2.2.2
- README updates
- only log warnings when in debug mode
- improve error checking of TV responses

## 2.2.1
- layout fix

## 2.2.0
- cleanups
- add changelog
- add development info
- fix client ID issue for waking up TV

## 2.1.11
- fix error when plugin is started without config (old homebridge)

## 2.1.10
- only scan channels if TV is on

## 2.1.9
- increase security by using unique uuid per instance

## 2.1.8
- fix channelupdaterate

## 2.1.7
- allow renaming channels

## 2.1.6
- improve internal channel number handling

## 2.1.5
- use map for channel identifier

## 2.1.4
- avoid escalating channel identifiers

## 2.1.3
- allow setting address for WOL

## 2.1.2
- cleanups
- small fixes
- less scary error messages

## 2.1.1
- update channels continuously by default

## 2.1.0
- allow updates of channel/app list

## 2.0.4
- fix error when channels appear twice in the TV

## 2.0.3
- fix crash when channel is not found

## 2.0.2
- fix starting applications

## 2.0.1
- README updates
- small fix in IR URL
- code cleanups

## 2.0.0
- use dynamic accessory model (no more blocking HB boot)
- store cookie file in HB storage path
- store separate cookie files for separate TVs
- use web server for PIN entry
- requires setting up existing TVs again!

## 1.3.4
- remove ping test

## 1.3.3
- improve config panel

## 1.3.2
- fix mac address in config panel

## 1.3.1
- add support for config-ui-x settings panels

