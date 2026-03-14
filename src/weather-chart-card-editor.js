import { LitElement, html } from 'lit';

const ALT_SCHEMA = [
  { name: "temp", title: "Alternative temperature sensor", selector: { entity: { domain: 'sensor' } } },
  { name: "feels_like", title: "Alternative feels like temperature sensor", selector: { entity: { domain: 'sensor' } } },
  { name: "description", title: "Alternative weather description sensor", selector: { entity: { domain: 'sensor' } } },
  { name: "press", title: "Alternative pressure sensor", selector: { entity: { domain: 'sensor' } } },
  { name: "humid", title: "Alternative humidity sensor", selector: { entity: { domain: 'sensor' } } },
  { name: "uv", title: "Alternative UV index sensor", selector: { entity: { domain: 'sensor' } } },
  { name: "winddir", title: "Alternative wind bearing sensor", selector: { entity: { domain: 'sensor' } } },
  { name: "windspeed", title: "Alternative wind speed sensor", selector: { entity: { domain: 'sensor' } } },
  { name: "dew_point", title: "Alternative dew pointsensor", selector: { entity: { domain: 'sensor' } } },
  { name: "wind_gust_speed", title: "Alternative wind gust speed sensor", selector: { entity: { domain: 'sensor' } } },
  { name: "visibility", title: "Alternative visibility sensor", selector: { entity: { domain: 'sensor' } } },
];

class WeatherChartCardEditor extends LitElement {
  static get properties() {
    return {
      _config: { type: Object },
      currentPage: { type: String },
      entities: { type: Array },
      hass: { type: Object },
      _entity: { type: String },
    };
  }

  constructor() {
    super();
    this.currentPage = 'card';
    this._entity = '';
    this.entities = [];
    this._formValueChanged = this._formValueChanged.bind(this);
    
    // Initialize with empty config to prevent crashes
    this._config = {
      forecast: {},
      units: {}
    };
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this._config = config;
    this._entity = config.entity || '';
    this.hasApparentTemperature = (
      this.hass &&
      this.hass.states[config.entity] &&
      this.hass.states[config.entity].attributes &&
      this.hass.states[config.entity].attributes.apparent_temperature !== undefined
    ) || config.feels_like !== undefined;
    this.hasDewpoint = (
      this.hass &&
      this.hass.states[config.entity] &&
      this.hass.states[config.entity].attributes &&
      this.hass.states[config.entity].attributes.dew_point !== undefined
    ) || config.dew_point !== undefined;
    this.hasWindgustspeed = (
      this.hass &&
      this.hass.states[config.entity] &&
      this.hass.states[config.entity].attributes &&
      this.hass.states[config.entity].attributes.wind_gust_speed !== undefined
    ) || config.wind_gust_speed !== undefined;
    this.hasVisibility = (
      this.hass &&
      this.hass.states[config.entity] &&
      this.hass.states[config.entity].attributes &&
      this.hass.states[config.entity].attributes.visibility !== undefined
    ) || config.visibility !== undefined;
    this.hasDescription = (
      this.hass &&
      this.hass.states[config.entity] &&
      this.hass.states[config.entity].attributes &&
      this.hass.states[config.entity].attributes.description !== undefined
    ) || config.description !== undefined;
    this.fetchEntities();	  
    this.requestUpdate();
  }

  get config() {
    return this._config;
  }

  updated(changedProperties) {
    if (changedProperties.has('hass')) {
      this.fetchEntities();
    }
    if (changedProperties.has('_config') && this._config && this._config.entity) {
      this._entity = this._config.entity;
    }
  }

  fetchEntities() {
    if (this.hass) {
      this.entities = Object.keys(this.hass.states).filter((e) => e.startsWith('weather.'));
      this.requestUpdate();
    }
  }

  _EntityChanged(event, key) {
    if (!this._config) {
      return;
    }
    const newConfig = { ...this._config };
    newConfig.entity = event.target.value;
    this._entity = event.target.value;
    this.configChanged(newConfig);
  }

  configChanged(newConfig) {
    const event = new Event("config-changed", {
      bubbles: true,
      composed: true,
    });
    event.detail = { config: newConfig };
    this.dispatchEvent(event);
  }

  _valueChanged(event, key) {
    if (!this._config) {
      return;
    }

    let newConfig = { ...this._config };

    if (key.includes('.')) {
      const parts = key.split('.');
      let currentLevel = newConfig;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];

        currentLevel[part] = { ...currentLevel[part] };

        currentLevel = currentLevel[part];
      }

      const finalKey = parts[parts.length - 1];
      if (event.target.checked !== undefined) {
        currentLevel[finalKey] = event.target.checked;
      } else {
        currentLevel[finalKey] = event.target.value;
      }
    } else {
      if (event.target.checked !== undefined) {
        newConfig[key] = event.target.checked;
      } else {
        newConfig[key] = event.target.value;
      }
    }

    this.configChanged(newConfig);
    this.requestUpdate();
  }

  _handleStyleChange(event) {
    if (!this._config) {
      return;
    }
    const newConfig = JSON.parse(JSON.stringify(this._config));
    newConfig.forecast.style = event.target.value;
    this.configChanged(newConfig);
    this.requestUpdate();
  }

  _handleTypeChange(event) {
    if (!this._config) {
      return;
    }
    const newConfig = JSON.parse(JSON.stringify(this._config));
    newConfig.forecast.type = event.target.value;
    this.configChanged(newConfig);
    this.requestUpdate();
  }

  _handleIconStyleChange(event) {
    if (!this._config) {
      return;
    }
    const newConfig = JSON.parse(JSON.stringify(this._config));
    newConfig.icon_style = event.target.value;
    this.configChanged(newConfig);
    this.requestUpdate();
  }

  _handlePrecipitationTypeChange(e) {
    const newValue = e.target.value;
    this.config.forecast.precipitation_type = newValue;
  }

  _formValueChanged(event) {
    if (event.target.tagName.toLowerCase() === 'ha-form') {
      const newConfig = event.detail.value;
      this.configChanged(newConfig);
      this.requestUpdate();
    }
  }

  showPage(pageName) {
    this.currentPage = pageName;
    this.requestUpdate();
  }

  render() {
    if (this._config && this._config.entity !== this._entity) {
      this._entity = this._config.entity;
    }
    const forecastConfig = this._config.forecast || {};
    const unitsConfig = this._config.units || {};
    const isShowTimeOn = this._config.show_time !== false;


    return html`
      <style>
        .switch-label {
          padding-left: 14px;
        }
        .switch-container {
          margin-bottom: 12px;
        }
        .page-container {
	  display: none;
        }
        .page-container.active {
          display: block;
        }
        .time-container {
          display: flex;
          flex-direction: row;
          margin-bottom: 12px;
        }
        .icon-container {
          display: flex;
          flex-direction: row;
          margin-bottom: 12px;
        }
        .switch-right {
          display: flex;
          flex-direction: row;
          align-items: center;
        }
        .checkbox-container {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .textfield-container {
          display: flex;
          flex-direction: column;
          margin-bottom: 10px;
	  gap: 20px;
        }
        .radio-container {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .radio-group {
          display: flex;
          align-items: center;
        }
        .radio-group label {
          margin-left: 4px;
        }
        .buttons-container {
          display: flex;
          gap: 4px;
          border-bottom: 2px solid var(--divider-color);
          margin: 20px 0;
        }
        .page-button {
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          padding: 12px 16px;
          cursor: pointer;
          color: var(--secondary-text-color);
          font-size: 14px;
          font-weight: 400;
          transition: all 0.2s ease;
          outline: none;
        }
        .page-button:hover {
          background: var(--secondary-background-color, rgba(0, 0, 0, 0.05));
          color: var(--primary-text-color);
        }
        .page-button.active {
          border-bottom-color: var(--primary-color);
          color: var(--primary-color);
          font-weight: 500;
        }
        .flex-container {
          display: flex;
          flex-direction: row;
          gap: 20px;
        }
        .flex-container ha-textfield {
          flex-basis: 50%;
          flex-grow: 1;
        }
      </style>
      <div>
      <div class="textfield-container">
<ha-select
  naturalMenuWidth
  fixedMenuPosition
  label="Entity"
  .configValue=${'entity'}
  .value=${this._entity}
  @value-changed=${(e) => this._EntityChanged(e, 'entity')}
>
  ${this.entities.map((entity) => html`<ha-list-item .value=${entity}>${entity}</ha-list-item>`)}
</ha-select>
      <ha-textfield
        label="Title"
        .value="${this._config.title || ''}"
        @change="${(e) => this._valueChanged(e, 'title')}"
      ></ha-textfield>
      
      <div>
        <label>Select custom language</label>
        <select
          style="width: 100%; padding: 8px; margin: 10px 0; font-size: 14px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color);"
          .value=${this._config.locale || ''}
          @change=${(e) => {
            const evt = { target: { value: e.target.value } };
            this._valueChanged(evt, 'locale');
          }}
        >
          <option value="">HA Default</option>
          <option value="bg">🇧🇬 Bulgarian</option>
          <option value="ca">🇪🇸 Catalan</option>
          <option value="cs">🇨🇿 Czech</option>
          <option value="da">🇩🇰 Danish</option>
          <option value="nl">🇳🇱 Dutch</option>
          <option value="en">🇬🇧 English</option>
          <option value="fi">🇫🇮 Finnish</option>
          <option value="fr">🇫🇷 French</option>
          <option value="de">🇩🇪 German</option>
          <option value="el">🇬🇷 Greek</option>
          <option value="hu">🇭🇺 Hungarian</option>
          <option value="it">🇮🇹 Italian</option>
          <option value="lt">🇱🇹 Lithuanian</option>
          <option value="no">🇳🇴 Norwegian</option>
          <option value="pl">🇵🇱 Polish</option>
          <option value="pt">🇵🇹 Portuguese</option>
          <option value="ro">🇷🇴 Romanian</option>
          <option value="ru">🇷🇺 Russian</option>
          <option value="sk">🇸🇰 Slovak</option>
          <option value="es">🇪🇸 Spanish</option>
          <option value="sv">🇸🇪 Swedish</option>
          <option value="uk">🇺🇦 Ukrainian</option>
          <option value="ko">🇰🇷 한국어</option>
        </select>
      </div>

      <div>
        <label>Timezone</label>
        <select
          style="width: 100%; padding: 8px; margin: 10px 0; font-size: 14px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color);"
          .value=${this._config.timezone || ''}
          @change=${(e) => {
            console.log('TIMEZONE CHANGED!', e.target.value);
            const evt = { target: { value: e.target.value } };
            this._valueChanged(evt, 'timezone');
          }}
        >
          <option value="">HA Default (Auto-detect)</option>
          <option value="America/New_York">🇺🇸 America/New_York (EST/EDT)</option>
          <option value="America/Chicago">🇺🇸 America/Chicago (CST/CDT)</option>
          <option value="America/Denver">🇺🇸 America/Denver (MST/MDT)</option>
          <option value="America/Los_Angeles">🇺🇸 America/Los_Angeles (PST/PDT)</option>
          <option value="America/Anchorage">🇺🇸 America/Anchorage (AKST/AKDT)</option>
          <option value="Pacific/Honolulu">🇺🇸 Pacific/Honolulu (HST)</option>
          <option value="America/Toronto">🇨🇦 America/Toronto (EST/EDT)</option>
          <option value="America/Vancouver">🇨🇦 America/Vancouver (PST/PDT)</option>
          <option value="Europe/London">🇬🇧 Europe/London (GMT/BST)</option>
          <option value="Europe/Paris">🇫🇷 Europe/Paris (CET/CEST)</option>
          <option value="Europe/Berlin">🇩🇪 Europe/Berlin (CET/CEST)</option>
          <option value="Europe/Rome">🇮🇹 Europe/Rome (CET/CEST)</option>
          <option value="Europe/Madrid">🇪🇸 Europe/Madrid (CET/CEST)</option>
          <option value="Europe/Amsterdam">🇳🇱 Europe/Amsterdam (CET/CEST)</option>
          <option value="Europe/Brussels">🇧🇪 Europe/Brussels (CET/CEST)</option>
          <option value="Europe/Vienna">🇦🇹 Europe/Vienna (CET/CEST)</option>
          <option value="Europe/Zurich">🇨🇭 Europe/Zurich (CET/CEST)</option>
          <option value="Europe/Stockholm">🇸🇪 Europe/Stockholm (CET/CEST)</option>
          <option value="Europe/Warsaw">🇵🇱 Europe/Warsaw (CET/CEST)</option>
          <option value="Europe/Prague">🇨🇿 Europe/Prague (CET/CEST)</option>
          <option value="Europe/Budapest">🇭🇺 Europe/Budapest (CET/CEST)</option>
          <option value="Europe/Bucharest">🇷🇴 Europe/Bucharest (EET/EEST)</option>
          <option value="Europe/Athens">🇬🇷 Europe/Athens (EET/EEST)</option>
          <option value="Europe/Helsinki">🇫🇮 Europe/Helsinki (EET/EEST)</option>
          <option value="Europe/Moscow">🇷🇺 Europe/Moscow (MSK)</option>
          <option value="Asia/Dubai">🇦🇪 Asia/Dubai (GST)</option>
          <option value="Asia/Shanghai">🇨🇳 Asia/Shanghai (CST)</option>
          <option value="Asia/Tokyo">🇯🇵 Asia/Tokyo (JST)</option>
          <option value="Asia/Seoul">🇰🇷 Asia/Seoul (KST)</option>
          <option value="Asia/Singapore">🇸🇬 Asia/Singapore (SGT)</option>
          <option value="Australia/Sydney">🇦🇺 Australia/Sydney (AEDT/AEST)</option>
          <option value="Australia/Melbourne">🇦🇺 Australia/Melbourne (AEDT/AEST)</option>
          <option value="Pacific/Auckland">🇳🇿 Pacific/Auckland (NZDT/NZST)</option>
        </select>
      </div>
       </div>

      <h5>Forecast type:</h5>
      <div class="radio-container">
        <div class="switch-right">
          <ha-radio
            name="type"
            value="daily"
            @change="${this._handleTypeChange}"
            .checked="${forecastConfig.type === 'daily'}"
          ></ha-radio>
          <label class="check-label">
            Daily forecast
          </label>
        </div>

        <div class="switch-right">
          <ha-radio
            name="type"
            value="hourly"
            @change="${this._handleTypeChange}"
            .checked="${forecastConfig.type === 'hourly'}"
          ></ha-radio>
          <label class="check-label">
            Hourly forecast
          </label>
        </div>
      </div>

      <h5>Chart style:</h5>
      <div class="radio-container">
        <div class="switch-right">
          <ha-radio
            name="style"
            value="style1"
            @change="${this._handleStyleChange}"
            .checked="${forecastConfig.style === 'style1'}"
          ></ha-radio>
          <label class="check-label">
            Chart style 1
          </label>
        </div>

        <div class="switch-right">
          <ha-radio
            name="style"
            value="style2"
            @change="${this._handleStyleChange}"
            .checked="${forecastConfig.style === 'style2'}"
          ></ha-radio>
          <label class="check-label">
            Chart style 2
          </label>
        </div>
      </div>

      <h5>Icons settings:</h5>
      <div class="icon-container">
        <div class="switch-right">
          <ha-switch
            @change="${(e) => this._valueChanged(e, 'animated_icons')}"
            .checked="${this._config.animated_icons === true}"
          ></ha-switch>
          <label class="switch-label">
            Use Animated Icons
          </label>
        </div>
        <div class="switch-right radio-container" style="${this._config.animated_icons ? 'display: flex;' : 'display: none;'}">
          <ha-radio
            name="icon_style"
            value="style1"
            @change="${this._handleIconStyleChange}"
            .checked="${this._config.icon_style === 'style1'}"
          ></ha-radio>
          <label class="check-label">
            Style 1
          </label>
        </div>
        <div class="switch-right radio-container" style="${this._config.animated_icons ? 'display: flex;' : 'display: none;'}">
          <ha-radio
            name="icon_style"
            value="style2"
            @change="${this._handleIconStyleChange}"
            .checked="${this._config.icon_style === 'style2'}"
          ></ha-radio>
          <label class="check-label">
            Style 2
          </label>
        </div>
      </div>
      <div class="flex-container">
        <ha-textfield
          label="Size for daily icons"
          type="number"
          .value="${this._config.icons_size || '35'}"
          @change="${(e) => this._valueChanged(e, 'icons_size')}"
        ></ha-textfield>
        <ha-textfield
          label="Main Weather Icon Size"
          type="number"
          .value="${this._config.main_icon_size || '150'}"
          @change="${(e) => this._valueChanged(e, 'main_icon_size')}"
        ></ha-textfield>
      </div>

      <div class="buttons-container">
        <button class="page-button ${this.currentPage === 'card' ? 'active' : ''}" @click="${() => this.showPage('card')}">Main</button>
        <button class="page-button ${this.currentPage === 'forecast' ? 'active' : ''}" @click="${() => this.showPage('forecast')}">Forecast</button>
        <button class="page-button ${this.currentPage === 'units' ? 'active' : ''}" @click="${() => this.showPage('units')}">Units</button>
        <button class="page-button ${this.currentPage === 'alternate' ? 'active' : ''}" @click="${() => this.showPage('alternate')}">Alternate entities</button>
      </div>

        <!-- Card Settings Page -->
        <div class="page-container ${this.currentPage === 'card' ? 'active' : ''}">
          <div class="switch-container">
            <ha-switch
              @change="${(e) => this._valueChanged(e, 'show_main')}"
              .checked="${this._config.show_main !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Main
            </label>
          </div>
      <div class="switch-container">
        ${this.hasApparentTemperature ? html`
          <ha-switch
            @change="${(e) => this._valueChanged(e, 'show_feels_like')}"
            .checked="${this._config.show_feels_like !== false}"
          ></ha-switch>
          <label class="switch-label">
            Show Feels Like Temperature
          </label>
        ` : ''}
      </div>
      <div class="switch-container">
        ${this.hasDescription ? html`
          <ha-switch
            @change="${(e) => this._valueChanged(e, 'show_description')}"
            .checked="${this._config.show_description !== false}"
          ></ha-switch>
          <label class="switch-label">
            Show Weather Description
          </label>
        ` : ''}
      </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e) => this._valueChanged(e, 'show_temperature')}"
              .checked="${this._config.show_temperature !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Current Temperature
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e) => this._valueChanged(e, 'show_current_condition')}"
              .checked="${this._config.show_current_condition !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Current Weather Condition
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e) => this._valueChanged(e, 'show_attributes')}"
              .checked="${this._config.show_attributes !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Attributes
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e) => this._valueChanged(e, 'show_humidity')}"
              .checked="${this._config.show_humidity !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Humidity
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e) => this._valueChanged(e, 'show_pressure')}"
              .checked="${this._config.show_pressure !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Pressure
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e) => this._valueChanged(e, 'show_sun')}"
              .checked="${this._config.show_sun !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Sun
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e) => this._valueChanged(e, 'show_wind_direction')}"
              .checked="${this._config.show_wind_direction !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Wind Direction
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e) => this._valueChanged(e, 'show_wind_speed')}"
              .checked="${this._config.show_wind_speed !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Wind Speed
            </label>
	  </div>
      <div class="switch-container">
        ${this.hasDewpoint ? html`
          <ha-switch
            @change="${(e) => this._valueChanged(e, 'show_dew_point')}"
            .checked="${this._config.show_dew_point !== false}"
          ></ha-switch>
          <label class="switch-label">
            Show Dew Point
          </label>
        ` : ''}
      </div>
      <div class="switch-container">
        ${this.hasWindgustspeed ? html`
          <ha-switch
            @change="${(e) => this._valueChanged(e, 'show_wind_gust_speed')}"
            .checked="${this._config.show_wind_gust_speed !== false}"
          ></ha-switch>
          <label class="switch-label">
            Show Wind Gust Speed
          </label>
        ` : ''}
      </div>
      <div class="switch-container">
        ${this.hasVisibility ? html`
          <ha-switch
            @change="${(e) => this._valueChanged(e, 'show_visibility')}"
            .checked="${this._config.show_visibility !== false}"
          ></ha-switch>
          <label class="switch-label">
            Show Visibility
          </label>
        ` : ''}
      </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e) => this._valueChanged(e, 'show_last_changed')}"
              .checked="${this._config.show_last_changed !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show when last data changed
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e) => this._valueChanged(e, 'use_12hour_format')}"
              .checked="${this._config.use_12hour_format !== false}"
            ></ha-switch>
            <label class="switch-label">
              Use 12-Hour Format
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e) => this._valueChanged(e, 'autoscroll')}"
              .checked="${this._config.autoscroll !== false}"
            ></ha-switch>
            <label class="switch-label">
              Autoscroll
            </label>
          </div>
          <div class="time-container">
            <div class="switch-right">
              <ha-switch
                @change="${(e) => this._valueChanged(e, 'show_time')}"
                .checked="${this._config.show_time !== false}"
              ></ha-switch>
              <label class="switch-label">
                Show Current Time
              </label>
            </div>
            <div class="switch-right checkbox-container" style="${this._config.show_time ? 'display: flex;' : 'display: none;'}">
              <ha-checkbox
                @change="${(e) => this._valueChanged(e, 'show_time_seconds')}"
                .checked="${this._config.show_time_seconds !== false}"
              ></ha-checkbox>
              <label class="check-label">
                Show Seconds
              </label>
            </div>
            <div class="switch-right checkbox-container" style="${this._config.show_time ? 'display: flex;' : 'display: none;'}">
              <ha-checkbox
                @change="${(e) => this._valueChanged(e, 'show_day')}"
                .checked="${this._config.show_day !== false}"
              ></ha-checkbox>
              <label class="check-label">
                Show Day
              </label>
            </div>
            <div class="switch-right checkbox-container" style="${this._config.show_time ? 'display: flex;' : 'display: none;'}">
              <ha-checkbox
                @change="${(e) => this._valueChanged(e, 'show_date')}"
                .checked="${this._config.show_date !== false}"
              ></ha-checkbox>
              <label class="check-label">
                Show Date
              </label>
            </div>
          </div>
            <div class="flex-container" style="${this._config.show_time ? 'display: flex;' : 'display: none;'}">
              <ha-textfield
                label="Time Font Size"
                type="number"
                .value="${this._config.time_size || '26'}"
                @change="${(e) => this._valueChanged(e, 'time_size')}"
              ></ha-textfield>
              <ha-textfield
                label="Date Font Size"
                type="number"
                .value="${this._config.day_date_size || '15'}"
                @change="${(e) => this._valueChanged(e, 'day_date_size')}"
              ></ha-textfield>
              <ha-textfield
                label="Temp Font Size"
                type="number"
                .value="${this._config.current_temp_size || '38'}"
                @change="${(e) => this._valueChanged(e, 'current_temp_size')}"
              ></ha-textfield>
              </div>
      </div>

        <!-- Forecast Settings Page -->
        <div class="page-container ${this.currentPage === 'forecast' ? 'active' : ''}">
          <div class="switch-container">
            <ha-switch
              @change="${(e) => this._valueChanged(e, 'forecast.condition_icons')}"
              .checked="${forecastConfig.condition_icons !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Condition Icons
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e) => this._valueChanged(e, 'forecast.show_wind_forecast')}"
              .checked="${forecastConfig.show_wind_forecast !== false}"
            ></ha-switch>
            <label class="switch-label">
              Show Wind Forecast
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e) => this._valueChanged(e, 'forecast.round_temp')}"
              .checked="${forecastConfig.round_temp !== false}"
            ></ha-switch>
            <label class="switch-label">
              Rounding Temperatures
            </label>
          </div>
          <div class="switch-container">
            <ha-switch
              @change="${(e) => this._valueChanged(e, 'forecast.disable_animation')}"
              .checked="${forecastConfig.disable_animation !== false}"
            ></ha-switch>
            <label class="switch-label">
              Disable Chart Animation
            </label>
          </div>
	  <div class="textfield-container">
          <div>
            <label>Precipitation Type (Probability if supported by the weather entity)</label>
            <select
              style="width: 100%; padding: 8px; margin: 10px 0; font-size: 14px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color);"
              .value=${forecastConfig.precipitation_type || 'rainfall'}
              @change=${(e) => {
                const evt = { target: { value: e.target.value } };
                this._valueChanged(evt, 'forecast.precipitation_type');
              }}
            >
              <option value="rainfall">Rainfall</option>
              <option value="probability">Probability</option>
            </select>
          </div>
         <div class="switch-container" ?hidden=${forecastConfig.precipitation_type !== 'rainfall'}>
             <ha-switch
               @change="${(e) => this._valueChanged(e, 'forecast.show_probability')}"
               .checked="${forecastConfig.show_probability !== false}"
             ></ha-switch>
             <label class="switch-label">
               Show precipitation probability
             </label>
         </div>
          <div class="textfield-container">
            <div class="flex-container">
              <ha-textfield
                label="Precipitation Bar Size %"
                type="number"
                max="100"
                min="0"
                .value="${forecastConfig.precip_bar_size || '100'}"
                @change="${(e) => this._valueChanged(e, 'forecast.precip_bar_size')}"
              ></ha-textfield>
              <ha-textfield
                label="Labels Font Size"
                type="number"
                .value="${forecastConfig.labels_font_size || '11'}"
                @change="${(e) => this._valueChanged(e, 'forecast.labels_font_size')}"
              ></ha-textfield>
              </div>
	    <div class="flex-container">
              <ha-textfield
                label="Chart height"
                type="number"
                .value="${forecastConfig.chart_height || '180'}"
                @change="${(e) => this._valueChanged(e, 'forecast.chart_height')}"
              ></ha-textfield>
              <ha-textfield
                label="Number of forecasts"
                type="number"
                .value="${forecastConfig.number_of_forecasts || '0'}"
                @change="${(e) => this._valueChanged(e, 'forecast.number_of_forecasts')}"
              ></ha-textfield>
              </div>
            </div>
          </div>
        </div>

        <!-- Units Page -->
        <div class="page-container ${this.currentPage === 'units' ? 'active' : ''}">
          <div class="textfield-container">
            <div>
              <label>Convert temperature to</label>
              <select
                style="width: 100%; padding: 8px; margin: 10px 0; font-size: 14px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color);"
                .value=${unitsConfig.temperature || ''}
                @change=${(e) => {
                  const evt = { target: { value: e.target.value } };
                  this._valueChanged(evt, 'units.temperature');
                }}
              >
                <option value="">Default</option>
                <option value="°C">Celsius (°C)</option>
                <option value="°F">Fahrenheit (°F)</option>
              </select>
            </div>
            <div>
              <label>Convert pressure to</label>
              <select
                style="width: 100%; padding: 8px; margin: 10px 0; font-size: 14px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color);"
                .value=${unitsConfig.pressure || ''}
                @change=${(e) => {
                  const evt = { target: { value: e.target.value } };
                  this._valueChanged(evt, 'units.pressure');
                }}
              >
                <option value="">Default</option>
                <option value="hPa">hPa</option>
                <option value="mmHg">mmHg</option>
                <option value="inHg">inHg</option>
              </select>
            </div>
            <div>
              <label>Convert wind speed to</label>
              <select
                style="width: 100%; padding: 8px; margin: 10px 0; font-size: 14px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color);"
                .value=${unitsConfig.speed || ''}
                @change=${(e) => {
                  const evt = { target: { value: e.target.value } };
                  this._valueChanged(evt, 'units.speed');
                }}
              >
                <option value="">Default</option>
                <option value="km/h">km/h</option>
                <option value="m/s">m/s</option>
                <option value="Bft">Bft</option>
                <option value="mph">mph</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Alternate Page -->
        <div class="page-container ${this.currentPage === 'alternate' ? 'active' : ''}">
          <h5>Alternative sensors for the main card attributes:</h5>
          <ha-form
            .data=${this._config}
            .schema=${ALT_SCHEMA}
            .hass=${this.hass}
            @value-changed=${this._formValueChanged}
          ></ha-form>
        </div>
    `;
  }
}
customElements.define("weather-chart-card-ha-editor", WeatherChartCardEditor);
