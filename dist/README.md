## Trend Panel Plugin for Grafana

The Trend Panel can show the current value of a metric and compare it to a previous time. It will also show the trend in percent and the difference of the two values:

![trend panel demo](docs/screenshot-showcase.png)

## Status
This plugin is a fork of a partly-working and seemingly abandoned [Grafana plugin](https://github.com/buholzer/grafana-trend-panel). Work has been carried out to add features that TTD required as well as a number of small bug fixes.

**All changes should be done within the `ttd-master` branch**. We are keeping master at parity with the original fork.

## Building
```
npm install -g grunt
npm install
grunt
```

## Build on source file change
```
grunt -watch
```

## Attribution
- Originally forked from https://github.com/buholzer/grafana-trend-panel. Trend icon by ✦ Shmidt Sergey ✦ from the Noun Project