import {MetricsPanelCtrl} from 'app/plugins/sdk';
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import TimeSeries from 'app/core/time_series';
// import rendering from './rendering';
import './css/trend-panel.css!';

export class TrendCtrl extends MetricsPanelCtrl {

  constructor($scope, $injector, $rootScope) {
    super($scope, $injector);
    this.$rootScope = $rootScope;

    const panelDefaults = {
      bgColor: null,
      prefix: '',
      postfix: '',
      valueName: 'avg',
      format: 'none',
      prefixFontSize: '50%',
      valueFontSize: '80%',
      postfixFontSize: '50%',
      trend: {
        show: true,
        valueFontSize: '80%',
        signFontSize: '70%',
        unitFontSize: '50%',
        showDiff: false,
        colors: ['#d44a3a', '#e5ac0e', '#299c46'],
        sign: ['▼', '▶', '▲'],
        colorInBackground: false,
        thresholds : "0,0"
      },
    };

    _.defaultsDeep(this.panel, panelDefaults);

    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('panel-teardown', this.onPanelTeardown.bind(this));
    this.events.on('panel-initialized', this.render.bind(this));

    this.data = {trend: {percent: 0, sign: 0}};

    this.valueNameOptions = [
      { value: 'min', text: 'Min' },
      { value: 'max', text: 'Max' },
      { value: 'avg', text: 'Average' },
      { value: 'current', text: 'Current' },
      { value: 'total', text: 'Total' },
      { value: 'name', text: 'Name' },
      { value: 'first', text: 'First' },
      { value: 'delta', text: 'Delta' },
      { value: 'diff', text: 'Difference' },
      { value: 'range', text: 'Range' },
      { value: 'last_time', text: 'Time of last point' },
    ];
  }

  //
  // Event Handling
  //
  onDataError(err) {
    console.log(err);
    this.onDataReceived([]);
  }

  onDataReceived(dataList) {
    const data = {};
console.log('onDataReceived()', dataList)
    this.series = dataList.map(this.seriesHandler.bind(this));
    this.setValues(data);

    this.data = data;
    this.render();
  }

  onInitEditMode() {
    this.fontSizes = ['20%', '30%', '50%', '70%', '80%', '100%', '110%', '120%', '150%', '170%', '200%'];
    this.unitFormats = kbn.getUnitFormats();
    this.addEditorTab('Options', 'public/plugins/trend-panel/editor.html', 2);
  }

  onPanelTeardown() {
    this.$timeout.cancel(this.nextTickPromise);
  }

  onTrendColorChange(panelColorIndex) {
    return color => {
      this.panel.trend.colors[panelColorIndex] = color;
      this.render();
    };
  }

  //
  // Data Handling
  //
  seriesHandler(seriesData) {
    const series = new TimeSeries({
      datapoints: seriesData.datapoints || [],
      alias: seriesData.target,
    });

    series.flotpairs = series.getFlotPairs(this.panel.nullPointMode);
    return series;
  }

  setValues(data) {
    data.flotpairs = [];

    // console.log(`${this.panel.prefix} > setValues()`)
    // console.log(this.series)

    if (this.series && this.series.length > 0) {
      const lastPoint = _.last(this.series[0].datapoints);
      const lastValue = _.isArray(lastPoint) ? lastPoint[0] : null;

      if (this.panel.valueName === 'name') {
        data.value = 0;
        data.valueRounded = 0;
        data.valueFormatted = this.series[0].alias;
      } else if (_.isString(lastValue)) {
        data.value = 0;
        data.valueFormatted = _.escape(lastValue);
        data.valueRounded = 0;
      } else if (this.panel.valueName === 'last_time') {
        const formatFunc = kbn.valueFormats[this.panel.format];
        data.value = lastPoint[1];
        data.valueRounded = data.value;
        data.valueFormatted = formatFunc(data.value, 0, 0);
      } else {
        data.value = this.series[0].stats[this.panel.valueName];
        data.flotpairs = this.series[0].flotpairs;

        const decimalInfo = this.getDecimalsForValue(data.value);
        const formatFunc = kbn.valueFormats[this.panel.format];
        data.valueFormatted = formatFunc(data.value, decimalInfo.decimals, decimalInfo.scaledDecimals);
        data.valueRounded = kbn.roundValue(data.value, decimalInfo.decimals);
      }

      // Add $__name variable for using in prefix or postfix
      data.scopedVars = _.extend({}, this.panel.scopedVars);
      data.scopedVars['__name'] = { value: this.series[0].label }; // eslint-disable-line
    }

    if (this.series && this.series.length > 1 && data.value) {
      this.getTrendValue(data, this.series[1], data.value);
    } else {
      data.trend = {}
    }

    console.log(`${this.panel.prefix} > trend`)
    console.log(data.trend)
  }

  getTrendValue(data, series, current) {

    data.trend = {}
    const original = series.stats[this.panel.valueName];
    // const original = 130.2456;
    const increase = current - original;

    // console.log(current, original, increase)

    let percent = 0;
    if (original !== 0) {
      percent = (increase / original) * 100;
      if (percent > 0) {
        data.trend.sign = 1;
      } else if (percent < 0) {
        data.trend.sign = -1;
      } else {
        data.trend.sign = 0;
      }
    } else {
      if (current > 0) {
        data.trend.sign = 1;
      } else if (current < 0) {
        data.trend.sign = -1;
      } else {
        data.trend.sign = 0;
      }      
    }

    const numDecimals = 2;
    data.trend.percent = Math.abs(parseFloat(Math.round(percent * 100) / 100).toFixed(numDecimals));
    data.trend.percentFull = data.trend.percent | 0;
    data.trend.percentDecimals = Math.round((data.trend.percent % 1).toFixed(numDecimals) * Math.pow(10, numDecimals))
    // console.log('>> percent', data.trend.percent, data.trend.percentFull, data.trend.percentDecimals);

    data.trend.increase = increase;
    data.trend.original = original;

    const decimalInfo = this.getDecimalsForValue(increase);
    const formatFunc = kbn.valueFormats[this.panel.format];
    data.trend.increaseFormatted = formatFunc(increase, decimalInfo.decimals, decimalInfo.scaledDecimals);
    data.trend.increaseRounded = kbn.roundValue(increase, decimalInfo.decimals);
  }

  //
  // Util
  //
  setUnitFormat(subItem) {
    this.panel.format = subItem.value;
    this.refresh();
  }

  getDecimalsForValue(value) {
    if (_.isNumber(this.panel.decimals)) {
      return { decimals: this.panel.decimals, scaledDecimals: null };
    }

    const delta = value / 2;
    let dec = -Math.floor(Math.log(Math.abs(delta)) / Math.LN10);

    const magn = Math.pow(10, -dec);
    const norm = delta / magn; // norm is between 1.0 and 10.0
    let size = null;

    if (norm < 1.5) {
      size = 1;
    } else if (norm < 3) {
      size = 2;
      // special case for 2.5, requires an extra decimal
      if (norm > 2.25) {
        size = 2.5;
        ++dec;
      }
    } else if (norm < 7.5) {
      size = 5;
    } else {
      size = 10;
    }

    size *= magn;

    // reduce starting decimals if not needed
    if (Math.floor(value) === value) {
      dec = 0;
    }

    const result = {};
    result.decimals = Math.max(0, dec);
    result.scaledDecimals = result.decimals - Math.floor(Math.log(size) / Math.LN10) + 2;

    return result;
  }

  invertColorOrder() {
    const tmp = this.panel.trend.colors[0];
    this.panel.trend.colors[0] = this.panel.trend.colors[2];
    this.panel.trend.colors[2] = tmp;
    this.render();
  }

  getColorForValue() {
    if (!_.isFinite(this.data.trend.percent)) {
      return null;
    }

    var value = this.data.trend.percent * this.data.trend.sign;
    
    var thresholds = this.panel.trend.thresholds.split(',').map(strVale => {
      return Number(strVale.trim());
    });

    if (value < thresholds[0]){
      return this.panel.trend.colors[0];
    }
    else if (value >= thresholds[0] && value <= thresholds[1]){
      return this.panel.trend.colors[1];
    }
    else{
      return this.panel.trend.colors[2];
    }
  }

  //
  // Rendering
  //
  link(scope, elem) {
    this.events.on('render', () => {
      const $panelContainer = elem.find('.trend-panel-value-container');
      const $valueContainer = elem.find('.trend-panel-value-container > span.trend-panel-value');
      const $prefixContainer = elem.find('.trend-panel-value-container > span.trend-panel-prefix');
      const $trendContainer = elem.find('.trend-panel-trend-container');
      const $signContainer = elem.find('.trend-panel-trend-container > span.trend-panel-sign');
      const $unitContainer = elem.find('.trend-panel-trend-container > span.trend-panel-unit');
      const $diffContainer = elem.find('.trend-panel-trend-container > span.trend-panel-diff');
      const $trendValueContainer = elem.find('.trend-panel-trend-container > span.trend-panel-trend-value');
      const $trendDigitContainer = elem.find('.trend-panel-trend-container > span.trend-panel-trend-digits');

      $prefixContainer.html(this.panel.prefix);
      $prefixContainer.css('font-size', this.panel.prefixFontSize);
      $valueContainer.css('font-size', this.panel.valueFontSize);

      if (this.data.valueFormatted) {
        $valueContainer.html(this.data.valueFormatted);
      } else {
        $valueContainer.html('0');
        // $valueContainer.html('loading...');
        // $valueContainer.css({
        //     'opacity': 0.2,
        //     'font-size': '30%',
        //     'font-weight': 10
        //   });
      }

      if (this.panel.trend.show && 
          this.data.trend.hasOwnProperty('percent') && 
          this.data.trend.hasOwnProperty('sign')) {
        $signContainer.html(this.panel.trend.sign[this.data.trend.sign + 1]);
        $signContainer.css('font-size', this.panel.trend.signFontSize);
        $trendValueContainer.html((this.data.trend.original === 0)? '&nbsp;': this.data.trend.percentFull);
        $trendValueContainer.css('font-size', this.panel.trend.valueFontSize);
        $trendDigitContainer.html((this.data.trend.percentDecimals && this.data.trend.percentDecimals !== 0)? '.' + this.data.trend.percentDecimals : '');
		    $trendDigitContainer.css('font-size', this.panel.trend.valueFontSize);
        $unitContainer.html((this.data.trend.original === 0)? '&nbsp;': '%');
        $unitContainer.css('font-size', this.panel.trend.unitFontSize);
        var backgroundColor =  this.panel.trend.colorInBackground ? this.getColorForValue() : '#cccccc';
        var foregroundColor = this.panel.trend.colorInBackground ? '#cccccc' : this.getColorForValue();

        $trendContainer.removeAttr('style');
        if (this.panel.trend.colorInBackground){
          $trendContainer.css('background-color', backgroundColor);
        }
        else{
          $trendContainer.css('color', foregroundColor);
        }
        
        if (this.panel.trend.showDiff && 
            this.data.trend.increaseRounded && 
            this.data.trend.increaseRounded !== 0) {
          $diffContainer.html((this.data.trend.increaseRounded > 0) ? '+' + this.data.trend.increaseFormatted : this.data.trend.increaseFormatted);
          $diffContainer.css({
            'background-color': foregroundColor,
            'color': backgroundColor,
            'font-size': '30%',
            'margin-left': '15px',
            'padding': '2px 4px',
            'border-radius': '5px',
          });
        } else {
          $diffContainer.html('');
          $diffContainer.removeAttr('style');
        }
      } else {
        $signContainer.html('');
        $signContainer.removeAttr('style');
        $trendValueContainer.html("Provide query 'B' to see trend");
        $trendValueContainer.removeAttr('style');
        $unitContainer.html('');
        $unitContainer.removeAttr('style');
        $diffContainer.html('&nbsp;');
        $diffContainer.removeAttr('style');

      }

      if (this.panel.bgColor) {
        $panelContainer.css('background-color', this.panel.bgColor);
      } else {
        $panelContainer.css('background-color', 'transparent');
      }
    });
  }
}

TrendCtrl.templateUrl = 'module.html';
